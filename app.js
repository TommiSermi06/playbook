/* ==========================================================================
   APP PLAYBOOK — logica (versione per computer)
   --------------------------------------------------------------------------
   1. Disegno del campo e dei giocatori (SVG)
   2. Barra laterale: elenco degli schemi
   3. Editor: apertura, salvataggio automatico, formazioni, note
   4. Mouse: selezione e trascinamento dei giocatori
   5. Annulla / Ripeti
   6. Scorciatoie da tastiera
   7. Finestra di conferma e avvisi
   ========================================================================== */

/* ---------- Misure del campo (in yarde) ---------- */
const LARGHEZZA_CAMPO = 53.33; // da linea laterale a linea laterale
const YARDE_DIETRO = 12;       // quanto campo si vede dietro la linea (attacco)
const YARDE_AVANTI = 23;       // quanto campo si vede oltre la linea (difesa)
const ALTEZZA_CAMPO = YARDE_DIETRO + YARDE_AVANTI;
const HASH_SINISTRO = 20;      // hash mark regolamento NCAA (usato anche in Europa)
const HASH_DESTRO = LARGHEZZA_CAMPO - 20;
const RAGGIO_GIOCATORE = 0.95;

const SVG_NS = "http://www.w3.org/2000/svg";
const SU_MAC = /Mac|iPhone|iPad/.test(navigator.platform);
const TASTO_CMD = SU_MAC ? "⌘" : "Ctrl+";

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

const $ = (sel) => document.querySelector(sel);

/* ==========================================================================
   1. DISEGNO DEL CAMPO
   ========================================================================== */
function disegnaCampo(svg, schema, { miniatura = false, selezionato = null, stampa = false } = {}) {
  // "vivo" = il campo dell'editor (con animazioni e maniglie); miniature e stampa sono statiche
  const vivo = !miniatura && !stampa;
  svg.innerHTML = "";
  svg.setAttribute("viewBox", `0 0 ${LARGHEZZA_CAMPO} ${ALTEZZA_CAMPO}`);

  // Prato
  crea("rect", { x: 0, y: 0, width: LARGHEZZA_CAMPO, height: ALTEZZA_CAMPO, class: "prato" }, svg);
  // Strisce alterne ogni 5 yarde, come il taglio dell'erba negli stadi
  for (let y = -10; y < YARDE_AVANTI; y += 10) {
    crea("rect", { x: 0, y: yDisegno(y + 5), width: LARGHEZZA_CAMPO, height: 5, class: "striscia" }, svg);
  }

  // Filigrana: il logo della squadra grande e tenue al centro del campo,
  // come il logo di metà campo negli stadi. Fa parte del disegno,
  // quindi comparirà anche nelle stampe.
  if (!miniatura && typeof Squadra !== "undefined" && Squadra.logo) {
    const lato = 16;
    crea("image", {
      href: Squadra.logo,
      x: (LARGHEZZA_CAMPO - lato) / 2,
      y: (ALTEZZA_CAMPO - lato) / 2 - 3,
      width: lato,
      height: lato,
      preserveAspectRatio: "xMidYMid meet",
      class: "filigrana",
    }, svg);
  }

  const linee = crea("g", { class: "linee" }, svg);

  // Linee delle yarde ogni 5 yarde (più marcate ogni 10)
  for (let y = -10; y <= 20; y += 5) {
    if (y === 0) continue; // la linea di scrimmage la disegniamo a parte
    crea("line", {
      x1: 0, x2: LARGHEZZA_CAMPO, y1: yDisegno(y), y2: yDisegno(y),
      class: y % 10 === 0 ? "linea-yarde forte" : "linea-yarde",
    }, linee);
  }

  if (!miniatura) {
    // Tacche di ogni yarda: sugli hash e vicino alle linee laterali
    for (let y = -YARDE_DIETRO + 1; y < YARDE_AVANTI; y++) {
      if (y % 5 === 0) continue;
      const yy = yDisegno(y);
      for (const x of [HASH_SINISTRO, HASH_DESTRO]) {
        crea("line", { x1: x - 0.6, x2: x + 0.6, y1: yy, y2: yy, class: "tacca" }, linee);
      }
      crea("line", { x1: 0.3, x2: 1.1, y1: yy, y2: yy, class: "tacca" }, linee);
      crea("line", { x1: LARGHEZZA_CAMPO - 1.1, x2: LARGHEZZA_CAMPO - 0.3, y1: yy, y2: yy, class: "tacca" }, linee);
    }

    // Distanza dalla linea scritta a bordo campo (+5, +10, -5…)
    for (let y = -10; y <= 20; y += 5) {
      if (y === 0) continue;
      const testo = (y > 0 ? "+" : "−") + Math.abs(y);
      for (const [x, ancora] of [[2.4, "start"], [LARGHEZZA_CAMPO - 2.4, "end"]]) {
        const t = crea("text", {
          x, y: yDisegno(y) - 0.45, "text-anchor": ancora, class: "numero-yarde", // appena sopra la linea
        }, linee);
        t.textContent = testo;
      }
    }
  }

  // Linea del primo down (10 yarde avanti) e linea di scrimmage
  crea("line", { x1: 0, x2: LARGHEZZA_CAMPO, y1: yDisegno(10), y2: yDisegno(10), class: "linea-primo-down" }, linee);
  crea("line", { x1: 0, x2: LARGHEZZA_CAMPO, y1: yDisegno(0), y2: yDisegno(0), class: "linea-scrimmage" }, linee);

  // In stampa: un bordo attorno al campo (sul foglio bianco altrimenti non si vede)
  if (stampa) {
    crea("rect", { x: 0.05, y: 0.05, width: LARGHEZZA_CAMPO - 0.1, height: ALTEZZA_CAMPO - 0.1, rx: 0.4, class: "bordo-campo" }, svg);
  }

  // Il pallone: in attacco compare solo quando c'è il centro (C) e sta
  // sempre davanti a lui; in difesa resta al centro della linea come riferimento.
  const palla = posizionePalla(schema);
  if (palla) {
    let sbuca = false;
    if (vivo) {
      // Animazione solo quando la palla appare (il C è appena entrato in campo)
      sbuca = statoPalla.idSchema === schema.id && !statoPalla.visibile;
      statoPalla = { idSchema: schema.id, visibile: true };
    }
    const gp = crea("g", { class: "palla" + (sbuca ? " sbuca" : ""), transform: `translate(${palla.x} ${yDisegno(palla.y)})` }, svg);
    crea("ellipse", { cx: 0, cy: 0, rx: 0.32, ry: 0.5, class: "pallone" }, gp);
  } else if (vivo) {
    statoPalla = { idSchema: schema.id, visibile: false };
  }

  // Tracce (sotto i giocatori): un gruppo per giocatore, spostato sulla
  // sua posizione, così quando lo trascini la traccia lo segue.
  const conTracce = typeof Tracce !== "undefined";
  const livelloTracce = crea("g", { class: "tracce" }, svg);
  for (const g of schema.giocatori) {
    const gt = crea("g", {
      class: `tracce-giocatore ruolo-${ruoloDi(schema.lato, g.etichetta)}`,
      "data-id": g.id,
      transform: `translate(${g.x} ${yDisegno(g.y)})`,
    }, livelloTracce);
    const inDisegno = vivo && conTracce && Tracce.disegno && Tracce.disegno.giocatore.id === g.id;
    if (g.traccia && !inDisegno) {
      const anima = vivo && conTracce && Tracce.daAnimare === g.id;
      disegnaTraccia(gt, g, { anima, idMaschera: "m-" + g.id + "-" + Date.now() });
    }
  }
  if (vivo && conTracce) Tracce.daAnimare = null;

  // Giocatori
  const gruppo = crea("g", { class: "giocatori lato-" + schema.lato }, svg);
  schema.giocatori.forEach((g, i) => {
    const el = disegnaGiocatore(gruppo, g, schema.lato);
    el.style.setProperty("--i", i); // per far entrare i giocatori uno dopo l'altro
    if (g.id === selezionato) el.classList.add("selezionato");
  });

  // Maniglie: i punti della traccia del giocatore selezionato, da trascinare
  const sel = schema.giocatori.find((g) => g.id === selezionato);
  if (vivo && sel && sel.traccia && !(typeof Tracce !== "undefined" && Tracce.disegno)) {
    const maniglie = crea("g", { class: "maniglie" }, svg);
    sel.traccia.punti.forEach((p, i) => {
      crea("circle", { cx: sel.x + p.dx, cy: yDisegno(sel.y + p.dy), r: 0.42, class: "maniglia", "data-indice": i }, maniglie);
    });
  }
}

