<script>
  import Sheep from "./Sheep.svelte";
  import Deko from "./Deko.svelte";
  import { settings } from "../lib/settings.svelte.js";
  import { aktionById, aktionen, KEINE_AKTION } from "../lib/aktionen.js";
  import { pop } from "../lib/sounds.js";
  let { onOpen } = $props();
  let aktion = $derived(aktionById(settings.value.aktion));
</script>

<div class="start">
  {#if aktion}<Deko aktion={aktion.id} big />{/if}
  <div class="hero">
    <div class="herde">
      <Sheep size="7rem" wolle="braun" class="bob spaet" />
      <Sheep size="13rem" class="bob" />
    </div>
    <h1>Schafland Kita</h1>
    <p>Hier bin ich Schaf, hier darf ich spielen</p>
  </div>
  {#if aktion}<p class="aktion"><span class="emoji">{aktion.emoji}</span> {aktion.startText} <span class="emoji">{aktion.emoji}</span></p>{/if}
  <button class="big-btn open" onclick={onOpen}>Kita öffnen</button>
  <!-- Morgens gleich festlegen, was heute ist -->
  <div class="heute" role="group" aria-label="Aktion für heute">
    <span>Heute:</span>
    {#each [KEINE_AKTION, ...aktionen] as a (a.id ?? "keine")}
      {@const an = (settings.value.aktion ?? null) === a.id}
      <button class:an aria-pressed={an} onclick={() => { pop(); settings.set({ aktion: a.id }); }}><span class="emoji">{a.emoji}</span> {a.id ? a.name : "normal"}</button>
    {/each}
  </div>
  <div class="grass"></div>
  {#if aktion}
    <div class="ground" aria-hidden="true">
      {#each aktion.ground as g, i (i)}<span class="emoji">{g}</span>{/each}
    </div>
  {/if}
</div>

<style>
  .heute { z-index: 1; display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 0.4rem; max-width: 90vw; font-family: var(--f-display); font-weight: 700; color: var(--sky-ink-soft); }
  .heute button { background: rgba(255, 255, 255, 0.8); border: 2px solid transparent; border-radius: 99px; padding: 0.3rem 0.8rem; font-family: var(--f-display); font-weight: 700; color: var(--ink); }
  .heute button.an { border-color: var(--grass); background: #fff; }
  .start { position: fixed; inset: 0; background: linear-gradient(var(--sky), var(--sky-bottom) 75%); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2rem; overflow: hidden; }
  .hero { text-align: center; display: flex; flex-direction: column; align-items: center; }
  .herde { display: flex; align-items: flex-end; }
  h1 { margin: 0; font-family: var(--f-display); font-weight: 800; font-size: 5.4rem; line-height: 0.9; color: var(--sky-ink); }
  p { margin: 0.6rem 0 0; font-family: var(--f-display); font-size: 1.9rem; color: var(--sky-ink-soft); }
  .hero { position: relative; z-index: 1; }
  .aktion { font-size: 1.7rem; font-weight: 800; margin-top: -1rem; z-index: 1; }
  .ground { position: absolute; bottom: 2.6rem; left: 0; right: 0; display: flex; justify-content: space-between; padding: 0 8%; font-size: 4.5rem; pointer-events: none; }
  .ground span:nth-child(2) { font-size: 3.2rem; align-self: flex-end; }
  .open { font-size: 2.2rem; padding: 1rem 3rem; border-radius: 1.6rem; z-index: 1; }
  .grass { position: absolute; left: 0; right: 0; bottom: 0; height: 5rem; background: var(--meadow);
    -webkit-mask: radial-gradient(circle at 1rem 0, transparent 1rem, #000 1.05rem) 0 0 / 2rem 100% repeat-x;
    mask: radial-gradient(circle at 1rem 0, transparent 1rem, #000 1.05rem) 0 0 / 2rem 100% repeat-x; }
  .hero :global(.bob) { animation: bob 3s ease-in-out infinite; }
  .hero :global(.spaet) { animation-delay: -1.2s; }
  @keyframes bob { 50% { transform: translateY(-0.5rem) rotate(-3deg); } }

  @media (max-width: 760px), (max-height: 500px) {
    .start { gap: 1.2rem; }
    h1 { font-size: clamp(2.6rem, 13vw, 4.4rem); }
    p { font-size: clamp(1.05rem, 4.6vw, 1.5rem); padding: 0 1rem; }
    .open { font-size: 1.6rem; padding: 0.8rem 2rem; }
    .aktion { font-size: 1.2rem; margin-top: -0.6rem; text-align: center; }
    .ground { font-size: 3rem; bottom: 2rem; }
    .hero :global(.bob) { width: 8rem !important; height: 8rem !important; }
    .hero :global(.spaet) { width: 4.5rem !important; height: 4.5rem !important; }
  }
  @media (max-height: 500px) {
    .start { gap: 0.6rem; }
    .hero :global(.bob) { width: 5.5rem !important; height: 5.5rem !important; }
    .hero :global(.spaet) { width: 3.2rem !important; height: 3.2rem !important; }
    .grass { height: 3rem; }
    .ground { font-size: 2.4rem; bottom: 1rem; }
  }
</style>
