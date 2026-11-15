import test from "node:test";
import assert from "node:assert/strict";
import { datumStr, zeitStr, istZeit, istDatum, minuten, ausMinuten, verschieben, datumPlus, tageVonBis, dauerText, warteInfo } from "../../src/lib/zeit.js";

test("Datum und Uhrzeit in Ortszeit", () => {
  const d = new Date(2026, 10, 16, 8, 5);
  assert.equal(datumStr(d), "2026-11-16");
  assert.equal(zeitStr(d), "08:05");
});

test("Uhrzeiten und Tage prüfen", () => {
  assert.ok(istZeit("00:00") && istZeit("23:59"));
  for (const s of ["24:00", "7:30", "12:60", "", null, 1200]) assert.equal(istZeit(s), false, String(s));
  assert.ok(istDatum("2026-02-28"));
  for (const s of ["2026-02-30", "2026-13-01", "16.11.2026", null]) assert.equal(istDatum(s), false, String(s));
});

test("Minuten hin und zurück", () => {
  assert.equal(minuten("12:30"), 750);
  assert.equal(ausMinuten(750), "12:30");
  assert.equal(ausMinuten(5), "00:05");
});

test("Verschieben bleibt im Kita-Tag", () => {
  assert.equal(verschieben("15:00", 15), "15:15");
  assert.equal(verschieben("15:00", -15), "14:45");
  assert.equal(verschieben("19:55", 15), "20:00");
  assert.equal(verschieben("06:05", -15), "06:00");
});

test("Tage zählen über Monats- und Jahresgrenzen", () => {
  assert.equal(datumPlus("2026-11-30", 1), "2026-12-01");
  assert.equal(datumPlus("2026-12-31", 1), "2027-01-01");
  assert.equal(datumPlus("2026-03-01", -1), "2026-02-28");
  assert.deepEqual(tageVonBis("2026-11-29", "2026-12-01"), ["2026-11-29", "2026-11-30", "2026-12-01"]);
  assert.deepEqual(tageVonBis("2026-11-16", "2026-11-16"), ["2026-11-16"]);
  assert.deepEqual(tageVonBis("2026-11-16", "2026-11-10"), []);
  assert.equal(tageVonBis("2026-01-01", "2026-12-31").length, 31);
});

test("Dauer in Worten", () => {
  assert.equal(dauerText(0), "0 Minuten");
  assert.equal(dauerText(1), "1 Minute");
  assert.equal(dauerText(50), "50 Minuten");
  assert.equal(dauerText(60), "1 Stunde");
  assert.equal(dauerText(110), "1 Stunde 50 Minuten");
  assert.equal(dauerText(121), "2 Stunden 1 Minute");
});

test("Wartezeit zur Abholzeit", () => {
  assert.deepEqual(warteInfo("14:00", "13:10"), { ueberfaellig: false, minuten: 50, text: "in 50 Minuten" });
  assert.deepEqual(warteInfo("12:30", "13:10"), { ueberfaellig: true, minuten: 40, text: "wartet seit 40 Minuten" });
  assert.equal(warteInfo("13:10", "13:10").text, "jetzt");
  assert.equal(warteInfo("13:10", "13:10").ueberfaellig, false);
});