/* ---------- Regola: nessuno oltre la linea di scrimmage ----------
   Attacco: sempre dietro la linea (al massimo la tocca, come la linea d'attacco).
   Difesa: sempre dall'altra parte. Vale per mouse, frecce, pedine e profondità. */
const DISTANZA_MIN_LINEA = 0.9; // yarde: il giocatore "tocca" la linea

function limitiY(lato) {
  return lato === "attacco"
    ? { min: -YARDE_DIETRO + 0.6, max: -DISTANZA_MIN_LINEA }
    : { min: DISTANZA_MIN_LINEA, max: YARDE_AVANTI - 0.6 };
}

// Tiene la y dentro i limiti; se il giocatore "sbatte" sulla linea la fa illuminare
function limitaY(lato, y, { avvisa = true } = {}) {
  const { min, max } = limitiY(lato);
  const oltreLinea = lato === "attacco" ? y > max + 0.01 : y < min - 0.01;
  if (oltreLinea && avvisa) segnalaLinea();
  return +Math.min(max, Math.max(min, y)).toFixed(1);
}

let timerLinea = null;
function segnalaLinea() {
  const linea = svgCampo.querySelector(".linea-scrimmage");
  if (!linea) return;
  linea.classList.add("avviso");
  clearTimeout(timerLinea);
  timerLinea = setTimeout(() => {
    const l = svgCampo.querySelector(".linea-scrimmage");
    if (l) l.classList.remove("avviso");
  }, 650);
}

// Aggiorna sul campo giocatore, traccia, pallone e pannello dopo uno spostamento
function posizionaGiocatore(g) {
  const t = `translate(${g.x} ${yDisegno(g.y)})`;
  const el = svgCampo.querySelector(`.giocatore[data-id="${g.id}"]`);
  if (el) el.setAttribute("transform", t);
  const livello = svgCampo.querySelector(`.tracce-giocatore[data-id="${g.id}"]`);
  if (livello) livello.setAttribute("transform", t);
  const maniglie = svgCampo.querySelector(".maniglie");
  if (maniglie) maniglie.remove();
  aggiornaProfondita(g);
  if (g === centroDi(schemaCorrente)) seguiPalla();
}

/* ---------- Il pallone ---------- */
let statoPalla = { idSchema: null, visibile: false }; // per sapere quando "sbuca"

function centroDi(schema) {
  return schema.lato === "attacco" ? schema.giocatori.find((g) => g.etichetta === "C") : null;
}

// Dove sta la palla (in yarde), oppure null se non va disegnata
function posizionePalla(schema) {
  if (schema.lato === "difesa") return { x: LARGHEZZA_CAMPO / 2, y: 0 };
  const c = centroDi(schema);
  return c ? { x: c.x, y: c.y + 1 } : null; // appena davanti al centro, sulla linea
}

// Sposta la palla mentre trascini il centro (senza ridisegnare tutto)
function seguiPalla() {
  const palla = posizionePalla(schemaCorrente);
  const el = svgCampo.querySelector(".palla");
  if (palla && el) el.setAttribute("transform", `translate(${palla.x} ${yDisegno(palla.y)})`);
}

/* Piccola animazione: i giocatori "entrano" sul campo uno dopo l'altro */
function animaEntrata() {
  svgCampo.classList.remove("entrata");
  void svgCampo.getBoundingClientRect(); // fa ripartire l'animazione
  svgCampo.classList.add("entrata");
  clearTimeout(animaEntrata.timer);
  animaEntrata.timer = setTimeout(() => svgCampo.classList.remove("entrata"), 900);
}

/* ---------- Ruoli e colori ----------
   Dalla sigla capiamo il gruppo del giocatore, e da questo il suo colore.
   Se rinomini un giocatore (es. Y -> TE) il colore si aggiorna da solo. */
