import test from "node:test";
import assert from "node:assert/strict";
import { kita } from "../../src/lib/kita.svelte.js";
import { db } from "../../src/lib/db.js";

const id = "beispiel-wolli";
const datum = "2026-11-16";

test.beforeEach(async () => {
  await db.tage.clear();
  await db.nachrichten.clear();
  await kita.load(new Date(2026, 10, 16, 8, 12));
});

test("Tagebuch und Abholung behalten parallele Änderungen", async () => {
  await kita.anmelden(id, "15:00");

  // Ein anderer Tab hat bereits abgeholt. Die lokale Ansicht hat es noch nicht gesehen.
  await db.tage.update([id, datum], { status: "abgeholt", gegangenUm: "14:45", abgeholtVon: "Mama" });
  await Promise.all([
    kita.tagebuch(id, { gegessen: "alles" }),
    kita.tagebuch(id, { geschlafen: "kurz" }),
  ]);
  const aktuell = await db.tage.get([id, datum]);
  assert.equal(aktuell.status, "abgeholt");
  assert.equal(aktuell.gegangenUm, "14:45");
  assert.equal(aktuell.abgeholtVon, "Mama");
  assert.equal(aktuell.gegessen, "alles");
  assert.equal(aktuell.geschlafen, "kurz");
  assert.equal(await kita.zeitAendern(id, "15:30"), false);
  assert.equal(await kita.abholen(id, { text: "Papa" }), false);
});

test("Zusammenführen behält vorhandene Zeilen, Ersetzen übernimmt die Datei", async () => {
  await kita.anmelden(id, "15:00");
  await kita.abholen(id, { text: "Mama" });
  const backup = { datum, profilId: id, status: "da", abholzeit: "15:00" };
  const zusaetzlich = { ...backup, datum: "2026-11-15", status: "abgeholt" };
  const profil = { ...kita.profil(id) };
  await kita.importieren([profil], "zusammenfuehren", [backup, zusaetzlich]);
  assert.equal(kita.status(id), "abgeholt");
  assert.equal((await db.tage.get([id, datum])).abgeholtVon, "Mama");
  assert.deepEqual(await db.tage.get([id, zusaetzlich.datum]), zusaetzlich);

  await kita.importieren([profil], "ersetzen", [backup]);
  assert.equal(kita.status(id), "da");
  assert.deepEqual(await db.tage.get([id, datum]), backup);
});

test("Reaktionen ändern nur vorhandene Nachrichten und erhalten parallele Reaktionen", async () => {
  await kita.profilSpeichern({ id: "erzieher", rolle: "erzieher", name: "Test", bild: { art: "emoji", wert: "🐑" } });
  const n = await kita.nachrichtSchreiben("erzieher", "Morgen: ein Ausflug");
  await db.nachrichten.update(n.id, { reaktionen: { erzieher: "❤️" } });
  await kita.reagieren(n.id, id, "👍");
  assert.deepEqual((await db.nachrichten.get(n.id)).reaktionen, { erzieher: "❤️", [id]: "👍" });
  await db.nachrichten.delete(n.id);
  await kita.reagieren(n.id, id, "👍");
  assert.equal(await db.nachrichten.get(n.id), undefined);
});
