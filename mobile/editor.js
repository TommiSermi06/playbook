/* ==========================================================================
   EDITOR TOUCH (versione telefono)
   --------------------------------------------------------------------------
   Si disegna con il dito:
   - tocca un giocatore per selezionarlo, trascinalo per spostarlo
   - in basso: Formazione, + Giocatore, Ribalta, Annulla
   - con un giocatore selezionato: Traccia (route pronte, movimenti del QB,
     difesa), Disegna (con il dito), Sigla, Togli
   Gli schemi si salvano nello stesso formato del computer, quindi si
   vedono e si modificano da tutte e due le parti.
   Valgono le stesse regole: nessuno oltre la linea, giocatori obbligatori
   del formato (11, 9, 7, Flag 5).
   ========================================================================== */

/* Lo schema che si sta modificando. Si chiama come sul computer perché
   le funzioni di ../tracce.js (uomo di linea, QB…) lo leggono da qui. */
let schemaCorrente = null;

// Le formazioni salvate dal coach (servono a ../formazioni.js e alle tracce)
const FormazioniMie = {
  trova(id) { return Stato.formazioni.find((f) => f.id === id) || null; },
  perLato(lato, formato = "11") {
    return Stato.formazioni.filter((f) => f.lato === lato && (f.formato || "11") === formato)
      .sort((a, b) => a.nome.localeCompare(b.nome, "it"));
  },
};

const Editor = {
  sel: null,        // id del giocatore selezionato
  storia: [],       // per "Annulla"
  disegno: null,    // disegno con il dito in corso: { tipo, curva, punti }
  tocco: null,      // trascinamento in corso
  timerInvio: null,
  daAnimare: null,
  zoom: true,       // inquadratura ingrandita sui giocatori (più facile con il dito)
  vista: null,      // inquadratura tenuta ferma mentre si trascina o si disegna
};

/* ---------- Regole (come sul computer) ---------- */
const DISTANZA_MIN_LINEA = 0.9;
function limitaY(lato, y) {
  const min = lato === "attacco" ? -YARDE_DIETRO + 0.6 : DISTANZA_MIN_LINEA;
  const max = lato === "attacco" ? -DISTANZA_MIN_LINEA : YARDE_AVANTI - 0.6;
  return +Math.min(max, Math.max(min, y)).toFixed(1);
}

// Pedine disponibili per lato e formato
function pedineDelFormato() {
  const flag = formatoDi(schemaCorrente).flag;
  if (schemaCorrente.lato === "attacco") {
    return flag
      ? [{ gruppo: "Centro", sigle: ["C"] }, { gruppo: "Backfield", sigle: ["QB", "RB"] }, { gruppo: "Ricevitori", sigle: ["X", "Y", "Z", "H", "WR"] }]
      : [{ gruppo: "Linea", sigle: ["C", "G", "T"] }, { gruppo: "Backfield", sigle: ["QB", "RB", "FB"] }, { gruppo: "Ricevitori", sigle: ["X", "Y", "Z", "H", "TE", "WR"] }];
  }
  return flag
    ? [{ gruppo: "Rusher", sigle: ["R"] }, { gruppo: "Linebacker", sigle: ["W", "M"] }, { gruppo: "Secondaria", sigle: ["C", "FS", "SS", "NB"] }]
    : [{ gruppo: "Linea", sigle: ["E", "T", "N", "DE"] }, { gruppo: "Linebacker", sigle: ["W", "M", "S", "B"] }, { gruppo: "Secondaria", sigle: ["C", "FS", "SS", "NB"] }];
}

