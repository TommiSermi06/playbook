/* ==========================================================================
   APP PLAYBOOK — logica delle schermate
   --------------------------------------------------------------------------
   1. Disegno del campo e dei giocatori (SVG)
   2. Schermata elenco
   3. Schermata editor (trascinamento, formazioni, note)
   4. Fogli di conferma e avvisi
   ========================================================================== */

/* ---------- Misure del campo (in yarde) ---------- */
const LARGHEZZA_CAMPO = 53.33; // da linea laterale a linea laterale
const YARDE_DIETRO = 12;       // quanto campo si vede dietro la linea (attacco)
const YARDE_AVANTI = 23;       // quanto campo si vede oltre la linea (difesa)
const ALTEZZA_CAMPO = YARDE_DIETRO + YARDE_AVANTI;
const HASH_SINISTRO = 20;      // hash mark regolamento NCAA (usato anche in Europa)
const HASH_DESTRO = LARGHEZZA_CAMPO - 20;
const RAGGIO_GIOCATORE = 1.1;

const SVG_NS = "http://www.w3.org/2000/svg";

/* Converte la "y" dello schema (yarde dalla linea) nella "y" del disegno.
   Nel disegno lo 0 è in alto: la difesa sta sopra, l'attacco sotto e
   attacca verso l'alto. */
function yDisegno(yYarde) {
  return YARDE_AVANTI - yYarde;
}

// Piccolo aiuto per creare elementi SVG con i loro attributi
function crea(tag, attributi = {}, genitore = null) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [nome, valore] of Object.entries(attributi)) el.setAttribute(nome, valore);
  if (genitore) genitore.appendChild(el);
  return el;
}

/* ==========================================================================
   1. DISEGNO DEL CAMPO
   ========================================================================== */
function disegnaCampo(svg, schema, { miniatura = false } = {}) {
  svg.innerHTML = "";
  svg.setAttribute("viewBox", `0 0 ${LARGHEZZA_CAMPO} ${ALTEZZA_CAMPO}`);

  // Prato
  crea("rect", { x: 0, y: 0, width: LARGHEZZA_CAMPO, height: ALTEZZA_CAMPO, class: "prato" }, svg);

  const linee = crea("g", { class: "linee" }, svg);

  // Linee delle yarde ogni 5 yarde (più marcate ogni 10)
  for (let y = -10; y <= 20; y += 5) {
    if (y === 0) continue; // la linea di scrimmage la disegniamo a parte
    crea("line", {
      x1: 0, x2: LARGHEZZA_CAMPO, y1: yDisegno(y), y2: yDisegno(y),
      class: y % 10 === 0 ? "linea-yarde forte" : "linea-yarde",
    }, linee);
  }

  // Tacche di ogni yarda: sugli hash e vicino alle linee laterali
  if (!miniatura) {
    for (let y = -YARDE_DIETRO + 1; y < YARDE_AVANTI; y++) {
      if (y % 5 === 0) continue;
      const yy = yDisegno(y);
      for (const x of [HASH_SINISTRO, HASH_DESTRO]) {
        crea("line", { x1: x - 0.6, x2: x + 0.6, y1: yy, y2: yy, class: "tacca" }, linee);
      }
      crea("line", { x1: 0.3, x2: 1.1, y1: yy, y2: yy, class: "tacca" }, linee);
      crea("line", { x1: LARGHEZZA_CAMPO - 1.1, x2: LARGHEZZA_CAMPO - 0.3, y1: yy, y2: yy, class: "tacca" }, linee);
    }
  }

  // Linea del primo down (10 yarde avanti) e linea di scrimmage
  crea("line", { x1: 0, x2: LARGHEZZA_CAMPO, y1: yDisegno(10), y2: yDisegno(10), class: "linea-primo-down" }, linee);
  crea("line", { x1: 0, x2: LARGHEZZA_CAMPO, y1: yDisegno(0), y2: yDisegno(0), class: "linea-scrimmage" }, linee);

  // Il pallone, al centro sulla linea di scrimmage
  crea("ellipse", { cx: LARGHEZZA_CAMPO / 2, cy: yDisegno(0) - 0.05, rx: 0.32, ry: 0.5, class: "pallone" }, svg);

  // Giocatori
  const gruppo = crea("g", { class: "giocatori lato-" + schema.lato }, svg);
  for (const g of schema.giocatori) disegnaGiocatore(gruppo, g);
}

