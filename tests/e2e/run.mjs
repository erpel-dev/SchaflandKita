// Browser-Test für Schafland Kita. Aufruf: npm run test:e2e
// Startet "vite preview" mit dist/ und spielt einen Kita-Tag in Chromium durch, mit gestellter Uhr.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const R = fileURLToPath(new URL("../..", import.meta.url));
const SHOTS = path.join(R, "tests/e2e/.output");
fs.mkdirSync(SHOTS, { recursive: true });
const PORT = 8098;
const URL_APP = `http://localhost:${PORT}/`;
const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
}
/** Vergleicht; eine Funktion wird bis zu drei Sekunden lang wiederholt gefragt (die App speichert asynchron). */
async function eq(name, ist, soll) {
  let wert = typeof ist === "function" ? await ist() : ist;
  for (let i = 0; i < 30 && typeof ist === "function" && JSON.stringify(wert) !== JSON.stringify(soll); i++) {
    await new Promise((r) => setTimeout(r, 100));
    wert = await ist();
  }
  const ok = JSON.stringify(wert) === JSON.stringify(soll);
  check(name, ok, ok ? "" : `ist ${JSON.stringify(wert)}, soll ${JSON.stringify(soll)}`);
}
const sichtbar = (loc) => loc.waitFor({ timeout: 3000 }).then(() => true, () => false);

const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { cwd: R, stdio: "ignore", detached: true });
for (let i = 0; i < 50; i++) {
  try { if ((await fetch(URL_APP)).ok) break; } catch {}
  await new Promise((r) => setTimeout(r, 200));
}

