<script>
  // „Welche Aktion heute?“: alle Aktionen als Bildkarten. Ein Tipp schaltet um und schließt das Fenster.
  import { modal } from "../lib/modal.js";
  import Sheep from "./Sheep.svelte";
  import { aktionen, KEINE_AKTION } from "../lib/aktionen.js";
  import { settings } from "../lib/settings.svelte.js";
  import { pop, hallo } from "../lib/sounds.js";
  import { sag } from "../lib/sprechen.svelte.js";

  let { onClose } = $props();
  const karten = [KEINE_AKTION, ...aktionen];
  let laufend = $derived(settings.value.aktion ?? null);

  function waehle(a) {
    if (a.id !== laufend) {
      settings.set({ aktion: a.id });
      if (a.id) {
        hallo();
        sag(a.gruss);
      } else pop();
    }
    onClose();
  }
</script>

<dialog class="schleier" aria-label="Welche Aktion heute?" use:modal oncancel={(ev) => { ev.preventDefault(); onClose(); }} onclick={(ev) => ev.target === ev.currentTarget && onClose()}>
  <div class="fenster">
    <div class="kopf">
      <h3><span class="emoji">🎉</span> Welche Aktion heute?</h3>
      <button class="big-btn light small" onclick={onClose}><span class="emoji">↩️</span> Zurück</button>
    </div>
    <div class="karten">
      {#each karten as a (a.id ?? "keine")}
        {@const [oben, unten, wiese] = a.vorschau}
        <button class="karte" class:an={laufend === a.id} aria-pressed={laufend === a.id} data-aktion-karte={a.id ?? "keine"} onclick={() => waehle(a)}>
          <span class="bild" style:background="linear-gradient({oben}, {unten} 70%, {wiese} 70%)"><Sheep size="5.2rem" kostuem={a.id} /></span>
          <b><span class="emoji">{a.emoji}</span> {a.name}</b>
          <small>{a.startText}</small>
          {#if laufend === a.id}<span class="laeuft">✓ läuft</span>{/if}
        </button>
      {/each}
    </div>
    <p class="hinweis"><span class="emoji">⚙️</span> Beschreibungen der Aktionen stehen im Büro unter Einstellungen.</p>
  </div>
</dialog>

<style>
  .fenster { width: min(60rem, 100%); max-height: 100%; overflow-y: auto; background: var(--wool); border-radius: 1.8rem; padding: 1.2rem 1.4rem; box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.3); display: grid; gap: 1rem; animation: rein 0.18s ease-out; }
  @keyframes rein { from { transform: scale(0.92); opacity: 0; } }
  .kopf { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
  h3 { margin: 0; font-family: var(--f-display); font-weight: 800; font-size: 1.8rem; display: flex; gap: 0.5rem; align-items: center; }
  .karten { display: grid; grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr)); gap: 0.9rem; }
  .karte { position: relative; display: flex; flex-direction: column; align-items: center; gap: 0.3rem; padding: 0.6rem 0.6rem 0.8rem; border-radius: 1.3rem; background: #fff; border: 3px solid var(--wool-line); box-shadow: 0 0.3rem 0 var(--wool-line); }
  .karte:active { transform: translateY(0.2rem); box-shadow: 0 0.1rem 0 var(--wool-line); }
  .karte.an { border-color: var(--grass); box-shadow: 0 0.3rem 0 var(--grass-dark); background: var(--ok-bg); }
  .bild { width: 100%; height: 6.5rem; border-radius: 0.9rem; display: grid; place-items: end center; overflow: hidden; }
  b { font-family: var(--f-display); font-weight: 800; font-size: 1.2rem; line-height: 1.15; text-align: center; }
  small { color: var(--ink-soft); font-size: 0.9rem; text-align: center; }
  .laeuft { position: absolute; top: 0.9rem; right: 0.9rem; background: var(--grass); color: #fff; font-weight: 800; font-size: 0.85rem; border-radius: 99px; padding: 0.15rem 0.6rem; }
  .hinweis { margin: 0; color: var(--ink-soft); text-align: center; }
  @media (max-width: 760px) {
    .fenster { padding: 0.9rem; border-radius: 1.4rem; }
    .karten { grid-template-columns: repeat(2, 1fr); gap: 0.6rem; }
    h3 { font-size: 1.35rem; }
    .bild { height: 5rem; }
    .bild :global(svg) { width: 4.2rem !important; height: 4.2rem !important; }
  }
</style>
