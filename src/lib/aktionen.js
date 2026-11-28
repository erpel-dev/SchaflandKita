// Aktionen: besondere Tage mit eigenem Aussehen (Farben in app.css, Kostüm in Sheep.svelte,
// Himmel in Deko.svelte). Neue Aktionen hinten anhängen.
// vorschau: Farben der Bildkarte in der Aktionsauswahl (Himmel oben, Himmel unten, Wiese)
export const aktionen = [
  {
    id: "sommerfest",
    name: "Sommerfest",
    emoji: "🎪",
    beschreibung: "Sonniger Himmel mit Wimpelkette, Schafe mit Sonnenbrille und Partyhut.",
    startText: "Heute ist Sommerfest!",
    gruss: "Willkommen zum Sommerfest!",
    ground: ["🎈", "🍦", "🌻"],
    vorschau: ["#8fd4ff", "#fff2b3", "#7cc24f"],
  },
  {
    id: "kuerbisfest",
    name: "Kürbisfest",
    emoji: "🎃",
    beschreibung: "Herbsthimmel mit fallenden Blättern, Kürbis-Orange und Schafe mit Kürbishut.",
    startText: "Heute ist Kürbisfest!",
    gruss: "Willkommen zum Kürbisfest!",
    ground: ["🎃", "🌽", "🎃"],
    vorschau: ["#ffd08a", "#ffecc9", "#b98a3c"],
  },
  {
    id: "weihnachtsmarkt",
    name: "Weihnachtsmarkt",
    emoji: "🎄",
    beschreibung: "Winterabend mit Lichterkette und Schnee, Weihnachtsrot und Schafe mit Weihnachtsmütze.",
    startText: "Heute ist Weihnachtsmarkt!",
    gruss: "Willkommen auf dem Weihnachtsmarkt!",
    ground: ["🎄", "🎁", "🎄"],
    vorschau: ["#1b2a4e", "#3d5d92", "#f4f8fc"],
  },
  {
    id: "laeusealarm",
    name: "Läusealarm",
    emoji: "🔍",
    beschreibung: "Minz-Himmel mit Seifenblasen, krabbelnde Läuse und Schafe mit Duschhaube. Im Fenster lässt sich „Hat Läuse“ melden; zurück geht es erst nach dem Läuse-Check.",
    startText: "Heute ist Läusealarm!",
    gruss: "Achtung, Läusealarm! Alle Köpfe werden kontrolliert.",
    ground: ["🧴", "🔍", "🧴"],
    vorschau: ["#b9ece2", "#eefbf7", "#6cc4a1"],
  },
];

export const aktionById = (id) => aktionen.find((a) => a.id === id) ?? null;

/** „Keine Aktion“ als Karte für die Aktionsauswahl (ganz normaler Tag). */
export const KEINE_AKTION = { id: null, name: "Keine Aktion", emoji: "🐑", startText: "Ganz normaler Tag", vorschau: ["#cfe8f7", "#eaf6fd", "#6cae4f"] };
