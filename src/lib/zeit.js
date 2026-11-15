// Rechnen mit Uhrzeiten ("HH:MM") und Tagen ("JJJJ-MM-TT"), immer in Ortszeit des Geräts.
const p2 = (n) => String(n).padStart(2, "0");

export const datumStr = (d = new Date()) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const zeitStr = (d = new Date()) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
export const istZeit = (s) => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export const istDatum = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && datumStr(alsDatum(s)) === s;

export function minuten(zeit) {
  const [h, m] = zeit.split(":").map(Number);
  return h * 60 + m;
}
export const ausMinuten = (n) => `${p2(Math.floor(n / 60))}:${p2(n % 60)}`;

/** Uhrzeit um delta Minuten verschieben, begrenzt auf den Kita-Tag. */
export function verschieben(zeit, delta, { von = "06:00", bis = "20:00" } = {}) {
  return ausMinuten(Math.min(minuten(bis), Math.max(minuten(von), minuten(zeit) + delta)));
}

function alsDatum(datum) {
  const [y, m, d] = datum.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function datumPlus(datum, tage) {
  const d = alsDatum(datum);
  d.setDate(d.getDate() + tage);
  return datumStr(d);
}

/** Alle Tage von … bis einschließlich …, höchstens max (Schutz vor Tippfehlern). */
export function tageVonBis(von, bis, max = 31) {
  const liste = [];
  for (let d = von; d <= bis && liste.length < max; d = datumPlus(d, 1)) liste.push(d);
  return liste;
}

export const wochentag = (datum) => alsDatum(datum).toLocaleDateString("de-DE", { weekday: "long" });
export const datumLang = (datum) => alsDatum(datum).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" });

export function dauerText(min) {
  const h = Math.floor(min / 60), m = min % 60;
  const teile = [];
  if (h) teile.push(h === 1 ? "1 Stunde" : `${h} Stunden`);
  if (m || !h) teile.push(m === 1 ? "1 Minute" : `${m} Minuten`);
  return teile.join(" ");
}

/** Wie lange noch bis zur Abholzeit, oder wie lange sie schon vorbei ist. */
export function warteInfo(abholzeit, jetztZeit) {
  const diff = minuten(abholzeit) - minuten(jetztZeit);
  if (diff > 0) return { ueberfaellig: false, minuten: diff, text: `in ${dauerText(diff)}` };
  if (diff === 0) return { ueberfaellig: false, minuten: 0, text: "jetzt" };
  return { ueberfaellig: true, minuten: -diff, text: `wartet seit ${dauerText(-diff)}` };
}
