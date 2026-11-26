/* ==========================================================================
   TRACCE: route, blocchi, motion, letture, blitz e zone.
   --------------------------------------------------------------------------
   Ogni giocatore può avere UNA traccia:
     g.traccia = { tipo: "route", nome: "Slant", punti: [ {dx, dy}, ... ] }
   I punti sono in yarde e RELATIVI al giocatore (dx a destra, dy in avanti):
   così, se sposti il giocatore, la sua traccia lo segue.

   Due modi per crearla (clic su un giocatore → menu):
   1. scegliere una route dall'albero (1-Flat … 9-Fly): viene disegnata
      in automatico, con un'animazione;
   2. "Disegna a mano": ogni clic aggiunge un punto, doppio clic per finire.
   ========================================================================== */

/* ---------- Tipi di traccia e come si disegnano ---------- */
const TIPI_TRACCIA = {
  attacco: [
    { id: "route",   nome: "Route",             fine: "freccia" },
    { id: "blocco",  nome: "Blocco",            fine: "blocco" },
    { id: "motion",  nome: "Motion",            fine: "freccia", ondulata: true },
    { id: "opzione", nome: "Opzione / lettura", fine: "freccia", tratteggio: true },
    { id: "qb",      nome: "Movimento QB",      fine: "punto" }, // drop e rollout: finisce con un puntino
  ],
  difesa: [
    { id: "blitz",   nome: "Blitz",             fine: "freccia" },
    { id: "zona",    nome: "Zona",              fine: "zona", tratteggio: true },
    { id: "uomo",    nome: "Marcatura a uomo",  fine: "freccia", tratteggio: true },
  ],
};
function infoTipo(tipo) {
  return [...TIPI_TRACCIA.attacco, ...TIPI_TRACCIA.difesa, ...(TIPI_TRACCIA.speciali || [])].find((t) => t.id === tipo) || TIPI_TRACCIA.attacco[0];
}

/* ---------- Albero delle route (attacco) ----------
   Punti in yarde: [verso l'interno, in avanti].
   "Interno" = verso il centro del campo, quindi la stessa route
   si disegna giusta sia a destra sia a sinistra. */
const ALBERO_ROUTE = [
  { n: 1, nome: "Flat",     punti: [[0, 3], [-6, 3]] },
  { n: 2, nome: "Slant",    punti: [[0, 3], [5, 8]] },
  { n: 3, nome: "Comeback", punti: [[0, 12], [-3, 10]] },
  { n: 4, nome: "Curl",     punti: [[0, 12], [2, 10]] },
  { n: 5, nome: "Out",      punti: [[0, 10], [-8, 10]] },
  { n: 6, nome: "Drag",     punti: [[0, 10], [10, 10]] },
  { n: 7, nome: "Corner",   punti: [[0, 10], [-7, 17]] },
  { n: 8, nome: "Post",     punti: [[0, 10], [7, 17]] },
  { n: 9, nome: "Fly",      punti: [[0, 20]] },
];

/* ---------- Tracce pronte per la difesa ----------
   "bersaglio" restituisce il punto d'arrivo in coordinate del campo. */
/* ---------- Movimenti pronti del QB ----------
   Punti in yarde: [verso destra, in avanti] (negativo = indietro).
   Drop: arretra dritto. Rollout: arretra e si apre verso l'esterno. */
const MOVIMENTI_QB = [
  { nome: "Drop 3 passi",     punti: [[0, -3]] },
  { nome: "Drop 5 passi",     punti: [[0, -5]] },
  { nome: "Drop 7 passi",     punti: [[0, -7]] },
  { nome: "Rollout destra",   punti: [[1.5, -2.5], [5, -4], [8.5, -3.5]] },
  { nome: "Rollout sinistra", punti: [[-1.5, -2.5], [-5, -4], [-8.5, -3.5]] },
];

function tracciaDaQb(g, movimento) {
  return {
    tipo: "qb",
    nome: movimento.nome,
    curva: movimento.punti.length > 1, // i rollout sono curvi, i drop dritti
    punti: movimento.punti.map(([dx, dy]) => dentroCampo(g, dx, dy)),
  };
}

