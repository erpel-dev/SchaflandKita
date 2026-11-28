import { db, kvGet } from "./db.js";
import { STANDARD_PLAN } from "./tagesplan.js";
import { STANDARD_ABHOLER } from "./tagebuch.js";

export const STANDARD_ZEITEN = [
  { zeit: "12:00", bild: "🍽️", text: "vor dem Essen" },
  { zeit: "12:30", bild: "😋", text: "nach dem Essen" },
  { zeit: "13:00", bild: "😴", text: "zur Ruhezeit" },
  { zeit: "14:00", bild: "🛏️", text: "nach dem Schlafen" },
  { zeit: "15:00", bild: "🍎", text: "nach dem Snack" },
  { zeit: "16:00", bild: "👋", text: "zum Schluss" },
];

const DEFAULTS = {
  toene: true, // Geräusche beim Antippen, Anmelden, Abholen
  ansage: true, // das Schaf sagt den Namen an („Hallo Wolli!“)
  nfc: true, // NFC-Anhänger lesen, wo das Gerät es kann
  schritt: 15, // Plus und Minus verstellen die Abholzeit um so viele Minuten
  zeiten: STANDARD_ZEITEN, // die sechs großen Zeitknöpfe
  tagesplan: STANDARD_PLAN, // Bilderleiste auf der Startseite; leer = keine Leiste
  planAnsage: true, // das Schaf sagt an, wenn ein neuer Punkt des Tagesplans beginnt
  abholerFragen: true, // beim Abholen eines Tiers fragen, wer abholt
  abholer: STANDARD_ABHOLER, // Auswahl für „Wer holt ab?“
  aktion: null, // id der aktiven Aktion (src/lib/aktionen.js) oder null
};

class Settings {
  value = $state(structuredClone(DEFAULTS));

  async load() {
    this.value = { ...structuredClone(DEFAULTS), ...(await kvGet("settings", {})) };
  }

  /** Nur die geänderten Felder speichern: Sie werden in derselben Transaktion mit dem gespeicherten Stand
   *  zusammengeführt, damit ein zweiter Tab mit älterem Stand keine anderen Einstellungen zurücksetzt. */
  set(patch) {
    Object.assign(this.value, patch);
    const neu = $state.snapshot(patch);
    return db.transaction("rw", db.kv, async () => {
      const alt = (await db.kv.get("settings"))?.value ?? {};
      await db.kv.put({ key: "settings", value: { ...alt, ...neu } });
    });
  }
}

export const settings = new Settings();