// Posizione tipica di un ruolo (dalle formazioni pronte), o un posto libero vicino
function posizioneTipica(lato, sigla) {
  const libero = (x, y) => schemaCorrente.giocatori.every((g) => Math.hypot(g.x - x, g.y - y) > 1.6);
  const formato = formatoDi(schemaCorrente).id;
  for (const f of [...formazioniPronte(lato, formato), ...FORMAZIONI[lato].filter((x) => x.formato !== formato)]) {
    for (const g of f.giocatori) if (g.etichetta === sigla && libero(g.x, g.y)) return { x: g.x, y: g.y };
  }
  const base = lato === "attacco" ? { x: CENTRO, y: -4 } : { x: CENTRO, y: 5 };
  for (let passo = 0; passo < 20; passo++) {
    const x = base.x + (passo % 2 ? 1 : -1) * Math.ceil(passo / 2) * 2.4;
    if (libero(x, base.y)) return { x, y: base.y };
  }
  return base;
}

/* ==========================================================================
   APRIRE E CHIUDERE L'EDITOR
   ========================================================================== */
function nuovoSchema() {
  const adesso = Date.now();
  const s = {
    id: "s_" + adesso.toString(36) + Math.random().toString(36).slice(2, 8),
    nome: "", lato: Stato.lato, playbook: Stato.pb.id, formato: Stato.pb.formato || "11",
    formazione: null, ribaltato: false, bloccato: false, giocatori: [], note: "",
    creato: adesso, modificato: adesso,
  };
  apriEditor(s, { nuovo: true });
}

function apriEditor(s, { nuovo = false } = {}) {
  schemaCorrente = JSON.parse(JSON.stringify(s));
  Editor.sel = null;
  Editor.storia = [];
  Editor.disegno = null;
  Editor.nuovo = nuovo;
  $("#nome-editor").value = schemaCorrente.nome || "";
  vai("schermata-editor");
  disegnaEditor();
  // Campo vuoto: si parte scegliendo la formazione
  if (!schemaCorrente.giocatori.length) setTimeout(apriFoglioFormazioni, 350);
}

$("#btn-nuovo-schema").addEventListener("click", nuovoSchema);

// "Fine": salva subito e torna indietro
$("#btn-fine-editor").addEventListener("click", () => {
  salvaEditor({ subito: true });
  history.back();
});

/* ---------- Disegno ---------- */
function disegnaEditor() {
  disegnaCampo($("#campo-editor"), schemaCorrente, {
    selezionato: Editor.sel, anima: Editor.daAnimare || false, logo: Stato.profilo.logo_url,
    ritaglio: Editor.zoom && schemaCorrente.giocatori.length ? 6 : false, viewBox: Editor.vista,
  });
  $("#btn-zoom-editor").textContent = Editor.zoom ? "Campo intero" : "Ingrandisci";
  $("#btn-zoom-editor").hidden = !schemaCorrente.giocatori.length;
  Editor.daAnimare = null;
  const g = selezionato();
  const bloccato = Boolean(schemaCorrente.bloccato);
  $("#banner-bloccato").hidden = !bloccato;
  $("#strumenti-campo").hidden = Boolean(g) || Boolean(Editor.disegno) || bloccato;
  $("#strumenti-giocatore").hidden = !g || Boolean(Editor.disegno) || bloccato;
  $("#strumenti-disegno").hidden = !Editor.disegno;
  $("#btn-annulla-editor").disabled = !Editor.storia.length;
  if (g) $("#nome-selezionato").textContent = `${g.etichetta}${g.traccia ? " · " + (g.traccia.nome || infoTipo(g.traccia.tipo).nome) : ""}`;
  const stato = statoRegole(schemaCorrente);
  $("#conteggio-editor").textContent = schemaCorrente.giocatori.length
    ? `${schemaCorrente.giocatori.length}/${stato.formato.giocatori} giocatori${stato.mancanti ? " · mancano obbligatori" : ""}`
    : "Campo vuoto: scegli la formazione o aggiungi i giocatori";
  $("#campo-vuoto-editor").hidden = schemaCorrente.giocatori.length > 0;
}

function selezionato() {
  return schemaCorrente && schemaCorrente.giocatori.find((g) => g.id === Editor.sel) || null;
}

