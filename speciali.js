/* ==========================================================================
   SPECIAL TEAMS
   --------------------------------------------------------------------------
   Terza sezione accanto ad Attacco e Difesa: schema.lato = "speciali".
   L'unità (Kickoff, Punt, …) è la CATEGORIA dello schema (schema.categoria),
   così filtri, ricerca e stampa per categoria funzionano già.

   La nostra squadra è sempre disegnata con i cerchi. Da che parte della
   linea sta dipende dall'unità:
   - unità che CALCIANO (kickoff, punt, field goal, onside): sotto la linea,
     come l'attacco («verso» = "attacco")
   - unità che RICEVONO (kick return, punt return, blocco FG): sopra la
     linea, come la difesa («verso» = "difesa")
   Kickoff, Kick return e Punt return usano un CAMPO PIÙ LUNGO (50 yarde
   oltre la linea) perché il ritornatore sta a 40-45 yarde.
   Usato da computer, telefono e stampa.
   ========================================================================== */

const UNITA_SPECIALI = [
  { id: "kickoff",     nome: "Kickoff",          icona: "🚀", verso: "attacco", lungo: true },
  { id: "kick-return", nome: "Kick return",      icona: "↩️", verso: "difesa",  lungo: true },
  { id: "punt",        nome: "Punt",             icona: "🦵", verso: "attacco" },
  { id: "punt-return", nome: "Punt return",      icona: "🔁", verso: "difesa",  lungo: true },
  { id: "field-goal",  nome: "Field goal / PAT", icona: "🥅", verso: "attacco" },
  { id: "fg-block",    nome: "Blocco FG",        icona: "✋", verso: "difesa" },
  { id: "onside",      nome: "Onside kick",      icona: "🤏", verso: "attacco" },
];
// L'unità avversaria "naturale" (per gli avversari in trasparenza)
const CONTRO_UNITA = {
  kickoff: "kick-return", "kick-return": "kickoff", punt: "punt-return", "punt-return": "punt",
  "field-goal": "fg-block", "fg-block": "field-goal", onside: "kick-return",
};

const ORDINE_LATI = ["attacco", "difesa", "speciali"];
const NOMI_LATO = { attacco: "Attacco", difesa: "Difesa", speciali: "Special teams" };
const YARDE_AVANTI_NORMALE = 23;
const YARDE_AVANTI_LUNGO = 50;

function unitaDi(schema) {
  return schema && schema.lato === "speciali" ? UNITA_SPECIALI.find((u) => u.id === schema.categoria) || null : null;
}

/* Il "verso" dello schema: da che parte della linea sta la nostra squadra.
   Attacco e difesa sono se stessi; uno special team dipende dall'unità
   (senza unità scelta: come chi calcia). */
function versoSchema(schema) {
  if (!schema) return "attacco";
  if (schema.lato !== "speciali") return schema.lato;
  const u = unitaDi(schema);
  return u ? u.verso : "attacco";
}
function versoUnita(id) {
  const u = UNITA_SPECIALI.find((x) => x.id === id);
  return u ? u.verso : "attacco";
}

function campoLungo(schema) {
  const u = unitaDi(schema);
  return Boolean(u && u.lungo);
}

/* Prepara le misure del campo per questo schema (campo lungo o normale).
   YARDE_AVANTI e ALTEZZA_CAMPO sono in app.js / mobile/campo.js. */
function impostaCampo(schema) {
  YARDE_AVANTI = campoLungo(schema) ? YARDE_AVANTI_LUNGO : YARDE_AVANTI_NORMALE;
  ALTEZZA_CAMPO = YARDE_DIETRO + YARDE_AVANTI;
}
// Disegna qualcosa con le misure di "schema" e poi torna a quelle dello schema aperto
function conCampoDi(schema, fn) {
  impostaCampo(schema);
  try { return fn(); } finally { impostaCampo(schemaAperto()); }
}
function schemaAperto() {
  return typeof schemaCorrente !== "undefined" ? schemaCorrente : null;
}

// Nel flag non ci sono calci: la sezione non compare
function conSpecialTeams(formato) {
  return formato !== "flag";
}

