<script>
  // Übersicht für Erzieher: wer ist da, wer wird wann abgeholt, wer fehlt
  import Avatar from "./Avatar.svelte";
  import { kita } from "../lib/kita.svelte.js";
  import { warteInfo, datumLang } from "../lib/zeit.js";
  import { tschuess } from "../lib/sounds.js";

  let { onSelect } = $props();

  let kinder = $derived(kita.profile.filter((p) => p.rolle === "kind"));
  let erzieher = $derived(kita.profile.filter((p) => p.rolle === "erzieher"));
  const zahl = (liste, ...status) => liste.filter((p) => status.includes(kita.status(p.id))).length;

  let abholliste = $derived(
    kinder
      .filter((p) => kita.status(p.id) === "da")
      .map((p) => ({ p, e: kita.eintrag(p.id), w: warteInfo(kita.eintrag(p.id).abholzeit, kita.uhrzeit) }))
      .sort((a, b) => a.e.abholzeit.localeCompare(b.e.abholzeit) || a.p.name.localeCompare(b.p.name, "de")),
  );
  let andere = $derived(kinder.filter((p) => kita.status(p.id) !== "da"));

  function lage(p) {
    const e = kita.eintrag(p.id);
    const bis = e?.meldungBis && e.meldungBis > kita.datum ? ` bis ${datumLang(e.meldungBis)}` : "";
    switch (kita.status(p.id)) {
      case "da": return `da bis ${e.abholzeit}`;
      case "abgeholt": return e.nichtAbgeholt ? "nicht abgeholt" : `gegangen ${e.gegangenUm}`;
      case "krank": return `krank${bis}`;
      case "abwesend": return `nicht da${bis}`;
      default: return "noch nicht da";
    }
  }
  async function abholen(id) {
    await kita.abholen(id);
    tschuess();
  }
</script>

<main>
  <div class="zaehler">
    <span class="chip gut" data-test="z-tiere"><b>{zahl(kinder, "da")}</b> {zahl(kinder, "da") === 1 ? "Tier" : "Tiere"} da</span>
    <span class="chip gut" data-test="z-erzieher"><b>{zahl(erzieher, "da")}</b> Erzieher da</span>
    <span class="chip" data-test="z-fehlen"><b>{zahl(kita.profile, "krank")}</b> krank, <b>{zahl(kita.profile, "abwesend")}</b> nicht da</span>
    <span class="chip" data-test="z-offen"><b>{zahl(kinder, "offen")}</b> noch nicht da</span>
  </div>

  <div class="spalten">
    <section>
      <h2><span class="emoji">🕒</span> Abholliste</h2>
      {#each abholliste as { p, e, w } (p.id)}
        <div class="zeile abhol" class:spaet={w.ueberfaellig} data-profil={p.name}>
          <b class="zeit">{e.abholzeit}</b>
          <button class="wer" onclick={() => onSelect(p.id)}>
            <Avatar bild={p.bild} farbe={p.farbe} size="2.8rem" />
            <span><b>{p.name}</b><small>{w.text}</small></span>
          </button>
          <button class="big-btn small" onclick={() => abholen(p.id)}>Abholen</button>
        </div>
      {:else}
        <p class="leer">Gerade ist kein Tier angemeldet.</p>
      {/each}

      {#if andere.length}
        <h2 class="zwei"><span class="emoji">🐑</span> Weitere Tiere</h2>
        {#each andere as p (p.id)}
          <button class="zeile {kita.status(p.id)}" data-profil={p.name} onclick={() => onSelect(p.id)}>
            <Avatar bild={p.bild} farbe={p.farbe} size="2.2rem" />
            <b>{p.name}</b>
            <small>{lage(p)}</small>
          </button>
        {/each}
      {/if}
    </section>

    <section>
      <h2><span class="emoji">🧑‍🏫</span> Erzieher</h2>
      {#each erzieher as p (p.id)}
        <button class="zeile {kita.status(p.id)}" data-profil={p.name} onclick={() => onSelect(p.id)}>
          <Avatar bild={p.bild} farbe={p.farbe} size="2.2rem" />
          <b>{p.name}</b>
          <small>{lage(p)}</small>
        </button>
      {:else}
        <p class="leer">Keine Erzieher angelegt.</p>
      {/each}
    </section>
  </div>
</main>

<style>
  main { flex: 1; overflow-y: auto; padding: 1.6rem 1.2rem 2rem; }
  .zaehler { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-bottom: 1.2rem; }
  .chip { padding: 0.45rem 1rem; border-radius: 99px; background: #fff; border: 2px solid var(--wool-line); font-size: 1.1rem; }
  .chip b { font-family: var(--f-display); font-weight: 800; font-size: 1.3rem; }
  .chip.gut { background: var(--ok-bg); border-color: var(--grass); }
  .spalten { display: grid; grid-template-columns: 3fr 2fr; gap: 1.5rem; align-items: start; }
  h2 { margin: 0 0 0.6rem; font-family: var(--f-display); font-weight: 800; font-size: 1.5rem; display: flex; gap: 0.5rem; align-items: center; }
  h2.zwei { margin-top: 1.4rem; }
  .zeile {
    width: 100%; display: flex; align-items: center; gap: 0.8rem; padding: 0.5rem 0.8rem; margin-bottom: 0.5rem;
    background: #fff; border: 2px solid var(--wool-line); border-radius: 1rem; text-align: left;
  }
  .zeile > b { font-family: var(--f-display); font-weight: 800; font-size: 1.25rem; }
  .zeile small { margin-left: auto; color: var(--ink-soft); font-size: 1rem; text-align: right; }
  .zeile.da { background: var(--ok-bg); border-color: var(--grass); }
  .zeile.krank { background: #fdf0f2; border-color: var(--nose); }
  .zeile.abwesend, .zeile.abgeholt { background: var(--wool-2); }
  .abhol .zeit { font-family: var(--f-display); font-weight: 800; font-size: 1.7rem; min-width: 4.6rem; font-variant-numeric: tabular-nums; }
  .abhol .wer { flex: 1; display: flex; align-items: center; gap: 0.7rem; text-align: left; min-width: 0; }
  .abhol .wer span { display: flex; flex-direction: column; min-width: 0; }
  .abhol .wer b { font-family: var(--f-display); font-weight: 800; font-size: 1.3rem; line-height: 1.1; }
  .abhol .wer small { margin: 0; text-align: left; }
  .abhol.spaet { background: #fff8e1; border-color: var(--sun); }
  .abhol.spaet .wer small { color: #8a6500; font-weight: 800; }
  .leer { color: var(--ink-soft); margin: 0 0 0.5rem; }

  @media (max-width: 760px) {
    main { padding: 1.3rem 0.7rem 1.5rem; }
    .spalten { grid-template-columns: 1fr; }
    .abhol .zeit { font-size: 1.4rem; min-width: 3.8rem; }
  }
</style>
