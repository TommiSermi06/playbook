/* ==========================================================================
   PLAYBOOK — versione per telefono
   --------------------------------------------------------------------------
   Stesso account e stessi dati della versione per computer (Supabase),
   pensata per GUARDARE gli schemi e usarli in partita:
   1. Accesso
   2. I tuoi playbook (anche quelli condivisi dallo staff)
   3. Elenco degli schemi: attacco/difesa, ricerca, filtro per situazione
   4. Schema: campo grande, tracce animate, numero, situazioni, note
      (scorri a destra/sinistra per passare al successivo)
   5. Partita: le chiamate divise per situazione, con i numeri grandi
   Chi può modificare il playbook può cambiare dal telefono numero,
   situazioni e note. Per disegnare si usa il computer.
   Funziona anche senza rete: mostra l'ultima copia scaricata.
   ========================================================================== */

const SITUAZIONI = [
  { id: "1-10", nome: "1° & 10" },
  { id: "2-corto", nome: "2° & corto" },
  { id: "2-lungo", nome: "2° & lungo" },
  { id: "3-corto", nome: "3° & corto" },
  { id: "3-medio", nome: "3° & medio" },
  { id: "3-lungo", nome: "3° & lungo" },
  { id: "red-zone", nome: "Red zone" },
  { id: "goal-line", nome: "Goal line" },
  { id: "2-minuti", nome: "2 minuti" },
  { id: "apertura", nome: "Apertura (script)" },
];
const NOME_SITUAZIONE = Object.fromEntries(SITUAZIONI.map((s) => [s.id, s.nome]));

/* ---------- Stato dell'app ---------- */
const Stato = {
  profilo: {},        // nome e logo della squadra
  playbook: [],       // i miei e quelli condivisi con me
  schemi: [],         // tutti gli schemi visibili
  formazioni: [],     // per mostrare il nome delle formazioni
  vista: false,       // vero se si sta guardando un link condiviso
  pb: null,           // playbook aperto
  lato: "attacco",
  filtro: "tutte",    // situazione scelta nei filtri
  cerca: "",
  elenco: [],         // schemi mostrati (per scorrere avanti/indietro)
  indice: 0,          // schema aperto nell'elenco
  zoom: true,         // campo ingrandito sulla zona utile
  latoPartita: "attacco",
};

/* cloud.js (lo stesso del computer) chiede chi è il proprietario di un
   playbook quando salva uno schema: glielo diciamo da qui. */
const Playbook = {
  trova(id) { return Stato.playbook.find((p) => p.id === id) || null; },
  proprietarioDi(id) { const pb = this.trova(id); return (pb && pb.proprietario) || null; },
  permesso(id) {
    if (Stato.vista) return "lettura";
    const pb = this.trova(id);
    if (!pb || !pb.proprietario) return "proprietario";
    return pb.permesso || "modifica";
  },
};
const puoModificare = (pb) => ["proprietario", "modifica"].includes(Playbook.permesso(pb && pb.id));

/* ---------- Copia sul telefono (per usarla anche senza rete) ---------- */
const chiaveCopia = () => `playbook.m.copia.${Cloud.utente ? Cloud.utente.id : "vista"}`;
const chiaveInAttesa = () => `playbook.m.da-inviare.${Cloud.utente ? Cloud.utente.id : "vista"}`;

function salvaCopia() {
  scriviLocale(chiaveCopia(), {
    profilo: Stato.profilo, playbook: Stato.playbook, schemi: Stato.schemi,
    formazioni: Stato.formazioni, quando: Date.now(),
  });
}
function leggiCopia() {
  const c = leggiLocale(chiaveCopia());
  if (!c) return false;
  Object.assign(Stato, { profilo: c.profilo || {}, playbook: c.playbook || [], schemi: c.schemi || [], formazioni: c.formazioni || [] });
  return true;
}