const TRACCE_DIFESA = [
  { id: "blitz",  nome: "Blitz",           tipo: "blitz", bersaglio: (g) => ({ x: CENTRO + (g.x - CENTRO) * 0.2, y: -3 }) },
  { id: "flat",   nome: "Zona flat",       tipo: "zona",  bersaglio: (g) => ({ x: g.x < CENTRO ? 8 : LARGHEZZA_CAMPO - 8, y: 6 }) },
  { id: "hook",   nome: "Zona hook/curl",  tipo: "zona",  bersaglio: (g) => ({ x: g.x < CENTRO ? 18 : LARGHEZZA_CAMPO - 18, y: 9 }) },
  { id: "centro", nome: "Zona centrale",   tipo: "zona",  bersaglio: () => ({ x: CENTRO, y: 10 }) },
  { id: "terzo",  nome: "Terzo profondo",  tipo: "zona",  bersaglio: (g) => ({ x: piuVicino(g.x, [9, CENTRO, LARGHEZZA_CAMPO - 9]), y: 18 }) },
  { id: "meta",   nome: "Metà profonda",   tipo: "zona",  bersaglio: (g) => ({ x: g.x < CENTRO ? 13.3 : LARGHEZZA_CAMPO - 13.3, y: 18 }) },
];
function piuVicino(x, valori) {
  return valori.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
}

// Vero per gli uomini di linea d'attacco (C, G, T…): fanno solo blocchi
function eUomoDiLinea(g) {
  // Nel flag non c'è la linea: il centro snappa e poi corre le route
  if (formatoDi(schemaCorrente).flag) return false;
  return schemaCorrente.lato === "attacco" && ruoloDi("attacco", g.etichetta) === "linea";
}

// Vero per il quarterback: niente albero delle route, solo il suo movimento a mano
function eQuarterback(g) {
  return schemaCorrente.lato === "attacco" && ruoloDi("attacco", g.etichetta) === "qb";
}

// Giocatori che non usano l'albero delle route (linea e QB)
function senzaAlbero(g) {
  return eUomoDiLinea(g) || eQuarterback(g);
}

// Verso l'interno: +1 se il giocatore è a sinistra del pallone, -1 se a destra
function versoInterno(g) {
  return g.x <= CENTRO + 0.5 ? 1 : -1;
}

// Tiene i punti dentro il campo visibile
function dentroCampo(g, dx, dy) {
  const x = Math.min(LARGHEZZA_CAMPO - 0.8, Math.max(0.8, g.x + dx));
  const y = Math.min(YARDE_AVANTI - 0.8, Math.max(-YARDE_DIETRO + 0.8, g.y + dy));
  return { dx: +(x - g.x).toFixed(2), dy: +(y - g.y).toFixed(2) };
}

function tracciaDaRoute(g, route) {
  const dentro = versoInterno(g);
  return {
    tipo: "route",
    nome: `${route.n}-${route.nome}`,
    punti: route.punti.map(([i, avanti]) => dentroCampo(g, i * dentro, avanti)),
  };
}

function tracciaDaDifesa(g, preset) {
  const b = preset.bersaglio(g);
  return { tipo: preset.tipo, nome: preset.nome, punti: [dentroCampo(g, b.x - g.x, b.y - g.y)] };
}

/* ==========================================================================
   COPIA E INCOLLA UNA TRACCIA (anche specchiata)
   La traccia copiata resta in memoria nel browser, così si può incollare
   anche in un altro schema. Specchiata = ribaltata destra/sinistra
   (un Out verso destra diventa un Out verso sinistra).
   Usato dal computer (menu e Ctrl+C / Ctrl+V) e dall'editor del telefono.
   ========================================================================== */
const AppuntiTraccia = {
  chiave: "playbook.appunti-traccia",

  leggi() { return leggiLocale(this.chiave); },

  copia(g, lato) {
    if (!g.traccia) return false;
    scriviLocale(this.chiave, { lato, etichetta: g.etichetta, traccia: JSON.parse(JSON.stringify(g.traccia)) });
    return true;
  },

  // null se si può incollare su questo giocatore, altrimenti il motivo
  motivoNo(g, lato) {
    const a = this.leggi();
    if (!a) return "Prima copia una traccia";
    if (a.lato !== lato) {
      return a.lato === "difesa" ? "È una traccia di difesa: incollala su un difensore"
        : "È una traccia d'attacco: incollala su un giocatore d'attacco";
    }
    const tipo = a.traccia.tipo;
    if (eUomoDiLinea(g) && tipo !== "blocco") return "La linea fa solo blocchi";
    if (tipo === "qb" && !eQuarterback(g)) return "Il movimento del QB si incolla solo al QB";
    if (tipo === "blocco" && formatoDi(schemaCorrente).flag) return "Nel flag non si blocca";
    return null;
  },

  // La traccia da incollare su "g" (con specchia = true, ribaltata destra/sinistra)
  crea(g, specchia = false) {
    const t = JSON.parse(JSON.stringify(this.leggi().traccia));
    const segno = specchia ? -1 : 1;
    t.punti = t.punti.map((p) => dentroCampo(g, p.dx * segno, p.dy)); // sempre dentro il campo
    for (const r of t.rami || []) r.punti = r.punti.map((p) => ({ dx: +(p.dx * segno).toFixed(2), dy: p.dy }));
    return t;
  },
};

