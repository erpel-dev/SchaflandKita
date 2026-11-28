<script>
  // Läusealarm: ein paar Läuse krabbeln über den Bildschirm. Antippen verscheucht sie: Die Laus flitzt
  // vom Finger weg und wird dann wieder langsam. Der Tipp auf eine Laus öffnet nichts darunter.
  // Eine Wischgeste, die auf einer Laus beginnt, scrollt dagegen die Seite darunter.
  // Bei „Bewegung reduzieren“ sitzen sie still; eine angetippte Laus springt dann an eine andere Stelle.
  import Laus from "./Laus.svelte";
  import { pop } from "../lib/sounds.js";

  const ANZAHL = 6;
  const FLUCHT = 1.2; // Sekunden, bis eine verscheuchte Laus wieder normal krabbelt
  const SPRINT = 9; // so viel schneller ist sie direkt nach dem Antippen

  // „Bewegung reduzieren“ auch dann sofort übernehmen, wenn es bei laufendem Läusealarm umgeschaltet wird
  const bewegung = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
  let still = $state(bewegung?.matches ?? false);
  $effect(() => {
    if (!bewegung) return;
    const wechsel = (ev) => (still = ev.matches);
    bewegung.addEventListener("change", wechsel);
    return () => bewegung.removeEventListener("change", wechsel);
  });
  const laeuse = Array.from({ length: ANZAHL }, () => ({
    groesse: 1.5 + Math.random() * 0.8, // rem
    x: 0, y: 0,
    winkel: Math.random() * Math.PI * 2,
    tempo: 28 + Math.random() * 22, // px/s
    pause: 0,
    flucht: 0, // verbleibende Fluchtzeit in Sekunden
  }));
  let feld;
  const elemente = [];
  let verteilt = false;

  const W = () => feld.clientWidth - 20, H = () => feld.clientHeight - 30;
  function zeichne(i) {
    const l = laeuse[i], el = elemente[i];
    if (!el) return;
    el.style.transform = `translate(${l.x}px, ${l.y}px) rotate(${l.winkel}rad)`;
    el.classList.toggle("steht", l.pause > 0);
    el.classList.toggle("flieht", l.flucht > 0);
  }

  // ---------- Tippen oder Wischen ----------
  const WISCH_PX = 8; // ab so viel Bewegung ist es kein Tipp mehr
  let geste = null; // { i, id, x, y, letzteY, letzteX, wischt, ziel }

  /** Das Element unter dem Punkt (an den Läusen vorbei), das in dieser Richtung scrollen kann. */
  function scrollZiel(x, y, senkrecht) {
    const unter = document.elementsFromPoint(x, y).find((e) => !feld.contains(e));
    for (let e = unter; e && e !== document.documentElement; e = e.parentElement) {
      const stil = getComputedStyle(e);
      const kann = senkrecht
        ? /(auto|scroll)/.test(stil.overflowY) && e.scrollHeight > e.clientHeight
        : /(auto|scroll)/.test(stil.overflowX) && e.scrollWidth > e.clientWidth;
      if (kann) return e;
    }
    return document.scrollingElement;
  }
  function runter(i, ev) {
    ev.preventDefault();
    ev.stopPropagation();
    ev.currentTarget.setPointerCapture?.(ev.pointerId);
    geste = { i, id: ev.pointerId, x: ev.clientX, y: ev.clientY, letzteX: ev.clientX, letzteY: ev.clientY, wischt: false, ziel: null };
  }
  function bewegt(ev) {
    if (!geste || ev.pointerId !== geste.id) return;
    if (!geste.wischt && Math.hypot(ev.clientX - geste.x, ev.clientY - geste.y) > WISCH_PX) {
      geste.wischt = true;
      geste.ziel = scrollZiel(geste.x, geste.y, Math.abs(ev.clientY - geste.y) >= Math.abs(ev.clientX - geste.x));
    }
    if (geste.wischt) geste.ziel?.scrollBy(geste.letzteX - ev.clientX, geste.letzteY - ev.clientY);
    geste.letzteX = ev.clientX;
    geste.letzteY = ev.clientY;
  }
  function hoch(ev) {
    if (!geste || ev.pointerId !== geste.id) return;
    const { i, x, y, wischt } = geste;
    geste = null;
    if (!wischt) scheuchen(i, x, y);
  }
  function abbruch(ev) {
    if (geste?.id === ev.pointerId) geste = null;
  }

  /** Eine Laus wurde angetippt (an x, y): weg vom Finger, so schnell es geht. */
  function scheuchen(i, x, y) {
    const l = laeuse[i];
    pop();
    if (still) {
      // ohne Bewegung: einfach woanders sitzen
      l.x = Math.random() * W();
      l.y = Math.random() * H();
      zeichne(i);
      return;
    }
    const box = elemente[i].getBoundingClientRect();
    const dx = box.left + box.width / 2 - x, dy = box.top + box.height / 2 - y;
    // Krabbelrichtung ist (sin w, −cos w); weg vom Finger, mit etwas Zufall
    l.winkel = Math.atan2(dx || Math.random() - 0.5, -(dy || Math.random() - 0.5)) + (Math.random() - 0.5) * 0.6;
    l.pause = 0;
    l.flucht = FLUCHT;
    zeichne(i);
  }

  $effect(() => {
    const ruhig = still; // bei jedem Wechsel läuft dieser Effekt neu und hält die Schleife an oder startet sie
    if (!verteilt) {
      for (const l of laeuse) {
        l.x = Math.random() * (W() - 10);
        l.y = Math.random() * H();
      }
      verteilt = true;
    }
    let vorher = 0, nr = 0;
    function schritt(t) {
      const dt = vorher ? Math.min(0.05, (t - vorher) / 1000) : 0;
      vorher = t;
      const w = W(), h = H();
      laeuse.forEach((l, i) => {
        if (ruhig) l.flucht = 0;
        if (l.pause > 0) l.pause -= dt;
        else if (dt) {
          const flieht = l.flucht > 0;
          if (flieht) l.flucht = Math.max(0, l.flucht - dt);
          else {
            l.winkel += (Math.random() - 0.5) * 2.4 * dt;
            if (Math.random() < 0.004) l.pause = 0.6 + Math.random() * 1.4; // kurz stehen bleiben und umschauen
          }
          const tempo = l.tempo * (1 + (SPRINT - 1) * (l.flucht / FLUCHT));
          l.x += Math.sin(l.winkel) * tempo * dt;
          l.y -= Math.cos(l.winkel) * tempo * dt;
          if (l.x < -10 || l.x > w) { l.winkel = -l.winkel; l.x = Math.max(-10, Math.min(w, l.x)); }
          if (l.y < 0 || l.y > h) { l.winkel = Math.PI - l.winkel; l.y = Math.max(0, Math.min(h, l.y)); }
        }
        zeichne(i);
      });
      if (!ruhig) nr = requestAnimationFrame(schritt);
    }
    schritt(0);
    return () => cancelAnimationFrame(nr);
  });
</script>

<div class="laeuse" bind:this={feld} aria-hidden="true" data-test="laeuse">
  {#each laeuse as l, i (i)}
    <div class="krabbler" bind:this={elemente[i]} onpointerdown={(ev) => runter(i, ev)} onpointermove={bewegt} onpointerup={hoch} onpointercancel={abbruch}><Laus size="{l.groesse}rem" tippeln={!still} /></div>
  {/each}
</div>

<style>
  /* Die Schicht selbst lässt Tipps durch; nur die Läuse fangen sie */
  .laeuse { position: fixed; inset: 0; z-index: 30; pointer-events: none; overflow: hidden; }
  .krabbler {
    position: absolute; left: 0; top: 0; will-change: transform; pointer-events: auto; cursor: pointer;
    touch-action: none; padding: 0.3rem; margin: -0.3rem; /* etwas größere Trefferfläche für Kinderfinger */
    filter: drop-shadow(0 0.1rem 0.08rem rgba(0, 0, 0, 0.25));
  }
  /* .steht und .flieht setzt das Skript */
  .krabbler:global(.steht) :global(g) { animation-play-state: paused; }
  .krabbler:global(.flieht) :global(g) { animation-duration: 0.07s; }
</style>
