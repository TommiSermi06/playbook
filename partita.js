/* ==========================================================================
   PARTITA: numero di chiamata, situazioni, wristband e call sheet
   --------------------------------------------------------------------------
   Ogni schema può avere:
     schema.chiamata   = 12            numero con cui lo si chiama in campo
     schema.situazioni = ["3-corto", "red-zone"]
   Con questi dati si stampano:
   - il WRISTBAND del QB (inserti 12 × 7 cm da ritagliare)
   - il CALL SHEET del coordinatore (schemi divisi per situazione)
   ========================================================================== */

const SITUAZIONI = [
  { id: "1-10",      nome: "1° & 10" },
  { id: "2-corto",   nome: "2° & corto" },
  { id: "2-lungo",   nome: "2° & lungo" },
  { id: "3-corto",   nome: "3° & corto" },
  { id: "3-medio",   nome: "3° & medio" },
  { id: "3-lungo",   nome: "3° & lungo" },
  { id: "red-zone",  nome: "Red zone" },
  { id: "goal-line", nome: "Goal line" },
  { id: "2-minuti",  nome: "2 minuti" },
  { id: "apertura",  nome: "Apertura (script)" },
];

/* ---------- Pannello "Partita" dello schema aperto ---------- */
function mostraPartita() {
  const box = $("#pannello-partita");
  if (!schemaCorrente) return;
  const s = schemaCorrente;
  if (modificheVietate()) { mostraPartitaSolaLettura(box, s); return; }
  box.innerHTML = `
    <div class="riga-campo">
      <span>N° di chiamata</span>
      <input id="numero-chiamata" type="number" min="1" max="999" inputmode="numeric" placeholder="—">
    </div>
    <p class="avviso-chiamata" id="avviso-chiamata"></p>
    <div class="situazioni" id="situazioni"></div>
    <button type="button" class="btn-mini" id="btn-numera">Numera in automatico</button>`;

  const campo = $("#numero-chiamata");
  campo.value = s.chiamata || "";
  controllaDoppione();
  campo.addEventListener("input", () => {
    const n = parseInt(campo.value, 10);
    if (Number.isNaN(n) || n < 1) delete schemaCorrente.chiamata;
    else schemaCorrente.chiamata = Math.min(999, n);
    controllaDoppione();
    salvaTraPoco();
  });
  campo.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === "Escape") campo.blur(); });

  // Situazioni: pillole da accendere e spegnere
  const scelte = new Set(s.situazioni || []);
  for (const sit of SITUAZIONI) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "situazione" + (scelte.has(sit.id) ? " attiva" : "");
    b.textContent = sit.nome;
    b.addEventListener("click", () => {
      const lista = new Set(schemaCorrente.situazioni || []);
      lista.has(sit.id) ? lista.delete(sit.id) : lista.add(sit.id);
      schemaCorrente.situazioni = SITUAZIONI.map((x) => x.id).filter((id) => lista.has(id));
      b.classList.toggle("attiva", lista.has(sit.id));
      b.classList.remove("scatta");
      void b.offsetWidth;
      b.classList.add("scatta");
      salvaTraPoco();
    });
    $("#situazioni").appendChild(b);
  }
  $("#btn-numera").addEventListener("click", () => numeraInAutomatico(schemaCorrente.lato));
}

// Nel link condiviso: solo il numero e le situazioni scelte dal coach
function mostraPartitaSolaLettura(box, s) {
  box.innerHTML = `
    <div class="riga-campo"><span>N° di chiamata</span><span class="valore numero-fisso"></span></div>
    <div class="situazioni" id="situazioni"></div>`;
  box.querySelector(".numero-fisso").textContent = s.chiamata || "—";
  const scelte = new Set(s.situazioni || []);
  const lista = SITUAZIONI.filter((x) => scelte.has(x.id));
  for (const sit of lista) box.querySelector("#situazioni").appendChild(elemento("span", "situazione attiva", sit.nome));
  if (!lista.length) box.querySelector("#situazioni").appendChild(elemento("span", "testo-secondario", "Nessuna situazione"));
}

