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

const OPZIONI_STAMPA_DEFAULT = {
  cosa: "tutto", perPagina: 4, campo: "chiaro", copertina: true, note: true,
  perFormazione: true, formazioneVuota: true, raggruppa: "formazione",
  tipo: "playbook", carta: "A4", wristband: "schemi", copie: 1, miniSchemi: false, senzaSituazione: false, noteCallsheet: true,
};

/* ==========================================================================
   GRUPPI PER FORMAZIONE
   Gli schemi da stampare vengono divisi per formazione; l'ordine dei
   gruppi lo sceglie il coach e viene ricordato per ogni playbook.
   ========================================================================== */
function chiaveFormazione(schema) {
  return schema.formazione || "nessuna";
}

// Giocatori "puliti" della formazione (per la scheda della formazione vuota)
function giocatoriFormazione(chiave, lato) {
  if (chiave === "nessuna" || chiave === "libera") return null;
  const mia = FormazioniMie.trova(chiave);
  if (mia) return mia.giocatori;
  const pronta = FORMAZIONI[lato] && FORMAZIONI[lato].find((f) => f.id === chiave);
  return pronta ? pronta.giocatori : null;
}

function nomeGruppo(chiave, schemaEsempio) {
  if (chiave === "nessuna") return "Senza formazione";
  if (chiave === "libera") return "Formazioni libere";
  return nomeFormazione(schemaEsempio);
}

/* Gruppi per categoria: nell'ordine delle categorie (Corsa, Passaggio…),
   prima l'attacco poi la difesa; in fondo gli schemi senza categoria.
   Dentro ogni gruppo resta l'ordine del playbook. */
function gruppiPerCategoria(schemi, conLato) {
  const gruppi = [];
  for (const lato of ORDINE_LATI) {
    const delLato = schemi.filter((s) => s.lato === lato);
    if (!delLato.length) continue;
    const prefisso = conLato ? `${NOMI_LATO[lato]} · ` : "";
    for (const c of CATEGORIE[lato]) {
      const qui = delLato.filter((s) => s.categoria === c.id);
      if (qui.length) gruppi.push({ nome: `${prefisso}${c.icona} ${c.nome}`, lato, schemi: qui });
    }
    const senza = delLato.filter((s) => !categoriaDi(s));
    if (senza.length) gruppi.push({ nome: `${prefisso}Senza categoria`, lato, schemi: senza });
  }
  return gruppi;
}

/* Gruppi per tag: in ordine alfabetico, ogni schema sotto il suo primo tag
   (così nessuna pagina si ripete); in fondo quelli senza tag. */
