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
  await shot("02-terminal-leer");

  // ---------- Anmelden ----------
  await kachel("Wolli").click();
  const dlg = page.getByRole("dialog");
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
  await page.getByRole("button", { name: "Übersicht" }).click();
  await eq("Zähler Tiere", async () => (await page.locator('[data-test="z-tiere"]').textContent()).trim(), "2 Tiere da");
  await eq("Zähler Erzieher", async () => (await page.locator('[data-test="z-erzieher"]').textContent()).trim(), "1 Erzieher da");
  await eq("Zähler krank", async () => (await page.locator('[data-test="z-fehlen"]').textContent()).trim(), "1 krank, 0 nicht da");
  await eq("Abholliste nach Uhrzeit", async () => page.locator(".abhol .wer b").allTextContents(), ["Erpelküken", "Wolli"]);
  await eq("Überschrittene Abholzeit", async () => page.locator('.abhol[data-profil="Erpelküken"] small').textContent(), "wartet seit 40 Minuten");
  check("… ist markiert", await page.locator('.abhol[data-profil="Erpelküken"].spaet').count() === 1);
  await eq("Restzeit bis zur Abholung", async () => page.locator('.abhol[data-profil="Wolli"] small').textContent(), "in 50 Minuten");
  await eq("Erzieher-Zeile krank mehrtägig", async () => page.locator('.zeile[data-profil="Lola"] small').textContent(), "krank bis Mittwoch, 18. November");
  await shot("05-uebersicht");
  await page.locator('.abhol[data-profil="Erpelküken"]').getByRole("button", { name: "Abholen" }).click();
  await eq("Abholen aus der Liste checkt aus", async () => page.locator(".abhol .wer b").allTextContents(), ["Wolli"]);
  await eq("… und steht bei den weiteren Tieren", async () => page.locator('.zeile[data-profil="Erpelküken"] small').textContent(), "gegangen 13:10");
  await page.getByRole("button", { name: "Zurück" }).click();
  await eq("Schon zu Hause", async () => namen("abgeholt"), ["Erpelküken"]);

  // ---------- Abholen im Fenster, zurücknehmen ----------
  await kachel("Erpelküken").click();
  await dlg.getByRole("button", { name: "Wieder da" }).click();
  check("Wieder da zeigt den Abholen-Knopf", await sichtbar(dlg.getByRole("button", { name: "Abholen" })));
  check("… und die überschrittene Zeit", await sichtbar(dlg.locator(".spaet")));
  await page.waitForTimeout(300);
  await shot("06-abholen");
  await dlg.getByRole("button", { name: "Abholen" }).click();
  await dlg.waitFor({ state: "hidden" });
  await eq("Wieder abgeholt", async () => namen("abgeholt"), ["Erpelküken"]);

  // ---------- Neu laden: alles bleibt gespeichert ----------
  await page.reload();
  await page.getByRole("button", { name: "Kita öffnen" }).click();
  await eq("Nach Neuladen: im Kindergarten", async () => namen("da"), ["Wolli", "Erpel"]);
  await eq("Nach Neuladen: krank", async () => namen("fehlt"), ["Lola"]);

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
  await shot("09-protokoll");
  await page.getByRole("button", { name: "Einstellungen" }).click();
  await page.getByLabel("Tagesmoment 1").fill("vor dem Mittag");
  await page.getByLabel("Tagesmoment 1").blur();
  await shot("10-einstellungen");
  await page.getByRole("button", { name: "Schließen" }).click();
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
