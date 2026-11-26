/* ==========================================================================
   AVVERSARI IN TRASPARENZA
   --------------------------------------------------------------------------
   Su uno schema d'attacco si può mettere la difesa avversaria (e su uno
   schema di difesa l'attacco avversario), tutta o solo qualche pedina.
   È un'opzione dell'allenatore: se non la metti, non c'è niente.
   Le pedine si vedono tenui, si trascinano come le tue e restano sempre
   dalla loro parte della linea di scrimmage.
     schema.avversari = [ { id, etichetta, x, y, forma } ]
     schema.avversariNascosti = true  → ci sono ma non si vedono
   Questo file le DISEGNA (computer, telefono, stampa); per metterle e
   spostarle sul computer c'è avversari-ui.js.
   ========================================================================== */

// Special teams contro special teams: l'avversario sta dall'altra parte della linea
const latoAvversario = (schema) => (schema.lato === "speciali" ? "speciali" : schema.lato === "attacco" ? "difesa" : "attacco");
// Da che parte della linea stanno gli avversari ("attacco" = sotto, "difesa" = sopra)
const versoAvversario = (schema) => (versoSchema(schema) === "attacco" ? "difesa" : "attacco");

// Le pedine avversarie visibili (nessuna se nascoste)
function avversariVisibili(schema) {
  return schema.avversariNascosti ? [] : schema.avversari || [];
}

/* Disegna le pedine avversarie: sotto i tuoi giocatori, sopra il prato.
   "selezionato" = id della pedina avversaria scelta (anello). */
function disegnaAvversari(svg, schema, { selezionato = null } = {}) {
  const lista = avversariVisibili(schema);
  if (!lista.length) return;
  const lato = latoAvversario(schema);
  const gruppo = crea("g", { class: "avversari lato-" + lato }, svg);
  for (const g of lista) {
    const el = crea("g", {
      class: `giocatore avversario forma-${g.forma} ruolo-${ruoloDi(lato, g.etichetta)}${g.id === selezionato ? " selezionato" : ""}`,
      "data-avversario": g.id,
      transform: `translate(${g.x} ${yDisegno(g.y)})`,
    }, gruppo);
    crea("circle", { r: RAGGIO_GIOCATORE * 1.55, class: "alone" }, el);
    if (g.forma === "quadrato") {
      const l = RAGGIO_GIOCATORE * 1.8;
      crea("rect", { x: -l / 2, y: -l / 2, width: l, height: l, rx: 0.15, class: "sagoma" }, el);
    } else if (g.forma === "cerchio") {
      crea("circle", { r: RAGGIO_GIOCATORE, class: "sagoma" }, el);
    }
    const t = crea("text", {
      class: "etichetta" + (g.etichetta.length > 1 ? " lunga" : ""),
      "text-anchor": "middle", "dominant-baseline": "central",
    }, el);
    t.textContent = g.etichetta;
  }
}

// Ribalta destra/sinistra anche gli avversari (usato da «Ribalta»)
function ribaltaAvversari(schema) {
  for (const g of schema.avversari || []) g.x = +(LARGHEZZA_CAMPO - g.x).toFixed(2);
}

// Forma della pedina per il lato avversario (come per i propri giocatori)
function formaAvversario(lato, sigla) {
  return formaPedina(lato, sigla);
}