// Avvisa se lo stesso numero è già usato da un altro schema dello stesso lato
function controllaDoppione() {
  const avviso = $("#avviso-chiamata");
  if (!avviso || !schemaCorrente) return;
  const n = schemaCorrente.chiamata;
  const altro = n && schemiDelPlaybook().find((x) =>
    x.id !== schemaCorrente.id && x.lato === schemaCorrente.lato && x.chiamata === n);
  avviso.textContent = altro ? `Il ${n} è già usato da «${altro.nome || "Senza nome"}»` : "";
}

/* Dà un numero agli schemi che non ce l'hanno, nell'ordine del playbook,
   partendo dal primo numero libero. Quelli già numerati non cambiano. */
function numeraInAutomatico(lato) {
  salvaInSospeso();
  const schemi = schemiDelPlaybook().filter((s) => s.lato === lato);
  const usati = new Set(schemi.filter((s) => s.chiamata).map((s) => s.chiamata));
  const daNumerare = schemi.filter((s) => !s.chiamata);
  if (!daNumerare.length) {
    mostraAvviso("Tutti gli schemi hanno già un numero");
    return;
  }
  const prima = JSON.parse(JSON.stringify(daNumerare));
  let n = 1;
  for (const s of daNumerare) {
    while (usati.has(n)) n++;
    s.chiamata = n;
    usati.add(n);
  }
  Dati.aggiornaMolti(daNumerare);
  aggiornaDopoPartita();
  mostraAvviso(`Numerati ${daNumerare.length} schemi`, () => {
    Dati.aggiornaMolti(prima);
    aggiornaDopoPartita();
  });
}

function aggiornaDopoPartita() {
  if (schemaCorrente) {
    const s = Dati.trova(schemaCorrente.id);
    if (s) schemaCorrente = s;
    mostraPartita();
    if (typeof mostraCategoria === "function") mostraCategoria();
  }
  mostraElenco();
  if (!$("#foglio-stampa").hidden) aggiornaOpzioniTipo();
}

/* Mini-schema per wristband e call sheet: invece di tutto il campo
   mostra solo la zona dove ci sono giocatori e tracce, così si legge
   anche a pochi centimetri. "rapporto" = larghezza / altezza del riquadro. */
function miniSchema(schema, classe, rapporto) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", classe);
  disegnaCampo(svg, schema, { miniatura: true });
  const xs = [], ys = [];
  for (const g of schema.giocatori || []) {
    xs.push(g.x); ys.push(g.y);
    const t = g.traccia;
    if (!t) continue;
    const punti = [...(t.punti || []), ...(t.rami || []).flatMap((r) => r.punti || [])];
    for (const p of punti) { xs.push(g.x + p.dx); ys.push(g.y + p.dy); }
  }
  if (!xs.length) return svg;
  return conCampoDi(schema, () => ritagliaMini(svg, xs, ys, rapporto)); // misure del campo di questo schema
}

function ritagliaMini(svg, xs, ys, rapporto) {
  const margine = 1.5;
  let x0 = Math.min(...xs) - margine, x1 = Math.max(...xs) + margine;
  let y0 = Math.min(...ys) - margine, y1 = Math.max(...ys) + margine; // yarde (avanti = +)
  // Allarga il lato corto per rispettare la forma del riquadro
  let w = x1 - x0, h = y1 - y0;
  if (w / h < rapporto) { const nw = h * rapporto; x0 -= (nw - w) / 2; w = nw; }
  else { const nh = w / rapporto; y0 -= (nh - h) / 2; h = nh; }
  // Resta dentro il campo disegnato
  w = Math.min(w, LARGHEZZA_CAMPO);
  x0 = Math.max(0, Math.min(x0, LARGHEZZA_CAMPO - w));
  h = Math.min(h, ALTEZZA_CAMPO);
  const alto = Math.min(YARDE_AVANTI, Math.max(y0 + h, -YARDE_DIETRO + h)); // bordo alto, in yarde
  const top = yDisegno(alto);
  svg.setAttribute("viewBox", `${x0.toFixed(2)} ${top.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`);
  return svg;
}

