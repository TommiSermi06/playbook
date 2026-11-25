/* ==========================================================================
   PIÙ PLAYBOOK: Tackle (11, 9, 7 giocatori) e Flag (5)
   --------------------------------------------------------------------------
   Ogni coach può avere più playbook (es. Offense, Playoff, U15, Flag).
   Il formato appartiene al playbook: tutti i suoi schemi lo seguono.

   Com'è fatto un playbook:
   { id: "pb_...", nome: "Offense", formato: "11" | "9" | "7" | "flag",
     creato, modificato }
   Ogni schema sa a quale playbook appartiene: schema.playbook = id.

   Archivio: come schemi e formazioni, una copia sul computer e una online
   (tabella "playbook" su Supabase), visibile solo al coach.
   ========================================================================== */

const Playbook = {
  chiave: "playbook.playbook.v1",
  daInviare: new Set(),
  daEliminare: new Set(),

  imposta(idUtente) {
    this.chiave = `playbook.playbook.v1.${idUtente}`;
    this.daInviare = new Set(leggiLocale(this.chiave + ".da-inviare") || []);
    this.daEliminare = new Set(leggiLocale(this.chiave + ".da-eliminare") || []);
  },

  tutti() {
    return (leggiLocale(this.chiave) || []).sort((a, b) => b.modificato - a.modificato);
  },

  trova(id) {
    return this.tutti().find((p) => p.id === id) || null;
  },

  _scrivi(lista) { scriviLocale(this.chiave, lista); },
  _ricorda() {
    scriviLocale(this.chiave + ".da-inviare", [...this.daInviare]);
    scriviLocale(this.chiave + ".da-eliminare", [...this.daEliminare]);
  },

  crea({ nome, formato }) {
    const adesso = Date.now();
    const pb = {
      id: "pb_" + adesso.toString(36) + Math.random().toString(36).slice(2, 6),
      nome: nome.trim(),
      formato,
      creato: adesso,
      modificato: adesso,
    };
    this.salva(pb);
    return pb;
  },

  salva(pb) {
    pb.modificato = Date.now();
    this._scrivi([pb, ...this.tutti().filter((p) => p.id !== pb.id)]);
    this.daInviare.add(pb.id);
    this.daEliminare.delete(pb.id);
    this._ricorda();
    this.invia();
  },

  elimina(id) {
    const pb = this.trova(id);
    this._scrivi(this.tutti().filter((p) => p.id !== id));
    this.daInviare.delete(id);
    this.daEliminare.add(id);
    this._ricorda();
    this.invia();
    return pb;
  },

  async invia() {
    if (!Cloud.attivo || (!this.daInviare.size && !this.daEliminare.size)) return;
    segnalaSync("inizio");
    try {
      const daSalvare = this.tutti().filter((p) => this.daInviare.has(p.id));
      if (daSalvare.length) await Cloud.salvaRighe("playbook", daSalvare);
      for (const id of this.daEliminare) await Cloud.eliminaRiga("playbook", id);
      this.daInviare.clear();
      this.daEliminare.clear();
      this._ricorda();
      segnalaSync("fine");
    } catch (errore) {
      segnalaSync("errore", errore); // restano in coda: riprova al prossimo salvataggio o accesso
    }
  },

  async sincronizza() {
    if (!Cloud.attivo) return;
    try {
      const online = (await Cloud.scaricaRighe("playbook")).filter((p) => !this.daEliminare.has(p.id));
      const perId = new Map(online.map((p) => [p.id, p]));
      for (const p of this.tutti()) {
        const remoto = perId.get(p.id);
        if (!remoto || p.modificato > remoto.modificato) {
          perId.set(p.id, p);
          this.daInviare.add(p.id);
        }
      }
      this._scrivi([...perId.values()]);
      this._ricorda();
      await this.invia();
    } catch (errore) {
      console.warn("Playbook non sincronizzati (uso la copia sul computer):", errore);
    }
  },
};

let playbookCorrente = null;

/* ---------- Piccoli aiuti ---------- */
function schemiDelPlaybook(id = playbookCorrente && playbookCorrente.id) {
  return Dati.tutti().filter((s) => s.playbook === id);
}
function eFlag(pb) {
  return Boolean(FORMATI[pb.formato] && FORMATI[pb.formato].flag);
}
function descriviPlaybook(pb) {
  return eFlag(pb) ? "Flag · 5 giocatori" : `Tackle · ${FORMATI[pb.formato].giocatori} giocatori`;
}

