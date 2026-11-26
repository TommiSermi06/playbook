/* ==========================================================================
   CAMPO (versione telefono)
   --------------------------------------------------------------------------
   Disegna il campo, i giocatori e le tracce in SVG, uguale all'app per
   computer ma solo "da guardare": niente trascinamenti né maniglie.
   Le tracce le disegna ../tracce.js (lo stesso file del computer).
   ========================================================================== */

/* ---------- Misure del campo (in yarde): le stesse del computer ---------- */
const LARGHEZZA_CAMPO = 53.33;
const YARDE_DIETRO = 12;
let YARDE_AVANTI = 23;   // 50 per Kickoff, Kick return e Punt return (../speciali.js)
let ALTEZZA_CAMPO = YARDE_DIETRO + YARDE_AVANTI;
const HASH_SINISTRO = 20;
const HASH_DESTRO = LARGHEZZA_CAMPO - 20;
const RAGGIO_GIOCATORE = 0.95;
const SVG_NS = "http://www.w3.org/2000/svg";
const TASTO_CMD = "Ctrl+"; // (lo usa ../tracce.js per i suggerimenti del computer)

// Nel disegno lo 0 è in alto: la difesa sta sopra, l'attacco sotto
function yDisegno(yYarde) {
  return YARDE_AVANTI - yYarde;
}

// Crea un elemento SVG con i suoi attributi
function crea(tag, attributi = {}, genitore = null) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [nome, valore] of Object.entries(attributi)) el.setAttribute(nome, valore);
  if (genitore) genitore.appendChild(el);
  return el;
}

const $ = (sel) => document.querySelector(sel);

/* ---------- Ruoli e colori (come sul computer) ---------- */
const RUOLI = {
  attacco: {
    linea: ["C", "G", "T", "LG", "RG", "LT", "RT", "OL"],
    qb: ["QB", "Q"],
    back: ["RB", "FB", "TB", "HB", "B", "F"],
    ricevitori: ["X", "Y", "Z", "H", "W", "TE", "WR", "SL", "A"],
  },
  difesa: {
    dl: ["E", "T", "N", "DE", "DT", "NT", "DL", "R"],
    lb: ["W", "M", "S", "B", "J", "LB", "OLB", "ILB", "MLB", "SAM", "MIK", "WIL"],
    db: ["C", "CB", "FS", "SS", "NB", "$", "DB", "F"],
  },
};

function ruoloDi(lato, etichetta) {
  for (const [ruolo, sigle] of Object.entries(RUOLI[lato])) {
    if (sigle.includes(etichetta)) return ruolo;
  }
  return { attacco: "ricevitori", difesa: "lb" }[lato] || "st-copertura";
}

// Dove sta la palla: davanti al centro in attacco, al centro in difesa
function posizionePalla(schema) {
  if (schema.lato === "difesa") return { x: LARGHEZZA_CAMPO / 2, y: 0 };
  if (schema.lato === "speciali") { // davanti allo snapper (punt, field goal), altrimenti al centro della linea
    const s = versoSchema(schema) === "attacco" && schema.giocatori.find((g) => g.etichetta === "LS" || g.etichetta === "C");
    return s ? { x: s.x, y: s.y + 1 } : { x: LARGHEZZA_CAMPO / 2, y: 0 };
  }
  const c = schema.giocatori.find((g) => g.etichetta === "C");
  return c ? { x: c.x, y: c.y + 1 } : null;
}

/* Disegna lo schema dentro "svg".
   - miniatura: campo semplificato per l'elenco
   - anima: le tracce "corrono" una dopo l'altra (pulsante ▶︎);
     con l'id di un giocatore si anima solo la sua
   - selezionato: id del giocatore selezionato nell'editor (anello attorno)
   - ritaglio: mostra solo la zona dove ci sono giocatori e tracce */
function disegnaCampo(svg, schema, opzioni = {}) {
  impostaCampo(schema); // campo normale o lungo (special teams, ../speciali.js)
  try { disegnaCampoDentro(svg, schema, opzioni); }
  finally { impostaCampo(schemaAperto() || schema); } // poi le misure tornano quelle dello schema in modifica
}