function gruppiPerTag(schemi, conLato) {
  const gruppi = [];
  for (const lato of ORDINE_LATI) {
    const delLato = schemi.filter((s) => s.lato === lato);
    if (!delLato.length) continue;
    const prefisso = conLato ? `${NOMI_LATO[lato]} · ` : "";
    const tag = [...new Set(delLato.map((s) => (s.tag || [])[0]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "it"));
    for (const t of tag) gruppi.push({ nome: `${prefisso}#${t}`, lato, schemi: delLato.filter((s) => (s.tag || [])[0] === t) });
    const senza = delLato.filter((s) => !(s.tag || []).length);
    if (senza.length) gruppi.push({ nome: `${prefisso}Senza tag`, lato, schemi: senza });
  }
  return gruppi;
}

/* Gruppi per sezione (sezioni.js): nell'ordine delle sezioni del playbook,
   in fondo quelli senza sezione. */
function gruppiPerSezione(schemi, conLato) {
  const gruppi = [];
  for (const lato of ORDINE_LATI) {
    const delLato = schemi.filter((s) => s.lato === lato);
    if (!delLato.length) continue;
    const prefisso = conLato ? `${NOMI_LATO[lato]} · ` : "";
    for (const sez of sezioniDel(lato)) {
      const qui = delLato.filter((s) => s.sezione === sez.id);
      if (qui.length) gruppi.push({ nome: `${prefisso}${sez.nome}`, lato, schemi: qui });
    }
    const senza = delLato.filter((s) => !sezioneDi(s));
    if (senza.length) gruppi.push({ nome: `${prefisso}Senza sezione`, lato, schemi: senza });
  }
  return gruppi;
}

function chiaveOrdine() {
  return "playbook.ordine-formazioni." + (playbookCorrente ? playbookCorrente.id : "");
}

/* Restituisce i gruppi [{ chiave, nome, lato, schemi }] nell'ordine scelto dal coach.
   Prima l'attacco, poi la difesa; le formazioni nuove finiscono in fondo. */
function gruppiPerFormazione(schemi) {
  const mappa = new Map();
  for (const s of schemi) {
    const k = `${s.lato}|${chiaveFormazione(s)}`;
    if (!mappa.has(k)) mappa.set(k, { chiave: k, formazione: chiaveFormazione(s), lato: s.lato, nome: nomeGruppo(chiaveFormazione(s), s), schemi: [] });
    mappa.get(k).schemi.push(s);
  }
  const ordine = leggiLocale(chiaveOrdine()) || [];
  const posizione = (g) => {
    const i = ordine.indexOf(g.chiave);
    return i === -1 ? 10000 : i;
  };
  const gruppi = [...mappa.values()];
  // a parità (formazioni mai ordinate) resta l'ordine in cui compaiono nel playbook
  return gruppi
    .map((g, i) => ({ g, i }))
    .sort((a, b) => ORDINE_LATI.indexOf(a.g.lato) - ORDINE_LATI.indexOf(b.g.lato) ||
      posizione(a.g) - posizione(b.g) || a.i - b.i)
    .map(({ g }) => g);
}
let opzioniStampa = { ...OPZIONI_STAMPA_DEFAULT, ...(leggiLocale("playbook.opzioni-stampa") || {}) };

/* La finestra di stampa (galleria, stili, anteprima) è in stampa-scelta.js */

/* ---------- Lista "Ordine delle formazioni" (trascina o frecce) ---------- */
function cosaScelta() {
  const scelta = document.querySelector('input[name="stampa-cosa"]:checked');
  return scelta ? scelta.value : opzioniStampa.cosa;
}

function mostraOrdineFormazioni() {
  const raggruppa = $("#stampa-raggruppa").dataset.valore || "formazione";
  $("#stampa-per-formazione").checked = raggruppa === "formazione";
  $("#aiuto-raggruppa").textContent = {
    nessuno: "Gli schemi nell'ordine del playbook, uno dopo l'altro.",
    formazione: "Un gruppo per formazione, nell'ordine che scegli qui sotto.",
    categoria: "Corsa, Passaggio, Play action, RPO, Screen, Trick play… e in fondo quelli senza categoria.",
    tag: "Un gruppo per tag, in ordine alfabetico: ogni schema va sotto il suo primo tag.",
    sezione: "Un gruppo per sezione, nell'ordine delle sezioni; in fondo gli schemi senza sezione.",
  }[raggruppa];
  const attivo = raggruppa === "formazione";
  $("#blocco-formazioni").hidden = !attivo;
  if (!attivo) return;
  const lista = $("#ordine-formazioni");
  lista.innerHTML = "";
  const gruppi = gruppiPerFormazione(schemiDaStampare(cosaScelta()));
  gruppi.forEach((g, i) => {
    const riga = document.createElement("li");
    riga.className = "riga-ordine";
    riga.draggable = true;
    riga.dataset.chiave = g.chiave;
    riga.innerHTML = `
      <span class="maniglia-ordine" aria-hidden="true">⋮⋮</span>
      <span class="numero-ordine"></span>
      <span class="nome-ordine"></span>
      <span class="conteggio-ordine"></span>
      <button type="button" class="freccia-ordine" data-verso="-1" title="Sposta su">↑</button>
      <button type="button" class="freccia-ordine" data-verso="1" title="Sposta giù">↓</button>`;
    riga.querySelector(".numero-ordine").textContent = i + 1;
    riga.querySelector(".nome-ordine").textContent =
      g.nome + (gruppi.some((x) => x.lato !== g.lato) ? ` · ${NOMI_LATO[g.lato]}` : "");
    riga.querySelector(".conteggio-ordine").textContent = g.schemi.length === 1 ? "1 schema" : `${g.schemi.length} schemi`;
    riga.querySelector('[data-verso="-1"]').disabled = i === 0;
    riga.querySelector('[data-verso="1"]').disabled = i === gruppi.length - 1;
    riga.querySelectorAll(".freccia-ordine").forEach((b) =>
      b.addEventListener("click", () => spostaGruppo(g.chiave, Number(b.dataset.verso))));
    // Trascina e rilascia
    riga.addEventListener("dragstart", (e) => {
      riga.classList.add("trascinata");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", g.chiave);
    });
    riga.addEventListener("dragend", () => riga.classList.remove("trascinata"));
    riga.addEventListener("dragover", (e) => {
      e.preventDefault();
      const sopra = e.offsetY < riga.offsetHeight / 2;
      riga.classList.toggle("sopra", sopra);
      riga.classList.toggle("sotto", !sopra);
    });
    riga.addEventListener("dragleave", () => riga.classList.remove("sopra", "sotto"));
    riga.addEventListener("drop", (e) => {
      e.preventDefault();
      const prima = riga.classList.contains("sopra");
      riga.classList.remove("sopra", "sotto");
      const chiave = e.dataTransfer.getData("text/plain");
      if (chiave && chiave !== g.chiave) mettiGruppo(chiave, g.chiave, prima);
    });
    lista.appendChild(riga);
  });
}

function ordineAttuale() {
  return [...document.querySelectorAll("#ordine-formazioni .riga-ordine")].map((r) => r.dataset.chiave);
}

function salvaOrdineFormazioni(ordine) {
  // teniamo anche le formazioni non presenti in questa stampa, in coda
  const vecchio = (leggiLocale(chiaveOrdine()) || []).filter((k) => !ordine.includes(k));
  scriviLocale(chiaveOrdine(), [...ordine, ...vecchio]);
  mostraOrdineFormazioni();
  if (typeof aggiornaAnteprimaStampa === "function") aggiornaAnteprimaStampa(); // anche l'anteprima segue il nuovo ordine
  const riga = document.querySelector(`#ordine-formazioni [data-chiave="${CSS.escape(ordine.__mossa || "")}"]`);
  if (riga) riga.classList.add("appena-spostata");
}

function spostaGruppo(chiave, verso) {
  const ordine = ordineAttuale();
  const i = ordine.indexOf(chiave), j = i + verso;
  if (i < 0 || j < 0 || j >= ordine.length) return;
  [ordine[i], ordine[j]] = [ordine[j], ordine[i]];
  ordine.__mossa = chiave;
  salvaOrdineFormazioni(ordine);
}

function mettiGruppo(chiave, vicino, prima) {
  const ordine = ordineAttuale().filter((k) => k !== chiave);
  const i = ordine.indexOf(vicino);
  ordine.splice(prima ? i : i + 1, 0, chiave);
  ordine.__mossa = chiave;
  salvaOrdineFormazioni(ordine);
}

$("#stampa-per-formazione").addEventListener("change", mostraOrdineFormazioni);
$("#stampa-cosa").addEventListener("change", mostraOrdineFormazioni);

function chiudiFoglioStampa() {
  if (typeof chiudiTavolozzaColori === "function") chiudiTavolozzaColori();
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
["#stampa-campo", "#stampa-carta", "#stampa-raggruppa"].forEach((sel) => {
  $(sel).querySelectorAll(".segmento").forEach((b) =>
    b.addEventListener("click", () => {
      impostaSegmentato(sel, b.dataset.valore);
      if (sel === "#stampa-raggruppa") mostraOrdineFormazioni();
      aggiornaAnteprimaStampa(); // stampa-scelta.js
    }));
});

/* ==========================================================================
   COSTRUZIONE DELLE PAGINE
   ========================================================================== */
// NOMI_LATO (Attacco, Difesa, Special teams) è in speciali.js

// Ordine di stampa: quello del playbook (come nell'elenco), prima l'attacco poi la difesa
function schemiDaStampare(cosa) {
  let schemi = schemiDelPlaybook();
  if (cosa === "schema" && schemaCorrente) schemi = [Dati.trova(schemaCorrente.id)];
  else if (ORDINE_LATI.includes(cosa)) schemi = schemi.filter((s) => s.lato === cosa);
  return ORDINE_LATI.flatMap((lato) => schemi.filter((s) => s.lato === lato)); // attacco, difesa, special teams
}

function titoloStampa(cosa, schemi) {
  const nome = playbookCorrente ? playbookCorrente.nome : "Playbook";
  if (cosa === "schema") return schemi[0].nome || "Schema";
  if (cosa === "attacco") return `${nome} · Attacco`;
  if (cosa === "difesa") return `${nome} · Difesa`;
  if (cosa === "speciali") return `${nome} · Special teams`;
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

function schedaSchema(schema, numero, conNote, conAppunti = false) {
  const scheda = elemento("article", "scheda-schema");
  const titolo = elemento("div", "scheda-titolo");
  titolo.appendChild(elemento("span", "scheda-numero", String(numero)));
  titolo.appendChild(elemento("strong", "", schema.nome || "Senza nome"));
  const categoria = nomeCategoria(schema);
  titolo.appendChild(elemento("span", "scheda-info", `${NOMI_LATO[schema.lato]} · ${nomeFormazione(schema)}${categoria ? " · " + categoria : ""}`));
  scheda.appendChild(titolo);

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "campo-stampa");
  disegnaCampo(svg, schema, { stampa: true });
  scheda.appendChild(svg);

  if (conNote && schema.note && schema.note.trim()) {
    scheda.appendChild(elemento("p", "scheda-note", schema.note.trim()));
  }
  // Stile «Con spazio per appunti»: righe vuote da scrivere a penna
  if (conAppunti) scheda.appendChild(elemento("div", "scheda-appunti"));
  return scheda;
}

// Scheda con la sola formazione (giocatori schierati, nessuna traccia)
function schedaFormazione(gruppo) {
  const giocatori = giocatoriFormazione(gruppo.formazione, gruppo.lato);
  const scheda = elemento("article", "scheda-schema scheda-formazione");
  const titolo = elemento("div", "scheda-titolo");
  titolo.appendChild(elemento("span", "scheda-etichetta-formazione", "Formazione"));
  titolo.appendChild(elemento("strong", "", gruppo.nome));
  titolo.appendChild(elemento("span", "scheda-info", `${NOMI_LATO[gruppo.lato]} · ${gruppo.schemi.length} ${gruppo.schemi.length === 1 ? "schema" : "schemi"}`));
  scheda.appendChild(titolo);
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "campo-stampa");
  const esempio = gruppo.schemi[0];
  disegnaCampo(svg, {
    lato: gruppo.lato,
    formato: esempio.formato,
    categoria: esempio.categoria, // special teams: l'unità decide il campo (lungo o normale)
    // senza tracce: solo i giocatori della formazione
    giocatori: (giocatori || esempio.giocatori).map((g, i) => ({
      id: "f" + i, etichetta: g.etichetta, x: g.x, y: g.y,
      forma: g.forma || formaPedina(gruppo.lato, g.etichetta),
    })),
  }, { stampa: true });
  scheda.appendChild(svg);
  return scheda;
}

function copertina(titolo, schemi, paginaDi, gruppi = null) {
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
      const gruppo = gruppi && gruppi.find((g) => g.inizio === i);
      if (gruppo) lista.appendChild(elemento("li", "indice-gruppo", gruppo.nome));
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

/* Formato del foglio: A4 o A3, verticale o orizzontale.
   In A3 le stesse pagine vengono ingrandite (×1,41): tutto più grande e leggibile. */
function impostaPagina(orizzontale, carta = "A4") {
  let stilePagina = $("#stile-pagina");
  if (!stilePagina) {
    stilePagina = document.createElement("style");
    stilePagina.id = "stile-pagina";
    document.head.appendChild(stilePagina);
  }
  $("#stampa").classList.toggle("orizzontale", orizzontale);
  $("#stampa").classList.toggle("carta-a3", carta === "A3");
  stilePagina.textContent = `@page { size: ${carta} ${orizzontale ? "landscape" : "portrait"}; margin: 0; }`;
}

/* Costruisce le pagine in "contenitore" (di solito #stampa, nascosto).
   Con anteprima = true non tocca il formato della stampa vera: serve per
   le anteprime nella finestra di stampa (opzioni.limite = quanti schemi
   al massimo, per fare in fretta). Restituisce { titolo, pagine,
   orizzontale, carta }. */
function costruisciStampa(opzioni, contenitore = $("#stampa"), { anteprima = false } = {}) {
  const esito = costruisciPagine(opzioni, contenitore);
  if (!anteprima) {
    impostaPagina(esito.orizzontale, esito.carta);
    adattaTesti(contenitore); // i nomi lunghi si rimpiccioliscono (dopo il formato: A3 è più largo)
  }
  return esito;
}

function costruisciPagine(opzioni, contenitore) {
  // Wristband, call sheet e scout cards hanno una loro impaginazione (partita.js)
  if (opzioni.tipo === "wristband" || opzioni.tipo === "callsheet" || opzioni.tipo === "scout") {
    contenitore.innerHTML = "";
    contenitore.className = `stampa campo-${opzioni.campo || "chiaro"} tipo-${opzioni.tipo}`;
    const esito = opzioni.tipo === "wristband" ? costruisciWristband(opzioni, contenitore)
      : opzioni.tipo === "scout" ? costruisciScout(opzioni, contenitore)
      : costruisciCallSheet({ ...opzioni, note: opzioni.noteCallsheet !== false }, contenitore);
    // Il wristband resta in A4 verticale: gli inserti devono avere la misura vera (12 × 7 cm).
    // Scout cards: 1 per foglio in orizzontale, 2 per foglio in verticale.
    const orizzontale = opzioni.tipo === "callsheet" || (opzioni.tipo === "scout" && opzioni.scoutPerPagina !== 2);
    return { ...esito, orizzontale, carta: opzioni.tipo === "wristband" ? "A4" : opzioni.carta || "A4" };
  }
  const schemiTutti = schemiDaStampare(opzioni.cosa).slice(0, opzioni.limite || Infinity);
  const titolo = titoloStampa(opzioni.cosa, schemiTutti);
  const perPagina = opzioni.perPagina;
  const conCopertina = opzioni.copertina;
  const raggruppa = opzioni.raggruppa || (opzioni.perFormazione === false ? "nessuno" : "formazione");
  const dividi = raggruppa !== "nessuno" && opzioni.cosa !== "schema";

  /* Ogni "blocco" diventa una o più pagine: con il raggruppamento c'è un
     blocco per formazione, categoria o tag (che parte da una pagina nuova). */
  const gruppi = !dividi
    ? [{ nome: null, schemi: schemiTutti, formazione: null, lato: null }]
    : raggruppa === "categoria" ? gruppiPerCategoria(schemiTutti, opzioni.cosa === "tutto")
    : raggruppa === "sezione" ? gruppiPerSezione(schemiTutti, opzioni.cosa === "tutto")
    : raggruppa === "tag" ? gruppiPerTag(schemiTutti, opzioni.cosa === "tutto")
    : gruppiPerFormazione(schemiTutti);
  const schemi = gruppi.flatMap((g) => g.schemi); // ordine finale, per numeri e indice
  const blocchi = [];
  let numero = 0;
  for (const g of gruppi) {
    const elementi = [];
    if (dividi && raggruppa === "formazione" && opzioni.formazioneVuota && g.formazione !== "nessuna" && g.formazione !== "libera") {
      elementi.push({ tipo: "formazione", gruppo: g });
    }
    g.inizio = numero;
    for (const s of g.schemi) elementi.push({ tipo: "schema", schema: s, numero: ++numero });
    blocchi.push({ gruppo: g, elementi });
  }

  // Pagine: ogni blocco viene diviso in pagine da "perPagina" schede
  const pagine = [];
  for (const b of blocchi) {
    for (let i = 0; i < b.elementi.length; i += perPagina) {
      pagine.push({ gruppo: b.gruppo, elementi: b.elementi.slice(i, i + perPagina) });
    }
  }
  const primaPagina = conCopertina ? 2 : 1;
  const totale = pagine.length + (conCopertina ? 1 : 0);
  const paginaDi = (indiceSchema) =>
    primaPagina + pagine.findIndex((p) => p.elementi.some((e) => e.tipo === "schema" && e.numero === indiceSchema + 1));

  contenitore.innerHTML = "";
  contenitore.className = `stampa campo-${opzioni.campo} per-pagina-${perPagina}` + (opzioni.appunti ? " con-appunti" : "");

  if (conCopertina) contenitore.appendChild(copertina(titolo, schemi, paginaDi, dividi ? gruppi : null));

  pagine.forEach((p, i) => {
    const pag = elemento("section", "pagina-stampa");
    const titoloPagina = dividi && p.gruppo.nome ? `${titolo} · ${p.gruppo.nome}` : titolo;
    pag.appendChild(intestazione(titoloPagina, primaPagina + i, totale));
    const griglia = elemento("div", "griglia-stampa");
    for (const e of p.elementi) {
      griglia.appendChild(e.tipo === "formazione"
        ? schedaFormazione(e.gruppo)
        : schedaSchema(e.schema, e.numero, opzioni.note, opzioni.appunti));
    }
    pag.appendChild(griglia);
    pag.appendChild(elemento("p", "pagina-piede", "Creato con Playbook"));
    contenitore.appendChild(pag);
  });

  // Formato della pagina: 1 schema per pagina in orizzontale, gli altri in verticale
  return { titolo, pagine: totale, orizzontale: perPagina === 1, carta: opzioni.carta || "A4" };
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

/* ==========================================================================
   NOMI LUNGHI: CARATTERE PIÙ PICCOLO INVECE DEI PUNTINI
   Se il nome di uno schema non entra nel suo spazio (call sheet,
   wristband, scout cards, schede del playbook), il carattere si
   rimpicciolisce un po' alla volta finché entra tutto, fino a poco più
   di metà della grandezza normale (solo oltre restano i «…»).
   Le pagine di stampa sono nascoste: per misurarle le rendiamo
   visibili un attimo, fuori dallo schermo.
   ========================================================================== */
const MARGINE_TESTI = 0.93; // il testo deve occupare al massimo il 93% dello spazio
const TESTI_DA_ADATTARE = ".chiamata-nome, .inserto-nome, .carta-scout-testi strong, .scheda-titolo strong";

function adattaTesti(contenitore) {
  const elementi = [...contenitore.querySelectorAll(TESTI_DA_ADATTARE)];
  if (!elementi.length) return;
  const nascosto = getComputedStyle(contenitore).display === "none";
  const prima = contenitore.getAttribute("style") || "";
  if (nascosto) {
    contenitore.style.cssText += ";display:block;position:absolute;left:-100000px;top:0;visibility:hidden;";
  }
  try {
    for (const el of elementi) {
      if (!el.clientWidth) continue;
      const base = parseFloat(getComputedStyle(el).fontSize);
      const minimo = base * 0.5;
      let grandezza = base;
      while (alLimite(el, grandezza) && grandezza > minimo) grandezza = Math.max(minimo, grandezza - base * 0.04);
      el.style.fontSize = grandezza < base ? `${grandezza.toFixed(2)}px` : "";
    }
  } finally {
    if (nascosto) contenitore.setAttribute("style", prima);
  }
}

/* Il testo è al limite? Lo proviamo un po' più grande (margine di
   sicurezza): la stampante disegna le lettere un filo più larghe dello
   schermo, quindi se così non entra lo rimpiccioliamo. */
function alLimite(el, grandezza) {
  el.style.fontSize = `${(grandezza / MARGINE_TESTI).toFixed(2)}px`;
  const trabocca = el.scrollWidth > el.clientWidth + 0.5;
  el.style.fontSize = `${grandezza.toFixed(2)}px`;
  return trabocca;
}
