// Der Zustand der Kita: alle Profile und wer heute da, abgeholt, krank oder abwesend ist.
import { db, kvGet, kvSet } from "./db.js";
import { datumStr, zeitStr, tageVonBis } from "./zeit.js";
import { normalisiereProfil, sortiereProfile, zusammenfuehren, neueId } from "./profile-io.js";
import { REAKTIONEN, BILDER, MAX_TEXT } from "./nachrichten.js";
import { tagId } from "./nfc.svelte.js";
import { ESSEN, SCHLAF, abholerSauber } from "./tagebuch.js";
import { BEISPIELE } from "./beispiele.js";

class Kita {
  profile = $state([]);
  /** Einträge von heute: profilId → { status, gekommenUm, abholzeit, gegangenUm, meldungBis } */
  heute = $state({});
  /** NFC-Anhänger: [{ id, profilId, zugeordnetAm }] */
  tags = $state([]);
  /** Pinnwand, neueste zuerst */
  nachrichten = $state([]);
  /** Bis hierhin wurde die Pinnwand schon angesehen (für den Zähler neuer Nachrichten) */
  gesehenBis = $state("");
  ungelesen = $derived(this.nachrichten.filter((n) => n.erstelltAm > this.gesehenBis).length);
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
    this.nachrichten = (await db.nachrichten.toArray()).sort((a, b) => b.erstelltAm.localeCompare(a.erstelltAm));
    this.gesehenBis = await kvGet("pinnwandGesehen", "");
    this.tags = await db.tags.toArray();
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
  /** Abholen: auschecken. von = { text, bild }: wer abholt (freiwillig). */
  abholen(id, von = null) {
    if (this.status(id) !== "da") return;
    const wer = abholerSauber(von);
    return this.#setze(id, { status: "abgeholt", gegangenUm: this.uhrzeit, abgeholtVon: wer?.text ?? null, abgeholtVonBild: wer?.bild ?? null });
  }
  /** Tagebuch: gegessen ("alles" | "etwas" | "nichts" | null) und geschlafen ("ja" | "kurz" | "nein" | null). */
  tagebuch(id, { gegessen, geschlafen } = {}) {
    const st = this.status(id);
    if (st !== "da" && st !== "abgeholt") return;
    const patch = {};
    if (gegessen !== undefined) {
      if (gegessen !== null && !ESSEN.some((e) => e.id === gegessen)) throw new Error("Unbekannte Angabe zum Essen");
      patch.gegessen = gegessen;
    }
    if (geschlafen !== undefined) {
      if (geschlafen !== null && !SCHLAF.some((x) => x.id === geschlafen)) throw new Error("Unbekannte Angabe zum Schlafen");
      patch.geschlafen = geschlafen;
    }
    return this.#setze(id, patch);
  }
  /** Versehentlich abgeholt: wieder anmelden, Abholzeit bleibt. */
  wiederDa(id) {
    if (this.status(id) !== "abgeholt") return;
    return this.#setze(id, { status: "da", gegangenUm: null, abgeholtVon: null, abgeholtVonBild: null });
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
    await db.transaction("rw", db.profile, db.tage, db.tags, async () => {
      await db.profile.delete(id);
      await db.tage.where("profilId").equals(id).delete();
      await db.tags.where("profilId").equals(id).delete();
    });
    this.profile = this.profile.filter((p) => p.id !== id);
    this.tags = this.tags.filter((t) => t.profilId !== id);
    const { [id]: _, ...rest } = this.heute;
    this.heute = rest;
    // Seine Reaktionen verschwinden; seine Nachrichten bleiben mit dem Namen stehen
    for (const n of this.nachrichten.filter((n) => id in n.reaktionen)) {
      const { [id]: weg, ...reaktionen } = $state.snapshot(n.reaktionen);
      await this.#nachrichtErsetzen({ ...$state.snapshot(n), reaktionen });
    }
  }

  // ---------- NFC-Anhänger ----------

  /** Wem gehört dieser Anhänger? id des Profils oder null. */
  tagProfil(id) {
    const kennung = tagId(id);
    return this.tags.find((t) => t.id === kennung)?.profilId ?? null;
  }

