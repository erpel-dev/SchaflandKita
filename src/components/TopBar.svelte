<script>
  import Sheep from "./Sheep.svelte";
  import Deko from "./Deko.svelte";
  import { settings } from "../lib/settings.svelte.js";
  import { kita } from "../lib/kita.svelte.js";
  import { wochentag } from "../lib/zeit.js";
  import { aktionById } from "../lib/aktionen.js";
  import { pop } from "../lib/sounds.js";
  import AktionWahl from "./AktionWahl.svelte";

  // Aktion schnell wechseln: ein Tipp auf die Pille öffnet die Auswahl
  let aktion = $derived(aktionById(settings.value.aktion));
  let wahlOffen = $state(false);

  let { ansicht, onBuero, onAnsicht } = $props();

  // 2 Sekunden auf das Schaf drücken öffnet das Büro (wie der Eltern-Bereich der Schafland-Kasse)
  let pressTimer;
  let pressing = $state(false);
  function pressStart() {
    pressing = true;
    pressTimer = setTimeout(() => {
      pressing = false;
      onBuero();
    }, 2000);
  }
  function pressEnd() {
    pressing = false;
    clearTimeout(pressTimer);
  }
</script>

<header>
  <Deko aktion={settings.value.aktion} />
  <div
    class="brand"
    class:pressing
    role="button"
    tabindex="-1"
    aria-label="Lange drücken für das Büro"
    onpointerdown={pressStart}
    onpointerup={pressEnd}
    onpointerleave={pressEnd}
    onpointercancel={pressEnd}
    oncontextmenu={(e) => e.preventDefault()}
  >
    <Sheep size="3.3rem" class="logo" />
    <div>
      <b>Schafland Kita</b>
      <small>Hier bin ich Schaf, hier darf ich spielen</small>
    </div>
  </div>

  <div class="spacer"></div>

  <button class="pille" aria-label={aktion ? `Aktion: ${aktion.name}, wechseln` : "Aktion wählen"} data-test="aktion-pille" onclick={() => { pop(); wahlOffen = true; }}>
    <span class="emoji">{aktion?.emoji ?? "🎉"}</span> <span class="txt">{aktion?.name ?? "Aktion"}</span>
  </button>
  <div class="uhr" aria-label="Uhrzeit"><span class="tag">{wochentag(kita.datum)}</span> <span class="zeit">{kita.uhrzeit}</span></div>
  {#if ansicht !== "terminal"}
    <button class="pille" aria-label="Zurück" onclick={() => onAnsicht("terminal")}><span class="emoji">🏠</span> <span class="txt">Zurück</span></button>
  {/if}
  {#if ansicht !== "pinnwand"}
    <button class="pille" aria-label={kita.ungelesen ? `Pinnwand, ${kita.ungelesen} neue Nachrichten` : "Pinnwand"} onclick={() => onAnsicht("pinnwand")}>
      <span class="emoji">📌</span> <span class="txt">Pinnwand</span>
      {#if kita.ungelesen}<span class="neu" aria-label={`${kita.ungelesen} neue Nachrichten`}>{kita.ungelesen}</span>{/if}
    </button>
  {/if}
  {#if ansicht !== "uebersicht"}
    <button class="pille" aria-label="Übersicht" onclick={() => onAnsicht("uebersicht")}><span class="emoji">📋</span> <span class="txt">Übersicht</span></button>
  {/if}
</header>
{#if wahlOffen}<AktionWahl onClose={() => (wahlOffen = false)} />{/if}

<style>
  header {
    height: 4.4rem; flex: none;
    display: flex; align-items: center; gap: 1rem;
    padding: 0 1.1rem;
    background: var(--sky);
    position: relative;
  }
  header::after {
    content: ""; position: absolute; left: 0; right: 0; bottom: -0.7rem; height: 0.7rem; z-index: 2;
    background: radial-gradient(circle at 0.7rem 0, var(--sky) 0.7rem, transparent 0.72rem) 0 0 / 1.4rem 0.7rem repeat-x;
    pointer-events: none;
  }
  header > :global(:not(.deko)) { position: relative; z-index: 1; }
  .brand { display: flex; align-items: center; gap: 0.6rem; cursor: default; touch-action: none; }
  .brand :global(.logo) { transition: transform 2s linear; }
  .brand.pressing :global(.logo) { transform: rotate(360deg) scale(1.15); }
  b { font-family: var(--f-display); font-weight: 800; font-size: 2rem; line-height: 0.9; display: block; color: var(--sky-ink); }
  small { font-family: var(--f-display); font-weight: 500; font-size: 0.95rem; color: var(--sky-ink-soft); }
  .spacer { flex: 1; }
  .uhr { font-family: var(--f-display); color: var(--sky-ink); white-space: nowrap; }
  .uhr .tag { font-weight: 500; font-size: 1.1rem; color: var(--sky-ink-soft); }
  .uhr .zeit { font-weight: 800; font-size: 1.8rem; font-variant-numeric: tabular-nums; }
  .pille {
    display: flex; align-items: center; gap: 0.4rem; height: 2.9rem; padding: 0 1rem;
    background: #fff; border-radius: 99px; font-family: var(--f-display); font-weight: 800; font-size: 1.2rem;
    box-shadow: 0 0.2rem 0 rgba(0, 0, 0, 0.1);
  }
  .neu { min-width: 1.6rem; height: 1.6rem; padding: 0 0.35rem; border-radius: 99px; background: var(--danger); color: #fff; font-size: 1rem; display: grid; place-items: center; }
  .pille:active { transform: translateY(0.15rem); box-shadow: none; }

  @media (max-width: 760px), (max-height: 500px) {
    header { height: 3.6rem; padding: 0 0.7rem; gap: 0.5rem; }
    .brand :global(.logo) { width: 2.6rem !important; height: 2.6rem !important; }
    b { font-size: 1.5rem; }
    small, .uhr .tag { display: none; }
    .pille .txt { display: none; }
    .uhr .zeit { font-size: 1.4rem; }
    .pille { height: 2.5rem; padding: 0 0.7rem; }
  }
  @media (max-width: 480px) {
    b { font-size: 1.15rem; }
    .pille .txt { display: none; }
  }
</style>
