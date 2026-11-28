import test from "node:test";
import assert from "node:assert/strict";
import { settings } from "../../src/lib/settings.svelte.js";
import { db, kvGet } from "../../src/lib/db.js";

test("set speichert nur die Änderung und behält, was ein anderer Tab gespeichert hat", async () => {
  await settings.load();
  assert.equal(settings.value.abholerFragen, true);
  // Ein anderer Tab schaltet die Abholerfrage aus; dieser Tab hat noch den alten Stand
  await db.kv.put({ key: "settings", value: { ...(await kvGet("settings", {})), abholerFragen: false } });
  await settings.set({ aktion: "sommerfest" });
  const gespeichert = await kvGet("settings", {});
  assert.equal(gespeichert.aktion, "sommerfest");
  assert.equal(gespeichert.abholerFragen, false);
  // Nach dem Neuladen gilt beides
  await settings.load();
  assert.equal(settings.value.aktion, "sommerfest");
  assert.equal(settings.value.abholerFragen, false);
});

test("set ohne gespeicherten Stand: Voreinstellungen bleiben nach dem Laden erhalten", async () => {
  await db.kv.delete("settings");
  await settings.set({ aktion: null });
  await settings.load();
  assert.equal(settings.value.aktion, null);
  assert.equal(settings.value.abholerFragen, true);
  assert.ok(settings.value.zeiten.length === 6);
});
