import test from "node:test";
import assert from "node:assert/strict";
import { kita } from "../../src/lib/kita.svelte.js";
import { db, kvGet } from "../../src/lib/db.js";
import { aktionById } from "../../src/lib/aktionen.js";
import { pruefeImport, exportDaten } from "../../src/lib/profile-io.js";

const um = (tag, h, m = 0) => new Date(2026, 10, tag, h, m); // November 2026
const S = "beispiel-scheepi", W = "beispiel-wolli";

test("Aktion Läusealarm ist bekannt", () => {
  assert.equal(aktionById("laeusealarm")?.name, "Läusealarm");
});

test("Läuse melden: Status, Markierung und gesperrtes Anmelden", async () => {
  await kita.load(um(16, 8, 12));
  assert.equal(await kita.melden(S, "laeuse", "2026-11-17"), true);
  assert.equal(kita.status(S), "laeuse");
  assert.equal(kita.eintrag(S).meldungBis, "2026-11-17");
  assert.equal(kita.brauchtLaeuseCheck(S), true);
  assert.deepEqual(await kvGet("laeuseCheck", []), [S]);
  assert.equal(await kita.anmelden(S, "14:00"), false);
  assert.equal(kita.status(S), "laeuse");
});

test("Nach Ablauf der Meldung bleibt der Läuse-Check fällig", async () => {
  await kita.tick(um(18, 7));
  assert.equal(kita.status(S), "offen");
  assert.equal(kita.brauchtLaeuseCheck(S), true);
  assert.equal(await kita.anmelden(S, "14:00"), false);
  assert.equal(kita.status(S), "offen");
});

test("Die Markierung übersteht einen Neustart", async () => {
  await kita.load(um(18, 7, 30));
  assert.equal(kita.brauchtLaeuseCheck(S), true);
});

test("Läuse-Check bestanden: wieder anmelden möglich", async () => {
  await kita.laeuseFrei(S);
  assert.equal(kita.brauchtLaeuseCheck(S), false);
  assert.deepEqual(await kvGet("laeuseCheck", []), []);
  assert.equal(await kita.anmelden(S, "14:00"), true);
  assert.equal(kita.status(S), "da");
  // Die vergangene Meldung bleibt im Protokoll
  const alt = await db.tage.where("profilId").equals(S).and((e) => e.status === "laeuse").toArray();
  assert.deepEqual(alt.map((e) => e.datum), ["2026-11-16", "2026-11-17"]);
});

test("Check während einer laufenden Meldung beendet sie ab heute", async () => {
  await kita.tick(um(19, 7));
  await kita.melden(W, "laeuse", "2026-11-22");
  await kita.tick(um(20, 7));
  assert.equal(kita.status(W), "laeuse");
  await kita.laeuseFrei(W);
  assert.equal(kita.status(W), "offen");
  assert.equal(kita.brauchtLaeuseCheck(W), false);
  const rest = await db.tage.where("profilId").equals(W).and((e) => e.status === "laeuse").toArray();
  assert.deepEqual(rest.map((e) => e.datum), ["2026-11-19"]);
});

test("Läuse-Meldung zurücknehmen löscht die kommenden Tage, die Markierung bleibt", async () => {
  await kita.melden(W, "laeuse", "2026-11-21");
  await kita.zuruecknehmen(W);
  assert.equal(kita.status(W), "offen");
  assert.equal(await db.tage.get([W, "2026-11-21"]), undefined);
  assert.equal(kita.brauchtLaeuseCheck(W), true);
  await kita.laeuseFrei(W);
});

test("Profil löschen entfernt auch die Markierung", async () => {
  await kita.tick(um(23, 7));
  await kita.melden(W, "laeuse");
  await kita.profilLoeschen(W);
  assert.equal(kita.brauchtLaeuseCheck(W), false);
  assert.deepEqual(await kvGet("laeuseCheck", []), []);
});

test("Export und Import kennen den Status Läuse", async () => {
  const datei = JSON.parse(JSON.stringify(exportDaten(kita.profile, { tage: await kita.alleTage() })));
  const r = pruefeImport(datei);
  assert.equal(r.ok, true, r.fehler);
  assert.deepEqual(r.tage.filter((e) => e.status === "laeuse").map((e) => e.datum), ["2026-11-16", "2026-11-17"]);
});

test("Unbekannte Meldungen werden abgelehnt", async () => {
  await assert.rejects(() => kita.melden(S, "flöhe"), /unbekannte Meldung/);
});