// Scarica tutto da Supabase (playbook, schemi, formazioni, squadra)
async function scaricaTutto() {
  await Cloud.accettaInviti().catch(() => 0);
  const [righe, schemi, formazioni, profilo] = await Promise.all([
    Cloud.scaricaPlaybook(),
    Cloud.scaricaSchemi(),
    Cloud.scaricaFormazioni().catch(() => []),
    Cloud.caricaProfilo().catch(() => ({})),
  ]);
  const io = Cloud.utente.id;
  const inviti = new Map();
  if (righe.some((r) => r.utente !== io)) {
    for (const c of await Cloud.mieCollaborazioni().catch(() => [])) inviti.set(c.playbook, c);
  }
  Stato.playbook = righe.map((r) => r.utente === io ? { ...r.dati } : {
    ...r.dati, proprietario: r.utente,
    squadra: (inviti.get(r.dati.id) || {}).squadra || "",
    permesso: (inviti.get(r.dati.id) || {}).permesso || "modifica",
  });
  // Le mie modifiche non ancora inviate restano
  const inAttesa = new Set(leggiLocale(chiaveInAttesa()) || []);
  const mie = new Map(Stato.schemi.filter((s) => inAttesa.has(s.id)).map((s) => [s.id, s]));
  Stato.schemi = schemi.map((s) => mie.get(s.id) || s);
  Stato.formazioni = formazioni.map(({ _utente, ...f }) => f);
  Stato.profilo = profilo || {};
  salvaCopia();
  inviaInAttesa();
}

// Manda online le modifiche fatte senza rete
async function inviaInAttesa() {
  const ids = leggiLocale(chiaveInAttesa()) || [];
  if (!ids.length || !Cloud.attivo) return;
  const schemi = Stato.schemi.filter((s) => ids.includes(s.id));
  try {
    await Cloud.salvaSchemi(schemi);
    scriviLocale(chiaveInAttesa(), []);
  } catch { /* si riprova al prossimo aggiornamento */ }
}

/* ---------- Piccoli aiuti ---------- */
function el(tag, classe, testo) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (testo !== undefined) e.textContent = testo;
  return e;
}
function svgCampo(schema, classe, opzioni) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", classe);
  svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
  disegnaCampo(svg, schema, opzioni);
  return svg;
}
function nomeFormazione(s) {
  if (!s.formazione) return "Nessuna formazione";
  if (s.formazione === "libera") return "Formazione libera";
  const mia = Stato.formazioni.find((f) => f.id === s.formazione);
  if (mia) return mia.nome;
  const f = (FORMAZIONI[s.lato] || []).find((x) => x.id === s.formazione);
  return f ? f.nome : "Personalizzata";
}
function descriviPlaybook(pb) {
  const f = FORMATI[pb.formato] || FORMATI["11"];
  return f.flag ? "Flag · 5 giocatori" : `Tackle · ${f.giocatori} giocatori`;
}
const ICONA_INDIETRO = '<svg width="13" height="21" viewBox="0 0 13 21"><path d="M11 2L2.5 10.5 11 19" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
const ICONA_FRECCIA = '<svg class="freccia" width="8" height="13" viewBox="0 0 8 13"><path d="M1.5 1.5l5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';

let timerToast = null;
function avviso(testo) {
  const t = $("#toast");
  t.textContent = testo;
  t.classList.add("visibile");
  clearTimeout(timerToast);
  timerToast = setTimeout(() => t.classList.remove("visibile"), 2600);
}

// Ordine degli schemi: prima quelli con il numero di chiamata, poi per formazione e nome
function ordinaSchemi(lista) {
  return [...lista].sort((a, b) =>
    (a.chiamata || 9999) - (b.chiamata || 9999)
    || nomeFormazione(a).localeCompare(nomeFormazione(b), "it")
    || (a.nome || "").localeCompare(b.nome || "", "it"));
}
const schemiDi = (pb) => Stato.schemi.filter((s) => s.playbook === pb.id && !s.bozza);

/* ==========================================================================
   NAVIGAZIONE: le schermate si impilano come in iOS
   ========================================================================== */