/* ==========================================================================
   DISEGNO
   ========================================================================== */

// Punti della traccia nel disegno, relativi al giocatore (y del disegno va in giù)
function puntiDisegno(traccia) {
  return [{ x: 0, y: 0 }, ...traccia.punti.map((p) => ({ x: p.dx, y: -p.dy }))];
}

function percorso(punti) {
  return punti.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
}

// Accorcia la linea alla fine (per lasciare spazio alla punta della freccia)
// (funziona anche sulle linee curve, fatte di tanti piccoli segmenti)
function accorcia(punti, quanto) {
  const risultato = [...punti];
  let resto = quanto;
  while (risultato.length > 1) {
    const b = risultato[risultato.length - 1];
    const a = risultato[risultato.length - 2];
    const lung = Math.hypot(b.x - a.x, b.y - a.y);
    if (lung > resto) {
      const t = (lung - resto) / lung;
      risultato[risultato.length - 1] = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
      return risultato;
    }
    if (risultato.length === 2) return punti; // traccia troppo corta: la lasciamo intera
    risultato.pop();
    resto -= lung;
  }
  return punti;
}

/* Linea morbida: invece degli angoli netti, una curva che passa per
   tutti i punti. Usiamo la curva di Catmull-Rom "centripeta": segue i
   punti senza mai fare riccioli o sforare nei cambi di direzione bruschi.
   La trasformiamo in tanti piccoli segmenti, così freccia, onde del motion
   e animazione funzionano come per le linee spezzate. */
function curvaMorbida(p) {
  if (p.length < 3) return p;
  const n = p.length;
  // Punti "fantasma" prima dell'inizio e dopo la fine, per far partire e finire bene la curva
  const prima = { x: 2 * p[0].x - p[1].x, y: 2 * p[0].y - p[1].y };
  const dopo = { x: 2 * p[n - 1].x - p[n - 2].x, y: 2 * p[n - 1].y - p[n - 2].y };
  const tutti = [prima, ...p, dopo];
  const passo = (a, b) => Math.max(Math.sqrt(Math.hypot(b.x - a.x, b.y - a.y)), 1e-4); // alfa = 0,5
  const mescola = (a, b, ta, tb, t) => ({
    x: ((tb - t) * a.x + (t - ta) * b.x) / (tb - ta),
    y: ((tb - t) * a.y + (t - ta) * b.y) / (tb - ta),
  });

  const risultato = [p[0]];
  for (let i = 1; i < tutti.length - 2; i++) {
    const [p0, p1, p2, p3] = [tutti[i - 1], tutti[i], tutti[i + 1], tutti[i + 2]];
    const t0 = 0, t1 = t0 + passo(p0, p1), t2 = t1 + passo(p1, p2), t3 = t2 + passo(p2, p3);
    const campioni = Math.max(6, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / 0.2));
    for (let s = 1; s <= campioni; s++) {
      const t = t1 + ((t2 - t1) * s) / campioni;
      const a1 = mescola(p0, p1, t0, t1, t), a2 = mescola(p1, p2, t1, t2, t), a3 = mescola(p2, p3, t2, t3, t);
      const b1 = mescola(a1, a2, t0, t2, t), b2 = mescola(a2, a3, t1, t3, t);
      risultato.push(mescola(b1, b2, t1, t2, t));
    }
  }
  return risultato;
}

// Linea ondulata per il motion: piccole onde lungo il percorso
function ondulata(punti) {
  const risultato = [punti[0]];
  let percorsi = 0;
  for (let i = 1; i < punti.length; i++) {
    const a = punti[i - 1], b = punti[i];
    const lung = Math.hypot(b.x - a.x, b.y - a.y);
    const ux = (b.x - a.x) / lung, uy = (b.y - a.y) / lung;
    const passi = Math.max(1, Math.floor(lung / 0.2));
    for (let s = 1; s <= passi; s++) {
      const d = (lung * s) / passi;
      const ultimoTratto = i === punti.length - 1 && d > lung - 1.2;
      const onda = ultimoTratto ? 0 : Math.sin(((percorsi + d) / 1.1) * Math.PI * 2) * 0.32;
      risultato.push({ x: a.x + ux * d - uy * onda, y: a.y + uy * d + ux * onda });
    }
    percorsi += lung;
  }
  return risultato;
}

