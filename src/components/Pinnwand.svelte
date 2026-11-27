<script>
  // Pinnwand: Erzieher schreiben Nachrichten, alle können mit einem Bildchen reagieren
  import { modal } from "../lib/modal.js";
  import { onMount } from "svelte";
  import Avatar from "./Avatar.svelte";
  import { kita } from "../lib/kita.svelte.js";
  import { REAKTIONEN, BILDER, MAX_TEXT, reaktionsGruppen } from "../lib/nachrichten.js";
  import { zeitpunktText } from "../lib/zeit.js";
  import { pop, hallo } from "../lib/sounds.js";
  import { sag, canSpeak } from "../lib/sprechen.svelte.js";

  let erzieher = $derived(kita.profile.filter((p) => p.rolle === "erzieher"));

  onMount(() => {
    kita.pinnwandGesehen();
  });

  // ---------- Schreiben ----------
  let entwurf = $state(null); // { autorId, text, bild }
  let fehler = $state("");
  let sendet = $state(false);
  function schreiben() {
    pop();
    entwurf = { autorId: erzieher.length === 1 ? erzieher[0].id : null, text: "", bild: "" };
    fehler = "";
  }
  function abbrechen() {
    if (!sendet) entwurf = null;
  }
  async function posten() {
    if (sendet) return;
    sendet = true;
    try {
      await kita.nachrichtSchreiben(entwurf.autorId, entwurf.text, entwurf.bild);
      await kita.pinnwandGesehen();
      hallo();
      entwurf = null;
    } catch (err) {
      fehler = err.message;
    } finally {
      sendet = false;
    }
  }

  // ---------- Reagieren ----------
  let wahl = $state(null); // { nachrichtId, emoji }: wartet auf „Wer bist du?“
  function reaktionWaehlen(nachrichtId, emoji) {
    pop();
    wahl = { nachrichtId, emoji };
  }
  async function reagieren(profilId) {
    await kita.reagieren(wahl.nachrichtId, profilId, wahl.emoji);
    pop();
    wahl = null;
  }
  let wahlNachricht = $derived(wahl ? kita.nachrichten.find((n) => n.id === wahl.nachrichtId) : null);

  const autor = (n) => kita.profil(n.autorId);
</script>