/* ==========================================================================
   STAMPA: WRISTBAND
   Inserti da 12 × 7 cm (la misura delle tasche dei wristband più diffusi),
   3 per foglio A4, con le linee tratteggiate per ritagliarli.
   ========================================================================== */
function schemiNumerati(schemi) {
  return schemi.filter((s) => s.chiamata).sort((a, b) => a.chiamata - b.chiamata);
}

/* Stili del wristband:
   - con gli schemi: 12 (4×3), 8 (4×2), 6 (3×2) o 4 (2×2) per inserto
   - lista: "24" (2 colonne con formazione), "36" (3 colonne, solo nome),
     "12" (1 colonna, testo grande), "colori" (24 con il colore della categoria) */
const GRIGLIE_WRISTBAND = { 12: [4, 3], 8: [4, 2], 6: [3, 2], 4: [2, 2] };
const LISTE_WRISTBAND = { 24: [2, 12], 36: [3, 12], 12: [1, 12], colori: [2, 12] };

function costruisciWristband(opzioni, contenitore) {
  const schemi = schemiNumerati(schemiDaStampare(opzioni.cosa)).slice(0, opzioni.limite || Infinity);
  const conSchemi = opzioni.wristband !== "testo";
  const lista = LISTE_WRISTBAND[opzioni.lista] ? String(opzioni.lista) : "24";
  const [colonne, righe] = conSchemi ? GRIGLIE_WRISTBAND[opzioni.perInserto] || GRIGLIE_WRISTBAND[12] : LISTE_WRISTBAND[lista];
  const perInserto = colonne * righe;
  const stile = { conSchemi, colonne, righe, lista };
  const inserti = [];
  for (let i = 0; i < schemi.length; i += perInserto) inserti.push(schemi.slice(i, i + perInserto));
  const copie = Math.max(1, Math.min(10, opzioni.copie || 1));
  const tutti = [];
  for (let c = 0; c < copie; c++) inserti.forEach((ins, i) => tutti.push({ schemi: ins, numero: i + 1, copia: c + 1 }));

  const pagine = [];
  for (let i = 0; i < tutti.length; i += 3) pagine.push(tutti.slice(i, i + 3));
  pagine.forEach((gruppo, p) => {
    const pag = elemento("section", "pagina-stampa pagina-wristband");
    pag.appendChild(intestazione(`${playbookCorrente.nome} · Wristband`, p + 1, pagine.length));
    const colonna = elemento("div", "colonna-inserti");
    for (const ins of gruppo) colonna.appendChild(insertoWristband(ins, stile, inserti.length, copie));
    pag.appendChild(colonna);
    pag.appendChild(elemento("p", "pagina-piede", "✂ Ritaglia lungo il tratteggio · inserto 12 × 7 cm"));
    contenitore.appendChild(pag);
  });
  return { titolo: `${playbookCorrente.nome} - Wristband`, pagine: pagine.length };
}

