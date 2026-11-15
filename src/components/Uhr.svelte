<script>
  // Zeigeruhr für Kinder, die Ziffern noch nicht lesen
  import { minuten } from "../lib/zeit.js";
  let { zeit, size = "3rem" } = $props();
  let min = $derived(minuten(zeit));
  let stunde = $derived(((min / 60) % 12) * 30);
  let minute = $derived((min % 60) * 6);
</script>

<svg style:width={size} style:height={size} viewBox="0 0 48 48" aria-hidden="true">
  <circle cx="24" cy="24" r="21" fill="#fff" stroke="var(--ink)" stroke-width="2.5" />
  {#each [0, 90, 180, 270] as w (w)}<line x1="24" y1="6" x2="24" y2="9.5" stroke="var(--ink-soft)" stroke-width="2" stroke-linecap="round" transform={`rotate(${w} 24 24)`} />{/each}
  <line x1="24" y1="24" x2="24" y2="13.5" stroke="var(--ink)" stroke-width="3.6" stroke-linecap="round" transform={`rotate(${stunde} 24 24)`} />
  <line x1="24" y1="24" x2="24" y2="8.5" stroke="var(--grass-dark)" stroke-width="2.4" stroke-linecap="round" transform={`rotate(${minute} 24 24)`} />
  <circle cx="24" cy="24" r="2.2" fill="var(--ink)" />
</svg>
