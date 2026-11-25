/* ==========================================================================
   COSTRUTTORE DI FORMAZIONI: "Crea da zero"
   --------------------------------------------------------------------------
   Un nuovo schema parte dal campo vuoto. Il coach può:
   - scegliere una formazione pronta (Pro I, Shotgun 2x2, 4-3…), oppure
   - "Crea da zero": si apre la tavolozza con le pedine dei giocatori,
     da trascinare in campo dove vuole (con un clic la pedina va nella
     sua posizione più tipica). Massimo 11 giocatori.
   ========================================================================== */

const MAX_GIOCATORI = 11;

// Pedine disponibili nella tavolozza, raggruppate per ruolo
const PEDINE = {
  attacco: [
    { gruppo: "Linea",       sigle: ["C", "G", "T"] },
    { gruppo: "Backfield",   sigle: ["QB", "RB", "FB"] },
    { gruppo: "Ricevitori",  sigle: ["X", "Y", "Z", "H", "TE", "WR"] },
  ],
  difesa: [
    { gruppo: "Linea",       sigle: ["E", "T", "N", "DE"] },
    { gruppo: "Linebacker",  sigle: ["W", "M", "S", "B"] },
    { gruppo: "Secondaria",  sigle: ["C", "FS", "SS", "NB"] },
  ],
};

let tavolozzaAperta = false;

