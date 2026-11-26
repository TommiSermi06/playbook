/* ==========================================================================
   LIBRERIA: FORMAZIONI E SCHEMI PRONTI
   --------------------------------------------------------------------------
   Il pulsante 📚 apre una raccolta di schemi classici già disegnati
   (Four Verticals, Mesh, Inside Zone, Cover 3…) e di formazioni pronte.
   Con un clic si aggiungono al playbook aperto, adattati al suo formato:
   - 9 giocatori: senza i tackle; 7: senza i tackle e due ricevitori;
   - flag: senza linea, e niente blocchi.
   Ogni schema arriva con la categoria (corsa, passaggio, zona…) e una
   nota che spiega l'idea; poi si modifica come tutti gli altri.
   ========================================================================== */

/* Tutto il contenuto della libreria sta in un blocco privato: le piccole
   funzioni d'aiuto (R, I, A, p…) non si scontrano con quelle degli altri file. */
const { LIB_FORMAZIONI, LIB_SCHEMI } = (() => {
/* ---------- Formazioni d'attacco (11 giocatori; per 9, 7 e flag si toglie qualcuno) ---------- */
const C_ = CENTRO;
const linea11 = () => [
  { etichetta: "T", x: C_ - 4.8, y: -0.9 }, { etichetta: "G", x: C_ - 2.4, y: -0.9 },
  { etichetta: "C", x: C_, y: -0.9 }, { etichetta: "G", x: C_ + 2.4, y: -0.9 }, { etichetta: "T", x: C_ + 4.8, y: -0.9 },
];
const p = (etichetta, x, y) => ({ etichetta, x, y });

const formazioni = {
  attacco: [
    { id: "2x2", nome: "Shotgun 2x2", descr: "Due ricevitori per lato, QB in shotgun e RB accanto.",
      giocatori: [...linea11(), p("X", 4, -0.9), p("H", 12.5, -2), p("Y", 40.8, -2), p("Z", 49.3, -0.9), p("QB", C_, -5), p("RB", C_ + 2.5, -5)],
      via9: ["T", "T"], via7: ["T", "T", "H", "Y"], flag: ["C", "X", "H", "Z", "QB"] },
    { id: "trips", nome: "Trips destra", descr: "Tre ricevitori a destra, X da solo a sinistra.",
      giocatori: [...linea11(), p("X", 4, -0.9), p("H", 33.5, -2), p("Y", 40.3, -2), p("Z", 49.3, -0.9), p("QB", C_, -5), p("RB", C_ - 2.5, -5)],
      via9: ["T", "T"], via7: ["T", "T", "X", "RB"], flag: ["C", "H", "Y", "Z", "QB"] },
    { id: "bunch", nome: "Bunch destra", descr: "Tre ricevitori stretti a grappolo: difficili da marcare a uomo.",
      giocatori: [...linea11(), p("X", 4, -0.9), p("Y", C_ + 9, -0.9), p("H", C_ + 10.6, -2.4), p("Z", C_ + 7.4, -2.4), p("QB", C_, -5), p("RB", C_ - 2.5, -5)],
      via9: ["T", "T"], via7: ["T", "T", "X", "RB"], flag: ["C", "H", "Y", "Z", "QB"] },
    { id: "i", nome: "I-Form", descr: "QB sotto il centro, FB e RB in fila: l'attacco di potenza.",
      giocatori: [...linea11(), p("Y", C_ + 7.2, -0.9), p("X", 4, -0.9), p("Z", 47, -2), p("QB", C_, -2.2), p("FB", C_, -5), p("RB", C_, -7.6)],
      via9: ["T", "T"], via7: ["T", "T", "Y", "Z"], flag: null },
    { id: "empty", nome: "Empty 3x2", descr: "Nessuno nel backfield: cinque ricevitori.",
      giocatori: [...linea11(), p("X", 4, -0.9), p("H", 11, -2), p("A", 34.5, -2), p("Y", 41.5, -2), p("Z", 49.3, -0.9), p("QB", C_, -5)],
      via9: ["T", "T"], via7: ["T", "T", "H", "A"], flag: ["C", "X", "Y", "Z", "QB"] },
    { id: "pistol", nome: "Pistol", descr: "QB a 4 yarde, RB dietro di lui, TE a destra.",
      giocatori: [...linea11(), p("Y", C_ + 7.2, -0.9), p("X", 4, -0.9), p("H", 13, -2), p("Z", 49.3, -0.9), p("QB", C_, -4), p("RB", C_, -7)],
      via9: ["T", "T"], via7: ["T", "T", "H", "Y"], flag: ["C", "X", "Z", "RB", "QB"] },
  ],
  // In difesa le posizioni cambiano col formato: ognuna scritta per intero
  difesa: [
    { id: "43", nome: "4-3", descr: "Quattro uomini di linea, tre linebacker: la difesa base.",
      "11": [p("E", 19.5, 1), p("T", 24.4, 1), p("T", 28.9, 1), p("E", 33.8, 1), p("W", 19, 5), p("M", C_, 5.5), p("S", 34.3, 5), p("C", 5, 6), p("C", 48.3, 6), p("FS", 20, 12), p("SS", 33.3, 12)],
      "9": [p("E", 21, 1), p("N", C_, 1), p("E", 32.3, 1), p("W", 19, 5), p("M", C_, 5.5), p("S", 34.3, 5), p("C", 6, 6), p("C", 47.3, 6), p("FS", C_, 12)],
      "7": [p("E", 22, 1), p("N", C_, 1), p("E", 31.3, 1), p("M", C_, 5), p("C", 8, 6), p("C", 45.3, 6), p("FS", C_, 12)],
      flag: [p("R", C_, 7), p("C", 8, 6), p("C", 45.3, 6), p("FS", 18, 12), p("SS", 35.3, 12)] },
    { id: "nickel", nome: "Nickel 4-2-5", descr: "Un difensore in più sulle secondarie contro gli attacchi spread.",
      "11": [p("E", 19.5, 1), p("T", 24.4, 1), p("T", 28.9, 1), p("E", 33.8, 1), p("W", 22.5, 5), p("M", 30.8, 5), p("NB", 40, 4), p("C", 5, 6), p("C", 48.3, 6), p("FS", 20, 12), p("SS", 33.3, 12)],
      "9": [p("E", 21, 1), p("N", C_, 1), p("E", 32.3, 1), p("W", 22.5, 5), p("M", 30.8, 5), p("NB", 40, 4), p("C", 6, 6), p("C", 47.3, 6), p("FS", C_, 12)],
      "7": null, flag: null },
    { id: "34", nome: "3-4", descr: "Tre uomini di linea, quattro linebacker: tanti modi di mandare il blitz.",
      "11": [p("E", 21.6, 1), p("N", C_, 1), p("E", 31.7, 1), p("W", 16.5, 2), p("M", 23.5, 5), p("B", 29.8, 5), p("S", 36.8, 2), p("C", 5, 6), p("C", 48.3, 6), p("FS", 20, 12), p("SS", 33.3, 12)],
      "9": [p("E", 21.6, 1), p("N", C_, 1), p("E", 31.7, 1), p("W", 17, 2), p("M", C_, 5), p("S", 36.3, 2), p("C", 6, 6), p("C", 47.3, 6), p("FS", C_, 12)],
      "7": null, flag: null },
  ],
};

/* ---------- Come si scrivono le tracce degli schemi ----------
   R(n)                route dell'albero (1-Flat … 9-Fly)
   I(nome, tipo, pti)  punti [verso l'interno, in avanti]: giusti a destra e a sinistra
   A(nome, tipo, pti)  punti [verso destra, in avanti]: per corse e giochi da un lato
   Q(i)                movimento del QB (0 drop 3, 1 drop 5, 2 drop 7)
   Z(nome, x, y) / U(nome, dx, dy) / B()   difesa: zona verso un punto, uomo, blitz
   Una regola può essere una funzione (g, tutti) → traccia, per distinguere i lati. */
const R = (n) => (g) => tracciaDaRoute(g, ALBERO_ROUTE[n - 1]);
const I = (nome, tipo, punti) => (g) => ({ tipo, nome, punti: punti.map(([i, a]) => dentroCampo(g, i * versoInterno(g), a)) });
const A = (nome, tipo, punti) => (g) => ({ tipo, nome, punti: punti.map(([dx, dy]) => dentroCampo(g, dx, dy)) });
const Q = (i) => (g) => tracciaDaQb(g, MOVIMENTI_QB[i]);
const Z = (nome, x, y) => (g) => ({ tipo: "zona", nome, punti: [dentroCampo(g, x - g.x, y - g.y)] });
const U = (nome, dx, dy) => (g) => ({ tipo: "uomo", nome, punti: [dentroCampo(g, dx, dy)] });
const B = () => (g) => ({ tipo: "blitz", nome: "Blitz", punti: [dentroCampo(g, (C_ - g.x) * 0.3, -3.5 - g.y)] });
const RUSH = () => (g) => ({ tipo: "blitz", nome: "Rush", punti: [dentroCampo(g, (C_ - g.x) * 0.35, -3.5 - g.y)] });
const lato = (sinistra, destra) => (g, tutti) => (g.x < C_ ? sinistra : destra)(g, tutti);
const PASS_PRO = A("Pass pro", "blocco", [[0, -1.2]]);
const STALK = I("Stalk", "blocco", [[0, 3]]);
const linea = (regola) => ({ T: regola, G: regola, C: regola });
const ruolo = (sigla, regola) => ({ [sigla]: regola });

const schemi = {
  attacco: [
    { nome: "Four Verticals", formazione: "2x2", categoria: "passaggio", tag: ["profondo"],
      note: "Quattro verticali: gli esterni corrono la fly, gli slot la seam. Il QB legge la safety: se resta in mezzo, lancia sulla seam dal lato opposto.",
      tracce: { ...linea(PASS_PRO), X: R(9), Z: R(9), H: I("Seam", "route", [[0, 6], [1.5, 20]]), Y: I("Seam", "route", [[0, 6], [1.5, 20]]), RB: A("Check flat", "route", [[3, 0.5], [6.5, 2]]), QB: Q(1) } },
    { nome: "Mesh", formazione: "2x2", categoria: "passaggio", tag: ["quick"],
      note: "Due shallow che si incrociano a 2 e 4 yarde: contro l'uomo uno dei due si libera nell'incrocio. Corner dallo slot e sit in mezzo.",
      tracce: { ...linea(PASS_PRO), X: I("Shallow", "route", [[1, 2], [19, 3]]), Z: I("Shallow", "route", [[1, 4], [19, 5]]), H: R(7), Y: I("Sit", "route", [[0, 7], [0.6, 6]]), RB: A("Flat", "route", [[3, 0.5], [6.5, 2]]), QB: Q(0) } },
    { nome: "Smash", formazione: "2x2", categoria: "passaggio", tag: ["quick"],
      note: "Hitch corto fuori e corner dallo slot: mette in difficoltà il cornerback in Cover 2 (sotto o sopra?).",
      tracce: { ...linea(PASS_PRO), X: I("Hitch", "route", [[0, 5], [0.6, 4.2]]), Z: I("Hitch", "route", [[0, 5], [0.6, 4.2]]), H: R(7), Y: R(7), RB: A("Pass pro", "blocco", [[-1.5, 1.5]]), QB: Q(0) } },
    { nome: "Slant-Flat", formazione: "2x2", categoria: "passaggio", tag: ["quick"],
      note: "Slant fuori e flat dallo slot, sui due lati: lancio veloce, il QB legge il difensore più esterno.",
      tracce: { ...linea(PASS_PRO), X: R(2), Z: R(2), H: R(1), Y: R(1), RB: A("Pass pro", "blocco", [[-1.5, 1.5]]), QB: Q(0) } },
    { nome: "Curl-Flat", formazione: "2x2", categoria: "passaggio", tag: ["medio"],
      note: "Curl a 12 yarde fuori e flat dallo slot: il linebacker che copre il curl lascia libero il flat (e viceversa).",
      tracce: { ...linea(PASS_PRO), X: R(4), Z: R(4), H: R(1), Y: R(1), RB: A("Check", "route", [[2.5, 0.5], [5, 2.5]]), QB: Q(1) } },
    { nome: "Stick", formazione: "trips", categoria: "passaggio", tag: ["quick"],
      note: "Dal trips: go fuori, stick a 6 yarde e flat dall'interno. Lettura flat → stick, lancio rapido.",
      tracce: { ...linea(PASS_PRO), Z: R(9), Y: I("Stick", "route", [[0, 6], [-1.2, 6]]), H: I("Flat", "route", [[-3, 1], [-8, 2]]), X: R(2), RB: A("Pass pro", "blocco", [[1.5, 1.5]]), QB: Q(0) } },
    { nome: "Dagger", formazione: "2x2", categoria: "passaggio", tag: ["medio", "profondo"],
      note: "Seam dello slot che porta via la safety e dig a 12 yarde dietro di lei: il lancio va sul dig.",
      tracce: { ...linea(PASS_PRO), H: I("Seam", "route", [[0, 6], [1.5, 20]]), X: I("Dig", "route", [[0, 12], [9, 12]]), Z: R(9), Y: I("Out corto", "route", [[0, 5], [-5, 5]]), RB: A("Check", "route", [[-3, 0.5], [-6.5, 2]]), QB: Q(1) } },
    { nome: "Y-Cross", formazione: "trips", categoria: "passaggio", tag: ["medio"],
      note: "Il Y attraversa tutto il campo a 15 yarde, il post pulisce la zona e il flat tiene basso il linebacker.",
      tracce: { ...linea(PASS_PRO), Y: I("Cross profondo", "route", [[0, 6], [20, 15]]), Z: R(8), H: I("Flat", "route", [[-3, 1], [-8, 2]]), X: I("Dig", "route", [[0, 12], [8, 12]]), RB: A("Check", "route", [[-2.5, 0.5], [-5, 2.5]]), QB: Q(1) } },
    { nome: "Inside Zone", formazione: "2x2", categoria: "corsa",
      note: "Tutta la linea fa il passo di zona a sinistra; il RB punta il gap A e taglia dove si apre. I ricevitori bloccano il loro uomo.",
      tracce: { ...linea(A("Zona", "blocco", [[-1.2, 1.4]])), RB: A("Inside zone", "route", [[-2.4, 1.5], [-3.2, 8]]), QB: A("Consegna", "qb", [[1.5, -0.6]]), X: STALK, Z: STALK, H: I("Blocco", "blocco", [[0.8, 2.5]]), Y: I("Blocco", "blocco", [[0.8, 2.5]]) } },
    { nome: "Outside Zone", formazione: "pistol", categoria: "corsa",
      note: "Stretch verso sinistra: la linea scivola di lato, il RB corre largo e legge il blocco del tackle per tagliare dentro o andare fuori.",
      tracce: { ...linea(A("Zona larga", "blocco", [[-2, 1]])), Y: A("Cut-off", "blocco", [[-1.5, 1.5]]), RB: A("Stretch", "route", [[-5, 1.5], [-9.5, 5]]), QB: A("Consegna", "qb", [[1, -1]]), X: STALK, Z: STALK, H: STALK } },
    { nome: "Power", formazione: "i", categoria: "corsa",
      note: "A destra: blocchi a scendere, la guardia di sinistra tira e entra nel buco, il FB fa il kick-out sull'esterno.",
      tracce: {
        T: lato(A("Hinge", "blocco", [[-0.6, 0.8]]), A("Blocco giù", "blocco", [[-1, 1.3]])),
        G: lato(A("Pull", "blocco", [[0.8, -1], [4.5, -1], [5.5, 1]]), A("Blocco giù", "blocco", [[-1, 1.3]])),
        C: A("Blocco giù", "blocco", [[-1, 1.3]]), Y: A("Blocco giù", "blocco", [[-1, 1.3]]),
        FB: A("Kick-out", "blocco", [[4, 0.4], [6.5, 3.3]]), RB: A("Power", "route", [[0, 2], [3.5, 5.5], [4, 10]]),
        QB: A("Consegna", "qb", [[1.5, -1]]), X: STALK, Z: STALK } },
    { nome: "Bubble screen", formazione: "trips", categoria: "screen", tag: ["quick"],
      note: "Il ricevitore interno arretra e va verso la linea laterale, gli altri due bloccano: lancio subito, 3 contro 2 fuori.",
      tracce: { ...linea(A("Blocco", "blocco", [[0, 1.3]])), H: A("Bubble", "route", [[2.5, -1.2], [6, -0.6]]), Y: STALK, Z: STALK, X: R(2), RB: A("Blocco", "blocco", [[-1.5, 1.2]]), QB: A("Lancio veloce", "qb", [[0, -0.8]]) } },
    { nome: "RB screen", formazione: "2x2", categoria: "screen",
      note: "La linea lascia entrare il rush e poi esce davanti al RB, che riceve dietro la linea a destra.",
      tracce: { T: lato(PASS_PRO, A("Rilascio", "blocco", [[0.5, -0.5], [4, 0.6]])), G: lato(PASS_PRO, A("Rilascio", "blocco", [[0.5, -0.5], [4.5, 0.3]])), C: A("Rilascio", "blocco", [[0.5, -0.5], [5, 0]]),
        RB: A("Screen", "route", [[3.5, -1.5], [8, -0.8]]), X: R(9), Z: R(9), H: R(9), Y: STALK, QB: Q(1) } },
    { nome: "PA Boot", formazione: "i", categoria: "play-action", tag: ["misdirection"],
      note: "Finta di corsa a destra, il QB esce a sinistra: flat del FB, drag del TE che attraversa, comeback e post.",
      tracce: { ...linea(A("Finta corsa", "blocco", [[1, 1.2]])), QB: A("Boot", "qb", [[1.5, -1.5], [-3, -3], [-8, -2.5]]), RB: A("Finta", "opzione", [[2, 1], [3.5, 3]]), FB: A("Flat", "route", [[-3, 0], [-8, 1.5]]), Y: I("Drag", "route", [[0, 2], [16, 6]]), X: I("Comeback", "route", [[0, 13], [-3, 11]]), Z: R(8) } },
    { nome: "RPO Zone-Glance", formazione: "2x2", categoria: "rpo",
      note: "Inside zone con lettura: se il linebacker scende sulla corsa, il QB tiene la palla e lancia il glance del ricevitore esterno.",
      tracce: { ...linea(A("Zona", "blocco", [[-1.2, 1.4]])), RB: A("Inside zone", "route", [[-2.4, 1.5], [-3.2, 8]]), QB: A("Lettura", "opzione", [[0.8, -0.4]]), X: I("Glance", "route", [[0, 5], [3, 11]]), H: A("Bubble", "route", [[-2.5, -1.2], [-6, -0.6]]), Y: STALK, Z: STALK } },
  ],
  difesa: [
    { nome: "Cover 3", formazione: "43", categoria: "zona",
      note: "Tre zone profonde (i due cornerback e la free safety), quattro sotto. Solida contro i lanci lunghi.",
      tracce: { E: RUSH(), T: RUSH(), N: RUSH(), R: RUSH(), C: lato(Z("Terzo profondo", 9, 17), Z("Terzo profondo", 44.3, 17)), FS: Z("Terzo centrale", C_, 18),
        SS: Z("Curl/flat", 40, 7), W: Z("Curl/flat", 13, 7), M: Z("Hook", 21, 8), S: Z("Hook", 32, 8), NB: Z("Curl/flat", 40, 7) } },
    { nome: "Cover 2", formazione: "43", categoria: "zona",
      note: "Due safety dividono il fondo a metà, i cornerback tengono i flat, i linebacker le zone in mezzo.",
      tracce: { E: RUSH(), T: RUSH(), N: RUSH(), R: RUSH(), C: lato(Z("Flat", 8, 5), Z("Flat", 45.3, 5)),
        FS: (g, tutti) => (tutti.some((x) => x.etichetta === "SS") ? Z("Metà profonda", 13.3, 17) : Z("Centro profondo", C_, 18))(g),
        SS: Z("Metà profonda", 40, 17), W: Z("Hook/curl", 15, 8), M: Z("Centro", C_, 9), S: Z("Hook/curl", 38, 8) } },
    { nome: "Tampa 2", formazione: "43", categoria: "zona",
      note: "Come la Cover 2, ma il middle linebacker corre in profondità a chiudere il buco in mezzo alle safety.",
      tracce: { E: RUSH(), T: RUSH(), N: RUSH(), R: RUSH(), C: lato(Z("Flat", 8, 5), Z("Flat", 45.3, 5)), FS: Z("Metà profonda", 13.3, 17), SS: Z("Metà profonda", 40, 17),
        W: Z("Hook/curl", 15, 8), M: Z("Centro profondo", C_, 15), S: Z("Hook/curl", 38, 8) } },
    { nome: "Cover 1", formazione: "nickel", categoria: "uomo",
      note: "Tutti a uomo sul proprio ricevitore, la free safety aiuta in profondità e un linebacker resta in mezzo (rat).",
      tracce: { E: RUSH(), T: RUSH(), N: RUSH(), R: RUSH(), C: U("Uomo", 0, 8), NB: U("Uomo", 0, 7), SS: U("Uomo sullo slot", 4, 2),
        FS: Z("Centro profondo", C_, 18), M: Z("Rat", C_, 6), W: U("Uomo sul RB", 3, -2), S: U("Uomo sul TE", -1, 3) } },
    { nome: "Cover 0 blitz", formazione: "nickel", categoria: "blitz",
      note: "Nessun aiuto in profondità: tutti a uomo e linebacker in blitz. Il QB deve lanciare subito.",
      tracce: { E: RUSH(), T: RUSH(), N: RUSH(), R: RUSH(), W: B(), M: B(), S: B(), B: B(), C: U("Uomo stretto", 0, 6), NB: U("Uomo stretto", 0, 5),
        SS: U("Uomo", 4, -6), FS: U("Uomo", -6, -6) } },
    { nome: "Cover 4", formazione: "43", categoria: "zona",
      note: "Quarters: quattro difensori in profondità, ognuno con un quarto di campo. Le safety aiutano anche sulla corsa.",
      tracce: { E: RUSH(), T: RUSH(), N: RUSH(), R: RUSH(), C: lato(Z("Quarto profondo", 8, 17), Z("Quarto profondo", 45.3, 17)),
        FS: Z("Quarto profondo", 19, 16), SS: Z("Quarto profondo", 34.3, 16), W: Z("Curl/flat", 12, 6), M: Z("Hook", C_, 8), S: Z("Curl/flat", 41, 6) } },
    { nome: "Fire zone", formazione: "43", categoria: "blitz",
      note: "Zone blitz: due linebacker in blitz, l'end di destra torna indietro nel flat. Tre zone profonde e tre sotto.",
      tracce: { E: lato(RUSH(), Z("Drop nel flat", 42, 6)), T: RUSH(), N: RUSH(), R: RUSH(), W: B(), M: B(),
        C: lato(Z("Terzo profondo", 9, 17), Z("Terzo profondo", 44.3, 17)), FS: Z("Terzo centrale", C_, 18), S: Z("Hook", 30, 8), SS: Z("Curl/flat", 14, 7) } },
  ],
};

  return { LIB_FORMAZIONI: formazioni, LIB_SCHEMI: schemi };
})();

