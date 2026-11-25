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

function costruisciWristband(opzioni, contenitore) {
  const schemi = schemiNumerati(schemiDaStampare(opzioni.cosa));
  const conSchemi = opzioni.wristband !== "testo";
  const perInserto = conSchemi ? 12 : 24;
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
    for (const ins of gruppo) colonna.appendChild(insertoWristband(ins, conSchemi, inserti.length, copie));
    pag.appendChild(colonna);
    pag.appendChild(elemento("p", "pagina-piede", "✂ Ritaglia lungo il tratteggio · inserto 12 × 7 cm"));
    contenitore.appendChild(pag);
  });
  return { titolo: `${playbookCorrente.nome} - Wristband`, pagine: pagine.length };
}

function insertoWristband(ins, conSchemi, totaleInserti, copie) {
  const inserto = elemento("div", "inserto " + (conSchemi ? "con-schemi" : "solo-testo"));
  const testa = elemento("div", "inserto-testa");
  testa.appendChild(elemento("strong", "", playbookCorrente.nome));
  const info = totaleInserti > 1 ? `Inserto ${ins.numero}/${totaleInserti}` : "";
  testa.appendChild(elemento("span", "", [info, copie > 1 ? `copia ${ins.copia}` : ""].filter(Boolean).join(" · ")));
  inserto.appendChild(testa);
  const griglia = elemento("div", "inserto-griglia");
  for (const s of ins.schemi) {
    const cella = elemento("div", "inserto-cella");
    const riga = elemento("div", "inserto-riga");
    riga.appendChild(elemento("span", "inserto-numero", String(s.chiamata)));
    const testi = elemento("span", "inserto-testi");
    testi.appendChild(elemento("span", "inserto-nome", s.nome || "Senza nome"));
    if (!conSchemi) testi.appendChild(elemento("span", "inserto-formazione", nomeFormazione(s)));
    riga.appendChild(testi);
    cella.appendChild(riga);
    if (conSchemi) cella.appendChild(miniSchema(s, "inserto-campo", 1.75));
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

function costruisciCallSheet(opzioni, contenitore) {
  const schemi = schemiDaStampare(opzioni.cosa);
  const riquadri = SITUAZIONI
    .map((sit) => ({ nome: sit.nome, schemi: schemi.filter((s) => (s.situazioni || []).includes(sit.id)) }))
    .filter((r) => r.schemi.length);
  const senza = schemi.filter((s) => !(s.situazioni || []).length);
  if (opzioni.senzaSituazione && senza.length) riquadri.push({ nome: "Altri schemi", schemi: senza });
  for (const r of riquadri) r.schemi.sort((a, b) => (a.chiamata || 9999) - (b.chiamata || 9999));

  // 1. Distribuisce i riquadri nelle colonne
  // In A3 il foglio è più grande: più colonne e colonne più alte (stessa grandezza del testo)
  const a3 = opzioni.carta === "A3";
  // (solo testo in A3: 5 colonne con il testo più grande, da leggere a bordo campo)
  const C = a3
    ? { ...CALLSHEET, altezzaColonna: 250, testa: opzioni.miniSchemi ? CALLSHEET.testa : 9.5, riga: 9.4 }
    : CALLSHEET;
  const altezzaRiga = opzioni.miniSchemi ? C.rigaConSchema : C.riga;
  const colonnePerPagina = opzioni.miniSchemi ? (a3 ? 5 : 3) : (a3 ? 5 : 4);
  const colonne = [[]];
  let libero = C.altezzaColonna;
  for (const r of riquadri) {
    let resto = r.schemi, primo = true;
    while (resto.length) {
      if (libero < C.testa + altezzaRiga) { colonne.push([]); libero = C.altezzaColonna; }
      const entrano = Math.max(1, Math.floor((libero - C.testa - C.spazio) / altezzaRiga));
      const pezzo = resto.slice(0, entrano);
      colonne[colonne.length - 1].push({ nome: r.nome + (primo ? "" : " (segue)"), totale: r.schemi.length, schemi: pezzo });
      libero -= C.testa + C.spazio + pezzo.length * altezzaRiga;
      resto = resto.slice(entrano);
      primo = false;
    }
  }

  /* 1b. Riquadro "Note" con le righe, da scrivere a pennarello: riempie lo
     spazio libero in fondo all'ultima colonna, oppure prende una colonna intera */
  const MIN_NOTE = 45;
  if (opzioni.note !== false && riquadri.length) {
    const colonneLibere = colonne.length % colonnePerPagina ? colonnePerPagina - (colonne.length % colonnePerPagina) : 0;
    if (colonneLibere) {
      // C'è almeno una colonna vuota nell'ultima pagina: le note la prendono tutta (e anche le altre libere)
      colonne.push([{ note: true, altezza: C.altezzaColonna - C.testa - C.spazio }]);
    } else if (libero >= MIN_NOTE + C.testa + C.spazio) {
      colonne[colonne.length - 1].push({ note: true, altezza: libero - C.testa - C.spazio });
    } else {
      colonne.push([{ note: true, altezza: C.altezzaColonna - C.testa - C.spazio }]);
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
    gruppo.forEach((colonna, i) => {
      const col = elemento("div", "colonna-callsheet");
      // La colonna delle note si allarga su tutte le colonne libere a destra
      if (colonna.length === 1 && colonna[0].note && i === gruppo.length - 1) {
        col.style.gridColumn = `span ${colonnePerPagina - i}`;
      }
      for (const r of colonna) col.appendChild(r.note ? riquadroNote(r.altezza) : riquadroSituazione(r, opzioni.miniSchemi));
      griglia.appendChild(col);
    });
    if (!riquadri.length) {
      griglia.appendChild(elemento("p", "callsheet-vuoto",
        "Nessuno schema ha una situazione: aprili e scegli 1° & 10, 3° & corto, Red zone…"));
    }
    pag.appendChild(griglia);
    pag.appendChild(elemento("p", "pagina-piede", "Creato con Playbook"));
    contenitore.appendChild(pag);
  });
  return { titolo: `${playbookCorrente.nome} - Call sheet`, pagine: pagine.length };
}

function riquadroNote(altezza) {
  const box = elemento("section", "riquadro-situazione riquadro-note");
  box.appendChild(elemento("h3", "", "Note"));
  const righe = elemento("div", "righe-note");
  righe.style.height = `${Math.floor(altezza)}mm`;
  box.appendChild(righe);
  return box;
}

function riquadroSituazione(r, conSchemi) {
  const box = elemento("section", "riquadro-situazione");
  const titolo = elemento("h3", "", r.nome);
  titolo.appendChild(elemento("span", "", String(r.totale)));
  box.appendChild(titolo);
  for (const s of r.schemi) {
    const riga = elemento("div", "riga-chiamata" + (conSchemi ? " con-schema" : ""));
    riga.appendChild(elemento("span", "chiamata-numero", s.chiamata ? String(s.chiamata) : "–"));
    const testi = elemento("span", "chiamata-testi");
    testi.appendChild(elemento("span", "chiamata-nome", s.nome || "Senza nome"));
    testi.appendChild(elemento("span", "chiamata-formazione", nomeFormazione(s)));
    riga.appendChild(testi);
    if (conSchemi) riga.appendChild(miniSchema(s, "chiamata-campo", 1.6));
    box.appendChild(riga);
  }
  return box;
}
