<script>
  // Startseite: alle Profile als große Kacheln, sortiert nach ihrem Zustand
  import Avatar from "./Avatar.svelte";
  import { kita } from "../lib/kita.svelte.js";
  import { istZeit, warteInfo } from "../lib/zeit.js";
  import { settings } from "../lib/settings.svelte.js";
  import { sortierePlan, planStand, planSatz } from "../lib/tagesplan.js";
  import { aktionById } from "../lib/aktionen.js";
  import { pop } from "../lib/sounds.js";
  import { sag } from "../lib/sprechen.svelte.js";

  let plan = $derived(sortierePlan(settings.value.tagesplan));
  let stand = $derived(planStand(plan, kita.uhrzeit));
  let aktion = $derived(aktionById(settings.value.aktion));
  function planTipp(i) {
    pop();
    sag(planSatz(plan, i, kita.uhrzeit), { immer: true });
  }

  let { onSelect } = $props();

  const BEREICHE = [
    { id: "offen", bild: "🚪", titel: "Noch nicht da", status: ["offen"] },
    { id: "da", bild: "🏫", titel: "Im Kindergarten", status: ["da"], leer: "Noch niemand da" },
    { id: "fehlt", bild: "🤒", titel: "Krank oder nicht da", status: ["krank", "abwesend"] },
    { id: "abgeholt", bild: "🏠", titel: "Schon zu Hause", status: ["abgeholt"] },
  ];

  let bereiche = $derived(
    BEREICHE.map((b) => ({
      ...b,
      profile: kita.profile
        .filter((p) => b.status.includes(kita.status(p.id)))
        .sort((x, y) => (b.id === "da" ? (kita.eintrag(x.id).abholzeit ?? "").localeCompare(kita.eintrag(y.id).abholzeit ?? "") : 0)),
    })).filter((b) => b.profile.length || b.leer),
  );
</script>