function disegnaCampoDentro(svg, schema, { miniatura = false, anima = false, ritaglio = false, logo = null, selezionato = null, viewBox = null } = {}) {
  svg.innerHTML = "";
  svg.setAttribute("viewBox", `0 0 ${LARGHEZZA_CAMPO} ${ALTEZZA_CAMPO}`);

  // Prato con le strisce ogni 5 yarde
  crea("rect", { x: 0, y: 0, width: LARGHEZZA_CAMPO, height: ALTEZZA_CAMPO, class: "prato" }, svg);
  for (let y = -10; y < YARDE_AVANTI; y += 10) {
    crea("rect", { x: 0, y: yDisegno(y + 5), width: LARGHEZZA_CAMPO, height: 5, class: "striscia" }, svg);
  }

  // Logo della squadra tenue al centro (come a metà campo negli stadi)
  if (!miniatura && logo) {
    const lato = 16;
    crea("image", {
      // Copia del logo adattata al campo scuro (../filigrana.js): si vedono anche i colori scuri
      href: typeof Filigrana !== "undefined" ? Filigrana.versione(logo, true, () => { if (typeof aggiornaDopoLogo === "function") aggiornaDopoLogo(); }) : logo,
      x: (LARGHEZZA_CAMPO - lato) / 2, y: (ALTEZZA_CAMPO - lato) / 2 - 3,
      width: lato, height: lato, preserveAspectRatio: "xMidYMid meet", class: "filigrana",
    }, svg);
  }

  const linee = crea("g", { class: "linee" }, svg);
  for (let y = -10; y < YARDE_AVANTI; y += 5) {
    if (y === 0) continue;
    crea("line", {
      x1: 0, x2: LARGHEZZA_CAMPO, y1: yDisegno(y), y2: yDisegno(y),
      class: y % 10 === 0 ? "linea-yarde forte" : "linea-yarde",
    }, linee);
  }
  if (!miniatura) {
    // Tacche delle yarde sugli hash e a bordo campo
    for (let y = -YARDE_DIETRO + 1; y < YARDE_AVANTI; y++) {
      if (y % 5 === 0) continue;
      const yy = yDisegno(y);
      for (const x of [HASH_SINISTRO, HASH_DESTRO]) {
        crea("line", { x1: x - 0.6, x2: x + 0.6, y1: yy, y2: yy, class: "tacca" }, linee);
      }
    }
    // Distanza dalla linea (+5, +10, −5…)
    for (let y = -10; y < YARDE_AVANTI; y += 5) {
      if (y === 0) continue;
      const testo = (y > 0 ? "+" : "−") + Math.abs(y);
      for (const [x, ancora] of [[2.4, "start"], [LARGHEZZA_CAMPO - 2.4, "end"]]) {
        const t = crea("text", { x, y: yDisegno(y) - 0.45, "text-anchor": ancora, class: "numero-yarde" }, linee);
        t.textContent = testo;
      }
    }
  }
  if (schema.lato !== "speciali") crea("line", { x1: 0, x2: LARGHEZZA_CAMPO, y1: yDisegno(10), y2: yDisegno(10), class: "linea-primo-down" }, linee);
  crea("line", { x1: 0, x2: LARGHEZZA_CAMPO, y1: yDisegno(0), y2: yDisegno(0), class: "linea-scrimmage" }, linee);

  // Note sul campo (../annotazioni.js): zone sotto tutto
  if (typeof disegnaZoneNote === "function") disegnaZoneNote(svg, schema);

  // Pallone
  const palla = posizionePalla(schema);
  if (palla) {
    const gp = crea("g", { class: "palla", transform: `translate(${palla.x} ${yDisegno(palla.y)})` }, svg);
    crea("ellipse", { cx: 0, cy: 0, rx: 0.32, ry: 0.5, class: "pallone" }, gp);
  }

  // Avversari in trasparenza (../avversari.js)
  if (typeof disegnaAvversari === "function") disegnaAvversari(svg, schema);

  // Tracce (sotto i giocatori). Con "anima" partono una dopo l'altra.
  const livello = crea("g", { class: "tracce" + (anima ? " in-animazione" : "") }, svg);
  let ordine = 0;
  for (const g of schema.giocatori) {
    const gt = crea("g", {
      class: `tracce-giocatore ruolo-${ruoloDi(schema.lato, g.etichetta)}`,
      transform: `translate(${g.x} ${yDisegno(g.y)})`,
    }, livello);
    if (g.traccia) {
      const animaQui = anima === true || anima === g.id;
      if (anima === true) gt.style.setProperty("--ritardo", `${(ordine++) * 0.12}s`);
      disegnaTraccia(gt, g, { anima: animaQui, idMaschera: `m-${g.id}-${Math.random().toString(36).slice(2, 7)}`, scala: miniatura ? 1.2 : 1 });
    }
  }

  // Frecce libere sopra le tracce
  if (typeof disegnaFrecceNote === "function") disegnaFrecceNote(svg, schema);

  // Giocatori
  const gruppo = crea("g", { class: "giocatori lato-" + schema.lato }, svg);
  for (const g of schema.giocatori) {
    const el = crea("g", {
      class: `giocatore forma-${g.forma} ruolo-${ruoloDi(schema.lato, g.etichetta)}${g.id === selezionato ? " selezionato" : ""}`,
      "data-id": g.id,
      transform: `translate(${g.x} ${yDisegno(g.y)})`,
    }, gruppo);
    if (g.id === selezionato) crea("circle", { r: RAGGIO_GIOCATORE * 1.6, class: "alone" }, el);
    if (g.forma === "quadrato") {
      const l = RAGGIO_GIOCATORE * 1.8;
      crea("rect", { x: -l / 2, y: -l / 2, width: l, height: l, rx: 0.15, class: "sagoma" }, el);
    } else if (g.forma === "cerchio") {
      crea("circle", { r: RAGGIO_GIOCATORE, class: "sagoma" }, el);
    }
    scriviPedina(el, g, { miniatura }); // ruolo o #numero dentro, nome sotto (../pedine.js)
  }

  // Testi sopra tutto
  if (typeof disegnaTestiNote === "function") disegnaTestiNote(svg, schema, { miniatura });

  if (viewBox) svg.setAttribute("viewBox", viewBox);          // inquadratura tenuta ferma (editor)
  else if (ritaglio) ritagliaCampo(svg, schema, typeof ritaglio === "number" ? ritaglio : 2.5);
}