const pila = [];
function vai(id, { sostituisci = false } = {}) {
  const nuova = $("#" + id);
  const vecchia = pila.length ? $("#" + pila[pila.length - 1]) : null;
  if (sostituisci && vecchia) { vecchia.classList.add("fuori"); pila.pop(); }
  else if (vecchia) vecchia.classList.add("dietro");
  nuova.hidden = false;
  nuova.classList.add("fuori");
  void nuova.offsetWidth; // fa partire l'animazione
  nuova.classList.remove("fuori", "dietro");
  nuova.scrollTop = 0;
  pila.push(id);
  if (!sostituisci) history.pushState({ schermata: id }, "");
}
function indietro() {
  if (pila.length < 2) return;
  const via = $("#" + pila.pop());
  via.classList.add("fuori");
  const torna = $("#" + pila[pila.length - 1]);
  torna.classList.remove("dietro");
  setTimeout(() => { via.hidden = true; }, 320);
  if (pila[pila.length - 1] === "schermata-playbook") mostraElenco();
}
// Il tasto "indietro" di Android (o il gesto) torna alla schermata precedente
window.addEventListener("popstate", () => { if (!chiudiFogli()) indietro(); });
document.querySelectorAll("[data-indietro]").forEach((b) => b.addEventListener("click", () => history.back()));

// La barra mostra il titolo piccolo e il bordo quando si scorre
document.querySelectorAll(".schermata").forEach((s) => {
  s.addEventListener("scroll", () => {
    const barra = s.querySelector(".barra");
    if (barra) barra.classList.toggle("con-bordo", s.scrollTop > 30);
  }, { passive: true });
});

/* ==========================================================================
   1. ACCESSO
   ========================================================================== */
let modo = "accedi";
function impostaModo(m) {
  modo = m;
  $("#accesso-titolo").textContent = { accedi: "Bentornato, coach", registrati: "Crea il tuo account", recupera: "Password dimenticata" }[m];
  $("#accesso-invia").textContent = { accedi: "Accedi", registrati: "Crea account", recupera: "Invia il link" }[m];
  $("#riga-password").hidden = m === "recupera";
  $("#link-dimenticata").hidden = m !== "accedi";
  $("#link-cambia").textContent = m === "accedi" ? "Non hai un account? Registrati" : "Hai già un account? Accedi";
  $("#accesso-messaggio").textContent = "";
}
$("#link-cambia").addEventListener("click", () => impostaModo(modo === "accedi" ? "registrati" : "accedi"));
$("#link-dimenticata").addEventListener("click", () => impostaModo("recupera"));

$("#form-accesso").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("#accesso-email").value.trim();
  const password = $("#accesso-password").value;
  const msg = $("#accesso-messaggio");
  const btn = $("#accesso-invia");
  btn.disabled = true;
  msg.className = "messaggio";
  msg.textContent = "";
  try {
    if (modo === "accedi") {
      await Cloud.accedi(email, password);
      await entra();
    } else if (modo === "registrati") {
      const esito = await Cloud.registrati(email, password);
      if (esito.daConfermare) {
        impostaModo("accedi");
        msg.className = "messaggio ok";
        msg.textContent = `Ti abbiamo mandato una mail a ${email}: conferma e poi accedi.`;
      } else await entra();
    } else {
      await Cloud.recuperaPassword(email);
      msg.className = "messaggio ok";
      msg.textContent = "Fatto! Controlla la posta e apri il link.";
    }
  } catch (errore) {
    msg.textContent = errore.message;
  } finally {
    btn.disabled = false;
  }
});

/* ==========================================================================
   2. I TUOI PLAYBOOK
   ========================================================================== */
async function entra() {
  const offline = !navigator.onLine;
  const cEraCopia = leggiCopia();
  mostraHome();
  vai("schermata-home", { sostituisci: true });
  if (offline && cEraCopia) { avviso("Senza rete: stai vedendo l'ultima copia"); return; }
  try {
    await scaricaTutto();
    mostraHome();
  } catch {
    avviso(cEraCopia ? "Senza rete: stai vedendo l'ultima copia" : "Non riesco a scaricare i playbook");
  }
}