<main>
  {#if aktion}<p class="aktion" data-test="aktion"><span class="emoji">{aktion.emoji}</span> {aktion.startText}</p>{/if}
  {#if plan.length}
    <nav class="plan" aria-label="Tagesplan">
      {#each plan as punkt, i}
        <button class="punkt" class:jetzt={i === stand} class:vorbei={i < stand} aria-current={i === stand ? "time" : undefined} onclick={() => planTipp(i)}>
          <span class="emoji">{punkt.bild}</span>
          <b>{punkt.text}</b>
          <small>{punkt.zeit}</small>
        </button>
      {/each}
    </nav>
  {/if}
  {#each bereiche as b (b.id)}
    <section data-bereich={b.id}>
      <h2><span class="emoji">{b.bild}</span> {b.titel}</h2>
      {#if b.profile.length}
        <div class="raster">
          {#each b.profile as p (p.id)}
            {@const st = kita.status(p.id)}
            {@const e = kita.eintrag(p.id)}
            {@const spaet = st === "da" && istZeit(e.abholzeit) && warteInfo(e.abholzeit, kita.uhrzeit).ueberfaellig}
            <button class="kachel {st}" class:spaet data-profil={p.name} onclick={() => onSelect(p.id)}>
              {#if p.rolle === "erzieher"}<span class="rolle emoji" title="Erzieher">🧑‍🏫</span>{/if}
              <Avatar bild={p.bild} farbe={p.farbe} size="5.4rem" />
              <b>{p.name}</b>
              <span class="info">
                {#if st === "da"}<span class="emoji">{spaet ? "⏰" : "🕒"}</span> {istZeit(e.abholzeit) ? e.abholzeit : "–"}
                {:else if st === "krank"}<span class="emoji">🤒</span> krank
                {:else if st === "abwesend"}<span class="emoji">🏖️</span> nicht da
                {:else if st === "abgeholt"}<span class="emoji">👋</span> {e.gegangenUm ?? ""}
                {:else}&nbsp;{/if}
              </span>
            </button>
          {/each}
        </div>
      {:else}
        <p class="leer">{b.leer}</p>
      {/if}
    </section>
  {/each}
  {#if !kita.profile.length}
    <p class="leer gross">Noch keine Profile. Zwei Sekunden auf das Schaf oben links drücken öffnet das Büro.</p>
  {/if}
</main>

<style>
  main { flex: 1; overflow-y: auto; padding: 1.6rem 1.2rem 2rem; display: flex; flex-direction: column; gap: 1.2rem; }
  .aktion { margin: 0; text-align: center; font-family: var(--f-display); font-weight: 800; font-size: 1.5rem; color: var(--grass-dark); }
  .plan { display: flex; gap: 0.5rem; overflow-x: auto; padding: 0.2rem 0.1rem 0.5rem; flex: none; scrollbar-width: none; }
  .plan::-webkit-scrollbar { display: none; }
  .punkt { flex: 1 0 5.6rem; display: flex; flex-direction: column; align-items: center; gap: 0.1rem; padding: 0.45rem 0.3rem; border-radius: 1rem; background: #fff; border: 3px solid var(--wool-line); }
  .punkt .emoji { font-size: 1.9rem; }
  .punkt b { font-family: var(--f-display); font-weight: 700; font-size: 0.95rem; line-height: 1.1; white-space: nowrap; }
  .punkt small { font-size: 0.85rem; color: var(--ink-soft); font-variant-numeric: tabular-nums; }
  .punkt.vorbei { opacity: 0.5; }
  .punkt.jetzt { border-color: var(--sun); background: #fff8e1; box-shadow: 0 0.25rem 0 #d9a520; transform: translateY(-0.15rem); }
  .punkt.jetzt .emoji { font-size: 2.3rem; }
  h2 { margin: 0 0 0.6rem; font-family: var(--f-display); font-weight: 800; font-size: 1.5rem; display: flex; align-items: center; gap: 0.5rem; }
  .raster { display: grid; grid-template-columns: repeat(auto-fill, minmax(9.2rem, 1fr)); gap: 0.9rem; }
  .kachel {
    position: relative; display: flex; flex-direction: column; align-items: center; gap: 0.25rem;
    padding: 0.8rem 0.4rem 0.6rem; border-radius: 1.3rem; background: #fff;
    border: 3px solid var(--wool-line); box-shadow: 0 0.3rem 0 var(--wool-line);
    transition: transform 0.08s;
  }
  .kachel:active { transform: translateY(0.2rem); box-shadow: 0 0.1rem 0 var(--wool-line); }
  .kachel b { font-family: var(--f-display); font-weight: 800; font-size: 1.35rem; line-height: 1.1; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .info { font-weight: 800; font-size: 1.05rem; color: var(--ink-soft); min-height: 1.4rem; font-variant-numeric: tabular-nums; }
  .rolle { position: absolute; top: 0.4rem; right: 0.5rem; font-size: 1.3rem; }
  .kachel.da { border-color: var(--da); box-shadow: 0 0.3rem 0 var(--da-dark); background: var(--da-bg); }
  .kachel.da .info { color: var(--da-dark); }
  .kachel.da.spaet { border-color: var(--sun); box-shadow: 0 0.3rem 0 #d9a520; background: #fff8e1; }
  .kachel.da.spaet .info { color: #8a6500; }
  .kachel.da.spaet .info .emoji { display: inline-block; animation: wackeln 1s ease-in-out infinite; }
  .kachel.krank { border-color: var(--nose); box-shadow: 0 0.3rem 0 #d4788a; background: #fdf0f2; }
  .kachel.abwesend, .kachel.abgeholt { background: var(--wool-2); }
  .kachel.abwesend :global(.avatar), .kachel.abgeholt :global(.avatar) { opacity: 0.6; }
  @keyframes wackeln { 25% { transform: rotate(-14deg); } 75% { transform: rotate(14deg); } }
  .leer { margin: 0; color: var(--ink-soft); font-size: 1.1rem; }
  .leer.gross { font-size: 1.4rem; text-align: center; margin-top: 3rem; }

  @media (max-width: 760px) {
    main { padding: 1.3rem 0.7rem 1.5rem; }
    .raster { grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr)); gap: 0.6rem; }
    .kachel :global(.avatar) { width: 4.2rem !important; height: 4.2rem !important; font-size: 4.2rem !important; }
    .kachel b { font-size: 1.15rem; }
  }
</style>