// I giocatori di una formazione della libreria per un formato (null se non esiste)
function giocatoriLibreria(lato, f, formato) {
  let lista;
  if (lato === "difesa") lista = f[formato];
  else if (formato === "flag") lista = f.flag ? f.giocatori.filter((g) => f.flag.includes(g.etichetta)) : null;
  else {
    const via = formato === "9" ? [...f.via9] : formato === "7" ? [...f.via7] : [];
    lista = f.giocatori.filter((g) => {
      const i = via.indexOf(g.etichetta);
      if (i < 0) return true;
      via.splice(i, 1); // toglie una volta per sigla (es. tutti e due i T)
      return false;
    });
  }
  return lista ? lista.map((g, i) => ({ id: "g" + i, ...g, forma: formaPedina(lato, g.etichetta) })) : null;
}
const nomeLibreria = (f, formato) => (formato === "9" || formato === "7" ? `${f.nome} (${formato})` : f.nome);

/* Costruisce i giocatori (con le tracce) di uno schema della libreria per un formato.
   null se la sua formazione non esiste in quel formato. */
function costruisciDallaLibreria(lato, schema, formato) {
  const f = LIB_FORMAZIONI[lato].find((x) => x.id === schema.formazione);
  const giocatori = giocatoriLibreria(lato, f, formato);
  if (!giocatori) return null;
  return conCampoDi({ lato }, () => {
    for (const g of giocatori) {
      const regola = schema.tracce[g.etichetta];
      if (!regola) continue;
      const t = regola(g, giocatori);
      if (!t || !t.punti || !t.punti.length) continue;
      if (formato === "flag" && t.tipo === "blocco") continue; // nel flag non si blocca
      g.traccia = t;
    }
    return { giocatori, formazione: f };
  });
}