function insertoWristband(ins, { conSchemi, colonne, righe, lista }, totaleInserti, copie) {
  const inserto = elemento("div", "inserto " + (conSchemi ? "con-schemi" : `solo-testo lista-${lista}`));
  const testa = elemento("div", "inserto-testa");
  testa.appendChild(elemento("strong", "", playbookCorrente.nome));
  const info = totaleInserti > 1 ? `Inserto ${ins.numero}/${totaleInserti}` : "";
  testa.appendChild(elemento("span", "", [info, copie > 1 ? `copia ${ins.copia}` : ""].filter(Boolean).join(" · ")));
  inserto.appendChild(testa);
  const griglia = elemento("div", "inserto-griglia");
  griglia.style.gridTemplateColumns = `repeat(${colonne}, 1fr)`;
  griglia.style.gridTemplateRows = `repeat(${righe}, 1fr)`;
  for (const s of ins.schemi) {
    const cella = elemento("div", "inserto-cella");
    // Stile «A colori»: una striscia col colore della categoria (corsa, passaggio…)
    if (lista === "colori" && categoriaDi(s)) cella.style.setProperty("--colore-categoria", coloreCategoria(s));
    const riga = elemento("div", "inserto-riga");
    riga.appendChild(elemento("span", "inserto-numero", String(s.chiamata)));
    const testi = elemento("span", "inserto-testi");
    testi.appendChild(elemento("span", "inserto-nome", s.nome || "Senza nome"));
    if (!conSchemi && lista !== "36") testi.appendChild(elemento("span", "inserto-formazione", lista === "colori" && categoriaDi(s) ? nomeCategoria(s) : nomeFormazione(s)));
    riga.appendChild(testi);
    cella.appendChild(riga);
    if (conSchemi) cella.appendChild(miniSchema(s, "inserto-campo", (116 / colonne) / (60 / righe - 4)));
    griglia.appendChild(cella);
  }
  inserto.appendChild(griglia);
  return inserto;
}

/* ==========================================================================
   STAMPA: CALL SHEET
   A4 orizzontale, un riquadro per ogni situazione disposti in colonne.
   Se gli schemi sono tanti, i riquadri continuano nella colonna (o
   pagina) successiva con "(segue)".
   ========================================================================== */
// Altezze stimate in mm (la pagina non è visibile, quindi non si può misurare)
const CALLSHEET = { altezzaColonna: 160, testa: 7, riga: 7.2, rigaConSchema: 17, spazio: 3 };

/* I riquadri del call sheet: per situazione (1° & 10, Red zone…),
   per categoria (Corsa, Passaggio…) o per formazione. */
function riquadriCallSheet(schemi, opzioni) {
  const gruppi = opzioni.gruppiCallsheet || "situazione";
  let riquadri;
  if (gruppi === "categoria") {
    riquadri = ORDINE_LATI.flatMap((lato) => (CATEGORIE[lato] || []).map((c) => ({
      nome: `${c.icona} ${c.nome}`, schemi: schemi.filter((s) => s.lato === lato && s.categoria === c.id),
    })));
    riquadri.push({ nome: "Senza categoria", schemi: schemi.filter((s) => !categoriaDi(s)) });
  } else if (gruppi === "formazione") {
    const mappa = new Map();
    for (const s of schemi) {
      const k = `${s.lato}|${chiaveFormazione(s)}`;
      if (!mappa.has(k)) mappa.set(k, { nome: nomeFormazione(s), schemi: [] });
      mappa.get(k).schemi.push(s);
    }
    riquadri = [...mappa.values()];
  } else {
    riquadri = SITUAZIONI.map((sit) => ({ nome: sit.nome, schemi: schemi.filter((s) => (s.situazioni || []).includes(sit.id)) }));
    const senza = schemi.filter((s) => !(s.situazioni || []).length);
    if (opzioni.senzaSituazione && senza.length) riquadri.push({ nome: "Altri schemi", schemi: senza });
  }
  riquadri = riquadri.filter((r) => r.schemi.length);
  for (const r of riquadri) r.schemi.sort((a, b) => (a.chiamata || 9999) - (b.chiamata || 9999));
  return riquadri;
}

// Colori dei titoli dei riquadri (stile «Titoli a colori»)
const COLORI_RIQUADRI = ["#D7263D", "#F46036", "#E2B400", "#1B998B", "#2E86AB", "#7B2CBF", "#C2185B", "#3A7D44"];

