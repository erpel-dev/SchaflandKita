<script>
  import Sheep from "./Sheep.svelte";
  let { onOpen } = $props();
</script>

<div class="start">
  <div class="hero">
    <div class="herde">
      <Sheep size="7rem" wolle="braun" class="bob spaet" />
      <Sheep size="13rem" class="bob" />
    </div>
    <h1>Schafland Kita</h1>
    <p>Hier bin ich Schaf, hier darf ich spielen</p>
  </div>
  <button class="big-btn open" onclick={onOpen}>Kita öffnen</button>
  <div class="grass"></div>
</div>

<style>
  .start { position: fixed; inset: 0; background: linear-gradient(var(--sky), var(--sky-bottom) 75%); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2rem; overflow: hidden; }
  .hero { text-align: center; display: flex; flex-direction: column; align-items: center; }
  .herde { display: flex; align-items: flex-end; }
  h1 { margin: 0; font-family: var(--f-display); font-weight: 800; font-size: 5.4rem; line-height: 0.9; color: var(--sky-ink); }
  p { margin: 0.6rem 0 0; font-family: var(--f-display); font-size: 1.9rem; color: var(--sky-ink-soft); }
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
    .hero :global(.bob) { width: 8rem !important; height: 8rem !important; }
    .hero :global(.spaet) { width: 4.5rem !important; height: 4.5rem !important; }
  }
  @media (max-height: 500px) {
    .start { gap: 0.6rem; }
    .hero :global(.bob) { width: 5.5rem !important; height: 5.5rem !important; }
    .hero :global(.spaet) { width: 3.2rem !important; height: 3.2rem !important; }
    .grass { height: 3rem; }
  }
</style>