/* ---------- Ruoli e colori ---------- */
RUOLI.speciali = {
  "st-calcio": ["K", "P", "H"],
  "st-protezione": ["LS", "C", "G", "T", "LG", "RG", "LT", "RT", "W", "LW", "RW", "TE", "Y", "PP"],
  "st-ritorno": ["KR", "PR", "R"],
  "st-copertura": [], // tutti gli altri (L1…R5, gunner, front, vise…)
};
if (typeof NOMI_RUOLI !== "undefined") Object.assign(NOMI_RUOLI, {
  "st-calcio": "Calciatori", "st-protezione": "Protezione", "st-ritorno": "Ritorno", "st-copertura": "Copertura e blocchi",
});
function formaPedinaSpeciale(sigla) {
  return sigla === "LS" || sigla === "C" ? "quadrato" : "cerchio";
}
// Forma della pedina per lato: lettera in difesa, quadrato per centro/snapper, cerchio per gli altri
function formaPedina(lato, sigla) {
  if (lato === "difesa") return "lettera";
  if (lato === "speciali") return formaPedinaSpeciale(sigla);
  return sigla === "C" ? "quadrato" : "cerchio";
}

/* ---------- Categorie = unità ---------- */
CATEGORIE.speciali = UNITA_SPECIALI.map(({ id, nome, icona }) => ({ id, nome, icona }));

/* ---------- Tracce ---------- */
TIPI_TRACCIA.speciali = [
  { id: "copertura", nome: "Copertura",         fine: "freccia" },
  { id: "blocco",    nome: "Blocco",            fine: "blocco" },
  { id: "ritorno",   nome: "Ritorno",           fine: "freccia" },
  { id: "rush",      nome: "Rush sul calcio",   fine: "freccia" },
  { id: "calcio",    nome: "Traiettoria palla", fine: "freccia", tratteggio: true },
];

/* Tracce pronte. Punti [verso l'interno, in avanti]: "avanti" è verso la
   squadra avversaria (in su per chi calcia, in giù per chi riceve). */
const TRACCE_SPECIALI = {
  attacco: [
    { nome: "Copertura dritta",   tipo: "copertura", punti: [[0, 22]] },
    { nome: "Stringi al centro",  tipo: "copertura", punti: [[0, 10], [5, 22]] },
    { nome: "Contenimento",       tipo: "copertura", punti: [[0, 10], [-3, 22]] },
    { nome: "Proteggi (blocco)",  tipo: "blocco",    punti: [[0, -1.5]] },
    { nome: "Calcio lungo",       tipo: "calcio",    punti: [[0, 50]], soloCalciatori: true },
    { nome: "Calcio corto",       tipo: "calcio",    punti: [[2, 11]], soloCalciatori: true },
  ],
  difesa: [
    { nome: "Ritorno centrale",   tipo: "ritorno",   punti: [[0, 15], [0, 35]], soloRitorno: true },
    { nome: "Ritorno a destra",   tipo: "ritorno",   punti: [[0, 10], [10, 22], [12, 35]], soloRitorno: true, assoluto: true },
    { nome: "Ritorno a sinistra", tipo: "ritorno",   punti: [[0, 10], [-10, 22], [-12, 35]], soloRitorno: true, assoluto: true },
    { nome: "Blocco",             tipo: "blocco",    punti: [[0, 2]] },
    { nome: "Rientra e blocca",   tipo: "blocco",    punti: [[0, -8]] },
    { nome: "Rush sul calcio",    tipo: "rush",      punti: [[2, 7]] },
  ],
};

function tracceSpecialiPer(schema, g) {
  const verso = versoSchema(schema);
  const ruolo = ruoloDi("speciali", g.etichetta);
  return TRACCE_SPECIALI[verso].filter((p) => {
    if (p.soloCalciatori) return ruolo === "st-calcio";
    if (p.soloRitorno) return ruolo === "st-ritorno";
    return true;
  });
}

// Da traccia pronta a traccia del giocatore (dentroCampo è in tracce.js)
function tracciaDaSpeciale(schema, g, preset) {
  const avanti = versoSchema(schema) === "attacco" ? 1 : -1;
  const dentro = preset.assoluto ? 1 : (g.x <= CENTRO + 0.5 ? 1 : -1);
  return {
    tipo: preset.tipo,
    nome: preset.nome,
    punti: preset.punti.map(([i, a]) => dentroCampo(g, i * dentro, a * avanti)),
  };
}

/* ---------- Pedine per «Crea da zero» ---------- */
const PEDINE_SPECIALI = [
  { nome: "Calciatori", sigle: ["K", "P", "H"] },
  { nome: "Protezione", sigle: ["LS", "G", "T", "W", "TE", "PP"] },
  { nome: "Copertura", sigle: ["L1", "L2", "L3", "L4", "L5", "R1", "R2", "R3", "R4", "R5", "GU"] },
  { nome: "Ritorno e blocchi", sigle: ["KR", "PR", "F1", "F2", "F3", "F4", "F5", "M1", "M2", "U1", "U2", "V1", "V2"] },
];

/* ---------- Formazioni pronte (11, 9 e 7 giocatori) ----------
   x in yarde dalla linea laterale sinistra (CENTRO = pallone),
   y in yarde dalla linea: negativo = chi calcia, positivo = chi riceve. */
