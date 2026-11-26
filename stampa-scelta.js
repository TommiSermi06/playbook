/* ==========================================================================
   FINESTRA «STAMPA»: GALLERIA, STILI E ANTEPRIMA
   --------------------------------------------------------------------------
   Passo 1 — galleria: sei tipi di stampa, ognuno con l'anteprima VERA
   della prima pagina fatta con i tuoi schemi:
     Wristband · Schemi, Wristband · Lista, Call sheet · Schemi,
     Call sheet · Lista, Playbook, Scout cards
   Passo 2 — il tipo scelto: gli stili (ognuno con la sua miniatura), le
   opzioni e un'anteprima grande da sfogliare pagina per pagina.
   Le pagine si costruiscono con le stesse funzioni della stampa vera
   (stampa.js e partita.js), quindi l'anteprima è proprio quello che esce.
   La scelta di tipo e stile resta ricordata (opzioniStampa).
   ========================================================================== */

const SCHEDE_STAMPA = [
  {
    id: "wristband-schemi", nome: "Wristband · Schemi", icona: "⌚", tipo: "wristband", base: { wristband: "schemi" },
    descr: "Inserti 12 × 7 cm per il polsino, con i mini-schemi numerati",
    stili: [
      { id: "12", nome: "12 schemi", descr: "4 × 3 · il più usato", opz: { perInserto: 12 } },
      { id: "8", nome: "8 schemi", descr: "4 × 2 · più grandi", opz: { perInserto: 8 } },
      { id: "6", nome: "6 schemi", descr: "3 × 2 · grandi", opz: { perInserto: 6 } },
      { id: "4", nome: "4 schemi", descr: "2 × 2 · grandissimi", opz: { perInserto: 4 } },
    ],
  },
  {
    id: "wristband-lista", nome: "Wristband · Lista", icona: "⌚", tipo: "wristband", base: { wristband: "testo" },
    descr: "Solo numeri e nomi: tante chiamate in un inserto",
    stili: [
      { id: "24", nome: "24 chiamate", descr: "2 colonne, con la formazione", opz: { lista: "24" } },
      { id: "36", nome: "36 chiamate", descr: "3 colonne, solo il nome", opz: { lista: "36" } },
      { id: "12", nome: "12 grandi", descr: "1 colonna, testo grande", opz: { lista: "12" } },
      { id: "colori", nome: "A colori", descr: "24 chiamate col colore della categoria", opz: { lista: "colori" } },
    ],
  },
  {
    id: "callsheet-schemi", nome: "Call sheet · Schemi", icona: "📋", tipo: "callsheet", base: { miniSchemi: true },
    descr: "Il foglio del coordinatore con il mini-schema accanto a ogni chiamata",
    stili: [
      { id: "situazione", nome: "Per situazione", descr: "1° & 10, 3° & corto, Red zone…", opz: { gruppiCallsheet: "situazione" } },
      { id: "categoria", nome: "Per categoria", descr: "Corsa, Passaggio, Screen…", opz: { gruppiCallsheet: "categoria" } },
      { id: "formazione", nome: "Per formazione", descr: "Un riquadro per formazione", opz: { gruppiCallsheet: "formazione" } },
      { id: "griglia", nome: "Griglia di schemi", descr: "Tutti gli schemi numerati, grandi", opz: { gruppiCallsheet: "griglia" } },
    ],
  },
  {
    id: "callsheet-lista", nome: "Call sheet · Lista", icona: "📋", tipo: "callsheet", base: { miniSchemi: false },
    descr: "Solo testo: tante chiamate su un foglio, da leggere a bordo campo",
    stili: [
      { id: "situazione", nome: "Per situazione", descr: "1° & 10, 3° & corto, Red zone…", opz: { gruppiCallsheet: "situazione" } },
      { id: "categoria", nome: "Per categoria", descr: "Corsa, Passaggio, Screen…", opz: { gruppiCallsheet: "categoria" } },
      { id: "formazione", nome: "Per formazione", descr: "Un riquadro per formazione", opz: { gruppiCallsheet: "formazione" } },
    ],
  },
  {
    id: "playbook", nome: "Playbook", icona: "📘", tipo: "playbook", base: {}, predefinito: "4",
    descr: "Il libro degli schemi, con copertina, indice e note",
    stili: [
      { id: "1", nome: "1 per pagina", descr: "Foglio orizzontale, schema enorme", opz: { perPagina: 1, appunti: false } },
      { id: "2", nome: "2 per pagina", descr: "Grandi, con le note", opz: { perPagina: 2, appunti: false } },
      { id: "4", nome: "4 per pagina", descr: "Il più usato", opz: { perPagina: 4, appunti: false } },
      { id: "6", nome: "6 per pagina", descr: "Compatto, meno fogli", opz: { perPagina: 6, appunti: false } },
      { id: "appunti", nome: "Con appunti", descr: "2 per pagina con le righe per scrivere", opz: { perPagina: 2, appunti: true } },
    ],
  },
  {
    id: "scout", nome: "Scout cards", icona: "🃏", tipo: "scout", base: {},
    descr: "Carte grandi da mostrare alla scout team in allenamento",
    stili: [
      { id: "1", nome: "1 per foglio", descr: "Orizzontale, campo grandissimo", opz: { scoutPerPagina: 1, capovolta: false } },
      { id: "2", nome: "2 per foglio", descr: "Verticale, meno carta", opz: { scoutPerPagina: 2, capovolta: false } },
      { id: "capovolta", nome: "Vista dall'altra parte", descr: "Campo girato: come lo vede chi sta di fronte", opz: { scoutPerPagina: 1, capovolta: true } },
    ],
  },
];

