/* ==========================================================================
   FORMAZIONI DI PARTENZA
   --------------------------------------------------------------------------
   Le posizioni sono in YARDE, così sono facili da leggere e da modificare:
   - x = yarde dalla linea laterale sinistra (il campo è largo 53,3 yarde;
         il pallone sta al centro, a 26,67)
   - y = yarde dalla linea di scrimmage (LOS):
         numeri NEGATIVI = dietro la linea, lato attacco
         numeri POSITIVI = oltre la linea, lato difesa
   - forma: "quadrato" (il centro), "cerchio" (attacco), "lettera" (difesa)
   ========================================================================== */

const CENTRO = 26.67; // dove sta il pallone

// La linea d'attacco è uguale in tutte le formazioni offensive
const LINEA_OFFENSIVA = [
  { etichetta: "T", x: CENTRO - 4.8, y: -0.9 },
  { etichetta: "G", x: CENTRO - 2.4, y: -0.9 },
  { etichetta: "C", x: CENTRO,       y: -0.9, forma: "quadrato" },
  { etichetta: "G", x: CENTRO + 2.4, y: -0.9 },
  { etichetta: "T", x: CENTRO + 4.8, y: -0.9 },
];

const FORMAZIONI = {
  attacco: [
    {
      id: "pro-i",
      nome: "Pro I",
      giocatori: [
        ...LINEA_OFFENSIVA,
        { etichetta: "Y",  x: CENTRO + 7.2, y: -0.9 },
        { etichetta: "X",  x: 4,            y: -0.9 },
        { etichetta: "Z",  x: 49,           y: -2   },
        { etichetta: "QB", x: CENTRO,       y: -2.7 },
        { etichetta: "FB", x: CENTRO,       y: -5.3 },
        { etichetta: "RB", x: CENTRO,       y: -7.9 },
      ],
    },
    {
      id: "doubles",
      nome: "Shotgun 2x2",
      giocatori: [
        ...LINEA_OFFENSIVA,
        { etichetta: "X",  x: 4,            y: -0.9 },
        { etichetta: "H",  x: 12,           y: -2   },
        { etichetta: "Y",  x: 41.3,         y: -2   },
        { etichetta: "Z",  x: 49.3,         y: -0.9 },
        { etichetta: "QB", x: CENTRO,       y: -5   },
        { etichetta: "RB", x: CENTRO + 2.5, y: -5   },
      ],
    },
    {
      id: "trips",
      nome: "Trips destra",
      giocatori: [
        ...LINEA_OFFENSIVA,
        { etichetta: "X",  x: 4,            y: -0.9 },
        { etichetta: "H",  x: 37,           y: -2   },
        { etichetta: "Y",  x: 43,           y: -2   },
        { etichetta: "Z",  x: 49.3,         y: -0.9 },
        { etichetta: "QB", x: CENTRO,       y: -5   },
        { etichetta: "RB", x: CENTRO - 2.5, y: -5   },
      ],
    },
    {
      id: "pistol",
      nome: "Pistol",
      giocatori: [
        ...LINEA_OFFENSIVA,
        { etichetta: "Y",  x: CENTRO + 7.2, y: -0.9 },
        { etichetta: "X",  x: 4,            y: -0.9 },
        { etichetta: "H",  x: 12,           y: -2   },
        { etichetta: "Z",  x: 49.3,         y: -2   },
        { etichetta: "QB", x: CENTRO,       y: -4   },
        { etichetta: "RB", x: CENTRO,       y: -7   },
      ],
    },
  ],

  difesa: [
    {
      id: "4-3",
      nome: "4-3",
      giocatori: [
        { etichetta: "E",  x: 19.5, y: 1 },
        { etichetta: "T",  x: 24.5, y: 1 },
        { etichetta: "N",  x: 28.8, y: 1 },
        { etichetta: "E",  x: 33.8, y: 1 },
        { etichetta: "W",  x: 19,   y: 5 },
        { etichetta: "M",  x: CENTRO, y: 5 },
        { etichetta: "S",  x: 34.5, y: 5 },
        { etichetta: "C",  x: 5,    y: 7 },
        { etichetta: "C",  x: 48.3, y: 7 },
        { etichetta: "FS", x: 18,   y: 13 },
        { etichetta: "SS", x: 35.3, y: 12 },
      ],
    },
    {
      id: "3-4",
      nome: "3-4",
      giocatori: [
        { etichetta: "E",  x: 22,   y: 1 },
        { etichetta: "N",  x: CENTRO, y: 1 },
        { etichetta: "E",  x: 31.3, y: 1 },
        { etichetta: "W",  x: 16,   y: 2 },
        { etichetta: "M",  x: 23.5, y: 5 },
        { etichetta: "B",  x: 29.8, y: 5 },
        { etichetta: "S",  x: 37.5, y: 2 },
        { etichetta: "C",  x: 5,    y: 7 },
        { etichetta: "C",  x: 48.3, y: 7 },
        { etichetta: "FS", x: 20,   y: 13 },
        { etichetta: "SS", x: 33.3, y: 13 },
      ],
    },
    {
      id: "nickel",
      nome: "Nickel 4-2-5",
      giocatori: [
        { etichetta: "E",  x: 19.5, y: 1 },
        { etichetta: "T",  x: 24.5, y: 1 },
        { etichetta: "N",  x: 28.8, y: 1 },
        { etichetta: "E",  x: 33.8, y: 1 },
        { etichetta: "M",  x: 23.5, y: 5 },
        { etichetta: "W",  x: 30,   y: 5 },
        { etichetta: "NB", x: 41,   y: 5 },
        { etichetta: "C",  x: 5,    y: 7 },
        { etichetta: "C",  x: 48.3, y: 7 },
        { etichetta: "FS", x: 18,   y: 13 },
        { etichetta: "SS", x: 35.3, y: 13 },
      ],
    },
  ],
};

/* Restituisce una COPIA dei giocatori della formazione, con un id per ognuno.
   Serve una copia perché, spostando i giocatori, non vogliamo modificare
   la formazione originale. */
function giocatoriDaFormazione(lato, idFormazione) {
  const formazione = FORMAZIONI[lato].find((f) => f.id === idFormazione) || FORMAZIONI[lato][0];
  return formazione.giocatori.map((g, i) => ({
    id: "g" + i,
    etichetta: g.etichetta,
    x: g.x,
    y: g.y,
    forma: g.forma || (lato === "attacco" ? "cerchio" : "lettera"),
  }));
}