/* ---------- Annulla ---------- */
function ricorda() {
  Editor.storia.push(JSON.stringify({ g: schemaCorrente.giocatori, f: schemaCorrente.formazione, r: schemaCorrente.ribaltato }));
  if (Editor.storia.length > 40) Editor.storia.shift();
}
$("#btn-annulla-editor").addEventListener("click", () => {
  const ultimo = Editor.storia.pop();
  if (!ultimo) return;
  const { g, f, r } = JSON.parse(ultimo);
  Object.assign(schemaCorrente, { giocatori: g, formazione: f, ribaltato: r });
  if (!selezionato()) Editor.sel = null;
  disegnaEditor();
  salvaEditor();
});

/* ---------- Salvataggio: sul telefono subito, online dopo un attimo ---------- */
function salvaEditor({ subito = false } = {}) {
  schemaCorrente.nome = $("#nome-editor").value.trim();
  schemaCorrente.modificato = Date.now();
  const copia = JSON.parse(JSON.stringify(schemaCorrente));
  const i = Stato.schemi.findIndex((x) => x.id === copia.id);
  if (i >= 0) Stato.schemi[i] = copia; else Stato.schemi.push(copia);
  salvaCopia();
  clearTimeout(Editor.timerInvio);
  const invia = async () => {
    try {
      await Cloud.salvaSchemi([copia]);
    } catch {
      const ids = new Set(leggiLocale(chiaveInAttesa()) || []);
      ids.add(copia.id);
      scriviLocale(chiaveInAttesa(), [...ids]);
    }
  };
  if (subito) invia(); else Editor.timerInvio = setTimeout(invia, 1200);
}
$("#nome-editor").addEventListener("input", () => salvaEditor());

/* ==========================================================================
   TOCCHI SUL CAMPO: seleziona, trascina, disegna
   ========================================================================== */
const campoEditor = $("#campo-editor");

// Dal dito alle yarde del campo
function puntoCampo(e) {
  const pt = campoEditor.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  const p = pt.matrixTransform(campoEditor.getScreenCTM().inverse());
  return { x: p.x, y: YARDE_AVANTI - p.y };
}

function giocatoreVicino(p) {
  let migliore = null, distanza = 2.2; // yarde: il dito è più grosso del mouse
  for (const g of schemaCorrente.giocatori) {
    const d = Math.hypot(g.x - p.x, g.y - p.y);
    if (d < distanza) { distanza = d; migliore = g; }
  }
  return migliore;
}

campoEditor.addEventListener("pointerdown", (e) => {
  if (schemaCorrente.bloccato) return;
  e.preventDefault();
  const p = puntoCampo(e);
  campoEditor.setPointerCapture(e.pointerId);
  Editor.vista = campoEditor.getAttribute("viewBox"); // l'inquadratura non si muove durante il gesto
  // Disegno con il dito: la traccia parte dal giocatore selezionato
  if (Editor.disegno) {
    Editor.disegno.punti = [];
    Editor.disegno.attivo = true;
    return;
  }
  const g = giocatoreVicino(p);
  if (!g) { Editor.sel = null; disegnaEditor(); return; }
  Editor.sel = g.id;
  Editor.tocco = { g, inizio: p, mosso: false, prima: JSON.stringify({ g: schemaCorrente.giocatori, f: schemaCorrente.formazione, r: schemaCorrente.ribaltato }) };
  disegnaEditor();
});

campoEditor.addEventListener("pointermove", (e) => {
  if (!Editor.tocco && !(Editor.disegno && Editor.disegno.attivo)) return;
  const p = puntoCampo(e);
  if (Editor.disegno && Editor.disegno.attivo) {
    const g = selezionato();
    const ultimo = Editor.disegno.punti[Editor.disegno.punti.length - 1] || { x: g.x, y: g.y };
    if (Math.hypot(p.x - ultimo.x, p.y - ultimo.y) >= 0.9) {
      Editor.disegno.punti.push(p);
      mostraTracciaInCorso();
    }
    return;
  }
  const t = Editor.tocco;
  if (!t.mosso && Math.hypot(p.x - t.inizio.x, p.y - t.inizio.y) < 0.5) return;
  t.mosso = true;
  t.g.x = +Math.min(LARGHEZZA_CAMPO - 0.6, Math.max(0.6, Math.round(p.x * 2) / 2)).toFixed(1);
  t.g.y = limitaY(schemaCorrente.lato, Math.round(p.y * 2) / 2);
  disegnaEditor();
});