(function () {
  const C = CENTRO;
  const riga = (sigle, xs, y) => sigle.map((s, i) => ({ etichetta: s, x: xs[i], y }));
  const lista = [];
  const aggiungi = (unita, formato, nome, giocatori) => lista.push({
    id: `st-${unita}-${formato}`, nome, formato, categoria: unita,
    giocatori: giocatori.map((g) => ({ ...g, forma: formaPedinaSpeciale(g.etichetta) })),
  });

  // KICKOFF: tutti allineati poco dietro la linea, il calciatore più indietro
  aggiungi("kickoff", "11", "Kickoff", [
    ...riga(["L5", "L4", "L3", "L2", "L1"], [4, 9, 14, 19, 23.5], -1),
    { etichetta: "K", x: C, y: -6 },
    ...riga(["R1", "R2", "R3", "R4", "R5"], [30, 34.5, 39.5, 44.5, 49.3], -1),
  ]);
  aggiungi("kickoff", "9", "Kickoff (9)", [
    ...riga(["L4", "L3", "L2", "L1"], [5, 11.5, 17.5, 23], -1),
    { etichetta: "K", x: C, y: -6 },
    ...riga(["R1", "R2", "R3", "R4"], [30.3, 36, 42, 48.3], -1),
  ]);
  aggiungi("kickoff", "7", "Kickoff (7)", [
    ...riga(["L3", "L2", "L1"], [7, 14.5, 22], -1),
    { etichetta: "K", x: C, y: -6 },
    ...riga(["R1", "R2", "R3"], [31.3, 38.8, 46.3], -1),
  ]);

  // KICK RETURN: front a 12 yarde, poi blocchi, ritornatore a 45
  aggiungi("kick-return", "11", "Kick return", [
    ...riga(["F1", "F2", "F3", "F4", "F5"], [8, 17, C, 36.3, 45.3], 12),
    ...riga(["M1", "M2", "M3"], [15, C, 38.3], 22),
    ...riga(["U1", "U2"], [21.5, 31.8], 34),
    { etichetta: "KR", x: C, y: 45 },
  ]);
  aggiungi("kick-return", "9", "Kick return (9)", [
    ...riga(["F1", "F2", "F3", "F4"], [10, 21, 32.3, 43.3], 12),
    ...riga(["M1", "M2"], [18, 35.3], 22),
    ...riga(["U1", "U2"], [21.5, 31.8], 34),
    { etichetta: "KR", x: C, y: 45 },
  ]);
  aggiungi("kick-return", "7", "Kick return (7)", [
    ...riga(["F1", "F2", "F3"], [12, C, 41.3], 12),
    { etichetta: "M1", x: C, y: 22 },
    ...riga(["U1", "U2"], [21.5, 31.8], 33),
    { etichetta: "KR", x: C, y: 45 },
  ]);

  // PUNT: spread punt (il punter sta a 11 yarde: è il fondo del campo visibile)
  const protezione11 = [
    { etichetta: "LS", x: C, y: -0.9 },
    ...riga(["G", "G"], [C - 2.2, C + 2.2], -0.9),
    ...riga(["T", "T"], [C - 4.4, C + 4.4], -0.9),
    ...riga(["W", "W"], [C - 5.6, C + 5.6], -2.2),
  ];
  aggiungi("punt", "11", "Spread punt", [
    ...protezione11,
    ...riga(["GU", "GU"], [4, 49.3], -0.9),
    { etichetta: "PP", x: C + 1, y: -5 },
    { etichetta: "P", x: C, y: -11 },
  ]);
  aggiungi("punt", "9", "Spread punt (9)", [
    { etichetta: "LS", x: C, y: -0.9 },
    ...riga(["G", "G"], [C - 2.2, C + 2.2], -0.9),
    ...riga(["W", "W"], [C - 3.6, C + 3.6], -2.2),
    ...riga(["GU", "GU"], [5, 48.3], -0.9),
    { etichetta: "PP", x: C + 1, y: -5 },
    { etichetta: "P", x: C, y: -10 },
  ]);
  aggiungi("punt", "7", "Spread punt (7)", [
    { etichetta: "LS", x: C, y: -0.9 },
    ...riga(["G", "G"], [C - 2.2, C + 2.2], -0.9),
    ...riga(["GU", "GU"], [7, 46.3], -0.9),
    { etichetta: "PP", x: C + 1, y: -5 },
    { etichetta: "P", x: C, y: -10 },
  ]);

  // PUNT RETURN: front sulla linea, vise sui gunner, ritornatore a 38
  aggiungi("punt-return", "11", "Punt return", [
    ...riga(["F1", "F2", "F3", "F4", "F5"], [19, 22.8, C, 30.5, 34.3], 1),
    ...riga(["V1", "V2", "V3", "V4"], [2.5, 6, 47.3, 50.8], 1),
    { etichetta: "U1", x: C, y: 14 },
    { etichetta: "PR", x: C, y: 38 },
  ]);
  aggiungi("punt-return", "9", "Punt return (9)", [
    ...riga(["F1", "F2", "F3", "F4", "F5"], [19, 22.8, C, 30.5, 34.3], 1),
    ...riga(["V1", "V2"], [5, 48.3], 1),
    { etichetta: "U1", x: C, y: 14 },
    { etichetta: "PR", x: C, y: 35 },
  ]);
  aggiungi("punt-return", "7", "Punt return (7)", [
    ...riga(["F1", "F2", "F3"], [22.8, C, 30.5], 1),
    ...riga(["V1", "V2"], [7, 46.3], 1),
    { etichetta: "U1", x: C, y: 13 },
    { etichetta: "PR", x: C, y: 32 },
  ]);

  // FIELD GOAL / PAT: linea stretta, holder a 7, calciatore a 9,5
  aggiungi("field-goal", "11", "Field goal / PAT", [
    ...protezione11.slice(0, 5),
    ...riga(["TE", "TE"], [C - 6.6, C + 6.6], -0.9),
    ...riga(["W", "W"], [C - 7.8, C + 7.8], -2.2),
    { etichetta: "H", x: C - 0.6, y: -7 },
    { etichetta: "K", x: C + 1.4, y: -9.5 },
  ]);
  aggiungi("field-goal", "9", "Field goal / PAT (9)", [
    ...protezione11.slice(0, 5),
    ...riga(["W", "W"], [C - 5.6, C + 5.6], -2.2),
    { etichetta: "H", x: C - 0.6, y: -7 },
    { etichetta: "K", x: C + 1.4, y: -9.5 },
  ]);
  aggiungi("field-goal", "7", "Field goal / PAT (7)", [
    ...protezione11.slice(0, 3),
    ...riga(["W", "W"], [C - 3.4, C + 3.4], -2.2),
    { etichetta: "H", x: C - 0.6, y: -7 },
    { etichetta: "K", x: C + 1.4, y: -9.5 },
  ]);

  // BLOCCO FG: quasi tutti sulla linea, due dietro per il fake
  const sullaLinea = (n) => Array.from({ length: n }, (_, i) => ({
    etichetta: "B" + (i + 1), x: +(C - (n - 1) * 1.25 + i * 2.5).toFixed(2), y: 1,
  }));
  aggiungi("fg-block", "11", "Blocco FG", [...sullaLinea(9), ...riga(["S1", "S2"], [16, 37.3], 9)]);
  aggiungi("fg-block", "9", "Blocco FG (9)", [...sullaLinea(7), ...riga(["S1", "S2"], [17, 36.3], 9)]);
  aggiungi("fg-block", "7", "Blocco FG (7)", [...sullaLinea(5), ...riga(["S1", "S2"], [18, 35.3], 9)]);

  // ONSIDE: giocatori raccolti dal lato del calcio
  aggiungi("onside", "11", "Onside kick", [
    ...riga(["L4", "L3", "L2", "L1"], [12, 17, 21, 24], -1),
    { etichetta: "K", x: C + 0.8, y: -4 },
    ...riga(["R1", "R2", "R3", "R4", "R5", "R6"], [29.3, 31.3, 33.3, 35.3, 37.8, 41], -1),
  ]);
  aggiungi("onside", "9", "Onside kick (9)", [
    ...riga(["L3", "L2", "L1"], [15, 20, 24], -1),
    { etichetta: "K", x: C + 0.8, y: -4 },
    ...riga(["R1", "R2", "R3", "R4", "R5"], [29.3, 31.3, 33.3, 35.8, 39], -1),
  ]);
  aggiungi("onside", "7", "Onside kick (7)", [
    ...riga(["L2", "L1"], [18, 23.5], -1),
    { etichetta: "K", x: C + 0.8, y: -4 },
    ...riga(["R1", "R2", "R3", "R4"], [29.3, 31.3, 33.8, 37], -1),
  ]);

  FORMAZIONI.speciali = lista;
})();

// Tipo di traccia quando si disegna a mano
function tipoSpecialeAMano(schema, g) {
  const ruolo = ruoloDi("speciali", g.etichetta);
  if (ruolo === "st-calcio") return "calcio";
  if (ruolo === "st-ritorno") return "ritorno";
  if (ruolo === "st-protezione") return "blocco";
  return versoSchema(schema) === "attacco" ? "copertura" : "blocco";
}
