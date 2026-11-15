import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { VitePWA } from "vite-plugin-pwa";
import { readFileSync } from "node:fs";

// Version für das Büro, damit man auf dem Gerät sieht, welcher Stand läuft
const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
const APP_VERSION = `${pkg.version} vom ${new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}`;

export default defineConfig({
  base: "./",
  plugins: [
    svelte(),
    VitePWA({
      // "prompt": die App entscheidet, wann eine neue Version geladen wird (src/lib/update.svelte.js)
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["schaf.svg"],
      manifest: {
        name: "Schafland Kita",
        short_name: "Kita",
        description: "Hier bin ich Schaf, hier darf ich spielen",
        lang: "de",
        display: "fullscreen",
        background_color: "#fffdf7",
        theme_color: "#cfe8f7",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "schaf.svg", sizes: "any", type: "image/svg+xml" },
        ],
      },
      workbox: { globPatterns: ["**/*.{js,css,html,svg,png,woff2}"], navigateFallback: "index.html" },
    }),
  ],
  define: { __APP_VERSION__: JSON.stringify(APP_VERSION) },
});
