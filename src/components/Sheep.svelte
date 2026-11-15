<script>
  // Das Schaf aus Schafland, hier mit wählbarer Fellfarbe, damit Wolli und Scheepi verschieden aussehen.
  const FELL = {
    weiss: ["#fffdf7", "#d9d2bf"],
    braun: ["#c49a6c", "#96703f"],
    schwarz: ["#6a665f", "#3f3c37"],
    grau: ["#d4d2cb", "#a9a69c"],
    rosa: ["#fbd0d8", "#e79aab"],
  };
  let { size = "3rem", class: cls = "", wolle = "weiss" } = $props();
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
</svg>