const fineTocco = () => {
  Editor.vista = null;
  if (Editor.disegno && Editor.disegno.attivo) { finisciDisegno(); return; }
  const t = Editor.tocco;
  Editor.tocco = null;
  if (t && t.mosso) {
    Editor.storia.push(t.prima);
    salvaEditor();
    disegnaEditor();
  }
};
campoEditor.addEventListener("pointerup", fineTocco);
campoEditor.addEventListener("pointercancel", fineTocco);

/* ---------- Disegno con il dito ---------- */
function iniziaDisegno() {
  const g = selezionato();
  if (!g) return;
  const tipo = eUomoDiLinea(g) ? "blocco" : eQuarterback(g) ? "qb"
    : schemaCorrente.lato === "attacco" ? "route" : "blitz";
  Editor.disegno = { tipo, curva: Boolean(leggiLocale("playbook.m.curva")), punti: [] };
  mostraTipiDisegno();
  disegnaEditor();
  avviso("Trascina il dito dal giocatore fino a dove deve arrivare");
}

// Tipi di traccia tra cui scegliere mentre si disegna
function mostraTipiDisegno() {
  const g = selezionato();
  const box = $("#tipi-disegno");
  box.innerHTML = "";
  const tipi = schemaCorrente.lato === "difesa" ? TIPI_TRACCIA.difesa
    : eUomoDiLinea(g) ? TIPI_TRACCIA.attacco.filter((t) => t.id === "blocco")
    : TIPI_TRACCIA.attacco.filter((t) => eQuarterback(g) ? ["qb", "route", "motion"].includes(t.id) : t.id !== "qb");
  for (const t of tipi) {
    const b = el("button", "filtro toccabile" + (t.id === Editor.disegno.tipo ? " attivo" : ""), t.nome);
    b.addEventListener("click", () => {
      Editor.disegno.tipo = t.id;
      box.querySelectorAll(".filtro").forEach((x) => x.classList.toggle("attivo", x === b));
    });
    box.appendChild(b);
  }
  $("#btn-curva").classList.toggle("attivo", Editor.disegno.curva);
}
$("#btn-curva").addEventListener("click", () => {
  Editor.disegno.curva = !Editor.disegno.curva;
  scriviLocale("playbook.m.curva", Editor.disegno.curva);
  $("#btn-curva").classList.toggle("attivo", Editor.disegno.curva);
});
$("#btn-annulla-disegno").addEventListener("click", () => { Editor.disegno = null; disegnaEditor(); });

// Semplifica la linea del dito (tiene solo gli "spigoli" veri)
function semplifica(punti, tolleranza) {
  if (punti.length < 3) return punti;
  const [a, b] = [punti[0], punti[punti.length - 1]];
  let max = 0, indice = 0;
  for (let i = 1; i < punti.length - 1; i++) {
    const p = punti[i];
    const d = Math.abs((b.y - a.y) * p.x - (b.x - a.x) * p.y + b.x * a.y - b.y * a.x) / (Math.hypot(b.y - a.y, b.x - a.x) || 1);
    if (d > max) { max = d; indice = i; }
  }
  if (max <= tolleranza) return [a, b];
  return [...semplifica(punti.slice(0, indice + 1), tolleranza).slice(0, -1), ...semplifica(punti.slice(indice), tolleranza)];
}

