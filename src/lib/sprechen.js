// Vorlesen über die Sprachausgabe des Systems (offline, keine Daten nach außen).
import { settings } from "./settings.svelte.js";

let voice = null;

function pickVoice() {
  const voices = globalThis.speechSynthesis?.getVoices() ?? [];
  const german = voices.filter((v) => v.lang?.toLowerCase().startsWith("de"));
  // lokale Stimmen bevorzugen (funktionieren offline, senden nichts), weibliche/freundliche zuerst
  voice =
    german.find((v) => v.localService && /hedda|katja|anna|petra|marlene|female|weiblich/i.test(v.name)) ??
    german.find((v) => v.localService) ??
    german[0] ??
    null;
  return voice;
}
globalThis.speechSynthesis?.addEventListener?.("voiceschanged", pickVoice);

/** Gibt es eine deutsche Stimme? (Linux braucht speech-dispatcher) */
export function canSpeak() {
  return !!(globalThis.speechSynthesis && (voice ?? pickVoice()));
}

/** Sagt einen kurzen Satz an, falls die Ansage eingeschaltet ist und es eine deutsche Stimme gibt. */
export function sag(text, { immer = false } = {}) {
  if (!text || (!immer && !settings.value.ansage) || !canSpeak()) return;
  const synth = globalThis.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = 0.92; // etwas langsamer für Kinder
  u.pitch = 1.15;
  synth.speak(u);
}
