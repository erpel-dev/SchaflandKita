// Alle Geräusche werden mit der Web Audio API erzeugt, es gibt keine Audiodateien.
import { settings } from "./settings.svelte.js";

let ctx;

/** Muss einmal aus einer Berührung heraus aufgerufen werden (Autoplay-Regel der Browser). */
export function unlockAudio() {
  if (!globalThis.AudioContext) return false;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return true;
}

function tone(t, { type = "sine", freq, to, dur, gain = 0.22, attack = 0.01 }) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

function play(noten) {
  if (!settings.value.toene || !unlockAudio()) return;
  const t = ctx.currentTime;
  for (const [versatz, note] of noten) tone(t + versatz, note);
}

/** Kurzes "Plopp" beim Antippen. */
export const pop = () => play([[0, { freq: 520, to: 880, dur: 0.12, gain: 0.2 }]]);
/** Fröhlicher Dreiklang nach oben: angemeldet. */
export const hallo = () => play([[0, { type: "triangle", freq: 523, dur: 0.16 }], [0.13, { type: "triangle", freq: 659, dur: 0.16 }], [0.26, { type: "triangle", freq: 784, dur: 0.3 }]]);
/** Dreiklang nach unten: abgeholt, tschüss. */
export const tschuess = () => play([[0, { type: "triangle", freq: 784, dur: 0.16 }], [0.13, { type: "triangle", freq: 659, dur: 0.16 }], [0.26, { type: "triangle", freq: 523, dur: 0.3 }]]);
/** Sanfter Ton: krank oder nicht da. */
export const schade = () => play([[0, { freq: 392, to: 330, dur: 0.35, gain: 0.18 }]]);