function tracciaDalDito(g, punti) {
  const lisci = semplifica([{ x: g.x, y: g.y }, ...punti], Editor.disegno.curva ? 0.35 : 0.7).slice(1);
  return {
    tipo: Editor.disegno.tipo,
    nome: "A mano",
    curva: Editor.disegno.curva && lisci.length > 1,
    punti: lisci.map((p) => dentroCampo(g, p.x - g.x, p.y - g.y)),
  };
}

function mostraTracciaInCorso() {
  const g = selezionato();
  const vecchia = g.traccia;
  g.traccia = tracciaDalDito(g, Editor.disegno.punti);
  disegnaCampo(campoEditor, schemaCorrente, { selezionato: g.id, logo: Stato.profilo.logo_url, viewBox: Editor.vista });
  g.traccia = vecchia;
}

function finisciDisegno() {
  const g = selezionato();
  const d = Editor.disegno;
  d.attivo = false;
  if (!g || d.punti.length < 1 || Math.hypot(d.punti[d.punti.length - 1].x - g.x, d.punti[d.punti.length - 1].y - g.y) < 1) {
    d.punti = [];
    disegnaEditor();
    return;
  }
  ricorda();
  g.traccia = tracciaDalDito(g, d.punti);
  Editor.disegno = null;
  Editor.daAnimare = g.id;
  salvaEditor();
  disegnaEditor();
}

/* ==========================================================================
   STRUMENTI
   ========================================================================== */