/* Disegna la traccia di un giocatore dentro "genitore" (già spostato
   sulla posizione del giocatore). Con anima = true la linea "corre"
   dal giocatore alla fine e poi compare la punta. */
function disegnaTraccia(genitore, g, { anima = false, idMaschera = "", scala = 1 } = {}) {
  const t = g.traccia;
  if (!t || !t.punti.length) return;
  const info = infoTipo(t.tipo);
  let punti = puntiDisegno(t);
  /* Motion + route (come in Playmaker): i primi "t.motion" punti sono la
     motion prima dello snap (linea ondulata), poi parte la route vera. */
  let puntiMotion = null;
  const nMotion = t.motion && t.tipo !== "motion" ? Math.min(t.motion, punti.length - 2) : 0;
  if (nMotion > 0) {
    puntiMotion = punti.slice(0, nMotion + 1);
    punti = punti.slice(nMotion);
  }
  const tuttiIPunti = puntiMotion ? [...puntiMotion, ...punti.slice(1)] : punti;
  if (t.curva) punti = curvaMorbida(punti); // linea morbida: niente angoli netti

  const gruppo = crea("g", { class: `traccia tipo-${t.tipo}${t.curva ? " curva" : ""}` }, genitore);
  const fine = punti[punti.length - 1];
  // Direzione finale (per freccia e barra del blocco): guardiamo un po' indietro lungo la linea
  const indietro = accorcia(punti, 0.6);
  let prima = indietro[indietro.length - 1];
  if (prima === fine) prima = punti[punti.length - 2]; // traccia cortissima: usiamo il punto precedente
  const ang = Math.atan2(fine.y - prima.y, fine.x - prima.x);

  let lineaPunti = info.fine === "freccia" ? accorcia(punti, 0.7 * scala) : punti;
  if (info.ondulata) lineaPunti = ondulata(lineaPunti);
  const d = percorso(lineaPunti);

  // Con l'animazione la linea è "svelata" da una maschera che si disegna
  let contenitore = gruppo;
  if (anima) {
    const defs = crea("defs", {}, gruppo);
    const maschera = crea("mask", { id: idMaschera, maskUnits: "userSpaceOnUse", x: -60, y: -60, width: 120, height: 120 }, defs);
    crea("path", { d: percorso(tuttiIPunti), class: "maschera-traccia", pathLength: 1 }, maschera);
    contenitore = crea("g", { mask: `url(#${idMaschera})` }, gruppo);
  }

  if (puntiMotion) {
    crea("path", { d: percorso(ondulata(puntiMotion)), class: "linea-traccia motion-iniziale" }, contenitore);
  }
  crea("path", { d, class: "linea-traccia" + (info.tratteggio ? " tratteggiata" : "") }, contenitore);

  // Rami di opzione: linee tratteggiate che partono da un punto della traccia
  // (es. "hitch oppure seam"), sempre con la freccia
  for (const ramo of t.rami || []) {
    if (!ramo.punti || ramo.punti.length < 2) continue;
    const pr = ramo.punti.map((p) => ({ x: p.dx, y: -p.dy }));
    const fr = pr[pr.length - 1], pp = pr[pr.length - 2];
    const angRamo = Math.atan2(fr.y - pp.y, fr.x - pp.x);
    crea("path", { d: percorso(accorcia(pr, 0.7 * scala)), class: "linea-traccia tratteggiata ramo" }, contenitore);
    const punta = crea("g", {
      class: "finale-traccia" + (anima ? " anima" : ""),
      transform: `translate(${fr.x.toFixed(2)} ${fr.y.toFixed(2)}) rotate(${(angRamo * 180) / Math.PI}) scale(${scala})`,
    }, gruppo);
    crea("path", { d: "M0 0 L-0.9 -0.48 L-0.9 0.48 Z", class: "punta" }, punta);
  }

  // Finale della traccia
  const finale = crea("g", {
    class: "finale-traccia" + (anima ? " anima" : ""),
    transform: `translate(${fine.x.toFixed(2)} ${fine.y.toFixed(2)}) rotate(${(ang * 180) / Math.PI}) scale(${scala})`,
  }, gruppo);
  if (info.fine === "freccia") {
    crea("path", { d: "M0 0 L-0.9 -0.48 L-0.9 0.48 Z", class: "punta" }, finale);
  } else if (info.fine === "blocco") {
    crea("path", { d: "M0 -0.65 L0 0.65", class: "barra-blocco" }, finale);
  } else if (info.fine === "punto") {
    crea("circle", { r: 0.42, class: "punto-finale" }, finale); // dove il QB si ferma per lanciare
  } else if (info.fine === "zona") {
    crea("ellipse", { rx: 2.6, ry: 1.5, transform: `rotate(${(-ang * 180) / Math.PI})`, class: "area-zona" }, finale);
  }
}

