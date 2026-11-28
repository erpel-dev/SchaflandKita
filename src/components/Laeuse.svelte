<script>
  // Läusealarm: ein paar Läuse krabbeln über den Bildschirm. Sie liegen über allem,
  // fangen aber keine Tipps ab. Bei „Bewegung reduzieren“ sitzen sie still.
  import Laus from "./Laus.svelte";

  const ANZAHL = 6;
  const still = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const laeuse = Array.from({ length: ANZAHL }, () => ({
    groesse: 1.5 + Math.random() * 0.8, // rem
    x: 0, y: 0,
    winkel: Math.random() * Math.PI * 2,
    tempo: 28 + Math.random() * 22, // px/s
    pause: 0,
  }));
  let feld;
  const elemente = [];

  $effect(() => {
    const breite = () => feld.clientWidth, hoehe = () => feld.clientHeight;
    for (const l of laeuse) {
      l.x = Math.random() * (breite() - 30);
      l.y = Math.random() * (hoehe() - 30);
    }
    let vorher = 0, nr = 0;
    function schritt(t) {
      const dt = vorher ? Math.min(0.05, (t - vorher) / 1000) : 0;
      vorher = t;
      const W = breite() - 20, H = hoehe() - 30;
      laeuse.forEach((l, i) => {
        if (l.pause > 0) l.pause -= dt;
        else if (dt) {
          l.winkel += (Math.random() - 0.5) * 2.4 * dt;
          if (Math.random() < 0.004) l.pause = 0.6 + Math.random() * 1.4; // kurz stehen bleiben und umschauen
          l.x += Math.sin(l.winkel) * l.tempo * dt;
          l.y -= Math.cos(l.winkel) * l.tempo * dt;
          if (l.x < -10 || l.x > W) { l.winkel = -l.winkel; l.x = Math.max(-10, Math.min(W, l.x)); }
          if (l.y < 0 || l.y > H) { l.winkel = Math.PI - l.winkel; l.y = Math.max(0, Math.min(H, l.y)); }
        }
        const el = elemente[i];
        if (!el) return;
        el.style.transform = `translate(${l.x}px, ${l.y}px) rotate(${l.winkel}rad)`;
        el.classList.toggle("steht", l.pause > 0);
      });
      if (!still) nr = requestAnimationFrame(schritt);
    }
    schritt(0);
    return () => cancelAnimationFrame(nr);
  });
</script>

<div class="laeuse" bind:this={feld} aria-hidden="true" data-test="laeuse">
  {#each laeuse as l, i (i)}
    <div class="krabbler" bind:this={elemente[i]}><Laus size="{l.groesse}rem" tippeln={!still} /></div>
  {/each}
</div>

<style>
  .laeuse { position: fixed; inset: 0; z-index: 30; pointer-events: none; overflow: hidden; }
  .krabbler { position: absolute; left: 0; top: 0; will-change: transform; filter: drop-shadow(0 0.1rem 0.08rem rgba(0, 0, 0, 0.25)); }
  .krabbler:global(.steht) :global(g) { animation-play-state: paused; } /* .steht setzt das Skript */
</style>