$("#btn-formazione").addEventListener("click", apriFoglioFormazioni);
$("#btn-zoom-editor").addEventListener("click", () => { Editor.zoom = !Editor.zoom; disegnaEditor(); });
$("#btn-aggiungi").addEventListener("click", apriFoglioPedine);
$("#btn-ribalta").addEventListener("click", () => {
  ricorda();
  for (const g of schemaCorrente.giocatori) {
    g.x = +(LARGHEZZA_CAMPO - g.x).toFixed(2);
    if (g.traccia) {
      g.traccia.punti.forEach((p) => { p.dx = -p.dx; });
      (g.traccia.rami || []).forEach((r) => r.punti.forEach((p) => { p.dx = -p.dx; }));
    }
  }
  ribaltaNote(schemaCorrente); // anche le note sul campo
  ribaltaAvversari(schemaCorrente); // e gli avversari in trasparenza
  schemaCorrente.ribaltato = !schemaCorrente.ribaltato;
  salvaEditor();
  disegnaEditor();
});
$("#btn-traccia").addEventListener("click", apriFoglioTracce);
$("#btn-disegna").addEventListener("click", iniziaDisegno);
/* ---------- Giocatore: ruolo, numero (#12 dentro la pedina) e nome sotto (../pedine.js) ---------- */
$("#btn-sigla").addEventListener("click", () => {
  const g = selezionato();
  if (!g) return;
  $("#pedina-ruolo").value = g.etichetta;
  $("#pedina-numero").value = g.numero || "";
  $("#pedina-nome").value = g.nome || "";
  $("#pedina-ovunque").checked = false;
  const lista = $("#pedina-rosa");
  lista.innerHTML = "";
  const rosa = rosaDaSchemi(schemiDi(Stato.pb).map((s) => (s.id === schemaCorrente.id ? schemaCorrente : s)));
  for (const r of rosa) if (r.nome) lista.appendChild(Object.assign(document.createElement("option"), { value: r.nome, label: r.numero ? `#${r.numero}` : "" }));
  // Dal nome già usato si completa il numero, e viceversa
  $("#pedina-numero").oninput = () => {
    const n = pulisciNumero($("#pedina-numero").value);
    $("#pedina-numero").value = n;
    const r = rosa.find((r) => r.numero === n && r.nome);
    if (r && !$("#pedina-nome").value.trim()) $("#pedina-nome").value = r.nome;
  };
  $("#pedina-nome").oninput = () => {
    const v = $("#pedina-nome").value.trim().toLowerCase();
    const r = rosa.find((r) => r.nome.toLowerCase() === v && r.numero);
    if (r && !$("#pedina-numero").value) $("#pedina-numero").value = r.numero;
  };
  apriFoglio("#foglio-pedina");
});
$("#pedina-annulla").addEventListener("click", () => chiudiFogli());
$("#pedina-salva").addEventListener("click", () => {
  const g = selezionato();
  if (!g) { chiudiFogli(); return; }
  ricorda();
  const ruolo = $("#pedina-ruolo").value.trim().toUpperCase().slice(0, 3);
  if (ruolo) g.etichetta = ruolo;
  impostaNumeroNome(g, $("#pedina-numero").value, $("#pedina-nome").value);
  salvaEditor();
  disegnaEditor();
  chiudiFogli();
  if (!$("#pedina-ovunque").checked) return;
  // Stesso giocatore su tutte le pedine con lo stesso ruolo negli altri schemi (non bloccati)
  const cambiati = [];
  for (const s of schemiDi(Stato.pb)) {
    if (s.id === schemaCorrente.id || s.lato !== schemaCorrente.lato || s.bloccato) continue;
    let tocca = false;
    for (const x of s.giocatori) {
      if (x.etichetta !== g.etichetta) continue;
      impostaNumeroNome(x, g.numero, g.nome);
      tocca = true;
    }
    if (tocca) { s.modificato = Date.now(); cambiati.push(s); }
  }
  if (!cambiati.length) { avviso("Negli altri schemi è già così"); return; }
  salvaCopia();
  Cloud.salvaSchemi(cambiati).catch(() => {
    const ids = new Set(leggiLocale(chiaveInAttesa()) || []);
    cambiati.forEach((s) => ids.add(s.id));
    scriviLocale(chiaveInAttesa(), [...ids]);
  });
  avviso(`${testoRosa(g) || g.etichetta} messo su altri ${cambiati.length} ${cambiati.length === 1 ? "schema" : "schemi"}`);
});
$("#btn-togli").addEventListener("click", () => {
  const g = selezionato();
  ricorda();
  schemaCorrente.giocatori = schemaCorrente.giocatori.filter((x) => x.id !== g.id);
  Editor.sel = null;
  salvaEditor();
  disegnaEditor();
  avviso(`${g.etichetta} tolto dal campo`);
});
$("#btn-deseleziona").addEventListener("click", () => { Editor.sel = null; disegnaEditor(); });
$("#btn-sblocca").addEventListener("click", () => {
  schemaCorrente.bloccato = false;
  salvaEditor();
  disegnaEditor();
  avviso("Schema sbloccato: puoi modificarlo");
});
$("#btn-elimina-schema").addEventListener("click", async () => {
  if (!confirm(`Eliminare «${schemaCorrente.nome || "Senza nome"}»?`)) return;
  const id = schemaCorrente.id;
  clearTimeout(Editor.timerInvio);
  Stato.schemi = Stato.schemi.filter((x) => x.id !== id);
  salvaCopia();
  Cloud.eliminaSchema(id).catch(() => {});
  schemaCorrente = null;
  // Torna all'elenco (salta la scheda dello schema eliminato)
  history.go(pila.includes("schermata-schema") ? -2 : -1);
  avviso("Schema eliminato");
});

