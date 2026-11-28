<script>
  // Fenster eines Profils: anmelden mit Abholzeit, abholen, krank, abwesend oder mit Läusen melden, Läuse-Check
  import { modal } from "../lib/modal.js";
  import { onMount } from "svelte";
  import Avatar from "./Avatar.svelte";
  import Uhr from "./Uhr.svelte";
  import Laus from "./Laus.svelte";
  import { kita } from "../lib/kita.svelte.js";
  import { settings } from "../lib/settings.svelte.js";
  import { istZeit, verschieben, datumPlus, datumLang, warteInfo } from "../lib/zeit.js";
  import { pop, hallo, tschuess, schade } from "../lib/sounds.js";
  import { sag } from "../lib/sprechen.svelte.js";
  import { tagesbericht, abholerDa } from "../lib/tagebuch.js";

  let { id, onClose, onKonflikt, perTag = false, start = "" } = $props();

  let p = $derived(kita.profil(id));
  let st = $derived(kita.status(id));
  let e = $derived(kita.eintrag(id));
  let kind = $derived(p?.rolle === "kind");
  let zeiten = $derived(settings.value.zeiten);
  // Läuse: melden nur am Läusealarm-Tag; der Check gilt immer, bis ein Erwachsener bestätigt
  let laeuseAktion = $derived(settings.value.aktion === "laeusealarm");
  let check = $derived(kita.brauchtLaeuseCheck(id));
  let haken = $state([false, false]);
  let laeuseFrei = $state(false); // gerade den Check bestanden

  function startZeit() {
    const eintrag = kita.eintrag(id);
    if (istZeit(eintrag?.abholzeit)) return eintrag.abholzeit;
    const profil = kita.profil(id);
    if (profil?.ueblicheZeit) return profil.ueblicheZeit;
    const liste = settings.value.zeiten.map((z) => z.zeit).sort();
    return liste.find((z) => z > kita.uhrzeit) ?? liste.at(-1) ?? "15:00";
  }
  let zeit = $state(startZeit());
  let abholer = $derived(settings.value.abholerFragen ? settings.value.abholer : []);
  // "haupt" | "krank" | "abwesend" | "laeuse" (Meldungen) | "check" (Läuse-Check) | "wer" (Wer holt ab?)
  function startSchritt() {
    return start === "abholen" && st === "da" && kind && abholer.length ? "wer" : "haupt";
  }
  let schritt = $state(startSchritt());
  let bericht = $derived(tagesbericht(e));
  let tage = $state(0); // Meldung gilt heute + so viele weitere Tage
  let spaet = $derived(st === "da" && istZeit(e?.abholzeit) ? warteInfo(e.abholzeit, kita.uhrzeit) : null);

  onMount(() => {
    pop();
    if (kita.status(id) === "offen") sag(`Hallo ${p.name}!`);
  });

  // Kinder tippen oft doppelt. Solange eine Aktion läuft, zählt kein weiterer Tipp;
  // sonst fände der zweite Tipp den neuen Stand vor und meldete fälschlich einen Konflikt.
  let beschaeftigt = false;
  function einmal(aktion) {
    return async (...args) => {
      if (beschaeftigt) return;
      beschaeftigt = true;
      try {
        return await aktion(...args);
      } finally {
        beschaeftigt = false;
      }
    };
  }

  function konflikt() {
    onClose();
    onKonflikt();
  }

  async function waehle(z) {
    zeit = z;
    pop();
    if (st === "da" && !(await kita.zeitAendern(id, z))) konflikt();
  }
  const anmelden = einmal(async () => {
    if (!(await kita.anmelden(id, zeit))) return konflikt();
    hallo();
    sag(kind ? `Viel Spaß, ${p.name}!` : `Guten Morgen, ${p.name}!`);
    onClose();
  });
  /** „Abholen“ angetippt: bei Tieren erst fragen, wer abholt. */
  function abholenTipp() {
    if (kind && abholer.length) {
      pop();
      schritt = "wer";
    } else abholen();
  }
  const abholen = einmal(async (von = null) => {
    if (!(await kita.abholen(id, von))) return konflikt();
    tschuess();
    sag(!kind ? `Schönen Feierabend, ${p.name}!` : von ? `Tschüss ${p.name}! ${abholerDa(von.text)}` : `Tschüss ${p.name}! Bis bald!`);
    onClose();
  });
  const melden = einmal(async () => {
    if (!(await kita.melden(id, schritt, datumPlus(kita.datum, tage)))) return konflikt();
    schade();
    sag(schritt === "krank" ? `Gute Besserung, ${p.name}!` : schritt === "laeuse" ? `Oje, Läuse! Gute Besserung, ${p.name}!` : `Bis bald, ${p.name}!`);
    onClose();
  });
  function zumCheck() {
    pop();
    haken = [false, false];
    fehltNoch = false;
    schritt = "check";
  }
  // Ein Tipp hakt nur ab: Ein Doppeltipp soll den Haken nicht gleich wieder wegnehmen.
  // Wer sich vertan hat, geht über „Doch noch Läuse“ zurück.
  let fehltNoch = $state(false); // „Ja“ zu früh angetippt: fehlende Punkte zeigen
  function hakenTipp(i) {
    if (haken[i]) return;
    pop();
    haken[i] = true;
    if (haken[0] && haken[1]) fehltNoch = false;
  }
  function jaTipp() {
    if (haken[0] && haken[1]) return checkBestanden();
    schade();
    fehltNoch = true;
  }
  const checkBestanden = einmal(async () => {
    await kita.laeuseFrei(id);
    hallo();
    sag(`Juhu, keine Läuse mehr, ${p.name}!`);
    laeuseFrei = true;
    schritt = "haupt";
    zeit = startZeit();
  });
  /** „Doch noch Läuse“: während der Meldung zurück, sonst gleich neu melden. */
  function dochLaeuse() {
    if (st === "offen") meldung("laeuse");
    else {
      pop();
      schritt = "haupt";
    }
  }
  const zurueck = einmal(async () => {
    if (st === "abgeholt") {
      // Wieder angemeldet: Fenster schließen wie beim Anmelden, nicht gleich „Abholen“ zeigen
      if (!(await kita.wiederDa(id))) return konflikt();
      hallo();
      sag(`Schön, dass du wieder da bist, ${p.name}!`);
      return onClose();
    }
    pop();
    if (!(await kita.zuruecknehmen(id))) return konflikt();
    zeit = startZeit();
  });
  /** Der Anhänger des Profils wurde noch einmal hingehalten: das Naheliegende tun. */
  export function bestaetigen() {
    if (schritt !== "haupt" && schritt !== "wer") return;
    if (st === "offen") {
      if (check) zumCheck(); // ohne Läuse-Check kein Anmelden, auch nicht per Anhänger
      else anmelden();
    }
    else if (st === "da") abholen();
  }
  function meldung(art) {
    pop();
    tage = 0;
    schritt = art;
  }

  const GRUSS = { offen: "Hallo", da: "Schön, dass du da bist", abgeholt: "Tschüss", krank: "Gute Besserung", abwesend: "Bis bald", laeuse: "Gute Besserung" };
  const LAGE = { offen: "noch nicht da", da: "im Kindergarten", abgeholt: "schon zu Hause", krank: "krank", abwesend: "nicht da", laeuse: "hat Läuse" };
  const MELDUNG = {
    krank: { titel: "Wie lange krank?", knopf: "Krank melden", farbe: "rot" },
    abwesend: { titel: "Wie lange nicht da?", knopf: "Nicht da melden", farbe: "" },
    laeuse: { titel: "Wie lange Läuse?", knopf: "Läuse melden", farbe: "laus" },
  };