/* ==========================================================================
   FINESTRA «LIBRERIA»
   ========================================================================== */
const Libreria = { scheda: "schemi", lato: "attacco", categoria: "tutte", scelti: new Set() };

function apriLibreria() {
  if (!playbookCorrente) return;
  if (typeof modificheVietate === "function" && modificheVietate()) return;
  if (typeof chiudiMenuTracce === "function") chiudiMenuTracce();
  salvaInSospeso();
  Libreria.lato = latoSelezionato === "difesa" ? "difesa" : "attacco";
  Libreria.categoria = "tutte";
  Libreria.scelti.clear();
  $("#velo").hidden = false;
  $("#foglio-libreria").hidden = false;
  requestAnimationFrame(() => {
    $("#velo").classList.add("visibile");
    $("#foglio-libreria").classList.add("visibile");
    disegnaLibreria();
  });
}
function chiudiLibreria() {
  $("#velo").classList.remove("visibile");
  $("#foglio-libreria").classList.remove("visibile");
  setTimeout(() => { $("#velo").hidden = true; $("#foglio-libreria").hidden = true; }, 220);
}

function disegnaLibreria() {
  const formato = playbookCorrente.formato || "11";
  document.querySelectorAll("#libreria-schede .segmento").forEach((b) => b.classList.toggle("attivo", b.dataset.valore === Libreria.scheda));
  document.querySelectorAll("#libreria-lati .segmento").forEach((b) => b.classList.toggle("attivo", b.dataset.valore === Libreria.lato));
  $("#libreria-schede").style.setProperty("--indice", Libreria.scheda === "schemi" ? 0 : 1);
  $("#libreria-lati").style.setProperty("--indice", Libreria.lato === "attacco" ? 0 : 1);
  $("#libreria-sottotitolo").textContent = `Adattati al formato del playbook: ${FORMATI[formato].nome}. Si modificano come tutti gli altri.`;

  // Filtri per categoria (solo per gli schemi)
  const filtri = $("#libreria-filtri");
  filtri.innerHTML = "";
  filtri.hidden = Libreria.scheda !== "schemi";
  if (Libreria.scheda === "schemi") {
    const usate = CATEGORIE[Libreria.lato].filter((c) => LIB_SCHEMI[Libreria.lato].some((s) => s.categoria === c.id));
    for (const c of [{ id: "tutte", nome: "Tutti", icona: "" }, ...usate]) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "filtro-categoria" + (Libreria.categoria === c.id ? " attivo" : "");
      b.textContent = c.icona ? `${c.icona} ${c.nome}` : c.nome;
      b.addEventListener("click", () => { Libreria.categoria = c.id; disegnaLibreria(); });
      filtri.appendChild(b);
    }
  }

  const griglia = $("#libreria-griglia");
  griglia.innerHTML = "";
  const voci = Libreria.scheda === "schemi"
    ? LIB_SCHEMI[Libreria.lato].filter((s) => Libreria.categoria === "tutte" || s.categoria === Libreria.categoria)
    : LIB_FORMAZIONI[Libreria.lato];
  let disponibili = 0;
  for (const voce of voci) {
    const chiave = `${Libreria.scheda}|${Libreria.lato}|${voce.nome}`;
    const costruito = Libreria.scheda === "schemi"
      ? costruisciDallaLibreria(Libreria.lato, voce, formato)
      : (() => { const g = giocatoriLibreria(Libreria.lato, voce, formato); return g ? { giocatori: g, formazione: voce } : null; })();
    const carta = document.createElement("button");
    carta.type = "button";
    carta.className = "carta-libreria" + (Libreria.scelti.has(chiave) ? " scelta" : "") + (costruito ? "" : " non-disponibile");
    carta.disabled = !costruito;
    const anteprima = document.createElement("span");
    anteprima.className = "anteprima-libreria";
    if (costruito) {
      const finto = { id: "lib", lato: Libreria.lato, formato, giocatori: costruito.giocatori };
      anteprima.appendChild(miniSchema(finto, "campo-libreria", 1.55));
      disponibili++;
    } else {
      anteprima.textContent = "Non disponibile in questo formato";
    }
    const testi = document.createElement("span");
    testi.className = "testi-libreria";
    const cat = Libreria.scheda === "schemi" ? (CATEGORIE[Libreria.lato].find((c) => c.id === voce.categoria) || null) : null;
    const sotto = Libreria.scheda === "schemi"
      ? `${cat ? cat.icona + " " + cat.nome + " · " : ""}${nomeLibreria(LIB_FORMAZIONI[Libreria.lato].find((f) => f.id === voce.formazione), formato)}`
      : voce.descr;
    testi.innerHTML = `<strong></strong><span class="sotto-libreria"></span>${Libreria.scheda === "schemi" ? '<span class="nota-libreria"></span>' : ""}`;
    testi.querySelector("strong").textContent = Libreria.scheda === "schemi" ? voce.nome : nomeLibreria(voce, formato);
    testi.querySelector(".sotto-libreria").textContent = sotto;
    if (Libreria.scheda === "schemi") testi.querySelector(".nota-libreria").textContent = voce.note;
    const spunta = document.createElement("span");
    spunta.className = "spunta-libreria";
    spunta.textContent = "✓";
    carta.append(anteprima, testi, spunta);
    carta.addEventListener("click", () => {
      if (Libreria.scelti.has(chiave)) Libreria.scelti.delete(chiave); else Libreria.scelti.add(chiave);
      carta.classList.toggle("scelta", Libreria.scelti.has(chiave));
      aggiornaPulsanteLibreria();
    });
    griglia.appendChild(carta);
  }
  if (!disponibili) griglia.appendChild(Object.assign(document.createElement("p"), { className: "libreria-vuota", textContent: "Niente di disponibile per questo formato." }));
  aggiornaPulsanteLibreria();
}

