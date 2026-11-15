# Schafland Kita

> Hier bin ich Schaf, hier darf ich spielen

**Sofort ausprobieren:** https://erpel-dev.github.io/SchaflandKita/ – läuft im Browser (Chrome, Edge, Safari, Firefox) und lässt sich als App installieren: Chrome/Edge → „App installieren“, iPhone/iPad → Teilen → „Zum Home-Bildschirm“. Danach geht alles auch offline. Profile und Anwesenheit bleiben nur auf dem jeweiligen Gerät.

Spiel-Terminal für den Kuscheltier-Kindergarten, gedacht für Kinder von 4 bis 6 Jahren. Tiere und Erzieher werden morgens mit Abholzeit angemeldet, später abgeholt (ausgecheckt) oder krank bzw. abwesend gemeldet. An der Pinnwand schreiben Erzieher Nachrichten, auf die alle reagieren können. Dazu kommen ein Tagesplan als Bilderleiste, ein Tagebuch für Essen und Schlafen und Aktionen wie Sommerfest oder Weihnachtsmarkt. Technik und Aussehen stammen von der [Schafland-Kasse](https://github.com/erpel-dev/Schafland): Svelte 5, Vite, PWA, Daten in der IndexedDB des Browsers. Es gibt keinen Server; alles bleibt auf dem einen Gerät.

## Bedienung

| Was | Wie |
| --- | --- |
| Anmelden | Kachel antippen → Abholzeit antippen (übliche Zeit ist vorgewählt, Plus/Minus verstellt) → „Anmelden“ |
| Abholen | Kachel eines angemeldeten Tiers antippen → „Abholen“ (oder in der Übersicht „Abholen“) → „Wer holt ab?“: Mama, Papa, Oma … antippen oder „Ohne Angabe“. Dabei steht der Tagesbericht: da seit, gegessen, geschlafen |
| Tagesplan | Bilderleiste oben auf der Startseite; der laufende Punkt ist hervorgehoben, und das Schaf sagt an, wenn ein neuer beginnt. Einen Punkt antippen liest vor, wann er dran ist |
| Essen und Schlafen | In der Übersicht je Tier ein Bildchen antippen (alles / ein bisschen / nichts gegessen, geschlafen / kurz / nicht). Noch einmal antippen nimmt es zurück |
| Krank / nicht da | Kachel antippen → „Krank“ oder „Nicht da“ → nur heute oder mit Plus bis zu 14 weitere Tage → melden |
| Zurücknehmen | Kachel antippen → „Wieder gesund“, „Doch da“, „Wieder da“ oder „Doch noch nicht da“ |
| Pinnwand | Knopf oben rechts: Erzieher schreiben Nachrichten für alle („Nachricht schreiben“ → wer schreibt → Text, auf Wunsch ein großes Bild). Jeder reagiert mit einem Bildchen: Bildchen antippen → „Wer bist du?“ → eigenes Profil antippen. Noch einmal dasselbe nimmt die Reaktion zurück. Die Zahl am Knopf zeigt neue Nachrichten |
| NFC-Anhänger | Neuen Anhänger ans Gerät halten → „Wem gehört er?“ → Profil antippen. Danach öffnet der Anhänger das Fenster seines Profils; noch einmal hinhalten meldet an (mit der vorgewählten Zeit) bzw. ab. Geht mit Chrome auf Android-Geräten mit NFC; beim ersten „Kita öffnen“ fragt Chrome einmal nach der Erlaubnis |
| Übersicht | Knopf oben rechts: Abholliste nach Uhrzeit, überschrittene Zeiten gelb, dazu alle Erzieher |
| Büro | Zwei Sekunden auf das Schaf oben links drücken (oder Strg + ,) |

Um Mitternacht beginnt ein neuer Tag: Alle stehen wieder auf „Noch nicht da“, mehrtägige Meldungen laufen weiter. Wer abends noch angemeldet war, steht im Protokoll als „nicht abgeholt“.

## Büro

- **Profile:** anlegen, ändern, löschen. Bild ist ein Schaf (fünf Fellfarben), ein Emoji oder ein Foto des Kuscheltiers.
- **Export:** schreibt alle Profile samt Fotos und NFC-Zuordnungen in `schafland-kita-profile-<Datum>.json`, auf Wunsch mit Protokoll.
- **Import:** zeigt zuerst eine Vorschau (neu, geändert, gleich). „Zusammenführen“ löscht nichts, „Ersetzen“ nimmt nur die Datei. Ungültige Dateien werden abgelehnt, ohne etwas zu ändern.
- **Protokoll:** Anwesenheit vergangener Tage.
- **Nachrichten:** Nachrichten der Pinnwand löschen.
- **NFC:** Lesen ein- und ausschalten, Zuordnungen der Anhänger ändern oder aufheben. Ein im Büro hingehaltener Anhänger wird in der Liste hervorgehoben bzw. zum Zuordnen angeboten.
- **Einstellungen:** Töne, Ansage („Hallo Wolli!“), Schrittweite, die sechs Zeitknöpfe, der Tagesplan, die Auswahl für „Wer holt ab?“ (auch abschaltbar) und die Aktion.

## Aktionen

Im Büro unter Einstellungen → Aktion lässt sich ein besonderer Tag einschalten. Er ändert Farben, Himmel und Startbild, und alle Schafe tragen ein Kostüm.

| Aktion | Aussehen |
| --- | --- |
| Sommerfest | sonniger Himmel mit Wimpelkette, Sonnenbrille und Partyhut |
| Kürbisfest | Herbsthimmel mit fallenden Blättern, Kürbis-Orange, Kürbishut |
| Weihnachtsmarkt | Winterabend mit Lichterkette und Schnee, Weihnachtsrot, Weihnachtsmütze |

Die Farbe für „da“ bleibt in jeder Aktion grün, damit sie nicht mit „krank“ verwechselt wird.

Beim ersten Start gibt es sieben Beispielprofile (`src/lib/beispiele.js`): die Erzieher Erpel, Manfred, Lola und Eichel, die Kinder Wolli, Scheepi und Erpelküken.

## Entwickeln

```bash
npm install
npm run dev        # Entwicklungsserver
npm test           # Unit-Tests (Zeitrechnung, Import/Export, Kita-Zustand, Pinnwand, NFC, Tagesplan)
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
| `src/components/Pinnwand.svelte` | Nachrichten schreiben und darauf reagieren |
| `src/lib/nachrichten.js` | Reaktionen und Bilder der Pinnwand |
| `src/lib/tagesplan.js`, `src/lib/tagebuch.js` | Tagesplan, Essen und Schlafen, Abholer |
| `src/lib/aktionen.js`, `src/components/Deko.svelte` | Aktionen und ihr Himmel (Farben in `src/app.css`, Kostüme in `Sheep.svelte`) |
| `src/lib/nfc.svelte.js` | NFC-Anhänger lesen (Web NFC) |
| `src/components/NfcZuordnen.svelte` | Neuen Anhänger einem Profil zuordnen |
| `src/components/Buero.svelte` | Profile, Protokoll, Einstellungen |

## Veröffentlichen

`.github/workflows/pages.yml` baut bei jedem Push nach `main` und veröffentlicht auf GitHub Pages (einmalig: Settings → Pages → Source: „GitHub Actions“). Für ein privates Repository braucht GitHub Pages einen bezahlten Tarif. Ohne Pages genügt es, `dist/` von einem beliebigen Webserver auszuliefern, z. B. `npm run preview`.