function costruisciCallSheet(opzioni, contenitore) {
  if (opzioni.gruppiCallsheet === "griglia") return costruisciGrigliaSchemi(opzioni, contenitore);
  const schemi = schemiDaStampare(opzioni.cosa).slice(0, opzioni.limite || Infinity);
  const riquadri = riquadriCallSheet(schemi, opzioni);
  // Accanto a ogni schema: corsa / pass… e il colore della sua formazione
  const dettagli = opzioni.dettagliCallsheet !== false ? { colori: coloriFormazioni(schemi) } : null;
  riquadri.forEach((r, i) => { if (opzioni.coloriCallsheet) r.colore = COLORI_RIQUADRI[i % COLORI_RIQUADRI.length]; });

  // 1. Distribuisce i riquadri nelle colonne
  // In A3 il foglio è più grande: più colonne e colonne più alte (stessa grandezza del testo)
  const a3 = opzioni.carta === "A3";
  // (solo testo in A3: 5 colonne con il testo più grande, da leggere a bordo campo)
  const C = a3
    ? { ...CALLSHEET, altezzaColonna: 250, testa: opzioni.miniSchemi ? CALLSHEET.testa : 9.5, riga: 9.4 }
    : CALLSHEET;
  const altezzaRiga = opzioni.miniSchemi ? C.rigaConSchema : C.riga;
  const colonnePerPagina = opzioni.miniSchemi ? (a3 ? 5 : 3) : (a3 ? 5 : 4);
  /* Fascia "Note" con le righe, larga quanto il foglio, in fondo all'ultima
     pagina: lì le colonne sono più basse per farle spazio. */
  const conNote = opzioni.note !== false && riquadri.length > 0;
  const fasciaMax = a3 ? 62 : 42, fasciaMin = a3 ? 36 : 27; // altezza della fascia (mm)
  const impagina = (primaColonnaCorta, fascia) => {
    const altezzaDi = (i) => C.altezzaColonna - (i >= primaColonnaCorta ? fascia + C.spazio : 0);
    const colonne = [[]];
    let libero = altezzaDi(0);
    for (const r of riquadri) {
      let resto = r.schemi, primo = true;
      while (resto.length) {
        if (libero < C.testa + altezzaRiga) { colonne.push([]); libero = altezzaDi(colonne.length - 1); }
        const entrano = Math.max(1, Math.floor((libero - C.testa - C.spazio) / altezzaRiga));
        const pezzo = resto.slice(0, entrano);
        colonne[colonne.length - 1].push({ nome: r.nome + (primo ? "" : " (segue)"), totale: r.schemi.length, schemi: pezzo, colore: r.colore });
        libero -= C.testa + C.spazio + pezzo.length * altezzaRiga;
        resto = resto.slice(entrano);
        primo = false;
      }
    }
    return colonne;
  };
  let colonne = impagina(Infinity, 0);
  let fasciaNote = 0;
  if (conNote) {
    // Le colonne dell'ultima pagina si accorciano per far posto alla fascia;
    // se non c'è abbastanza spazio la fascia si abbassa, fino a un minimo.
    const pagineSenza = Math.ceil(colonne.length / colonnePerPagina);
    for (let h = fasciaMax; h >= fasciaMin && !fasciaNote; h -= 4) {
      const prova = impagina((pagineSenza - 1) * colonnePerPagina, h);
      if (Math.ceil(prova.length / colonnePerPagina) === pagineSenza) { colonne = prova; fasciaNote = h; }
    }
    if (!fasciaNote) {
      // Non entra: le note vanno su un foglio tutto loro
      while (colonne.length < pagineSenza * colonnePerPagina) colonne.push([]);
      colonne.push([]);
      fasciaNote = C.altezzaColonna;
    }
  }

  // 2. Raggruppa le colonne in pagine
  const pagine = [];
  for (let i = 0; i < colonne.length; i += colonnePerPagina) pagine.push(colonne.slice(i, i + colonnePerPagina));
  pagine.forEach((gruppo, p) => {
    const pag = elemento("section", "pagina-stampa pagina-callsheet" + (a3 ? " a3" : ""));
    pag.appendChild(intestazione(`${playbookCorrente.nome} · Call sheet`, p + 1, pagine.length));
    const griglia = elemento("div", "griglia-callsheet");
    griglia.style.setProperty("--colonne", colonnePerPagina);
    gruppo.forEach((colonna) => {
      const col = elemento("div", "colonna-callsheet");
      for (const r of colonna) col.appendChild(riquadroSituazione(r, opzioni.miniSchemi, dettagli));
      griglia.appendChild(col);
    });
    if (!riquadri.length) {
      griglia.appendChild(elemento("p", "callsheet-vuoto", (opzioni.gruppiCallsheet || "situazione") === "situazione"
        ? "Nessuno schema ha una situazione: aprili e scegli 1° & 10, 3° & corto, Red zone…"
        : "Nessuno schema da mettere nel call sheet."));
    }
    pag.appendChild(griglia);
    if (conNote && p === pagine.length - 1) pag.appendChild(riquadroNote(fasciaNote - C.testa));
    pag.appendChild(elemento("p", "pagina-piede", "Creato con Playbook"));
    contenitore.appendChild(pag);
  });
  return { titolo: `${playbookCorrente.nome} - Call sheet`, pagine: pagine.length };
}