function aggiornaPulsanteLibreria() {
  const n = Libreria.scelti.size;
  const b = $("#btn-libreria-aggiungi");
  b.disabled = !n;
  const schemi = [...Libreria.scelti].filter((k) => k.startsWith("schemi|")).length;
  const formazioni = n - schemi;
  b.textContent = !n ? "Scegli cosa aggiungere"
    : [schemi ? `${schemi} ${schemi === 1 ? "schema" : "schemi"}` : "", formazioni ? `${formazioni} ${formazioni === 1 ? "formazione" : "formazioni"}` : ""]
      .filter(Boolean).join(" e ").replace(/^/, "Aggiungi ");
}

/* La formazione di uno schema della libreria: quella pronta o una delle
   tue con lo stesso nome, altrimenti una nuova tra «Le tue formazioni». */
function formazionePerLibreria(lato, f, formato, giocatori) {
  const nome = nomeLibreria(f, formato);
  const n = nome.toLocaleLowerCase("it");
  const pronta = formazioniPronte(lato, formato).find((x) => x.nome.toLocaleLowerCase("it") === n);
  if (pronta) return { id: pronta.id, nuova: null };
  const mia = FormazioniMie.perLato(lato, formato).find((x) => x.nome.toLocaleLowerCase("it") === n);
  if (mia) return { id: mia.id, nuova: null };
  const creata = FormazioniMie.crea(nome, lato, formato, giocatori);
  return { id: creata.id, nuova: creata };
}

