import "@fontsource/baloo-2/latin-500.css";
import "@fontsource/baloo-2/latin-700.css";
import "@fontsource/baloo-2/latin-800.css";
import "@fontsource/nunito/latin-600.css";
import "@fontsource/nunito/latin-700.css";
import "@fontsource/nunito/latin-800.css";
import "./app.css";
import { mount } from "svelte";
import App from "./App.svelte";
import { settings } from "./lib/settings.svelte.js";
import { kita } from "./lib/kita.svelte.js";
import { update } from "./lib/update.svelte.js";

async function boot() {
  try {
    await Promise.all([settings.load(), kita.load()]);
  } catch (err) {
    // Ohne Speicher läuft die Kita trotzdem, nur geht beim Neustart alles verloren
    console.warn("Speicher nicht verfügbar", err);
  }
  mount(App, { target: document.getElementById("app") });
  update.init();
}
boot();
