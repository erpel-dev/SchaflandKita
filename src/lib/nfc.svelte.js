// NFC-Anhänger lesen: jeder Anhänger (Aufkleber, Schlüsselanhänger, Karte) hat eine feste Kennung,
// die einem Profil zugeordnet wird. Gelesen wird nur diese Kennung, kein Inhalt.
//  - Chrome auf Android: Web NFC (NDEFReader). Das erste Einschalten muss aus einem Antippen kommen.
//  - Andere Browser und Geräte ohne NFC: Status "fehlt".
//  - Tests: globalThis.__kitaFakeNfc = { available, granted, watch(onTag) → stop }
const fake = () => globalThis.__kitaFakeNfc;
const SPERRE_MS = 2500; // derselbe Anhänger zählt erst nach dieser Pause noch einmal

/** Kennung vereinheitlichen; null, wenn der Anhänger keine lesbare Kennung hat. */
export function tagId(roh) {
  const s = String(roh ?? "").trim().toLowerCase();
  return s && s.length <= 64 ? s : null;
}

async function lauschen(onTag) {
  const f = fake();
  if (f) return f.watch(onTag) ?? (() => {});
  const ctrl = new AbortController();
  const reader = new globalThis.NDEFReader();
  reader.onreading = (e) => onTag({ id: e.serialNumber });
  reader.onreadingerror = () => onTag({ id: null }); // z. B. Bankkarte: da, aber nicht lesbar
  await reader.scan({ signal: ctrl.signal });
  return () => ctrl.abort();
}

class Nfc {
  /** unbekannt | fehlt | antippen (erst erlauben) | erlaubt | bereit | verweigert | fehler */
  status = $state("unbekannt");
  fehler = $state("");
  /** Wird mit der Kennung (oder null für „nicht lesbar“) aufgerufen */
  onTag = null;
  #stop = null;
  #letzter = { id: null, um: 0 };

  async pruefen() {
    if (this.#stop) return (this.status = "bereit");
    const f = fake();
    if (f ? f.available === false : !("NDEFReader" in globalThis)) return (this.status = "fehlt");
    let erlaubt = f ? f.granted !== false : false;
    if (!f) {
      try {
        const p = await navigator.permissions.query({ name: "nfc" });
        if (p.state === "denied") return (this.status = "verweigert");
        erlaubt = p.state === "granted";
      } catch {
        // Berechtigungs-Abfrage nicht verfügbar: dann eben nach Antippen
      }
    }
    return (this.status = erlaubt ? "erlaubt" : "antippen");
  }

  /** Lesen einschalten. ausAntippen: der Aufruf kommt aus einer Berührung (nötig fürs erste Erlauben). */
  async start(ausAntippen = false) {
    if (this.#stop) return true;
    await this.pruefen();
    if (this.status === "fehlt" || this.status === "verweigert") return false;
    if (this.status === "antippen" && !ausAntippen) return false;
    try {
      this.#stop = await lauschen((tag) => this.#gelesen(tag));
      this.status = "bereit";
      this.fehler = "";
      return true;
    } catch (err) {
      this.status = err?.name === "NotAllowedError" ? "verweigert" : "fehler";
      this.fehler = err?.name === "NotReadableError" ? "NFC ist in den Einstellungen des Geräts ausgeschaltet" : (err?.message ?? String(err));
      return false;
    }
  }

  stop() {
    this.#stop?.();
    this.#stop = null;
    return this.pruefen();
  }

  #gelesen(tag) {
    const id = tagId(tag?.id);
    const jetzt = Date.now();
    if (id === this.#letzter.id && jetzt - this.#letzter.um < SPERRE_MS) return;
    this.#letzter = { id, um: jetzt };
    this.onTag?.(id);
  }
}

export const nfc = new Nfc();
