import test from "node:test";
import assert from "node:assert/strict";
import { kita } from "../../src/lib/kita.svelte.js";
import { db } from "../../src/lib/db.js";
import { reaktionsGruppen, REAKTIONEN, MAX_TEXT } from "../../src/lib/nachrichten.js";
import { zeitpunktText } from "../../src/lib/zeit.js";

const um = (tag, h, m = 0) => new Date(2026, 10, tag, h, m);
const ERPEL = "beispiel-erpel", LOLA = "beispiel-lola", WOLLI = "beispiel-wolli", SCHEEPI = "beispiel-scheepi";

test("Zeitpunkt in Worten", () => {
  assert.equal(zeitpunktText(um(16, 8, 12).toISOString(), "2026-11-16"), "heute, 08:12");
  assert.equal(zeitpunktText(um(15, 15, 30).toISOString(), "2026-11-16"), "gestern, 15:30");
  assert.equal(zeitpunktText(um(13, 9).toISOString(), "2026-11-16"), "Freitag, 13. November, 09:00");
});

test("Erzieher schreiben Nachrichten, neueste zuerst", async () => {
  await kita.load(um(16, 8, 12));
  assert.deepEqual(kita.nachrichten, []);
  const a = await kita.nachrichtSchreiben(ERPEL, "  Morgen gehen wir in den Wald.  ", "🌳");
  assert.equal(a.text, "Morgen gehen wir in den Wald.");
  assert.equal(a.autorName, "Erpel");
  assert.equal(a.bild, "🌳");
  assert.deepEqual(a.reaktionen, {});
  await kita.tick(um(16, 9));
  const b = await kita.nachrichtSchreiben(LOLA, "Bitte Matschhosen mitbringen", "kein Bild");
  assert.equal(b.bild, "");
  assert.deepEqual(kita.nachrichten.map((n) => n.autorName), ["Lola", "Erpel"]);
  assert.equal(await db.nachrichten.count(), 2);
});

test("Kinder, Unbekannte, leere und zu lange Nachrichten werden abgelehnt", async () => {
  await assert.rejects(() => kita.nachrichtSchreiben(WOLLI, "Mäh"), /Nur Erzieher/);
  await assert.rejects(() => kita.nachrichtSchreiben("gibt-es-nicht", "Hallo"), /Nur Erzieher/);
  await assert.rejects(() => kita.nachrichtSchreiben(ERPEL, "   "), /leer/);
  await assert.rejects(() => kita.nachrichtSchreiben(ERPEL, "x".repeat(MAX_TEXT + 1)), /zu lang/);
  assert.equal((await kita.nachrichtSchreiben(ERPEL, "x".repeat(MAX_TEXT))).text.length, MAX_TEXT);
  await kita.nachrichtLoeschen(kita.nachrichten[0].id);
  assert.equal(kita.nachrichten.length, 2);
});

test("Kinder und Erzieher reagieren: eine Reaktion je Profil, wechseln und zurücknehmen", async () => {
  const id = kita.nachrichten[1].id; // Erpels Nachricht
  await kita.reagieren(id, WOLLI, "❤️");
  await kita.reagieren(id, LOLA, "👍");
  await kita.reagieren(id, SCHEEPI, "❤️");
  assert.deepEqual({ ...kita.nachrichten[1].reaktionen }, { [WOLLI]: "❤️", [LOLA]: "👍", [SCHEEPI]: "❤️" });
  await kita.reagieren(id, WOLLI, "🎉"); // wechseln
  assert.equal(kita.nachrichten[1].reaktionen[WOLLI], "🎉");
  await kita.reagieren(id, WOLLI, "🎉"); // zurücknehmen
  assert.equal(WOLLI in kita.nachrichten[1].reaktionen, false);
  await assert.rejects(() => kita.reagieren(id, WOLLI, "💩"), /Unbekannte Reaktion/);
  await assert.rejects(() => kita.reagieren(id, "gibt-es-nicht", "👍"), /Unbekanntes Profil/);
  await kita.reagieren("gibt-es-nicht", WOLLI, "👍");
  assert.deepEqual((await db.nachrichten.get(id)).reaktionen, { [LOLA]: "👍", [SCHEEPI]: "❤️" });
});

test("Reaktionen gruppieren, gelöschte Profile zählen nicht", () => {
  const g = reaktionsGruppen({ [WOLLI]: "❤️", [SCHEEPI]: "❤️", [LOLA]: "👍", weg: "❤️" }, kita.profile);
  assert.deepEqual(g.map((x) => x.emoji), REAKTIONEN);
  assert.deepEqual(g.find((x) => x.emoji === "❤️").profile.map((p) => p.name).sort(), ["Scheepi", "Wolli"]);
  assert.deepEqual(g.find((x) => x.emoji === "👍").profile.map((p) => p.name), ["Lola"]);
  assert.equal(g.find((x) => x.emoji === "😂").profile.length, 0);
  assert.equal(reaktionsGruppen(undefined, kita.profile).every((x) => x.profile.length === 0), true);
});

test("Zähler neuer Nachrichten bis zum Öffnen der Pinnwand", async () => {
  assert.equal(kita.ungelesen, 2);
  await kita.tick(um(16, 10));
  await kita.pinnwandGesehen();
  assert.equal(kita.ungelesen, 0);
  await kita.tick(um(16, 11));
  await kita.nachrichtSchreiben(ERPEL, "Heute gibt es Kuchen", "🎂");
  assert.equal(kita.ungelesen, 1);
});

test("Nach dem Neustart ist alles noch da", async () => {
  await kita.load(um(16, 12));
  assert.deepEqual(kita.nachrichten.map((n) => n.text), ["Heute gibt es Kuchen", "Bitte Matschhosen mitbringen", "Morgen gehen wir in den Wald."]);
  assert.equal(kita.ungelesen, 1);
  assert.equal(kita.nachrichten[2].reaktionen[LOLA], "👍");
});

test("Profil löschen entfernt seine Reaktionen, seine Nachrichten bleiben", async () => {
  await kita.profilLoeschen(LOLA);
  assert.equal(LOLA in kita.nachrichten[2].reaktionen, false);
  assert.deepEqual((await db.nachrichten.get(kita.nachrichten[2].id)).reaktionen, { [SCHEEPI]: "❤️" });
  assert.equal(kita.nachrichten[1].autorName, "Lola");
  assert.equal(kita.nachrichten.length, 3);
});
