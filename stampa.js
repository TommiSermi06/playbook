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
  perFormazione: true, formazioneVuota: true,
  tipo: "playbook", wristband: "schemi", copie: 1, miniSchemi: false, senzaSituazione: false,
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
    .sort((a, b) => (a.g.lato === b.g.lato ? 0 : a.g.lato === "attacco" ? -1 : 1) ||
      posizione(a.g) - posizione(b.g) || a.i - b.i)
    .map(({ g }) => g);
}
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

  impostaSegmentato("#stampa-tipo", opzioniStampa.tipo || "playbook");
  impostaSegmentato("#stampa-wristband", opzioniStampa.wristband || "schemi");
  $("#stampa-copie").value = opzioniStampa.copie || 1;
  $("#stampa-mini-schemi").checked = Boolean(opzioniStampa.miniSchemi);
  $("#stampa-senza-situazione").checked = Boolean(opzioniStampa.senzaSituazione);
  $("#stampa-per-formazione").checked = opzioniStampa.perFormazione !== false;
  $("#stampa-formazione-vuota").checked = opzioniStampa.formazioneVuota !== false;
  mostraOrdineFormazioni();
  aggiornaOpzioniTipo();

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

/* ---------- Lista "Ordine delle formazioni" (trascina o frecce) ---------- */
function cosaScelta() {
  const scelta = document.querySelector('input[name="stampa-cosa"]:checked');
  return scelta ? scelta.value : opzioniStampa.cosa;
}

