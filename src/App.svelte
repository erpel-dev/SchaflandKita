<script>
  import StartScreen from "./components/StartScreen.svelte";
  import TopBar from "./components/TopBar.svelte";
  import Terminal from "./components/Terminal.svelte";
  import Uebersicht from "./components/Uebersicht.svelte";
  import Pinnwand from "./components/Pinnwand.svelte";
  import ProfilFenster from "./components/ProfilFenster.svelte";
  import Buero from "./components/Buero.svelte";
  import NfcZuordnen from "./components/NfcZuordnen.svelte";
  import { nfc } from "./lib/nfc.svelte.js";
  import { settings } from "./lib/settings.svelte.js";
  import { sortierePlan, planStand } from "./lib/tagesplan.js";
  import { aktionById } from "./lib/aktionen.js";
  import { sag } from "./lib/sprechen.js";
  import { untrack } from "svelte";
  import { kita } from "./lib/kita.svelte.js";
  import { update } from "./lib/update.svelte.js";
  import { unlockAudio, pop, hallo } from "./lib/sounds.js";

  let gestartet = $state(false);
  let ansicht = $state("terminal"); // "terminal" | "uebersicht" | "pinnwand"
  let buero = $state(false);
  let gewaehlt = $state(null); // id des Profils, dessen Fenster offen ist
  let perTag = $state(false); // das Fenster wurde mit einem NFC-Anhänger geöffnet
  let fenster = $state(null);
  let neuerTag = $state(null); // Kennung eines unbekannten Anhängers, der gerade zugeordnet wird
  let bueroTag = $state(null); // { id, n }: im Büro gelesener Anhänger
  let hinweis = $state("");
  let hinweisTimer;

  function melde(text) {
    hinweis = text;
    clearTimeout(hinweisTimer);
    hinweisTimer = setTimeout(() => (hinweis = ""), 3500);
  }
  let fensterStart = $state(""); // "abholen": Fenster gleich bei „Wer holt ab?“ öffnen
  function waehle(id, mitTag = false, start = "") {
    perTag = mitTag;
    fensterStart = start;
    gewaehlt = id;
  }

  // Aktive Aktion steuert das Farbschema (siehe app.css)
  $effect(() => {
    const id = aktionById(settings.value.aktion)?.id;
    if (id) document.documentElement.dataset.aktion = id;
    else delete document.documentElement.dataset.aktion;
  });

  // Tagesplan: ansagen, wenn ein neuer Punkt beginnt
  let planPunkt = $derived.by(() => {
    const plan = sortierePlan(settings.value.tagesplan);
    return plan[planStand(plan, kita.uhrzeit)] ?? null;
  });
  let angesagt = null;
  $effect(() => {
    const schluessel = planPunkt ? `${kita.datum} ${planPunkt.zeit} ${planPunkt.text}` : null;
    untrack(() => {
      // nur beim Wechsel während des Spielens, nicht beim Start und nicht beim Ändern im Büro
      if (angesagt !== null && schluessel && schluessel !== angesagt && gestartet && !buero && settings.value.planAnsage) {
        melde(`${planPunkt.bild} Jetzt: ${planPunkt.text}`);
        hallo();
        sag(`Jetzt ist ${planPunkt.text}!`);
      }
      angesagt = schluessel ?? "";
    });
  });

  // NFC: unbekannter Anhänger → zuordnen; bekannter → Fenster des Profils, noch einmal → bestätigen
  let tagNr = 0;
  nfc.onTag = (id) => {
    if (!gestartet) return;
    if (buero) return (bueroTag = { id, n: ++tagNr });
    if (!id) return melde("Dieser Anhänger lässt sich nicht lesen");
    const profilId = kita.tagProfil(id);
    if (!profilId) {
      if (!kita.profile.length) return melde("Noch keine Profile: zuerst im Büro eines anlegen");
      gewaehlt = null;
      neuerTag = id;
      return;
    }
    neuerTag = null;
    if (gewaehlt === profilId && fenster) fenster.bestaetigen();
    else waehle(profilId, true);
  };

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
    // Aus diesem Antippen heraus darf der Browser nach der NFC-Erlaubnis fragen
    if (settings.value.nfc) nfc.start(true);
    const aktion = aktionById(settings.value.aktion);
    if (aktion) sag(aktion.gruss);
  }
  function onKey(e) {
    // Strg + , öffnet das Büro auch mit der Tastatur
    if (e.ctrlKey && e.key === "," && gestartet) {
      e.preventDefault();
      gewaehlt = null;
      neuerTag = null;
      bueroTag = null;
      buero = true;
    }
  }
</script>

<svelte:window onkeydown={onKey} />

{#if !gestartet}
  <StartScreen onOpen={oeffnen} />
{:else}
  <div class="app">
    <TopBar {ansicht} onBuero={() => { gewaehlt = null; neuerTag = null; bueroTag = null; buero = true; }} onAnsicht={(a) => { pop(); ansicht = a; }} />
    {#if ansicht === "uebersicht"}
      <Uebersicht onSelect={(id) => waehle(id)} onAbholen={(id) => waehle(id, false, "abholen")} />
    {:else if ansicht === "pinnwand"}
      <Pinnwand />
    {:else}
      <Terminal onSelect={(id) => waehle(id)} />
    {/if}
  </div>
  {#if gewaehlt}
    {#key gewaehlt}<ProfilFenster bind:this={fenster} id={gewaehlt} {perTag} start={fensterStart} onClose={() => (gewaehlt = null)} />{/key}
  {/if}
  {#if neuerTag}
    <NfcZuordnen tag={neuerTag} onDone={(id) => { neuerTag = null; waehle(id, true); }} onClose={() => (neuerTag = null)} />
  {/if}
  {#if buero}
    <Buero tag={bueroTag} onClose={() => (buero = false)} />
  {/if}
  {#if hinweis}<div class="hinweis" role="status">{hinweis}</div>{/if}
{/if}

<style>
  .app { height: 100%; display: flex; flex-direction: column; }
  .hinweis { position: fixed; left: 50%; bottom: 1.5rem; transform: translateX(-50%); z-index: 40; background: var(--ink); color: #fff; padding: 0.7rem 1.2rem; border-radius: 99px; font-weight: 800; box-shadow: 0 0.4rem 1rem rgba(0, 0, 0, 0.3); max-width: 90vw; text-align: center; }
</style>
