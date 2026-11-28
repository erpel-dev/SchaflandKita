<script>
  // Eine freundliche Laus: große Augen, sechs Beinchen, zeigt nach oben. tippeln: Beinchen bewegen sich.
  let { size = "2rem", tippeln = false } = $props();
  // [y, Seite]: drei Beine je Seite; a und b tippeln im Wechsel
  const A = [[18, -1], [26, 1], [30, -1]];
  const B = [[18, 1], [26, -1], [30, 1]];
  const bein = ([y, s]) => `M${20 + 6 * s} ${y}q${7 * s} -3 ${11 * s} ${y < 22 ? -5 : y > 26 ? 6 : 0}`;
</script>

<svg class:tippeln style:width={size} style:height={size} viewBox="0 0 40 40" aria-hidden="true">
  <g fill="none" stroke="#5a4430" stroke-width="2.2" stroke-linecap="round">
    <g class="beine-a">{#each A as b (b)}<path d={bein(b)} />{/each}</g>
    <g class="beine-b">{#each B as b (b)}<path d={bein(b)} />{/each}</g>
    <path d="M17 7q-3-5-6-5M23 7q3-5 6-5" stroke-width="1.6" />
  </g>
  <ellipse cx="20" cy="25" rx="9" ry="11" fill="#c9a26f" stroke="#7a5a35" stroke-width="1.6" />
  <path d="M12.5 22h15M12 27h16M13.5 32h13" stroke="#a9834f" stroke-width="1.3" fill="none" />
  <circle cx="20" cy="11" r="6.5" fill="#b38a55" stroke="#7a5a35" stroke-width="1.6" />
  <circle cx="17.3" cy="10" r="2.6" fill="#fff" /><circle cx="22.7" cy="10" r="2.6" fill="#fff" />
  <circle cx="17.6" cy="9.3" r="1.3" fill="#2b2b2b" /><circle cx="23" cy="9.3" r="1.3" fill="#2b2b2b" />
  <path d="M18 14q2 1.6 4 0" stroke="#5a4430" stroke-width="1.2" fill="none" stroke-linecap="round" />
</svg>

<style>
  svg { flex: none; vertical-align: middle; }
  .beine-a, .beine-b { transform-origin: 20px 22px; }
  /* Einzelangaben statt Kurzform, damit eine stehende Laus (animation-play-state) anhalten kann */
  .tippeln .beine-a, .tippeln .beine-b { animation-name: tippel; animation-duration: 0.22s; animation-timing-function: ease-in-out; animation-iteration-count: infinite; animation-direction: alternate; }
  .tippeln .beine-b { animation-direction: alternate-reverse; }
  @keyframes tippel { from { transform: rotate(-7deg); } to { transform: rotate(7deg); } }
  @media (prefers-reduced-motion: reduce) { .tippeln .beine-a, .tippeln .beine-b { animation: none; } }
</style>
