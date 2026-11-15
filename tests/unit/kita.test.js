import test from "node:test";
import assert from "node:assert/strict";
import { kita } from "../../src/lib/kita.svelte.js";
import { db } from "../../src/lib/db.js";

const um = (tag, h, m = 0) => new Date(2026, 10, tag, h, m); // November 2026
const W = "beispiel-wolli", S = "beispiel-scheepi", L = "beispiel-lola";

test("Erster Start legt die sieben Beispielprofile an", async () => {
  await kita.load(um(16, 8, 12));
  assert.equal(kita.profile.length, 7);
  assert.equal(kita.datum, "2026-11-16");
  assert.equal(kita.status(W), "offen");
  assert.equal(await db.profile.count(), 7);
});

test("Anmelden mit Abholzeit, Zeit ändern, Abholen", async () => {
  await kita.anmelden(W, "15:00");
  assert.equal(kita.status(W), "da");
  assert.deepEqual({ ...kita.eintrag(W) }, { profilId: W, datum: "2026-11-16", status: "da", gekommenUm: "08:12", abholzeit: "15:00", gegangenUm: null, meldungBis: null });
  await kita.zeitAendern(W, "15:30");
  assert.equal(kita.eintrag(W).abholzeit, "15:30");
  await kita.tick(um(16, 15, 25));
  await kita.abholen(W);
  assert.equal(kita.status(W), "abgeholt");
  assert.equal(kita.eintrag(W).gegangenUm, "15:25");
  assert.equal((await db.tage.get([W, "2026-11-16"])).status, "abgeholt");
});

test("Abholen und Zeit ändern wirken nur bei Angemeldeten", async () => {
  await kita.abholen(S);
  await kita.zeitAendern(S, "12:00");
  assert.equal(kita.status(S), "offen");
  assert.equal(await db.tage.get([S, "2026-11-16"]), undefined);
});

test("Versehentlich abgeholt: wieder da, Abholzeit bleibt", async () => {
  await kita.wiederDa(W);
  assert.equal(kita.status(W), "da");
  assert.equal(kita.eintrag(W).abholzeit, "15:30");
  assert.equal(kita.eintrag(W).gegangenUm, null);
  await kita.zuruecknehmen(W);
  assert.equal(kita.status(W), "offen");
  assert.equal(await db.tage.get([W, "2026-11-16"]), undefined);
});

test("Krank für heute und zurücknehmen", async () => {
  await kita.melden(L, "krank");
  assert.equal(kita.status(L), "krank");
  assert.equal(kita.eintrag(L).meldungBis, "2026-11-16");
  await kita.zuruecknehmen(L);
  assert.equal(kita.status(L), "offen");
  await assert.rejects(() => kita.melden(L, "da"));
});

test("Mehrtägige Meldung gilt an jedem Tag und endet von selbst", async () => {
  await kita.melden(L, "abwesend", "2026-11-18");
  assert.equal(await db.tage.where("profilId").equals(L).count(), 3);
  await kita.tick(um(17, 7));
  assert.equal(kita.status(L), "abwesend");
  assert.equal(kita.eintrag(L).meldungBis, "2026-11-18");
  await kita.tick(um(19, 7));
  assert.equal(kita.status(L), "offen");
});

test("Mehrtägige Meldung zurücknehmen löscht auch die kommenden Tage, nicht die vergangenen", async () => {
  await kita.tick(um(20, 7));
  await kita.melden(L, "krank", "2026-11-23");
  await kita.tick(um(21, 7));
  await kita.zuruecknehmen(L);
  assert.equal(kita.status(L), "offen");
  const rest = await db.tage.where("profilId").equals(L).and((e) => e.status === "krank").toArray();
  assert.deepEqual(rest.map((e) => e.datum), ["2026-11-20"]);
});

test("Um Mitternacht beginnt ein neuer Tag; wer noch da war, gilt als nicht abgeholt", async () => {
  await kita.tick(um(23, 9));
  await kita.anmelden(S, "14:00");
  await kita.tick(um(24, 0, 1));
  assert.equal(kita.datum, "2026-11-24");
  assert.equal(kita.status(S), "offen");
  const gestern = await db.tage.get([S, "2026-11-23"]);
  assert.equal(gestern.status, "abgeholt");
  assert.equal(gestern.nichtAbgeholt, true);
  assert.equal((await kita.protokoll("2026-11-23")).length, 1);
});

test("Profil anlegen, ändern, löschen (mit seinem Protokoll)", async () => {
  const neu = await kita.profilSpeichern({ rolle: "kind", name: "Flocke", bild: { art: "emoji", wert: "🐑" } });
  assert.equal(kita.profile.length, 8);
  assert.equal(kita.profile[1].name, "Flocke"); // Kinder zuerst, alphabetisch
  await kita.profilSpeichern({ ...neu, name: "Flöckchen" });
  assert.equal(kita.profile.length, 8);
  assert.equal(kita.profil(neu.id).name, "Flöckchen");
  await assert.rejects(() => kita.profilSpeichern({ ...neu, name: "" }));
  await kita.anmelden(neu.id, "12:00");
  await kita.profilLoeschen(neu.id);
  assert.equal(kita.profile.length, 7);
  assert.equal(kita.status(neu.id), "offen");
  assert.equal(await db.tage.where("profilId").equals(neu.id).count(), 0);
});

test("Import: zusammenführen ändert und ergänzt, ersetzen entfernt den Rest samt Protokoll", async () => {
  const wolli = { ...kita.profil(W), name: "Wolli Wolle" };
  const neu = { id: "neu-1", rolle: "kind", name: "Mäh", bild: { art: "schaf", wert: "grau" }, farbe: "#cfe8f7", ueblicheZeit: null, notiz: "", geaendertAm: null };
  await kita.importieren([wolli, neu]);
  assert.equal(kita.profile.length, 8);
  assert.equal(kita.profil(W).name, "Wolli Wolle");
  await kita.anmelden("neu-1", "13:00");
  await kita.importieren([wolli], "ersetzen");
  assert.deepEqual(kita.profile.map((p) => p.id), [W]);
  assert.equal(await db.profile.count(), 1);
  assert.equal(await db.tage.count(), 0);
  assert.equal(kita.status("neu-1"), "offen");
});

test("Nach dem Löschen aller Profile kommen die Beispiele nicht wieder", async () => {
  await kita.profilLoeschen(W);
  await kita.load(um(25, 8));
  assert.equal(kita.profile.length, 0);
});