function disegnaGiocatore(genitore, g) {
  const el = crea("g", {
    class: "giocatore forma-" + g.forma,
    "data-id": g.id,
    transform: `translate(${g.x} ${yDisegno(g.y)})`,
  }, genitore);

  if (g.forma === "quadrato") {
    const lato = RAGGIO_GIOCATORE * 1.8;
    crea("rect", { x: -lato / 2, y: -lato / 2, width: lato, height: lato, rx: 0.15, class: "sagoma" }, el);
  } else if (g.forma === "cerchio") {
    crea("circle", { r: RAGGIO_GIOCATORE, class: "sagoma" }, el);
  } else {
    // Difesa: solo la lettera, con un cerchio trasparente per facilitare il tocco
    crea("circle", { r: RAGGIO_GIOCATORE, class: "sagoma-invisibile" }, el);
  }

  const testo = crea("text", {
    class: "etichetta" + (g.etichetta.length > 1 ? " lunga" : ""),
    "text-anchor": "middle",
    "dominant-baseline": "central",
  }, el);
  testo.textContent = g.etichetta;
  return el;
}

/* ==========================================================================
   2. SCHERMATA ELENCO
   ========================================================================== */
const $ = (sel) => document.querySelector(sel);

let latoSelezionato = "attacco";
let schemaCorrente = null;

function nomeFormazione(schema) {
  const f = FORMAZIONI[schema.lato].find((f) => f.id === schema.formazione);
  return f ? f.nome : "Personalizzata";
}