function mostraHome() {
  $("#home-squadra").textContent = Stato.profilo.nome_squadra || "I tuoi playbook";
  const lista = $("#lista-playbook");
  lista.innerHTML = "";
  const miei = Stato.playbook.filter((p) => !p.proprietario).sort((a, b) => a.nome.localeCompare(b.nome, "it"));
  const staff = Stato.playbook.filter((p) => p.proprietario).sort((a, b) => a.nome.localeCompare(b.nome, "it"));
  $("#home-vuota").hidden = Stato.playbook.length > 0;
  $("#titolo-miei").hidden = !miei.length;
  $("#titolo-staff").hidden = !staff.length;
  disegnaGruppoPlaybook($("#lista-playbook"), miei);
  disegnaGruppoPlaybook($("#lista-staff"), staff);
}

function disegnaGruppoPlaybook(contenitore, lista) {
  contenitore.innerHTML = "";
  contenitore.hidden = !lista.length;
  lista.forEach((pb, i) => {
    const schemi = schemiDi(pb);
    const riga = el("button", "riga riga-playbook toccabile appare");
    riga.style.animationDelay = `${i * 0.04}s`;
    const flag = (FORMATI[pb.formato] || {}).flag;
    riga.appendChild(el("span", "icona-playbook" + (flag ? " flag" : ""), flag ? "🚩" : "🏈"));
    const testi = el("span", "riga-testi");
    testi.appendChild(el("span", "riga-titolo", pb.nome));
    const att = schemi.filter((s) => s.lato === "attacco").length;
    testi.appendChild(el("span", "riga-sotto", `${att} di attacco · ${schemi.length - att} di difesa`));
    const etichette = el("span", "etichette");
    etichette.appendChild(el("span", "etichetta-pill accento", descriviPlaybook(pb)));
    if (pb.proprietario) {
      const extra = { proposta: " · solo proposte", lettura: " · solo lettura" }[pb.permesso] || "";
      etichette.appendChild(el("span", "etichetta-pill staff", `👥 ${pb.squadra || "Staff"}${extra}`));
    }
    testi.appendChild(etichette);
    riga.appendChild(testi);
    riga.insertAdjacentHTML("beforeend", ICONA_FRECCIA);
    riga.addEventListener("click", () => apriPlaybook(pb));
    contenitore.appendChild(riga);
  });
}

// Tira giù per aggiornare (o il pulsante ↻)
$("#btn-aggiorna").addEventListener("click", async () => {
  const b = $("#btn-aggiorna");
  b.classList.add("gira");
  try { await scaricaTutto(); mostraHome(); avviso("Aggiornato"); }
  catch { avviso("Nessuna connessione"); }
  finally { b.classList.remove("gira"); }
});

/* ---------- Foglio "Account" ---------- */
$("#btn-account").addEventListener("click", () => {
  $("#account-email").textContent = (Cloud.utente && Cloud.utente.email) || "";
  $("#account-squadra").textContent = Stato.profilo.nome_squadra || "—";
  apriFoglio("#foglio-account");
});
$("#btn-esci").addEventListener("click", async () => {
  await Cloud.esci().catch(() => {});
  location.reload();
});

/* ==========================================================================
   3. ELENCO DEGLI SCHEMI DI UN PLAYBOOK
   ========================================================================== */
function apriPlaybook(pb, { sostituisci = false } = {}) {
  Stato.pb = pb;
  Stato.filtro = "tutte";
  Stato.cerca = "";
  $("#cerca").value = "";
  const schemi = schemiDi(pb);
  Stato.lato = schemi.some((s) => s.lato === "attacco") || !schemi.length ? "attacco" : "difesa";
  $("#pb-titolo").textContent = pb.nome;
  $("#pb-barra-titolo").textContent = pb.nome;
  $("#pb-sotto").textContent = descriviPlaybook(pb) + (pb.proprietario ? ` · ${pb.squadra || "staff"}` : "");
  $("#banner-vista").hidden = !Stato.vista;
  $("#btn-pb-indietro").hidden = Stato.vista;
  impostaSegmentato($("#scelta-lato"), Stato.lato);
  mostraFiltri();
  mostraElenco();
  vai("schermata-playbook", { sostituisci });
}