/* ---------- Schemi creati prima dei playbook ----------
   Li mettiamo in un playbook per formato, così non si perde niente. */
function sistemaSchemiSenzaPlaybook() {
  const orfani = Dati.tutti().filter((s) => !s.playbook || !Playbook.trova(s.playbook));
  if (!orfani.length) return;
  const perFormato = new Map();
  for (const s of orfani) {
    const f = s.formato || "11";
    if (!perFormato.has(f)) perFormato.set(f, []);
    perFormato.get(f).push(s);
  }
  const unico = perFormato.size === 1 && !Playbook.tutti().length;
  for (const [formato, schemi] of perFormato) {
    const nome = unico ? "Il mio playbook" : `Il mio playbook · ${FORMATI[formato].breve}`;
    const pb = Playbook.crea({ nome, formato });
    for (const s of schemi) {
      s.playbook = pb.id;
      s.formato = formato;
      Dati.salva(s);
    }
  }
}

/* ==========================================================================
   PAGINA "I TUOI PLAYBOOK"
   ========================================================================== */
let filtroHome = "tutti";

function mostraHome() {
  if (schemaCorrente) chiudiEditor();
  playbookCorrente = null;
  chiudiMenuTracce();
  document.body.classList.add("in-home");
  $("#home").hidden = false;
  aggiornaTestaHome();
  disegnaHome();
}

function aggiornaTestaHome() {
  disegnaStemma($("#stemma-home"), Squadra.logo, Squadra.nome);
  $("#squadra-nome-home").textContent = Squadra.nome || "La tua squadra";
  $("#email-home").textContent = (Cloud.utente && Cloud.utente.email) || "Solo su questo computer";
}

function disegnaHome() {
  const griglia = $("#griglia-playbook");
  griglia.innerHTML = "";
  const tutti = Playbook.tutti();
  const visibili = tutti.filter((pb) =>
    filtroHome === "tutti" || (filtroHome === "flag" ? eFlag(pb) : !eFlag(pb)));

  // Scheda "Nuovo playbook" sempre per prima
  const nuovo = document.createElement("button");
  nuovo.className = "scheda-playbook nuovo";
  nuovo.innerHTML = `<span class="nuovo-piu">＋</span><span class="nuovo-testo">Nuovo playbook</span>
    <span class="nuovo-sotto">Tackle o Flag</span>`;
  nuovo.addEventListener("click", () => apriFoglioPlaybook());
  griglia.appendChild(nuovo);

  visibili.forEach((pb, i) => {
    const schemi = schemiDelPlaybook(pb.id);
    const attacco = schemi.filter((s) => s.lato === "attacco").length;
    const difesa = schemi.length - attacco;
    const scheda = document.createElement("article");
    scheda.className = "scheda-playbook " + (eFlag(pb) ? "tipo-flag" : "tipo-tackle");
    scheda.style.setProperty("--i", i);
    scheda.tabIndex = 0;

    // Anteprima: lo schema modificato più di recente (o un campo vuoto)
    const anteprima = document.createElementNS(SVG_NS, "svg");
    anteprima.setAttribute("class", "anteprima-playbook");
    disegnaCampo(anteprima, schemi[0] || { lato: "attacco", giocatori: [], formato: pb.formato }, { miniatura: true });
    scheda.appendChild(anteprima);

    const corpo = document.createElement("div");
    corpo.className = "scheda-corpo";
    corpo.innerHTML = `
      <span class="badge-formato"></span>
      <h3></h3>
      <p class="scheda-conteggi"></p>
      <p class="scheda-data"></p>`;
    corpo.querySelector(".badge-formato").textContent = descriviPlaybook(pb);
    corpo.querySelector("h3").textContent = pb.nome;
    corpo.querySelector(".scheda-conteggi").textContent =
      `${attacco} ${attacco === 1 ? "schema" : "schemi"} di attacco · ${difesa} di difesa`;
    corpo.querySelector(".scheda-data").textContent = `Modificato ${dataBreve(pb.modificato)}`;
    scheda.appendChild(corpo);

    // Menu ⋯: rinomina, duplica, elimina
    const altro = document.createElement("button");
    altro.className = "scheda-altro";
    altro.title = "Altre azioni";
    altro.setAttribute("aria-label", "Altre azioni");
    altro.textContent = "⋯";
    altro.addEventListener("click", (e) => { e.stopPropagation(); apriMenuScheda(altro, pb); });
    scheda.appendChild(altro);

    scheda.addEventListener("click", () => apriPlaybook(pb.id));
    scheda.addEventListener("keydown", (e) => { if (e.key === "Enter") apriPlaybook(pb.id); });
    griglia.appendChild(scheda);
  });

  $("#home-vuota").hidden = tutti.length > 0;
}