const RUOLI = {
  attacco: {
    linea: ["C", "G", "T", "LG", "RG", "LT", "RT", "OL"],
    qb: ["QB", "Q"],
    back: ["RB", "FB", "TB", "HB", "B", "F"],
    ricevitori: ["X", "Y", "Z", "H", "W", "TE", "WR", "SL", "A"],
  },
  difesa: {
    dl: ["E", "T", "N", "DE", "DT", "NT", "DL"],
    lb: ["W", "M", "S", "B", "J", "LB", "OLB", "ILB", "MLB", "SAM", "MIK", "WIL"],
    db: ["C", "CB", "FS", "SS", "NB", "$", "DB", "F"],
  },
};
const NOMI_RUOLI = {
  linea: "Linea", qb: "Quarterback", back: "Back", ricevitori: "Ricevitori",
  dl: "Linea difensiva", lb: "Linebacker", db: "Secondaria",
};

function ruoloDi(lato, etichetta) {
  for (const [ruolo, sigle] of Object.entries(RUOLI[lato])) {
    if (sigle.includes(etichetta)) return ruolo;
  }
  return lato === "attacco" ? "ricevitori" : "lb"; // sigla sconosciuta
}

function disegnaGiocatore(genitore, g, lato) {
  const el = crea("g", {
    class: `giocatore forma-${g.forma} ruolo-${ruoloDi(lato, g.etichetta)}`,
    "data-id": g.id,
    transform: `translate(${g.x} ${yDisegno(g.y)})`,
  }, genitore);

  // Alone che compare quando il giocatore è selezionato
  crea("circle", { r: RAGGIO_GIOCATORE * 1.55, class: "alone" }, el);

  if (g.forma === "quadrato") {
    const lato = RAGGIO_GIOCATORE * 1.8;
    crea("rect", { x: -lato / 2, y: -lato / 2, width: lato, height: lato, rx: 0.15, class: "sagoma" }, el);
  } else if (g.forma === "cerchio") {
    crea("circle", { r: RAGGIO_GIOCATORE, class: "sagoma" }, el);
  } else {
    // Difesa: solo la lettera, con un cerchio trasparente per prenderla col mouse
    crea("circle", { r: RAGGIO_GIOCATORE * 1.2, class: "sagoma-invisibile" }, el);
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
   2. BARRA LATERALE: ELENCO DEGLI SCHEMI
   ========================================================================== */
let latoSelezionato = "attacco";
let schemaCorrente = null;     // lo schema aperto nell'editor
let giocatoreSelezionato = null; // id del giocatore selezionato

function nomeFormazione(schema) {
  if (!schema.formazione) return "Nessuna formazione";
  if (schema.formazione === "libera") return "Formazione libera";
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
  const testoCerca = $("#cerca").value.trim().toLowerCase();
  const delLato = Dati.tutti().filter((s) => s.lato === latoSelezionato);
  const schemi = delLato.filter((s) =>
    !testoCerca ||
    (s.nome || "").toLowerCase().includes(testoCerca) ||
    nomeFormazione(s).toLowerCase().includes(testoCerca)
  );

  const lista = $("#lista-schemi");
  lista.innerHTML = "";
  lista.hidden = schemi.length === 0;

  const vuota = $("#lista-vuota");
  vuota.hidden = schemi.length > 0;
  vuota.textContent = delLato.length
    ? "Nessuno schema trovato."
    : `Nessuno schema di ${latoSelezionato}. Premi + per crearne uno.`;

  $("#conteggio").textContent = delLato.length
    ? `${delLato.length} ${delLato.length === 1 ? "schema" : "schemi"}`
    : "";

  for (const schema of schemi) {
    const riga = document.createElement("li");
    riga.className = "riga" + (schemaCorrente && schemaCorrente.id === schema.id ? " attiva" : "");
    riga.tabIndex = 0;
    riga.dataset.id = schema.id;

    // Miniatura del campo
    const mini = document.createElementNS(SVG_NS, "svg");
    mini.setAttribute("class", "miniatura");
    disegnaCampo(mini, schema, { miniatura: true });

    const testi = document.createElement("div");
    testi.className = "riga-testi";
    const titolo = document.createElement("span");
    titolo.className = "riga-titolo" + (schema.nome ? "" : " senza-nome");
    titolo.textContent = schema.nome || "Senza nome";
    if (schema.bloccato) titolo.insertAdjacentHTML("afterbegin", '<span class="mini-lucchetto" title="Bloccato">🔒</span> ');
    const sotto = document.createElement("span");
    sotto.className = "riga-sotto";
    sotto.textContent = `${nomeFormazione(schema)} · ${dataBreve(schema.modificato)}`;
    testi.append(titolo, sotto);

    riga.append(mini, testi);
    riga.addEventListener("click", () => apriEditor(schema.id));
    riga.addEventListener("keydown", (e) => { if (e.key === "Enter") apriEditor(schema.id); });
    lista.appendChild(riga);
  }
}

// Aggiorna solo la riga dello schema aperto (più leggero che ridisegnare tutto)
function aggiornaRigaCorrente() {
  if (!schemaCorrente) return;
  const riga = document.querySelector(`.riga[data-id="${schemaCorrente.id}"]`);
  if (!riga) return mostraElenco();
  disegnaCampo(riga.querySelector(".miniatura"), schemaCorrente, { miniatura: true });
  const titolo = riga.querySelector(".riga-titolo");
  titolo.textContent = schemaCorrente.nome || "Senza nome";
  if (schemaCorrente.bloccato) titolo.insertAdjacentHTML("afterbegin", '<span class="mini-lucchetto" title="Bloccato">🔒</span> ');
  titolo.classList.toggle("senza-nome", !schemaCorrente.nome);
  riga.querySelector(".riga-sotto").textContent =
    `${nomeFormazione(schemaCorrente)} · ${dataBreve(Date.now())}`;
}

function scegliLato(lato) {
  latoSelezionato = lato;
  document.querySelectorAll("#filtro-lato .segmento").forEach((b) =>
    b.classList.toggle("attivo", b.dataset.lato === lato));
  $("#filtro-lato").dataset.scelto = lato;
  mostraElenco();
}

document.querySelectorAll("#filtro-lato .segmento").forEach((btn) => {
  btn.addEventListener("click", () => scegliLato(btn.dataset.lato));
});
$("#cerca").addEventListener("input", mostraElenco);

function nuovoSchema() {
  const schema = Dati.crea(latoSelezionato);
  apriEditor(schema.id, { focusNome: true });
}
$("#btn-nuovo").addEventListener("click", nuovoSchema);
$("#btn-nuovo-vuoto").addEventListener("click", nuovoSchema);

/* ==========================================================================
   3. EDITOR
   ========================================================================== */
const svgCampo = $("#campo");

function apriEditor(id, { focusNome = false } = {}) {
  salvaSubito(); // salva lo schema che stavamo modificando
  nascondiAvviso();

  chiudiMenuTracce();
  if (Tracce.disegno) Tracce.annullaDisegno();
  schemaCorrente = Dati.trova(id);
  if (!schemaCorrente) return;
  giocatoreSelezionato = null;
  tavolozzaAperta = schemaCorrente.formazione === "libera" && !schemaCorrente.bloccato;
  // Schemi creati prima di questa regola: chi era oltre la linea torna al suo posto
  for (const g of schemaCorrente.giocatori) g.y = limitaY(schemaCorrente.lato, g.y, { avvisa: false });
  storia = { indietro: [], avanti: [] };
  aggiornaPulsantiStoria();

  // Se lo schema è dell'altro lato, cambiamo anche la barra laterale
  if (schemaCorrente.lato !== latoSelezionato) scegliLato(schemaCorrente.lato);

  $("#nome-schema").value = schemaCorrente.nome;
  $("#note-schema").value = schemaCorrente.note || "";
  $("#stato-salvataggio").textContent = "";
  $("#vuoto").hidden = true;
  $("#editor").hidden = false;
  $("#pannello").hidden = false;

  ridisegna();
  animaEntrata();
  mostraElenco();
  if (focusNome) $("#nome-schema").focus();
}

function chiudiEditor() {
  salvaSubito();
  schemaCorrente = null;
  giocatoreSelezionato = null;
  $("#editor").hidden = true;
  $("#pannello").hidden = true;
  $("#vuoto").hidden = false;
  mostraElenco();
}

// Ridisegna campo, pannello e intestazione dello schema aperto
function ridisegna() {
  disegnaCampo(svgCampo, schemaCorrente, { selezionato: giocatoreSelezionato });
  const lato = schemaCorrente.lato === "attacco" ? "Attacco" : "Difesa";
  const ribaltato = schemaCorrente.ribaltato ? " (ribaltata)" : "";
  $("#info-schema").textContent = `${lato} · ${nomeFormazione(schemaCorrente)}${ribaltato} ·`;
  $("#btn-ribalta").classList.toggle("attivo", !!schemaCorrente.ribaltato);
  mostraFormazioni();
  mostraLegenda();
  mostraCampoVuoto();
  aggiornaLucchetto();
  mostraInfoGiocatore();
}

/* ---------- Salvataggio automatico ----------
   Come nell'app Note: ogni modifica si salva da sola dopo un attimo,
   senza bisogno di premere "Salva". */
let timerSalvataggio = null;
function salvaTraPoco() {
  clearTimeout(timerSalvataggio);
  $("#stato-salvataggio").textContent = "Modificato";
  timerSalvataggio = setTimeout(salvaSubito, 400);
}
function salvaSubito() {
  clearTimeout(timerSalvataggio);
  if (!schemaCorrente) return;
  const ok = Dati.salva(schemaCorrente);
  $("#stato-salvataggio").textContent = ok ? "Salvato" : "Errore nel salvataggio";
  festeggiaStemma();
  aggiornaRigaCorrente();
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
function mostraFormazioni() {
  const contenitore = $("#lista-formazioni");
  contenitore.innerHTML = "";
  for (const f of FORMAZIONI[schemaCorrente.lato]) {
    const scelta = document.createElement("button");
    scelta.className = "scelta" + (f.id === schemaCorrente.formazione ? " attiva" : "");
    scelta.innerHTML = `<span></span><svg class="spunta" viewBox="0 0 24 24" width="16" height="16"><path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;
    scelta.querySelector("span").textContent = f.nome;
    scelta.addEventListener("click", () => cambiaFormazione(f.id));
    contenitore.appendChild(scelta);
  }
  // Ultima voce: crea la formazione da zero
  const daZero = document.createElement("button");
  daZero.className = "scelta da-zero" + (schemaCorrente.formazione === "libera" ? " attiva" : "");
  daZero.innerHTML = `<span>＋ Crea da zero</span><svg class="spunta" viewBox="0 0 24 24" width="16" height="16"><path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;
  daZero.addEventListener("click", creaDaZero);
  contenitore.appendChild(daZero);
  contenitore.classList.toggle("disattivata", Boolean(schemaCorrente.bloccato));
  mostraTavolozza();
}

function cambiaFormazione(idFormazione) {
  if (schemaBloccato()) return;
  if (idFormazione === schemaCorrente.formazione) return;
  tavolozzaAperta = false;
  chiudiMenuTracce();
  ricordaStato();
  schemaCorrente.formazione = idFormazione;
  schemaCorrente.giocatori = giocatoriDaFormazione(schemaCorrente.lato, idFormazione);
  schemaCorrente.ribaltato = false;
  giocatoreSelezionato = null;
  ridisegna();
  animaEntrata();
  salvaSubito();
  mostraAvviso(`Formazione: ${nomeFormazione(schemaCorrente)}`, annulla);
}

/* ---------- Campo vuoto: invito a scegliere o creare la formazione ---------- */
function mostraCampoVuoto() {
  const vuoto = !schemaCorrente.giocatori.length;
  $("#campo-vuoto").hidden = !vuoto;
  if (!vuoto) return;
  const conTavolozza = tavolozzaAperta && schemaCorrente.formazione === "libera";
  $("#campo-vuoto-titolo").textContent = conTavolozza ? "Trascina qui i giocatori" : "Campo libero";
  $("#campo-vuoto-testo").textContent = conTavolozza
    ? "Prendili dalla tavolozza a destra, oppure cliccali per metterli nella posizione tipica."
    : "Scegli una formazione a destra oppure creane una tua.";
  $("#btn-crea-da-zero-campo").hidden = conTavolozza || Boolean(schemaCorrente.bloccato);
}
$("#btn-crea-da-zero-campo").addEventListener("click", () => creaDaZero());

/* ---------- Legenda dei colori sotto il campo ---------- */
function mostraLegenda() {
  const legenda = $("#legenda");
  legenda.innerHTML = "";
  for (const ruolo of Object.keys(RUOLI[schemaCorrente.lato])) {
    const voce = document.createElement("span");
    voce.className = "ruolo-" + ruolo;
    voce.innerHTML = "<i></i>";
    voce.append(NOMI_RUOLI[ruolo]);
    legenda.appendChild(voce);
  }
}

/* ---------- Ribalta: lo schema diventa a specchio (destra <-> sinistra) ---------- */
function ribalta() {
  if (!schemaCorrente || schemaBloccato()) return;
  chiudiMenuTracce();
  ricordaStato();
  for (const g of schemaCorrente.giocatori) {
    g.x = +(LARGHEZZA_CAMPO - g.x).toFixed(2);
    if (g.traccia) g.traccia.punti.forEach((p) => { p.dx = -p.dx; }); // anche le tracce a specchio
  }
  schemaCorrente.ribaltato = !schemaCorrente.ribaltato;
  ridisegna();
  salvaSubito();
}
$("#btn-ribalta").addEventListener("click", ribalta);

/* ---------- Pannello del giocatore selezionato ---------- */
// Mostra la profondità del giocatore nel pannello (se non la stai scrivendo)
function aggiornaProfondita(g) {
  const campoYd = $("#profondita-giocatore");
  if (!campoYd) return;
  if (document.activeElement !== campoYd) campoYd.value = +Math.abs(g.y).toFixed(1);
}

function descriviPosizione(g) {
  const dist = Math.abs(g.y).toLocaleString("it-IT", { maximumFractionDigits: 1 });
  if (Math.abs(g.y) < 0.05) return "sulla linea di scrimmage";
  return g.y < 0 ? `${dist} yd dietro la linea` : `${dist} yd oltre la linea`;
}

function mostraInfoGiocatore() {
  const box = $("#info-giocatore");
  const g = schemaCorrente.giocatori.find((g) => g.id === giocatoreSelezionato);
  if (!g) {
    box.innerHTML = schemaCorrente.bloccato
      ? '<p class="testo-secondario">🔒 Schema bloccato. Sbloccalo con il lucchetto per modificarlo.</p>'
      : '<p class="testo-secondario">Clicca un giocatore sul campo.</p>';
    return;
  }
  box.innerHTML = `
    <label class="riga-campo">
      <span>Ruolo</span>
      <input id="etichetta-giocatore" type="text" maxlength="3" autocomplete="off">
    </label>
    <div class="riga-campo">
      <span>Profondità</span>
      <span class="campo-profondita">
        <input id="profondita-giocatore" type="number" step="0.5" inputmode="decimal" title="Yarde dalla linea di scrimmage">
        <span id="verso-profondita"></span>
      </span>
    </div>
    <div class="riga-campo">
      <span>Traccia</span>
      <span class="valore" id="nome-traccia"></span>
    </div>
    <label class="riga-campo" id="riga-tipo-traccia">
      <span>Tipo di linea</span>
      <select id="tipo-traccia"></select>
    </label>
    <label class="riga-campo" id="riga-curva">
      <span>Linea morbida <kbd>C</kbd></span>
      <input type="checkbox" class="interruttore" id="curva-traccia">
    </label>
    <div class="riga-pulsanti">
      <button class="btn-mini" id="btn-traccia-menu">Scegli traccia…</button>
      <button class="btn-mini" id="btn-traccia-mano">Disegna a mano</button>
      <button class="btn-mini distruttiva" id="btn-traccia-via">Rimuovi traccia</button>
      <button class="btn-mini distruttiva" id="btn-giocatore-via">Togli giocatore</button>
    </div>`;
  $("#btn-giocatore-via").addEventListener("click", () => rimuoviGiocatore(g));
  // Traccia del giocatore
  $("#nome-traccia").textContent = g.traccia ? (g.traccia.nome || infoTipo(g.traccia.tipo).nome) : "Nessuna";
  $("#riga-tipo-traccia").hidden = !g.traccia;
  $("#riga-curva").hidden = !g.traccia;
  $("#curva-traccia").checked = Boolean(g.traccia && g.traccia.curva);
  $("#curva-traccia").addEventListener("change", () => Tracce.commutaCurva(g));
  $("#btn-traccia-via").hidden = !g.traccia;
  const scelta = $("#tipo-traccia");
  for (const t of TIPI_TRACCIA[schemaCorrente.lato]) scelta.add(new Option(t.nome, t.id));
  if (g.traccia) scelta.value = g.traccia.tipo;
  scelta.addEventListener("change", () => {
    ricordaStato();
    g.traccia.tipo = scelta.value;
    ridisegna();
    salvaTraPoco();
  });
  $("#btn-traccia-menu").addEventListener("click", () => apriMenuTracce(g));
  $("#btn-traccia-mano").addEventListener("click", () => Tracce.iniziaDisegno(g));
  $("#btn-traccia-via").addEventListener("click", () => Tracce.rimuovi(g));
  const input = $("#etichetta-giocatore");
  input.value = g.etichetta;
  aggiornaProfondita(g);

  // Scrivi le yarde: il giocatore si sposta da solo.
  // L'attacco sta sempre dietro la linea, la difesa sempre oltre.
  const campoYd = $("#profondita-giocatore");
  const attacco = schemaCorrente.lato === "attacco";
  const verso = attacco ? -1 : 1;
  const { min, max } = limitiY(schemaCorrente.lato);
  campoYd.min = DISTANZA_MIN_LINEA;
  campoYd.max = attacco ? -min : max;
  $("#verso-profondita").textContent = attacco ? "yd dietro la linea" : "yd oltre la linea";
  const applicaProfondita = () => {
    const yarde = parseFloat(String(campoYd.value).replace(",", "."));
    if (Number.isNaN(yarde)) return;
    g.y = limitaY(schemaCorrente.lato, yarde * verso);
    posizionaGiocatore(g);
    salvaTraPoco();
  };
  campoYd.addEventListener("focus", () => ricordaStato());
  campoYd.addEventListener("input", applicaProfondita);
  // Quando esci dal campo mostriamo il valore vero (es. 0 diventa 0,9: tocca la linea)
  campoYd.addEventListener("blur", () => aggiornaProfondita(g));
  campoYd.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === "Escape") campoYd.blur(); });

  input.addEventListener("focus", () => ricordaStato());
  input.addEventListener("input", () => {
    g.etichetta = input.value.toUpperCase().trim() || "?";
    disegnaCampo(svgCampo, schemaCorrente, { selezionato: giocatoreSelezionato });
    salvaTraPoco();
  });
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === "Escape") input.blur(); });
}

