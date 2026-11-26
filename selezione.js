/* ==========================================================================
   SELEZIONE MULTIPLA (computer)
   --------------------------------------------------------------------------
   - Maiusc + clic su un giocatore: lo aggiunge o lo toglie dalla selezione
   - trascinando sul prato vuoto: riquadro che seleziona chi ci sta dentro
   - Ctrl/⌘ + A: seleziona tutti
   - trascinando uno dei selezionati si sposta tutto il gruppo
     (nessuno supera la linea di scrimmage: il gruppo si ferma prima)
   - frecce: spostano il gruppo; Canc: lo toglie dal campo; Esc: deseleziona
   - nel pannello: allinea alla stessa profondità, togli tracce, togli dal campo
   Con un solo giocatore selezionato l'app funziona come prima (menu tracce).
   ========================================================================== */

const Selezione = {
  ids: new Set(),

  attiva() { return this.ids.size >= 2; },

  giocatori() {
    return schemaCorrente ? schemaCorrente.giocatori.filter((g) => this.ids.has(g.id)) : [];
  },

  // Imposta la selezione: con 2 o più giocatori si passa alla selezione multipla
  imposta(ids) {
    this.ids = new Set(ids);
    chiudiMenuTracce();
    if (this.ids.size >= 2) {
      giocatoreSelezionato = null;
      disegnaCampo(svgCampo, schemaCorrente, {});
      mostraInfoGiocatore();
    } else {
      const unico = [...this.ids][0] || null;
      this.ids.clear();
      selezionaGiocatore(unico);
    }
  },

  svuota() {
    if (!this.ids.size) return;
    this.ids.clear();
    if (schemaCorrente) { disegnaCampo(svgCampo, schemaCorrente, { selezionato: giocatoreSelezionato }); mostraInfoGiocatore(); }
  },

  // Maiusc + clic: aggiunge o toglie (partendo dal giocatore già selezionato)
  commuta(g) {
    const ids = new Set(this.ids.size ? this.ids : giocatoreSelezionato ? [giocatoreSelezionato] : []);
    ids.has(g.id) ? ids.delete(g.id) : ids.add(g.id);
    this.imposta([...ids]);
  },
};

/* Ogni volta che il campo dell'editor si ridisegna, i selezionati
   riprendono l'anello (disegnaCampo ne disegna uno solo). */
const disegnaCampoBase = disegnaCampo;
disegnaCampo = function (svg, schema, opzioni) {
  disegnaCampoBase(svg, schema, opzioni);
  if (svg === svgCampo && Selezione.attiva()) {
    for (const id of Selezione.ids) {
      const el = svg.querySelector(`.giocatore[data-id="${id}"]`);
      if (el) el.classList.add("selezionato", "multi");
    }
  }
};

/* ---------- Trascinamento del gruppo ---------- */
function iniziaTrascinamentoGruppo(p) {
  const origini = new Map(Selezione.giocatori().map((g) => [g.id, { x: g.x, y: g.y }]));
  return { tipo: "gruppo", da: p, origini, prima: istantanea(), mosso: false };
}

function muoviGruppo(t, p, agganciaMezza) {
  const passo = agganciaMezza ? 0.5 : 0.1;
  let dx = Math.round((p.x - t.da.x) / passo) * passo;
  let dy = Math.round((t.da.y - p.y) / passo) * passo; // in yarde: in su = avanti
  // Limiti: nessuno esce dal campo né supera la linea di scrimmage
  const { min, max } = limitiY(schemaCorrente.lato);
  let dxMin = -Infinity, dxMax = Infinity, dyMin = -Infinity, dyMax = Infinity;
  for (const o of t.origini.values()) {
    dxMin = Math.max(dxMin, 0.6 - o.x); dxMax = Math.min(dxMax, LARGHEZZA_CAMPO - 0.6 - o.x);
    dyMin = Math.max(dyMin, min - o.y); dyMax = Math.min(dyMax, max - o.y);
  }
  const fuoriLinea = dy > dyMax + 0.01 || dy < dyMin - 0.01;
  dx = Math.min(dxMax, Math.max(dxMin, dx));
  dy = Math.min(dyMax, Math.max(dyMin, dy));
  if (fuoriLinea) segnalaLinea(); // la linea si illumina come per un giocatore solo
  for (const g of Selezione.giocatori()) {
    const o = t.origini.get(g.id);
    g.x = +(o.x + dx).toFixed(1);
    g.y = +(o.y + dy).toFixed(1);
  }
  t.mosso = t.mosso || Math.abs(dx) > 0 || Math.abs(dy) > 0;
  disegnaCampo(svgCampo, schemaCorrente, {});
}

/* ---------- Riquadro di selezione sul prato ---------- */
function iniziaRiquadro(p) {
  return { tipo: "riquadro", da: p, a: p, mosso: false };
}

function muoviRiquadro(t, p) {
  t.a = p;
  t.mosso = t.mosso || Math.hypot(p.x - t.da.x, p.y - t.da.y) > 0.6;
  let r = svgCampo.querySelector(".riquadro-selezione");
  if (!r) r = crea("rect", { class: "riquadro-selezione", rx: 0.3 }, svgCampo);
  r.setAttribute("x", Math.min(t.da.x, p.x));
  r.setAttribute("y", Math.min(t.da.y, p.y));
  r.setAttribute("width", Math.abs(p.x - t.da.x));
  r.setAttribute("height", Math.abs(p.y - t.da.y));
  // Mentre trascini, si accendono i giocatori che stanno dentro
  const dentro = new Set(giocatoriNelRiquadro(t).map((g) => g.id));
  svgCampo.querySelectorAll(".giocatore").forEach((el) => el.classList.toggle("nel-riquadro", dentro.has(el.dataset.id)));
}

