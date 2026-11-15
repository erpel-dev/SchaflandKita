import test from "node:test";
import assert from "node:assert/strict";
import { normalisiereProfil, exportDaten, pruefeImport, vorschau, zusammenfuehren, sortiereProfile, FARBEN } from "../../src/lib/profile-io.js";
import { BEISPIELE } from "../../src/lib/beispiele.js";

const wolli = () => ({ id: "w", rolle: "kind", name: "Wolli", bild: { art: "schaf", wert: "weiss" }, farbe: "#cfe8f7", ueblicheZeit: "15:00" });

test("Beispielprofile sind gültig: vier Erzieher, drei Kinder", () => {
  const r = pruefeImport(BEISPIELE);
  assert.equal(r.ok, true, r.fehler);
  assert.deepEqual(r.profile.filter((p) => p.rolle === "erzieher").map((p) => p.name), ["Erpel", "Manfred", "Lola", "Eichel"]);
  assert.deepEqual(r.profile.filter((p) => p.rolle === "kind").map((p) => p.name), ["Wolli", "Scheepi", "Erpelküken"]);
});

test("Profil normalisieren: Leerzeichen, fehlende Felder, neue id", () => {
  const p = normalisiereProfil({ rolle: "kind", name: "  Flocke ", bild: { art: "emoji", wert: " 🐑 " }, farbe: "rot" });
  assert.equal(p.name, "Flocke");
  assert.equal(p.bild.wert, "🐑");
  assert.equal(p.farbe, FARBEN[0]);
  assert.equal(p.ueblicheZeit, null);
  assert.equal(p.notiz, "");
  assert.ok(p.id.length > 8);
});

test("Ungültige Profile werden abgelehnt", () => {
  const kaputt = [
    { ...wolli(), name: " " },
    { ...wolli(), name: "x".repeat(31) },
    { ...wolli(), rolle: "chef" },
    { ...wolli(), bild: { art: "schaf", wert: "lila" } },
    { ...wolli(), bild: { art: "foto", wert: "https://example.com/bild.jpg" } },
    { ...wolli(), bild: { art: "foto", wert: "data:text/html;base64,AAAA" } },
    { ...wolli(), bild: null },
    { ...wolli(), ueblicheZeit: "25:00" },
    { ...wolli(), id: 7 },
    null,
  ];
  for (const k of kaputt) assert.throws(() => normalisiereProfil(k), Error, JSON.stringify(k));
});

test("Export und Import ergeben dieselben Profile", () => {
  const profile = [normalisiereProfil(wolli()), normalisiereProfil({ ...wolli(), id: "f", name: "Foto", bild: { art: "foto", wert: "data:image/jpeg;base64,AAAA" } })];
  const tage = [{ profilId: "w", datum: "2026-11-16", status: "abgeholt", gekommenUm: "08:00", abholzeit: "15:00", gegangenUm: "15:05", meldungBis: null, nichtAbgeholt: false }];
  const datei = JSON.parse(JSON.stringify(exportDaten(profile, { tage, jetzt: new Date("2026-11-16T10:00:00Z") })));
  assert.equal(datei.format, "schafland-kita");
  assert.equal(datei.exportiertAm, "2026-11-16T10:00:00.000Z");
  const r = pruefeImport(datei);
  assert.equal(r.ok, true, r.fehler);
  assert.deepEqual(r.profile, profile);
  assert.deepEqual(r.tage, tage);
  assert.equal("tage" in exportDaten(profile), false);
});

test("Import prüft Format, Version, doppelte ids und lässt fremde Protokollzeilen weg", () => {
  assert.equal(pruefeImport(null).ok, false);
  assert.equal(pruefeImport({ format: "anders", version: 1, profile: [] }).ok, false);
  assert.equal(pruefeImport({ format: "schafland-kita", version: 2, profile: [] }).ok, false);
  assert.equal(pruefeImport({ format: "schafland-kita", version: 1 }).ok, false);
  assert.match(pruefeImport({ format: "schafland-kita", version: 1, profile: [wolli(), wolli()] }).fehler, /dieselbe id/);
  assert.match(pruefeImport({ format: "schafland-kita", version: 1, profile: [wolli(), { ...wolli(), id: "x", rolle: "?" }] }).fehler, /Rolle/);
  const r = pruefeImport({ format: "schafland-kita", version: 1, profile: [wolli()], tage: [
    { profilId: "fremd", datum: "2026-11-16", status: "da" },
    { profilId: "w", datum: "2026-11-31", status: "da" },
    { profilId: "w", datum: "2026-11-16", status: "fliegt" },
    { profilId: "w", datum: "2026-11-16", status: "da", abholzeit: "quatsch" },
  ] });
  assert.equal(r.tage.length, 1);
  assert.equal(r.tage[0].abholzeit, null);
});

test("Vorschau zählt neu, geändert, gleich und fehlend", () => {
  const a = normalisiereProfil(wolli());
  const b = normalisiereProfil({ ...wolli(), id: "s", name: "Scheepi" });
  const c = normalisiereProfil({ ...wolli(), id: "e", name: "Erpel", rolle: "erzieher" });
  const v = vorschau([a, b, c], [{ ...a, geaendertAm: "später" }, { ...b, bild: { art: "schaf", wert: "braun" } }, normalisiereProfil({ ...wolli(), id: "n", name: "Neu" })]);
  assert.deepEqual([v.neu.length, v.geaendert.length, v.gleich.length, v.fehlen.length], [1, 1, 1, 1]);
  assert.equal(v.geaendert[0].id, "s");
  assert.equal(v.fehlen[0].id, "e");
});

test("Zusammenführen behält Vorhandenes, Ersetzen nicht", () => {
  const a = normalisiereProfil(wolli());
  const b = normalisiereProfil({ ...wolli(), id: "s", name: "Scheepi" });
  const a2 = { ...a, name: "Wolli 2" };
  assert.deepEqual(zusammenfuehren([a, b], [a2]).map((p) => p.name).sort(), ["Scheepi", "Wolli 2"]);
  assert.deepEqual(zusammenfuehren([a, b], [a2], "ersetzen").map((p) => p.name), ["Wolli 2"]);
});

test("Sortierung: Kinder zuerst, dann nach Name", () => {
  const liste = pruefeImport(BEISPIELE).profile;
  assert.deepEqual(sortiereProfile(liste).map((p) => p.name), ["Erpelküken", "Scheepi", "Wolli", "Eichel", "Erpel", "Lola", "Manfred"]);
});
