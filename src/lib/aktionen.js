// Aktionen: besondere Tage mit eigenem Aussehen (Farben in app.css, Kostüm in Sheep.svelte,
// Himmel in Deko.svelte). Neue Aktionen hinten anhängen.
export const aktionen = [
  {
    id: "sommerfest",
    name: "Sommerfest",
    emoji: "🎪",
    beschreibung: "Sonniger Himmel mit Wimpelkette, Schafe mit Sonnenbrille und Partyhut.",
    startText: "Heute ist Sommerfest!",
    gruss: "Willkommen zum Sommerfest!",
    ground: ["🎈", "🍦", "🌻"],
  },
  {
    id: "kuerbisfest",
    name: "Kürbisfest",
    emoji: "🎃",
    beschreibung: "Herbsthimmel mit fallenden Blättern, Kürbis-Orange und Schafe mit Kürbishut.",
    startText: "Heute ist Kürbisfest!",
    gruss: "Willkommen zum Kürbisfest!",
    ground: ["🎃", "🌽", "🎃"],
  },
  {
    id: "weihnachtsmarkt",
    name: "Weihnachtsmarkt",
    emoji: "🎄",
    beschreibung: "Winterabend mit Lichterkette und Schnee, Weihnachtsrot und Schafe mit Weihnachtsmütze.",
    startText: "Heute ist Weihnachtsmarkt!",
    gruss: "Willkommen auf dem Weihnachtsmarkt!",
    ground: ["🎄", "🎁", "🎄"],
  },
];

export const aktionById = (id) => aktionen.find((a) => a.id === id) ?? null;