// Filtri Tutti / Tackle / Flag
document.querySelectorAll("#filtro-home .segmento").forEach((b, i) =>
  b.addEventListener("click", () => {
    filtroHome = b.dataset.valore;
    document.querySelectorAll("#filtro-home .segmento").forEach((x) => x.classList.toggle("attivo", x === b));
    $("#filtro-home").style.setProperty("--indice", i);
    disegnaHome();
  }));

/* ---------- Menu ⋯ della scheda ---------- */
function apriMenuScheda(bottone, pb) {
  chiudiMenuScheda();
  const menu = document.createElement("div");
  menu.className = "menu-scheda";
  menu.id = "menu-scheda";
  const voci = [
    ["Apri", () => apriPlaybook(pb.id)],
    ["Rinomina…", () => apriFoglioPlaybook(pb)],
    ["Duplica", () => duplicaPlaybook(pb)],
    ["Esporta (copia di sicurezza)", () => esportaPlaybook(pb)],
    ["Elimina…", () => eliminaPlaybook(pb), "distruttiva"],
  ];
  for (const [testo, azione, classe] of voci) {
    const b = document.createElement("button");
    b.textContent = testo;
    if (classe) b.className = classe;
    b.addEventListener("click", (e) => { e.stopPropagation(); chiudiMenuScheda(); azione(); });
    menu.appendChild(b);
  }
  document.body.appendChild(menu);
  const r = bottone.getBoundingClientRect();
  menu.style.top = r.bottom + 6 + "px";
  menu.style.left = Math.min(innerWidth - menu.offsetWidth - 12, r.right - menu.offsetWidth) + "px";
  requestAnimationFrame(() => menu.classList.add("visibile"));
}
function chiudiMenuScheda() {
  const m = $("#menu-scheda");
  if (m) m.remove();
}
document.addEventListener("pointerdown", (e) => {
  if (!e.target.closest("#menu-scheda") && !e.target.closest(".scheda-altro")) chiudiMenuScheda();
});

/* ---------- Aprire un playbook ---------- */
function apriPlaybook(id) {
  const pb = Playbook.trova(id);
  if (!pb) return;
  playbookCorrente = pb;
  document.body.classList.remove("in-home");
  $("#home").hidden = true;
  aggiornaTestaPlaybook();
  $("#cerca").value = "";
  if (schemaCorrente) chiudiEditor();
  const ultimo = schemiDelPlaybook()[0];
  if (ultimo) apriEditor(ultimo.id);
  else { scegliLato("attacco"); mostraElenco(); }
  // L'app "entra" nel playbook con la stessa animazione del login
  document.body.classList.remove("app-pronta");
  void document.body.offsetWidth;
  document.body.classList.add("app-pronta");
}

function aggiornaTestaPlaybook() {
  if (!playbookCorrente) return;
  $("#nome-playbook").textContent = playbookCorrente.nome;
  const badge = $("#badge-playbook");
  badge.textContent = descriviPlaybook(playbookCorrente);
  badge.className = "badge-formato " + (eFlag(playbookCorrente) ? "tipo-flag" : "tipo-tackle");
}

$("#btn-home").addEventListener("click", mostraHome);
$("#btn-esci-home").addEventListener("click", () => $("#btn-esci").click());
$("#btn-squadra-home").addEventListener("click", () => apriFoglioSquadra());

/* ==========================================================================
   FINESTRA "NUOVO PLAYBOOK" (e "Rinomina")
   ========================================================================== */
let playbookInModifica = null;