function riquadroNote(altezza) {
  const box = elemento("section", "riquadro-situazione riquadro-note fascia-note");
  box.appendChild(elemento("h3", "", "Note"));
  const righe = elemento("div", "righe-note");
  righe.style.height = `${Math.floor(altezza)}mm`;
  box.appendChild(righe);
  return box;
}

function riquadroSituazione(r, conSchemi, dettagli = null) {
  const box = elemento("section", "riquadro-situazione" + (r.colore ? " a-colori" : ""));
  if (r.colore) box.style.setProperty("--colore-riquadro", r.colore);
  const titolo = elemento("h3", "", r.nome);
  titolo.appendChild(elemento("span", "", String(r.totale)));
  box.appendChild(titolo);
  for (const s of r.schemi) {
    const riga = elemento("div", "riga-chiamata" + (conSchemi ? " con-schema" : "") + (dettagli ? " con-dettagli" : ""));
    if (dettagli) riga.style.setProperty("--colore-formazione", dettagli.colori.get(`${s.lato}|${chiaveFormazione(s)}`) || "#9AA0A6");
    riga.appendChild(elemento("span", "chiamata-numero", s.chiamata ? String(s.chiamata) : "–"));
    const testi = elemento("span", "chiamata-testi");
    testi.appendChild(elemento("span", "chiamata-nome", s.nome || "Senza nome"));
    testi.appendChild(elemento("span", "chiamata-formazione", nomeFormazione(s)));
    riga.appendChild(testi);
    if (dettagli) {
      const breve = categoriaBreve(s);
      const cat = elemento("span", "chiamata-categoria" + (breve ? "" : " vuota"), breve || "—");
      if (breve) cat.style.setProperty("--colore-categoria", coloreCategoria(s));
      riga.appendChild(cat);
    }
    if (conSchemi) riga.appendChild(miniSchema(s, "chiamata-campo", 1.6));
    box.appendChild(riga);
  }
  return box;
}

/* ==========================================================================
   STAMPA: CALL SHEET «GRIGLIA DI SCHEMI»
   Tutti gli schemi in ordine di numero, ognuno nel suo riquadro con il
   mini-schema grande: 20 per foglio A4 orizzontale, 35 in A3.
   ========================================================================== */
