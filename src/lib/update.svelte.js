import { registerSW } from "virtual:pwa-register";

/**
 * Neue Version: Der Offline-Speicher (Service Worker) liefert beim Start zuerst die alte Version
 * und lädt die neue im Hintergrund. Sobald sie bereit ist, wird sie aktiviert, solange der
 * Startbildschirm steht; sonst über den Knopf im Büro.
 */
class Update {
  ready = $state(false);
  #activate = null;

  init() {
    if (!("serviceWorker" in navigator)) return;
    this.#activate = registerSW({ immediate: true, onNeedRefresh: () => (this.ready = true) });
  }

  apply() {
    if (this.ready && this.#activate) this.#activate(true);
  }
}

export const update = new Update();
