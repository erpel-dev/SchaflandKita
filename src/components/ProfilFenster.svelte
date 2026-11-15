<script>
  // Fenster eines Profils: anmelden mit Abholzeit, abholen, krank oder abwesend melden
  import { onMount } from "svelte";
  import Avatar from "./Avatar.svelte";
  import Uhr from "./Uhr.svelte";
  import { kita } from "../lib/kita.svelte.js";
  import { settings } from "../lib/settings.svelte.js";
  import { verschieben, datumPlus, datumLang, warteInfo } from "../lib/zeit.js";
  import { pop, hallo, tschuess, schade } from "../lib/sounds.js";
  import { sag } from "../lib/sprechen.js";

  let { id, onClose } = $props();

  let p = $derived(kita.profil(id));
  let st = $derived(kita.status(id));
  let e = $derived(kita.eintrag(id));
  let kind = $derived(p?.rolle === "kind");
  let zeiten = $derived(settings.value.zeiten);

  function startZeit() {
    const eintrag = kita.eintrag(id);
    if (eintrag?.abholzeit) return eintrag.abholzeit;
    const profil = kita.profil(id);
    if (profil?.ueblicheZeit) return profil.ueblicheZeit;
    const liste = settings.value.zeiten.map((z) => z.zeit).sort();
    return liste.find((z) => z > kita.uhrzeit) ?? liste.at(-1) ?? "15:00";
  }
  let zeit = $state(startZeit());
  let schritt = $state("haupt"); // "haupt" | "krank" | "abwesend"
  let tage = $state(0); // Meldung gilt heute + so viele weitere Tage
  let spaet = $derived(st === "da" && e?.abholzeit ? warteInfo(e.abholzeit, kita.uhrzeit) : null);

  onMount(() => {
    pop();
    if (kita.status(id) === "offen") sag(`Hallo ${p.name}!`);
  });

  function waehle(z) {
    zeit = z;
    pop();
    if (st === "da") kita.zeitAendern(id, z);
  }
  async function anmelden() {
    await kita.anmelden(id, zeit);
    hallo();
    sag(kind ? `Viel Spaß, ${p.name}!` : `Guten Morgen, ${p.name}!`);
    onClose();
  }
  async function abholen() {
    await kita.abholen(id);
    tschuess();
    sag(kind ? `Tschüss ${p.name}! Bis bald!` : `Schönen Feierabend, ${p.name}!`);
    onClose();
  }
  async function melden() {
    await kita.melden(id, schritt, datumPlus(kita.datum, tage));
    schade();
    sag(schritt === "krank" ? `Gute Besserung, ${p.name}!` : `Bis bald, ${p.name}!`);
    onClose();
  }
  async function zurueck() {
    pop();
    await (st === "abgeholt" ? kita.wiederDa(id) : kita.zuruecknehmen(id));
    zeit = startZeit();
  }
  function meldung(art) {
    pop();
    tage = 0;
    schritt = art;
  }

  const GRUSS = { offen: "Hallo", da: "Schön, dass du da bist", abgeholt: "Tschüss", krank: "Gute Besserung", abwesend: "Bis bald" };
  const LAGE = { offen: "noch nicht da", da: "im Kindergarten", abgeholt: "schon zu Hause", krank: "krank", abwesend: "nicht da" };
</script>

<svelte:window onkeydown={(ev) => ev.key === "Escape" && onClose()} />

