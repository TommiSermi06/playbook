/* ==========================================================================
   STAMPA E PDF DEL PLAYBOOK
   --------------------------------------------------------------------------
   1. Il coach sceglie cosa stampare e come (finestra "Stampa il playbook").
   2. Costruiamo le pagine A4 in un contenitore nascosto (#stampa):
      copertina con logo e indice, poi gli schemi (1, 2, 4 o 6 per pagina),
      ognuna con logo, nome della squadra e numero di pagina.
   3. Apriamo la finestra di stampa del browser: lì si sceglie la stampante
      oppure "Salva come PDF". I campi restano disegni vettoriali: nitidi
      a qualsiasi dimensione.
   ========================================================================== */

const OPZIONI_STAMPA_DEFAULT = { cosa: "tutto", perPagina: 4, campo: "chiaro", copertina: true, note: true };
let opzioniStampa = { ...OPZIONI_STAMPA_DEFAULT, ...(leggiLocale("playbook.opzioni-stampa") || {}) };

/* ---------- Finestra delle opzioni ---------- */
function apriFoglioStampa() {
  if (Tracce.disegno) Tracce.annullaDisegno();
  chiudiMenuTracce();
  salvaSubito();

  if (!playbookCorrente) return; // si stampa da dentro un playbook
  const tutti = schemiDelPlaybook();
  const conta = (lato) => tutti.filter((s) => s.lato === lato).length;
  const scelte = [
    { id: "schema", testo: "Solo lo schema aperto", n: schemaCorrente ? 1 : 0 },
    { id: "attacco", testo: "Tutto l'attacco", n: conta("attacco") },
    { id: "difesa", testo: "Tutta la difesa", n: conta("difesa") },
    { id: "tutto", testo: `Tutto «${playbookCorrente.nome}»`, n: tutti.length },
  ];
  // Se la scelta salvata non ha schemi, passiamo alla prima che ne ha
  if (!scelte.find((s) => s.id === opzioniStampa.cosa && s.n)) {
    opzioniStampa.cosa = (scelte.find((s) => s.n) || scelte[3]).id;
  }

  const lista = $("#stampa-cosa");
  lista.innerHTML = "";
  for (const s of scelte) {
    const riga = document.createElement("label");
    riga.className = "scelta-stampa" + (s.n ? "" : " vuota");
    riga.innerHTML = `<input type="radio" name="stampa-cosa"><span></span><span class="conteggio-stampa"></span>`;
    const radio = riga.querySelector("input");
    radio.value = s.id;
    radio.disabled = !s.n;
    radio.checked = opzioniStampa.cosa === s.id;
    riga.querySelector("span").textContent = s.testo;
    riga.querySelector(".conteggio-stampa").textContent = s.n === 1 ? "1 schema" : `${s.n} schemi`;
    lista.appendChild(riga);
  }

  impostaSegmentato("#stampa-per-pagina", String(opzioniStampa.perPagina));
  impostaSegmentato("#stampa-campo", opzioniStampa.campo);
  $("#stampa-copertina").checked = opzioniStampa.copertina;
  $("#stampa-note").checked = opzioniStampa.note;
  $("#errore-stampa").textContent = tutti.length ? "" : "Non ci sono ancora schemi da stampare.";
  $("#btn-stampa-vai").disabled = !tutti.length;

  $("#velo").hidden = false;
  $("#foglio-stampa").hidden = false;
  requestAnimationFrame(() => {
    $("#velo").classList.add("visibile");
    $("#foglio-stampa").classList.add("visibile");
  });
}

function chiudiFoglioStampa() {
  $("#velo").classList.remove("visibile");
  $("#foglio-stampa").classList.remove("visibile");
  setTimeout(() => {
    $("#velo").hidden = true;
    $("#foglio-stampa").hidden = true;
  }, 220);
}

// Controlli segmentati della finestra (1/2/4/6 per pagina, campo chiaro/scuro)
function impostaSegmentato(selettore, valore) {
  const gruppo = $(selettore);
  const bottoni = [...gruppo.querySelectorAll(".segmento")];
  const indice = Math.max(0, bottoni.findIndex((b) => b.dataset.valore === valore));
  bottoni.forEach((b, i) => b.classList.toggle("attivo", i === indice));
  gruppo.style.setProperty("--indice", indice);
  gruppo.dataset.valore = bottoni[indice].dataset.valore;
}
["#stampa-per-pagina", "#stampa-campo"].forEach((sel) => {
  $(sel).querySelectorAll(".segmento").forEach((b) =>
    b.addEventListener("click", () => impostaSegmentato(sel, b.dataset.valore)));
});

