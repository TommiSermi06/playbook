/* ==========================================================================
   ANIMAZIONE DEGLI SCHEMI (computer e telefono)
   --------------------------------------------------------------------------
   Premi ▶︎ e lo schema "si gioca": i giocatori si muovono sul campo lungo
   le loro tracce.
   1. Pausa breve, poi parte chi ha una motion
   2. Snap mentre la motion è ancora in corso: il pallone va dal centro al QB
   3. Tutti partono, ognuno alla velocità del suo compito; chi era in
      motion prosegue senza fermarsi nella sua traccia
      (un ricevitore corre più veloce di un uomo di linea che blocca)
   4. Alla fine resta fermo un attimo e poi torna come prima
   Le tracce restano disegnate, più tenui, così si vede dove vanno.
   ========================================================================== */

// Velocità in yarde al secondo per tipo di traccia (pensate per "leggersi" bene, non realistiche)
const VELOCITA_TRACCIA = { route: 6.5, opzione: 6.5, motion: 5, blocco: 2, qb: 3.2, blitz: 6.5, zona: 4.2, uomo: 6 };
const PAUSA_INIZIALE = 0.6;   // secondi prima che si muova qualcuno
const TEMPO_SNAP = 0.35;      // il volo del pallone dal centro al QB
const PAUSA_FINALE = 0.9;
const MOTION_PRIMA_DELLO_SNAP = 1.4; // come in partita: si snappa mentre chi è in motion sta ancora correndo

/* Percorso di un giocatore in coordinate del disegno, diviso in
   "prima dello snap" (motion) e "dopo lo snap" (la traccia vera). */
function percorsiGiocatore(g) {
  const t = g.traccia;
  const inizio = { x: g.x, y: yDisegno(g.y) };
  if (!t || !t.punti || !t.punti.length) return { inizio, prima: [], dopo: [], vel: 0 };
  let punti = puntiDisegno(t).map((p) => ({ x: inizio.x + p.x, y: inizio.y + p.y }));
  let prima = [];
  if (t.tipo === "motion") {
    prima = t.curva ? curvaMorbida(punti) : punti;
    punti = [];
  } else {
    const nMotion = t.motion ? Math.min(t.motion, punti.length - 2) : 0;
    if (nMotion > 0) {
      prima = punti.slice(0, nMotion + 1);
      punti = punti.slice(nMotion);
    }
    if (t.curva) punti = curvaMorbida(punti);
  }
  return { inizio, prima, dopo: punti, vel: VELOCITA_TRACCIA[t.tipo] || 6 };
}

// Lunghezze progressive di una spezzata, per trovare il punto a una certa distanza
function misura(punti) {
  const lunghezze = [0];
  for (let i = 1; i < punti.length; i++) {
    lunghezze.push(lunghezze[i - 1] + Math.hypot(punti[i].x - punti[i - 1].x, punti[i].y - punti[i - 1].y));
  }
  return { punti, lunghezze, totale: lunghezze[lunghezze.length - 1] || 0 };
}
function puntoA(m, distanza) {
  const { punti, lunghezze } = m;
  if (distanza <= 0 || punti.length < 2) return punti[0];
  if (distanza >= m.totale) return punti[punti.length - 1];
  let i = 1;
  while (lunghezze[i] < distanza) i++;
  const f = (distanza - lunghezze[i - 1]) / (lunghezze[i] - lunghezze[i - 1] || 1);
  return { x: punti[i - 1].x + (punti[i].x - punti[i - 1].x) * f, y: punti[i - 1].y + (punti[i].y - punti[i - 1].y) * f };
}

