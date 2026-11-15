<script>
  // Himmels-Deko der aktiven Aktion (Kopfzeile und Start). big: über den ganzen Himmel
  let { aktion, big = false } = $props();
  // [x %, Startverzögerung s, Größe rem, Dauer s] – fest, damit es bei jedem Start gleich aussieht
  const bahnen = $derived(
    big
      ? [[4, 0, 1.6, 11], [12, 4, 1, 9], [19, 2, 2, 13], [27, 7, 1.2, 10], [35, 1, 1.5, 12], [43, 5, 0.9, 9], [52, 3, 1.8, 14],
         [60, 8, 1.1, 10], [68, 0.5, 1.4, 11], [76, 6, 1, 9], [84, 2.5, 1.9, 13], [92, 4.5, 1.2, 10], [97, 7.5, 0.9, 12]]
      : [[33, 0, 0.8, 6], [44, 2, 0.6, 5], [56, 1, 0.9, 7], [67, 3, 0.7, 5.5], [76, 1.5, 0.8, 6.5], [86, 4, 0.6, 5]],
  );
  const BLAETTER = ["🍂", "🍁", "🍂", "🍃"];
</script>

{#if aktion}
  <div class="deko {aktion}" class:big aria-hidden="true">
    {#if aktion === "sommerfest"}
      <div class="kette wimpel"></div>
      {#if big}
        <svg class="sonne" viewBox="0 0 100 100">
          <g stroke="#ffb703" stroke-width="5" stroke-linecap="round">
            {#each [0, 45, 90, 135, 180, 225, 270, 315] as w (w)}<line x1="50" y1="6" x2="50" y2="18" transform={`rotate(${w} 50 50)`} />{/each}
          </g>
          <circle cx="50" cy="50" r="24" fill="#ffd23f" stroke="#ffb703" stroke-width="3" />
        </svg>
      {/if}
    {:else if aktion === "kuerbisfest"}
      <div class="kette wimpel herbst"></div>
      {#each bahnen as [x, delay, size, dur], i (i)}
        <span class="fall emoji" style:left="{x}%" style:font-size="{size * 1.1}rem" style:animation-delay="-{delay}s" style:animation-duration="{dur}s">{BLAETTER[i % BLAETTER.length]}</span>
      {/each}
    {:else if aktion === "weihnachtsmarkt"}
      <div class="kette lichter"></div>
      {#each bahnen as [x, delay, size, dur], i (i)}
        <svg class="fall" style:left="{x}%" style:width="{size}rem" style:animation-delay="-{delay}s" style:animation-duration="{dur}s" viewBox="0 0 20 20">
          <g stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity="0.9">
            <path d="M10 1v18M2.2 5.5l15.6 9M2.2 14.5l15.6-9" />
            <path d="M10 4l-2-2M10 4l2-2M10 16l-2 2M10 16l2 2" />
          </g>
        </svg>
      {/each}
    {/if}
  </div>
{/if}

<style>
  .deko { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
  .kette { position: absolute; left: 0; right: 0; top: 0; height: 0.9rem; background-repeat: repeat-x; background-size: auto 100%; }
  .big .kette { height: 2.6rem; }
  /* Wimpelkette: vier Wimpel je Kachel */
  .wimpel { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 30'%3E%3Cpath d='M0 2h120' stroke='%23815b2e' stroke-width='2'/%3E%3Cpath d='M2 3h26l-13 25z' fill='%23ff5d8f'/%3E%3Cpath d='M32 3h26l-13 25z' fill='%23ffd23f'/%3E%3Cpath d='M62 3h26l-13 25z' fill='%2345c4b0'/%3E%3Cpath d='M92 3h26l-13 25z' fill='%23ff8a3d'/%3E%3C/svg%3E"); }
  .wimpel.herbst { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 30'%3E%3Cpath d='M0 2h120' stroke='%236b4a2b' stroke-width='2'/%3E%3Cpath d='M2 3h26l-13 25z' fill='%23ef7a1a'/%3E%3Cpath d='M32 3h26l-13 25z' fill='%23c0392b'/%3E%3Cpath d='M62 3h26l-13 25z' fill='%23e0a526'/%3E%3Cpath d='M92 3h26l-13 25z' fill='%238a5a2b'/%3E%3C/svg%3E"); }
  /* Lichterkette: durchhängender Draht mit vier bunten Lämpchen */
  .lichter { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 30'%3E%3Cpath d='M0 3q30 16 60 0t60 0' fill='none' stroke='%232f6b3a' stroke-width='2'/%3E%3Ccircle cx='15' cy='14' r='6' fill='%23ffcf3f'/%3E%3Ccircle cx='45' cy='14' r='6' fill='%23ff5d5d'/%3E%3Ccircle cx='75' cy='14' r='6' fill='%2366d17a'/%3E%3Ccircle cx='105' cy='14' r='6' fill='%2366b8ff'/%3E%3C/svg%3E"); filter: drop-shadow(0 0 0.3rem rgba(255, 220, 120, 0.8)); }
  .sonne { position: absolute; right: 8%; top: 9%; width: 9rem; height: 9rem; animation: drehen 40s linear infinite; }
  @keyframes drehen { to { transform: rotate(360deg); } }
  .fall { position: absolute; top: -2rem; height: auto; animation: fall linear infinite; }
  @keyframes fall {
    from { transform: translateY(0) rotate(0deg); }
    50% { transform: translate(0.8rem, 50vh) rotate(90deg); }
    to { transform: translate(-0.4rem, 105vh) rotate(180deg); }
  }
  /* in der Kopfzeile nur die Kopfzeile hinunter */
  .deko:not(.big) .fall { animation-name: fall-klein; }
  @keyframes fall-klein { to { transform: translateY(6rem) rotate(120deg); } }
  @media (prefers-reduced-motion: reduce) { .fall { animation: none; top: 30%; } .sonne { animation: none; } }
</style>
