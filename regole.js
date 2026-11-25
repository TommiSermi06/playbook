/* ==========================================================================
   FORMATI E REGOLE DEL GIOCO
   --------------------------------------------------------------------------
   Il formato decide quanti giocatori ci sono in campo e quali sono
   obbligatori in attacco:
   - 11 (senior):   11 giocatori, almeno 1 C, 2 G, 2 T
   - 9 e 7 (giovanili): almeno 1 C e 2 G
   - Flag 5:        5 giocatori, 1 C e niente G né T
                    (nel flag il centro corre le route come un ricevitore)
   In tutti i formati il centro è uno solo.
   ========================================================================== */

const FORMATI = {
  "11":   { id: "11",   nome: "11 giocatori", breve: "11",     giocatori: 11, minimi: { C: 1, G: 2, T: 2 }, flag: false },
  "9":    { id: "9",    nome: "9 giocatori",  breve: "9",      giocatori: 9,  minimi: { C: 1, G: 2 },       flag: false },
  "7":    { id: "7",    nome: "7 giocatori",  breve: "7",      giocatori: 7,  minimi: { C: 1, G: 2 },       flag: false },
  "flag": { id: "flag", nome: "Flag 5",       breve: "Flag 5", giocatori: 5,  minimi: { C: 1 },             flag: true },
};
const MASSIMO_CENTRI = 1;

function formatoDi(schema) {
  return FORMATI[(schema && schema.formato) || "11"] || FORMATI["11"];
}
function maxGiocatori() {
  return formatoDi(schemaCorrente).giocatori;
}
// Ultimo formato usato dal coach: il nuovo schema parte da lì
function formatoPreferito() {
  const f = leggiLocale("playbook.formato");
  return FORMATI[f] ? f : "11";
}

/* "Famiglia" di una sigla della linea d'attacco: C, G o T (anche LG, RT…) */
function famigliaLinea(sigla) {
  if (sigla === "C") return "C";
  if (["G", "LG", "RG"].includes(sigla)) return "G";
  if (["T", "LT", "RT"].includes(sigla)) return "T";
  return null;
}

/* Controlla le regole dell'attacco per lo schema.
   Restituisce: quanti ce ne sono e quanti ne servono per ogni obbligatorio,
   quanti posti mancano per gli obbligatori e se la formazione è completa. */
function statoRegole(schema) {
  const formato = formatoDi(schema);
  const conta = { C: 0, G: 0, T: 0 };
  for (const g of schema.giocatori) {
    const fam = famigliaLinea(g.etichetta);
    if (fam) conta[fam]++;
  }
  if (schema.lato !== "attacco") {
    return { formato, obbligatori: [], mancanti: 0, vietati: 0, completa: schema.giocatori.length === formato.giocatori };
  }
  const obbligatori = Object.entries(formato.minimi).map(([fam, servono]) => ({ fam, servono, ci: conta[fam] }));
  const mancanti = obbligatori.reduce((tot, o) => tot + Math.max(0, o.servono - o.ci), 0);
  const vietati = formato.flag ? conta.G + conta.T : 0;
  const troppiCentri = conta.C > MASSIMO_CENTRI;
  return {
    formato,
    obbligatori,
    mancanti,
    vietati,
    troppiCentri,
    completa: schema.giocatori.length === formato.giocatori && !mancanti && !vietati && !troppiCentri,
  };
}

/* Si può aggiungere questa pedina? Se no, spiega perché. */
function puoAggiungere(schema, sigla) {
  const stato = statoRegole(schema);
  const max = stato.formato.giocatori;
  const inCampo = schema.giocatori.length;
  if (inCampo >= max) return { ok: false, motivo: `In campo ci sono già ${max} giocatori` };
  if (schema.lato !== "attacco") return { ok: true };

  const fam = famigliaLinea(sigla);
  if (stato.formato.flag && (fam === "G" || fam === "T")) {
    return { ok: false, motivo: "Nel flag non ci sono guardie né tackle" };
  }
  if (fam === "C" && stato.obbligatori.find((o) => o.fam === "C").ci >= MASSIMO_CENTRI) {
    return { ok: false, motivo: "Il centro è uno solo" };
  }
  // I posti rimasti servono per gli obbligatori? Allora solo quelli
  const postiLiberi = max - inCampo;
  const serveAncora = fam && stato.obbligatori.some((o) => o.fam === fam && o.ci < o.servono);
  if (!serveAncora && postiLiberi <= stato.mancanti) {
    const elenco = stato.obbligatori.filter((o) => o.ci < o.servono)
      .map((o) => `${o.servono - o.ci} ${o.fam}`).join(", ");
    return { ok: false, motivo: `Mancano giocatori obbligatori: ${elenco}` };
  }
  return { ok: true };
}

/* ==========================================================================
   FORMAZIONI PRONTE PER 9, 7 E FLAG 5
   (quelle a 11 sono in formazioni.js)
   ========================================================================== */
for (const lato of ["attacco", "difesa"]) {
  for (const f of FORMAZIONI[lato]) f.formato = f.formato || "11";
}

