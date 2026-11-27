import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const icon = fileURLToPath(new URL("../../public/icon-192.png", import.meta.url));

export async function regression(browser, url, check) {
  const context = await browser.newContext({ viewport: { width: 320, height: 640 }, locale: "de-DE", serviceWorkers: "block" });
  const a = await context.newPage();
  const errors = [];
  context.on("page", (p) => p.on("pageerror", (e) => errors.push(e.message)));
  a.on("pageerror", (e) => errors.push(e.message));
  const button = (p, name) => p.getByRole("button", { name, exact: true });
  const tile = (p, name = "Wolli") => p.locator(`.kachel[data-profil="${name}"]`);
  const dialog = (p, name = "Wolli") => p.getByRole("dialog", { name });
  const office = (p) => p.getByRole("dialog", { name: "Büro" });
  const open = async (p) => {
    p.setDefaultTimeout(5000);
    await p.clock.install({ time: new Date(2026, 10, 16, 8, 12) });
    await p.goto(url);
    await button(p, "Kita öffnen").click();
  };
  try {
    await a.addInitScript(() => {
      globalThis.__kitaFakeNfc = { watch(onTag) {
        globalThis.__tag = (id) => onTag({ id });
        return () => (globalThis.__tag = null);
      } };
      const synth = new EventTarget();
      let voices = [];
      synth.getVoices = () => voices;
      synth.cancel = () => {};
      synth.speak = () => {};
      globalThis.SpeechSynthesisUtterance = function (text) { this.text = text; };
      Object.defineProperty(globalThis, "speechSynthesis", { value: synth });
      globalThis.__stimme = () => {
        voices = [{ name: "Anna", lang: "de-DE", localService: true }];
        synth.dispatchEvent(new Event("voiceschanged"));
      };
      const decode = globalThis.createImageBitmap;
      globalThis.createImageBitmap = async (...args) => {
        await new Promise((resolve) => (globalThis.__fotoWeiter = resolve));
        return decode(...args);
      };
    });
    await open(a);
    await button(a, "Übersicht").waitFor();
    await button(a, "Pinnwand").waitFor();
    await a.keyboard.press("Control+,");
    await office(a).waitFor();
    assert.ok(await office(a).evaluate((el) => el.scrollWidth <= el.clientWidth));
    await button(a, "Exportieren").focus();
    await a.keyboard.press("Tab");
    assert.equal(await a.evaluate(() => document.activeElement.textContent), "Importieren");
    check("Schmales Büro und Import per Tastatur", true);

    await button(a, "Einstellungen").click();
    await a.getByLabel("Zeit 2", { exact: true }).fill("12:00");
    await a.getByLabel("Zeit 2", { exact: true }).blur();
    await button(a, "+ Abholer").click();
    await button(a, "+ Abholer").click();
    await button(a, "Schließen").click();
    await tile(a).focus();
    await a.keyboard.press("Enter");
    await dialog(a).waitFor();
    assert.equal(await dialog(a).locator(".zeitknopf").count(), 6);
    await a.keyboard.press("Tab");
    assert.ok(await dialog(a).evaluate((el) => el.contains(document.activeElement)));
    check("Gleiche Uhrzeiten und Fokus im Profilfenster", true);

    await dialog(a).getByRole("button", { name: "Anmelden" }).click();
    await dialog(a).waitFor({ state: "hidden" });
    await tile(a).click();
    await dialog(a).getByRole("button", { name: "Abholen" }).click();
    assert.equal(await dialog(a).locator(".wer-knopf").filter({ hasText: "Tante" }).count(), 2);
    await button(a, "Doch nicht").click();
    await a.keyboard.press("Escape");
    await dialog(a).waitFor({ state: "hidden" });
    check("Gleichnamige Abholer und Escape", true);

    await a.evaluate(() => globalThis.__tag("04:aa:01"));
    await a.locator('button.kopfknopf[data-profil="Wolli"]').click();
    await dialog(a).getByRole("button", { name: "Zurück" }).click();
    await tile(a).click();
    await a.clock.fastForward(3000);
    await a.evaluate(() => globalThis.__tag("04:aa:01"));
    await dialog(a).locator('[data-test="tagtipp"]').waitFor();
    await a.evaluate(() => globalThis.__tag(null));
    await dialog(a).getByRole("status").getByText("Dieser Anhänger lässt sich nicht lesen").waitFor();
    assert.equal(await tile(a).evaluate((el) => el.closest("[data-bereich]").dataset.bereich), "da");
    await a.keyboard.press("Escape");
    await dialog(a).waitFor({ state: "hidden" });
    check("Erster NFC-Scan bestätigt ein manuell geöffnetes Fenster nicht", true);

    await button(a, "Übersicht").click();
    const b = await context.newPage();
    await open(b);
    await tile(b).click();
    await dialog(b).getByRole("button", { name: "Abholen" }).click();
    await dialog(b).locator(".wer-knopf").filter({ hasText: "Mama" }).click();
    await a.locator('.zeile.abgeholt[data-profil="Wolli"]').waitFor();
    await a.locator('[data-buch="Wolli"]').getByRole("button", { name: "alles gegessen" }).click();
    await b.reload();
    await button(b, "Kita öffnen").click();
    await b.locator('[data-bereich="abgeholt"] .kachel[data-profil="Wolli"]').waitFor();
    await tile(b).click();
    await dialog(b).getByText("alles gegessen").waitFor();
    await dialog(b).getByText(/mit.*Mama/).waitFor();
    check("Abholung und Tagebuch in zwei Tabs", true);

    await a.keyboard.press("Control+,");
    await a.locator("#import-datei").setInputFiles({
      name: "ohne-abholzeit.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify({
        format: "schafland-kita", version: 1,
        profile: [{ id: "test", name: "Import-Test", rolle: "kind", bild: { art: "emoji", wert: "🐑" } }],
        tage: [{ profilId: "test", datum: "2026-11-16", status: "da", gekommenUm: "08:12" }],
      })),
    });
    await office(a).getByText(/ohne gültige Abholzeit/).waitFor();
    await button(a, "Übernehmen").click();
    await a.locator('[data-test="imp-fertig"]').waitFor();
    await button(a, "+ Neues Profil").click();
    await a.locator("#f-name").fill("Foto-Test");
    await a.locator("#f-foto").setInputFiles(icon);
    assert.ok(await button(a, "Speichern").isDisabled());
    await a.evaluate(() => globalThis.__fotoWeiter());
    await a.locator("form .kopf img").waitFor();
    await button(a, "Speichern").evaluate((el) => { el.click(); el.click(); });
    await a.locator('[data-test="gespeichert"]').waitFor();
    assert.equal(await a.locator(".liste b").filter({ hasText: "Foto-Test" }).count(), 1);
    await button(a, "Schließen").click();
    await a.getByText("Abholzeit unbekannt", { exact: true }).waitFor();
    check("Import ohne Abholzeit und einmaliges Speichern nach Fotovorschau", true);

    await button(a, "Pinnwand").click();
    await a.getByRole("button", { name: "Nachricht schreiben" }).click();
    const draft = dialog(a, "Nachricht schreiben");
    await draft.locator("#n-text").fill("Entwurf bleibt erhalten");
    await a.evaluate(() => globalThis.__tag("04:bb:02"));
    await draft.getByRole("status").getByText(/halte den Anhänger noch einmal hin/).waitFor();
    assert.equal(await a.getByRole("dialog", { name: "Neuer Anhänger" }).count(), 0);
    await a.keyboard.press("Control+,");
    await office(a).waitFor();
    await a.keyboard.press("Escape");
    await office(a).waitFor({ state: "hidden" });
    assert.equal(await draft.locator("#n-text").inputValue(), "Entwurf bleibt erhalten");
    await draft.locator(".kopfknopf").filter({ hasText: "Erpel" }).click();
    await draft.getByRole("button", { name: "Anpinnen" }).evaluate((el) => { el.click(); el.click(); });
    await draft.waitFor({ state: "hidden" });
    assert.equal(await a.locator("article").count(), 1);
    await a.evaluate(() => globalThis.__stimme());
    await button(a, "Vorlesen").waitFor();
    check("Pinnwand-Entwurf, einmaliges Anpinnen und nachträglich verfügbare Stimme", true);

    await a.keyboard.press("Control+,");
    await button(a, "Nachrichten").click();
    await b.keyboard.press("Escape");
    await b.getByRole("button", { name: /^Pinnwand/ }).click();
    await b.locator("article").waitFor();
    await button(a, "Löschen").click();
    await button(a, "Wirklich löschen?").click();
    await b.locator("article").waitFor({ state: "hidden" });
    await button(a, "Schließen").click();
    await button(a, "Zurück").click();
    await tile(a, "Import-Test").click();
    await dialog(a, "Import-Test").getByRole("button", { name: "Abholen" }).click();
    await a.clock.fastForward("17:00:00");
    await dialog(a, "Import-Test").waitFor({ state: "hidden" });
    await tile(a, "Import-Test").click();
    await dialog(a, "Import-Test").getByRole("button", { name: "Anmelden" }).waitFor();
    check("Pinnwand-Synchronisierung und Schließen des Profilfensters am Tageswechsel", true);
    await a.keyboard.press("Escape");
    await tile(a, "Eichel").click();
    await b.keyboard.press("Control+,");
    await b.locator(".liste button").filter({ hasText: "Eichel" }).click();
    await button(b, "Löschen").click();
    await button(b, "Wirklich löschen?").click();
    await b.locator(".liste button").filter({ hasText: "Eichel" }).waitFor({ state: "hidden" });
    await dialog(a, "Eichel").getByRole("button", { name: "Anmelden" }).click();
    await dialog(a, "Eichel").waitFor({ state: "hidden" });
    await a.getByRole("status").getByText(/Das hat sich gerade geändert/).waitFor();
    check("Sichtbare Rückmeldung, wenn ein anderer Tab das Profil gelöscht hat", true);
    assert.deepEqual(errors, []);
  } finally {
    await context.close();
  }
}