</script>

{#if p}
  <dialog class="schleier" aria-label={p.name} use:modal oncancel={(ev) => { ev.preventDefault(); onClose(); }} onclick={(ev) => ev.target === ev.currentTarget && onClose()}>
    <div class="fenster">
      <aside class="wer">
        <div class="blase">{laeuseFrei && st === "offen" ? "Juhu" : GRUSS[st]}, {p.name}!</div>
        <Avatar bild={p.bild} farbe={p.farbe} size="9rem" />
        <b class="name">{p.name}</b>
        <span class="lage">{st === "offen" && check ? "hatte Läuse" : LAGE[st]}{#if e?.meldungBis && e.meldungBis > kita.datum}&nbsp;bis {datumLang(e.meldungBis)}{/if}</span>
        <button class="big-btn light zu" onclick={onClose}><span class="emoji">↩️</span> Zurück</button>
      </aside>

      <div class="was">
        {#if schritt === "wer" && st === "da"}
          <h3><span class="emoji">👋</span> Wer holt {p.name} ab?</h3>
          {#if bericht.length}
            <div class="bericht" data-test="bericht">{#each bericht as b (b.text)}<span><span class="emoji">{b.bild}</span> {b.text}</span>{/each}</div>
          {/if}
          <div class="abholer">
            {#each abholer as a}
              <button class="wer-knopf" onclick={() => abholen($state.snapshot(a))}><span class="emoji">{a.bild}</span><b>{a.text}</b></button>
            {/each}
          </div>
          <div class="knoepfe">
            <button class="big-btn light" onclick={() => abholen()}>Ohne Angabe</button>
            <button class="big-btn light" onclick={() => (schritt = "haupt")}>Doch nicht</button>
          </div>
        {:else if MELDUNG[schritt] && st === "offen"}
          <h3>{#if schritt === "laeuse"}<Laus size="2.2rem" />{:else}<span class="emoji">{schritt === "krank" ? "🤒" : "🏖️"}</span>{/if} {MELDUNG[schritt].titel}</h3>
          <div class="fein gross">
            <button class="rund" aria-label="Einen Tag kürzer" disabled={tage === 0} onclick={() => { tage -= 1; pop(); }}>−</button>
            <b data-test="bis">{tage === 0 ? "nur heute" : `bis ${datumLang(datumPlus(kita.datum, tage))}`}</b>
            <button class="rund" aria-label="Einen Tag länger" disabled={tage >= 14} onclick={() => { tage += 1; pop(); }}>+</button>
          </div>
          {#if schritt === "laeuse"}<p class="tipp laus"><span class="emoji">🔍</span> Beim Wiederkommen wird zuerst nachgeschaut, ob die Läuse weg sind.</p>{/if}
          <div class="knoepfe">
            <button class="big-btn {MELDUNG[schritt].farbe} haupt" onclick={melden}>{MELDUNG[schritt].knopf}</button>
            <button class="big-btn light" onclick={() => (schritt = "haupt")}>Doch nicht</button>
          </div>
        {:else if schritt === "check" && (st === "laeuse" || (st === "offen" && check))}
          <h3><span class="emoji">🔍</span> Hat {p.name} wirklich keine Läuse mehr?</h3>
          <div class="pruef">
            <button class:an={haken[0]} class:fehlt={fehltNoch && !haken[0]} aria-pressed={haken[0]} onclick={() => hakenTipp(0)}>
              <span class="emoji">🧴</span><span>Haare mit Läusemittel gewaschen<small>Behandlung nach Packungsbeilage</small></span><span class="haken">✓</span>
            </button>
            <button class:an={haken[1]} class:fehlt={fehltNoch && !haken[1]} aria-pressed={haken[1]} onclick={() => hakenTipp(1)}>
              <span class="emoji">🔍</span><span>Ausgekämmt und nachgeschaut<small>Mit dem Läusekamm – nichts gefunden</small></span><span class="haken">✓</span>
            </button>
          </div>
          {#if fehltNoch}
            <p class="tipp laus" role="status" data-test="check-fehlt"><span class="emoji">☝️</span> Bitte erst beide Punkte abhaken.</p>
          {:else}
            <p class="tipp ok"><span class="emoji">🧑‍🏫</span> Das bestätigt ein Erwachsener.</p>
          {/if}
          <div class="knoepfe">
            <button class="big-btn haupt" class:gesperrt={!haken[0] || !haken[1]} aria-disabled={!haken[0] || !haken[1]} onclick={jaTipp}><span class="emoji">✅</span> Ja, keine Läuse mehr</button>
            <button class="big-btn light" onclick={dochLaeuse}>Doch noch Läuse</button>
          </div>
        {:else if st === "offen" || st === "da"}
          {#if st === "da"}
            {#if spaet?.ueberfaellig}<p class="spaet"><span class="emoji">⏰</span> {kind ? "wartet" : "überfällig"} seit {spaet.text.replace("wartet seit ", "")}</p>{/if}
            <h3>{kind ? "Abholzeit ändern" : "Dienstende ändern"}</h3>
          {:else}
            {#if laeuseFrei}<p class="tipp ok" data-test="laeuse-frei"><span class="emoji">🎉</span> Läuse-Check geschafft! Jetzt anmelden.</p>{/if}
            <h3>{kind ? "Wann wirst du abgeholt?" : "Bis wann arbeitest du heute?"}</h3>
          {/if}
          <div class="zeiten">
            {#each zeiten as z}
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
          {#if perTag}<p class="tagtipp" data-test="tagtipp"><span class="emoji">🏷️</span> Anhänger noch einmal hinhalten: {st === "offen" ? (check ? "Läuse-Check" : "anmelden") : kind ? "abholen" : "Feierabend"}</p>{/if}
          {#if st === "offen" && check}<p class="tipp laus" data-test="laeuse-hinweis"><Laus size="1.5rem" /> {p.name} hatte Läuse. Vor dem Anmelden bitte nachschauen.</p>{/if}
          <div class="knoepfe">
            {#if st === "offen"}
              {#if check}
                <button class="big-btn haupt" onclick={zumCheck}><span class="emoji">🔍</span> Läuse-Check</button>
              {:else}
                <button class="big-btn haupt" onclick={anmelden}><span class="emoji">✅</span> Anmelden</button>
              {/if}
              <button class="big-btn rot" onclick={() => meldung("krank")}><span class="emoji">🤒</span> Krank</button>
              {#if laeuseAktion}<button class="big-btn laus" onclick={() => meldung("laeuse")}><Laus size="1.7rem" /> Hat Läuse</button>{/if}
              <button class="big-btn light" onclick={() => meldung("abwesend")}><span class="emoji">🏖️</span> Nicht da</button>
            {:else}
              <button class="big-btn abholen" onclick={abholenTipp}><span class="emoji">👋</span> {kind ? "Abholen" : "Feierabend"}</button>
              <button class="big-btn light small" onclick={zurueck}>Doch noch nicht da</button>
            {/if}
          </div>
        {:else}
          {#if st === "laeuse"}
            <div class="gross-bild"><Laus size="8rem" /></div>
            <p class="hinweis">{p.name} hat Läuse. Erst wenn sie weg sind, darf {p.name} wieder spielen kommen.</p>
          {:else}
            <div class="gross-bild emoji">{st === "krank" ? "🤒" : st === "abwesend" ? "🏖️" : "🏠"}</div>
          {/if}
          {#if st === "abgeholt"}
            <p class="hinweis" data-test="gegangen">{e.nichtAbgeholt ? "nicht abgeholt" : `gegangen um ${e.gegangenUm} Uhr`}{#if e.abgeholtVon}&nbsp;mit <span class="emoji">{e.abgeholtVonBild}</span> {e.abgeholtVon}{/if}</p>
            {#if bericht.length}<div class="bericht">{#each bericht as b (b.text)}<span><span class="emoji">{b.bild}</span> {b.text}</span>{/each}</div>{/if}
          {/if}
          <div class="knoepfe">
            {#if st === "laeuse"}
              <button class="big-btn haupt" onclick={zumCheck}><span class="emoji">🔍</span> Keine Läuse mehr?</button>
            {:else}
              <button class="big-btn haupt" onclick={zurueck}>
                {st === "krank" ? "Wieder gesund" : st === "abwesend" ? "Doch da" : "Wieder da"}
              </button>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </dialog>
{/if}

<style>
  .fenster {
    width: min(58rem, 100%); max-height: 100%; overflow-y: auto; background: var(--wool); border-radius: 1.8rem;
    display: grid; grid-template-columns: 15rem 1fr; box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.3);
    animation: rein 0.18s ease-out;
  }
  @keyframes rein { from { transform: scale(0.92); opacity: 0; } }
  .wer { background: linear-gradient(var(--sky), var(--sky-bottom)); border-radius: 1.8rem 0 0 1.8rem; padding: 1.3rem 1rem; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; text-align: center; }
  .blase { background: #fff; border-radius: 1.2rem; padding: 0.5rem 0.9rem; font-family: var(--f-display); font-weight: 700; font-size: 1.15rem; position: relative; margin-bottom: 0.6rem; }
  .blase::after { content: ""; position: absolute; left: 50%; bottom: -0.5rem; margin-left: -0.5rem; border: 0.5rem solid transparent; border-top-color: #fff; border-bottom: 0; }
  .name { font-family: var(--f-display); font-weight: 800; font-size: 2.2rem; line-height: 1; max-width: 100%; overflow-wrap: anywhere; }
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
  .abholen { font-size: 1.4rem; padding: 0.8rem 1.1rem; background: var(--sun); color: var(--ink); box-shadow: 0 0.25rem 0 #d9a520; }
  .spaet { margin: -0.3rem 0 0; font-weight: 800; color: #8a6500; text-align: center; }
  .tagtipp { margin: 0; text-align: center; font-weight: 800; color: var(--grass-dark); background: var(--ok-bg); border-radius: 0.9rem; padding: 0.4rem 0.8rem; }
  .bericht { display: flex; flex-wrap: wrap; gap: 0.4rem; justify-content: center; }
  .bericht > span { background: #fff; border: 2px solid var(--wool-line); border-radius: 99px; padding: 0.3rem 0.8rem; font-weight: 700; }
  .abholer { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.7rem; }
  .wer-knopf { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; padding: 0.7rem 0.4rem; border-radius: 1.1rem; background: #fff; border: 3px solid var(--wool-line); box-shadow: 0 0.25rem 0 var(--wool-line); }
  .wer-knopf:active { transform: translateY(0.15rem); }
  .wer-knopf .emoji { font-size: 2.8rem; }
  .wer-knopf b { font-family: var(--f-display); font-weight: 800; font-size: 1.15rem; line-height: 1.1; text-align: center; }
  .gross-bild { font-size: 7rem; text-align: center; padding: 1rem 0 0; }
  .hinweis { text-align: center; margin: 0; color: var(--ink-soft); font-size: 1.2rem; }
  .knoepfe .haupt { white-space: nowrap; }
  .tipp { margin: 0; text-align: center; font-weight: 800; border-radius: 0.9rem; padding: 0.5rem 0.9rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
  .tipp.laus { color: var(--laus-dark); background: var(--laus-bg); border: 2px solid #ddd0f2; }
  .tipp.ok { color: var(--grass-dark); background: var(--ok-bg); }
  .pruef { display: grid; gap: 0.7rem; }
  .pruef button { display: flex; align-items: center; gap: 0.9rem; padding: 0.8rem 1rem; border-radius: 1.1rem; background: #fff; border: 3px solid var(--wool-line); box-shadow: 0 0.25rem 0 var(--wool-line); text-align: left; font-family: var(--f-display); font-weight: 800; font-size: 1.35rem; }
  .pruef button:active { transform: translateY(0.15rem); }
  .pruef .emoji { font-size: 2.4rem; }
  .pruef small { display: block; font-family: var(--f-body); font-weight: 600; font-size: 0.95rem; color: var(--ink-soft); }
  .pruef .haken { margin-left: auto; flex: none; width: 2.4rem; height: 2.4rem; border-radius: 50%; border: 3px solid var(--wool-line); display: grid; place-items: center; font-size: 1.4rem; color: transparent; }
  .pruef .an { border-color: var(--grass); box-shadow: 0 0.25rem 0 var(--grass-dark); background: var(--ok-bg); }
  .pruef .fehlt { border-color: var(--laus); box-shadow: 0 0.25rem 0 var(--laus-dark); animation: wackeln 0.4s ease-in-out 2; }
  @keyframes wackeln { 25% { transform: translateX(-0.3rem); } 75% { transform: translateX(0.3rem); } }
  .big-btn.gesperrt { opacity: 0.45; }
  .pruef .an .haken { background: var(--grass); border-color: var(--grass-dark); color: #fff; }

  @media (max-width: 760px) {
    .fenster { grid-template-columns: 1fr; border-radius: 1.4rem; }
    .wer { border-radius: 1.4rem 1.4rem 0 0; flex-direction: row; flex-wrap: wrap; justify-content: center; padding: 0.8rem; gap: 0.3rem 0.8rem; }
    .wer :global(.avatar) { width: 4.5rem !important; height: 4.5rem !important; font-size: 4.5rem !important; }
    .blase, .lage { display: none; }
    .name { font-size: 1.8rem; }
    .zu { width: auto; margin: 0 0 0 auto; padding: 0.5rem 0.8rem; font-size: 1.1rem; }
    .was { padding: 0.9rem; }
    .zeiten, .abholer { grid-template-columns: repeat(2, 1fr); }
    .wer-knopf .emoji { font-size: 2.2rem; }
    h3 { font-size: 1.4rem; }
    .fein.gross b { min-width: 0; flex: 1; font-size: 1.2rem; }
  }
</style>
