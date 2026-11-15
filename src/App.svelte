<script>
  import StartScreen from "./components/StartScreen.svelte";
  import TopBar from "./components/TopBar.svelte";
  import Terminal from "./components/Terminal.svelte";
  import Uebersicht from "./components/Uebersicht.svelte";
  import Pinnwand from "./components/Pinnwand.svelte";
  import ProfilFenster from "./components/ProfilFenster.svelte";
  import Buero from "./components/Buero.svelte";
  import { kita } from "./lib/kita.svelte.js";
  import { update } from "./lib/update.svelte.js";
  import { unlockAudio, pop } from "./lib/sounds.js";

  let gestartet = $state(false);
  let ansicht = $state("terminal"); // "terminal" | "uebersicht" | "pinnwand"
  let buero = $state(false);
  let gewaehlt = $state(null); // id des Profils, dessen Fenster offen ist

  // Uhr: Abholzeiten, Wartezeiten und der Tageswechsel um Mitternacht hängen daran
  $effect(() => {
    const t = setInterval(() => kita.tick(), 10_000);
    const sichtbar = () => document.visibilityState === "visible" && kita.tick();
    document.addEventListener("visibilitychange", sichtbar);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", sichtbar);
    };
  });

  // Neue Version nur laden, solange der Startbildschirm steht (sonst über den Knopf im Büro)
  $effect(() => {
    if (update.ready && !gestartet) update.apply();
  });

  function oeffnen() {
    unlockAudio();
    pop();
    kita.tick();
    gestartet = true;
  }
  function onKey(e) {
    // Strg + , öffnet das Büro auch mit der Tastatur
    if (e.ctrlKey && e.key === "," && gestartet) {
      e.preventDefault();
      buero = true;
    }
  }
</script>

<svelte:window onkeydown={onKey} />

{#if !gestartet}
  <StartScreen onOpen={oeffnen} />
{:else}
  <div class="app">
    <TopBar {ansicht} onBuero={() => { gewaehlt = null; buero = true; }} onAnsicht={(a) => { pop(); ansicht = a; }} />
    {#if ansicht === "uebersicht"}
      <Uebersicht onSelect={(id) => (gewaehlt = id)} />
    {:else if ansicht === "pinnwand"}
      <Pinnwand />
    {:else}
      <Terminal onSelect={(id) => (gewaehlt = id)} />
    {/if}
  </div>
  {#if gewaehlt}
    {#key gewaehlt}<ProfilFenster id={gewaehlt} onClose={() => (gewaehlt = null)} />{/key}
  {/if}
  {#if buero}
    <Buero onClose={() => (buero = false)} />
  {/if}
{/if}

<style>
  .app { height: 100%; display: flex; flex-direction: column; }
</style>