/* ==========================================================================
   4. MOUSE: SELEZIONE E TRASCINAMENTO
   Usiamo i "pointer events": funzionano col mouse, col trackpad e
   (più avanti) anche col dito sugli schermi touch.
   ========================================================================== */
let trascinamento = null; // { giocatore, elemento, scostX, scostY, mosso }

// Converte la posizione del mouse sullo schermo in coordinate del campo (yarde)
function puntoNelCampo(evento) {
  const punto = svgCampo.createSVGPoint();
  punto.x = evento.clientX;
  punto.y = evento.clientY;
  return punto.matrixTransform(svgCampo.getScreenCTM().inverse());
}

// Trova il giocatore più vicino al punto, entro una certa distanza
function giocatoreVicino(p, raggio = 1.6) {
  let piuVicino = null;
  let distanzaMinima = raggio;
  for (const g of schemaCorrente.giocatori) {
    const d = Math.hypot(g.x - p.x, yDisegno(g.y) - p.y);
    if (d < distanzaMinima) { distanzaMinima = d; piuVicino = g; }
  }
  return piuVicino;
}

function selezionaGiocatore(id) {
  if (id !== giocatoreSelezionato) chiudiMenuTracce();
  giocatoreSelezionato = id;
  disegnaCampo(svgCampo, schemaCorrente, { selezionato: id }); // mostra le maniglie della traccia
  mostraInfoGiocatore();
}