let schedaStampa = null;   // il tipo scelto (passo 2)
let paginaAnteprima = 0;   // pagina mostrata nell'anteprima grande
let timerAnteprima = null;

const schedaDa = (id) => SCHEDE_STAMPA.find((s) => s.id === id) || SCHEDE_STAMPA[4];
function stileScelto(scheda) {
  const id = (opzioniStampa.stili || {})[scheda.id] || scheda.predefinito;
  return scheda.stili.find((s) => s.id === id) || scheda.stili[0];
}

/* Le opzioni finali per un tipo e uno stile: quelle salvate, quelle
   scritte nella finestra (se siamo al passo 2), il tipo e lo stile. */
function opzioniPer(scheda, stile, { conControlli = true } = {}) {
  const controlli = conControlli && !$("#passo-opzioni").hidden ? leggiControlliStampa() : {};
  return { ...OPZIONI_STAMPA_DEFAULT, ...opzioniStampa, ...controlli, tipo: scheda.tipo, ...scheda.base, ...stile.opz };
}

function leggiControlliStampa() {
  const scelta = document.querySelector('input[name="stampa-cosa"]:checked');
  const raggruppa = $("#stampa-raggruppa").dataset.valore || "formazione";
  return {
    cosa: scelta ? scelta.value : opzioniStampa.cosa,
    campo: $("#stampa-campo").dataset.valore || "chiaro",
    carta: $("#stampa-carta").dataset.valore || "A4",
    copertina: $("#stampa-copertina").checked,
    note: $("#stampa-note").checked,
    raggruppa,
    perFormazione: raggruppa === "formazione",
    formazioneVuota: $("#stampa-formazione-vuota").checked,
    copie: Math.max(1, Math.min(10, parseInt($("#stampa-copie").value, 10) || 1)),
    senzaSituazione: $("#stampa-senza-situazione").checked,
    noteCallsheet: $("#stampa-note-callsheet").checked,
    coloriCallsheet: $("#stampa-colori-callsheet").checked,
    dettagliCallsheet: $("#stampa-dettagli-callsheet").checked,
  };
}

