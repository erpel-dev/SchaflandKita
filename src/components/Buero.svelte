<script>
  // Büro (für Erwachsene): Profile anlegen und ändern, Import/Export, Protokoll, Einstellungen
  import Avatar from "./Avatar.svelte";
  import Sheep from "./Sheep.svelte";
  import Toggle from "./Toggle.svelte";
  import { kita } from "../lib/kita.svelte.js";
  import { settings, STANDARD_ZEITEN } from "../lib/settings.svelte.js";
  import { update } from "../lib/update.svelte.js";
  import { FARBEN, WOLLE, exportDaten, pruefeImport, vorschau } from "../lib/profile-io.js";
  import { datumPlus, datumLang, istZeit, zeitpunktText } from "../lib/zeit.js";
  import { fotoVerkleinern, herunterladen } from "../lib/foto.js";
  import { sag, canSpeak } from "../lib/sprechen.js";
  import { nfc } from "../lib/nfc.svelte.js";

  let { onClose, tag = null } = $props();
  let tab = $state("profile");

  // ---------- Profile ----------
  const EMOJIS = ["🐑", "🐏", "🐐", "🦆", "🐥", "🐣", "🐻", "🐰", "🐿️", "🦊", "🐱", "🐶", "🐭", "🐷", "🐮", "🐴", "🦁", "🐯", "🐼", "🐨", "🐸", "🐧", "🦉", "🦔", "🐘", "🦒", "🐢", "🦄", "🐲", "🧸"];
  let form = $state(null);
  let fehler = $state("");
  let gespeichert = $state(false);
  let loeschFrage = $state(false);

  function neu() {
    form = { id: null, rolle: "kind", name: "", bild: { art: "schaf", wert: "weiss" }, farbe: FARBEN[0], ueblicheZeit: "", notiz: "" };
    fehler = ""; gespeichert = false; loeschFrage = false;
  }
  function bearbeiten(p) {
    form = { ...$state.snapshot(p), ueblicheZeit: p.ueblicheZeit ?? "" };
    fehler = ""; gespeichert = false; loeschFrage = false;
  }
  async function speichern() {
    try {
      const p = await kita.profilSpeichern($state.snapshot(form));
      bearbeiten(p);
      gespeichert = true;
      setTimeout(() => (gespeichert = false), 2500);
    } catch (err) {
      fehler = err.message;
    }
  }
  async function loeschen() {
    if (!loeschFrage) return (loeschFrage = true);
    await kita.profilLoeschen(form.id);
    form = null;
  }
  async function foto(ev) {
    const datei = ev.currentTarget.files?.[0];
    ev.currentTarget.value = "";
    if (!datei) return;
    try {
      form.bild = { art: "foto", wert: await fotoVerkleinern(datei) };
    } catch {
      fehler = "Das Bild konnte nicht gelesen werden";
    }
  }

  // ---------- Import und Export ----------
  let mitProtokoll = $state(false);
  let imp = $state(null); // { profile, tage, v } nach dem Einlesen, vor dem Übernehmen
  let impFehler = $state("");
  let impModus = $state("zusammenfuehren");
  let impFertig = $state("");

  async function exportieren() {
    const daten = exportDaten($state.snapshot(kita.profile), { tage: mitProtokoll ? await kita.alleTage() : null, tags: $state.snapshot(kita.tags) });
    herunterladen(`schafland-kita-profile-${kita.datum}.json`, JSON.stringify(daten, null, 2));
  }
  async function einlesen(ev) {
    const datei = ev.currentTarget.files?.[0];
    ev.currentTarget.value = "";
    imp = null; impFehler = ""; impFertig = "";
    if (!datei) return;
    let daten;
    try {
      daten = JSON.parse(await datei.text());
    } catch {
      impFehler = "Die Datei ist kein gültiges JSON";
      return;
    }
    const r = pruefeImport(daten);
    if (!r.ok) return (impFehler = r.fehler);
    imp = { profile: r.profile, tage: r.tage, tags: r.tags, v: vorschau($state.snapshot(kita.profile), r.profile) };
    impModus = "zusammenfuehren";
  }
  async function uebernehmen() {
    const n = imp.profile.length;
    await kita.importieren(imp.profile, impModus, imp.tage, imp.tags);
    imp = null; form = null;
    impFertig = `${n} ${n === 1 ? "Profil" : "Profile"} übernommen`;
  }

  // ---------- Protokoll ----------
  let pDatum = $state(kita.datum);
  let pZeilen = $state([]);
  const STATUS_TEXT = { offen: "noch nicht da", da: "da", abgeholt: "abgeholt", krank: "krank", abwesend: "nicht da" };
  $effect(() => {
    if (tab !== "protokoll") return;
    const datum = pDatum;
    kita.protokoll(datum).then((rows) => {
      if (datum !== pDatum) return;
      pZeilen = rows
        .map((e) => ({ ...e, name: kita.profil(e.profilId)?.name ?? "(gelöscht)" }))
        .sort((a, b) => a.name.localeCompare(b.name, "de"));
    });
  });

  // ---------- Nachrichten ----------
  let nLoeschFrage = $state(null); // id der Nachricht, bei der schon einmal „Löschen“ gedrückt wurde
  async function nachrichtLoeschen(id) {
    if (nLoeschFrage !== id) return (nLoeschFrage = id);
    await kita.nachrichtLoeschen(id);
    nLoeschFrage = null;
  }

  // ---------- NFC-Anhänger ----------
  const NFC_TEXT = {
    unbekannt: "wird geprüft …",
    fehlt: "Dieses Gerät oder dieser Browser kann keine NFC-Anhänger lesen. Es geht mit Chrome auf einem Android-Gerät mit NFC.",
    antippen: "NFC ist noch nicht erlaubt.",
    erlaubt: "NFC ist erlaubt, aber gerade ausgeschaltet.",
    bereit: "Bereit: Anhänger ans Gerät halten.",
    verweigert: "NFC wurde nicht erlaubt. In den Website-Einstellungen des Browsers lässt es sich wieder erlauben.",
    fehler: "NFC lässt sich nicht einschalten.",
  };
  let gelesen = $state(null); // Kennung des zuletzt im Büro hingehaltenen Anhängers
  let nfcHinweis = $state("");
  let tagListe = $derived(
    kita.tags
      .map((t) => ({ ...t, name: kita.profil(t.profilId)?.name ?? "" }))
      .sort((a, b) => a.name.localeCompare(b.name, "de") || a.id.localeCompare(b.id)),
  );
  $effect(() => {
    nfc.pruefen();
  });
  // Im Büro hingehaltener Anhänger: zum NFC-Reiter springen und ihn dort zeigen
  $effect(() => {
    if (!tag) return;
    tab = "nfc";
    gelesen = tag.id;
    nfcHinweis = tag.id ? "" : "Dieser Anhänger lässt sich nicht lesen.";
  });
  async function nfcSchalten(an) {
    await settings.set({ nfc: an });
    if (an) nfc.start(true);
    else nfc.stop();
  }
  async function tagSetzen(id, profilId) {
    if (profilId) await kita.tagZuordnen(id, profilId);
  }
  async function tagAufheben(id) {
    await kita.tagAufheben(id);
    if (gelesen === id) gelesen = null;
  }

  // ---------- Einstellungen ----------
  function zeitSetzen(i, feld, wert) {
    if (feld === "zeit" && !istZeit(wert)) return;
    const zeiten = $state.snapshot(settings.value.zeiten);
    zeiten[i] = { ...zeiten[i], [feld]: wert };
    settings.set({ zeiten });
  }
  function vollbild() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }
</script>

<div class="buero">
  <header>
    <Sheep size="2.6rem" />
    <div><b>Büro</b><small>Version {__APP_VERSION__}</small></div>
    <nav>
      {#each [["profile", "Profile"], ["protokoll", "Protokoll"], ["nachrichten", "Nachrichten"], ["nfc", "NFC"], ["einstellungen", "Einstellungen"]] as [id, name] (id)}
        <button class:an={tab === id} onclick={() => (tab = id)}>{name}</button>
      {/each}
    </nav>
    <button class="big-btn light small" onclick={onClose}>Schließen</button>
  </header>

  {#if tab === "profile"}
    <div class="leiste">
      <button class="big-btn small" onclick={neu}>+ Neues Profil</button>
      <span class="spacer"></span>
      <label class="check"><input type="checkbox" bind:checked={mitProtokoll} /> mit Protokoll</label>
      <button class="big-btn light small" onclick={exportieren}>Exportieren</button>
      <label class="big-btn light small">Importieren<input id="import-datei" type="file" accept=".json,application/json" hidden onchange={einlesen} /></label>
    </div>

    {#if impFehler}<p class="meldung err" data-test="imp-fehler">Import nicht möglich: {impFehler}. Es wurde nichts geändert.</p>{/if}
    {#if impFertig}<p class="meldung ok" data-test="imp-fertig">{impFertig}.</p>{/if}
    {#if imp}
      <div class="meldung vorschau" data-test="imp-vorschau">
        <b>Import-Vorschau:</b>
        <span data-test="imp-zahlen">{imp.v.neu.length} neu, {imp.v.geaendert.length} geändert, {imp.v.gleich.length} gleich</span>
        {#if imp.tage.length}<span>· {imp.tage.length} Protokollzeilen</span>{/if}
        {#if imp.tags.length}<span>· {imp.tags.length} NFC-Anhänger</span>{/if}
        <div class="modus">
          <label><input type="radio" bind:group={impModus} value="zusammenfuehren" /> Zusammenführen (nichts wird gelöscht)</label>
          <label><input type="radio" bind:group={impModus} value="ersetzen" /> Ersetzen{#if imp.v.fehlen.length}&nbsp;({imp.v.fehlen.length} vorhandene {imp.v.fehlen.length === 1 ? "Profil wird" : "Profile werden"} gelöscht: {imp.v.fehlen.map((p) => p.name).join(", ")}){/if}</label>
        </div>
        <button class="big-btn small {impModus === 'ersetzen' ? 'rot' : ''}" onclick={uebernehmen}>{impModus === "ersetzen" ? "Alles ersetzen" : "Übernehmen"}</button>
        <button class="big-btn light small" onclick={() => (imp = null)}>Abbrechen</button>
      </div>
    {/if}

    <div class="zwei">
      <ul class="liste">
        {#each kita.profile as p (p.id)}
          <li><button class:an={form?.id === p.id} onclick={() => bearbeiten(p)}>
            <Avatar bild={p.bild} farbe={p.farbe} size="2.2rem" />
            <b>{p.name}</b><small>{p.rolle === "kind" ? "Kind" : "Erzieher"}</small>
          </button></li>
        {:else}
          <li class="leer">Noch keine Profile.</li>
        {/each}
      </ul>

      {#if form}
        <form class="karte" onsubmit={(e) => { e.preventDefault(); speichern(); }}>
          <div class="kopf">
            <Avatar bild={form.bild} farbe={form.farbe} size="5rem" />
            <h3>{form.id ? "Profil ändern" : "Neues Profil"}</h3>
          </div>
          <label for="f-name">Name</label>
          <input id="f-name" bind:value={form.name} maxlength="30" autocomplete="off" required />

          <span class="lbl">Rolle</span>
          <div class="wahl">
            <button type="button" class:an={form.rolle === "kind"} onclick={() => (form.rolle = "kind")}>Kind</button>
            <button type="button" class:an={form.rolle === "erzieher"} onclick={() => (form.rolle = "erzieher")}>Erzieher</button>
          </div>

          <span class="lbl">Bild</span>
          <div>
            <div class="wahl">
              <button type="button" class:an={form.bild.art === "schaf"} onclick={() => (form.bild = { art: "schaf", wert: "weiss" })}>Schaf</button>
              <button type="button" class:an={form.bild.art === "emoji"} onclick={() => (form.bild = { art: "emoji", wert: "🐑" })}>Emoji</button>
              <label class="knopf" class:an={form.bild.art === "foto"}>Foto aufnehmen<input id="f-foto" type="file" accept="image/*" capture="environment" hidden onchange={foto} /></label>
            </div>
            {#if form.bild.art === "schaf"}
              <div class="auswahl">
                {#each WOLLE as w (w)}
                  <button type="button" class="bildknopf" class:an={form.bild.wert === w} aria-label={`Schaf ${w}`} onclick={() => (form.bild = { art: "schaf", wert: w })}><Sheep size="2.6rem" wolle={w} /></button>
                {/each}
              </div>
            {:else if form.bild.art === "emoji"}
              <div class="auswahl">
                {#each EMOJIS as em (em)}
                  <button type="button" class="bildknopf emoji" class:an={form.bild.wert === em} onclick={() => (form.bild = { art: "emoji", wert: em })}>{em}</button>
                {/each}
                <input class="eigen" aria-label="Eigenes Emoji" maxlength="8" value={form.bild.wert} oninput={(e) => e.currentTarget.value.trim() && (form.bild = { art: "emoji", wert: e.currentTarget.value.trim() })} />
              </div>
            {/if}
          </div>

          <span class="lbl">Farbe</span>
          <div class="auswahl">
            {#each FARBEN as f (f)}
              <button type="button" class="farbe" class:an={form.farbe === f} style:background={f} aria-label={`Farbe ${f}`} onclick={() => (form.farbe = f)}></button>
            {/each}
          </div>

          <label for="f-zeit">{form.rolle === "kind" ? "Übliche Abholzeit" : "Übliches Dienstende"}</label>
          <input id="f-zeit" type="time" step="300" bind:value={form.ueblicheZeit} />

          <label for="f-notiz">Notiz</label>
          <input id="f-notiz" bind:value={form.notiz} maxlength="200" autocomplete="off" />

          <div class="aktionen">
            <button class="big-btn small" type="submit">Speichern</button>
            {#if gespeichert}<span class="ok" data-test="gespeichert">Gespeichert</span>{/if}
            {#if fehler}<span class="err">{fehler}</span>{/if}
            <span class="spacer"></span>
            {#if form.id}<button class="big-btn rot small" type="button" onclick={loeschen}>{loeschFrage ? "Wirklich löschen?" : "Löschen"}</button>{/if}
          </div>
        </form>
      {:else}
        <p class="karte hinweis">Links ein Profil auswählen oder ein neues anlegen. Der Export schreibt alle Profile mit Fotos in eine Datei, die sich hier oder auf einem anderen Gerät wieder importieren lässt.</p>
      {/if}
    </div>
  {:else if tab === "protokoll"}
    <div class="leiste">
      <button class="big-btn light small" aria-label="Tag zurück" onclick={() => (pDatum = datumPlus(pDatum, -1))}>‹</button>
      <b class="datum">{datumLang(pDatum)}</b>
      <button class="big-btn light small" aria-label="Tag vor" onclick={() => (pDatum = datumPlus(pDatum, 1))}>›</button>
      <input type="date" bind:value={pDatum} aria-label="Datum" />
      {#if pDatum !== kita.datum}<button class="big-btn light small" onclick={() => (pDatum = kita.datum)}>Heute</button>{/if}
    </div>
    <div class="karte">
      {#if pZeilen.length}
        <table>
          <thead><tr><th>Name</th><th>Zustand</th><th>Gekommen</th><th>Abholzeit</th><th>Gegangen</th></tr></thead>
          <tbody>
            {#each pZeilen as z (z.profilId)}
              <tr><td><b>{z.name}</b></td><td>{STATUS_TEXT[z.status]}{z.meldungBis && z.meldungBis > z.datum ? ` (bis ${datumLang(z.meldungBis)})` : ""}</td>
                <td>{z.gekommenUm ?? "–"}</td><td>{z.abholzeit ?? "–"}</td><td>{z.nichtAbgeholt ? "nicht abgeholt" : (z.gegangenUm ?? "–")}</td></tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <p class="hinweis">An diesem Tag gibt es keine Einträge.</p>
      {/if}
    </div>
  {:else if tab === "nachrichten"}
    <div class="leiste"><span class="muted">Nachrichten der Pinnwand. Geschrieben und beantwortet wird auf der Pinnwand selbst; hier lassen sie sich löschen.</span></div>
    <div class="karte">
      {#if kita.nachrichten.length}
        <table>
          <thead><tr><th>Wann</th><th>Von</th><th>Nachricht</th><th>Reaktionen</th><th></th></tr></thead>
          <tbody>
            {#each kita.nachrichten as n (n.id)}
              <tr><td>{zeitpunktText(n.erstelltAm, kita.datum)}</td><td><b>{kita.profil(n.autorId)?.name ?? n.autorName}</b></td><td>{n.bild} {n.text}</td>
                <td>{Object.keys(n.reaktionen).filter((id) => kita.profil(id)).length}</td>
                <td><button class="big-btn rot small" onclick={() => nachrichtLoeschen(n.id)}>{nLoeschFrage === n.id ? "Wirklich löschen?" : "Löschen"}</button></td></tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <p class="hinweis">Noch keine Nachrichten.</p>
      {/if}
    </div>
  {:else if tab === "nfc"}
    <div class="karte einst nfc">
      <div class="reihe"><label for="s-nfc">NFC-Anhänger lesen</label><Toggle id="s-nfc" label="NFC-Anhänger lesen" checked={settings.value.nfc} onchange={nfcSchalten} />
        {#if settings.value.nfc && (nfc.status === "antippen" || nfc.status === "erlaubt" || nfc.status === "fehler")}<button class="big-btn small" onclick={() => nfc.start(true)}>NFC einschalten</button>{/if}
      </div>
      <p class="muted" data-test="nfc-status">{settings.value.nfc || nfc.status === "fehlt" ? NFC_TEXT[nfc.status] : "Ausgeschaltet."}{nfc.status === "fehler" && nfc.fehler ? ` ${nfc.fehler}.` : ""}</p>
      <p class="muted">Ein neuer Anhänger wird beim ersten Hinhalten einem Profil zugeordnet. Danach öffnet er das Fenster des Profils; noch einmal hinhalten meldet an oder ab. Hier lassen sich Zuordnungen ändern oder aufheben. Zum Finden: Anhänger jetzt ans Gerät halten.</p>
      {#if nfcHinweis}<p class="err" data-test="nfc-hinweis">{nfcHinweis}</p>{/if}
      {#if gelesen && !kita.tagProfil(gelesen)}
        <div class="reihe neu" data-test="nfc-neu">
          <span class="emoji">🏷️</span> <b>Neuer Anhänger</b> <code>{gelesen}</code>
          <select aria-label="Neuen Anhänger zuordnen" value="" onchange={(e) => tagSetzen(gelesen, e.currentTarget.value)}>
            <option value="">— zuordnen —</option>
            {#each kita.profile as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
          </select>
        </div>
      {/if}
      {#if tagListe.length}
        <table>
          <thead><tr><th>Anhänger</th><th>Gehört</th><th></th></tr></thead>
          <tbody>
            {#each tagListe as t (t.id)}
              <tr class:gelesen={t.id === gelesen} data-tag={t.id}>
                <td><code>{t.id}</code></td>
                <td><select aria-label={`Besitzer von ${t.id}`} value={t.profilId} onchange={(e) => tagSetzen(t.id, e.currentTarget.value)}>
                  {#each kita.profile as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
                </select></td>
                <td><button class="big-btn light small" onclick={() => tagAufheben(t.id)}>Aufheben</button></td>
              </tr>
            {/each}
          </tbody>
        </table>
      {:else}
        <p class="hinweis">Noch kein Anhänger zugeordnet.</p>
      {/if}
    </div>
  {:else}
    <div class="karte einst">
      <div class="reihe"><label for="s-toene">Töne</label><Toggle id="s-toene" label="Töne" checked={settings.value.toene} onchange={(v) => settings.set({ toene: v })} /></div>
      <div class="reihe"><label for="s-ansage">Ansage („Hallo Wolli!“)</label><Toggle id="s-ansage" label="Ansage" checked={settings.value.ansage} onchange={(v) => settings.set({ ansage: v })} />
        <button class="big-btn light small" onclick={() => sag("Hallo Wolli!", { immer: true })}>Testen</button>
        {#if !canSpeak()}<span class="muted">Dieses Gerät hat keine deutsche Stimme.</span>{/if}
      </div>
      <div class="reihe"><label for="s-schritt">Plus und Minus verstellen um</label>
        <select id="s-schritt" value={settings.value.schritt} onchange={(e) => settings.set({ schritt: Number(e.currentTarget.value) })}>
          {#each [5, 10, 15, 30] as n (n)}<option value={n}>{n} Minuten</option>{/each}
        </select>
      </div>
      <h3>Zeitknöpfe</h3>
      <p class="muted">Die sechs großen Knöpfe im Anmelde-Fenster: Uhrzeit, Bild und Tagesmoment.</p>
      {#each settings.value.zeiten as z, i (i)}
        <div class="reihe slot">
          <input type="time" value={z.zeit} aria-label={`Zeit ${i + 1}`} onchange={(e) => zeitSetzen(i, "zeit", e.currentTarget.value)} />
          <input class="em" value={z.bild} maxlength="8" aria-label={`Bild ${i + 1}`} onchange={(e) => zeitSetzen(i, "bild", e.currentTarget.value.trim())} />
          <input class="txt" value={z.text} maxlength="24" aria-label={`Tagesmoment ${i + 1}`} onchange={(e) => zeitSetzen(i, "text", e.currentTarget.value.trim())} />
        </div>
      {/each}
      <div class="reihe"><button class="big-btn light small" onclick={() => settings.set({ zeiten: structuredClone(STANDARD_ZEITEN) })}>Zeitknöpfe zurücksetzen</button></div>
      <h3>Gerät</h3>
      <div class="reihe">
        <button class="big-btn light small" onclick={vollbild}>Vollbild an/aus</button>
        {#if update.ready}<button class="big-btn small" onclick={() => update.apply()}>Neue Version laden</button>{/if}
      </div>
      <p class="muted">Alle Daten bleiben auf diesem Gerät. Zum Übertragen oder Sichern: Profile → Exportieren.</p>
    </div>
  {/if}
</div>

<style>
  .buero { position: fixed; inset: 0; z-index: 30; background: var(--wool-2); overflow-y: auto; user-select: text; -webkit-user-select: text; padding-bottom: 2rem; }
  header { display: flex; align-items: center; gap: 0.8rem; padding: 0.7rem 1.2rem; background: var(--sky); position: sticky; top: 0; z-index: 2; flex-wrap: wrap; }
  header b { font-family: var(--f-display); font-weight: 800; font-size: 1.6rem; display: block; line-height: 1; }
  header small { color: var(--ink-soft); font-size: 0.85rem; }
  nav { display: flex; gap: 0.3rem; margin: 0 auto 0 1rem; }
  nav button { padding: 0.5rem 0.9rem; border-radius: 0.8rem; font-family: var(--f-display); font-weight: 700; font-size: 1.15rem; }
  nav button.an { background: #fff; }
  .leiste { display: flex; align-items: center; gap: 0.6rem; padding: 1rem 1.2rem 0; flex-wrap: wrap; }
  .spacer { flex: 1; }
  .check { display: flex; align-items: center; gap: 0.3rem; }
  .datum { font-family: var(--f-display); font-size: 1.3rem; min-width: 14rem; text-align: center; }
  .meldung { margin: 1rem 1.2rem 0; padding: 0.7rem 1rem; border-radius: 1rem; background: #fff; border: 2px solid var(--wool-line); }
  .meldung.err { border-color: var(--danger); color: #a02622; }
  .meldung.ok { border-color: var(--grass); background: var(--ok-bg); }
  .vorschau { display: flex; align-items: center; gap: 0.6rem 0.8rem; flex-wrap: wrap; border-color: var(--sun); }
  .modus { flex-basis: 100%; display: flex; flex-direction: column; gap: 0.2rem; }
  .zwei { display: grid; grid-template-columns: 17rem 1fr; gap: 1rem; padding: 1rem 1.2rem 0; align-items: start; }
  .liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
  .liste button { width: 100%; display: flex; align-items: center; gap: 0.6rem; padding: 0.4rem 0.7rem; background: #fff; border: 2px solid var(--wool-line); border-radius: 0.9rem; text-align: left; }
  .liste button.an { border-color: var(--grass); background: var(--ok-bg); }
  .liste b { font-family: var(--f-display); font-size: 1.15rem; }
  .liste small { margin-left: auto; color: var(--ink-soft); }
  .karte { background: #fff; border-radius: 1.2rem; padding: 1.1rem; border: 2px solid var(--wool-line); }
  .leiste + .karte { margin: 1rem 1.2rem 0; }
  form.karte { display: grid; grid-template-columns: 11rem 1fr; gap: 0.8rem 1rem; align-items: center; }
  .kopf, .aktionen { grid-column: 1 / -1; display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap; }
  h3 { margin: 0; font-family: var(--f-display); font-weight: 800; font-size: 1.4rem; }
  form label, .lbl { color: var(--ink-soft); }
  input:not([type]), input[type="time"], input[type="date"], select { padding: 0.45rem 0.7rem; border-radius: 0.7rem; border: 2px solid var(--wool-line); background: #fff; min-width: 0; }
  form input[type="time"] { justify-self: start; }
  .wahl { display: flex; gap: 0.4rem; flex-wrap: wrap; }
  .wahl button, .wahl .knopf { padding: 0.4rem 0.9rem; border-radius: 0.7rem; border: 2px solid var(--wool-line); background: #fff; color: var(--ink); cursor: pointer; }
  .wahl .an { border-color: var(--grass); background: var(--ok-bg); font-weight: 800; }
  .auswahl { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.5rem; align-items: center; }
  .bildknopf { width: 3rem; height: 3rem; border-radius: 0.7rem; border: 2px solid transparent; font-size: 1.7rem; display: grid; place-items: center; }
  .bildknopf.an { border-color: var(--grass); background: var(--ok-bg); }
  .eigen { width: 4.5rem; text-align: center; }
  .farbe { width: 2.2rem; height: 2.2rem; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 0 0 2px var(--wool-line); }
  .farbe.an { box-shadow: 0 0 0 3px var(--ink); }
  .ok { color: var(--grass-dark); font-weight: 800; }
  .err { color: #a02622; font-weight: 800; }
  .hinweis, .muted, .leer { color: var(--ink-soft); margin: 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 0.45rem 0.6rem; border-bottom: 1px solid var(--wool-line); }
  th { color: var(--ink-soft); font-weight: 700; }
  .einst { margin: 1rem 1.2rem 0; display: flex; flex-direction: column; gap: 0.8rem; max-width: 46rem; }
  .reihe { display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap; }
  .reihe > label { min-width: 15rem; }
  .nfc { max-width: 52rem; }
  .nfc .neu { background: #fff8e1; border: 2px solid var(--sun); border-radius: 0.9rem; padding: 0.5rem 0.8rem; }
  tr.gelesen td { background: var(--ok-bg); }
  code { font-size: 0.95rem; }
  .slot .em { width: 4rem; text-align: center; }
  .slot .txt { flex: 1; }

  @media (max-width: 760px) {
    .zwei { grid-template-columns: 1fr; padding: 0.8rem 0.7rem 0; }
    form.karte { grid-template-columns: 1fr; gap: 0.4rem; }
    nav { margin: 0; order: 3; flex-basis: 100%; }
    header > .big-btn { margin-left: auto; }
    .leiste { padding: 0.8rem 0.7rem 0; }
    .meldung, .einst, .leiste + .karte { margin: 0.8rem 0.7rem 0; }
    .reihe > label { min-width: 0; flex-basis: 100%; }
    .datum { min-width: 0; flex: 1; }
    .karte { overflow-x: auto; }
  }
</style>
