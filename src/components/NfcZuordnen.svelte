<script>
  // Ein noch unbekannter NFC-Anhänger wurde hingehalten: Wem gehört er?
  import { modal } from "../lib/modal.js";
  import Avatar from "./Avatar.svelte";
  import { kita } from "../lib/kita.svelte.js";
  import { pop, hallo } from "../lib/sounds.js";

  let { tag, onDone, onClose } = $props();

  async function zuordnen(profilId) {
    await kita.tagZuordnen(tag, profilId);
    hallo();
    onDone(profilId);
  }
  const hatTag = (id) => kita.tags.some((t) => t.profilId === id);
</script>

<dialog class="schleier" aria-label="Neuer Anhänger" use:modal oncancel={(ev) => { ev.preventDefault(); onClose(); }} onclick={(ev) => ev.target === ev.currentTarget && onClose()}>
  <div class="fenster">
    <h3><span class="emoji gross">🏷️</span> Neuer Anhänger! Wem gehört er?</h3>
    <div class="koepfe">
      {#each kita.profile as p (p.id)}
        <button class="kopfknopf" data-profil={p.name} onclick={() => zuordnen(p.id)}>
          <Avatar bild={p.bild} farbe={p.farbe} size="4rem" /><b>{p.name}</b>
          {#if hatTag(p.id)}<span class="schon emoji" title="hat schon einen Anhänger">🏷️</span>{/if}
        </button>
      {/each}
    </div>
    <div class="knoepfe"><button class="big-btn light" onclick={() => { pop(); onClose(); }}><span class="emoji">↩️</span> Niemandem</button></div>
  </div>
</dialog>

<style>
  .fenster { width: min(46rem, 100%); max-height: 100%; overflow-y: auto; background: var(--wool); border-radius: 1.8rem; padding: 1.3rem; display: flex; flex-direction: column; gap: 0.9rem; box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.3); }
  h3 { margin: 0; font-family: var(--f-display); font-weight: 800; font-size: 1.5rem; display: flex; gap: 0.6rem; align-items: center; }
  .gross { font-size: 2.4rem; }
  .koepfe { display: flex; flex-wrap: wrap; gap: 0.6rem; }
  .kopfknopf { position: relative; display: flex; flex-direction: column; align-items: center; gap: 0.2rem; padding: 0.6rem 0.5rem; min-width: 6.4rem; border-radius: 1.1rem; background: #fff; border: 3px solid var(--wool-line); box-shadow: 0 0.25rem 0 var(--wool-line); }
  .kopfknopf:active { transform: translateY(0.15rem); }
  .kopfknopf b { font-family: var(--f-display); font-weight: 800; font-size: 1.1rem; }
  .schon { position: absolute; top: 0.2rem; right: 0.3rem; font-size: 1.2rem; }
  .knoepfe { display: flex; }
  @media (max-width: 760px) {
    .kopfknopf { min-width: 5.4rem; }
    .kopfknopf :global(.avatar) { width: 3.2rem !important; height: 3.2rem !important; font-size: 3.2rem !important; }
  }
</style>
