// Native Dialoge begrenzen den Fokus und behandeln Escape für das oberste Fenster.
export function modal(knoten) {
  knoten.showModal();
  return { destroy: () => knoten.close() };
}
