// Tagesplan: was passiert wann in der Kita. Wird auf der Startseite als Bilderleiste gezeigt.
import { istZeit } from "./zeit.js";

export const STANDARD_PLAN = [
  { zeit: "08:00", bild: "🚪", text: "Ankommen" },
  { zeit: "09:00", bild: "⭕", text: "Morgenkreis" },
  { zeit: "09:30", bild: "🥨", text: "Frühstück" },
  { zeit: "10:00", bild: "🌳", text: "Garten" },
  { zeit: "12:00", bild: "🍽️", text: "Mittagessen" },
  { zeit: "13:00", bild: "😴", text: "Schlafen" },
  { zeit: "14:30", bild: "🍎", text: "Snack" },
  { zeit: "15:00", bild: "🎨", text: "Spielen" },
  { zeit: "16:30", bild: "👋", text: "Tschüss" },
];
export const MAX_PUNKTE = 12;

/** Nur gültige Punkte, nach Uhrzeit sortiert. */
export function sortierePlan(plan) {
  return (Array.isArray(plan) ? plan : [])
    .filter((p) => p && istZeit(p.zeit) && typeof p.text === "string" && p.text.trim())
    .map((p) => ({ zeit: p.zeit, bild: String(p.bild ?? "").slice(0, 8), text: p.text.trim().slice(0, 24) }))
    .sort((a, b) => a.zeit.localeCompare(b.zeit))
    .slice(0, MAX_PUNKTE);
}

/** Welcher Punkt des sortierten Plans läuft gerade? -1 vor dem ersten. */
export function planStand(sortiert, uhrzeit) {
  let i = -1;
  while (i + 1 < sortiert.length && sortiert[i + 1].zeit <= uhrzeit) i++;
  return i;
}

/** Satz zum Vorlesen, wenn man einen Punkt antippt. */
export function planSatz(sortiert, i, uhrzeit) {
  const p = sortiert[i];
  if (!p) return "";
  const stand = planStand(sortiert, uhrzeit);
  if (i === stand) return `Jetzt ist ${p.text}.`;
  const [h, m] = p.zeit.split(":").map(Number);
  const wann = m ? `${h} Uhr ${m}` : `${h} Uhr`;
  return i < stand ? `${p.text} war um ${wann}.` : `${p.text} ist um ${wann}.`;
}