$("#btn-stampa").addEventListener("click", apriFoglioStampa);
$("#btn-stampa-annulla").addEventListener("click", chiudiFoglioStampa);
$("#foglio-stampa").addEventListener("submit", (e) => {
  e.preventDefault();
  const scelta = document.querySelector('input[name="stampa-cosa"]:checked');
  opzioniStampa = {
    cosa: scelta ? scelta.value : "tutto",
    perPagina: Number($("#stampa-per-pagina").dataset.valore),
    campo: $("#stampa-campo").dataset.valore,
    copertina: $("#stampa-copertina").checked,
    note: $("#stampa-note").checked,
  };
  scriviLocale("playbook.opzioni-stampa", opzioniStampa);
  chiudiFoglioStampa();
  setTimeout(() => stampaPlaybook(opzioniStampa), 250); // dopo la chiusura della finestra
});

/* ==========================================================================
   COSTRUZIONE DELLE PAGINE
   ========================================================================== */
const NOMI_LATO = { attacco: "Attacco", difesa: "Difesa" };

// Ordine di stampa: quello del playbook (come nell'elenco), prima l'attacco poi la difesa
function schemiDaStampare(cosa) {
  let schemi = schemiDelPlaybook();
  if (cosa === "schema" && schemaCorrente) schemi = [Dati.trova(schemaCorrente.id)];
  else if (cosa === "attacco" || cosa === "difesa") schemi = schemi.filter((s) => s.lato === cosa);
  return [...schemi.filter((s) => s.lato === "attacco"), ...schemi.filter((s) => s.lato !== "attacco")];
}

function titoloStampa(cosa, schemi) {
  const nome = playbookCorrente ? playbookCorrente.nome : "Playbook";
  if (cosa === "schema") return schemi[0].nome || "Schema";
  if (cosa === "attacco") return `${nome} · Attacco`;
  if (cosa === "difesa") return `${nome} · Difesa`;
  return nome;
}

function elemento(tag, classe, testo) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (testo !== undefined) el.textContent = testo;
  return el;
}

// Intestazione di ogni pagina: logo, squadra, titolo e numero di pagina
function intestazione(titolo, numero, totale) {
  const testa = elemento("header", "pagina-testa");
  const sinistra = elemento("div", "pagina-squadra");
  if (Squadra.logo) {
    const img = document.createElement("img");
    img.src = Squadra.logo;
    img.alt = "";
    sinistra.appendChild(img);
  }
  const testi = elemento("div");
  testi.appendChild(elemento("strong", "", Squadra.nome || "Playbook"));
  testi.appendChild(elemento("span", "", titolo));
  sinistra.appendChild(testi);
  testa.appendChild(sinistra);
  testa.appendChild(elemento("span", "pagina-numero", `Pagina ${numero} di ${totale}`));
  return testa;
}

function schedaSchema(schema, numero, conNote) {
  const scheda = elemento("article", "scheda-schema");
  const titolo = elemento("div", "scheda-titolo");
  titolo.appendChild(elemento("span", "scheda-numero", String(numero)));
  titolo.appendChild(elemento("strong", "", schema.nome || "Senza nome"));
  titolo.appendChild(elemento("span", "scheda-info", `${NOMI_LATO[schema.lato]} · ${nomeFormazione(schema)}`));
  scheda.appendChild(titolo);

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "campo-stampa");
  disegnaCampo(svg, schema, { stampa: true });
  scheda.appendChild(svg);

  if (conNote && schema.note && schema.note.trim()) {
    scheda.appendChild(elemento("p", "scheda-note", schema.note.trim()));
  }
  return scheda;
}