{#if p}
  <div class="schleier" role="presentation" onclick={(ev) => ev.target === ev.currentTarget && onClose()}>
    <div class="fenster" role="dialog" aria-modal="true" aria-label={p.name}>
      <aside class="wer">
        <div class="blase">{GRUSS[st]}, {p.name}!</div>
        <Avatar bild={p.bild} farbe={p.farbe} size="9rem" />
        <b class="name">{p.name}</b>
        <span class="lage">{LAGE[st]}{#if e?.meldungBis && e.meldungBis > kita.datum}&nbsp;bis {datumLang(e.meldungBis)}{/if}</span>
        <button class="big-btn light zu" onclick={onClose}><span class="emoji">↩️</span> Zurück</button>
      </aside>

      <div class="was">
        {#if schritt !== "haupt"}
          <h3><span class="emoji">{schritt === "krank" ? "🤒" : "🏖️"}</span> {schritt === "krank" ? "Wie lange krank?" : "Wie lange nicht da?"}</h3>
          <div class="fein gross">
            <button class="rund" aria-label="Einen Tag kürzer" disabled={tage === 0} onclick={() => { tage -= 1; pop(); }}>−</button>
            <b data-test="bis">{tage === 0 ? "nur heute" : `bis ${datumLang(datumPlus(kita.datum, tage))}`}</b>
            <button class="rund" aria-label="Einen Tag länger" disabled={tage >= 14} onclick={() => { tage += 1; pop(); }}>+</button>
          </div>
          <div class="knoepfe">
            <button class="big-btn {schritt === 'krank' ? 'rot' : ''} haupt" onclick={melden}>{schritt === "krank" ? "Krank melden" : "Nicht da melden"}</button>
            <button class="big-btn light" onclick={() => (schritt = "haupt")}>Doch nicht</button>
          </div>
        {:else if st === "offen" || st === "da"}
          {#if st === "da"}
            <button class="big-btn abholen" onclick={abholen}><span class="emoji">👋</span> {kind ? "Abholen" : "Feierabend"}</button>
            {#if spaet?.ueberfaellig}<p class="spaet"><span class="emoji">⏰</span> {kind ? "wartet" : "überfällig"} seit {spaet.text.replace("wartet seit ", "")}</p>{/if}
            <h3>{kind ? "Abholzeit ändern" : "Dienstende ändern"}</h3>
          {:else}
            <h3>{kind ? "Wann wirst du abgeholt?" : "Bis wann arbeitest du heute?"}</h3>
          {/if}
          <div class="zeiten">
            {#each zeiten as z (z.zeit)}
              <button class="zeitknopf" class:an={z.zeit === zeit} aria-pressed={z.zeit === zeit} onclick={() => waehle(z.zeit)}>
                <Uhr zeit={z.zeit} size="3.2rem" />
                <span class="ziffern">{z.zeit}</span>
                <span class="moment"><span class="emoji">{z.bild}</span> {z.text}</span>
              </button>
            {/each}
          </div>
          <div class="fein">
            <button class="rund" aria-label="Früher" onclick={() => waehle(verschieben(zeit, -settings.value.schritt))}>−</button>
            <Uhr {zeit} size="2.6rem" />
            <b data-test="zeit">{zeit} Uhr</b>
            <button class="rund" aria-label="Später" onclick={() => waehle(verschieben(zeit, settings.value.schritt))}>+</button>
          </div>
          <div class="knoepfe">
            {#if st === "offen"}
              <button class="big-btn haupt" onclick={anmelden}><span class="emoji">✅</span> Anmelden</button>
              <button class="big-btn rot" onclick={() => meldung("krank")}><span class="emoji">🤒</span> Krank</button>
              <button class="big-btn light" onclick={() => meldung("abwesend")}><span class="emoji">🏖️</span> Nicht da</button>
            {:else}
              <button class="big-btn light small" onclick={zurueck}>Doch noch nicht da</button>
            {/if}
          </div>
        {:else}
          <div class="gross-bild emoji">{st === "krank" ? "🤒" : st === "abwesend" ? "🏖️" : "🏠"}</div>
          {#if st === "abgeholt"}<p class="hinweis">{e.nichtAbgeholt ? "nicht abgeholt" : `gegangen um ${e.gegangenUm} Uhr`}</p>{/if}
          <div class="knoepfe">
            <button class="big-btn haupt" onclick={zurueck}>
              {st === "krank" ? "Wieder gesund" : st === "abwesend" ? "Doch da" : "Wieder da"}
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .schleier { position: fixed; inset: 0; z-index: 20; background: rgba(42, 47, 38, 0.45); display: grid; place-items: center; padding: 1rem; }
  .fenster {
    width: min(58rem, 100%); max-height: 100%; overflow-y: auto; background: var(--wool); border-radius: 1.8rem;
    display: grid; grid-template-columns: 15rem 1fr; box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.3);
    animation: rein 0.18s ease-out;
  }
  @keyframes rein { from { transform: scale(0.92); opacity: 0; } }
  .wer { background: linear-gradient(var(--sky), var(--sky-bottom)); border-radius: 1.8rem 0 0 1.8rem; padding: 1.3rem 1rem; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; text-align: center; }
  .blase { background: #fff; border-radius: 1.2rem; padding: 0.5rem 0.9rem; font-family: var(--f-display); font-weight: 700; font-size: 1.15rem; position: relative; margin-bottom: 0.6rem; }
  .blase::after { content: ""; position: absolute; left: 50%; bottom: -0.5rem; margin-left: -0.5rem; border: 0.5rem solid transparent; border-top-color: #fff; border-bottom: 0; }
  .name { font-family: var(--f-display); font-weight: 800; font-size: 2.2rem; line-height: 1; }
  .lage { color: var(--sky-ink-soft); }
  .zu { margin-top: auto; width: 100%; }
  .was { padding: 1.3rem; display: flex; flex-direction: column; gap: 0.9rem; min-width: 0; }
  h3 { margin: 0; font-family: var(--f-display); font-weight: 800; font-size: 1.7rem; display: flex; gap: 0.5rem; align-items: center; }
  .zeiten { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.7rem; }
  .zeitknopf {
    display: grid; grid-template-columns: auto 1fr; align-items: center; column-gap: 0.6rem; row-gap: 0.2rem;
    padding: 0.6rem 0.7rem; border-radius: 1.1rem; background: #fff; border: 3px solid var(--wool-line); box-shadow: 0 0.25rem 0 var(--wool-line); text-align: left;
  }
  .zeitknopf:active { transform: translateY(0.15rem); }
  .zeitknopf.an { border-color: var(--grass); box-shadow: 0 0.25rem 0 var(--grass-dark); background: var(--ok-bg); }
  .ziffern { font-family: var(--f-display); font-weight: 800; font-size: 1.7rem; font-variant-numeric: tabular-nums; }
  .moment { grid-column: 1 / -1; font-size: 0.95rem; color: var(--ink-soft); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .fein { display: flex; align-items: center; justify-content: center; gap: 0.8rem; }
  .fein b { font-family: var(--f-display); font-weight: 800; font-size: 1.7rem; min-width: 7.5rem; text-align: center; font-variant-numeric: tabular-nums; }
  .fein.gross { padding: 1.5rem 0; }
  .fein.gross b { min-width: 16rem; font-size: 1.5rem; }
  .rund { width: 3.2rem; height: 3.2rem; border-radius: 50%; background: #fff; border: 3px solid var(--wool-line); box-shadow: 0 0.2rem 0 var(--wool-line); font-family: var(--f-display); font-weight: 800; font-size: 2rem; line-height: 1; flex: none; }
  .rund:active { transform: translateY(0.15rem); }
  .rund:disabled { opacity: 0.35; }
  .knoepfe { display: flex; gap: 0.7rem; flex-wrap: wrap; margin-top: auto; }
  .knoepfe .haupt { flex: 2 1 12rem; font-size: 1.7rem; padding: 0.9rem 1.2rem; }
  .knoepfe .big-btn:not(.haupt) { flex: 1 1 auto; }
  .abholen { font-size: 2rem; padding: 1.1rem; background: var(--sun); color: var(--ink); box-shadow: 0 0.25rem 0 #d9a520; }
  .spaet { margin: -0.3rem 0 0; font-weight: 800; color: #8a6500; text-align: center; }
  .gross-bild { font-size: 7rem; text-align: center; padding: 1rem 0 0; }
  .hinweis { text-align: center; margin: 0; color: var(--ink-soft); font-size: 1.2rem; }

  @media (max-width: 760px) {
    .fenster { grid-template-columns: 1fr; border-radius: 1.4rem; }
    .wer { border-radius: 1.4rem 1.4rem 0 0; flex-direction: row; flex-wrap: wrap; justify-content: center; padding: 0.8rem; gap: 0.3rem 0.8rem; }
    .wer :global(.avatar) { width: 4.5rem !important; height: 4.5rem !important; font-size: 4.5rem !important; }
    .blase, .lage { display: none; }
    .name { font-size: 1.8rem; }
    .zu { width: auto; margin: 0 0 0 auto; padding: 0.5rem 0.8rem; font-size: 1.1rem; }
    .was { padding: 0.9rem; }
    .zeiten { grid-template-columns: repeat(2, 1fr); }
    h3 { font-size: 1.4rem; }
    .fein.gross b { min-width: 0; flex: 1; font-size: 1.2rem; }
  }
</style>
