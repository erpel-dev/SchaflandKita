import Dexie from "dexie";

// profile: ein Eintrag je Tier oder Erzieher.
// tage: ein Eintrag je Profil und Tag; zugleich das Protokoll vergangener Tage.
// nachrichten: die Pinnwand; reaktionen ist { profilId: Bildchen }.
// kv: Einstellungen.
export const db = new Dexie("schafland-kita");
db.version(1).stores({
  profile: "id",
  tage: "[profilId+datum], datum, profilId",
  kv: "key",
});

db.version(2).stores({ nachrichten: "id, erstelltAm" });

export async function kvGet(key, fallback) {
  const row = await db.kv.get(key);
  return row ? row.value : fallback;
}

export function kvSet(key, value) {
  return db.kv.put({ key, value });
}