/* ---------- Anteprima: costruisce le pagine e le rimpicciolisce ---------- */
// Per le miniature bastano pochi schemi: quanti servono a riempire la prima pagina
function limiteAnteprima(opz) {
  if (opz.tipo === "wristband") return opz.wristband === "testo" ? 72 : 36;
  if (opz.tipo === "callsheet") return 45;
  if (opz.tipo === "scout") return opz.scoutPerPagina === 2 ? 2 : 1;
  return opz.perPagina || 4;
}

/* Disegna in "box" la pagina "pagina" (0 = la prima) larga "larghezza" px.
   Le misure del foglio si calcolano dai millimetri veri (A4 / A3,
   verticale / orizzontale), non dal browser: così sono sempre giuste.
   Con "ritaglio" (larghezza / altezza) si vede solo la parte alta della
   pagina, ingrandita: nella galleria i fogli verticali non sembrano vuoti.
   Restituisce quante pagine ci sono (0 se nessuna). */
const PX_PER_MM = 96 / 25.4;
function disegnaAnteprima(opz, box, { larghezza, altezzaMax = Infinity, pagina = 0, limite = null, ritaglio = null }) {
  box.innerHTML = "";
  const pagine = document.createElement("div");
  box.appendChild(pagine);
  let esito;
  try {
    esito = costruisciStampa(limite ? { ...opz, limite } : opz, pagine, { anteprima: true });
  } catch (e) {
    console.error(e);
    box.innerHTML = "";
    return 0;
  }
  pagine.classList.add("anteprima-pagine");
  pagine.classList.toggle("orizzontale", Boolean(esito.orizzontale));
  pagine.classList.toggle("carta-a3", esito.carta === "A3");
  const tutte = [...pagine.children].filter((p) => p.classList.contains("pagina-stampa"));
  if (!tutte.length) { box.innerHTML = ""; box.style.width = ""; box.style.height = ""; return 0; }
  const n = Math.min(pagina, tutte.length - 1);
  tutte.forEach((p, i) => { p.style.display = i === n ? "" : "none"; });
  // Misure del foglio in px (A3 = A4 × 1,414)
  const a3 = esito.carta === "A3" ? Math.SQRT2 : 1;
  const w = (esito.orizzontale ? 297 : 210) * a3 * PX_PER_MM;
  const h = (esito.orizzontale ? 210 : 297) * a3 * PX_PER_MM;
  const hVisibile = ritaglio ? Math.min(h, w / ritaglio) : h; // con il ritaglio: solo la parte alta
  const k = Math.min(larghezza / w, altezzaMax / hVisibile);
  pagine.style.transform = `scale(${k})`;
  box.style.width = `${Math.round(w * k)}px`;
  box.style.height = `${Math.round(hVisibile * k)}px`;
  return tutte.length;
}

/* ---------- Passo 1: la galleria ---------- */
function apriFoglioStampa() {
  if (Tracce.disegno) Tracce.annullaDisegno();
  chiudiMenuTracce();
  salvaInSospeso();
  if (!playbookCorrente) return; // si stampa da dentro un playbook

  mostraPasso("galleria");
  $("#errore-galleria").textContent = schemiDelPlaybook().length ? "" : "Non ci sono ancora schemi da stampare.";
  $("#velo").hidden = false;
  $("#foglio-stampa").hidden = false;
  requestAnimationFrame(() => {
    $("#velo").classList.add("visibile");
    $("#foglio-stampa").classList.add("visibile");
    disegnaGalleria(); // dopo che la finestra è visibile: le anteprime si misurano
  });
}

function mostraPasso(passo) {
  $("#passo-galleria").hidden = passo !== "galleria";
  $("#passo-opzioni").hidden = passo !== "opzioni";
  $("#foglio-stampa").classList.toggle("passo-galleria", passo === "galleria");
  $("#foglio-stampa").classList.toggle("passo-opzioni", passo === "opzioni");
}

