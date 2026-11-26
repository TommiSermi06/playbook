/* ==========================================================================
   RIORDINO DEGLI SCHEMI
   --------------------------------------------------------------------------
   Il proprietario del playbook cambia l'ordine degli schemi:
   - trascinando una riga dell'elenco sopra o sotto un'altra
   - oppure con Alt + ↑ / ↓ sullo schema aperto
   L'ordine si salva nel playbook (playbook.ordine = [id degli schemi]),
   quindi è lo stesso su computer, telefono, stampa, link condiviso e per
   i co-allenatori. Gli schemi nuovi compaiono in cima finché non li sposti.
   ========================================================================== */

let idTrascinato = null;

// Si riordina solo nei propri playbook e quando l'elenco non è filtrato dalla ricerca
function puoRiordinare() {
  return Boolean(playbookCorrente)
    && Playbook.permesso(playbookCorrente.id) === "proprietario"
    && !$("#cerca").value.trim()
    && filtroCategoria === "tutte"; // con l'elenco filtrato l'ordine sarebbe ambiguo
}

// Chiamata da mostraElenco() per ogni riga
function abilitaRiordino(riga, schema) {
  if (!puoRiordinare()) return;
  riga.draggable = true;
  riga.classList.add("riordinabile");
  riga.title = "Trascina per cambiare l'ordine (oppure Alt + ↑ ↓)";

  riga.addEventListener("dragstart", (e) => {
    idTrascinato = schema.id;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", schema.id);
    // Un attimo dopo, così l'immagine trascinata resta "piena"
    requestAnimationFrame(() => riga.classList.add("in-trascinamento"));
    document.body.classList.add("riordino-in-corso");
  });
  riga.addEventListener("dragend", () => {
    idTrascinato = null;
    riga.classList.remove("in-trascinamento");
    document.body.classList.remove("riordino-in-corso");
    togliSegni();
  });
  riga.addEventListener("dragover", (e) => {
    if (!idTrascinato || idTrascinato === schema.id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const sopra = metaSopra(riga, e);
    togliSegni(riga);
    riga.classList.toggle("inserisci-sopra", sopra);
    riga.classList.toggle("inserisci-sotto", !sopra);
  });
  riga.addEventListener("dragleave", (e) => {
    if (!riga.contains(e.relatedTarget)) riga.classList.remove("inserisci-sopra", "inserisci-sotto");
  });
  riga.addEventListener("drop", (e) => {
    if (!idTrascinato || idTrascinato === schema.id) return;
    e.preventDefault();
    const sopra = metaSopra(riga, e);
    const mosso = idTrascinato;
    togliSegni();
    spostaSchema(mosso, schema.id, sopra);
  });
}

function metaSopra(riga, e) {
  const r = riga.getBoundingClientRect();
  return e.clientY < r.top + r.height / 2;
}
function togliSegni(tranne = null) {
  document.querySelectorAll(".inserisci-sopra, .inserisci-sotto").forEach((r) => {
    if (r !== tranne) r.classList.remove("inserisci-sopra", "inserisci-sotto");
  });
}

/* Mette lo schema "id" prima (o dopo) dello schema "rif" */
function spostaSchema(id, rif, prima) {
  const ordine = schemiDelPlaybook().map((s) => s.id).filter((x) => x !== id);
  let i = ordine.indexOf(rif);
  if (i < 0) return;
  if (!prima) i++;
  ordine.splice(i, 0, id);
  salvaOrdine(ordine, id);
}

function salvaOrdine(nuovo, idMosso) {
  const pb = playbookCorrente;
  const vecchio = pb.ordine ? [...pb.ordine] : null;
  pb.ordine = nuovo;
  Playbook.salva(pb);
  mostraElenco();
  // La riga spostata "brilla" un attimo
  const riga = document.querySelector(`#lista-schemi .riga[data-id="${idMosso}"]`);
  if (riga) {
    riga.classList.add("appena-spostata");
    riga.scrollIntoView({ block: "nearest", behavior: "smooth" });
    setTimeout(() => riga.classList.remove("appena-spostata"), 900);
  }
  aggiornaOrdineSeCondiviso(pb.id); // anche il link in sola lettura segue il nuovo ordine
  mostraAvviso("Ordine aggiornato", () => {
    if (vecchio) pb.ordine = vecchio; else delete pb.ordine;
    Playbook.salva(pb);
    mostraElenco();
    aggiornaOrdineSeCondiviso(pb.id);
  });
}

/* Alt + ↑ / ↓: sposta lo schema aperto di un posto (tra quelli dello stesso lato) */
function spostaSchemaCorrente(verso) {
  if (!schemaCorrente || !puoRiordinare()) return;
  const stessoLato = schemiDelPlaybook().filter((s) => s.lato === schemaCorrente.lato).map((s) => s.id);
  const i = stessoLato.indexOf(schemaCorrente.id);
  const vicino = stessoLato[i + verso];
  if (!vicino) return;
  spostaSchema(schemaCorrente.id, vicino, verso < 0);
}