<main>
  <div class="kopf">
    <h2><span class="emoji">📌</span> Pinnwand</h2>
    {#if erzieher.length}
      <button class="big-btn" onclick={schreiben}><span class="emoji">✏️</span> Nachricht schreiben</button>
    {/if}
  </div>

  {#each kita.nachrichten as n (n.id)}
    {@const a = autor(n)}
    <article data-nachricht={n.text}>
      {#if n.bild}<div class="bild emoji">{n.bild}</div>{/if}
      <div class="inhalt">
        <header>
          {#if a}<Avatar bild={a.bild} farbe={a.farbe} size="2.6rem" />{/if}
          <b>{a?.name ?? n.autorName}</b>
          <small>{zeitpunktText(n.erstelltAm, kita.datum)}</small>
          {#if canSpeak()}
            <button class="vorlesen" aria-label="Vorlesen" onclick={() => sag(`${a?.name ?? n.autorName} sagt: ${n.text}`, { immer: true })}><span class="emoji">🔊</span></button>
          {/if}
        </header>
        <p>{n.text}</p>
        <div class="reaktionen">
          {#each reaktionsGruppen(n.reaktionen, kita.profile) as g (g.emoji)}
            <button class="reaktion" class:hat={g.profile.length} aria-label={`Mit ${g.emoji} reagieren`} data-anzahl={g.profile.length} onclick={() => reaktionWaehlen(n.id, g.emoji)}>
              <span class="emoji">{g.emoji}</span>
              {#each g.profile as p (p.id)}<span class="wer" title={p.name} data-wer={p.name}><Avatar bild={p.bild} farbe={p.farbe} size="1.9rem" /></span>{/each}
            </button>
          {/each}
        </div>
      </div>
    </article>
  {:else}
    <p class="leer">{erzieher.length ? "Noch keine Nachrichten. Erzieher können hier etwas für alle aufschreiben." : "Noch keine Nachrichten. Zum Schreiben braucht es ein Erzieher-Profil (im Büro anlegen)."}</p>
  {/each}
</main>

{#if entwurf}
  <dialog class="schleier pinnwand-dialog" aria-label="Nachricht schreiben" use:modal oncancel={(ev) => { ev.preventDefault(); abbrechen(); }} onclick={(ev) => ev.target === ev.currentTarget && abbrechen()}>
    <div class="fenster">
      <h3>Wer schreibt?</h3>
      <div class="koepfe">
        {#each erzieher as p (p.id)}
          <button class="kopfknopf" class:an={entwurf.autorId === p.id} aria-pressed={entwurf.autorId === p.id} onclick={() => { entwurf.autorId = p.id; pop(); }}>
            <Avatar bild={p.bild} farbe={p.farbe} size="4rem" /><b>{p.name}</b>
          </button>
        {/each}
      </div>
      <label for="n-text"><h3>Nachricht</h3></label>
      <textarea id="n-text" bind:value={entwurf.text} maxlength={MAX_TEXT} rows="3" placeholder="Was sollen alle wissen?"></textarea>
      <small class="zaehler">{entwurf.text.length} / {MAX_TEXT}</small>
      <h3>Bild dazu <small>(freiwillig)</small></h3>
      <div class="bilder">
        {#each BILDER as b (b)}
          <button class="bildknopf emoji" class:an={entwurf.bild === b} aria-pressed={entwurf.bild === b} aria-label={`Bild ${b}`} onclick={() => (entwurf.bild = entwurf.bild === b ? "" : b)}>{b}</button>
        {/each}
      </div>
      {#if fehler}<p class="err">{fehler}</p>{/if}
      <div class="knoepfe">
        <button class="big-btn" disabled={sendet || !entwurf.autorId || !entwurf.text.trim()} onclick={posten}><span class="emoji">📌</span> Anpinnen</button>
        <button class="big-btn light" disabled={sendet} onclick={abbrechen}>Abbrechen</button>
      </div>
    </div>
  </dialog>
{/if}

{#if wahl && wahlNachricht}
  <dialog class="schleier pinnwand-dialog" aria-label="Wer bist du?" use:modal oncancel={(ev) => { ev.preventDefault(); wahl = null; }} onclick={(ev) => ev.target === ev.currentTarget && (wahl = null)}>
    <div class="fenster">
      <h3><span class="emoji gross">{wahl.emoji}</span> Wer bist du?</h3>
      <div class="koepfe">
        {#each kita.profile as p (p.id)}
          {@const schon = wahlNachricht.reaktionen[p.id]}
          <button class="kopfknopf" class:an={schon === wahl.emoji} data-profil={p.name} onclick={() => reagieren(p.id)}>
            <Avatar bild={p.bild} farbe={p.farbe} size="4rem" /><b>{p.name}</b>
            {#if schon}<span class="schon emoji">{schon}</span>{/if}
          </button>
        {/each}
      </div>
      <div class="knoepfe"><button class="big-btn light" onclick={() => (wahl = null)}><span class="emoji">↩️</span> Zurück</button></div>
    </div>
  </dialog>
{/if}

<style>
  main { flex: 1; overflow-y: auto; padding: 1.6rem 1.2rem 2rem; display: flex; flex-direction: column; gap: 1rem; }
  .kopf { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
  h2 { margin: 0; font-family: var(--f-display); font-weight: 800; font-size: 1.5rem; display: flex; gap: 0.5rem; align-items: center; }
  h3 { margin: 0; font-family: var(--f-display); font-weight: 800; font-size: 1.4rem; display: flex; gap: 0.5rem; align-items: center; }
  h3 small { font-family: var(--f-body); font-weight: 600; font-size: 0.95rem; color: var(--ink-soft); }
  article { display: flex; gap: 1rem; background: #fff; border: 3px solid var(--wool-line); border-radius: 1.3rem; padding: 1rem; box-shadow: 0 0.3rem 0 var(--wool-line); }
  .bild { font-size: 4.2rem; flex: none; align-self: center; }
  .inhalt { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.5rem; }
  article header { display: flex; align-items: center; gap: 0.6rem; }
  article header b { font-family: var(--f-display); font-weight: 800; font-size: 1.3rem; }
  article header small { color: var(--ink-soft); }
  .vorlesen { margin-left: auto; width: 2.8rem; height: 2.8rem; border-radius: 50%; background: var(--sky); font-size: 1.4rem; flex: none; }
  article p { margin: 0; font-size: 1.35rem; white-space: pre-wrap; overflow-wrap: anywhere; user-select: text; -webkit-user-select: text; }
  .reaktionen { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .reaktion { display: flex; align-items: center; gap: 0.25rem; min-height: 2.9rem; padding: 0.25rem 0.7rem; border-radius: 99px; background: var(--wool-2); border: 2px solid var(--wool-line); font-size: 1.5rem; }
  .reaktion:active { transform: translateY(0.1rem); }
  .reaktion:not(.hat) .emoji { opacity: 0.55; }
  .reaktion.hat { background: var(--ok-bg); border-color: var(--grass); }
  .wer { display: inline-flex; margin-left: -0.15rem; }
  .leer { color: var(--ink-soft); font-size: 1.2rem; margin: 2rem 0; text-align: center; }

  .fenster { width: min(46rem, 100%); max-height: 100%; overflow-y: auto; background: var(--wool); border-radius: 1.8rem; padding: 1.3rem; display: flex; flex-direction: column; gap: 0.8rem; box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.3); }
  .koepfe { display: flex; flex-wrap: wrap; gap: 0.6rem; }
  .kopfknopf { position: relative; display: flex; flex-direction: column; align-items: center; gap: 0.2rem; padding: 0.6rem 0.5rem; min-width: 6.4rem; border-radius: 1.1rem; background: #fff; border: 3px solid var(--wool-line); box-shadow: 0 0.25rem 0 var(--wool-line); }
  .kopfknopf:active { transform: translateY(0.15rem); }
  .kopfknopf.an { border-color: var(--grass); box-shadow: 0 0.25rem 0 var(--grass-dark); background: var(--ok-bg); }
  .kopfknopf b { font-family: var(--f-display); font-weight: 800; font-size: 1.1rem; }
  .schon { position: absolute; top: 0.2rem; right: 0.3rem; font-size: 1.3rem; }
  .gross { font-size: 2.4rem; }
  textarea { font: inherit; font-size: 1.25rem; color: inherit; padding: 0.7rem 0.9rem; border-radius: 1rem; border: 3px solid var(--wool-line); background: #fff; resize: vertical; user-select: text; -webkit-user-select: text; }
  .zaehler { align-self: flex-end; color: var(--ink-soft); margin-top: -0.6rem; }
  .bilder { display: flex; flex-wrap: wrap; gap: 0.3rem; }
  .bildknopf { width: 3.2rem; height: 3.2rem; border-radius: 0.8rem; border: 3px solid transparent; font-size: 1.9rem; display: grid; place-items: center; }
  .bildknopf.an { border-color: var(--grass); background: var(--ok-bg); }
  .err { margin: 0; color: #a02622; font-weight: 800; }
  .knoepfe { display: flex; gap: 0.7rem; flex-wrap: wrap; margin-top: 0.3rem; }
  .knoepfe .big-btn:first-child:not(.light) { flex: 1; }

  @media (max-width: 760px) {
    main { padding: 1.3rem 0.7rem 1.5rem; }
    article { flex-direction: column; gap: 0.4rem; }
    .bild { font-size: 3rem; align-self: flex-start; }
    article p { font-size: 1.2rem; }
    .kopfknopf { min-width: 5.4rem; }
    .kopfknopf :global(.avatar) { width: 3.2rem !important; height: 3.2rem !important; font-size: 3.2rem !important; }
  }
</style>
