// Pinnwand: Erzieher schreiben Nachrichten, alle Profile können mit einem Bildchen reagieren.
export const REAKTIONEN = ["👍", "❤️", "😂", "😮", "😢", "🎉"];
/** Großes Bild zur Nachricht, damit auch Kinder ohne Lesen ahnen, worum es geht. */
export const BILDER = ["📣", "🎉", "🎂", "🌳", "🥪", "🧥", "🎨", "📚", "🚌", "☀️", "🌧️", "❄️", "😴", "❤️"];
export const MAX_TEXT = 280;

/** Reaktionen je Bildchen mit den Profilen, die so reagiert haben. Gelöschte Profile zählen nicht. */
export function reaktionsGruppen(reaktionen, profile) {
  const nachId = new Map(profile.map((p) => [p.id, p]));
  return REAKTIONEN.map((emoji) => ({
    emoji,
    profile: Object.entries(reaktionen ?? {}).filter(([id, e]) => e === emoji && nachId.has(id)).map(([id]) => nachId.get(id)),
  }));
}