function dataBreve(ms) {
  const d = new Date(ms);
  const oggi = new Date();
  if (d.toDateString() === oggi.toDateString()) {
    return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

function mostraElenco() {
  const schemi = Dati.tutti().filter((s) => s.lato === latoSelezionato);
  const lista = $("#lista-schemi");
  lista.innerHTML = "";

  $("#vuoto").hidden = schemi.length > 0;
  lista.hidden = schemi.length === 0;
  $("#conteggio").textContent = schemi.length
    ? `${schemi.length} ${schemi.length === 1 ? "schema" : "schemi"}`
    : "";

  for (const schema of schemi) {
    const riga = document.createElement("li");
    riga.className = "riga";
    riga.tabIndex = 0;

    // Miniatura del campo
    const mini = document.createElementNS(SVG_NS, "svg");
    mini.setAttribute("class", "miniatura");
    disegnaCampo(mini, schema, { miniatura: true });

    const testi = document.createElement("div");
    testi.className = "riga-testi";
    const titolo = document.createElement("span");
    titolo.className = "riga-titolo" + (schema.nome ? "" : " senza-nome");
    titolo.textContent = schema.nome || "Senza nome";
    const sotto = document.createElement("span");
    sotto.className = "riga-sotto";
    sotto.textContent = `${nomeFormazione(schema)} · ${dataBreve(schema.modificato)}`;
    testi.append(titolo, sotto);

    const freccia = document.createElement("span");
    freccia.className = "freccia";
    freccia.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';

    riga.append(mini, testi, freccia);
    riga.addEventListener("click", () => apriEditor(schema.id));
    riga.addEventListener("keydown", (e) => { if (e.key === "Enter") apriEditor(schema.id); });
    lista.appendChild(riga);
  }
}

// Controllo segmentato Attacco / Difesa
document.querySelectorAll("#filtro-lato .segmento").forEach((btn) => {
  btn.addEventListener("click", () => {
    latoSelezionato = btn.dataset.lato;
    document.querySelectorAll("#filtro-lato .segmento").forEach((b) => b.classList.toggle("attivo", b === btn));
    $("#filtro-lato").dataset.scelto = latoSelezionato;
    mostraElenco();
  });
});

function nuovoSchema() {
  const schema = Dati.crea(latoSelezionato);
  apriEditor(schema.id, { focusNome: true });
}
$("#btn-nuovo").addEventListener("click", nuovoSchema);
$("#btn-nuovo-vuoto").addEventListener("click", nuovoSchema);

/* ==========================================================================
   3. SCHERMATA EDITOR
   ========================================================================== */
const svgCampo = $("#campo");

function apriEditor(id, { focusNome = false } = {}) {
  schemaCorrente = Dati.trova(id);
  if (!schemaCorrente) return;

  $("#nome-schema").value = schemaCorrente.nome;
  $("#note-schema").value = schemaCorrente.note || "";
  $("#stato-salvataggio").textContent = "";
  aggiornaInfo();
  mostraChipsFormazioni();
  disegnaCampo(svgCampo, schemaCorrente);

  $("#vista-elenco").classList.remove("attiva");
  $("#vista-elenco").classList.add("sotto");
  $("#vista-editor").classList.add("attiva");
  $("#vista-editor").scrollTop = 0;

  if (focusNome) setTimeout(() => $("#nome-schema").focus(), 350);
}

function chiudiEditor() {
  salvaSubito();
  nascondiAvviso(); // l'eventuale "Annulla" riguarda l'editor appena chiuso
  schemaCorrente = null;
  $("#nome-schema").blur();
  mostraElenco();
  $("#vista-editor").classList.remove("attiva");
  $("#vista-elenco").classList.remove("sotto");
  $("#vista-elenco").classList.add("attiva");
}
$("#btn-indietro").addEventListener("click", chiudiEditor);

function aggiornaInfo() {
  const lato = schemaCorrente.lato === "attacco" ? "Attacco" : "Difesa";
  $("#info-schema").textContent = `${lato} · ${nomeFormazione(schemaCorrente)}`;
}

/* ---------- Salvataggio automatico ----------
   Come nell'app Note: ogni modifica si salva da sola dopo un attimo,
   senza bisogno di premere "Salva". */
let timerSalvataggio = null;
function salvaTraPoco() {
  clearTimeout(timerSalvataggio);
  $("#stato-salvataggio").textContent = "";
  timerSalvataggio = setTimeout(salvaSubito, 400);
}
function salvaSubito() {
  clearTimeout(timerSalvataggio);
  if (!schemaCorrente) return;
  const ok = Dati.salva(schemaCorrente);
  $("#stato-salvataggio").textContent = ok ? "Salvato" : "Errore nel salvataggio";
}

$("#nome-schema").addEventListener("input", (e) => {
  schemaCorrente.nome = e.target.value.trim();
  salvaTraPoco();
});
$("#nome-schema").addEventListener("keydown", (e) => {
  if (e.key === "Enter") e.target.blur();
});
$("#note-schema").addEventListener("input", (e) => {
  schemaCorrente.note = e.target.value;
  salvaTraPoco();
});

/* ---------- Scelta della formazione ---------- */
function mostraChipsFormazioni() {
  const contenitore = $("#chips-formazioni");
  contenitore.innerHTML = "";
  for (const f of FORMAZIONI[schemaCorrente.lato]) {
    const chip = document.createElement("button");
    chip.className = "chip" + (f.id === schemaCorrente.formazione ? " attivo" : "");
    chip.textContent = f.nome;
    chip.addEventListener("click", () => cambiaFormazione(f.id));
    contenitore.appendChild(chip);
  }
}

function cambiaFormazione(idFormazione) {
  // Teniamo da parte le posizioni attuali per poter annullare
  const prima = {
    formazione: schemaCorrente.formazione,
    giocatori: JSON.parse(JSON.stringify(schemaCorrente.giocatori)),
  };
  schemaCorrente.formazione = idFormazione;
  schemaCorrente.giocatori = giocatoriDaFormazione(schemaCorrente.lato, idFormazione);
  disegnaCampo(svgCampo, schemaCorrente);
  mostraChipsFormazioni();
  aggiornaInfo();
  salvaSubito();

  mostraAvviso(`Formazione: ${nomeFormazione(schemaCorrente)}`, () => {
    if (!schemaCorrente) return;
    schemaCorrente.formazione = prima.formazione;
    schemaCorrente.giocatori = prima.giocatori;
    disegnaCampo(svgCampo, schemaCorrente);
    mostraChipsFormazioni();
    aggiornaInfo();
    salvaSubito();
  });
}

/* ---------- Trascinamento dei giocatori ----------
   Usiamo i "pointer events", che funzionano allo stesso modo con il dito,
   la Apple Pencil e il mouse. */
let trascinamento = null; // { giocatore, elemento, scostX, scostY }

// Converte la posizione del dito sullo schermo in coordinate del campo (yarde)
function puntoNelCampo(evento) {
  const punto = svgCampo.createSVGPoint();
  punto.x = evento.clientX;
  punto.y = evento.clientY;
  return punto.matrixTransform(svgCampo.getScreenCTM().inverse());
}

svgCampo.addEventListener("pointerdown", (evento) => {
  if (!schemaCorrente) return;
  const p = puntoNelCampo(evento);

  // Cerchiamo il giocatore più vicino al dito (entro 2,5 yarde):
  // così è facile prenderlo anche se è piccolo sullo schermo.
  let piuVicino = null;
  let distanzaMinima = 2.5;
  for (const g of schemaCorrente.giocatori) {
    const d = Math.hypot(g.x - p.x, yDisegno(g.y) - p.y);
    if (d < distanzaMinima) { distanzaMinima = d; piuVicino = g; }
  }
  if (!piuVicino) return;

  evento.preventDefault();
  svgCampo.setPointerCapture(evento.pointerId);
  const elemento = svgCampo.querySelector(`.giocatore[data-id="${piuVicino.id}"]`);
  elemento.classList.add("trascinato");
  elemento.parentNode.appendChild(elemento); // portalo sopra gli altri
  trascinamento = {
    giocatore: piuVicino,
    elemento,
    scostX: piuVicino.x - p.x,
    scostY: yDisegno(piuVicino.y) - p.y,
  };
});

svgCampo.addEventListener("pointermove", (evento) => {
  if (!trascinamento) return;
  evento.preventDefault();
  const p = puntoNelCampo(evento);
  const g = trascinamento.giocatore;

  // Nuova posizione, tenuta dentro i bordi del campo
  const x = Math.min(LARGHEZZA_CAMPO - 0.6, Math.max(0.6, p.x + trascinamento.scostX));
  const yD = Math.min(ALTEZZA_CAMPO - 0.6, Math.max(0.6, p.y + trascinamento.scostY));
  g.x = Math.round(x * 10) / 10;
  g.y = Math.round((YARDE_AVANTI - yD) * 10) / 10;

  trascinamento.elemento.setAttribute("transform", `translate(${g.x} ${yDisegno(g.y)})`);
});

function fineTrascinamento() {
  if (!trascinamento) return;
  trascinamento.elemento.classList.remove("trascinato");
  trascinamento = null;
  salvaTraPoco();
}
svgCampo.addEventListener("pointerup", fineTrascinamento);
svgCampo.addEventListener("pointercancel", fineTrascinamento);

/* ---------- Duplica / Elimina ---------- */
$("#btn-duplica").addEventListener("click", () => {
  salvaSubito();
  const copia = Dati.duplica(schemaCorrente.id);
  if (copia) {
    apriEditor(copia.id);
    mostraAvviso("Schema duplicato");
  }
});

$("#btn-elimina").addEventListener("click", () => {
  const nome = schemaCorrente.nome || "questo schema";
  chiediConferma(`Vuoi eliminare "${nome}"?`, "Elimina schema", () => {
    const eliminato = Dati.elimina(schemaCorrente.id);
    schemaCorrente = null;
    $("#vista-editor").classList.remove("attiva");
    $("#vista-elenco").classList.remove("sotto");
    $("#vista-elenco").classList.add("attiva");
    mostraElenco();
    mostraAvviso("Schema eliminato", () => {
      Dati.salva(eliminato);
      mostraElenco();
    });
  });
});

/* ==========================================================================
   4. FOGLIO DI CONFERMA E AVVISI
   ========================================================================== */
let azioneConferma = null;

function chiediConferma(messaggio, etichettaBottone, azione) {
  $("#conferma-testo").textContent = messaggio;
  $("#conferma-ok").textContent = etichettaBottone;
  azioneConferma = azione;
  $("#velo").hidden = false;
  $("#foglio-conferma").hidden = false;
  // Un frame dopo aggiungiamo la classe, così parte l'animazione
  requestAnimationFrame(() => {
    $("#velo").classList.add("visibile");
    $("#foglio-conferma").classList.add("visibile");
  });
}

function chiudiConferma() {
  $("#velo").classList.remove("visibile");
  $("#foglio-conferma").classList.remove("visibile");
  setTimeout(() => {
    $("#velo").hidden = true;
    $("#foglio-conferma").hidden = true;
  }, 300);
}

$("#conferma-ok").addEventListener("click", () => {
  chiudiConferma();
  if (azioneConferma) azioneConferma();
  azioneConferma = null;
});
$("#conferma-annulla").addEventListener("click", chiudiConferma);
$("#velo").addEventListener("click", chiudiConferma);

// Avviso in basso, con pulsante "Annulla" opzionale
let timerAvviso = null;
function mostraAvviso(messaggio, annulla = null) {
  const toast = $("#toast");
  toast.innerHTML = "";
  const testo = document.createElement("span");
  testo.textContent = messaggio;
  toast.appendChild(testo);
  if (annulla) {
    const btn = document.createElement("button");
    btn.textContent = "Annulla";
    btn.addEventListener("click", () => {
      annulla();
      nascondiAvviso();
    });
    toast.appendChild(btn);
  }
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add("visibile"));
  clearTimeout(timerAvviso);
  timerAvviso = setTimeout(nascondiAvviso, 4000);
}
function nascondiAvviso() {
  clearTimeout(timerAvviso);
  const toast = $("#toast");
  toast.classList.remove("visibile");
  setTimeout(() => { if (!toast.classList.contains("visibile")) toast.hidden = true; }, 300);
}

// Salva anche se l'app viene chiusa o messa in background
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") salvaSubito();
});

/* ---------- Avvio ---------- */
mostraElenco();
