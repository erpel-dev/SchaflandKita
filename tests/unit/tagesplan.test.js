import test from "node:test";
import assert from "node:assert/strict";
import { STANDARD_PLAN, sortierePlan, planStand, planSatz, MAX_PUNKTE } from "../../src/lib/tagesplan.js";
import { tagesbericht, abholerSauber, abholerDa } from "../../src/lib/tagebuch.js";
import { aktionen, aktionById } from "../../src/lib/aktionen.js";
import { pruefeImport } from "../../src/lib/profile-io.js";
import { kita } from "../../src/lib/kita.svelte.js";
import { db } from "../../src/lib/db.js";

const um = (tag, h, m = 0) => new Date(2026, 10, tag, h, m);
const WOLLI = "beispiel-wolli", ERPEL = "beispiel-erpel";

test("Plan sortieren und säubern", () => {
  const plan = sortierePlan([
    { zeit: "12:00", bild: "🍽️", text: " Mittagessen " },
    { zeit: "9:00", text: "ungültige Zeit" },
    { zeit: "09:00", text: "" },
    null,
    { zeit: "08:00", text: "Ankommen" },
    { zeit: "10:00", bild: "🌳🌳🌳🌳🌳🌳", text: "x".repeat(40) },
  ]);
  assert.deepEqual(plan.map((p) => p.zeit), ["08:00", "10:00", "12:00"]);
  assert.equal(plan[0].bild, "");
  assert.equal(plan[1].text.length, 24);
  assert.equal(plan[2].text, "Mittagessen");
  assert.deepEqual(sortierePlan("quatsch"), []);
  assert.equal(sortierePlan(Array.from({ length: 30 }, (_, i) => ({ zeit: `10:${String(i).padStart(2, "0")}`, text: "x" }))).length, MAX_PUNKTE);
  assert.deepEqual(sortierePlan(STANDARD_PLAN), STANDARD_PLAN);
});

test("Welcher Punkt läuft gerade", () => {
  const plan = sortierePlan(STANDARD_PLAN);
  assert.equal(planStand(plan, "07:59"), -1);
  assert.equal(plan[planStand(plan, "08:00")].text, "Ankommen");
  assert.equal(plan[planStand(plan, "09:29")].text, "Morgenkreis");
  assert.equal(plan[planStand(plan, "13:10")].text, "Schlafen");
  assert.equal(plan[planStand(plan, "23:00")].text, "Tschüss");
  assert.equal(planStand([], "12:00"), -1);
});

test("Sätze zum Vorlesen", () => {
  const plan = sortierePlan(STANDARD_PLAN);
  assert.equal(planSatz(plan, 5, "13:10"), "Jetzt ist Schlafen.");
  assert.equal(planSatz(plan, 6, "13:10"), "Snack ist um 14 Uhr 30.");
  assert.equal(planSatz(plan, 4, "13:10"), "Mittagessen war um 12 Uhr.");
  assert.equal(planSatz(plan, 99, "13:10"), "");
});

test("Vier Aktionen", () => {
  assert.deepEqual(aktionen.map((a) => a.name), ["Sommerfest", "Kürbisfest", "Weihnachtsmarkt", "Läusealarm"]);
  for (const a of aktionen) assert.ok(a.id && a.emoji && a.startText && a.gruss && a.ground.length === 3, a.id);
  assert.equal(aktionById("kuerbisfest").name, "Kürbisfest");
  assert.equal(aktionById("gibt-es-nicht"), null);
  assert.equal(aktionById(null), null);
});

test("Abholen mit Angabe, wer abholt", async () => {
  await kita.load(um(16, 8, 12));
  await kita.anmelden(WOLLI, "15:00");
  await kita.tick(um(16, 15, 5));
  await kita.abholen(WOLLI, { text: "  Oma  ", bild: "👵" });
  assert.equal(kita.eintrag(WOLLI).abgeholtVon, "Oma");
  assert.equal(kita.eintrag(WOLLI).abgeholtVonBild, "👵");
  assert.equal((await db.tage.get([WOLLI, "2026-11-16"])).abgeholtVon, "Oma");
  await kita.wiederDa(WOLLI);
  assert.equal(kita.eintrag(WOLLI).abgeholtVon, null);
  await kita.abholen(WOLLI); // ohne Angabe
  assert.equal(kita.eintrag(WOLLI).status, "abgeholt");
  assert.equal(kita.eintrag(WOLLI).abgeholtVon, null);
  assert.equal(abholerSauber({ text: "   " }), null);
  assert.equal(abholerSauber(null), null);
  assert.deepEqual(abholerSauber({ text: "x".repeat(40) }), { text: "x".repeat(24), bild: "" });
});