function disegnaGalleria() {
  const galleria = $("#galleria-stampa");
  galleria.innerHTML = "";
  const tutti = schemiDelPlaybook();
  const cosa = opzioniStampa.cosa && opzioniStampa.cosa !== "schema" ? opzioniStampa.cosa : "tutto";
  for (const scheda of SCHEDE_STAMPA) {
    const stile = stileScelto(scheda);
    const carta = document.createElement("button");
    carta.type = "button";
    carta.className = "carta-stampa" + (opzioniStampa.scheda === scheda.id ? " ultima" : "");
    carta.dataset.scheda = scheda.id;
    carta.innerHTML = `
      <span class="carta-stampa-testa">
        <span class="carta-stampa-nome"></span>
        <span class="carta-stampa-stili"></span>
        <span class="carta-stampa-freccia" aria-hidden="true">›</span>
      </span>
      <span class="pila-stampa"><span class="foglio-pila"><span class="box-anteprima"></span></span></span>
      <span class="carta-stampa-descr"></span>`;
    carta.querySelector(".carta-stampa-nome").textContent = `${scheda.icona} ${scheda.nome}`;
    carta.querySelector(".carta-stampa-stili").textContent = `${scheda.stili.length} stili`;
    carta.querySelector(".carta-stampa-descr").textContent = avvisoScheda(scheda, tutti) || scheda.descr;
    if (avvisoScheda(scheda, tutti)) carta.querySelector(".carta-stampa-descr").classList.add("da-fare");
    carta.addEventListener("click", () => apriSchedaStampa(scheda.id));
    galleria.appendChild(carta);
    const opz = { ...opzioniPer(scheda, stile, { conControlli: false }), cosa, copertina: false };
    const box = carta.querySelector(".box-anteprima");
    const n = disegnaAnteprima(opz, box, { larghezza: 175, ritaglio: 1.42, limite: limiteAnteprima(opz) });
    if (!n) box.appendChild(Object.assign(document.createElement("span"), { className: "anteprima-vuota", textContent: "Niente da stampare" }));
  }
}

// Cosa manca per un tipo (es. i numeri di chiamata per il wristband)
function avvisoScheda(scheda, schemi) {
  if (scheda.tipo === "wristband" && !schemi.some((s) => s.chiamata)) return "Servono i numeri di chiamata (pannello «Partita»)";
  if (scheda.tipo === "callsheet" && stileScelto(scheda).id === "situazione" && !schemi.some((s) => (s.situazioni || []).length)) {
    return "Per «situazione» servono le situazioni (pannello «Partita»)";
  }
  return "";
}

