import test from "node:test";
import assert from "node:assert/strict";
import { kita } from "../../src/lib/kita.svelte.js";
import { db } from "../../src/lib/db.js";
import { nfc, tagId } from "../../src/lib/nfc.svelte.js";
import { exportDaten, pruefeImport } from "../../src/lib/profile-io.js";

const um = (tag, h, m = 0) => new Date(2026, 10, tag, h, m);
const WOLLI = "beispiel-wolli", ERPEL = "beispiel-erpel", SCHEEPI = "beispiel-scheepi";

test("Kennung vereinheitlichen", () => {
  assert.equal(tagId(" 04:A2:3F:1B "), "04:a2:3f:1b");
  for (const leer of ["", "   ", null, undefined, "x".repeat(65)]) assert.equal(tagId(leer), null);
});

test("Anhänger zuordnen, ändern und aufheben", async () => {
  await kita.load(um(16, 8));
  assert.deepEqual(kita.tags, []);
  assert.equal(kita.tagProfil("04:aa"), null);
  await kita.tagZuordnen("04:AA", WOLLI);
  await kita.tagZuordnen("04:bb", WOLLI); // ein Profil darf mehrere Anhänger haben
  await kita.tagZuordnen("04:cc", ERPEL);
  assert.equal(kita.tagProfil("04:aa"), WOLLI);
  assert.equal(kita.tagProfil(" 04:AA "), WOLLI);
  assert.equal(kita.tags.length, 3);
  await kita.tagZuordnen("04:aa", SCHEEPI); // ändern: derselbe Anhänger, anderes Profil
  assert.equal(kita.tagProfil("04:aa"), SCHEEPI);
  assert.equal(kita.tags.length, 3);
  assert.equal(await db.tags.count(), 3);
  await kita.tagAufheben("04:AA");
  assert.equal(kita.tagProfil("04:aa"), null);
  assert.equal(await db.tags.count(), 2);
  await assert.rejects(() => kita.tagZuordnen("", WOLLI), /keine lesbare Kennung/);
  await assert.rejects(() => kita.tagZuordnen("04:dd", "gibt-es-nicht"), /Unbekanntes Profil/);
});

test("Zuordnungen bleiben nach dem Neustart; mit dem Profil verschwinden seine Anhänger", async () => {
  await kita.load(um(16, 9));
  assert.equal(kita.tagProfil("04:bb"), WOLLI);
  await kita.profilLoeschen(WOLLI);
  assert.equal(kita.tagProfil("04:bb"), null);
  assert.deepEqual(kita.tags.map((t) => t.id), ["04:cc"]);
  assert.equal(await db.tags.count(), 1);
});

test("Export enthält die Anhänger, Import übernimmt sie", async () => {
  const datei = JSON.parse(JSON.stringify(exportDaten(kita.profile, { tags: kita.tags })));
  assert.deepEqual(datei.tags, [{ id: "04:cc", profilId: ERPEL }]);
  assert.equal("tags" in exportDaten(kita.profile), false);
  datei.tags.push({ id: "04:EE", profilId: SCHEEPI }, { id: "04:ff", profilId: "fremd" }, { id: "", profilId: ERPEL }, null, { id: "04:ee", profilId: ERPEL });
  const r = pruefeImport(datei);
  assert.equal(r.ok, true, r.fehler);
  assert.deepEqual(r.tags, [{ id: "04:cc", profilId: ERPEL }, { id: "04:ee", profilId: ERPEL }]);
  await kita.tagAufheben("04:cc");
  await kita.importieren(r.profile, "zusammenfuehren", [], r.tags);
  assert.equal(kita.tagProfil("04:cc"), ERPEL);
  assert.equal(kita.tagProfil("04:ee"), ERPEL);
  // Ersetzen ohne Erpel: seine Anhänger gehen mit
  await kita.importieren(r.profile.filter((p) => p.id !== ERPEL), "ersetzen");
  assert.deepEqual(kita.tags, []);
});

test("Lesen: Status, Sperre gegen Doppel-Lesen, nicht lesbare Anhänger", async (t) => {
  let halten = null, gestoppt = 0;
  globalThis.__kitaFakeNfc = { available: false };
  t.after(() => delete globalThis.__kitaFakeNfc);
  assert.equal(await nfc.start(true), false);
  assert.equal(nfc.status, "fehlt");

  globalThis.__kitaFakeNfc = { granted: false, watch: (cb) => { halten = cb; return () => gestoppt++; } };
  assert.equal(await nfc.start(false), false, "ohne Antippen wird nicht um Erlaubnis gefragt");
  assert.equal(nfc.status, "antippen");
  assert.equal(await nfc.start(true), true);
  assert.equal(nfc.status, "bereit");

  const gelesen = [];
  nfc.onTag = (id) => gelesen.push(id);
  t.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  halten({ id: "04:AA" });
  halten({ id: "04:aa" }); // sofort noch einmal: zählt nicht
  t.mock.timers.tick(1000);
  halten({ id: "04:bb" }); // anderer Anhänger zählt sofort
  halten({ id: "04:aa" });
  t.mock.timers.tick(3000);
  halten({ id: "04:aa" }); // nach der Pause zählt derselbe wieder
  halten({ id: undefined }); // nicht lesbar
  assert.deepEqual(gelesen, ["04:aa", "04:bb", "04:aa", "04:aa", null]);

  await nfc.stop();
  assert.equal(gestoppt, 1);
  assert.equal(nfc.status, "antippen");

  globalThis.__kitaFakeNfc = { watch: () => { throw Object.assign(new Error("nein"), { name: "NotAllowedError" }); } };
  assert.equal(await nfc.start(true), false);
  assert.equal(nfc.status, "verweigert");
});