FORMAZIONI.attacco.push(
  {
    id: "9-doubles", nome: "Doubles (9)", formato: "9",
    giocatori: [
      { etichetta: "G", x: CENTRO - 2.4, y: -0.9 },
      { etichetta: "C", x: CENTRO, y: -0.9, forma: "quadrato" },
      { etichetta: "G", x: CENTRO + 2.4, y: -0.9 },
      { etichetta: "X", x: 6, y: -0.9 },
      { etichetta: "H", x: 14, y: -2 },
      { etichetta: "Y", x: 39.3, y: -2 },
      { etichetta: "Z", x: 47.3, y: -0.9 },
      { etichetta: "QB", x: CENTRO, y: -5 },
      { etichetta: "RB", x: CENTRO + 2.5, y: -5 },
    ],
  },
  {
    id: "9-pro", nome: "Pro I (9)", formato: "9",
    giocatori: [
      { etichetta: "T", x: CENTRO - 4.8, y: -0.9 },
      { etichetta: "G", x: CENTRO - 2.4, y: -0.9 },
      { etichetta: "C", x: CENTRO, y: -0.9, forma: "quadrato" },
      { etichetta: "G", x: CENTRO + 2.4, y: -0.9 },
      { etichetta: "T", x: CENTRO + 4.8, y: -0.9 },
      { etichetta: "X", x: 6, y: -0.9 },
      { etichetta: "QB", x: CENTRO, y: -2.7 },
      { etichetta: "FB", x: CENTRO, y: -5.3 },
      { etichetta: "RB", x: CENTRO, y: -7.9 },
    ],
  },
  {
    id: "7-spread", nome: "Spread (7)", formato: "7",
    giocatori: [
      { etichetta: "G", x: CENTRO - 2.4, y: -0.9 },
      { etichetta: "C", x: CENTRO, y: -0.9, forma: "quadrato" },
      { etichetta: "G", x: CENTRO + 2.4, y: -0.9 },
      { etichetta: "X", x: 8, y: -0.9 },
      { etichetta: "Z", x: 45.3, y: -0.9 },
      { etichetta: "QB", x: CENTRO, y: -5 },
      { etichetta: "RB", x: CENTRO + 2.5, y: -5 },
    ],
  },
  {
    id: "7-trips", nome: "Trips (7)", formato: "7",
    giocatori: [
      { etichetta: "G", x: CENTRO - 2.4, y: -0.9 },
      { etichetta: "C", x: CENTRO, y: -0.9, forma: "quadrato" },
      { etichetta: "G", x: CENTRO + 2.4, y: -0.9 },
      { etichetta: "X", x: 8, y: -0.9 },
      { etichetta: "H", x: 36, y: -2 },
      { etichetta: "Z", x: 45.3, y: -0.9 },
      { etichetta: "QB", x: CENTRO, y: -5 },
    ],
  },
  {
    id: "flag-spread", nome: "Spread", formato: "flag",
    giocatori: [
      { etichetta: "C", x: CENTRO, y: -0.9, forma: "quadrato" },
      { etichetta: "X", x: 6, y: -0.9 },
      { etichetta: "H", x: 36, y: -2 },
      { etichetta: "Z", x: 47.3, y: -0.9 },
      { etichetta: "QB", x: CENTRO, y: -5 },
    ],
  },
  {
    id: "flag-trips", nome: "Trips", formato: "flag",
    giocatori: [
      { etichetta: "C", x: CENTRO, y: -0.9, forma: "quadrato" },
      { etichetta: "Y", x: 34, y: -2 },
      { etichetta: "H", x: 40.5, y: -2 },
      { etichetta: "Z", x: 47.3, y: -0.9 },
      { etichetta: "QB", x: CENTRO, y: -5 },
    ],
  },
);

FORMAZIONI.difesa.push(
  {
    id: "9-43", nome: "4-3 (9)", formato: "9",
    giocatori: [
      { etichetta: "E", x: 21, y: 1 }, { etichetta: "N", x: CENTRO, y: 1 }, { etichetta: "E", x: 32.3, y: 1 },
      { etichetta: "W", x: 19, y: 5 }, { etichetta: "M", x: CENTRO, y: 5 }, { etichetta: "S", x: 34.5, y: 5 },
      { etichetta: "C", x: 7, y: 7 }, { etichetta: "C", x: 46.3, y: 7 }, { etichetta: "FS", x: CENTRO, y: 13 },
    ],
  },
  {
    id: "7-3", nome: "3-1-3 (7)", formato: "7",
    giocatori: [
      { etichetta: "E", x: 22, y: 1 }, { etichetta: "N", x: CENTRO, y: 1 }, { etichetta: "E", x: 31.3, y: 1 },
      { etichetta: "M", x: CENTRO, y: 5 },
      { etichetta: "C", x: 8, y: 7 }, { etichetta: "C", x: 45.3, y: 7 }, { etichetta: "FS", x: CENTRO, y: 13 },
    ],
  },
  {
    id: "flag-c2", nome: "Cover 2", formato: "flag",
    giocatori: [
      { etichetta: "R", x: CENTRO, y: 7 },
      { etichetta: "C", x: 8, y: 6 }, { etichetta: "C", x: 45.3, y: 6 },
      { etichetta: "FS", x: 18, y: 13 }, { etichetta: "SS", x: 35.3, y: 13 },
    ],
  },
  {
    id: "flag-uomo", nome: "Uomo", formato: "flag",
    giocatori: [
      { etichetta: "R", x: CENTRO, y: 7 },
      { etichetta: "C", x: 6, y: 3 }, { etichetta: "C", x: 47.3, y: 3 },
      { etichetta: "M", x: 36, y: 5 }, { etichetta: "FS", x: CENTRO, y: 12 },
    ],
  },
);

// Formazioni pronte di un formato (le "nostre", non quelle del coach)
function formazioniPronte(lato, formato) {
  return FORMAZIONI[lato].filter((f) => f.formato === formato);
}