/* ---------- Passo 2: stile, opzioni e anteprima grande ---------- */
function apriSchedaStampa(id) {
  schedaStampa = schedaDa(id);
  paginaAnteprima = 0;
  const tutti = schemiDelPlaybook();
  const conta = (lato) => tutti.filter((s) => s.lato === lato).length;
  const scelte = [
    { id: "schema", testo: "Solo lo schema aperto", n: schemaCorrente ? 1 : 0 },
    { id: "attacco", testo: "Tutto l'attacco", n: conta("attacco") },
    { id: "difesa", testo: "Tutta la difesa", n: conta("difesa") },
    ...(conta("speciali") ? [{ id: "speciali", testo: "Tutti gli special teams", n: conta("speciali") }] : []),
    { id: "tutto", testo: `Tutto «${playbookCorrente.nome}»`, n: tutti.length },
  ];
  if (!scelte.find((s) => s.id === opzioniStampa.cosa && s.n)) {
    opzioniStampa.cosa = (scelte.find((s) => s.n) || scelte[scelte.length - 1]).id;
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

  const o = { ...OPZIONI_STAMPA_DEFAULT, ...opzioniStampa };
  impostaSegmentato("#stampa-carta", o.carta || "A4");
  impostaSegmentato("#stampa-campo", o.campo || "chiaro");
  impostaSegmentato("#stampa-raggruppa", o.raggruppa || (o.perFormazione === false ? "nessuno" : "formazione"));
  $("#stampa-copie").value = o.copie || 1;
  $("#stampa-senza-situazione").checked = Boolean(o.senzaSituazione);
  $("#stampa-note-callsheet").checked = o.noteCallsheet !== false;
  $("#stampa-colori-callsheet").checked = Boolean(o.coloriCallsheet);
  $("#stampa-dettagli-callsheet").checked = o.dettagliCallsheet !== false;
  $("#stampa-per-formazione").checked = o.perFormazione !== false;
  $("#stampa-formazione-vuota").checked = o.formazioneVuota !== false;
  $("#stampa-copertina").checked = o.copertina !== false;
  $("#stampa-note").checked = o.note !== false;
  $("#errore-stampa").textContent = tutti.length ? "" : "Non ci sono ancora schemi da stampare.";
  $("#btn-stampa-vai").disabled = !tutti.length;

  $("#titolo-scheda-stampa").textContent = `${schedaStampa.icona} ${schedaStampa.nome}`;
  mostraPasso("opzioni");
  mostraOrdineFormazioni();
  disegnaStili();
  aggiornaOpzioniTipo();
  $("#foglio-stampa").scrollTop = 0;
}

function disegnaStili() {
  const box = $("#stili-stampa");
  box.innerHTML = "";
  const scelto = stileScelto(schedaStampa);
  for (const stile of schedaStampa.stili) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "stile-stampa" + (stile.id === scelto.id ? " attivo" : "");
    b.innerHTML = `<span class="miniatura-stile"><span class="box-anteprima"></span></span>
      <span class="stile-nome"></span><span class="stile-descr"></span>`;
    b.querySelector(".stile-nome").textContent = stile.nome;
    b.querySelector(".stile-descr").textContent = stile.descr;
    b.addEventListener("click", () => {
      opzioniStampa.stili = { ...(opzioniStampa.stili || {}), [schedaStampa.id]: stile.id };
      box.querySelectorAll(".stile-stampa").forEach((x) => x.classList.toggle("attivo", x === b));
      paginaAnteprima = 0;
      aggiornaOpzioniTipo();
    });
    box.appendChild(b);
    const opz = { ...opzioniPer(schedaStampa, stile), copertina: false };
    disegnaAnteprima(opz, b.querySelector(".box-anteprima"), { larghezza: 100, altezzaMax: 92, limite: limiteAnteprima(opz) });
  }
}

/* Mostra le opzioni giuste per il tipo e lo stile, il riepilogo
   (es. "12 schemi con il numero di chiamata") e l'anteprima grande. */
function aggiornaOpzioniTipo() {
  if (!schedaStampa) return;
  const tipo = schedaStampa.tipo;
  const stile = stileScelto(schedaStampa);
  $("#opzioni-playbook").hidden = tipo !== "playbook";
  $("#opzioni-wristband").hidden = tipo !== "wristband";
  $("#opzioni-callsheet").hidden = tipo !== "callsheet";
  $("#blocco-carta").hidden = tipo === "wristband"; // il wristband ha la misura fissa
  const perSituazione = tipo === "callsheet" && (stile.opz.gruppiCallsheet || "situazione") === "situazione";
  $("#riga-senza-situazione").hidden = !perSituazione;
  $("#riga-note-callsheet").hidden = stile.opz.gruppiCallsheet === "griglia";
  $("#riga-dettagli-callsheet").hidden = stile.opz.gruppiCallsheet === "griglia";

  const info = $("#info-tipo");
  info.innerHTML = "";
  info.className = "info-tipo";
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
      b.addEventListener("click", () => numeraInAutomatico(["difesa", "speciali"].includes(cosaScelta()) ? cosaScelta() : "attacco"));
      info.appendChild(b);
    }
  } else if (perSituazione) {
    const conSituazione = schemi.filter((s) => (s.situazioni || []).length).length;
    info.textContent = conSituazione
      ? `${conSituazione} ${conSituazione === 1 ? "schema" : "schemi"} con almeno una situazione`
      : "Nessuno schema ha ancora una situazione: aprili e scegli 1° & 10, 3° & corto, Red zone… nella sezione «Partita».";
    if (!conSituazione) info.classList.add("da-fare");
  } else {
    info.textContent = `${schemi.length} ${schemi.length === 1 ? "schema" : "schemi"}`;
  }
  aggiornaAnteprimaStampa(true);
}

