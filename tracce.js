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
  ],
  difesa: [
    { id: "blitz",   nome: "Blitz",             fine: "freccia" },
    { id: "zona",    nome: "Zona",              fine: "zona", tratteggio: true },
    { id: "uomo",    nome: "Marcatura a uomo",  fine: "freccia", tratteggio: true },
  ],
};
function infoTipo(tipo) {
  return [...TIPI_TRACCIA.attacco, ...TIPI_TRACCIA.difesa].find((t) => t.id === tipo) || TIPI_TRACCIA.attacco[0];
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
  return schemaCorrente.lato === "attacco" && ruoloDi("attacco", g.etichetta) === "linea";
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
function accorcia(punti, quanto) {
  const n = punti.length;
  const a = punti[n - 2], b = punti[n - 1];
  const lung = Math.hypot(b.x - a.x, b.y - a.y);
  if (lung <= quanto) return punti;
  const t = (lung - quanto) / lung;
  return [...punti.slice(0, -1), { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }];
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

  const gruppo = crea("g", { class: `traccia tipo-${t.tipo}` }, genitore);
  const fine = punti[punti.length - 1];
  const prima = punti[punti.length - 2];
  const ang = Math.atan2(fine.y - prima.y, fine.x - prima.x);

  let lineaPunti = info.fine === "freccia" ? accorcia(punti, 0.7 * scala) : punti;
  if (info.ondulata) lineaPunti = ondulata(lineaPunti);
  const d = percorso(lineaPunti);

  // Con l'animazione la linea è "svelata" da una maschera che si disegna
  let contenitore = gruppo;
  if (anima) {
    const defs = crea("defs", {}, gruppo);
    const maschera = crea("mask", { id: idMaschera, maskUnits: "userSpaceOnUse", x: -60, y: -60, width: 120, height: 120 }, defs);
    crea("path", { d: percorso(punti), class: "maschera-traccia", pathLength: 1 }, maschera);
    contenitore = crea("g", { mask: `url(#${idMaschera})` }, gruppo);
  }

  crea("path", { d, class: "linea-traccia" + (info.tratteggio ? " tratteggiata" : "") }, contenitore);

  // Finale della traccia
  const finale = crea("g", {
    class: "finale-traccia" + (anima ? " anima" : ""),
    transform: `translate(${fine.x.toFixed(2)} ${fine.y.toFixed(2)}) rotate(${(ang * 180) / Math.PI}) scale(${scala})`,
  }, gruppo);
  if (info.fine === "freccia") {
    crea("path", { d: "M0 0 L-0.9 -0.48 L-0.9 0.48 Z", class: "punta" }, finale);
  } else if (info.fine === "blocco") {
    crea("path", { d: "M0 -0.65 L0 0.65", class: "barra-blocco" }, finale);
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
      // La linea disegna blocchi (con la T finale), gli altri route o blitz
      tipo: (g.traccia && g.traccia.tipo) ||
        (eUomoDiLinea(g) ? "blocco" : schemaCorrente.lato === "attacco" ? "route" : "blitz"),
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
    const g = d.giocatore;
    let x = p.x, y = YARDE_AVANTI - p.y;
    if (conMaiusc) ({ x, y } = aggancia45(g, d.punti, x, y));
    const provvisoria = { tipo: d.tipo, punti: [...d.punti, dentroCampo(g, x - g.x, y - g.y)] };
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
      d.giocatore.traccia = { tipo: d.tipo, nome: "A mano", punti: d.punti };
      salvaTraPoco();
    }
    aggiornaSuggerimento();
    ridisegna();
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
  menu.innerHTML = "";
  menu.className = "menu-tracce ruolo-" + ruoloDi(schemaCorrente.lato, g.etichetta);

  const testa = document.createElement("div");
  testa.className = "menu-testa";
  testa.innerHTML = `<span class="menu-sigla"></span><span class="menu-titolo"></span>`;
  testa.querySelector(".menu-sigla").textContent = g.etichetta;
  const linea = eUomoDiLinea(g);
  testa.querySelector(".menu-titolo").textContent =
    linea ? "Blocco" : attacco ? "Albero delle route" : "Compito difensivo";
  menu.appendChild(testa);

  const griglia = document.createElement("div");
  griglia.className = "menu-griglia" + (attacco ? "" : " difesa");
  const dentro = versoInterno(g);

  // Uomini di linea: niente albero delle route, solo blocchi
  const voci = linea ? [] : attacco
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
  if (linea) {
    aggiungiAzione("Blocco dritto", "B", () => Tracce.applica(g, { tipo: "blocco", nome: "Blocco", punti: [dentroCampo(g, 0, 1.5)] }));
    aggiungiAzione("✏️  Disegna il blocco a mano", "T", () => Tracce.iniziaDisegno(g));
  } else {
    aggiungiAzione("✏️  Disegna a mano", "T", () => Tracce.iniziaDisegno(g));
    if (attacco) {
      aggiungiAzione("Blocco", "B", () => Tracce.applica(g, { tipo: "blocco", nome: "Blocco", punti: [dentroCampo(g, 0, 1.5)] }));
    }
  }
  if (g.traccia) aggiungiAzione("Rimuovi traccia", "Canc", () => Tracce.rimuovi(g), "distruttiva");
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
  menu.dataset.giocatore = g.id;
  requestAnimationFrame(() => menu.classList.add("visibile"));
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
    s.innerHTML = `<b>Disegno a mano</b> · clic per aggiungere punti · <kbd>Maiusc</kbd> dritto o a 45° · ` +
      `<kbd>doppio clic</kbd> o <kbd>Invio</kbd> per finire · <kbd>Esc</kbd> annulla`;
  } else {
    s.classList.remove("in-disegno");
    s.innerHTML = `Clic su un giocatore per le tracce · trascina per spostare · ` +
      `<kbd>Maiusc</kbd> aggancia alla mezza yarda · <kbd>←↑↓→</kbd> sposta · ` +
      `<kbd>R</kbd> ribalta · <kbd>L</kbd> blocca · <kbd>${TASTO_CMD}Z</kbd> annulla`;
  }
}
aggiornaSuggerimento();