function impostaSegmentato(gruppo, valore) {
  gruppo.querySelectorAll("button").forEach((b) => b.classList.toggle("attivo", b.dataset.valore === valore));
}
$("#scelta-lato").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
  Stato.lato = b.dataset.valore;
  impostaSegmentato($("#scelta-lato"), Stato.lato);
  mostraFiltri();
  mostraElenco();
}));
$("#cerca").addEventListener("input", (e) => { Stato.cerca = e.target.value.trim().toLowerCase(); mostraElenco(); });

// Filtri per situazione: solo quelle usate da almeno uno schema
function mostraFiltri() {
  const box = $("#filtri");
  box.innerHTML = "";
  const schemi = schemiDi(Stato.pb).filter((s) => s.lato === Stato.lato);
  const usate = SITUAZIONI.filter((sit) => schemi.some((s) => (s.situazioni || []).includes(sit.id)));
  box.hidden = !usate.length;
  for (const sit of [{ id: "tutte", nome: "Tutti" }, ...usate]) {
    const b = el("button", "filtro toccabile" + (Stato.filtro === sit.id ? " attivo" : ""), sit.nome);
    b.addEventListener("click", () => {
      Stato.filtro = sit.id;
      box.querySelectorAll(".filtro").forEach((x) => x.classList.toggle("attivo", x === b));
      mostraElenco();
    });
    box.appendChild(b);
  }
}

function mostraElenco() {
  if (!Stato.pb) return;
  let schemi = schemiDi(Stato.pb).filter((s) => s.lato === Stato.lato);
  if (Stato.filtro !== "tutte") schemi = schemi.filter((s) => (s.situazioni || []).includes(Stato.filtro));
  if (Stato.cerca) schemi = schemi.filter((s) =>
    (s.nome || "").toLowerCase().includes(Stato.cerca) || nomeFormazione(s).toLowerCase().includes(Stato.cerca)
    || String(s.chiamata || "") === Stato.cerca);
  Stato.elenco = ordinaSchemi(schemi);
  const lista = $("#lista-schemi");
  lista.innerHTML = "";
  $("#conteggio").textContent = `${Stato.elenco.length} ${Stato.elenco.length === 1 ? "schema" : "schemi"}`;
  $("#elenco-vuoto").hidden = Stato.elenco.length > 0;
  lista.hidden = !Stato.elenco.length;
  Stato.elenco.forEach((s, i) => {
    const riga = el("button", "riga riga-schema toccabile");
    riga.appendChild(svgCampo(s, "miniatura", { miniatura: true, ritaglio: true }));
    const testi = el("span", "riga-testi");
    testi.appendChild(el("span", "riga-titolo", s.nome || "Senza nome"));
    const sit = (s.situazioni || []).map((x) => NOME_SITUAZIONE[x]).filter(Boolean);
    testi.appendChild(el("span", "riga-sotto", [nomeFormazione(s), ...sit].join(" · ")));
    riga.appendChild(testi);
    if (s.chiamata) riga.appendChild(el("span", "numero-chiamata", String(s.chiamata)));
    riga.addEventListener("click", () => apriSchema(i));
    lista.appendChild(riga);
  });
}

/* ==========================================================================
   4. LO SCHEMA
   ========================================================================== */
function apriSchema(indice, { nuova = true } = {}) {
  Stato.indice = indice;
  mostraSchema(false);
  if (nuova) vai("schermata-schema");
}

function schemaAperto() { return Stato.elenco[Stato.indice]; }

