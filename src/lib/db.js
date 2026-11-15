import Dexie from "dexie";

// profile: ein Eintrag je Tier oder Erzieher.
// tage: ein Eintrag je Profil und Tag; zugleich das Protokoll vergangener Tage.
// kv: Einstellungen.
export const db = new Dexie("schafland-kita");
db.version(1).stores({
  profile: "id",
  tage: "[profilId+datum], datum, profilId",
  kv: "key",
});

export async function kvGet(key, fallback) {
  const row = await db.kv.get(key);
  return row ? row.value : fallback;
}

export function kvSet(key, value) {
  return db.kv.put({ key, value });
}