function costruisciGrigliaSchemi(opzioni, contenitore) {
  const tutti = schemiDaStampare(opzioni.cosa).slice(0, opzioni.limite || Infinity);
  const schemi = [...tutti].sort((a, b) => (a.chiamata || 9999) - (b.chiamata || 9999));
  const a3 = opzioni.carta === "A3";
  const [colonne, righe] = a3 ? [7, 5] : [5, 4];
  const perPagina = colonne * righe;
  const pagine = [];
  for (let i = 0; i < schemi.length; i += perPagina) pagine.push(schemi.slice(i, i + perPagina));
  if (!pagine.length) pagine.push([]);
  pagine.forEach((gruppo, p) => {
    const pag = elemento("section", "pagina-stampa pagina-callsheet pagina-griglia-schemi" + (a3 ? " a3" : ""));
    pag.appendChild(intestazione(`${playbookCorrente.nome} · Call sheet`, p + 1, pagine.length));
    const griglia = elemento("div", "griglia-schemi-callsheet");
    griglia.style.gridTemplateColumns = `repeat(${colonne}, 1fr)`;
    griglia.style.gridTemplateRows = `repeat(${righe}, 1fr)`;
    gruppo.forEach((s, i) => {
      const cella = elemento("div", "cella-griglia-schemi");
      if (opzioni.coloriCallsheet && categoriaDi(s)) cella.style.setProperty("--colore-riquadro", coloreCategoria(s));
      const testa = elemento("div", "cella-griglia-testa");
      testa.appendChild(elemento("span", "chiamata-numero", s.chiamata ? String(s.chiamata) : "–"));
      testa.appendChild(elemento("span", "chiamata-nome", s.nome || "Senza nome"));
      cella.appendChild(testa);
      cella.appendChild(miniSchema(s, "cella-griglia-campo", 1.6));
      griglia.appendChild(cella);
    });
    pag.appendChild(griglia);
    pag.appendChild(elemento("p", "pagina-piede", "Creato con Playbook"));
    contenitore.appendChild(pag);
  });
  return { titolo: `${playbookCorrente.nome} - Call sheet`, pagine: pagine.length };
}

// Colore di una categoria (per wristband e call sheet «a colori»)
const COLORI_CATEGORIE = {
  corsa: "#1E9E57", passaggio: "#1679C2", "play-action": "#7B2CBF", rpo: "#E2B400", screen: "#F46036", trick: "#C2185B",
  zona: "#2E86AB", uomo: "#D7263D", blitz: "#F46036", "contro-corsa": "#1E9E57", speciale: "#7B2CBF",
  kickoff: "#D7263D", "kick-return": "#1E9E57", punt: "#F46036", "punt-return": "#1B998B", "field-goal": "#2E86AB", "fg-block": "#7B2CBF", onside: "#E2B400",
};
function coloreCategoria(s) {
  return COLORI_CATEGORIE[s.categoria] || "#6B7370";
}

/* ==========================================================================
   STAMPA: SCOUT CARDS
   Una carta per schema, con il campo grandissimo e numero e nome ben
   visibili: si mostra alla scout team (o in allenamento) per far
   ripetere lo schema. Stili: 1 per foglio (orizzontale), 2 per foglio,
   oppure «vista dall'altra parte»: campo capovolto, come lo vede chi
   sta di fronte (le scritte restano dritte).
   ========================================================================== */
function costruisciScout(opzioni, contenitore) {
  const schemi = schemiDaStampare(opzioni.cosa).slice(0, opzioni.limite || Infinity);
  const perPagina = opzioni.scoutPerPagina === 2 ? 2 : 1;
  const pagine = [];
  for (let i = 0; i < schemi.length; i += perPagina) pagine.push(schemi.slice(i, i + perPagina));
  pagine.forEach((gruppo) => {
    const pag = elemento("section", `pagina-stampa pagina-scout scout-${perPagina}` + (opzioni.capovolta ? " capovolta" : ""));
    for (const s of gruppo) {
      const carta = elemento("article", "carta-scout");
      const testa = elemento("header", "carta-scout-testa");
      if (s.chiamata) testa.appendChild(elemento("span", "carta-scout-numero", String(s.chiamata)));
      const testi = elemento("div", "carta-scout-testi");
      testi.appendChild(elemento("strong", "", s.nome || "Senza nome"));
      const cat = nomeCategoria(s);
      testi.appendChild(elemento("span", "", `${NOMI_LATO[s.lato]} · ${nomeFormazione(s)}${cat ? " · " + cat : ""}`));
      testa.appendChild(testi);
      if (Squadra.logo) {
        const img = document.createElement("img");
        img.src = Squadra.logo; img.alt = ""; img.className = "carta-scout-logo";
        testa.appendChild(img);
      }
      carta.appendChild(testa);
      const svg = document.createElementNS(SVG_NS, "svg");
      svg.setAttribute("class", "campo-stampa campo-scout");
      disegnaCampo(svg, s, { stampa: true });
      carta.appendChild(svg);
      pag.appendChild(carta);
    }
    contenitore.appendChild(pag);
  });
  return { titolo: `${playbookCorrente.nome} - Scout cards`, pagine: pagine.length };
}

