// Profile prüfen, exportieren und importieren. Reine Funktionen ohne Datenbank, damit sie
// sich leicht testen lassen; gespeichert wird in kita.svelte.js.
import { istZeit, istDatum } from "./zeit.js";
import { ESSEN, SCHLAF, abholerSauber } from "./tagebuch.js";

export const FORMAT = "schafland-kita";
export const VERSION = 1;
export const ROLLEN = ["kind", "erzieher"];
export const BILD_ARTEN = ["emoji", "schaf", "foto"];
export const WOLLE = ["weiss", "braun", "schwarz", "grau", "rosa"];
export const FARBEN = ["#cfe8f7", "#d8efc9", "#ffe9a8", "#fbd0d8", "#e3d6f5", "#ffd9b8", "#f3efe4"];
export const STATUS = ["offen", "da", "abgeholt", "krank", "abwesend", "laeuse"];
const MAX_NAME = 30;
const MAX_NOTIZ = 200;
const MAX_FOTO = 400_000; // Zeichen einer data:-URL; ein 512-px-JPEG liegt weit darunter

export function neueId() {
  return globalThis.crypto?.randomUUID?.() ?? `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function pruefeBild(bild) {
  if (!bild || typeof bild !== "object" || !BILD_ARTEN.includes(bild.art) || typeof bild.wert !== "string") return null;
  if (bild.art === "schaf") return WOLLE.includes(bild.wert) ? { art: "schaf", wert: bild.wert } : null;
  if (bild.art === "emoji") return bild.wert.trim() && bild.wert.length <= 16 ? { art: "emoji", wert: bild.wert.trim() } : null;
  return /^data:image\/(jpeg|png|webp);base64,/.test(bild.wert) && bild.wert.length <= MAX_FOTO ? { art: "foto", wert: bild.wert } : null;
}

/** Macht aus beliebigen Eingaben ein sauberes Profil oder wirft einen Fehler mit deutschem Text. */
export function normalisiereProfil(roh) {
  if (!roh || typeof roh !== "object") throw new Error("Profil ist kein Objekt");
  const name = typeof roh.name === "string" ? roh.name.trim() : "";
  if (!name) throw new Error("Profil ohne Namen");
  if (name.length > MAX_NAME) throw new Error(`Name „${name.slice(0, 20)}…“ ist zu lang`);
  if (!ROLLEN.includes(roh.rolle)) throw new Error(`„${name}“: unbekannte Rolle`);
  if (roh.id != null && (typeof roh.id !== "string" || !roh.id || roh.id.length > 64)) throw new Error(`„${name}“: ungültige id`);
  const bild = pruefeBild(roh.bild);
  if (!bild) throw new Error(`„${name}“: ungültiges Bild`);
  if (roh.ueblicheZeit != null && roh.ueblicheZeit !== "" && !istZeit(roh.ueblicheZeit)) throw new Error(`„${name}“: ungültige Uhrzeit`);
  return {
    id: roh.id ?? neueId(),
    rolle: roh.rolle,
    name,
    bild,
    farbe: typeof roh.farbe === "string" && /^#[0-9a-f]{6}$/i.test(roh.farbe) ? roh.farbe.toLowerCase() : FARBEN[0],
    ueblicheZeit: roh.ueblicheZeit || null,
    notiz: typeof roh.notiz === "string" ? roh.notiz.slice(0, MAX_NOTIZ) : "",
    geaendertAm: typeof roh.geaendertAm === "string" ? roh.geaendertAm : null,
  };
}

function normalisiereTag(roh, ids) {
  if (!roh || typeof roh !== "object" || !ids.has(roh.profilId) || !istDatum(roh.datum) || !STATUS.includes(roh.status)) return null;
  const zeit = (z) => (istZeit(z) ? z : null);
  const wer = abholerSauber({ text: roh.abgeholtVon, bild: roh.abgeholtVonBild });
  const extra = {};
  if (wer) Object.assign(extra, { abgeholtVon: wer.text, abgeholtVonBild: wer.bild });
  if (ESSEN.some((e) => e.id === roh.gegessen)) extra.gegessen = roh.gegessen;
  if (SCHLAF.some((x) => x.id === roh.geschlafen)) extra.geschlafen = roh.geschlafen;
  return {
    profilId: roh.profilId, datum: roh.datum, status: roh.status,
    gekommenUm: zeit(roh.gekommenUm), abholzeit: zeit(roh.abholzeit), gegangenUm: zeit(roh.gegangenUm),
    meldungBis: istDatum(roh.meldungBis) ? roh.meldungBis : null,
    nichtAbgeholt: roh.nichtAbgeholt === true,
    ...extra,
  };
}

/** Inhalt der Export-Datei. tage (das Protokoll) ist optional; tags sind die NFC-Anhänger. */
export function exportDaten(profile, { tage = null, tags = [], jetzt = new Date() } = {}) {
  const daten = { format: FORMAT, version: VERSION, exportiertAm: jetzt.toISOString(), profile: profile.map((p) => ({ ...p })) };
  if (tags.length) daten.tags = tags.map((t) => ({ id: t.id, profilId: t.profilId }));
  if (tage) daten.tage = tage.map((t) => ({ ...t }));
  return daten;
}

/** Prüft eine eingelesene Datei. Bei einem Fehler wird nichts übernommen. */
export function pruefeImport(daten) {
  try {
    if (!daten || typeof daten !== "object" || daten.format !== FORMAT) throw new Error("Das ist keine Schafland-Kita-Datei");
    if (daten.version !== VERSION) throw new Error(`Unbekannte Version ${daten.version}`);
    if (!Array.isArray(daten.profile)) throw new Error("Die Datei enthält keine Profile");
    const profile = daten.profile.map(normalisiereProfil);
    const ids = new Set(profile.map((p) => p.id));
    if (ids.size !== profile.length) throw new Error("Zwei Profile haben dieselbe id");
    const tage = Array.isArray(daten.tage) ? daten.tage.map((t) => normalisiereTag(t, ids)).filter(Boolean) : [];
    // NFC-Anhänger: nur solche, deren Profil in der Datei steht; jede Kennung einmal
    const tags = new Map();
    for (const t of Array.isArray(daten.tags) ? daten.tags : []) {
      const id = typeof t?.id === "string" ? t.id.trim().toLowerCase() : "";
      if (id && id.length <= 64 && ids.has(t.profilId)) tags.set(id, { id, profilId: t.profilId });
    }
    return { ok: true, profile, tage, tags: [...tags.values()] };
  } catch (err) {
    return { ok: false, fehler: err.message };
  }
}

const FELDER = ["rolle", "name", "farbe", "ueblicheZeit", "notiz"];
export function gleich(a, b) {
  return FELDER.every((f) => (a[f] ?? "") === (b[f] ?? "")) && a.bild.art === b.bild.art && a.bild.wert === b.bild.wert;
}

/** Was würde der Import ändern? */
export function vorschau(vorhandene, importierte) {
  const alt = new Map(vorhandene.map((p) => [p.id, p]));
  const neu = [], geaendert = [], unveraendert = [];
  for (const p of importierte) {
    const a = alt.get(p.id);
    (!a ? neu : gleich(a, p) ? unveraendert : geaendert).push(p);
  }
  const ids = new Set(importierte.map((p) => p.id));
  return { neu, geaendert, gleich: unveraendert, fehlen: vorhandene.filter((p) => !ids.has(p.id)) };
}

/** Ergebnisliste: "zusammenfuehren" behält alles Vorhandene, "ersetzen" nimmt nur die Datei. */
export function zusammenfuehren(vorhandene, importierte, modus = "zusammenfuehren") {
  if (modus === "ersetzen") return importierte;
  const map = new Map(vorhandene.map((p) => [p.id, p]));
  for (const p of importierte) map.set(p.id, p);
  return [...map.values()];
}

export const sortiereProfile = (liste) =>
  [...liste].sort((a, b) => (a.rolle === b.rolle ? a.name.localeCompare(b.name, "de") : a.rolle === "kind" ? -1 : 1));
