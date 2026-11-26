/* ==========================================================================
   NOTE SUL CAMPO: testi, frecce libere e zone colorate
   --------------------------------------------------------------------------
   Fanno parte dello schema (schema.annotazioni), quindi si salvano, si
   sincronizzano e compaiono sul computer, sul telefono, in stampa e nel
   link condiviso. Coordinate in yarde come i giocatori.
     { id, tipo: "testo",   x, y, testo, colore }
     { id, tipo: "freccia", x1, y1, x2, y2, colore }
     { id, tipo: "zona",    x1, y1, x2, y2, colore }   (rettangolo)
   Questo file le DISEGNA (computer e telefono); per crearle e
   modificarle sul computer c'è note-campo.js.
   ========================================================================== */

const COLORI_NOTE = {
  giallo: "#FFD60A",
  rosso: "#FF5A4E",
  blu: "#4FB3FF",
  verde: "#34D17B",
  bianco: "#FFFFFF",
};

// Le note scelte nell'editor del computer (un insieme di id, vuoto se nessuna)
function noteSelezionate() {
  return typeof NoteCampo !== "undefined" && NoteCampo.attivo ? NoteCampo.sel : new Set();
}

function attributiNota(a, classe) {
  return {
    class: `annotazione ${classe} colore-${a.colore || "giallo"}${noteSelezionate().has(a.id) ? " selezionata" : ""}`,
    "data-id": a.id,
    style: `--colore-nota: ${COLORI_NOTE[a.colore] || COLORI_NOTE.giallo}`,
  };
}

/* Zone: sotto tracce e giocatori */
function disegnaZoneNote(svg, schema) {
  for (const a of schema.annotazioni || []) {
    if (a.tipo !== "zona") continue;
    const x = Math.min(a.x1, a.x2), w = Math.abs(a.x2 - a.x1);
    const yAlto = Math.max(a.y1, a.y2), h = Math.abs(a.y2 - a.y1);
    crea("rect", { ...attributiNota(a, "nota-zona"), x, y: yDisegno(yAlto), width: w, height: h, rx: 0.8 }, svg);
  }
}

/* Frecce libere: sopra le tracce, sotto i giocatori */
function disegnaFrecceNote(svg, schema) {
  for (const a of schema.annotazioni || []) {
    if (a.tipo !== "freccia") continue;
    const g = crea("g", attributiNota(a, "nota-freccia"), svg);
    const x1 = a.x1, y1 = yDisegno(a.y1), x2 = a.x2, y2 = yDisegno(a.y2);
    const ang = Math.atan2(y2 - y1, x2 - x1);
    const lung = Math.hypot(x2 - x1, y2 - y1);
    const accorcia = Math.min(0.8, lung / 2);
    // Area più larga e invisibile per prenderla col mouse
    crea("line", { x1, y1, x2, y2, class: "presa-nota" }, g);
    crea("line", { x1, y1, x2: x2 - Math.cos(ang) * accorcia, y2: y2 - Math.sin(ang) * accorcia, class: "linea-nota" }, g);
    crea("path", {
      d: "M0 0 L-1.1 -0.6 L-1.1 0.6 Z",
      class: "punta-nota",
      transform: `translate(${x2.toFixed(2)} ${y2.toFixed(2)}) rotate(${(ang * 180) / Math.PI})`,
    }, g);
  }
}

/* Testi: sopra tutto. In miniatura non si leggerebbero: niente testi. */
function disegnaTestiNote(svg, schema, { miniatura = false } = {}) {
  if (miniatura) return;
  for (const a of schema.annotazioni || []) {
    if (a.tipo !== "testo" || !a.testo) continue;
    const t = crea("text", {
      ...attributiNota(a, "nota-testo"),
      x: a.x, y: yDisegno(a.y),
      "text-anchor": "middle", "dominant-baseline": "central",
    }, svg);
    t.textContent = a.testo;
  }
}

// Ribalta destra/sinistra anche le note (usato da «Ribalta»)
function ribaltaNote(schema) {
  for (const a of schema.annotazioni || []) {
    if (a.tipo === "testo") a.x = +(LARGHEZZA_CAMPO - a.x).toFixed(2);
    else { a.x1 = +(LARGHEZZA_CAMPO - a.x1).toFixed(2); a.x2 = +(LARGHEZZA_CAMPO - a.x2).toFixed(2); }
  }
}