/* Inquadra solo la zona utile (giocatori + tracce), mantenendo la forma
   del campo: sul telefono gli schemi si vedono più grandi. */
function ritagliaCampo(svg, schema, margine = 2.5) {
  const xs = [], ys = [];
  for (const g of schema.giocatori || []) {
    xs.push(g.x); ys.push(g.y);
    const t = g.traccia;
    if (!t) continue;
    for (const p of [...(t.punti || []), ...(t.rami || []).flatMap((r) => r.punti || [])]) {
      xs.push(g.x + p.dx); ys.push(g.y + p.dy);
    }
  }
  if (!xs.length) return;
  const rapporto = LARGHEZZA_CAMPO / (YARDE_DIETRO + YARDE_AVANTI_NORMALE); // la forma del riquadro (anche col campo lungo)
  let x0 = Math.min(...xs) - margine, x1 = Math.max(...xs) + margine;
  let y0 = Math.min(...ys) - margine, y1 = Math.max(...ys) + margine;
  let w = x1 - x0, h = y1 - y0;
  if (w / h < rapporto) { const nw = h * rapporto; x0 -= (nw - w) / 2; w = nw; }
  else { const nh = w / rapporto; y0 -= (nh - h) / 2; h = nh; }
  if (w > LARGHEZZA_CAMPO) {
    // Campo lungo (special teams): tutto non ci sta nel riquadro, quindi
    // si inquadrano i giocatori e un po' di quello che hanno davanti
    w = LARGHEZZA_CAMPO; h = w / rapporto;
    const py = (schema.giocatori || []).map((g) => g.y);
    const centro = py.length ? (Math.min(...py) + Math.max(...py)) / 2 : (y0 + y1) / 2;
    y0 = centro - h / 2;
  }
  w = Math.min(w, LARGHEZZA_CAMPO); h = Math.min(h, ALTEZZA_CAMPO);
  x0 = Math.max(0, Math.min(x0, LARGHEZZA_CAMPO - w));
  const alto = Math.min(YARDE_AVANTI, Math.max(y0 + h, -YARDE_DIETRO + h));
  svg.setAttribute("viewBox", `${x0.toFixed(2)} ${yDisegno(alto).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`);
}
