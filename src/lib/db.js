import Dexie from "dexie";

// profile: ein Eintrag je Tier oder Erzieher.
// tage: ein Eintrag je Profil und Tag; zugleich das Protokoll vergangener Tage.
// nachrichten: die Pinnwand; reaktionen ist { profilId: Bildchen }.
// tags: NFC-Anhänger; id ist die Kennung des Anhängers, profilId sein Besitzer.
// kv: Einstellungen.
export const db = new Dexie("schafland-kita");
db.version(1).stores({
  profile: "id",
  tage: "[profilId+datum], datum, profilId",
  kv: "key",
});

db.version(2).stores({ nachrichten: "id, erstelltAm" });
db.version(3).stores({ tags: "id, profilId" });

export async function kvGet(key, fallback) {
  const row = await db.kv.get(key);
  return row ? row.value : fallback;
}

export function kvSet(key, value) {
  return db.kv.put({ key, value });
}
