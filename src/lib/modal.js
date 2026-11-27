const dialoge = [];
let hinweis;

function hinweisPlatzieren() {
  if (!hinweis) return;
  const ziel = dialoge.at(-1) ?? hinweis.anker;
  if (hinweis.element.parentNode !== ziel) ziel.append(hinweis.element);
}

// Native Dialoge begrenzen den Fokus und behandeln Escape für das oberste Fenster.
export function modal(knoten) {
  knoten.showModal();
  dialoge.push(knoten);
  hinweisPlatzieren();
  return {
    destroy() {
      dialoge.splice(dialoge.indexOf(knoten), 1);
      hinweisPlatzieren();
      knoten.close();
    },
  };
}

// Eine Statusmeldung gehört in das oberste Dialogfenster, damit sie sichtbar und zugänglich bleibt.
export function hinweisImVordergrund(anker, text) {
  const element = anker.ownerDocument.createElement("div");
  element.className = "app-hinweis";
  element.setAttribute("role", "status");
  hinweis = { anker, element };
  hinweisPlatzieren();
  element.textContent = text;
  return {
    update(neuerText) {
      element.textContent = neuerText;
    },
    destroy() {
      element.remove();
      hinweis = undefined;
    },
  };
}