function mostraOrdineFormazioni() {
  const attivo = $("#stampa-per-formazione").checked;
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

function salvaOrdine(ordine) {
  // teniamo anche le formazioni non presenti in questa stampa, in coda
  const vecchio = (leggiLocale(chiaveOrdine()) || []).filter((k) => !ordine.includes(k));
  scriviLocale(chiaveOrdine(), [...ordine, ...vecchio]);
  mostraOrdineFormazioni();
  const riga = document.querySelector(`#ordine-formazioni [data-chiave="${CSS.escape(ordine.__mossa || "")}"]`);
  if (riga) riga.classList.add("appena-spostata");
}

function spostaGruppo(chiave, verso) {
  const ordine = ordineAttuale();
  const i = ordine.indexOf(chiave), j = i + verso;
  if (i < 0 || j < 0 || j >= ordine.length) return;
  [ordine[i], ordine[j]] = [ordine[j], ordine[i]];
  ordine.__mossa = chiave;
  salvaOrdine(ordine);
}

function mettiGruppo(chiave, vicino, prima) {
  const ordine = ordineAttuale().filter((k) => k !== chiave);
  const i = ordine.indexOf(vicino);
  ordine.splice(prima ? i : i + 1, 0, chiave);
  ordine.__mossa = chiave;
  salvaOrdine(ordine);
}

$("#stampa-per-formazione").addEventListener("change", mostraOrdineFormazioni);
$("#stampa-cosa").addEventListener("change", mostraOrdineFormazioni);

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
["#stampa-per-pagina", "#stampa-campo", "#stampa-tipo", "#stampa-wristband"].forEach((sel) => {
  $(sel).querySelectorAll(".segmento").forEach((b) =>
    b.addEventListener("click", () => {
      impostaSegmentato(sel, b.dataset.valore);
      if (sel === "#stampa-tipo") aggiornaOpzioniTipo();
    }));
});

/* Mostra le opzioni giuste per il tipo di stampa e un riepilogo
   (es. "12 schemi con il numero di chiamata") */
function aggiornaOpzioniTipo() {
  const tipo = $("#stampa-tipo").dataset.valore || "playbook";
  $("#opzioni-playbook").hidden = tipo !== "playbook";
  $("#opzioni-wristband").hidden = tipo !== "wristband";
  $("#opzioni-callsheet").hidden = tipo !== "callsheet";
  const info = $("#info-tipo");
  info.innerHTML = "";
  info.className = "info-tipo";
  if (tipo === "playbook") return;
  const schemi = schemiDaStampare(cosaScelta());
  if (tipo === "wristband") {
    const numerati = schemi.filter((s) => s.chiamata).length;
    if (numerati) {
      info.textContent = `${numerati} ${numerati === 1 ? "schema" : "schemi"} con il numero di chiamata`;
      if (numerati < schemi.length) info.textContent += ` (${schemi.length - numerati} senza numero restano fuori)`;
    } else {
      info.classList.add("da-fare");
      info.textContent = "Nessuno schema ha ancora un numero di chiamata. ";
    }
    if (numerati < schemi.length) {
      const b = Object.assign(document.createElement("button"), { type: "button", className: "btn-link", textContent: "Numera in automatico" });
      b.addEventListener("click", () => numeraInAutomatico(cosaScelta() === "difesa" ? "difesa" : "attacco"));
      info.appendChild(b);
    }
  } else {
    const conSituazione = schemi.filter((s) => (s.situazioni || []).length).length;
    info.textContent = conSituazione
      ? `${conSituazione} ${conSituazione === 1 ? "schema" : "schemi"} con almeno una situazione`
      : "Nessuno schema ha ancora una situazione: aprili e scegli 1° & 10, 3° & corto, Red zone… nella sezione «Partita».";
    if (!conSituazione) info.classList.add("da-fare");
  }
}
$("#stampa-cosa").addEventListener("change", aggiornaOpzioniTipo);

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
    perFormazione: $("#stampa-per-formazione").checked,
    formazioneVuota: $("#stampa-formazione-vuota").checked,
    tipo: $("#stampa-tipo").dataset.valore || "playbook",
    wristband: $("#stampa-wristband").dataset.valore || "schemi",
    copie: Math.max(1, Math.min(10, parseInt($("#stampa-copie").value, 10) || 1)),
    miniSchemi: $("#stampa-mini-schemi").checked,
    senzaSituazione: $("#stampa-senza-situazione").checked,
  };
  // Un wristband senza numeri di chiamata sarebbe vuoto
  if (opzioniStampa.tipo === "wristband" && !schemiNumerati(schemiDaStampare(opzioniStampa.cosa)).length) {
    $("#errore-stampa").textContent = "Dai prima un numero di chiamata agli schemi (o usa «Numera in automatico»).";
    return;
  }
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
    // senza tracce: solo i giocatori della formazione
    giocatori: (giocatori || esempio.giocatori).map((g, i) => ({
      id: "f" + i, etichetta: g.etichetta, x: g.x, y: g.y,
      forma: g.forma || (gruppo.lato === "attacco" ? (g.etichetta === "C" ? "quadrato" : "cerchio") : "lettera"),
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

// Formato del foglio (A4 verticale o orizzontale) per la stampa
function impostaPagina(orizzontale) {
  let stilePagina = $("#stile-pagina");
  if (!stilePagina) {
    stilePagina = document.createElement("style");
    stilePagina.id = "stile-pagina";
    document.head.appendChild(stilePagina);
  }
  $("#stampa").classList.toggle("orizzontale", orizzontale);
  stilePagina.textContent = `@page { size: A4 ${orizzontale ? "landscape" : "portrait"}; margin: 0; }`;
}

function costruisciStampa(opzioni) {
  // Wristband e call sheet hanno una loro impaginazione (partita.js)
  if (opzioni.tipo === "wristband" || opzioni.tipo === "callsheet") {
    const contenitore = $("#stampa");
    contenitore.innerHTML = "";
    contenitore.className = `stampa campo-${opzioni.campo} tipo-${opzioni.tipo}`;
    const esito = opzioni.tipo === "wristband"
      ? costruisciWristband(opzioni, contenitore)
      : costruisciCallSheet(opzioni, contenitore);
    impostaPagina(opzioni.tipo === "callsheet");
    return esito;
  }
  const schemiTutti = schemiDaStampare(opzioni.cosa);
  const titolo = titoloStampa(opzioni.cosa, schemiTutti);
  const perPagina = opzioni.perPagina;
  const conCopertina = opzioni.copertina;
  const dividi = opzioni.perFormazione && opzioni.cosa !== "schema";

  /* Ogni "blocco" diventa una o più pagine: con la divisione per formazioni
     c'è un blocco per formazione (che parte sempre da una pagina nuova). */
  const gruppi = dividi
    ? gruppiPerFormazione(schemiTutti)
    : [{ nome: null, schemi: schemiTutti, formazione: null, lato: null }];
  const schemi = gruppi.flatMap((g) => g.schemi); // ordine finale, per numeri e indice
  const blocchi = [];
  let numero = 0;
  for (const g of gruppi) {
    const elementi = [];
    if (dividi && opzioni.formazioneVuota && g.formazione !== "nessuna" && g.formazione !== "libera") {
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

  const contenitore = $("#stampa");
  contenitore.innerHTML = "";
  contenitore.className = `stampa campo-${opzioni.campo} per-pagina-${perPagina}`;

  if (conCopertina) contenitore.appendChild(copertina(titolo, schemi, paginaDi, dividi ? gruppi : null));

  pagine.forEach((p, i) => {
    const pag = elemento("section", "pagina-stampa");
    const titoloPagina = dividi && p.gruppo.nome ? `${titolo} · ${p.gruppo.nome}` : titolo;
    pag.appendChild(intestazione(titoloPagina, primaPagina + i, totale));
    const griglia = elemento("div", "griglia-stampa");
    for (const e of p.elementi) {
      griglia.appendChild(e.tipo === "formazione"
        ? schedaFormazione(e.gruppo)
        : schedaSchema(e.schema, e.numero, opzioni.note));
    }
    pag.appendChild(griglia);
    pag.appendChild(elemento("p", "pagina-piede", "Creato con Playbook"));
    contenitore.appendChild(pag);
  });

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
