// Der Zustand der Kita: alle Profile und wer heute da, abgeholt, krank oder abwesend ist.
import { liveQuery } from "dexie";
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

  beobachteTag(datum) {
    const abo = liveQuery(() => db.tage.where("datum").equals(datum).toArray()).subscribe((rows) => {
      if (this.datum === datum) this.heute = Object.fromEntries(rows.map((r) => [r.profilId, r]));
    });
    return () => abo.unsubscribe();
  }

  beobachteNachrichten() {
    const abo = liveQuery(() => db.nachrichten.orderBy("erstelltAm").reverse().toArray()).subscribe((rows) => {
      // Bei gleicher Zeit bleibt die bisherige Reihenfolge erhalten.
      const reihenfolge = new Map(this.nachrichten.map((n, i) => [n.id, i]));
      this.nachrichten = rows.sort((a, b) => b.erstelltAm.localeCompare(a.erstelltAm) ||
        (reihenfolge.get(a.id) ?? -1) - (reihenfolge.get(b.id) ?? -1));
    });
    return () => abo.unsubscribe();
  }

  async #tagLaden() {
    const datum = this.datum;
    const rows = await db.transaction("rw", db.tage, async () => {
      // Wer an einem früheren Tag noch angemeldet war, wurde nicht abgeholt.
      await db.tage.where("datum").below(datum).and((e) => e.status === "da").modify({ status: "abgeholt", nichtAbgeholt: true });
      return db.tage.where("datum").equals(datum).toArray();
    });
    if (this.datum !== datum) return;
    this.heute = Object.fromEntries(rows.map((r) => [r.profilId, r]));
    this.#geladen = datum;
  }

  /** Uhr weiterstellen (läuft alle paar Sekunden); um Mitternacht beginnt ein neuer Tag. */
  async tick(jetzt = new Date()) {
    this.jetzt = jetzt;
    if (datumStr(jetzt) !== this.#geladen) await this.#tagLaden();
  }

  status(id) {
    return this.eintrag(id)?.status ?? "offen";
  }
  eintrag(id) {
    const eintrag = this.heute[id];
    return eintrag?.datum === this.datum ? eintrag : null;
  }
  profil(id) {
    return this.profile.find((p) => p.id === id) ?? null;
  }

  async #setze(id, status, patch) {
    const datum = this.datum;
    const eintrag = await db.transaction("rw", db.tage, db.profile, async () => {
      if (!(await db.profile.get(id))) return null;
      const alt = await db.tage.get([id, datum]);
      if (!status.includes(alt?.status ?? "offen")) return null;
      const neu = {
        profilId: id, datum, status: "offen", gekommenUm: null, abholzeit: null, gegangenUm: null, meldungBis: null,
        ...alt, ...(typeof patch === "function" ? patch(alt) : patch),
      };
      await db.tage.put(neu);
      return neu;
    });
    if (eintrag && this.datum === datum) this.heute = { ...this.heute, [id]: eintrag };
    return !!eintrag;
  }

  /** Bringen: anmelden mit Abholzeit (bei Erziehern: Dienstende). */
  anmelden(id, abholzeit) {
    return this.#setze(id, ["offen"], { status: "da", gekommenUm: this.uhrzeit, abholzeit, gegangenUm: null, meldungBis: null });
  }
  zeitAendern(id, abholzeit) {
    return this.#setze(id, ["da"], { abholzeit });
  }
  /** Abholen: auschecken. von = { text, bild }: wer abholt (freiwillig). */
  abholen(id, von = null) {
    const wer = abholerSauber(von);
    return this.#setze(id, ["da"], { status: "abgeholt", gegangenUm: this.uhrzeit, abgeholtVon: wer?.text ?? null, abgeholtVonBild: wer?.bild ?? null });
  }
  /** Tagebuchangaben setzen oder beim erneuten Antippen derselben Angabe zurücknehmen. */
  tagebuch(id, { gegessen, geschlafen } = {}, umschalten = false) {
    const patch = {};
    if (gegessen !== undefined) {
      if (gegessen !== null && !ESSEN.some((e) => e.id === gegessen)) throw new Error("Unbekannte Angabe zum Essen");
      patch.gegessen = gegessen;
    }
    if (geschlafen !== undefined) {
      if (geschlafen !== null && !SCHLAF.some((x) => x.id === geschlafen)) throw new Error("Unbekannte Angabe zum Schlafen");
      patch.geschlafen = geschlafen;
    }
    return this.#setze(id, ["da", "abgeholt"], (alt) => Object.fromEntries(
      Object.entries(patch).map(([feld, wert]) => [feld, umschalten && alt[feld] === wert ? null : wert]),
    ));
  }
  /** Versehentlich abgeholt: wieder anmelden, Abholzeit bleibt. */
  wiederDa(id) {
    return this.#setze(id, ["abgeholt"], { status: "da", gegangenUm: null, abgeholtVon: null, abgeholtVonBild: null, nichtAbgeholt: false });
  }

  /** Krank oder abwesend melden, heute oder bis einschließlich "bis". */
  async melden(id, status, bis = this.datum) {
    if (status !== "krank" && status !== "abwesend") throw new Error("unbekannte Meldung");
    const heute = this.datum;
    const tage = tageVonBis(heute, bis < heute ? heute : bis);
    const letzter = tage.at(-1);
    const eintraege = tage.map((datum) => ({ profilId: id, datum, status, gekommenUm: null, abholzeit: null, gegangenUm: null, meldungBis: letzter }));
    const gespeichert = await db.transaction("rw", db.tage, db.profile, async () => {
      if (!(await db.profile.get(id))) return false;
      const alt = await db.tage.get([id, heute]);
      if (alt && alt.status !== "offen") return false;
      await db.tage.bulkPut(eintraege);
      return true;
    });
    if (gespeichert && this.datum === heute) this.heute = { ...this.heute, [id]: eintraege[0] };
    return gespeichert;
  }

  /** Meldung oder Anmeldung zurücknehmen: zurück auf „noch nicht da“. Mehrtägige Meldungen enden ganz. */
  async zuruecknehmen(id) {
    const datum = this.datum;
    const erwartet = this.status(id);
    const geloescht = await db.transaction("rw", db.tage, async () => {
      const alt = await db.tage.get([id, datum]);
      if (!alt || alt.status !== erwartet) return false;
      if (alt.status === "krank" || alt.status === "abwesend") {
        await db.tage.where("profilId").equals(id)
          .and((e) => e.datum >= datum && e.datum <= (alt.meldungBis ?? datum) && e.status === alt.status)
          .delete();
      } else {
        await db.tage.delete([id, datum]);
      }
      return true;
    });
    if (geloescht && this.datum === datum) {
      const { [id]: _, ...rest } = this.heute;
      this.heute = rest;
    }
    return geloescht;
  }

  async profilSpeichern(roh) {
    const profil = { ...normalisiereProfil(roh), geaendertAm: this.jetzt.toISOString() };
    await db.profile.put(profil);
    this.profile = sortiereProfile([...this.profile.filter((p) => p.id !== profil.id), profil]);
    return profil;
  }

  async profilLoeschen(id) {
    await db.transaction("rw", db.profile, db.tage, db.tags, db.nachrichten, async () => {
      await db.profile.delete(id);
      await db.tage.where("profilId").equals(id).delete();
      await db.tags.where("profilId").equals(id).delete();
      // Nachrichten bleiben mit dem Autorennamen stehen.
      await db.nachrichten.filter((n) => Object.hasOwn(n.reaktionen, id))
        .modify((n) => { delete n.reaktionen[id]; });
    });
    this.profile = this.profile.filter((p) => p.id !== id);
    this.tags = this.tags.filter((t) => t.profilId !== id);
    const { [id]: _, ...rest } = this.heute;
    this.heute = rest;
    this.nachrichten = await db.nachrichten.orderBy("erstelltAm").reverse().toArray();
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

  /** Nur Erzieher schreiben Nachrichten. bild ist ein optionales großes Bildchen. */
  async nachrichtSchreiben(autorId, text, bild = "") {
    const autor = this.profil(autorId);
    if (autor?.rolle !== "erzieher") throw new Error("Nur Erzieher können Nachrichten schreiben");
    const inhalt = String(text ?? "").trim();
    if (!inhalt) throw new Error("Die Nachricht ist leer");
    if (inhalt.length > MAX_TEXT) throw new Error(`Die Nachricht ist zu lang (höchstens ${MAX_TEXT} Zeichen)`);
    const n = { id: neueId(), autorId, autorName: autor.name, text: inhalt, bild: BILDER.includes(bild) ? bild : "", erstelltAm: this.jetzt.toISOString(), reaktionen: {} };
    await db.nachrichten.put(n);
    this.nachrichten = [n, ...this.nachrichten.filter((alt) => alt.id !== n.id)];
    return n;
  }

  /** Jedes Profil hat je Nachricht höchstens eine Reaktion; dieselbe noch einmal nimmt sie zurück. */
  async reagieren(nachrichtId, profilId, emoji) {
    const n = await db.transaction("rw", db.nachrichten, db.profile, async () => {
      const aktuell = await db.nachrichten.get(nachrichtId);
      if (!aktuell) return null;
      if (!(await db.profile.get(profilId))) throw new Error("Unbekanntes Profil");
      if (!REAKTIONEN.includes(emoji)) throw new Error("Unbekannte Reaktion");
      if (aktuell.reaktionen[profilId] === emoji) delete aktuell.reaktionen[profilId];
      else aktuell.reaktionen[profilId] = emoji;
      await db.nachrichten.put(aktuell);
      return aktuell;
    });
    this.nachrichten = n
      ? this.nachrichten.map((alt) => alt.id === n.id ? n : alt)
      : this.nachrichten.filter((alt) => alt.id !== nachrichtId);
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
    const neueProfile = $state.snapshot(profile);
    const neueTage = $state.snapshot(tage);
    const neueTags = $state.snapshot(tags);
    const zeit = this.jetzt.toISOString();
    const liste = await db.transaction("rw", db.profile, db.tage, db.tags, async () => {
      const liste = zusammenfuehren(await db.profile.toArray(), neueProfile, modus);
      const ids = new Set(liste.map((p) => p.id));
      if (modus === "ersetzen") {
        await db.profile.clear();
        await db.tage.filter((e) => !ids.has(e.profilId)).delete();
        await db.tags.filter((t) => !ids.has(t.profilId)).delete();
      }
      await db.profile.bulkPut(neueProfile);
      if (neueTage.length) {
        const belegt = modus === "ersetzen" ? [] : await db.tage.bulkGet(neueTage.map((e) => [e.profilId, e.datum]));
        await db.tage.bulkPut(neueTage.filter((_, i) => !belegt[i]));
      }
      if (neueTags.length) await db.tags.bulkPut(neueTags.map((t) => ({ id: t.id, profilId: t.profilId, zugeordnetAm: zeit })));
      return liste;
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
