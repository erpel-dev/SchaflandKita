# Schafland Kita

> Hier bin ich Schaf, hier darf ich spielen

Spiel-Terminal für den Kuscheltier-Kindergarten, gedacht für Kinder von 4 bis 6 Jahren. Tiere und Erzieher werden morgens mit Abholzeit angemeldet, später abgeholt (ausgecheckt) oder krank bzw. abwesend gemeldet. Technik und Aussehen stammen von der [Schafland-Kasse](https://github.com/erpel-dev/Schafland): Svelte 5, Vite, PWA, Daten in der IndexedDB des Browsers. Es gibt keinen Server; alles bleibt auf dem einen Gerät.

## Bedienung

| Was | Wie |
| --- | --- |
| Anmelden | Kachel antippen → Abholzeit antippen (übliche Zeit ist vorgewählt, Plus/Minus verstellt) → „Anmelden“ |
| Abholen | Kachel eines angemeldeten Tiers antippen → „Abholen“, oder in der Übersicht „Abholen“ |
| Krank / nicht da | Kachel antippen → „Krank“ oder „Nicht da“ → nur heute oder mit Plus bis zu 14 weitere Tage → melden |
| Zurücknehmen | Kachel antippen → „Wieder gesund“, „Doch da“, „Wieder da“ oder „Doch noch nicht da“ |
| Übersicht | Knopf oben rechts: Abholliste nach Uhrzeit, überschrittene Zeiten gelb, dazu alle Erzieher |
| Büro | Zwei Sekunden auf das Schaf oben links drücken (oder Strg + ,) |

Um Mitternacht beginnt ein neuer Tag: Alle stehen wieder auf „Noch nicht da“, mehrtägige Meldungen laufen weiter. Wer abends noch angemeldet war, steht im Protokoll als „nicht abgeholt“.

## Büro

- **Profile:** anlegen, ändern, löschen. Bild ist ein Schaf (fünf Fellfarben), ein Emoji oder ein Foto des Kuscheltiers.
- **Export:** schreibt alle Profile samt Fotos in `schafland-kita-profile-<Datum>.json`, auf Wunsch mit Protokoll.
- **Import:** zeigt zuerst eine Vorschau (neu, geändert, gleich). „Zusammenführen“ löscht nichts, „Ersetzen“ nimmt nur die Datei. Ungültige Dateien werden abgelehnt, ohne etwas zu ändern.
- **Protokoll:** Anwesenheit vergangener Tage.
- **Einstellungen:** Töne, Ansage („Hallo Wolli!“), Schrittweite, die sechs Zeitknöpfe.

Beim ersten Start gibt es sieben Beispielprofile (`src/lib/beispiele.js`): die Erzieher Erpel, Manfred, Lola und Eichel, die Kinder Wolli, Scheepi und Erpelküken.

## Entwickeln

```bash
npm install
npm run dev        # Entwicklungsserver
npm test           # Unit-Tests (Zeitrechnung, Import/Export, Kita-Zustand)
npm run test:e2e   # baut die App und spielt einen Kita-Tag in Chromium durch
npm run build      # fertige App in dist/
```

Der Browser-Test braucht einen Chromium für Playwright (`npx playwright install chromium`) oder einen eigenen über `CHROMIUM_PATH=/pfad/zu/chromium`. Screenshots landen in `tests/e2e/.output/`.

| Datei | Inhalt |
| --- | --- |
| `src/lib/kita.svelte.js` | Zustand: Profile, heutige Einträge, Tageswechsel |
| `src/lib/profile-io.js` | Profile prüfen, Export, Import-Vorschau |
| `src/lib/zeit.js` | Rechnen mit Uhrzeiten und Tagen |
| `src/components/Terminal.svelte` | Startseite mit Kacheln |
| `src/components/ProfilFenster.svelte` | Anmelden, Abholen, Melden |
| `src/components/Uebersicht.svelte` | Übersicht für Erzieher |
| `src/components/Buero.svelte` | Profile, Protokoll, Einstellungen |

## Veröffentlichen

`.github/workflows/pages.yml` baut bei jedem Push nach `main` und veröffentlicht auf GitHub Pages (einmalig: Settings → Pages → Source: „GitHub Actions“). Für ein privates Repository braucht GitHub Pages einen bezahlten Tarif. Ohne Pages genügt es, `dist/` von einem beliebigen Webserver auszuliefern, z. B. `npm run preview`.