function aggiungiDallaLibreria() {
  const formato = playbookCorrente.formato || "11";
  const aggiunti = [];
  const formazioniNuove = [];
  const nomiUsati = new Set(schemiDelPlaybook().map((s) => (s.nome || "").toLocaleLowerCase("it")));
  for (const chiave of Libreria.scelti) {
    const [scheda, lato, nome] = chiave.split("|");
    if (scheda === "formazioni") {
      const f = LIB_FORMAZIONI[lato].find((x) => x.nome === nome);
      const giocatori = giocatoriLibreria(lato, f, formato);
      if (!giocatori) continue;
      const esito = formazionePerLibreria(lato, f, formato, giocatori);
      if (esito.nuova) formazioniNuove.push(esito.nuova);
      continue;
    }
    const voce = LIB_SCHEMI[lato].find((s) => s.nome === nome);
    const costruito = costruisciDallaLibreria(lato, voce, formato);
    if (!costruito) continue;
    const form = formazionePerLibreria(lato, costruito.formazione, formato, costruito.giocatori);
    if (form.nuova) formazioniNuove.push(form.nuova);
    const schema = Dati.crea(lato);
    // Nome libero nel playbook (se c'è già, «Mesh 2»…)
    let nomeSchema = voce.nome, k = 2;
    while (nomiUsati.has(nomeSchema.toLocaleLowerCase("it"))) nomeSchema = `${voce.nome} ${k++}`;
    nomiUsati.add(nomeSchema.toLocaleLowerCase("it"));
    Object.assign(schema, {
      nome: nomeSchema, formazione: form.id, giocatori: costruito.giocatori, categoria: voce.categoria,
      note: voce.note, ...(voce.tag ? { tag: [...voce.tag] } : {}),
    });
    aggiunti.push(schema);
  }
  if (aggiunti.length) Dati.aggiornaMolti(aggiunti);
  chiudiLibreria();
  if (aggiunti.length) {
    scegliLato(aggiunti[0].lato);
    apriEditor(aggiunti[0].id);
  } else if (schemaCorrente) ridisegna();
  const parti = [
    aggiunti.length ? `${aggiunti.length} ${aggiunti.length === 1 ? "schema aggiunto" : "schemi aggiunti"}` : "",
    formazioniNuove.length ? `${formazioniNuove.length} ${formazioniNuove.length === 1 ? "formazione nuova" : "formazioni nuove"} tra le tue` : "",
  ].filter(Boolean);
  mostraAvviso(parti.length ? parti.join(" e ") : "Era già tutto nel playbook", parti.length ? () => {
    for (const s of aggiunti) Dati.elimina(s.id);
    for (const f of formazioniNuove) FormazioniMie.elimina(f.id);
    if (schemaCorrente && aggiunti.some((s) => s.id === schemaCorrente.id)) chiudiEditor(); else if (schemaCorrente) ridisegna();
    mostraElenco();
  } : null);
}

/* ---------- Eventi della finestra ---------- */
$("#btn-libreria").addEventListener("click", apriLibreria);
$("#btn-libreria-chiudi").addEventListener("click", chiudiLibreria);
$("#btn-libreria-aggiungi").addEventListener("click", aggiungiDallaLibreria);
document.querySelectorAll("#libreria-schede .segmento").forEach((b) => b.addEventListener("click", () => {
  Libreria.scheda = b.dataset.valore; Libreria.categoria = "tutte"; disegnaLibreria();
}));
document.querySelectorAll("#libreria-lati .segmento").forEach((b) => b.addEventListener("click", () => {
  Libreria.lato = b.dataset.valore; Libreria.categoria = "tutte"; disegnaLibreria();
}));