// Anteprima grande (con un attimo di attesa mentre si cambiano le opzioni)
function aggiornaAnteprimaStampa(subito = false) {
  if (!schedaStampa || $("#passo-opzioni").hidden) return;
  clearTimeout(timerAnteprima);
  const disegna = () => {
    const box = $("#anteprima-grande");
    const opz = opzioniPer(schedaStampa, stileScelto(schedaStampa));
    const larghezza = Math.min(420, box.parentElement.clientWidth || 360);
    const n = disegnaAnteprima(opz, box, { larghezza, altezzaMax: Math.max(300, Math.min(540, innerHeight * 0.55)), pagina: paginaAnteprima });
    if (!n) box.appendChild(Object.assign(document.createElement("p"), { className: "anteprima-vuota", textContent: "Niente da stampare con queste scelte." }));
    paginaAnteprima = Math.min(paginaAnteprima, Math.max(0, n - 1));
    $("#pagina-anteprima").textContent = n ? `Pagina ${paginaAnteprima + 1} di ${n}` : "";
    $("#anteprima-prima").disabled = paginaAnteprima <= 0;
    $("#anteprima-dopo").disabled = paginaAnteprima >= n - 1;
  };
  if (subito) disegna(); else timerAnteprima = setTimeout(disegna, 150);
}

$("#anteprima-prima").addEventListener("click", () => { paginaAnteprima = Math.max(0, paginaAnteprima - 1); aggiornaAnteprimaStampa(true); });
$("#anteprima-dopo").addEventListener("click", () => { paginaAnteprima++; aggiornaAnteprimaStampa(true); });
$("#stampa-cosa").addEventListener("change", () => { paginaAnteprima = 0; aggiornaOpzioniTipo(); });
for (const id of ["#stampa-copie", "#stampa-senza-situazione", "#stampa-note-callsheet", "#stampa-colori-callsheet", "#stampa-dettagli-callsheet",
  "#stampa-formazione-vuota", "#stampa-copertina", "#stampa-note"]) {
  $(id).addEventListener("change", () => aggiornaAnteprimaStampa());
}

$("#btn-stampa").addEventListener("click", apriFoglioStampa);
$("#btn-stampa-chiudi").addEventListener("click", chiudiFoglioStampa);
$("#btn-stampa-annulla").addEventListener("click", chiudiFoglioStampa);
$("#btn-stampa-indietro").addEventListener("click", () => { mostraPasso("galleria"); disegnaGalleria(); });

$("#foglio-stampa").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!schedaStampa) return;
  const opz = opzioniPer(schedaStampa, stileScelto(schedaStampa));
  // Un wristband senza numeri di chiamata sarebbe vuoto
  if (opz.tipo === "wristband" && !schemiNumerati(schemiDaStampare(opz.cosa)).length) {
    $("#errore-stampa").textContent = "Dai prima un numero di chiamata agli schemi (o usa «Numera in automatico»).";
    return;
  }
  // Si ricordano le scelte (non lo stile del singolo tipo: è in opzioniStampa.stili)
  const { perInserto, lista, gruppiCallsheet, appunti, scoutPerPagina, capovolta, wristband, miniSchemi, ...daRicordare } = opz;
  opzioniStampa = { ...daRicordare, scheda: schedaStampa.id, stili: opzioniStampa.stili || {} };
  scriviLocale("playbook.opzioni-stampa", opzioniStampa);
  chiudiFoglioStampa();
  setTimeout(() => stampaPlaybook(opz), 250); // dopo la chiusura della finestra
});