test("Essen und Schlafen eintragen, ändern, löschen", async () => {
  await kita.wiederDa(WOLLI);
  await kita.tagebuch(WOLLI, { gegessen: "alles" });
  await kita.tagebuch(WOLLI, { geschlafen: "kurz" });
  assert.equal(kita.eintrag(WOLLI).gegessen, "alles");
  assert.equal(kita.eintrag(WOLLI).geschlafen, "kurz");
  assert.equal(kita.eintrag(WOLLI).status, "da");
  assert.equal(kita.eintrag(WOLLI).abholzeit, "15:00");
  await kita.tagebuch(WOLLI, { gegessen: null });
  assert.equal(kita.eintrag(WOLLI).gegessen, null);
  assert.equal(kita.eintrag(WOLLI).geschlafen, "kurz");
  assert.throws(() => kita.tagebuch(WOLLI, { gegessen: "viel" }), /Essen/);
  assert.throws(() => kita.tagebuch(WOLLI, { geschlafen: "tief" }), /Schlafen/);
  await kita.tagebuch(ERPEL, { gegessen: "alles" }); // nicht angemeldet: nichts passiert
  assert.equal(kita.eintrag(ERPEL), null);
  await kita.tagebuch(WOLLI, { gegessen: "etwas" });
  await kita.abholen(WOLLI, { text: "Papa", bild: "👨" });
  assert.equal(kita.eintrag(WOLLI).gegessen, "etwas", "bleibt beim Abholen erhalten");
  await kita.tagebuch(WOLLI, { geschlafen: "ja" }); // nachtragen geht auch nach dem Abholen
  assert.equal((await db.tage.get([WOLLI, "2026-11-16"])).geschlafen, "ja");
});

test("Tagesbericht", () => {
  assert.deepEqual(tagesbericht(kita.eintrag(WOLLI)), [
    { bild: "🏫", text: "da seit 08:12" },
    { bild: "🙂", text: "ein bisschen gegessen" },
    { bild: "😴", text: "geschlafen" },
  ]);
  assert.deepEqual(tagesbericht({ gekommenUm: "09:00" }), [{ bild: "🏫", text: "da seit 09:00" }]);
  assert.deepEqual(tagesbericht(null), []);
});

test("Protokoll-Import behält Tagebuch und Abholer, verwirft Unsinn", () => {
  const wolli = { id: "w", rolle: "kind", name: "Wolli", bild: { art: "schaf", wert: "weiss" } };
  const r = pruefeImport({ format: "schafland-kita", version: 1, profile: [wolli], tage: [
    { profilId: "w", datum: "2026-11-16", status: "abgeholt", gegessen: "alles", geschlafen: "nein", abgeholtVon: "Oma", abgeholtVonBild: "👵" },
    { profilId: "w", datum: "2026-11-17", status: "abgeholt", gegessen: "viel", geschlafen: 7, abgeholtVon: 12 },
  ] });
  assert.equal(r.ok, true, r.fehler);
  assert.deepEqual([r.tage[0].gegessen, r.tage[0].geschlafen, r.tage[0].abgeholtVon, r.tage[0].abgeholtVonBild], ["alles", "nein", "Oma", "👵"]);
  for (const feld of ["gegessen", "geschlafen", "abgeholtVon"]) assert.equal(feld in r.tage[1], false, feld);
});

test("Ansage beim Abholen: ist da / sind da", () => {
  assert.equal(abholerDa("Mama"), "Mama ist da!");
  assert.equal(abholerDa("Jemand anderes"), "Jemand anderes ist da!");
  assert.equal(abholerDa("Geschwister"), "Geschwister sind da!");
  assert.equal(abholerDa(" Eltern "), "Eltern sind da!");
  assert.equal(abholerDa("Mama und Papa"), "Mama und Papa sind da!");
});
