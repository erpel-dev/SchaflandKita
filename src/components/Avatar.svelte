<script>
  import Sheep from "./Sheep.svelte";
  let { bild, farbe = "#cfe8f7", size = "5rem" } = $props();
</script>

<span class="avatar" style:width={size} style:height={size} style:background={farbe} style:font-size={size}>
  {#if bild?.art === "foto"}
    <img src={bild.wert} alt="" draggable="false" />
  {:else if bild?.art === "schaf"}
    <Sheep size="88%" wolle={bild.wert} />
  {:else}
    <span class="emoji">{bild?.wert ?? "🐑"}</span>
  {/if}
</span>

<style>
  .avatar { display: inline-grid; place-items: center; border-radius: 50%; overflow: hidden; flex: none; border: 0.04em solid rgba(0, 0, 0, 0.08); }
  .avatar .emoji { font-size: 0.6em; }
  img { width: 100%; height: 100%; object-fit: cover; }
</style>