  /** Anhänger einem Profil zuordnen; eine frühere Zuordnung desselben Anhängers wird ersetzt. */
  async tagZuordnen(id, profilId) {
    const kennung = tagId(id);
    if (!kennung) throw new Error("Dieser Anhänger hat keine lesbare Kennung");
    if (!this.profil(profilId)) throw new Error("Unbekanntes Profil");
    const tag = { id: kennung, profilId, zugeordnetAm: this.jetzt.toISOString() };
    await db.tags.put(tag);
    this.tags = [...this.tags.filter((t) => t.id !== kennung), tag];
    return tag;
  }

  async tagAufheben(id) {
    const kennung = tagId(id);
    await db.tags.delete(kennung);
    this.tags = this.tags.filter((t) => t.id !== kennung);
  }

  // ---------- Pinnwand ----------

  async #nachrichtErsetzen(n) {
    await db.nachrichten.put(n);
    this.nachrichten = this.nachrichten.map((alt) => (alt.id === n.id ? n : alt));
  }

  /** Nur Erzieher schreiben Nachrichten. bild ist ein optionales großes Bildchen. */
  async nachrichtSchreiben(autorId, text, bild = "") {
    const autor = this.profil(autorId);
    if (autor?.rolle !== "erzieher") throw new Error("Nur Erzieher können Nachrichten schreiben");
    const inhalt = String(text ?? "").trim();
    if (!inhalt) throw new Error("Die Nachricht ist leer");
    if (inhalt.length > MAX_TEXT) throw new Error(`Die Nachricht ist zu lang (höchstens ${MAX_TEXT} Zeichen)`);
    const n = { id: neueId(), autorId, autorName: autor.name, text: inhalt, bild: BILDER.includes(bild) ? bild : "", erstelltAm: this.jetzt.toISOString(), reaktionen: {} };
    await db.nachrichten.put(n);
    this.nachrichten = [n, ...this.nachrichten];
    return n;
  }

  /** Jedes Profil hat je Nachricht höchstens eine Reaktion; dieselbe noch einmal nimmt sie zurück. */
  async reagieren(nachrichtId, profilId, emoji) {
    const n = this.nachrichten.find((x) => x.id === nachrichtId);
    if (!n) return;
    if (!this.profil(profilId)) throw new Error("Unbekanntes Profil");
    if (!REAKTIONEN.includes(emoji)) throw new Error("Unbekannte Reaktion");
    const reaktionen = { ...$state.snapshot(n.reaktionen) };
    if (reaktionen[profilId] === emoji) delete reaktionen[profilId];
    else reaktionen[profilId] = emoji;
    await this.#nachrichtErsetzen({ ...$state.snapshot(n), reaktionen });
  }

  async nachrichtLoeschen(id) {
    await db.nachrichten.delete(id);
    this.nachrichten = this.nachrichten.filter((n) => n.id !== id);
  }

  /** Die Pinnwand wurde geöffnet: der Zähler neuer Nachrichten beginnt von vorn. */
  async pinnwandGesehen() {
    this.gesehenBis = this.jetzt.toISOString();
    await kvSet("pinnwandGesehen", this.gesehenBis);
  }

  /** Geprüfte Profile (aus pruefeImport) übernehmen. modus: "zusammenfuehren" | "ersetzen" */
  async importieren(profile, modus = "zusammenfuehren", tage = [], tags = []) {
    const liste = zusammenfuehren($state.snapshot(this.profile), $state.snapshot(profile), modus);
    const ids = new Set(liste.map((p) => p.id));
    const zeit = this.jetzt.toISOString();
    await db.transaction("rw", db.profile, db.tage, db.tags, async () => {
      await db.profile.clear();
      await db.profile.bulkPut(liste);
      await db.tage.filter((e) => !ids.has(e.profilId)).delete();
      await db.tags.filter((t) => !ids.has(t.profilId)).delete();
      if (tage.length) await db.tage.bulkPut($state.snapshot(tage));
      if (tags.length) await db.tags.bulkPut($state.snapshot(tags).map((t) => ({ id: t.id, profilId: t.profilId, zugeordnetAm: zeit })));
    });
    this.profile = sortiereProfile(liste);
    this.tags = await db.tags.toArray();
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