/* ==========================================================================
   MENU DELLE TRACCE (compare cliccando un giocatore)
   ========================================================================== */
const Tracce = {
  disegno: null,      // disegno a mano in corso: { giocatore, punti, prima }
  daAnimare: null,    // id del giocatore la cui traccia va animata al prossimo disegno

  // Applica una traccia pronta (route dell'albero o difesa) con animazione
  applica(g, traccia) {
    if (schemaBloccato()) return;
    ricordaStato();
    g.traccia = traccia;
    this.daAnimare = g.id;
    chiudiMenuTracce();
    ridisegna();
    salvaTraPoco();
  },

  rimuovi(g) {
    if (!g || !g.traccia || schemaBloccato()) return;
    ricordaStato();
    delete g.traccia;
    chiudiMenuTracce();
    ridisegna();
    salvaTraPoco();
  },

  /* ---------- Disegno a mano ---------- */
  iniziaDisegno(g) {
    if (schemaBloccato()) return;
    chiudiMenuTracce();
    this.disegno = {
      giocatore: g,
      punti: [],
      curva: Boolean(leggiLocale("playbook.disegno-curvo")), // ultima scelta del coach
      // La linea disegna blocchi (con la T finale), gli altri route o blitz
      tipo: (g.traccia && g.traccia.tipo) ||
        (eUomoDiLinea(g) ? "blocco" : eQuarterback(g) ? "qb" : schemaCorrente.lato === "attacco" ? "route"
          : schemaCorrente.lato === "speciali" ? tipoSpecialeAMano(schemaCorrente, g) : "blitz"),
      prima: istantanea(),
    };
    document.body.classList.add("disegnando");
    aggiornaSuggerimento();
    ridisegna();
  },

  // Aggiunge un punto dove clicchi (con Maiusc: segmenti dritti o a 45°)
  aggiungiPunto(p, conMaiusc) {
    const d = this.disegno;
    const g = d.giocatore;
    let x = p.x, y = YARDE_AVANTI - p.y; // da coordinate del disegno a yarde
    if (conMaiusc) ({ x, y } = aggancia45(g, d.punti, x, y));
    const nuovo = dentroCampo(g, x - g.x, y - g.y);
    const ultimo = d.punti[d.punti.length - 1] || { dx: 0, dy: 0 };
    if (Math.hypot(nuovo.dx - ultimo.dx, nuovo.dy - ultimo.dy) < 0.4) return; // doppio clic: niente punti doppi
    d.punti.push(nuovo);
    this.anteprima(p, conMaiusc);
  },

  // Linea che segue il mouse mentre disegni
  anteprima(p, conMaiusc) {
    const d = this.disegno;
    if (!d) return;
    this.ultimoPunto = { p, maiusc: conMaiusc };
    const g = d.giocatore;
    let x = p.x, y = YARDE_AVANTI - p.y;
    if (conMaiusc) ({ x, y } = aggancia45(g, d.punti, x, y));
    const provvisoria = { tipo: d.tipo, curva: d.curva, punti: [...d.punti, dentroCampo(g, x - g.x, y - g.y)] };
    const livello = svgCampo.querySelector(`.tracce-giocatore[data-id="${g.id}"]`);
    if (!livello) return;
    livello.innerHTML = "";
    disegnaTraccia(livello, { ...g, traccia: provvisoria });
    livello.classList.add("in-disegno");
  },

  finisciDisegno() {
    const d = this.disegno;
    if (!d) return;
    this.disegno = null;
    document.body.classList.remove("disegnando");
    if (d.punti.length) {
      ricordaStato(d.prima);
      d.giocatore.traccia = { tipo: d.tipo, nome: "A mano", curva: d.curva, punti: d.punti };
      salvaTraPoco();
    }
    aggiornaSuggerimento();
    ridisegna();
  },

  // Tasto C durante il disegno: passa da linea spezzata a morbida e viceversa
  commutaCurvaDisegno() {
    const d = this.disegno;
    if (!d) return;
    d.curva = !d.curva;
    scriviLocale("playbook.disegno-curvo", d.curva);
    aggiornaSuggerimento();
    if (this.ultimoPunto) this.anteprima(this.ultimoPunto.p, this.ultimoPunto.maiusc);
  },

  // Linea morbida sì/no su una traccia già fatta
  commutaCurva(g) {
    if (!g || !g.traccia || schemaBloccato()) return;
    ricordaStato();
    g.traccia.curva = !g.traccia.curva;
    this.animaInterruttore = true; // il pannello mostrerà lo scatto dell'interruttore
    chiudiMenuTracce();
    ridisegna();
    salvaTraPoco();
    mostraAvviso(g.traccia.curva ? "Linea morbida" : "Linea con angoli netti");
  },

  annullaDisegno() {
    if (!this.disegno) return;
    this.disegno = null;
    document.body.classList.remove("disegnando");
    aggiornaSuggerimento();
    ridisegna();
  },
};