// Trova la maniglia (punto della traccia) vicina al mouse
function manigliaVicina(p) {
  const g = schemaCorrente.giocatori.find((g) => g.id === giocatoreSelezionato);
  if (!g || !g.traccia) return null;
  let migliore = null, distMin = 0.9;
  g.traccia.punti.forEach((pt, i) => {
    const d = Math.hypot(g.x + pt.dx - p.x, yDisegno(g.y + pt.dy) - p.y);
    if (d < distMin) { distMin = d; migliore = { giocatore: g, indice: i }; }
  });
  return migliore;
}

svgCampo.addEventListener("pointerdown", (evento) => {
  if (!schemaCorrente || evento.button > 0) return;
  if (schemaCorrente.bloccato) {
    // Schema bloccato: il clic non cambia niente, solo un avviso se tocchi un giocatore
    if (giocatoreVicino(puntoNelCampo(evento))) avvisaBloccato();
    return;
  }
  const p = puntoNelCampo(evento);

  // Disegno a mano in corso: ogni clic aggiunge un punto
  if (Tracce.disegno) {
    evento.preventDefault();
    Tracce.aggiungiPunto(p, evento.shiftKey);
    return;
  }

  // Prima le maniglie della traccia selezionata (per correggerla)
  const maniglia = manigliaVicina(p);
  if (maniglia) {
    evento.preventDefault();
    svgCampo.setPointerCapture(evento.pointerId);
    chiudiMenuTracce();
    document.body.classList.add("trascinando");
    trascinamento = { tipo: "maniglia", ...maniglia, prima: istantanea(), mosso: false };
    return;
  }

  const g = giocatoreVicino(p);

  // Clic sul prato vuoto: togli la selezione e chiudi il menu
  if (!g) { chiudiMenuTracce(); selezionaGiocatore(null); return; }

  evento.preventDefault();
  svgCampo.setPointerCapture(evento.pointerId);
  const menuEraAperto = menuTracceAperto() && $("#menu-tracce").dataset.giocatore === g.id;
  selezionaGiocatore(g.id);
  const elemento = svgCampo.querySelector(`.giocatore[data-id="${g.id}"]`);
  elemento.parentNode.appendChild(elemento); // portalo sopra gli altri
  document.body.classList.add("trascinando");
  trascinamento = {
    giocatore: g,
    elemento,
    scostX: g.x - p.x,
    scostY: yDisegno(g.y) - p.y,
    prima: istantanea(), // per Annulla, salvata solo se il giocatore si muove davvero
    mosso: false,
    menuEraAperto,
  };
});