function nuovoIdGiocatore() {
  return "p_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

/* ---------- "Crea da zero": svuota il campo e apre la tavolozza ---------- */
function creaDaZero() {
  if (schemaBloccato()) return;
  chiudiMenuTracce();
  if (schemaCorrente.giocatori.length) {
    ricordaStato();
    schemaCorrente.giocatori = [];
    schemaCorrente.ribaltato = false;
    giocatoreSelezionato = null;
    mostraAvviso("Campo svuotato: trascina i tuoi giocatori", annulla);
  }
  schemaCorrente.formazione = "libera";
  tavolozzaAperta = true;
  ridisegna();
  salvaSubito();
}

/* ---------- Tavolozza con le pedine ---------- */
function mostraTavolozza() {
  const box = $("#tavolozza");
  const visibile = tavolozzaAperta && schemaCorrente.formazione === "libera" && !schemaCorrente.bloccato;
  box.hidden = !visibile;
  if (!visibile) return;

  const inCampo = schemaCorrente.giocatori.length;
  box.innerHTML = `
    <div class="tavolozza-testa">
      <span>Trascina in campo</span>
      <span class="contatore${inCampo >= MAX_GIOCATORI ? " pieno" : ""}">${inCampo}/${MAX_GIOCATORI}</span>
    </div>`;

  for (const { gruppo, sigle } of PEDINE[schemaCorrente.lato]) {
    const riga = document.createElement("div");
    riga.className = "tavolozza-gruppo";
    const titolo = document.createElement("span");
    titolo.className = "tavolozza-titolo";
    titolo.textContent = gruppo;
    riga.appendChild(titolo);
    const pedine = document.createElement("div");
    pedine.className = "pedine";
    sigle.forEach((sigla, i) => {
      const p = document.createElement("button");
      const forma = schemaCorrente.lato === "difesa" ? "lettera" : sigla === "C" ? "quadrato" : "cerchio";
      p.className = `pedina forma-${forma} ruolo-${ruoloDi(schemaCorrente.lato, sigla)}`;
      p.textContent = sigla;
      p.title = `Trascina ${sigla} in campo (o clicca per metterlo nella posizione tipica)`;
      p.style.setProperty("--i", i);
      p.addEventListener("pointerdown", (e) => iniziaTrascinamentoPedina(e, sigla, p));
      pedine.appendChild(p);
    });
    riga.appendChild(pedine);
    box.appendChild(riga);
  }

  const svuota = document.createElement("button");
  svuota.className = "btn-mini distruttiva";
  svuota.textContent = "Svuota campo";
  svuota.hidden = !inCampo;
  svuota.addEventListener("click", () => {
    if (schemaBloccato()) return;
    ricordaStato();
    schemaCorrente.giocatori = [];
    giocatoreSelezionato = null;
    ridisegna();
    salvaSubito();
    mostraAvviso("Campo svuotato", annulla);
  });
  box.appendChild(svuota);
}

/* ---------- Trascinare una pedina dalla tavolozza al campo ---------- */
function iniziaTrascinamentoPedina(evento, sigla, origine) {
  if (evento.button > 0 || schemaBloccato()) return;
  evento.preventDefault();
  const partenza = { x: evento.clientX, y: evento.clientY };
  let fantasma = null;

  const muovi = (e) => {
    const lontano = Math.hypot(e.clientX - partenza.x, e.clientY - partenza.y) > 4;
    if (!fantasma && lontano) {
      // La pedina "si stacca" e segue il mouse
      fantasma = origine.cloneNode(true);
      fantasma.classList.add("pedina-volante");
      document.body.appendChild(fantasma);
      document.body.classList.add("trascinando");
    }
    if (fantasma) {
      fantasma.style.left = e.clientX + "px";
      fantasma.style.top = e.clientY + "px";
      svgCampo.classList.toggle("bersaglio", sopraCampo(e));
    }
  };

  const fine = (e) => {
    document.removeEventListener("pointermove", muovi);
    document.removeEventListener("pointerup", fine);
    document.body.classList.remove("trascinando");
    svgCampo.classList.remove("bersaglio");
    if (!fantasma) {
      aggiungiGiocatore(sigla); // semplice clic: posizione tipica
      return;
    }
    fantasma.remove();
    if (sopraCampo(e)) {
      const p = puntoNelCampo(e);
      aggiungiGiocatore(sigla, { x: p.x, y: YARDE_AVANTI - p.y });
    }
  };

  document.addEventListener("pointermove", muovi);
  document.addEventListener("pointerup", fine);
}

function sopraCampo(e) {
  const r = svgCampo.getBoundingClientRect();
  return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
}

/* ---------- Aggiungere e togliere giocatori ---------- */
function aggiungiGiocatore(sigla, posizione = null) {
  if (schemaBloccato()) return;
  if (schemaCorrente.giocatori.length >= MAX_GIOCATORI) {
    mostraAvviso(`In campo ci sono già ${MAX_GIOCATORI} giocatori`);
    return;
  }
  ricordaStato();
  const pos = posizione || posizioneSuggerita(schemaCorrente.lato, sigla);
  const g = {
    id: nuovoIdGiocatore(),
    etichetta: sigla,
    x: +Math.min(LARGHEZZA_CAMPO - 0.6, Math.max(0.6, pos.x)).toFixed(1),
    y: limitaY(schemaCorrente.lato, pos.y), // mai oltre la linea di scrimmage
    forma: schemaCorrente.lato === "difesa" ? "lettera" : sigla === "C" ? "quadrato" : "cerchio",
  };
  schemaCorrente.giocatori.push(g);
  if (!schemaCorrente.formazione) schemaCorrente.formazione = "libera";
  giocatoreSelezionato = g.id;
  ridisegna();
  // Piccolo "salto" della pedina appena messa in campo
  const el = svgCampo.querySelector(`.giocatore[data-id="${g.id}"]`);
  if (el) el.classList.add("appena-aggiunto");
  salvaTraPoco();
}

function rimuoviGiocatore(g) {
  if (!g || schemaBloccato()) return;
  ricordaStato();
  schemaCorrente.giocatori = schemaCorrente.giocatori.filter((x) => x.id !== g.id);
  giocatoreSelezionato = null;
  chiudiMenuTracce();
  ridisegna();
  salvaTraPoco();
  mostraAvviso(`${g.etichetta} tolto dal campo`, annulla);
}

/* Posizione "tipica" di un ruolo: la prendiamo dalle formazioni pronte.
   Se quel posto è già occupato proviamo il successivo (es. la seconda G),
   altrimenti spostiamo un po' di lato finché troviamo spazio libero. */
function posizioneSuggerita(lato, sigla) {
  const libero = (x, y) => schemaCorrente.giocatori.every((g) => Math.hypot(g.x - x, g.y - y) > 1.6);
  for (const f of FORMAZIONI[lato]) {
    for (const g of f.giocatori) {
      if (g.etichetta === sigla && libero(g.x, g.y)) return { x: g.x, y: g.y };
    }
  }
  const base = lato === "attacco" ? { x: CENTRO, y: -4 } : { x: CENTRO, y: 5 };
  for (let passo = 0; passo < 20; passo++) {
    const x = base.x + (passo % 2 ? 1 : -1) * Math.ceil(passo / 2) * 2.4;
    if (libero(x, base.y)) return { x, y: base.y };
  }
  return base;
}