function apriFoglioPlaybook(pb = null) {
  playbookInModifica = pb;
  const modifica = Boolean(pb);
  $("#titolo-playbook").textContent = modifica ? "Rinomina playbook" : "Nuovo playbook";
  $("#nome-nuovo-playbook").value = modifica ? pb.nome : "";
  $("#scelte-nuovo-playbook").hidden = modifica;
  $("#info-formato-playbook").hidden = !modifica;
  if (modifica) $("#info-formato-playbook").textContent = `${descriviPlaybook(pb)} · il formato non si cambia, per non rovinare gli schemi`;
  $("#btn-playbook-crea").textContent = modifica ? "Salva" : "Crea playbook";
  $("#errore-playbook").textContent = "";
  if (!modifica) impostaTipoPlaybook("tackle", "11");

  $("#velo").hidden = false;
  $("#foglio-playbook").hidden = false;
  requestAnimationFrame(() => {
    $("#velo").classList.add("visibile");
    $("#foglio-playbook").classList.add("visibile");
    $("#nome-nuovo-playbook").focus();
  });
}

function chiudiFoglioPlaybook() {
  $("#velo").classList.remove("visibile");
  $("#foglio-playbook").classList.remove("visibile");
  setTimeout(() => {
    $("#velo").hidden = true;
    $("#foglio-playbook").hidden = true;
  }, 220);
}

// Tackle → si scelgono 11, 9 o 7 giocatori; Flag → sempre 5
function impostaTipoPlaybook(tipo, giocatori) {
  const tipi = $("#tipo-nuovo-playbook");
  tipi.querySelectorAll(".segmento").forEach((b, i) => {
    b.classList.toggle("attivo", b.dataset.valore === tipo);
    if (b.dataset.valore === tipo) tipi.style.setProperty("--indice", i);
  });
  tipi.dataset.valore = tipo;
  $("#riga-giocatori-playbook").hidden = tipo === "flag";
  $("#nota-flag-playbook").hidden = tipo !== "flag";
  if (giocatori) {
    const g = $("#giocatori-nuovo-playbook");
    g.querySelectorAll(".segmento").forEach((b, i) => {
      b.classList.toggle("attivo", b.dataset.valore === giocatori);
      if (b.dataset.valore === giocatori) g.style.setProperty("--indice", i);
    });
    g.dataset.valore = giocatori;
  }
}
$("#tipo-nuovo-playbook").querySelectorAll(".segmento").forEach((b) =>
  b.addEventListener("click", () => impostaTipoPlaybook(b.dataset.valore)));
$("#giocatori-nuovo-playbook").querySelectorAll(".segmento").forEach((b) =>
  b.addEventListener("click", () => impostaTipoPlaybook($("#tipo-nuovo-playbook").dataset.valore, b.dataset.valore)));

$("#btn-playbook-annulla").addEventListener("click", chiudiFoglioPlaybook);

$("#foglio-playbook").addEventListener("submit", (e) => {
  e.preventDefault();
  const nome = $("#nome-nuovo-playbook").value.trim();
  if (!nome) {
    $("#errore-playbook").textContent = "Dai un nome al playbook (es. Offense, Playoff, U15).";
    $("#nome-nuovo-playbook").focus();
    return;
  }
  if (playbookInModifica) {
    playbookInModifica.nome = nome;
    Playbook.salva(playbookInModifica);
    chiudiFoglioPlaybook();
    if (playbookCorrente && playbookCorrente.id === playbookInModifica.id) aggiornaTestaPlaybook();
    disegnaHome();
    mostraAvviso("Playbook rinominato");
    return;
  }
  const tipo = $("#tipo-nuovo-playbook").dataset.valore;
  const formato = tipo === "flag" ? "flag" : $("#giocatori-nuovo-playbook").dataset.valore;
  const pb = Playbook.crea({ nome, formato });
  chiudiFoglioPlaybook();
  festeggiaStemma();
  setTimeout(() => apriPlaybook(pb.id), 230);
});

/* ---------- Duplica ed elimina ---------- */
function duplicaPlaybook(pb) {
  const copia = Playbook.crea({ nome: `${pb.nome} (copia)`, formato: pb.formato });
  for (const s of schemiDelPlaybook(pb.id)) {
    const c = JSON.parse(JSON.stringify(s));
    c.id = Dati.nuovoId();
    c.playbook = copia.id;
    c.bloccato = false;
    Dati.salva(c);
  }
  disegnaHome();
  mostraAvviso(`Creato «${copia.nome}»`);
}