/* ---------- Foglio: formazioni ---------- */
function apriFoglioFormazioni() {
  const box = $("#lista-formazioni-m");
  box.innerHTML = "";
  const formato = formatoDi(schemaCorrente).id;
  const aggiungi = (titolo, lista) => {
    if (!lista.length) return;
    box.appendChild(el("p", "titolo-sezione", titolo));
    const gruppo = el("div", "gruppo");
    for (const f of lista) {
      const riga = el("button", "riga toccabile");
      const anteprima = { lato: schemaCorrente.lato, giocatori: f.giocatori.map((g, i) => ({ ...g, id: "a" + i, forma: g.forma || (schemaCorrente.lato === "attacco" ? (g.etichetta === "C" ? "quadrato" : "cerchio") : "lettera") })) };
      riga.appendChild(svgCampo(anteprima, "miniatura", { miniatura: true, ritaglio: true }));
      riga.appendChild(el("span", "riga-testi")).appendChild(el("span", "riga-titolo", f.nome));
      if (f.id === schemaCorrente.formazione) riga.appendChild(el("span", "spunta", "✓"));
      riga.addEventListener("click", () => {
        ricorda();
        schemaCorrente.formazione = f.id;
        schemaCorrente.giocatori = giocatoriDaFormazione(schemaCorrente.lato, f.id);
        schemaCorrente.ribaltato = false;
        Editor.sel = null;
        salvaEditor();
        disegnaEditor();
        chiudiFogli();
      });
      gruppo.appendChild(riga);
    }
    box.appendChild(gruppo);
  };
  aggiungi("Le tue formazioni", FormazioniMie.perLato(schemaCorrente.lato, formato));
  aggiungi("Formazioni pronte", formazioniPronte(schemaCorrente.lato, formato));
  box.appendChild(el("p", "titolo-sezione", "Oppure"));
  const gruppo = el("div", "gruppo");
  const zero = el("button", "riga toccabile btn-testo", "＋ Crea da zero (campo vuoto)");
  zero.addEventListener("click", () => {
    ricorda();
    schemaCorrente.giocatori = [];
    schemaCorrente.formazione = "libera";
    Editor.sel = null;
    salvaEditor();
    disegnaEditor();
    chiudiFogli();
    setTimeout(apriFoglioPedine, 350);
  });
  gruppo.appendChild(zero);
  box.appendChild(gruppo);
  apriFoglio("#foglio-formazioni");
}

/* ---------- Foglio: pedine da aggiungere ---------- */
function apriFoglioPedine() {
  const box = $("#lista-pedine");
  box.innerHTML = "";
  const stato = statoRegole(schemaCorrente);
  $("#info-pedine").textContent = `${schemaCorrente.giocatori.length} di ${stato.formato.giocatori} giocatori in campo`
    + (stato.obbligatori.length ? ` · obbligatori: ${stato.obbligatori.map((o) => `${o.ci}/${o.servono} ${o.fam}`).join(", ")}` : "");
  for (const gruppo of pedineDelFormato()) {
    box.appendChild(el("p", "titolo-sezione", gruppo.gruppo));
    const riga = el("div", "pedine");
    for (const sigla of gruppo.sigle) {
      const b = el("button", `pedina toccabile ruolo-${ruoloDi(schemaCorrente.lato, sigla)}`, sigla);
      const ok = puoAggiungere(schemaCorrente, sigla);
      b.classList.toggle("spenta", !ok.ok);
      b.addEventListener("click", () => {
        const permesso = puoAggiungere(schemaCorrente, sigla);
        if (!permesso.ok) { avviso(permesso.motivo); return; }
        ricorda();
        const pos = posizioneTipica(schemaCorrente.lato, sigla);
        const g = {
          id: "p_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          etichetta: sigla,
          x: +Math.min(LARGHEZZA_CAMPO - 0.6, Math.max(0.6, pos.x)).toFixed(1),
          y: limitaY(schemaCorrente.lato, pos.y),
          forma: schemaCorrente.lato === "difesa" ? "lettera" : sigla === "C" ? "quadrato" : "cerchio",
        };
        schemaCorrente.giocatori.push(g);
        if (!schemaCorrente.formazione) schemaCorrente.formazione = "libera";
        salvaEditor();
        disegnaEditor();
        apriFoglioPedine(); // aggiorna i conteggi e le pedine possibili
      });
      riga.appendChild(b);
    }
    box.appendChild(riga);
  }
  if (!$("#foglio-pedine").classList.contains("visibile")) apriFoglio("#foglio-pedine");
}