// Con Maiusc: il nuovo segmento va dritto, in orizzontale o a 45°
function aggancia45(g, punti, x, y) {
  const ultimo = punti[punti.length - 1] || { dx: 0, dy: 0 };
  const ox = g.x + ultimo.dx, oy = g.y + ultimo.dy;
  const ang = Math.atan2(y - oy, x - ox);
  const passo = Math.PI / 4;
  const angAgganciato = Math.round(ang / passo) * passo;
  const lung = Math.hypot(x - ox, y - oy);
  return { x: ox + Math.cos(angAgganciato) * lung, y: oy + Math.sin(angAgganciato) * lung };
}

/* ---------- Icone del menu: piccola anteprima di ogni traccia ---------- */
function iconaTraccia(punti, tipo) {
  // punti: lista di {x, y} in yarde, partendo da (0,0); y in avanti
  const tutti = [{ x: 0, y: 0 }, ...punti];
  const minX = Math.min(...tutti.map((p) => p.x)), maxX = Math.max(...tutti.map((p) => p.x));
  const minY = Math.min(...tutti.map((p) => p.y)), maxY = Math.max(...tutti.map((p) => p.y));
  const lato = Math.max(maxX - minX, maxY - minY, 4) + 3;
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `${cx - lato / 2} ${-cy - lato / 2} ${lato} ${lato}`);
  svg.setAttribute("class", "icona-traccia");
  const finto = { x: 0, y: 0, traccia: { tipo, punti: punti.map((p) => ({ dx: p.x, dy: p.y })) } };
  const g = crea("g", { style: `--spessore:${lato / 14}` }, svg);
  disegnaTraccia(g, finto, { scala: lato / 9 });
  crea("circle", { r: lato / 11, class: "icona-giocatore" }, svg);
  return svg;
}