function mostraSchema(anima) {
  const s = schemaAperto();
  if (!s) return;
  $("#schema-titolo").textContent = s.nome || "Senza nome";
  $("#schema-barra-titolo").textContent = s.nome || "Senza nome";
  disegnaCampo($("#campo-grande"), s, { anima, ritaglio: Stato.zoom, logo: Stato.profilo.logo_url });
  $("#btn-zoom").textContent = Stato.zoom ? "Campo intero" : "Ingrandisci";
  $("#indice-schema").textContent = Stato.elenco.length > 1
    ? `${Stato.indice + 1} di ${Stato.elenco.length} · scorri per cambiare` : "";
  const num = $("#numero-grande");
  num.textContent = s.chiamata ? String(s.chiamata) : "—";
  num.classList.toggle("vuoto-numero", !s.chiamata);
  $("#schema-formazione").textContent = nomeFormazione(s);
  const pillole = $("#schema-situazioni");
  pillole.innerHTML = "";
  const sit = (s.situazioni || []).filter((x) => NOME_SITUAZIONE[x]);
  for (const id of sit) pillole.appendChild(el("span", "pillola attiva", NOME_SITUAZIONE[id]));
  if (!sit.length) pillole.appendChild(el("span", "riga-sotto", "Nessuna situazione"));
  const note = $("#schema-note");
  note.textContent = s.note || "Nessuna nota";
  note.classList.toggle("vuote", !s.note);
  $("#btn-modifica").hidden = !puoModificare(Stato.pb);
}

$("#btn-anima").addEventListener("click", () => mostraSchema(true));
$("#btn-zoom").addEventListener("click", () => { Stato.zoom = !Stato.zoom; mostraSchema(false); });

// Scorri a destra / sinistra sul campo per cambiare schema
(() => {
  let x0 = null, y0 = null;
  const area = $("#contenitore-campo");
  area.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  area.addEventListener("touchend", (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return;
    const nuovo = Stato.indice + (dx < 0 ? 1 : -1);
    if (nuovo < 0 || nuovo >= Stato.elenco.length) return;
    const campo = $("#campo-grande");
    campo.classList.remove("scorri-sx", "scorri-dx");
    void campo.offsetWidth;
    campo.classList.add(dx < 0 ? "scorri-sx" : "scorri-dx");
    apriSchema(nuovo, { nuova: false });
  });
})();

/* ---------- Modifica veloce: numero, situazioni, note ---------- */
let bozzaSituazioni = new Set();
$("#btn-modifica").addEventListener("click", () => {
  const s = schemaAperto();
  $("#mod-numero").value = s.chiamata || "";
  $("#mod-note").value = s.note || "";
  bozzaSituazioni = new Set(s.situazioni || []);
  const box = $("#mod-situazioni");
  box.innerHTML = "";
  for (const sit of SITUAZIONI) {
    const b = el("button", "pillola toccabile" + (bozzaSituazioni.has(sit.id) ? " attiva" : ""), sit.nome);
    b.type = "button";
    b.addEventListener("click", () => {
      bozzaSituazioni.has(sit.id) ? bozzaSituazioni.delete(sit.id) : bozzaSituazioni.add(sit.id);
      b.classList.toggle("attiva", bozzaSituazioni.has(sit.id));
    });
    box.appendChild(b);
  }
  apriFoglio("#foglio-modifica");
});

$("#mod-salva").addEventListener("click", async () => {
  const s = schemaAperto();
  const n = parseInt($("#mod-numero").value, 10);
  const doppione = n && Stato.schemi.find((x) => x.id !== s.id && x.playbook === s.playbook && x.lato === s.lato && x.chiamata === n);
  if (doppione) { avviso(`Il ${n} è già usato da «${doppione.nome || "Senza nome"}»`); return; }
  if (n > 0) s.chiamata = Math.min(999, n); else delete s.chiamata;
  s.situazioni = SITUAZIONI.map((x) => x.id).filter((id) => bozzaSituazioni.has(id));
  s.note = $("#mod-note").value;
  s.modificato = Date.now();
  salvaCopia();
  chiudiFogli();
  mostraSchema(false);
  try {
    await Cloud.salvaSchemi([s]);
    avviso("Salvato");
  } catch {
    const ids = new Set(leggiLocale(chiaveInAttesa()) || []);
    ids.add(s.id);
    scriviLocale(chiaveInAttesa(), [...ids]);
    avviso("Salvato sul telefono: lo mando appena torna la rete");
  }
});
$("#mod-annulla").addEventListener("click", () => chiudiFogli());

/* ==========================================================================
   5. PARTITA: le chiamate divise per situazione
   ========================================================================== */