function copertina(titolo, schemi, paginaDi) {
  const pag = elemento("section", "pagina-stampa copertina");
  const centro = elemento("div", "copertina-centro");
  if (Squadra.logo) {
    const img = document.createElement("img");
    img.src = Squadra.logo;
    img.alt = "";
    img.className = "copertina-logo";
    centro.appendChild(img);
  }
  centro.appendChild(elemento("p", "copertina-squadra", Squadra.nome || "La tua squadra"));
  centro.appendChild(elemento("h1", "copertina-titolo", titolo));
  const data = new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
  centro.appendChild(elemento("p", "copertina-data", `${schemi.length} ${schemi.length === 1 ? "schema" : "schemi"} · aggiornato al ${data}`));
  pag.appendChild(centro);

  // Indice: numero, nome, formazione e pagina di ogni schema
  if (schemi.length > 1) {
    const indice = elemento("div", "indice");
    indice.appendChild(elemento("h2", "", "Indice"));
    const lista = elemento("ol", "indice-lista");
    schemi.forEach((s, i) => {
      const voce = elemento("li");
      voce.appendChild(elemento("span", "indice-numero", String(i + 1)));
      voce.appendChild(elemento("span", "indice-nome", s.nome || "Senza nome"));
      voce.appendChild(elemento("span", "indice-info", `${NOMI_LATO[s.lato]} · ${nomeFormazione(s)}`));
      voce.appendChild(elemento("span", "indice-pagina", `pag. ${paginaDi(i)}`));
      lista.appendChild(voce);
    });
    indice.appendChild(lista);
    pag.appendChild(indice);
  }
  pag.appendChild(elemento("p", "pagina-piede", "Creato con Playbook"));
  return pag;
}

function costruisciStampa(opzioni) {
  const schemi = schemiDaStampare(opzioni.cosa);
  const titolo = titoloStampa(opzioni.cosa, schemi);
  const perPagina = opzioni.perPagina;
  const pagineSchemi = Math.ceil(schemi.length / perPagina);
  const conCopertina = opzioni.copertina;
  const totale = pagineSchemi + (conCopertina ? 1 : 0);
  const paginaDi = (i) => Math.floor(i / perPagina) + 1 + (conCopertina ? 1 : 0);

  const contenitore = $("#stampa");
  contenitore.innerHTML = "";
  contenitore.className = `stampa campo-${opzioni.campo} per-pagina-${perPagina}`;

  if (conCopertina) contenitore.appendChild(copertina(titolo, schemi, paginaDi));

  for (let p = 0; p < pagineSchemi; p++) {
    const numeroPagina = p + 1 + (conCopertina ? 1 : 0);
    const pag = elemento("section", "pagina-stampa");
    pag.appendChild(intestazione(titolo, numeroPagina, totale));
    const griglia = elemento("div", "griglia-stampa");
    schemi.slice(p * perPagina, (p + 1) * perPagina).forEach((s, i) => {
      griglia.appendChild(schedaSchema(s, p * perPagina + i + 1, opzioni.note));
    });
    pag.appendChild(griglia);
    pag.appendChild(elemento("p", "pagina-piede", "Creato con Playbook"));
    contenitore.appendChild(pag);
  }

  // Formato della pagina: 1 schema per pagina in orizzontale, gli altri in verticale
  let stilePagina = $("#stile-pagina");
  if (!stilePagina) {
    stilePagina = document.createElement("style");
    stilePagina.id = "stile-pagina";
    document.head.appendChild(stilePagina);
  }
  const orizzontale = perPagina === 1;
  contenitore.classList.toggle("orizzontale", orizzontale);
  stilePagina.textContent = `@page { size: A4 ${orizzontale ? "landscape" : "portrait"}; margin: 0; }`;
  return { titolo, pagine: totale };
}

// Aspetta che i loghi siano caricati, poi apre la finestra di stampa
async function stampaPlaybook(opzioni) {
  const { titolo } = costruisciStampa(opzioni);
  const immagini = [...document.querySelectorAll("#stampa img, #stampa image")];
  await Promise.all(immagini.map((img) => (img.decode ? img.decode().catch(() => {}) : null)));
  const titoloPagina = document.title;
  // Il titolo della pagina diventa il nome proposto per il file PDF
  document.title = `${Squadra.nome ? Squadra.nome + " - " : ""}${titolo}`;
  document.body.classList.add("in-stampa");
  window.print();
  // Dopo la stampa (o l'annullamento) si torna all'app
  document.title = titoloPagina;
  document.body.classList.remove("in-stampa");
}
