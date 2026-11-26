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

  // Cosa posso fare su un playbook: "proprietario", "modifica", "proposta" o "lettura"
  permesso(id) {
    if (CODICE_VISTA) return "lettura";
    const pb = id && this.trova(id);
    if (!pb || !pb.proprietario) return "proprietario";
    return pb.permesso || "modifica";
  },

  // Proprietario di un playbook condiviso con me (null se è mio)
  proprietarioDi(id) {
    const pb = id && this.trova(id);
    return (pb && pb.proprietario) || null;
  },

  salva(pb) {
    pb.modificato = Date.now();
    this._scrivi([pb, ...this.tutti().filter((p) => p.id !== pb.id)]);
    if (pb.proprietario) return; // condiviso: lo modifica solo il proprietario
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
      const daSalvare = this.tutti().filter((p) => this.daInviare.has(p.id) && !p.proprietario);
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

  /* All'accesso: unisce i propri playbook con quelli online e aggiunge
     quelli in cui si è co-allenatori. Restituisce gli id dei playbook
     condivisi che non sono più accessibili (invito tolto). */
  async sincronizza() {
    if (!Cloud.attivo) return [];
    try {
      await Cloud.accettaInviti().catch(() => 0); // se lo script non c'è ancora, si va avanti
      const righe = await Cloud.scaricaPlaybook();
      const io = Cloud.utente.id;
      const miei = righe.filter((r) => r.utente === io).map((r) => r.dati).filter((p) => !this.daEliminare.has(p.id));
      const altrui = righe.filter((r) => r.utente !== io);
      const inviti = new Map();
      if (altrui.length) {
        for (const c of await Cloud.mieCollaborazioni().catch(() => [])) inviti.set(c.playbook, c);
      }
      const condivisi = altrui.map((r) => {
        const invito = inviti.get(r.dati.id) || {};
        return { ...r.dati, proprietario: r.utente, squadra: invito.squadra || "", permesso: invito.permesso || "modifica" };
      });
      // Quanti co-allenatori hanno i miei playbook
      try {
        const { data } = await Cloud.client.from("collaboratori").select("playbook").eq("proprietario", io);
        if (data) {
          const conta = {};
          for (const r of data) conta[r.playbook] = (conta[r.playbook] || 0) + 1;
          scriviLocale(chiaveStaff(), conta);
        }
      } catch { /* script dei co-allenatori non ancora eseguito */ }

      const perId = new Map(miei.map((p) => [p.id, p]));
      const locali = this.tutti();
      for (const p of locali) {
        if (p.proprietario) continue; // i condivisi arrivano sempre da online
        const remoto = perId.get(p.id);
        if (!remoto || p.modificato > remoto.modificato) {
          perId.set(p.id, p);
          this.daInviare.add(p.id);
        }
      }
      const idCondivisi = new Set(condivisi.map((p) => p.id));
      const persi = locali.filter((p) => p.proprietario && !idCondivisi.has(p.id)).map((p) => p.id);
      this._scrivi([...perId.values(), ...condivisi]);
      this._ricorda();
      await this.invia();
      return persi;
    } catch (errore) {
      console.warn("Playbook non sincronizzati (uso la copia sul computer):", errore);
      return [];
    }
  },
};

let playbookCorrente = null;

/* ---------- Piccoli aiuti ---------- */
/* Gli schemi di un playbook nel suo ordine: quello scelto dal coach
   (playbook.ordine, vedi riordino.js); gli schemi nuovi stanno in cima. */
