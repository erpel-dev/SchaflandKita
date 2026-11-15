import { kvGet, kvSet } from "./db.js";

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
};

class Settings {
  value = $state(structuredClone(DEFAULTS));

  async load() {
    this.value = { ...structuredClone(DEFAULTS), ...(await kvGet("settings", {})) };
  }

  set(patch) {
    Object.assign(this.value, patch);
    return kvSet("settings", $state.snapshot(this.value));
  }
}

export const settings = new Settings();
