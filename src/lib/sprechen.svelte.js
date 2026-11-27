// Vorlesen über die Sprachausgabe des Systems (offline, keine Daten nach außen).
import { settings } from "./settings.svelte.js";

let voice = $state.raw(null);

function findeStimme() {
  const voices = globalThis.speechSynthesis?.getVoices() ?? [];
  const german = voices.filter((v) => v.lang?.toLowerCase().startsWith("de"));
  // lokale Stimmen bevorzugen (funktionieren offline, senden nichts), weibliche/freundliche zuerst
  return german.find((v) => v.localService && /hedda|katja|anna|petra|marlene|female|weiblich/i.test(v.name)) ??
    german.find((v) => v.localService) ??
    german[0] ??
    null;
}
voice = findeStimme();
globalThis.speechSynthesis?.addEventListener?.("voiceschanged", () => { voice = findeStimme(); });

/** Gibt es eine deutsche Stimme? (Linux braucht speech-dispatcher) */
export function canSpeak() {
  return !!(voice ?? findeStimme());
}

/** Sagt einen kurzen Satz an, falls die Ansage eingeschaltet ist und es eine deutsche Stimme gibt. */
export function sag(text, { immer = false } = {}) {
  if (!text || (!immer && !settings.value.ansage)) return;
  const aktuell = voice ?? findeStimme();
  if (!aktuell) return;
  const synth = globalThis.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = aktuell;
  u.lang = aktuell.lang;
  u.rate = 0.92; // etwas langsamer für Kinder
  u.pitch = 1.15;
  synth.speak(u);
}