function schemiDelPlaybook(id = playbookCorrente && playbookCorrente.id) {
  const schemi = Dati.tutti().filter((s) => s.playbook === id);
  const pb = Playbook.trova(id);
  if (!pb || !Array.isArray(pb.ordine) || !pb.ordine.length) return schemi;
  const posto = new Map(pb.ordine.map((x, i) => [x, i]));
  return [
    ...schemi.filter((s) => !posto.has(s.id)),
    ...schemi.filter((s) => posto.has(s.id)).sort((a, b) => posto.get(a.id) - posto.get(b.id)),
  ];
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
  mostraContoProposte();
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
    if (pb.proprietario) {
      scheda.classList.add("condiviso");
      corpo.insertBefore(elemento("span", "badge-staff", `👥 ${testoStaff(pb)}`), corpo.querySelector("h3"));
    } else if (staffDi(pb.id)) {
      const n = staffDi(pb.id);
      corpo.insertBefore(elemento("span", "badge-staff", `👥 ${n} ${n === 1 ? "co-allenatore" : "co-allenatori"}`), corpo.querySelector("h3"));
    }
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
  // Un playbook condiviso con me: lo modifico, ma lo gestisce il proprietario
  const voci = pb.proprietario ? [
    ["Apri", () => apriPlaybook(pb.id)],
    ["Duplica (una copia tutta mia)", () => duplicaPlaybook(pb)],
    ["Esporta (copia di sicurezza)", () => esportaPlaybook(pb)],
    ["Lascia il playbook…", () => lasciaPlaybook(pb), "distruttiva"],
  ] : [
    ["Apri", () => apriPlaybook(pb.id)],
    ["Rinomina…", () => apriFoglioPlaybook(pb)],
    ["Condividi e co-allenatori…", () => apriFoglioCondividi(pb)],
    ["Duplica", () => duplicaPlaybook(pb)],
    ["Rinomina un ruolo…", () => apriRinominaRuolo(pb)],
    ["Applica dati da file (numeri, situazioni, categorie, tag)…", () => scegliFilePartita(pb)],
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
  aggiornaPermessiUI();
  aggiornaOrdineSeCondiviso(pb.id);
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
  $("#badge-staff").hidden = !playbookCorrente.proprietario || Boolean(CODICE_VISTA);
  $("#badge-staff").textContent = playbookCorrente.proprietario ? `👥 ${testoStaff(playbookCorrente)}` : "";
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
    if (Cloud.attivo) { // via anche il link e gli inviti dei co-allenatori
      Cloud.eliminaCondivisione(pb.id).catch(() => {});
      Cloud.client.from("collaboratori").delete().eq("playbook", pb.id).then(() => {}, () => {});
    }
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

/* ---------- Numeri di chiamata e situazioni da un file ----------
   File { tipo: "playbook-app/partita", schemi: [{ nome, chiamata, situazioni }] }
   Gli schemi si riconoscono dal nome (maiuscole e spazi non contano).
   Si applica a un playbook esistente, senza toccare disegni e note. */
const TIPO_FILE_PARTITA = "playbook-app/partita";

function scegliFilePartita(pb) {
  const input = Object.assign(document.createElement("input"), { type: "file", accept: ".json,application/json" });
  input.addEventListener("change", () => { if (input.files[0]) applicaFilePartita(pb, input.files[0]); });
  input.click();
}

async function applicaFilePartita(pb, file) {
  let dati;
  try { dati = JSON.parse(await file.text()); } catch { dati = null; }
  if (!dati || dati.tipo !== TIPO_FILE_PARTITA || !Array.isArray(dati.schemi)) {
    mostraAvviso("Il file non contiene dati degli schemi per questa app");
    return;
  }
  const chiave = (t) => (t || "").toLocaleLowerCase("it").replace(/\s+/g, " ").trim();
  const perNome = new Map(dati.schemi.map((x) => [chiave(x.nome), x]));
  const validi = new Set(SITUAZIONI.map((x) => x.id));
  const schemi = schemiDelPlaybook(pb.id);
  const prima = JSON.parse(JSON.stringify(schemi));
  const cambiati = [];
  for (const s of schemi) {
    const x = perNome.get(chiave(s.nome));
    if (!x) continue;
    // Si applicano solo i dati presenti nel file: il resto dello schema non cambia
    if ("chiamata" in x) { if (x.chiamata) s.chiamata = x.chiamata; else delete s.chiamata; }
    if ("situazioni" in x) s.situazioni = (x.situazioni || []).filter((id) => validi.has(id));
    if ("categoria" in x) {
      if ((CATEGORIE[s.lato] || []).some((c) => c.id === x.categoria)) s.categoria = x.categoria;
      else delete s.categoria;
    }
    if ("tag" in x) {
      const tag = [...new Set((x.tag || []).map((t) => String(t).trim().toLowerCase().slice(0, 20)).filter(Boolean))].slice(0, 8);
      if (tag.length) s.tag = tag; else delete s.tag;
    }
    cambiati.push(s);
    perNome.delete(chiave(s.nome));
  }
  if (!cambiati.length) {
    mostraAvviso(`Nessuno schema di «${pb.nome}» ha i nomi del file`);
    return;
  }
  Dati.aggiornaMolti(cambiati);
  if (playbookCorrente && playbookCorrente.id === pb.id) aggiornaDopoPartita();
  const mancanti = [...perNome.values()].map((x) => x.nome);
  const cosa = ["chiamata", "situazioni", "categoria", "tag"].filter((k) => dati.schemi.some((x) => k in x))
    .map((k) => ({ chiamata: "numeri", situazioni: "situazioni", categoria: "categorie", tag: "tag" })[k]).join(", ");
  const testo = `Applicati (${cosa}) a ${cambiati.length} schemi`
    + (mancanti.length ? ` · non trovati: ${mancanti.slice(0, 4).join(", ")}${mancanti.length > 4 ? "…" : ""}` : "");
  mostraAvviso(testo, () => {
    Dati.aggiornaMolti(prima.filter((s) => cambiati.some((c) => c.id === s.id)));
    if (playbookCorrente && playbookCorrente.id === pb.id) aggiornaDopoPartita();
  });
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

/* ==========================================================================
   RINOMINA UN RUOLO in tutto il playbook (es. H -> RB)
   Cambia la sigla in tutti gli schemi e nelle formazioni salvate usate
   dal playbook. Si può annullare subito dopo.
   ========================================================================== */
let playbookRuolo = null;

// Sigle presenti nel playbook, per lato, con quanti schemi le usano
function ruoliDelPlaybook(pb) {
  const conta = new Map();
  for (const s of schemiDelPlaybook(pb.id)) {
    for (const sigla of new Set(s.giocatori.map((g) => g.etichetta))) {
      const k = `${s.lato}|${sigla}`;
      conta.set(k, (conta.get(k) || 0) + 1);
    }
  }
  return [...conta.entries()]
    .map(([k, n]) => ({ chiave: k, lato: k.split("|")[0], sigla: k.split("|")[1], schemi: n }))
    .sort((a, b) => (a.lato === b.lato ? a.sigla.localeCompare(b.sigla) : a.lato === "attacco" ? -1 : 1));
}

// Cosa cambierebbe: schemi e formazioni che contengono la sigla
function daRinominare(pb, lato, sigla) {
  const schemi = schemiDelPlaybook(pb.id).filter((s) => s.lato === lato && s.giocatori.some((g) => g.etichetta === sigla));
  // tutte le tue formazioni salvate dello stesso formato e lato (anche quelle non ancora usate)
  const formazioni = FormazioniMie.perLato(lato, pb.formato).filter((f) =>
    f.giocatori.some((g) => g.etichetta === sigla));
  return { schemi, formazioni };
}

function apriRinominaRuolo(pb) {
  playbookRuolo = pb;
  const ruoli = ruoliDelPlaybook(pb);
  const scelta = $("#ruolo-da");
  scelta.innerHTML = "";
  const dueLati = new Set(ruoli.map((r) => r.lato)).size > 1;
  for (const r of ruoli) {
    const testo = `${r.sigla}${dueLati ? ` · ${NOMI_LATO[r.lato]}` : ""} (${r.schemi} ${r.schemi === 1 ? "schema" : "schemi"})`;
    scelta.add(new Option(testo, r.chiave));
  }
  $("#testo-ruolo").textContent = `In tutti gli schemi di «${pb.nome}» e nelle tue formazioni ${descriviPlaybook(pb)}.`;
  $("#ruolo-a").value = "";
  $("#errore-ruolo").textContent = ruoli.length ? "" : "Questo playbook non ha ancora giocatori.";
  aggiornaAnteprimaRuolo();
  $("#velo").hidden = false;
  $("#foglio-ruolo").hidden = false;
  requestAnimationFrame(() => {
    $("#velo").classList.add("visibile");
    $("#foglio-ruolo").classList.add("visibile");
    $("#ruolo-a").focus();
  });
}

function chiudiFoglioRuolo() {
  $("#velo").classList.remove("visibile");
  $("#foglio-ruolo").classList.remove("visibile");
  setTimeout(() => {
    $("#velo").hidden = true;
    $("#foglio-ruolo").hidden = true;
  }, 220);
}

function aggiornaAnteprimaRuolo() {
  const valore = $("#ruolo-da").value;
  const nuovo = $("#ruolo-a").value.trim().toUpperCase();
  const box = $("#anteprima-ruolo");
  if (!valore || !playbookRuolo) { box.textContent = ""; return; }
  const [lato, sigla] = valore.split("|");
  const { schemi, formazioni } = daRinominare(playbookRuolo, lato, sigla);
  const parti = [`${schemi.length} ${schemi.length === 1 ? "schema" : "schemi"}`];
  if (formazioni.length) parti.push(`${formazioni.length} ${formazioni.length === 1 ? "formazione" : "formazioni"}`);
  box.innerHTML = "";
  const da = Object.assign(document.createElement("b"), { textContent: sigla });
  const a = Object.assign(document.createElement("b"), { textContent: nuovo || "…" });
  box.append(da, " → ", a, ` in ${parti.join(" e ")}`);
}
$("#ruolo-da").addEventListener("change", aggiornaAnteprimaRuolo);
$("#ruolo-a").addEventListener("input", (e) => {
  e.target.value = e.target.value.toUpperCase();
  aggiornaAnteprimaRuolo();
});
$("#btn-ruolo-annulla").addEventListener("click", chiudiFoglioRuolo);

$("#foglio-ruolo").addEventListener("submit", (e) => {
  e.preventDefault();
  const valore = $("#ruolo-da").value;
  const nuovo = $("#ruolo-a").value.trim().toUpperCase();
  if (!valore) return;
  const [lato, sigla] = valore.split("|");
  if (!nuovo) { $("#errore-ruolo").textContent = "Scrivi il nuovo nome del ruolo."; return; }
  if (nuovo === sigla) { $("#errore-ruolo").textContent = "Il nuovo nome è uguale a quello attuale."; return; }

  const { schemi, formazioni } = daRinominare(playbookRuolo, lato, sigla);
  // Copia di prima, per "Annulla"
  const primaSchemi = JSON.parse(JSON.stringify(schemi));
  const primaFormazioni = JSON.parse(JSON.stringify(formazioni));
  for (const s of schemi) s.giocatori.forEach((g) => { if (g.etichetta === sigla) g.etichetta = nuovo; });
  Dati.aggiornaMolti(schemi);
  for (const f of formazioni) {
    f.giocatori.forEach((g) => { if (g.etichetta === sigla) g.etichetta = nuovo; });
    f.modificato = Date.now();
    FormazioniMie.ripristina(f);
  }
  dopoModificaRuoli();
  chiudiFoglioRuolo();
  festeggiaStemma();
  mostraAvviso(`${sigla} → ${nuovo} in ${schemi.length} ${schemi.length === 1 ? "schema" : "schemi"}`, () => {
    Dati.aggiornaMolti(primaSchemi);
    for (const f of primaFormazioni) FormazioniMie.ripristina(f);
    dopoModificaRuoli();
  });
});

// Ridisegna quello che è a schermo dopo il cambio dei ruoli
function dopoModificaRuoli() {
  if (schemaCorrente) {
    const aggiornato = Dati.trova(schemaCorrente.id);
    if (aggiornato) { schemaCorrente = aggiornato; ridisegna(); }
  }
  if (playbookCorrente) mostraElenco();
  if (!$("#home").hidden) disegnaHome();
}
