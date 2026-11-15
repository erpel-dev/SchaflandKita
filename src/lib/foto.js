// Foto vom Kuscheltier: quadratisch zuschneiden und auf 512 px verkleinern, damit es in die
// Datenbank und in die Export-Datei passt.
export async function fotoVerkleinern(datei, kante = 512) {
  const bild = await createImageBitmap(datei, { imageOrientation: "from-image" });
  const s = Math.min(bild.width, bild.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(kante, s);
  canvas.getContext("2d").drawImage(bild, (bild.width - s) / 2, (bild.height - s) / 2, s, s, 0, 0, canvas.width, canvas.height);
  bild.close?.();
  return canvas.toDataURL("image/jpeg", 0.82);
}

/** Text als Datei speichern (Export). */
export function herunterladen(dateiname, text, typ = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type: typ }));
  const a = Object.assign(document.createElement("a"), { href: url, download: dateiname });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