// Doppio clic: finisce il disegno a mano
svgCampo.addEventListener("dblclick", (e) => {
  if (Tracce.disegno) { e.preventDefault(); Tracce.finisciDisegno(); }
});

svgCampo.addEventListener("pointermove", (evento) => {
  if (Tracce.disegno) { Tracce.anteprima(puntoNelCampo(evento), evento.shiftKey); return; }
  if (!trascinamento) {
    // Cursore a "mano" quando passi sopra un giocatore o una maniglia
    if (schemaCorrente && !schemaCorrente.bloccato) {
      const p = puntoNelCampo(evento);
      svgCampo.classList.toggle("sopra-giocatore", !!(giocatoreVicino(p) || manigliaVicina(p)));
    }
    return;
  }
  const p = puntoNelCampo(evento);
  const g = trascinamento.giocatore;

  // Trascinamento di un punto della traccia
  if (trascinamento.tipo === "maniglia") {
    const passo = evento.shiftKey ? 0.5 : 0.1;
    const x = Math.round(p.x / passo) * passo;
    const y = Math.round((YARDE_AVANTI - p.y) / passo) * passo;
    g.traccia.punti[trascinamento.indice] = dentroCampo(g, x - g.x, y - g.y);
    trascinamento.mosso = true;
    disegnaCampo(svgCampo, schemaCorrente, { selezionato: giocatoreSelezionato });
    return;
  }

  // Nuova posizione, tenuta dentro i bordi del campo.
  // Con Maiusc premuto si aggancia alla mezza yarda (più ordine).
  // e mai oltre la linea di scrimmage (attacco dietro, difesa davanti).
  const passo = evento.shiftKey ? 0.5 : 0.1;
  let x = Math.min(LARGHEZZA_CAMPO - 0.6, Math.max(0.6, p.x + trascinamento.scostX));
  x = Math.round(x / passo) * passo;
  let y = Math.round((YARDE_AVANTI - (p.y + trascinamento.scostY)) / passo) * passo;
  y = limitaY(schemaCorrente.lato, y);
  if (+x.toFixed(1) === g.x && y === g.y) return;

  g.x = +x.toFixed(1);
  g.y = y;
  if (!trascinamento.mosso) chiudiMenuTracce();
  trascinamento.mosso = true;
  posizionaGiocatore(g); // la traccia e il pallone lo seguono
});