/* ---------- Foglio: tracce pronte per il giocatore selezionato ---------- */
function apriFoglioTracce() {
  const g = selezionato();
  const box = $("#lista-tracce");
  box.innerHTML = "";
  $("#titolo-tracce").textContent = `Traccia di ${g.etichetta}`;
  const scegli = (traccia) => {
    ricorda();
    g.traccia = traccia;
    Editor.daAnimare = g.id;
    salvaEditor();
    chiudiFogli();
    disegnaEditor();
  };
  const sezione = (titolo, voci) => {
    box.appendChild(el("p", "titolo-sezione", titolo));
    const griglia = el("div", "griglia-tracce");
    for (const [testo, crea] of voci) {
      const b = el("button", "voce-traccia toccabile", testo);
      b.addEventListener("click", () => scegli(crea()));
      griglia.appendChild(b);
    }
    box.appendChild(griglia);
  };
  // Incolla la traccia copiata (anche da un altro schema), normale o specchiata
  const appunti = AppuntiTraccia.leggi();
  if (appunti && !AppuntiTraccia.motivoNo(g, schemaCorrente.lato)) {
    const nome = appunti.traccia.nome && appunti.traccia.nome !== "A mano" ? ` (${appunti.traccia.nome})` : "";
    sezione(`Incolla la traccia di ${appunti.etichetta}${nome}`, [
      ["📥 Incolla", () => AppuntiTraccia.crea(g, false)],
      ["⇋ Incolla specchiata", () => AppuntiTraccia.crea(g, true)],
    ]);
  }
  if (schemaCorrente.lato === "difesa") {
    sezione("Difesa", TRACCE_DIFESA.map((p) => [p.nome, () => tracciaDaDifesa(g, p)]));
  } else if (eQuarterback(g)) {
    sezione("Movimento del QB", MOVIMENTI_QB.map((m) => [m.nome, () => tracciaDaQb(g, m)]));
  } else if (eUomoDiLinea(g)) {
    const dentro = versoInterno(g);
    sezione("Blocco", [
      ["Avanti", () => ({ tipo: "blocco", nome: "Blocco", punti: [dentroCampo(g, 0, 1.6)] })],
      ["Verso l'interno", () => ({ tipo: "blocco", nome: "Blocco", punti: [dentroCampo(g, 1.4 * dentro, 1.2)] })],
      ["Verso l'esterno", () => ({ tipo: "blocco", nome: "Blocco", punti: [dentroCampo(g, -1.4 * dentro, 1.2)] })],
      ["Pass pro (indietro)", () => ({ tipo: "blocco", nome: "Pass pro", punti: [dentroCampo(g, 0, -1.4)] })],
    ]);
  } else {
    sezione("Albero delle route", ALBERO_ROUTE.map((r) => [`${r.n} · ${r.nome}`, () => tracciaDaRoute(g, r)]));
    sezione("Blocco", [["Blocco avanti", () => ({ tipo: "blocco", nome: "Blocco", punti: [dentroCampo(g, 0, 2)] })]]);
  }
  const altro = el("div", "gruppo");
  altro.style.marginTop = "18px";
  const disegna = el("button", "riga toccabile btn-testo", "✍️ Disegnala con il dito");
  disegna.addEventListener("click", () => { chiudiFogli(); setTimeout(iniziaDisegno, 320); });
  altro.appendChild(disegna);
  if (g.traccia) {
    const copia = el("button", "riga toccabile btn-testo", "📋 Copia questa traccia");
    copia.addEventListener("click", () => {
      AppuntiTraccia.copia(g, schemaCorrente.lato);
      chiudiFogli();
      avviso(`Traccia di ${g.etichetta} copiata: tocca un altro giocatore → Traccia → Incolla`);
    });
    altro.appendChild(copia);
    const togli = el("button", "riga toccabile btn-testo rosso", "Togli la traccia");
    togli.addEventListener("click", () => { ricorda(); delete g.traccia; salvaEditor(); chiudiFogli(); disegnaEditor(); });
    altro.appendChild(togli);
  }
  box.appendChild(altro);
  apriFoglio("#foglio-tracce");
}
