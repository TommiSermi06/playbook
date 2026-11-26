/* ==========================================================================
   COSTRUTTORE DI FORMAZIONI: "Crea da zero"
   --------------------------------------------------------------------------
   Un nuovo schema parte dal campo vuoto. Il coach può:
   - scegliere una formazione pronta (Pro I, Shotgun 2x2, 4-3…), oppure
   - "Crea da zero": si apre la tavolozza con le pedine dei giocatori,
     da trascinare in campo dove vuole (con un clic la pedina va nella
     sua posizione più tipica).
   Quanti giocatori e quali sono obbligatori lo decide il formato (regole.js).
   ========================================================================== */

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

// Nel flag la linea non esiste: il centro è l'unico "uomo di linea"
function pedineDelFormato() {
  const flag = formatoDi(schemaCorrente).flag;
  if (schemaCorrente.lato === "speciali") return PEDINE_SPECIALI.map((p) => ({ gruppo: p.nome, sigle: p.sigle }));
  if (schemaCorrente.lato === "attacco") {
    return flag
      ? [{ gruppo: "Centro", sigle: ["C"] }, { gruppo: "Backfield", sigle: ["QB", "RB"] },
         { gruppo: "Ricevitori", sigle: ["X", "Y", "Z", "H", "WR"] }]
      : PEDINE.attacco;
  }
  return flag
    ? [{ gruppo: "Rusher", sigle: ["R"] }, { gruppo: "Linebacker", sigle: ["W", "M"] },
       { gruppo: "Secondaria", sigle: ["C", "FS", "SS", "NB"] }]
    : PEDINE.difesa;
}

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
  const max = maxGiocatori();
  const regole = statoRegole(schemaCorrente);
  box.innerHTML = `
    <div class="tavolozza-testa">
      <span>Trascina in campo</span>
      <span class="contatore${inCampo >= max ? " pieno" : ""}">${inCampo}/${max}</span>
    </div>`;

  // Lista di controllo degli obbligatori (solo attacco): C ✓ · G 1/2 · T 0/2
  if (regole.obbligatori.length) {
    const lista = document.createElement("div");
    lista.className = "obbligatori";
    lista.appendChild(Object.assign(document.createElement("span"), {
      className: "obbligatori-titolo",
      textContent: regole.formato.flag ? "Obbligatorio" : "Obbligatori",
    }));
    for (const o of regole.obbligatori) {
      const ok = o.ci >= o.servono;
      const voce = document.createElement("span");
      voce.className = "obbligo" + (ok ? " ok" : "");
      voce.textContent = ok ? `${o.fam} ✓` : `${o.fam} ${o.ci}/${o.servono}`;
      lista.appendChild(voce);
    }
    if (regole.formato.flag) {
      lista.appendChild(Object.assign(document.createElement("span"), {
        className: "obbligatori-nota", textContent: "Nel flag il centro corre anche le route",
      }));
    }
    box.appendChild(lista);
  }

  // Formazione completa e regolare: si può salvare con un nome
  if (regole.completa) {
    const salva = document.createElement("form");
    salva.className = "salva-formazione";
    salva.innerHTML = `
      <p class="salva-titolo">✓ Formazione completa</p>
      <p class="salva-testo">Dalle un nome: la ritroverai tra «Le tue formazioni» in ogni nuovo schema.</p>
      <div class="salva-riga">
        <input id="nome-formazione" type="text" maxlength="30" placeholder="Es. Trips Bunch" autocomplete="off">
        <button type="submit" class="btn-pieno">Salva formazione</button>
      </div>
      <p class="messaggio-errore" id="errore-formazione"></p>`;
    salva.addEventListener("submit", (e) => {
      e.preventDefault();
      salvaFormazioneCorrente($("#nome-formazione").value);
    });
    box.appendChild(salva);
  } else if (inCampo === max) {
    // Pieno ma irregolare (es. un G rinominato in X): spieghiamo cosa manca
    const avviso = document.createElement("p");
    avviso.className = "avviso-regole";
    avviso.textContent = regole.vietati
      ? "Nel flag non ci sono guardie né tackle: togli G e T."
      : regole.troppiCentri ? "Il centro è uno solo: togline uno."
      : "Mancano giocatori obbligatori: togli qualcuno e aggiungi " +
        regole.obbligatori.filter((o) => o.ci < o.servono).map((o) => `${o.servono - o.ci} ${o.fam}`).join(", ") + ".";
    box.appendChild(avviso);
  }

  for (const { gruppo, sigle } of pedineDelFormato()) {
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
      const forma = formaPedina(schemaCorrente.lato, sigla);
      p.className = `pedina forma-${forma} ruolo-${ruoloDi(schemaCorrente.lato, sigla)}`;
      p.textContent = sigla;
      p.title = `Trascina ${sigla} in campo (o clicca per metterlo nella posizione tipica)`;
      p.style.setProperty("--i", i);
      // Pedine "spente" quando le regole del formato non le permettono
      const permesso = puoAggiungere(schemaCorrente, sigla);
      if (!permesso.ok) {
        p.classList.add("spenta");
        p.title = permesso.motivo;
        p.setAttribute("aria-disabled", "true");
      }
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
  const permesso = puoAggiungere(schemaCorrente, sigla);
  if (!permesso.ok) {
    // Pedina spenta: scuote la testa e spiega il motivo
    origine.classList.remove("scuoti");
    void origine.offsetWidth;
    origine.classList.add("scuoti");
    mostraAvviso(permesso.motivo);
    return;
  }
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
  const permesso = puoAggiungere(schemaCorrente, sigla);
  if (!permesso.ok) {
    mostraAvviso(permesso.motivo);
    return;
  }
  ricordaStato();
  const pos = posizione || posizioneSuggerita(schemaCorrente.lato, sigla);
  const g = {
    id: nuovoIdGiocatore(),
    etichetta: sigla,
    x: +Math.min(LARGHEZZA_CAMPO - 0.6, Math.max(0.6, pos.x)).toFixed(1),
    y: limitaY(schemaCorrente.lato, pos.y), // mai oltre la linea di scrimmage
    forma: formaPedina(schemaCorrente.lato, sigla),
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
  const formato = formatoDi(schemaCorrente).id;
  let ordinate = [...formazioniPronte(lato, formato), ...FORMAZIONI[lato].filter((f) => f.formato !== formato)];
  if (lato === "speciali") { // prima l'unità scelta, poi le altre dalla stessa parte della linea
    const verso = versoSchema(schemaCorrente);
    ordinate = ordinate.filter((f) => versoUnita(f.categoria) === verso)
      .sort((a, b) => (b.categoria === schemaCorrente.categoria) - (a.categoria === schemaCorrente.categoria));
  }
  for (const f of ordinate) {
    for (const g of f.giocatori) {
      if (g.etichetta === sigla && libero(g.x, g.y)) return { x: g.x, y: g.y };
    }
  }
  const base = versoSchema(schemaCorrente) === "attacco" ? { x: CENTRO, y: -4 } : { x: CENTRO, y: 5 };
  for (let passo = 0; passo < 20; passo++) {
    const x = base.x + (passo % 2 ? 1 : -1) * Math.ceil(passo / 2) * 2.4;
    if (libero(x, base.y)) return { x, y: base.y };
  }
  return base;
}