$("#btn-partita").addEventListener("click", () => {
  Stato.latoPartita = Stato.lato;
  impostaSegmentato($("#scelta-lato-partita"), Stato.latoPartita);
  mostraPartita();
  vai("schermata-partita");
});
$("#scelta-lato-partita").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
  Stato.latoPartita = b.dataset.valore;
  impostaSegmentato($("#scelta-lato-partita"), Stato.latoPartita);
  mostraPartita();
}));

function mostraPartita() {
  const box = $("#lista-partita");
  box.innerHTML = "";
  const schemi = schemiDi(Stato.pb).filter((s) => s.lato === Stato.latoPartita);
  let quante = 0;
  for (const sit of SITUAZIONI) {
    const qui = ordinaSchemi(schemi.filter((s) => (s.situazioni || []).includes(sit.id)));
    if (!qui.length) continue;
    quante++;
    box.appendChild(el("p", "titolo-sezione", `${sit.nome} · ${qui.length}`));
    const gruppo = el("div", "gruppo");
    for (const s of qui) {
      const riga = el("button", "riga riga-chiamata toccabile");
      riga.appendChild(el("span", "numero-chiamata", s.chiamata ? String(s.chiamata) : "–"));
      const testi = el("span", "riga-testi");
      testi.appendChild(el("span", "riga-titolo", s.nome || "Senza nome"));
      testi.appendChild(el("span", "riga-sotto", nomeFormazione(s)));
      riga.appendChild(testi);
      riga.insertAdjacentHTML("beforeend", ICONA_FRECCIA);
      riga.addEventListener("click", () => {
        Stato.elenco = qui;
        apriSchema(qui.indexOf(s));
      });
      gruppo.appendChild(riga);
    }
    box.appendChild(gruppo);
  }
  $("#partita-vuota").hidden = quante > 0;
}

/* ==========================================================================
   FOGLI DAL BASSO
   ========================================================================== */
function apriFoglio(sel) {
  $("#velo").hidden = false;
  $(sel).hidden = false;
  requestAnimationFrame(() => {
    $("#velo").classList.add("visibile");
    $(sel).classList.add("visibile");
  });
}
function chiudiFogli() {
  const aperti = [...document.querySelectorAll(".foglio.visibile")];
  if (!aperti.length) return false;
  $("#velo").classList.remove("visibile");
  aperti.forEach((f) => f.classList.remove("visibile"));
  setTimeout(() => {
    $("#velo").hidden = true;
    aperti.forEach((f) => { f.hidden = true; });
  }, 320);
  return true;
}
$("#velo").addEventListener("click", chiudiFogli);
$("#btn-account-chiudi").addEventListener("click", chiudiFogli);

/* ==========================================================================
   AVVIO
   ========================================================================== */
async function avvio() {
  Cloud.inizializza();
  history.replaceState({ schermata: "avvio" }, "");

  // Link condiviso in sola lettura: ?vedi=CODICE
  if (CODICE_VISTA) {
    Stato.vista = true;
    try {
      const dati = await Cloud.apriCondivisione(CODICE_VISTA);
      if (!dati || !dati.playbook) throw new Error();
      Stato.playbook = [dati.playbook];
      Stato.schemi = dati.schemi || [];
      Stato.formazioni = dati.formazioni || [];
      Stato.profilo = dati.squadra || {};
      $("#avvio").hidden = true;
      apriPlaybook(dati.playbook);
    } catch {
      $("#avvio-testo").textContent = "Questo link non è più attivo: chiedi al coach un link nuovo.";
    }
    return;
  }

  const utente = await Cloud.sessione().catch(() => null);
  $("#avvio").hidden = true;
  if (utente) await entra();
  else { impostaModo("accedi"); vai("schermata-accesso", { sostituisci: true }); }
}

// Quando torna la rete, mando le modifiche rimaste sul telefono
window.addEventListener("online", inviaInAttesa);

// Funziona anche senza rete (e si può aggiungere alla schermata Home)
if ("serviceWorker" in navigator && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

avvio();
