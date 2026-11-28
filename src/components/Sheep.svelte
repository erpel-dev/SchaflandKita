<script>
  // Das Schaf aus Schafland, hier mit wählbarer Fellfarbe, damit Wolli und Scheepi verschieden aussehen.
  const FELL = {
    weiss: ["#fffdf7", "#d9d2bf"],
    braun: ["#c49a6c", "#96703f"],
    schwarz: ["#6a665f", "#3f3c37"],
    grau: ["#d4d2cb", "#a9a69c"],
    rosa: ["#fbd0d8", "#e79aab"],
  };
  import { settings } from "../lib/settings.svelte.js";
  let { size = "3rem", class: cls = "", wolle = "weiss" } = $props();
  let kostuem = $derived(settings.value.aktion);
  let fell = $derived(FELL[wolle] ?? FELL.weiss);
</script>

<svg class={cls} style:width={size} style:height={size} viewBox="0 0 110 110" aria-hidden="true">
  <g fill={fell[0]} stroke={fell[1]} stroke-width="2">
    <circle cx="38" cy="58" r="18" /><circle cx="58" cy="46" r="20" /><circle cx="80" cy="50" r="18" />
    <circle cx="90" cy="68" r="16" /><circle cx="70" cy="78" r="18" /><circle cx="46" cy="78" r="17" />
    <circle cx="60" cy="64" r="22" stroke="none" />
  </g>
  <rect x="44" y="88" width="7" height="16" rx="3" fill="#2b2b2b" />
  <rect x="72" y="88" width="7" height="16" rx="3" fill="#2b2b2b" />
  <ellipse cx="22" cy="44" rx="9" ry="5" fill="#2b2b2b" transform="rotate(-25 22 44)" />
  <ellipse cx="22" cy="44" rx="5" ry="2.5" fill="#f29bab" transform="rotate(-25 22 44)" />
  <ellipse cx="30" cy="54" rx="15" ry="18" fill="#2b2b2b" />
  <circle cx="25" cy="50" r="3.2" fill="#fff" /><circle cx="35" cy="50" r="3.2" fill="#fff" />
  <circle cx="25.6" cy="50.6" r="1.6" fill="#2b2b2b" /><circle cx="35.6" cy="50.6" r="1.6" fill="#2b2b2b" />
  <ellipse cx="30" cy="62" rx="5" ry="3" fill="#f29bab" />
  <g fill={fell[0]}><circle cx="24" cy="38" r="6" /><circle cx="31" cy="35" r="6.5" /><circle cx="38" cy="38" r="6" /></g>
  {#if kostuem === "sommerfest"}
    <!-- Sonnenbrille und Partyhut -->
    <path d="M28.5 49.6h2.5" stroke="#ffd23f" stroke-width="1.8" />
    <g fill="#3a2a5c" stroke="#ffd23f" stroke-width="1.5"><rect x="18.6" y="46" width="10" height="7.6" rx="3" /><rect x="30.9" y="46" width="10" height="7.6" rx="3" /></g>
    <path d="M21 48.5l3-1M33 48.5l3-1" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity="0.7" />
    <g transform="rotate(-12 31 36)">
      <path d="M22 35L31 9l10 26z" fill="#ff5d8f" />
      <path d="M27.5 19l8.5 3M25 27l13 4" stroke="#ffd23f" stroke-width="2.2" />
      <circle cx="31" cy="9" r="3.6" fill="#ffd23f" />
    </g>
  {:else if kostuem === "kuerbisfest"}
    <!-- Kürbishut -->
    <g transform="rotate(-10 31 36)">
      <path d="M30 20q-1-7 4-9" fill="none" stroke="#5c8a2c" stroke-width="3.4" stroke-linecap="round" />
      <ellipse cx="31" cy="28" rx="15.5" ry="10" fill="#ef7a1a" stroke="#c25e0c" stroke-width="1" />
      <path d="M31 18.5v19M24 20q-3.5 8 0 16.5M38 20q3.5 8 0 16.5" fill="none" stroke="#c25e0c" stroke-width="1.3" />
    </g>
  {:else if kostuem === "weihnachtsmarkt"}
    <!-- Weihnachtsmütze, Zipfel fällt nach hinten -->
    <g transform="rotate(-8 31 36)">
      <path d="M18 35C19 20 30 9 45 11c6 1 9 6 7 13-4-5-9-6-12-4 2 4 3 9 3 15z" fill="#d42d3a" />
      <path d="M40 20c-3 2-4 7-3 15" fill="none" stroke="#a51f2b" stroke-width="1.2" />
      <rect x="15.5" y="31" width="30" height="7" rx="3.5" fill="#fffdf7" stroke="#e6e0d0" stroke-width="0.8" />
      <circle cx="51" cy="25" r="4.6" fill="#fffdf7" stroke="#e6e0d0" stroke-width="0.8" />
    </g>
  {:else if kostuem === "laeusealarm"}
    <!-- Duschhaube mit Rüschen, daneben zwei Seifenblasen -->
    <g transform="rotate(-10 31 36)">
      <path d="M15 35C15 20 24 14 31 14s16 6 16 21z" fill="#8fd6f5" stroke="#5bb7e0" stroke-width="1.2" />
      <g fill="#c8ecfb"><circle cx="24" cy="24" r="2" /><circle cx="33" cy="20" r="1.6" /><circle cx="39" cy="27" r="2" /><circle cx="29" cy="29" r="1.4" /></g>
      <g fill="#fff" stroke="#8fd6f5" stroke-width="1">
        {#each [15, 19.5, 24, 28.5, 33, 37.5, 42, 46.5] as x (x)}<circle cx={x} cy="35.5" r="2.6" />{/each}
      </g>
    </g>
    <g fill="none" stroke="#7cc8ee" stroke-width="1"><circle cx="50" cy="14" r="3.5" /><circle cx="56" cy="7" r="2.2" /></g>
  {/if}
</svg>