function fineTrascinamento() {
  if (!trascinamento) return;
  const t = trascinamento;
  trascinamento = null;
  document.body.classList.remove("trascinando");
  if (t.mosso) {
    ricordaStato(t.prima);
    salvaTraPoco();
    disegnaCampo(svgCampo, schemaCorrente, { selezionato: giocatoreSelezionato }); // rimette le maniglie
  } else if (t.tipo !== "maniglia") {
    // Semplice clic su un giocatore: apre (o chiude) il menu delle tracce
    if (t.menuEraAperto) chiudiMenuTracce();
    else apriMenuTracce(t.giocatore);
  }
}
svgCampo.addEventListener("pointerup", fineTrascinamento);
svgCampo.addEventListener("pointercancel", fineTrascinamento);

/* ==========================================================================
   5. ANNULLA / RIPETI
   Prima di ogni modifica salviamo una "foto" di formazione e giocatori.
   ========================================================================== */
let storia = { indietro: [], avanti: [] };

function istantanea() {
  return JSON.stringify({
    formazione: schemaCorrente.formazione,
    giocatori: schemaCorrente.giocatori,
    ribaltato: !!schemaCorrente.ribaltato,
  });
}

function ricordaStato(foto = istantanea()) {
  storia.indietro.push(foto);
  if (storia.indietro.length > 100) storia.indietro.shift();
  storia.avanti = [];
  aggiornaPulsantiStoria();
}

function ripristina(foto) {
  const { formazione, giocatori, ribaltato } = JSON.parse(foto);
  schemaCorrente.formazione = formazione;
  schemaCorrente.ribaltato = ribaltato;
  schemaCorrente.giocatori = giocatori;
  if (!giocatori.some((g) => g.id === giocatoreSelezionato)) giocatoreSelezionato = null;
  ridisegna();
  salvaSubito();
}

function annulla() {
  if (Tracce.disegno) { Tracce.annullaDisegno(); return; } // durante il disegno annulla il disegno
  if (!schemaCorrente || schemaBloccato() || !storia.indietro.length) return;
  storia.avanti.push(istantanea());
  ripristina(storia.indietro.pop());
  aggiornaPulsantiStoria();
}

function ripeti() {
  if (!schemaCorrente || schemaBloccato() || !storia.avanti.length) return;
  storia.indietro.push(istantanea());
  ripristina(storia.avanti.pop());
  aggiornaPulsantiStoria();
}

function aggiornaPulsantiStoria() {
  const bloccato = Boolean(schemaCorrente && schemaCorrente.bloccato);
  $("#btn-annulla").disabled = bloccato || !storia.indietro.length;
  $("#btn-ripeti").disabled = bloccato || !storia.avanti.length;
}
$("#btn-annulla").addEventListener("click", annulla);
$("#btn-ripeti").addEventListener("click", ripeti);

/* ==========================================================================
   6. SCORCIATOIE DA TASTIERA
   ========================================================================== */
$("#kbd-duplica").textContent = TASTO_CMD + "D";
$("#btn-annulla").title = `Annulla (${TASTO_CMD}Z)`;
$("#btn-ripeti").title = `Ripeti (${TASTO_CMD}${SU_MAC ? "⇧" : "Shift+"}Z)`;

document.addEventListener("keydown", (e) => {
  const staScrivendo = ["INPUT", "TEXTAREA"].includes(document.activeElement.tagName);
  const cmd = e.metaKey || e.ctrlKey;
  if (!$("#intro").hidden) return; // schermata di accesso: niente scorciatoie
  if (!$("#foglio-squadra").hidden) {
    if (e.key === "Escape") chiudiFoglioSquadra();
    return;
  }
  if (!$("#foglio-stampa").hidden) {
    if (e.key === "Escape") chiudiFoglioStampa();
    return;
  }
  // Ctrl/⌘+P: la nostra stampa del playbook al posto di quella della pagina
  if (cmd && e.key.toLowerCase() === "p") { e.preventDefault(); apriFoglioStampa(); return; }
  if (!$("#dialogo").hidden) {
    if (e.key === "Escape") chiudiDialogo();
    return;
  }

  // Annulla / Ripeti (quando non si sta scrivendo un testo)
  if (cmd && e.key.toLowerCase() === "z" && !staScrivendo) {
    e.preventDefault();
    e.shiftKey ? ripeti() : annulla();
    return;
  }
  if (cmd && e.key.toLowerCase() === "y" && !staScrivendo) { e.preventDefault(); ripeti(); return; }

  // Duplica
  if (cmd && e.key.toLowerCase() === "d" && schemaCorrente) {
    e.preventDefault();
    duplica();
    return;
  }

  if (staScrivendo || cmd || e.altKey) return;

  // Disegno a mano in corso: Invio (finisci), Esc (annulla), C (linea morbida)
  if (Tracce.disegno) {
    if (e.key === "c" || e.key === "C") { e.preventDefault(); Tracce.commutaCurvaDisegno(); }
    if (e.key === "Enter") { e.preventDefault(); Tracce.finisciDisegno(); }
    if (e.key === "Escape") { e.preventDefault(); Tracce.annullaDisegno(); }
    return;
  }

  // L = blocca / sblocca lo schema
  if ((e.key === "l" || e.key === "L") && schemaCorrente) { e.preventDefault(); commutaBlocco(); return; }

  // R = ribalta lo schema aperto
  if ((e.key === "r" || e.key === "R") && schemaCorrente) { e.preventDefault(); ribalta(); return; }

  // N = nuovo schema
  if (e.key === "n" || e.key === "N") { e.preventDefault(); nuovoSchema(); return; }

  if (!schemaCorrente) return;

  // Esc = chiudi il menu, poi togli la selezione
  if (e.key === "Escape") {
    if (menuTracceAperto()) chiudiMenuTracce();
    else selezionaGiocatore(null);
    return;
  }

  // Scorciatoie delle tracce sul giocatore selezionato
  if (schemaCorrente.bloccato) return;
  const sel = schemaCorrente.giocatori.find((g) => g.id === giocatoreSelezionato);
  if (sel) {
    const attacco = schemaCorrente.lato === "attacco";
    const numero = parseInt(e.key, 10);
    // QB: tasti 1–5 = drop e rollout
    if (numero >= 1 && numero <= 9 && eQuarterback(sel)) {
      const movimento = MOVIMENTI_QB[numero - 1];
      if (movimento) Tracce.applica(sel, tracciaDaQb(sel, movimento));
      return;
    }
    if (numero >= 1 && numero <= 9 && !senzaAlbero(sel)) {
      if (attacco) Tracce.applica(sel, tracciaDaRoute(sel, ALBERO_ROUTE[numero - 1]));
      else if (TRACCE_DIFESA[numero - 1]) Tracce.applica(sel, tracciaDaDifesa(sel, TRACCE_DIFESA[numero - 1]));
      return;
    }
    if (e.key === "t" || e.key === "T") { e.preventDefault(); Tracce.iniziaDisegno(sel); return; }
    if (e.key === "c" || e.key === "C") { e.preventDefault(); Tracce.commutaCurva(sel); return; }
    if ((e.key === "b" || e.key === "B") && attacco && !eQuarterback(sel)) {
      Tracce.applica(sel, { tipo: "blocco", nome: "Blocco", punti: [dentroCampo(sel, 0, 1.5)] });
      return;
    }
    // Canc: prima toglie la traccia, poi (se non c'è) il giocatore
    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      if (sel.traccia) Tracce.rimuovi(sel);
      else rimuoviGiocatore(sel);
      return;
    }
  }

  // Frecce = sposta il giocatore selezionato di mezza yarda (2 yarde con Maiusc)
  const direzioni = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
  const g = schemaCorrente.giocatori.find((g) => g.id === giocatoreSelezionato);
  if (g && direzioni[e.key]) {
    e.preventDefault();
    if (!e.repeat) ricordaStato();
    const passo = e.shiftKey ? 2 : 0.5;
    const [dx, dy] = direzioni[e.key];
    g.x = +Math.min(LARGHEZZA_CAMPO - 0.6, Math.max(0.6, g.x + dx * passo)).toFixed(1);
    g.y = limitaY(schemaCorrente.lato, g.y + dy * passo);
    posizionaGiocatore(g);
    salvaTraPoco();
  }
});