function apriMenuTracce(g) {
  const menu = $("#menu-tracce");
  const attacco = schemaCorrente.lato === "attacco";
  const speciali = schemaCorrente.lato === "speciali";
  menu.innerHTML = "";
  menu.className = "menu-tracce ruolo-" + ruoloDi(schemaCorrente.lato, g.etichetta);

  const testa = document.createElement("div");
  testa.className = "menu-testa";
  testa.innerHTML = `<span class="menu-sigla"></span><span class="menu-titolo"></span>`;
  testa.querySelector(".menu-sigla").textContent = g.etichetta;
  const linea = eUomoDiLinea(g);
  const qb = eQuarterback(g);
  testa.querySelector(".menu-titolo").textContent =
    linea ? "Blocco" : qb ? "Movimento del QB" : attacco ? "Albero delle route" : speciali ? "Compito special teams" : "Compito difensivo";
  menu.appendChild(testa);

  const griglia = document.createElement("div");
  griglia.className = "menu-griglia" + (attacco ? "" : " difesa");
  const dentro = versoInterno(g);

  // Uomini di linea e QB: niente albero delle route
  const voci = linea ? [] : qb
    ? MOVIMENTI_QB.map((m, i) => ({
        etichetta: m.nome,
        tasto: String(i + 1),
        icona: iconaTraccia(m.punti.map(([x, y]) => ({ x, y })), "qb"),
        azione: () => Tracce.applica(g, tracciaDaQb(g, m)),
      }))
    : speciali
    ? tracceSpecialiPer(schemaCorrente, g).map((p, i) => {
        const t = tracciaDaSpeciale(schemaCorrente, g, p);
        return {
          etichetta: p.nome,
          tasto: String(i + 1),
          icona: iconaTraccia(t.punti.map((q) => ({ x: q.dx, y: q.dy })), p.tipo),
          azione: () => Tracce.applica(g, t),
        };
      })
    : attacco
    ? ALBERO_ROUTE.map((r) => ({
        etichetta: `${r.n}-${r.nome}`,
        tasto: String(r.n),
        icona: iconaTraccia(r.punti.map(([i, a]) => ({ x: i * dentro, y: a })), "route"),
        azione: () => Tracce.applica(g, tracciaDaRoute(g, r)),
      }))
    : TRACCE_DIFESA.map((p, i) => {
        const b = p.bersaglio(g);
        return {
          etichetta: p.nome,
          tasto: String(i + 1),
          icona: iconaTraccia([{ x: b.x - g.x, y: b.y - g.y }], p.tipo),
          azione: () => Tracce.applica(g, tracciaDaDifesa(g, p)),
        };
      });

  voci.forEach((v, i) => {
    const b = document.createElement("button");
    b.className = "voce-traccia";
    b.style.setProperty("--i", i);
    b.title = `${v.etichetta} (tasto ${v.tasto})`;
    b.append(v.icona);
    const nome = document.createElement("span");
    nome.textContent = v.etichetta;
    b.append(nome);
    b.addEventListener("click", v.azione);
    griglia.appendChild(b);
  });
  if (voci.length) menu.appendChild(griglia);

  // Azioni extra: blocco (attacco), disegno a mano, rimuovi
  const azioni = document.createElement("div");
  azioni.className = "menu-azioni";
  const aggiungiAzione = (testo, tasto, azione, classe = "") => {
    const b = document.createElement("button");
    b.className = "azione-menu " + classe;
    b.innerHTML = `<span></span><kbd>${tasto}</kbd>`;
    b.querySelector("span").textContent = testo;
    b.addEventListener("click", azione);
    azioni.appendChild(b);
  };
  if (qb) {
    aggiungiAzione("✏️  Disegna il movimento a mano", "T", () => Tracce.iniziaDisegno(g));
  } else if (linea) {
    aggiungiAzione("Blocco dritto", "B", () => Tracce.applica(g, { tipo: "blocco", nome: "Blocco", punti: [dentroCampo(g, 0, 1.5)] }));
    aggiungiAzione("✏️  Disegna il blocco a mano", "T", () => Tracce.iniziaDisegno(g));
  } else {
    aggiungiAzione("✏️  Disegna a mano", "T", () => Tracce.iniziaDisegno(g));
    if (attacco && !formatoDi(schemaCorrente).flag) { // nel flag non si blocca
      aggiungiAzione("Blocco", "B", () => Tracce.applica(g, { tipo: "blocco", nome: "Blocco", punti: [dentroCampo(g, 0, 1.5)] }));
    } else if (speciali && !tracceSpecialiPer(schemaCorrente, g).some((p) => p.tipo === "blocco")) {
      const avanti = versoSchema(schemaCorrente) === "attacco" ? 1.5 : -1.5;
      aggiungiAzione("Blocco", "B", () => Tracce.applica(g, { tipo: "blocco", nome: "Blocco", punti: [dentroCampo(g, 0, avanti)] }));
    }
  }
  // Copia / incolla (anche specchiata)
  if (g.traccia) {
    aggiungiAzione("📋  Copia traccia", `${TASTO_CMD}C`, () => copiaTracciaGiocatore(g));
  }
  if (AppuntiTraccia.leggi() && !AppuntiTraccia.motivoNo(g, schemaCorrente.lato)) {
    aggiungiAzione("📥  Incolla traccia", `${TASTO_CMD}V`, () => incollaTracciaGiocatore(g, false));
    aggiungiAzione("⇋  Incolla specchiata", `${TASTO_CMD}⇧V`, () => incollaTracciaGiocatore(g, true));
  }
  if (g.traccia) {
    aggiungiAzione(g.traccia.curva ? "〰️  Linea con angoli netti" : "〰️  Linea morbida (curva)", "C", () => Tracce.commutaCurva(g));
    aggiungiAzione("Rimuovi traccia", "Canc", () => Tracce.rimuovi(g), "distruttiva");
  }
  else aggiungiAzione("Togli giocatore dal campo", "Canc", () => rimuoviGiocatore(g), "distruttiva");
  menu.appendChild(azioni);

  // Posizione: accanto al giocatore, dentro la finestra
  menu.hidden = false;
  const el = svgCampo.querySelector(`.giocatore[data-id="${g.id}"]`);
  const r = el.getBoundingClientRect();
  const larg = menu.offsetWidth, alt = menu.offsetHeight;
  let left = r.right + 14;
  if (left + larg > innerWidth - 12) left = r.left - larg - 14;
  let top = r.top + r.height / 2 - alt / 2;
  top = Math.max(12, Math.min(innerHeight - alt - 12, top));
  menu.style.left = Math.max(12, left) + "px";
  menu.style.top = top + "px";
  // Se il coach l'ha spostato, il riquadro si riapre dove l'ha lasciato
  const fissata = leggiLocale(CHIAVE_POSIZIONE_MENU);
  if (fissata) mettiMenuIn(menu, fissata.left, fissata.top);
  menu.classList.toggle("spostato", Boolean(fissata));
  menu.dataset.giocatore = g.id;
  testa.title = "Trascina per spostare il riquadro · doppio clic: torna accanto al giocatore";
  testa.addEventListener("pointerdown", (e) => iniziaSpostamentoMenu(menu, e));
  testa.addEventListener("dblclick", () => {
    scriviLocale(CHIAVE_POSIZIONE_MENU, null);
    apriMenuTracce(g); // di nuovo accanto al giocatore
  });
  requestAnimationFrame(() => menu.classList.add("visibile"));
}