function eliminaPlaybook(pb) {
  const schemi = schemiDelPlaybook(pb.id);
  const testo = schemi.length
    ? `Verrà eliminato anche ${schemi.length === 1 ? "il suo schema" : `i suoi ${schemi.length} schemi`}. Potrai annullare subito dopo.`
    : "Il playbook è vuoto. Potrai annullare subito dopo.";
  chiediConferma(`Eliminare «${pb.nome}»?`, testo, "Elimina", () => {
    Playbook.elimina(pb.id);
    for (const s of schemi) Dati.elimina(s.id);
    disegnaHome();
    mostraAvviso(`«${pb.nome}» eliminato`, () => {
      Playbook.salva(pb);
      for (const s of schemi) Dati.salva(s);
      disegnaHome();
    });
  });
}

/* ==========================================================================
   ESPORTA E IMPORTA
   Un playbook si può salvare in un file (copia di sicurezza, o per
   passarlo a un altro coach) e reimportare. Lo stesso formato serve
   per portare dentro l'app i playbook di altre app (es. Playmaker).
   ========================================================================== */
const TIPO_FILE = "playbook-app/esportazione";

function esportaPlaybook(pb) {
  const schemi = schemiDelPlaybook(pb.id);
  const idFormazioni = new Set(schemi.map((s) => s.formazione));
  const formazioni = FormazioniMie.tutte().filter((f) => idFormazioni.has(f.id));
  const dati = {
    tipo: TIPO_FILE,
    versione: 1,
    esportato: new Date().toISOString(),
    playbook: { nome: pb.nome, formato: pb.formato },
    formazioni: formazioni.map(({ nome, lato, formato, giocatori }) => ({ nome, lato, formato, giocatori })),
    schemi: schemi.map((s) => {
      const { id, playbook, creato, modificato, ...resto } = s;
      const f = formazioni.find((x) => x.id === s.formazione);
      return { ...resto, formazioneNome: f ? f.nome : null };
    }),
  };
  const blob = new Blob([JSON.stringify(dati, null, 1)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${pb.nome.replace(/[\\/:*?"<>|]/g, "-")}.playbook.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
  mostraAvviso(`«${pb.nome}» esportato`);
}

async function importaDaFile(file) {
  let dati;
  try {
    dati = JSON.parse(await file.text());
  } catch {
    mostraAvviso("Il file non è un playbook valido");
    return;
  }
  if (!dati || dati.tipo !== TIPO_FILE || !dati.playbook || !Array.isArray(dati.schemi)) {
    mostraAvviso("Il file non è un playbook di questa app");
    return;
  }
  const formato = FORMATI[dati.playbook.formato] ? dati.playbook.formato : "11";

  // Nome libero: se esiste già aggiungiamo un numero
  let nome = (dati.playbook.nome || "Playbook importato").trim();
  const nomi = new Set(Playbook.tutti().map((p) => p.nome.toLowerCase()));
  if (nomi.has(nome.toLowerCase())) {
    let n = 2;
    while (nomi.has(`${nome} (${n})`.toLowerCase())) n++;
    nome = `${nome} (${n})`;
  }
  const pb = Playbook.crea({ nome, formato });

  // Formazioni: riusiamo quelle con lo stesso nome, le altre le creiamo
  const idPerNome = {};
  for (const f of dati.formazioni || []) {
    const esistente = FormazioniMie.perLato(f.lato, f.formato || formato)
      .find((x) => x.nome.toLowerCase() === f.nome.toLowerCase());
    idPerNome[f.nome] = esistente
      ? esistente.id
      : FormazioniMie.crea(f.nome, f.lato, f.formato || formato, f.giocatori).id;
  }

  // Schemi: nell'ordine del file (il primo in cima all'elenco)
  const adesso = Date.now();
  const schemi = dati.schemi.map((s, i) => {
    const { formazioneNome, numero, ...resto } = s;
    return {
      ...resto,
      id: Dati.nuovoId() + i,
      playbook: pb.id,
      formato,
      formazione: (formazioneNome && idPerNome[formazioneNome]) || "libera",
      ribaltato: false,
      bloccato: false,
      note: s.note || "",
      creato: adesso,
      modificato: adesso - i, // così l'ordine resta quello originale
    };
  });
  Dati.importa(schemi);
  disegnaHome();
  festeggiaStemma();
  mostraAvviso(`Importato «${nome}»: ${schemi.length} schemi e ${(dati.formazioni || []).length} formazioni`);
}

$("#btn-importa").addEventListener("click", () => $("#file-importa").click());
$("#file-importa").addEventListener("change", (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (file) importaDaFile(file);
});