/* ---------- Duplica / Elimina ---------- */
function duplica() {
  salvaSubito();
  const copia = Dati.duplica(schemaCorrente.id);
  if (copia) {
    apriEditor(copia.id);
    mostraAvviso("Schema duplicato");
  }
}
$("#btn-duplica").addEventListener("click", duplica);

$("#btn-elimina").addEventListener("click", () => {
  const nome = schemaCorrente.nome || "Senza nome";
  chiediConferma(`Eliminare "${nome}"?`, "Potrai annullare subito dopo.", "Elimina", () => {
    const eliminato = Dati.elimina(schemaCorrente.id);
    schemaCorrente = null;
    chiudiEditor();
    mostraAvviso("Schema eliminato", () => {
      Dati.salva(eliminato);
      apriEditor(eliminato.id);
    });
  });
});

/* ==========================================================================
   7. FINESTRA DI CONFERMA E AVVISI
   ========================================================================== */
let azioneConferma = null;

function chiediConferma(titolo, testo, etichettaBottone, azione) {
  $("#dialogo-titolo").textContent = titolo;
  $("#dialogo-testo").textContent = testo;
  $("#dialogo-ok").textContent = etichettaBottone;
  azioneConferma = azione;
  $("#velo").hidden = false;
  $("#dialogo").hidden = false;
  // Un frame dopo aggiungiamo la classe, così parte l'animazione
  requestAnimationFrame(() => {
    $("#velo").classList.add("visibile");
    $("#dialogo").classList.add("visibile");
    $("#dialogo-annulla").focus();
  });
}

function chiudiDialogo() {
  $("#velo").classList.remove("visibile");
  $("#dialogo").classList.remove("visibile");
  setTimeout(() => {
    $("#velo").hidden = true;
    $("#dialogo").hidden = true;
  }, 200);
}

$("#dialogo-ok").addEventListener("click", () => {
  chiudiDialogo();
  if (azioneConferma) azioneConferma();
  azioneConferma = null;
});
$("#dialogo-annulla").addEventListener("click", chiudiDialogo);
$("#velo").addEventListener("click", () => {
  if (!$("#foglio-squadra").hidden) chiudiFoglioSquadra();
  else if (!$("#foglio-stampa").hidden) chiudiFoglioStampa();
  else chiudiDialogo();
});

// Avviso in basso, con pulsante "Annulla" opzionale
let timerAvviso = null;
function mostraAvviso(messaggio, azioneAnnulla = null) {
  const toast = $("#toast");
  toast.innerHTML = "";
  const testo = document.createElement("span");
  testo.textContent = messaggio;
  toast.appendChild(testo);
  if (azioneAnnulla) {
    const btn = document.createElement("button");
    btn.textContent = "Annulla";
    btn.addEventListener("click", () => {
      azioneAnnulla();
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

// Salva anche se la finestra viene chiusa o la scheda nascosta
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") salvaSubito();
});
window.addEventListener("beforeunload", salvaSubito);

/* ==========================================================================
   8. LO STEMMA DELLA SQUADRA "VIVE" CON L'APP
   Ogni volta che salvi, lo stemma in alto a sinistra fa un piccolo
   saluto; mentre i dati vanno online gli gira attorno un anello.
   ========================================================================== */
function festeggiaStemma() {
  const stemma = $("#stemma");
  stemma.classList.remove("saluta");
  void stemma.offsetWidth;
  stemma.classList.add("saluta");
}

document.addEventListener("playbook:sync", (e) => {
  const { stato } = e.detail;
  const indicatore = $("#stato-sync");
  $("#stemma").classList.toggle("sincronizza", stato === "inizio");
  indicatore.className = "stato-sync " + stato;
  indicatore.title = {
    inizio: "Sincronizzazione in corso…",
    fine: Cloud.attivo ? "Tutto salvato online" : "Salvato su questo computer",
    errore: "Offline: salvato sul computer, riprovo appena torna la connessione",
  }[stato];
  if (schemaCorrente && Cloud.attivo) {
    if (stato === "fine") $("#stato-salvataggio").textContent = "Sincronizzato";
    if (stato === "errore") $("#stato-salvataggio").textContent = "Salvato sul computer (offline)";
  }
});

/* ---------- Avvio: lo chiama accesso.js dopo il login ---------- */
function avviaApp() {
  mostraElenco();
  const ultimo = Dati.tutti()[0];
  if (ultimo) apriEditor(ultimo.id);
}
