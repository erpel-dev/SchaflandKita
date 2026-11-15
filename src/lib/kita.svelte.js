// Der Zustand der Kita: alle Profile und wer heute da, abgeholt, krank oder abwesend ist.
import { db, kvGet, kvSet } from "./db.js";
import { datumStr, zeitStr, tageVonBis } from "./zeit.js";
import { normalisiereProfil, sortiereProfile, zusammenfuehren } from "./profile-io.js";
import { BEISPIELE } from "./beispiele.js";

class Kita {
  profile = $state([]);
  /** Einträge von heute: profilId → { status, gekommenUm, abholzeit, gegangenUm, meldungBis } */
  heute = $state({});
  jetzt = $state(new Date());
  datum = $derived(datumStr(this.jetzt));
  uhrzeit = $derived(zeitStr(this.jetzt));
  #geladen = null;

  async load(jetzt = new Date()) {
    this.jetzt = jetzt;
    let liste = await db.profile.toArray();
    // Nur beim allerersten Start: wer alle Profile löscht, bekommt die Beispiele nicht zurück
    if (!liste.length && !(await kvGet("eingerichtet", false))) {
      liste = BEISPIELE.profile.map(normalisiereProfil);
      await db.profile.bulkPut(liste);
    }
    await kvSet("eingerichtet", true);
    this.profile = sortiereProfile(liste);
    await this.#tagLaden();
  }

  async #tagLaden() {
    const datum = datumStr(this.jetzt);
    // Wer an einem früheren Tag noch angemeldet war, wurde nicht abgeholt: vermerken und abmelden
    await db.tage.where("datum").below(datum).and((e) => e.status === "da").modify({ status: "abgeholt", nichtAbgeholt: true });
    const rows = await db.tage.where("datum").equals(datum).toArray();
    this.heute = Object.fromEntries(rows.map((r) => [r.profilId, r]));
    this.#geladen = datum;
  }

  /** Uhr weiterstellen (läuft alle paar Sekunden); um Mitternacht beginnt ein neuer Tag. */
  async tick(jetzt = new Date()) {
    this.jetzt = jetzt;
    if (datumStr(jetzt) !== this.#geladen) await this.#tagLaden();
  }

  status(id) {
    return this.heute[id]?.status ?? "offen";
  }
  eintrag(id) {
    return this.heute[id] ?? null;
  }
  profil(id) {
    return this.profile.find((p) => p.id === id) ?? null;
  }

  async #setze(id, patch) {
    const eintrag = {
      profilId: id, datum: this.datum, status: "offen", gekommenUm: null, abholzeit: null, gegangenUm: null, meldungBis: null,
      ...$state.snapshot(this.heute[id] ?? {}), ...patch,
    };
    await db.tage.put(eintrag);
    this.heute = { ...this.heute, [id]: eintrag };
  }

  /** Bringen: anmelden mit Abholzeit (bei Erziehern: Dienstende). */
  anmelden(id, abholzeit) {
    return this.#setze(id, { status: "da", gekommenUm: this.uhrzeit, abholzeit, gegangenUm: null, meldungBis: null });
  }
  zeitAendern(id, abholzeit) {
    if (this.status(id) !== "da") return;
    return this.#setze(id, { abholzeit });
  }
  /** Abholen: auschecken. */
  abholen(id) {
    if (this.status(id) !== "da") return;
    return this.#setze(id, { status: "abgeholt", gegangenUm: this.uhrzeit });
  }
  /** Versehentlich abgeholt: wieder anmelden, Abholzeit bleibt. */
  wiederDa(id) {
    if (this.status(id) !== "abgeholt") return;
    return this.#setze(id, { status: "da", gegangenUm: null });
  }

  /** Krank oder abwesend melden, heute oder bis einschließlich "bis". */
  async melden(id, status, bis = this.datum) {
    if (status !== "krank" && status !== "abwesend") throw new Error("unbekannte Meldung");
    const tage = tageVonBis(this.datum, bis < this.datum ? this.datum : bis);
    const letzter = tage.at(-1);
    const eintraege = tage.map((datum) => ({ profilId: id, datum, status, gekommenUm: null, abholzeit: null, gegangenUm: null, meldungBis: letzter }));
    await db.tage.bulkPut(eintraege);
    this.heute = { ...this.heute, [id]: eintraege[0] };
  }

  /** Meldung oder Anmeldung zurücknehmen: zurück auf „noch nicht da“. Mehrtägige Meldungen enden ganz. */
  async zuruecknehmen(id) {
    const alt = this.heute[id];
    if (!alt) return;
    if (alt.status === "krank" || alt.status === "abwesend") {
      await db.tage.where("profilId").equals(id).and((e) => e.datum >= this.datum && e.status === alt.status).delete();
    } else {
      await db.tage.delete([id, this.datum]);
    }
    const { [id]: _, ...rest } = this.heute;
    this.heute = rest;
  }

  async profilSpeichern(roh) {
    const profil = { ...normalisiereProfil(roh), geaendertAm: this.jetzt.toISOString() };
    await db.profile.put(profil);
    this.profile = sortiereProfile([...this.profile.filter((p) => p.id !== profil.id), profil]);
    return profil;
  }

  async profilLoeschen(id) {
    await db.transaction("rw", db.profile, db.tage, async () => {
      await db.profile.delete(id);
      await db.tage.where("profilId").equals(id).delete();
    });
    this.profile = this.profile.filter((p) => p.id !== id);
    const { [id]: _, ...rest } = this.heute;
    this.heute = rest;
  }

  /** Geprüfte Profile (aus pruefeImport) übernehmen. modus: "zusammenfuehren" | "ersetzen" */
  async importieren(profile, modus = "zusammenfuehren", tage = []) {
    const liste = zusammenfuehren($state.snapshot(this.profile), $state.snapshot(profile), modus);
    const ids = new Set(liste.map((p) => p.id));
    await db.transaction("rw", db.profile, db.tage, async () => {
      await db.profile.clear();
      await db.profile.bulkPut(liste);
      await db.tage.filter((e) => !ids.has(e.profilId)).delete();
      if (tage.length) await db.tage.bulkPut($state.snapshot(tage));
    });
    this.profile = sortiereProfile(liste);
    await this.#tagLaden();
  }

  protokoll(datum) {
    return db.tage.where("datum").equals(datum).toArray();
  }
  alleTage() {
    return db.tage.toArray();
  }
}

export const kita = new Kita();
