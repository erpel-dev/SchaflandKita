// Tagebuch eines Tiers: gegessen, geschlafen, wer hat abgeholt. Beim Abholen als kleiner Bericht.
export const ESSEN = [
  { id: "alles", bild: "😋", text: "alles gegessen" },
  { id: "etwas", bild: "🙂", text: "ein bisschen gegessen" },
  { id: "nichts", bild: "🙅", text: "nichts gegessen" },
];
export const SCHLAF = [
  { id: "ja", bild: "😴", text: "geschlafen" },
  { id: "kurz", bild: "🥱", text: "kurz geschlafen" },
  { id: "nein", bild: "👀", text: "nicht geschlafen" },
];
export const STANDARD_ABHOLER = [
  { bild: "👩", text: "Mama" },
  { bild: "👨", text: "Papa" },
  { bild: "👵", text: "Oma" },
  { bild: "👴", text: "Opa" },
  { bild: "🧒", text: "Geschwister" },
  { bild: "🧑", text: "Jemand anderes" },
];

export const essenInfo = (id) => ESSEN.find((e) => e.id === id) ?? null;
export const schlafInfo = (id) => SCHLAF.find((s) => s.id === id) ?? null;

/** Wer abholt, gesäubert: { text, bild } oder null. */
export function abholerSauber(von) {
  const text = typeof von?.text === "string" ? von.text.trim().slice(0, 24) : "";
  return text ? { text, bild: String(von.bild ?? "").slice(0, 8) } : null;
}

/** Bericht für den Tag eines Tiers: Liste aus { bild, text }. */
export function tagesbericht(eintrag) {
  if (!eintrag) return [];
  const zeilen = [];
  if (eintrag.gekommenUm) zeilen.push({ bild: "🏫", text: `da seit ${eintrag.gekommenUm}` });
  const e = essenInfo(eintrag.gegessen), s = schlafInfo(eintrag.geschlafen);
  if (e) zeilen.push({ bild: e.bild, text: e.text });
  if (s) zeilen.push({ bild: s.bild, text: s.text });
  return zeilen;
}