function giocatoriNelRiquadro(t) {
  const x0 = Math.min(t.da.x, t.a.x), x1 = Math.max(t.da.x, t.a.x);
  const y0 = Math.min(t.da.y, t.a.y), y1 = Math.max(t.da.y, t.a.y);
  return schemaCorrente.giocatori.filter((g) => g.x >= x0 && g.x <= x1 && yDisegno(g.y) >= y0 && yDisegno(g.y) <= y1);
}

function fineRiquadro(t) {
  const r = svgCampo.querySelector(".riquadro-selezione");
  if (r) r.remove();
  if (!t.mosso) { Selezione.svuota(); selezionaGiocatore(null); return; } // semplice clic sul prato
  const scelti = giocatoriNelRiquadro(t).map((g) => g.id);
  if (!scelti.length) { Selezione.svuota(); selezionaGiocatore(null); return; }
  Selezione.imposta(scelti);
}

/* ---------- Azioni sul gruppo ---------- */
function allineaProfondita() {
  const gruppo = Selezione.giocatori();
  if (gruppo.length < 2) return;
  ricordaStato();
  // La profondità di riferimento: quella più vicina alla linea (come una linea d'attacco)
  const rif = versoSchema(schemaCorrente) === "attacco"
    ? Math.max(...gruppo.map((g) => g.y))
    : Math.min(...gruppo.map((g) => g.y));
  for (const g of gruppo) g.y = limitaY(schemaCorrente.lato, rif, { avvisa: false });
  ridisegna();
  salvaTraPoco();
  mostraAvviso(`${gruppo.length} giocatori alla stessa profondità`, annulla);
}

function togliTracceGruppo() {
  const gruppo = Selezione.giocatori().filter((g) => g.traccia);
  if (!gruppo.length) { mostraAvviso("Nessuna traccia da togliere"); return; }
  ricordaStato();
  for (const g of gruppo) delete g.traccia;
  ridisegna();
  salvaTraPoco();
  mostraAvviso(`Tolte ${gruppo.length} tracce`, annulla);
}

function togliGruppo() {
  const gruppo = Selezione.giocatori();
  if (!gruppo.length) return;
  ricordaStato();
  const via = new Set(gruppo.map((g) => g.id));
  schemaCorrente.giocatori = schemaCorrente.giocatori.filter((g) => !via.has(g.id));
  Selezione.ids.clear();
  giocatoreSelezionato = null;
  ridisegna();
  salvaTraPoco();
  mostraAvviso(`${gruppo.length} giocatori tolti dal campo`, annulla);
}

function spostaGruppoConFrecce(dx, dy, ripetuto) {
  const t = iniziaTrascinamentoGruppo({ x: 0, y: 0 });
  if (!ripetuto) ricordaStato(t.prima);
  muoviGruppo(t, { x: dx, y: -dy }, false);
  salvaTraPoco();
}

// Pannello a destra quando sono selezionati più giocatori
function mostraPannelloSelezione() {
  const box = $("#info-giocatore");
  const gruppo = Selezione.giocatori();
  box.innerHTML = `
    <p class="selezione-titolo"><strong>${gruppo.length} giocatori selezionati</strong>
      <span>${gruppo.map((g) => g.etichetta).join(" · ")}</span></p>
    <p class="testo-secondario selezione-aiuto">Trascinane uno per spostarli insieme, oppure usa le frecce.</p>
    <div class="azioni-selezione">
      <button type="button" class="btn-mini" id="sel-allinea">Stessa profondità</button>
      <button type="button" class="btn-mini" id="sel-tracce">Togli le tracce</button>
      <button type="button" class="btn-mini distruttiva" id="sel-togli">Togli dal campo</button>
      <button type="button" class="btn-mini" id="sel-nessuno">Deseleziona (Esc)</button>
    </div>`;
  $("#sel-allinea").addEventListener("click", allineaProfondita);
  $("#sel-tracce").addEventListener("click", togliTracceGruppo);
  $("#sel-togli").addEventListener("click", togliGruppo);
  $("#sel-nessuno").addEventListener("click", () => Selezione.svuota());
}

/* Tasti della selezione multipla. Restituisce true se il tasto è stato usato. */
function tastiSelezione(e, cmd, staScrivendo) {
  if (staScrivendo || !schemaCorrente || schemaCorrente.bloccato) return false;
  if (cmd && e.key.toLowerCase() === "a") {
    e.preventDefault();
    if (schemaCorrente.giocatori.length >= 2) Selezione.imposta(schemaCorrente.giocatori.map((g) => g.id));
    return true;
  }
  if (!Selezione.attiva()) return false;
  if (e.key === "Escape") { Selezione.svuota(); return true; }
  if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); togliGruppo(); return true; }
  const direzioni = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
  if (direzioni[e.key] && !e.altKey) {
    e.preventDefault();
    const passo = e.shiftKey ? 2 : 0.5;
    spostaGruppoConFrecce(direzioni[e.key][0] * passo, direzioni[e.key][1] * passo, e.repeat);
    return true;
  }
  return false;
}