/* ==========================================================================
   COLORE DELLE FORMAZIONI E CATEGORIA IN BREVE (call sheet)
   Le formazioni che hanno un colore nel nome lo usano (GOLD → oro,
   RED → rosso, BLUE → blu…); le altre prendono un colore fisso, diverso
   per ognuna, in ordine di apparizione.
   ========================================================================== */
const COLORI_NEI_NOMI = [
  [/\b(gold|oro)\b/i, "#C9A100"], [/\b(red|rosso|rossa)\b/i, "#D7263D"], [/\b(blue|blu)\b/i, "#1679C2"],
  [/\b(green|verde)\b/i, "#1E9E57"], [/\b(black|nero|nera)\b/i, "#222222"], [/\b(orange|arancio|arancione)\b/i, "#F46036"],
  [/\b(purple|viola)\b/i, "#7B2CBF"], [/\b(silver|argento)\b/i, "#8A9399"], [/\b(yellow|giallo|gialla)\b/i, "#E2B400"],
  [/\b(brown|marrone)\b/i, "#8A4A1C"], [/\b(pink|rosa)\b/i, "#E05591"], [/\b(white|bianco|bianca)\b/i, "#B8BEC2"],
];
const COLORI_FORMAZIONI_LIBERI = ["#2E86AB", "#1B998B", "#7B2CBF", "#F46036", "#C2185B", "#3A7D44", "#5C6BC0", "#8D6E63"];

function coloriFormazioni(schemi) {
  const colori = new Map();
  const usati = new Set();
  const senza = [];
  for (const s of schemi) {
    const k = `${s.lato}|${chiaveFormazione(s)}`;
    if (colori.has(k) || senza.includes(k)) continue;
    const nome = nomeFormazione(s);
    const trovato = COLORI_NEI_NOMI.find(([re]) => re.test(nome));
    if (trovato) { colori.set(k, trovato[1]); usati.add(trovato[1]); } else senza.push(k);
  }
  const liberi = COLORI_FORMAZIONI_LIBERI.filter((c) => !usati.has(c));
  senza.forEach((k, i) => colori.set(k, (liberi.length ? liberi : COLORI_FORMAZIONI_LIBERI)[i % (liberi.length || COLORI_FORMAZIONI_LIBERI.length)]));
  return colori;
}

// «CORSA», «PASS», «PLAY ACT.»… (vuoto se lo schema non ha categoria)
const CATEGORIE_BREVI = {
  corsa: "CORSA", passaggio: "PASS", "play-action": "PLAY ACT.", rpo: "RPO", screen: "SCREEN", trick: "TRICK",
  zona: "ZONA", uomo: "UOMO", blitz: "BLITZ", "contro-corsa": "VS CORSA", speciale: "SPECIALE",
  kickoff: "KICKOFF", "kick-return": "K. RETURN", punt: "PUNT", "punt-return": "P. RETURN", "field-goal": "FG / PAT", "fg-block": "BLOCCO FG", onside: "ONSIDE",
};
function categoriaBreve(s) {
  return categoriaDi(s) ? CATEGORIE_BREVI[s.categoria] || nomeCategoria(s).toUpperCase() : "";
}