const Animazione = {
  attiva: null, // { svg, quadro } mentre lo schema "si gioca"

  /* Fa giocare lo schema dentro "svg" (già disegnato con disegnaCampo).
     velocita: 1 normale, 0.5 al rallentatore. fine: chiamata alla fine. */
  avvia(svg, schema, { velocita = 1, fine = null } = {}) {
    this.ferma();
    const corse = schema.giocatori.map((g) => {
      const p = percorsiGiocatore(g);
      return { g, el: svg.querySelector(`.giocatore[data-id="${g.id}"]`), ...p, mPrima: misura(p.prima), mDopo: misura(p.dopo) };
    }).filter((c) => c.el);

    const VEL_MOTION = VELOCITA_TRACCIA.motion;
    const durataMotion = Math.max(0, ...corse.map((c) => c.mPrima.totale / VEL_MOTION));
    const snap = PAUSA_INIZIALE + Math.min(durataMotion, MOTION_PRIMA_DELLO_SNAP);
    // Ognuno parte con la sua traccia allo snap, oppure (se è in motion) quando finisce la motion
    for (const c of corse) {
      c.fineMotion = PAUSA_INIZIALE + c.mPrima.totale / VEL_MOTION;
      c.partenza = c.prima.length ? Math.max(snap, c.fineMotion) : snap;
      c.arrivo = c.partenza + (c.vel && c.dopo.length ? c.mDopo.totale / c.vel : 0);
    }
    const totale = Math.max(snap + 0.8, ...corse.map((c) => Math.max(c.arrivo, c.fineMotion))) + PAUSA_FINALE;

    // Il pallone: dal centro al QB allo snap, poi resta al QB
    const palla = svg.querySelector(".palla");
    const centro = schema.lato === "attacco" ? corse.find((c) => c.g.etichetta === "C") : null;
    const qb = schema.lato === "attacco" ? corse.find((c) => ["QB", "Q"].includes(c.g.etichetta)) : null;
    const pallaInizio = centro ? { x: centro.inizio.x, y: centro.inizio.y - 1 } : null;

    svg.classList.add("in-gioco");
    const partenza = performance.now();
    const stato = { svg, quadro: 0 };
    this.attiva = stato;

    const posizione = (c, t) => {
      if (t < PAUSA_INIZIALE) return c.inizio;
      // Motion: corre già prima dello snap
      if (c.prima.length && t < c.fineMotion) return puntoA(c.mPrima, (t - PAUSA_INIZIALE) * VEL_MOTION);
      const base = c.prima.length ? c.prima[c.prima.length - 1] : c.inizio;
      if (t < c.partenza || !c.dopo.length || !c.vel) return base;
      return puntoA(c.mDopo, (t - c.partenza) * c.vel);
    };

    const passo = (adesso) => {
      if (this.attiva !== stato) return;
      const t = ((adesso - partenza) / 1000) * velocita;
      for (const c of corse) {
        const p = posizione(c, Math.min(t, totale));
        c.el.setAttribute("transform", `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`);
      }
      if (palla && pallaInizio && qb) {
        let p = pallaInizio;
        const dovQb = posizione(qb, t);
        if (t >= snap + TEMPO_SNAP) p = { x: dovQb.x + 0.5, y: dovQb.y - 0.3 };
        else if (t >= snap) {
          const f = (t - snap) / TEMPO_SNAP;
          p = { x: pallaInizio.x + (dovQb.x + 0.5 - pallaInizio.x) * f, y: pallaInizio.y + (dovQb.y - 0.3 - pallaInizio.y) * f };
        }
        palla.setAttribute("transform", `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`);
      }
      if (t >= totale) {
        this.attiva = null;
        svg.classList.remove("in-gioco");
        if (fine) fine();
        return;
      }
      stato.quadro = requestAnimationFrame(passo);
    };
    stato.quadro = requestAnimationFrame(passo);
  },

  // Interrompe l'animazione (chi l'ha avviata ridisegna il campo)
  ferma() {
    if (!this.attiva) return false;
    cancelAnimationFrame(this.attiva.quadro);
    this.attiva.svg.classList.remove("in-gioco");
    this.attiva = null;
    return true;
  },
};