// Eigener Chromium, falls die mitgelieferte Playwright-Version keinen passenden Browser findet
const CHROMIUM = process.env.CHROMIUM_PATH ?? (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, acceptDownloads: true, locale: "de-DE", serviceWorkers: "block" });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.clock.install({ time: new Date(2026, 10, 16, 8, 12) }); // Montag, 16.11.2026, 08:12
  // NFC-Attrappe: window.__nfcHalten("kennung") hält einen Anhänger ans Gerät
  await page.addInitScript(() => {
    globalThis.__kitaFakeNfc = { watch: (onTag) => { globalThis.__nfcHalten = (id) => onTag({ id }); return () => (globalThis.__nfcHalten = null); } };
  });
  const halten = async (id, pause = true) => {
    if (pause) await page.clock.fastForward(3000); // Sperre gegen Doppel-Lesen abwarten
    await page.evaluate((id) => globalThis.__nfcHalten(id), id);
  };
  await page.goto(URL_APP);

  const namen = (bereich) => page.locator(`[data-bereich="${bereich}"] .kachel b`).allTextContents();
  const kachel = (name) => page.locator(`.kachel[data-profil="${name}"]`);
  const shot = (name) => page.screenshot({ path: path.join(SHOTS, name + ".png") });

  // ---------- Start ----------
  await page.getByRole("heading", { name: "Schafland Kita" }).waitFor();
  await shot("01-start");
  await page.getByRole("button", { name: "Kita öffnen" }).click();
  await eq("Erster Start: sieben Beispielprofile, alle noch nicht da", async () => namen("offen"), ["Erpelküken", "Scheepi", "Wolli", "Eichel", "Erpel", "Lola", "Manfred"]);
  check("Uhr zeigt Montag 08:12", (await page.locator(".uhr").textContent()).replace(/\s+/g, " ").trim() === "Montag 08:12");
  await eq("Tagesplan zeigt neun Punkte", async () => page.locator(".plan .punkt").count(), 9);
  await eq("Tagesplan: um 08:12 läuft „Ankommen“", async () => page.locator(".punkt.jetzt b").allTextContents(), ["Ankommen"]);
  await shot("02-terminal-leer");

  // ---------- Anmelden ----------
  await kachel("Wolli").click();
  const dlg = page.getByRole("dialog");
  const abholknopf = dlg.getByRole("button", { name: "Abholen" });
  check("Fenster fragt nach der Abholzeit", await sichtbar(dlg.getByText("Wann wirst du abgeholt?")));
  await eq("Übliche Abholzeit ist vorgewählt", async () => dlg.locator('[data-test="zeit"]').textContent(), "15:00 Uhr");
  await page.waitForTimeout(300); // Einblend-Animation
  await shot("03-anmelden");
  await dlg.getByRole("button", { name: "Später" }).click();
  await eq("Plus verstellt um 15 Minuten", async () => dlg.locator('[data-test="zeit"]').textContent(), "15:15 Uhr");
  await dlg.locator(".zeitknopf", { hasText: "14:00" }).click();
  await eq("Zeitknopf wählt 14:00", async () => dlg.locator('[data-test="zeit"]').textContent(), "14:00 Uhr");
  await dlg.getByRole("button", { name: "Anmelden" }).click();
  await dlg.waitFor({ state: "hidden" });
  await eq("Wolli ist im Kindergarten", async () => namen("da"), ["Wolli"]);
  check("Kachel zeigt die Abholzeit", (await kachel("Wolli").locator(".info").textContent()).includes("14:00"));

  await kachel("Erpelküken").click();
  await dlg.getByRole("button", { name: "Anmelden" }).click();
  await kachel("Erpel").click();
  check("Erzieher werden nach dem Dienstende gefragt", await sichtbar(dlg.getByText("Bis wann arbeitest du heute?")));
  await dlg.getByRole("button", { name: "Anmelden" }).click();
  await dlg.waitFor({ state: "hidden" });
  await eq("Angemeldete sind nach Abholzeit sortiert", async () => namen("da"), ["Erpelküken", "Wolli", "Erpel"]);

  // ---------- Krank und abwesend ----------
  await kachel("Lola").click();
  await dlg.getByRole("button", { name: "Krank" }).click();
  await eq("Meldung gilt zuerst nur heute", async () => dlg.locator('[data-test="bis"]').textContent(), "nur heute");
  await dlg.getByRole("button", { name: "Einen Tag länger" }).click();
  await dlg.getByRole("button", { name: "Einen Tag länger" }).click();
  await eq("Mehrtägig bis Mittwoch", async () => dlg.locator('[data-test="bis"]').textContent(), "bis Mittwoch, 18. November");
  await dlg.getByRole("button", { name: "Krank melden" }).click();
  await kachel("Eichel").click();
  await dlg.getByRole("button", { name: "Nicht da" }).click();
  await dlg.getByRole("button", { name: "Nicht da melden" }).click();
  await dlg.waitFor({ state: "hidden" });
  await eq("Lola und Eichel fehlen", async () => namen("fehlt"), ["Eichel", "Lola"]);
  await kachel("Eichel").click();
  await dlg.getByRole("button", { name: "Doch da" }).click();
  check("Zurückgenommene Meldung führt wieder zum Anmelden", await sichtbar(dlg.getByRole("button", { name: "Anmelden" })));
  await dlg.getByRole("button", { name: "Zurück" }).click();
  await eq("Eichel ist wieder offen", async () => namen("fehlt"), ["Lola"]);
  await shot("04-terminal");

  // ---------- Übersicht ----------
  await page.clock.fastForward("04:58:00"); // 13:10
  await eq("Tagesplan: um 13:10 läuft „Schlafen“", async () => page.locator(".punkt.jetzt b").allTextContents(), ["Schlafen"]);
  await eq("Tagesplan: Vergangenes ist blass", async () => page.locator(".punkt.vorbei").count(), 5);
  check("Tagesplan: neuer Punkt wird angesagt", await sichtbar(page.getByRole("status").getByText("Jetzt: Schlafen")));
  await page.getByRole("button", { name: "Übersicht" }).click();
  await eq("Zähler Tiere", async () => (await page.locator('[data-test="z-tiere"]').textContent()).trim(), "2 Tiere da");
  await eq("Zähler Erzieher", async () => (await page.locator('[data-test="z-erzieher"]').textContent()).trim(), "1 Erzieher da");
  await eq("Zähler krank", async () => (await page.locator('[data-test="z-fehlen"]').textContent()).trim(), "1 krank, 0 nicht da");
  await eq("Abholliste nach Uhrzeit", async () => page.locator(".abhol .wer b").allTextContents(), ["Erpelküken", "Wolli"]);
  await eq("Überschrittene Abholzeit", async () => page.locator('.abhol[data-profil="Erpelküken"] small').textContent(), "wartet seit 40 Minuten");
  check("… ist markiert", await page.locator('.abhol[data-profil="Erpelküken"].spaet').count() === 1);
  await eq("Restzeit bis zur Abholung", async () => page.locator('.abhol[data-profil="Wolli"] small').textContent(), "in 50 Minuten");
  await eq("Erzieher-Zeile krank mehrtägig", async () => page.locator('.zeile[data-profil="Lola"] small').textContent(), "krank bis Mittwoch, 18. November");
  // Essen und Schlafen
  const buch = (name) => page.locator(`[data-buch="${name}"]`);
  const gedrueckt = (name) => buch(name).locator('button[aria-pressed="true"]').evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  await eq("Tagebuch listet die angemeldeten Tiere", async () => page.locator("[data-buch] > b").allTextContents(), ["Erpelküken", "Wolli"]);
  await buch("Erpelküken").getByRole("button", { name: "nichts gegessen" }).click();
  await buch("Erpelküken").getByRole("button", { name: "alles gegessen" }).click();
  await buch("Erpelküken").getByRole("button", { name: "geschlafen", exact: true }).click();
  await buch("Wolli").getByRole("button", { name: "kurz geschlafen" }).click();
  await eq("Tagebuch: eine Angabe je Gruppe, die letzte gilt", () => gedrueckt("Erpelküken"), ["alles gegessen", "geschlafen"]);
  await buch("Wolli").getByRole("button", { name: "kurz geschlafen" }).click();
  await eq("Tagebuch: noch einmal antippen nimmt zurück", () => gedrueckt("Wolli"), []);
  await buch("Wolli").getByRole("button", { name: "ein bisschen gegessen" }).click();
  await page.waitForTimeout(200);
  await shot("05-uebersicht");
  await page.locator('.abhol[data-profil="Erpelküken"]').getByRole("button", { name: "Abholen" }).click();
  check("Abholen fragt, wer abholt", await sichtbar(dlg.getByText("Wer holt Erpelküken ab?")));
  await eq("… und zeigt den Tagesbericht", async () => (await dlg.locator('[data-test="bericht"] > span').allTextContents()).map((t) => t.trim()), ["🏫 da seit 08:12", "😋 alles gegessen", "😴 geschlafen"]);
  await eq("Auswahl der Abholer", async () => dlg.locator(".wer-knopf b").allTextContents(), ["Mama", "Papa", "Oma", "Opa", "Geschwister", "Jemand anderes"]);
  await page.waitForTimeout(300);
  await shot("05b-wer-holt-ab");
  await dlg.locator(".wer-knopf", { hasText: "Mama" }).click();
  await dlg.waitFor({ state: "hidden" });
  await eq("Abholen aus der Liste checkt aus", async () => page.locator(".abhol .wer b").allTextContents(), ["Wolli"]);
  await eq("… und steht bei den weiteren Tieren", async () => page.locator('.zeile[data-profil="Erpelküken"] small').textContent(), "gegangen 13:10 mit Mama");
  await eq("Abgeholte bleiben im Tagebuch (zum Nachtragen)", async () => page.locator("[data-buch] > b").allTextContents(), ["Erpelküken", "Wolli"]);
  await page.getByRole("button", { name: "Zurück" }).click();
  await eq("Schon zu Hause", async () => namen("abgeholt"), ["Erpelküken"]);

  // ---------- Abholen im Fenster, zurücknehmen ----------
  await kachel("Erpelküken").click();
  await eq("Fenster zeigt, wer abgeholt hat", async () => (await dlg.locator('[data-test="gegangen"]').textContent()).replace(/\s+/g, " ").trim(), "gegangen um 13:10 Uhr mit 👩 Mama");
  await dlg.getByRole("button", { name: "Wieder da" }).click();
  await dlg.waitFor({ state: "hidden" });
  check("Wieder da schließt das Fenster", (await namen("da")).includes("Erpelküken"));
  await kachel("Erpelküken").click();
  check("Danach zeigt die Kachel den Abholen-Knopf", await sichtbar(abholknopf));
  check("… und die überschrittene Zeit", await sichtbar(dlg.locator(".spaet")));
  await page.waitForTimeout(300);
  await shot("06-abholen");
  await abholknopf.click();
  check("Antippen von Abholen öffnet die Abholerauswahl", await sichtbar(dlg.getByText("Wer holt Erpelküken ab?")));
  await dlg.getByRole("button", { name: "Doch nicht" }).click();
  check("„Doch nicht“ führt zurück, ohne auszuchecken", await sichtbar(abholknopf));
  await abholknopf.click();
  await dlg.locator(".wer-knopf", { hasText: "Oma" }).click();
  await dlg.waitFor({ state: "hidden" });
  await eq("Wieder abgeholt", async () => namen("abgeholt"), ["Erpelküken"]);

  // ---------- Neu laden: alles bleibt gespeichert ----------
  await page.reload();
  await page.getByRole("button", { name: "Kita öffnen" }).click();
  await eq("Nach Neuladen: im Kindergarten", async () => namen("da"), ["Wolli", "Erpel"]);
  await eq("Nach Neuladen: krank", async () => namen("fehlt"), ["Lola"]);

  // ---------- Pinnwand ----------
  await page.getByRole("button", { name: "Pinnwand" }).click();
  check("Pinnwand ist anfangs leer", await sichtbar(page.getByText("Noch keine Nachrichten.")));
  await page.getByRole("button", { name: "Nachricht schreiben" }).click();
  const schreib = page.getByRole("dialog", { name: "Nachricht schreiben" });
  await eq("Nur Erzieher stehen als Verfasser zur Wahl", async () => schreib.locator(".kopfknopf b").allTextContents(), ["Eichel", "Erpel", "Lola", "Manfred"]);
  check("Ohne Verfasser und Text lässt sich nichts anpinnen", await schreib.getByRole("button", { name: "Anpinnen" }).isDisabled());
  await schreib.locator(".kopfknopf", { hasText: "Erpel" }).click();
  await schreib.locator("#n-text").fill("Morgen gehen wir in den Wald. Bitte Matschhosen mitbringen!");
  await schreib.getByRole("button", { name: "Bild 🌳" }).click();
  await page.waitForTimeout(200);
  await shot("13-nachricht-schreiben");
  await schreib.getByRole("button", { name: "Anpinnen" }).click();
  await schreib.waitFor({ state: "hidden" });
  const karte = page.locator("article").first();
  await eq("Nachricht steht an der Pinnwand", async () => karte.locator("p").textContent(), "Morgen gehen wir in den Wald. Bitte Matschhosen mitbringen!");
  await eq("… mit Verfasser und Zeitpunkt", async () => (await karte.locator("header").textContent()).replace(/\s+/g, " ").trim().replace(/ 🔊$/, ""), "🦆 Erpel heute, 13:10");
  await eq("… und Bild", async () => karte.locator(".bild").textContent(), "🌳");

  const reagiere = async (emoji, name) => {
    await karte.getByRole("button", { name: `Mit ${emoji} reagieren` }).click();
    const wer = page.getByRole("dialog", { name: "Wer bist du?" });
    await wer.locator(`.kopfknopf[data-profil="${name}"]`).click();
    await wer.waitFor({ state: "hidden" });
  };
  const wer = (emoji) => karte.getByRole("button", { name: `Mit ${emoji} reagieren` }).locator("[data-wer]").evaluateAll((els) => els.map((e) => e.dataset.wer).sort());
  await reagiere("❤️", "Wolli");
  await reagiere("❤️", "Scheepi");
  await reagiere("👍", "Manfred");
  await eq("Kinder reagieren", () => wer("❤️"), ["Scheepi", "Wolli"]);
  await eq("Erzieher reagieren", () => wer("👍"), ["Manfred"]);
  await page.waitForTimeout(200);
  await shot("14-pinnwand");
  await karte.getByRole("button", { name: "Mit 🎉 reagieren" }).click();
  await page.waitForTimeout(200);
  await shot("15-wer-bist-du");
  check("Auswahl zeigt die bisherige Reaktion", (await page.locator('.kopfknopf[data-profil="Wolli"] .schon').textContent()) === "❤️");
  await page.locator('.kopfknopf[data-profil="Wolli"]').click();
  await eq("Andere Reaktion ersetzt die alte", () => wer("❤️"), ["Scheepi"]);
  await eq("… durch die neue", () => wer("🎉"), ["Wolli"]);
  await reagiere("🎉", "Wolli");
  await eq("Dieselbe Reaktion noch einmal nimmt sie zurück", () => wer("🎉"), []);

  await page.getByRole("button", { name: "Zurück" }).click();
  check("Eigene Nachricht zählt nicht als neu", await page.locator(".neu").count() === 0);
  await page.clock.fastForward("00:02:00"); // 13:12
  await page.evaluate(async () => {
    // Zweite Nachricht, während die Pinnwand geschlossen ist
    const db = await new Promise((ok) => { const r = indexedDB.open("schafland-kita"); r.onsuccess = () => ok(r.result); });
    const tx = db.transaction("nachrichten", "readwrite");
    tx.objectStore("nachrichten").put({ id: "test-2", autorId: "beispiel-lola", autorName: "Lola", text: "Heute gibt es Kuchen", bild: "🎂", erstelltAm: new Date().toISOString(), reaktionen: {} });
    await new Promise((ok) => (tx.oncomplete = ok));
  });
  await page.reload();
  await page.getByRole("button", { name: "Kita öffnen" }).click();
  await eq("Zähler zeigt eine neue Nachricht", async () => page.locator(".neu").textContent(), "1");
  await page.getByRole("button", { name: "Pinnwand" }).click();
  await eq("Nach Neuladen: beide Nachrichten, neueste zuerst", async () => page.locator("article p").allTextContents(), ["Heute gibt es Kuchen", "Morgen gehen wir in den Wald. Bitte Matschhosen mitbringen!"]);
  await eq("Nach Neuladen: Reaktionen bleiben", async () => page.locator("article").nth(1).locator("[data-wer]").evaluateAll((els) => els.map((e) => e.dataset.wer).sort()), ["Manfred", "Scheepi"]);
  await page.getByRole("button", { name: "Zurück" }).click();
  check("Nach dem Ansehen ist der Zähler weg", await page.locator(".neu").count() === 0);

  await page.keyboard.press("Control+,");
  await page.locator(".buero").getByRole("button", { name: "Nachrichten" }).click();
  await page.locator("tbody tr", { hasText: "Kuchen" }).getByRole("button", { name: "Löschen" }).click();
  await page.locator("tbody tr", { hasText: "Kuchen" }).getByRole("button", { name: "Wirklich löschen?" }).click();
  await eq("Büro löscht eine Nachricht nach Rückfrage", async () => page.locator("tbody tr").count(), 1);
  await eq("Büro zählt die Reaktionen", async () => page.locator("tbody tr td").nth(3).textContent(), "2");
  await page.getByRole("button", { name: "Schließen" }).click();

  // ---------- NFC-Anhänger ----------
  await halten("04:AA:01");
  const neuTag = page.getByRole("dialog", { name: "Neuer Anhänger" });
  check("Unbekannter Anhänger fragt, wem er gehört", await sichtbar(neuTag));
  await page.waitForTimeout(200);
  await shot("16-nfc-neu");
  await neuTag.locator('.kopfknopf[data-profil="Scheepi"]').click();
  check("Nach dem Zuordnen öffnet sich das Fenster des Profils", await sichtbar(dlg.getByText("Wann wirst du abgeholt?")));
  await eq("… mit dem Hinweis aufs zweite Hinhalten", async () => (await dlg.locator('[data-test="tagtipp"]').textContent()).trim(), "🏷️ Anhänger noch einmal hinhalten: anmelden");
  await page.waitForTimeout(200);
  await shot("17-nfc-fenster");
  await halten("04:aa:01", false);
  check("Sofortiges zweites Lesen zählt nicht", await dlg.isVisible() && (await namen("da")).includes("Scheepi") === false);
  await halten("04:aa:01");
  await dlg.waitFor({ state: "hidden" });
  await eq("Noch einmal hinhalten meldet an, mit der üblichen Zeit", async () => (await kachel("Scheepi").locator(".info").textContent()).trim(), "🕒 14:00");
  await halten("04:aa:01");
  check("Angemeldet: Anhänger öffnet das Fenster zum Abholen", await sichtbar(dlg.getByRole("button", { name: "Abholen" })));
  await halten("04:aa:01");
  await dlg.waitFor({ state: "hidden" });
  await eq("Noch einmal hinhalten meldet ab", async () => (await namen("abgeholt")).includes("Scheepi"), true);
  await halten("04:aa:01");
  check("Abgeholt: Anhänger öffnet nur das Fenster", await sichtbar(dlg.getByRole("button", { name: "Wieder da" })));
  await halten("04:aa:01");
  await page.waitForTimeout(300);
  await eq("… und ändert beim zweiten Hinhalten nichts", async () => (await namen("abgeholt")).includes("Scheepi"), true);
  await dlg.getByRole("button", { name: "Zurück" }).click();
  await halten(null);
  check("Nicht lesbarer Anhänger gibt einen Hinweis", await sichtbar(page.getByRole("status").getByText("lässt sich nicht lesen")));

  await page.keyboard.press("Control+,");
  await page.locator(".buero").getByRole("button", { name: "NFC" }).click();
  await eq("Büro: NFC ist bereit", async () => page.locator('[data-test="nfc-status"]').textContent(), "Bereit: Anhänger ans Gerät halten.");
  const besitzer = (id) => page.locator(`tr[data-tag="${id}"] select`).evaluate((el) => el.selectedOptions[0].textContent);
  await eq("Büro zeigt die Zuordnung", () => besitzer("04:aa:01"), "Scheepi");
  await halten("04:bb:02");
  check("Büro: neuer Anhänger erscheint zum Zuordnen", await sichtbar(page.locator('[data-test="nfc-neu"]')));
  await page.getByLabel("Neuen Anhänger zuordnen").selectOption({ label: "Wolli" });
  await eq("Büro: zugeordnet", () => besitzer("04:bb:02"), "Wolli");
  await halten("04:aa:01");
  check("Büro: hingehaltener Anhänger wird hervorgehoben", await sichtbar(page.locator('tr.gelesen[data-tag="04:aa:01"]')));
  await page.getByLabel("Besitzer von 04:aa:01").selectOption({ label: "Erpel" });
  await eq("Büro: Zuordnung ändern", () => besitzer("04:aa:01"), "Erpel");
  await page.waitForTimeout(200);
  await shot("18-nfc-buero");
  await page.locator('tr[data-tag="04:bb:02"]').getByRole("button", { name: "Aufheben" }).click();
  await eq("Büro: Zuordnung aufheben", async () => page.locator("tr[data-tag]").count(), 1);
  check("Im Büro löst der Anhänger keine An- oder Abmeldung aus", await page.getByRole("dialog").count() === 0);
  await page.getByRole("button", { name: "Schließen" }).click();
  await halten("04:aa:01");
  check("Geänderter Anhänger gehört jetzt Erpel", await sichtbar(dlg.getByRole("button", { name: "Feierabend" })) && (await dlg.locator(".name").textContent()) === "Erpel");
  await dlg.getByRole("button", { name: "Zurück" }).click();
  await halten("04:bb:02");
  check("Aufgehobener Anhänger gilt wieder als neu", await sichtbar(neuTag));
  await neuTag.getByRole("button", { name: "Niemandem" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Kita öffnen" }).click();
  await halten("04:aa:01");
  check("Nach Neuladen kennt die App den Anhänger noch", await sichtbar(dlg.getByRole("button", { name: "Feierabend" })));
  await dlg.getByRole("button", { name: "Zurück" }).click();

  // ---------- Büro ----------
  const brand = page.locator(".brand");
  await brand.dispatchEvent("pointerdown");
  await page.clock.runFor(1000);
  check("Kurzer Druck öffnet das Büro nicht", await page.locator(".buero").count() === 0);
  await page.clock.runFor(1100);
  await page.locator(".buero").waitFor();
  check("Zwei Sekunden Druck öffnen das Büro", true);
  await page.getByRole("button", { name: "+ Neues Profil" }).click();
  await page.locator("#f-name").fill("Flocke");
  await page.getByRole("button", { name: "Schaf grau" }).click();
  await page.locator("#f-zeit").fill("13:00");
  await shot("07-buero");
  await page.getByRole("button", { name: "Speichern" }).click();
  await page.locator('[data-test="gespeichert"]').waitFor();
  await eq("Neues Profil steht in der Liste", async () => page.locator(".liste b").allTextContents(), ["Erpelküken", "Flocke", "Scheepi", "Wolli", "Eichel", "Erpel", "Lola", "Manfred"]);

  await page.locator("#f-foto").setInputFiles(path.join(R, "public/icon-192.png"));
  await page.locator("form .kopf img").waitFor();
  await page.getByRole("button", { name: "Speichern" }).click();
  await page.locator('[data-test="gespeichert"]').waitFor();
  check("Foto wird als Profilbild übernommen", await sichtbar(page.locator(".liste button.an img")));

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Exportieren" }).click()]);
  const datei = path.join(SHOTS, "export.json");
  await download.saveAs(datei);
  const exp = JSON.parse(fs.readFileSync(datei, "utf8"));
  await eq("Export-Dateiname", download.suggestedFilename(), "schafland-kita-profile-2026-11-16.json");
  check("Export enthält acht Profile im Kita-Format", exp.format === "schafland-kita" && exp.version === 1 && exp.profile.length === 8);
  const flocke = exp.profile.find((p) => p.name === "Flocke");
  check("Export enthält die NFC-Anhänger", JSON.stringify(exp.tags) === JSON.stringify([{ id: "04:aa:01", profilId: "beispiel-erpel" }]), JSON.stringify(exp.tags));
  check("Export enthält das Foto", flocke?.bild.art === "foto" && flocke.bild.wert.startsWith("data:image/jpeg;base64,"));

  await page.getByRole("button", { name: "Löschen", exact: true }).click();
  await page.getByRole("button", { name: "Wirklich löschen?" }).click();
  await eq("Löschen nach Rückfrage", async () => (await page.locator(".liste b").allTextContents()).length, 7);

  await page.locator(".liste button", { hasText: "Wolli" }).click();
  await page.locator("#f-name").fill("Wolli Wolle");
  await page.getByRole("button", { name: "Speichern" }).click();
  await page.locator('[data-test="gespeichert"]').waitFor();

  await page.locator("#import-datei").setInputFiles(datei);
  await eq("Import-Vorschau zählt", async () => page.locator('[data-test="imp-zahlen"]').textContent(), "1 neu, 1 geändert, 6 gleich");
  await shot("08-import");
  await page.getByRole("button", { name: "Übernehmen" }).click();
  await eq("Import meldet Erfolg", async () => page.locator('[data-test="imp-fertig"]').textContent(), "8 Profile übernommen.");
  const liste = await page.locator(".liste b").allTextContents();
  check("Import stellt Flocke und den alten Namen wieder her", liste.includes("Flocke") && liste.includes("Wolli") && !liste.includes("Wolli Wolle"));

  const kaputt = path.join(SHOTS, "kaputt.json");
  fs.writeFileSync(kaputt, JSON.stringify({ format: "schafland-kita", version: 1, profile: [{ name: "Ohne Rolle", bild: { art: "emoji", wert: "🐑" } }] }));
  await page.locator("#import-datei").setInputFiles(kaputt);
  check("Kaputte Datei wird abgelehnt", (await page.locator('[data-test="imp-fehler"]').textContent()).includes("unbekannte Rolle"));
  await eq("… und ändert nichts", async () => (await page.locator(".liste b").allTextContents()).length, 8);

  await page.getByRole("button", { name: "Protokoll" }).click();
  await page.locator("table").waitFor();
  const zeilen = await page.locator("tbody tr").allTextContents();
  check("Protokoll von heute", zeilen.some((z) => /Wolli\s*da\s*08:12\s*14:00/.test(z.replace(/\s+/g, " "))) && zeilen.some((z) => z.includes("Erpelküken") && z.includes("13:10")), zeilen.join(" | "));
  const kuekenZeile = (await page.locator("tbody tr", { hasText: "Erpelküken" }).textContent()).replace(/\s+/g, " ");
  check("Protokoll: Abholer, Essen und Schlaf", ["Oma", "alles gegessen", "geschlafen"].every((t) => kuekenZeile.includes(t)), kuekenZeile);
  await eq("Protokoll: mit dem Anhänger abgeholt steht ohne Abholer", async () => (await page.locator("tbody tr", { hasText: "Scheepi" }).locator("td").allTextContents()).slice(5), ["–", "–", "–"]);
  await shot("09-protokoll");
  await page.getByRole("button", { name: "Einstellungen" }).click();
  await page.getByLabel("Tagesmoment 1").fill("vor dem Mittag");
  await page.getByLabel("Tagesmoment 1").blur();
  await page.getByLabel("Plan Punkt 1", { exact: true }).fill("Guten Morgen");
  await page.getByLabel("Plan Punkt 1", { exact: true }).blur();
  await page.getByRole("button", { name: "Plan Punkt 9 entfernen" }).click();
  await page.getByLabel("Abholer 6", { exact: true }).fill("Tante Trude");
  await page.getByLabel("Abholer 6", { exact: true }).blur();
  await page.locator("#s-aktion").selectOption({ label: "🎃 Kürbisfest" });
  await eq("Aktion setzt das Farbschema", async () => page.evaluate(() => document.documentElement.dataset.aktion), "kuerbisfest");
  check("Aktion wird beschrieben", (await page.locator('[data-test="aktion-text"]').textContent()).includes("Kürbishut"));
  await shot("10-einstellungen");
  await page.getByRole("button", { name: "Schließen" }).click();
  await eq("Geänderter Tagesplan auf der Startseite", async () => [await page.locator(".punkt b").first().textContent(), await page.locator(".plan .punkt").count()], ["Guten Morgen", 8]);
  await eq("Startseite nennt die Aktion", async () => (await page.locator('[data-test="aktion"]').textContent()).trim(), "🎃 Heute ist Kürbisfest!");
  check("Schafe tragen den Kürbishut", await page.locator('.brand svg ellipse[fill="#ef7a1a"]').count() === 1);
  await kachel("Wolli").click();
  await abholknopf.click();
  check("Geänderte Abholer-Auswahl", await sichtbar(dlg.locator(".wer-knopf", { hasText: "Tante Trude" })));
  await dlg.getByRole("button", { name: "Doch nicht" }).click();
  await dlg.getByRole("button", { name: "Zurück" }).click();
  await kachel("Flocke").click();
  check("Geänderter Zeitknopf erscheint im Fenster", await sichtbar(dlg.getByText("vor dem Mittag")));
  await eq("Neues Profil nutzt seine übliche Zeit", async () => dlg.locator('[data-test="zeit"]').textContent(), "13:00 Uhr");
  await dlg.getByRole("button", { name: "Zurück" }).click();

  // ---------- Mitternacht ----------
  await page.clock.fastForward("11:00:00"); // Dienstag 00:10
  await page.locator('.uhr:has-text("Dienstag")').waitFor();
  await eq("Neuer Tag: niemand ist mehr angemeldet", async () => namen("da"), []);
  await eq("Neuer Tag: mehrtägige Krankmeldung läuft weiter", async () => namen("fehlt"), ["Lola"]);
  await eq("Neuer Tag: niemand zu Hause", async () => page.locator('[data-bereich="abgeholt"]').count(), 0);
  await page.keyboard.press("Control+,");
  await page.getByRole("button", { name: "Protokoll" }).click();
  await page.getByRole("button", { name: "Tag zurück" }).click();
  await page.locator("table").waitFor();
  check("Protokoll von gestern vermerkt „nicht abgeholt“", (await page.locator("tbody tr", { hasText: "Wolli" }).textContent()).includes("nicht abgeholt"));
  await page.getByRole("button", { name: "Schließen" }).click();

  // ---------- Handy hochkant ----------
  await page.setViewportSize({ width: 390, height: 780 });
  await kachel("Scheepi").click();
  await dlg.getByRole("button", { name: "Anmelden" }).scrollIntoViewIfNeeded();
  check("Handy: Anmelden-Knopf ist erreichbar", await sichtbar(dlg.getByRole("button", { name: "Anmelden" })));
  check("Handy: kein Querrollen", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.waitForTimeout(300);
  await shot("11-handy-fenster");
  await dlg.getByRole("button", { name: "Anmelden" }).click();
  await dlg.waitFor({ state: "hidden" });
  await shot("12-handy-terminal");

  // ---------- Aktionen ----------
  await page.setViewportSize({ width: 1366, height: 768 });
  for (const [label, id, text] of [["🎪 Sommerfest", "sommerfest", "Heute ist Sommerfest!"], ["🎃 Kürbisfest", "kuerbisfest", "Heute ist Kürbisfest!"], ["🎄 Weihnachtsmarkt", "weihnachtsmarkt", "Heute ist Weihnachtsmarkt!"]]) {
    await page.keyboard.press("Control+,");
    await page.locator(".buero").getByRole("button", { name: "Einstellungen" }).click();
    await page.locator("#s-aktion").selectOption({ label });
    await page.getByRole("button", { name: "Schließen" }).click();
    await page.waitForTimeout(200);
    await shot(`20-${id}-terminal`);
    await page.reload();
    await eq(`${id}: Startbild nennt die Aktion`, async () => (await page.locator(".start .aktion").textContent()).replace(/\s+/g, " ").trim().includes(text), true);
    await eq(`${id}: Farbschema nach Neuladen`, async () => page.evaluate(() => document.documentElement.dataset.aktion), id);
    await page.waitForTimeout(300);
    await shot(`21-${id}-start`);
    await page.getByRole("button", { name: "Kita öffnen" }).click();
  }
  await page.keyboard.press("Control+,");
  await page.locator(".buero").getByRole("button", { name: "Einstellungen" }).click();
  await page.locator("#s-aktion").selectOption({ label: "Keine Aktion" });
  await eq("Ohne Aktion: normales Farbschema", async () => page.evaluate(() => document.documentElement.dataset.aktion ?? null), null);
  await page.getByRole("button", { name: "Schließen" }).click();
  check("Ohne Aktion: kein Kostüm, kein Banner", await page.locator('[data-test="aktion"]').count() === 0 && await page.locator('.brand svg ellipse[fill="#ef7a1a"]').count() === 0);

  check("Keine Fehler in der Konsole", errors.length === 0, errors.join(" | "));
} catch (err) {
  check("Testlauf ohne Abbruch", false, String(err).split("\n").slice(0, 6).join(" "));
} finally {
  await browser.close();
  try { process.kill(-server.pid); } catch {}
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} von ${results.length} bestanden`);
process.exit(failed.length ? 1 : 0);