/* ---------- Riquadro delle tracce trascinabile ----------
   Si prende dalla barra in alto e si lascia dove si vuole, così non copre
   il campo. La posizione resta ricordata: il riquadro si riapre lì anche
   cliccando altri giocatori. Doppio clic sulla barra: torna accanto al giocatore. */
const CHIAVE_POSIZIONE_MENU = "playbook.posizione-menu-tracce";

// Tiene il riquadro dentro la finestra
function mettiMenuIn(menu, left, top) {
  const l = Math.max(8, Math.min(innerWidth - menu.offsetWidth - 8, left));
  const t = Math.max(8, Math.min(innerHeight - menu.offsetHeight - 8, top));
  menu.style.left = l + "px";
  menu.style.top = t + "px";
  return { left: l, top: t };
}

function iniziaSpostamentoMenu(menu, e) {
  if (e.button !== 0) return;
  e.preventDefault();
  const r = menu.getBoundingClientRect();
  const dx = e.clientX - r.left, dy = e.clientY - r.top;
  const barra = e.currentTarget;
  barra.setPointerCapture(e.pointerId);
  menu.classList.add("in-spostamento");
  let ultima = null;
  const muovi = (ev) => { ultima = mettiMenuIn(menu, ev.clientX - dx, ev.clientY - dy); };
  const fine = () => {
    barra.removeEventListener("pointermove", muovi);
    barra.removeEventListener("pointerup", fine);
    barra.removeEventListener("pointercancel", fine);
    menu.classList.remove("in-spostamento");
    if (ultima) {
      scriviLocale(CHIAVE_POSIZIONE_MENU, ultima);
      menu.classList.add("spostato");
    }
  };
  barra.addEventListener("pointermove", muovi);
  barra.addEventListener("pointerup", fine);
  barra.addEventListener("pointercancel", fine);
}

function chiudiMenuTracce() {
  const menu = $("#menu-tracce");
  if (menu.hidden) return;
  menu.classList.remove("visibile");
  menu.hidden = true;
}

function menuTracceAperto() {
  return !$("#menu-tracce").hidden;
}

// Clic fuori dal menu e dal campo: il menu si chiude
document.addEventListener("pointerdown", (e) => {
  if (menuTracceAperto() && !e.target.closest("#menu-tracce") && !e.target.closest("#campo")) chiudiMenuTracce();
});
window.addEventListener("resize", chiudiMenuTracce);

/* Suggerimento sotto il campo: cambia mentre disegni */
function aggiornaSuggerimento() {
  const s = $("#suggerimento");
  if (Tracce.disegno) {
    s.classList.add("in-disegno");
    const curva = Tracce.disegno.curva;
    s.innerHTML = `<b>Disegno a mano</b> · clic per aggiungere punti · <kbd>C</kbd> linea ${curva ? "<b>morbida</b>" : "spezzata"} · <kbd>Maiusc</kbd> dritto o a 45° · ` +
      `<kbd>doppio clic</kbd> o <kbd>Invio</kbd> per finire · <kbd>Esc</kbd> annulla`;
  } else {
    s.classList.remove("in-disegno");
    s.innerHTML = `Clic su un giocatore per le tracce · trascina per spostare · <kbd>Maiusc</kbd>+clic o riquadro: più giocatori · ` +
      `<kbd>Maiusc</kbd> aggancia alla mezza yarda · <kbd>←↑↓→</kbd> sposta · ` +
      `<kbd>R</kbd> ribalta · <kbd>L</kbd> blocca · <kbd>${TASTO_CMD}Z</kbd> annulla`;
  }
}
aggiornaSuggerimento();
