// Die Profile, die beim allerersten Start angelegt werden. Gleiches Format wie die Export-Datei,
// mit festen ids, damit ein späterer Import derselben Datei nichts verdoppelt.
export const BEISPIELE = {
  format: "schafland-kita",
  version: 1,
  profile: [
    { id: "beispiel-erpel", rolle: "erzieher", name: "Erpel", bild: { art: "emoji", wert: "🦆" }, farbe: "#d8efc9", ueblicheZeit: "16:00" },
    { id: "beispiel-manfred", rolle: "erzieher", name: "Manfred", bild: { art: "emoji", wert: "🐻" }, farbe: "#ffd9b8", ueblicheZeit: "16:00" },
    { id: "beispiel-lola", rolle: "erzieher", name: "Lola", bild: { art: "emoji", wert: "🐰" }, farbe: "#fbd0d8", ueblicheZeit: "14:00" },
    { id: "beispiel-eichel", rolle: "erzieher", name: "Eichel", bild: { art: "emoji", wert: "🐿️" }, farbe: "#e3d6f5", ueblicheZeit: "16:00" },
    { id: "beispiel-wolli", rolle: "kind", name: "Wolli", bild: { art: "schaf", wert: "weiss" }, farbe: "#cfe8f7", ueblicheZeit: "15:00" },
    { id: "beispiel-scheepi", rolle: "kind", name: "Scheepi", bild: { art: "schaf", wert: "braun" }, farbe: "#d8efc9", ueblicheZeit: "14:00" },
    { id: "beispiel-erpelkueken", rolle: "kind", name: "Erpelküken", bild: { art: "emoji", wert: "🐥" }, farbe: "#ffe9a8", ueblicheZeit: "12:30" },
  ],
};
