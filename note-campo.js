/* ==========================================================================
   NOTE SUL CAMPO (computer): crearle e modificarle
   --------------------------------------------------------------------------
   Pulsante «✎ Note» sopra il campo: si apre la barra degli strumenti.
   Mentre è aperta il mouse lavora solo sulle note (i giocatori non si
   spostano per sbaglio):
   - ↖ Sposta: clic su una nota per sceglierla, trascinala per spostarla;
     doppio clic su un testo per riscriverlo
   - T Testo: clic sul campo e scrivi (Invio per confermare)
   - ↗ Freccia: trascina dal punto di partenza a quello d'arrivo
   - ▭ Zona: trascina per disegnare il rettangolo colorato
   - i colori cambiano la nota scelta (e quelle nuove)
   - Canc toglie la nota scelta; Esc chiude
   Tutto con Annulla (Ctrl+Z).
   ========================================================================== */

const NoteCampo = {
  attivo: false,
  strumento: "sposta",
  colore: "giallo",
  sel: null,      // id della nota scelta
  gesto: null,    // trascinamento in corso
};

const nuovoIdNota = () => "n_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const noteDelloSchema = () => (schemaCorrente.annotazioni = schemaCorrente.annotazioni || []);
const notaScelta = () => (schemaCorrente && (schemaCorrente.annotazioni || []).find((a) => a.id === NoteCampo.sel)) || null;
const inYarde = (p) => ({ x: +p.x.toFixed(2), y: +(YARDE_AVANTI - p.y).toFixed(2) }); // dal disegno alle yarde

/* ---------- Aprire e chiudere ---------- */
function apriNoteCampo() {
  if (!schemaCorrente || schemaBloccato()) return;
  if (typeof fermaGioco === "function") fermaGioco();
  chiudiMenuTracce();
  if (typeof Selezione !== "undefined") Selezione.ids.clear();
  giocatoreSelezionato = null;
  NoteCampo.attivo = true;
  NoteCampo.sel = null;
  scegliStrumento("sposta");
  document.body.classList.add("modo-note");
  $("#barra-note").hidden = false;
  $("#btn-note-campo").classList.add("attivo");
  ridisegna();
}

function chiudiNoteCampo() {
  if (!NoteCampo.attivo) return;
  chiudiCampoTesto(false);
  NoteCampo.attivo = false;
  NoteCampo.sel = null;
  NoteCampo.gesto = null;
  document.body.classList.remove("modo-note");
  $("#barra-note").hidden = true;
  $("#btn-note-campo").classList.remove("attivo");
  if (schemaCorrente) ridisegna();
}

function scegliStrumento(s) {
  NoteCampo.strumento = s;
  document.querySelectorAll("#barra-note [data-strumento]").forEach((b) => b.classList.toggle("attivo", b.dataset.strumento === s));
  svgCampo.dataset.strumento = s;
}

function scegliColore(c) {
  NoteCampo.colore = c;
  document.querySelectorAll("#barra-note [data-colore]").forEach((b) => b.classList.toggle("attivo", b.dataset.colore === c));
  const a = notaScelta();
  if (a && a.colore !== c) {
    ricordaStato();
    a.colore = c;
    ridisegna();
    salvaTraPoco();
  }
}

function eliminaNotaScelta() {
  const a = notaScelta();
  if (!a) return;
  ricordaStato();
  schemaCorrente.annotazioni = noteDelloSchema().filter((x) => x.id !== a.id);
  NoteCampo.sel = null;
  ridisegna();
  salvaTraPoco();
  mostraAvviso("Nota tolta", annulla);
}

$("#btn-note-campo").addEventListener("click", () => (NoteCampo.attivo ? chiudiNoteCampo() : apriNoteCampo()));
$("#btn-note-fine").addEventListener("click", chiudiNoteCampo);
$("#btn-note-elimina").addEventListener("click", eliminaNotaScelta);
document.querySelectorAll("#barra-note [data-strumento]").forEach((b) => b.addEventListener("click", () => scegliStrumento(b.dataset.strumento)));
document.querySelectorAll("#barra-note [data-colore]").forEach((b) => b.addEventListener("click", () => scegliColore(b.dataset.colore)));

/* ---------- Mouse sul campo (prima di tutto il resto, solo con le note aperte) ---------- */
svgCampo.addEventListener("pointerdown", (e) => {
  if (!NoteCampo.attivo || !schemaCorrente) return;
  e.stopImmediatePropagation(); // i giocatori non si toccano mentre si scrivono le note
  e.preventDefault();
  const p = puntoNelCampo(e);
  chiudiCampoTesto(true);

  if (NoteCampo.strumento === "testo") { apriCampoTesto(p, null); return; }

  if (NoteCampo.strumento === "freccia" || NoteCampo.strumento === "zona") {
    const y = inYarde(p);
    const nuova = { id: nuovoIdNota(), tipo: NoteCampo.strumento, x1: y.x, y1: y.y, x2: y.x, y2: y.y, colore: NoteCampo.colore };
    NoteCampo.gesto = { tipo: "nuova", nota: nuova, prima: istantanea() };
    noteDelloSchema().push(nuova);
    NoteCampo.sel = nuova.id;
    svgCampo.setPointerCapture(e.pointerId);
    return;
  }

  // Sposta: clic su una nota per sceglierla e trascinarla
  const el = e.target.closest && e.target.closest(".annotazione");
  const a = el && noteDelloSchema().find((x) => x.id === el.dataset.id);
  // Doppio clic su un testo (due clic veloci sulla stessa nota): si riscrive
  const adesso = Date.now();
  if (a && a.tipo === "testo" && NoteCampo.ultimoClic && NoteCampo.ultimoClic.id === a.id && adesso - NoteCampo.ultimoClic.t < 350) {
    NoteCampo.ultimoClic = null;
    NoteCampo.sel = a.id;
    ridisegna();
    apriCampoTesto({ x: a.x, y: yDisegno(a.y) }, a);
    return;
  }
  NoteCampo.ultimoClic = a ? { id: a.id, t: adesso } : null;
  NoteCampo.sel = a ? a.id : null;
  if (a) {
    NoteCampo.gesto = { tipo: "sposta", nota: a, da: inYarde(p), copia: JSON.parse(JSON.stringify(a)), prima: istantanea(), mosso: false };
    svgCampo.setPointerCapture(e.pointerId);
    scegliColoreSenzaModifica(a.colore || "giallo");
  }
  ridisegna();
}, true);

function scegliColoreSenzaModifica(c) {
  NoteCampo.colore = c;
  document.querySelectorAll("#barra-note [data-colore]").forEach((b) => b.classList.toggle("attivo", b.dataset.colore === c));
}

svgCampo.addEventListener("pointermove", (e) => {
  if (!NoteCampo.attivo) return;
  e.stopImmediatePropagation();
  const gesto = NoteCampo.gesto;
  if (!gesto) return;
  const p = inYarde(puntoNelCampo(e));
  if (gesto.tipo === "nuova") {
    gesto.nota.x2 = Math.min(LARGHEZZA_CAMPO, Math.max(0, p.x));
    gesto.nota.y2 = Math.min(YARDE_AVANTI, Math.max(-YARDE_DIETRO, p.y));
  } else {
    const dx = p.x - gesto.da.x, dy = p.y - gesto.da.y;
    const c = gesto.copia, a = gesto.nota;
    if (a.tipo === "testo") { a.x = +(c.x + dx).toFixed(2); a.y = +(c.y + dy).toFixed(2); }
    else {
      a.x1 = +(c.x1 + dx).toFixed(2); a.y1 = +(c.y1 + dy).toFixed(2);
      a.x2 = +(c.x2 + dx).toFixed(2); a.y2 = +(c.y2 + dy).toFixed(2);
    }
    gesto.mosso = gesto.mosso || Math.hypot(dx, dy) > 0.2;
  }
  disegnaCampo(svgCampo, schemaCorrente, {});
}, true);

const fineGestoNote = (e) => {
  if (!NoteCampo.attivo) return;
  e.stopImmediatePropagation();
  const gesto = NoteCampo.gesto;
  NoteCampo.gesto = null;
  if (!gesto) return;
  if (gesto.tipo === "nuova") {
    const a = gesto.nota;
    if (Math.hypot(a.x2 - a.x1, a.y2 - a.y1) < 1) {
      // Troppo piccola: era solo un clic, la togliamo
      schemaCorrente.annotazioni = noteDelloSchema().filter((x) => x.id !== a.id);
      NoteCampo.sel = null;
      mostraAvviso(a.tipo === "freccia" ? "Trascina dal punto di partenza a quello d'arrivo" : "Trascina per disegnare la zona");
    } else {
      ricordaStato(gesto.prima);
      salvaTraPoco();
      NoteCampo.sel = null; // così il colore scelto dopo vale per la prossima nota
      scegliStrumento("sposta");
    }
  } else if (gesto.mosso) {
    ricordaStato(gesto.prima);
    salvaTraPoco();
  }
  ridisegna();
};
svgCampo.addEventListener("pointerup", fineGestoNote, true);
svgCampo.addEventListener("pointercancel", fineGestoNote, true);

// Doppio clic su un testo: si riscrive
svgCampo.addEventListener("dblclick", (e) => {
  if (!NoteCampo.attivo) return;
  e.stopImmediatePropagation();
  const el = e.target.closest && e.target.closest(".nota-testo");
  const a = el && noteDelloSchema().find((x) => x.id === el.dataset.id);
  if (a) apriCampoTesto({ x: a.x, y: yDisegno(a.y) }, a);
}, true);

/* ---------- Campo per scrivere il testo, sopra il punto cliccato ---------- */
function apriCampoTesto(p, nota) {
  const cornice = svgCampo.parentElement;
  const campo = document.createElement("input");
  campo.className = "campo-testo-nota";
  campo.id = "campo-testo-nota";
  campo.maxLength = 40;
  campo.placeholder = "Scrivi la nota…";
  campo.value = nota ? nota.testo : "";
  // Posizione: dal disegno ai pixel
  const pt = svgCampo.createSVGPoint();
  pt.x = p.x; pt.y = p.y;
  const schermo = pt.matrixTransform(svgCampo.getScreenCTM());
  const r = cornice.getBoundingClientRect();
  campo.style.left = `${schermo.x - r.left}px`;
  campo.style.top = `${schermo.y - r.top}px`;
  campo.dataset.x = p.x;
  campo.dataset.y = p.y;
  if (nota) campo.dataset.id = nota.id;
  cornice.appendChild(campo);
  campo.focus();
  campo.select();
  campo.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") chiudiCampoTesto(true);
    if (e.key === "Escape") chiudiCampoTesto(false);
  });
  campo.addEventListener("blur", () => setTimeout(() => chiudiCampoTesto(true), 0));
}

function chiudiCampoTesto(conferma) {
  const campo = $("#campo-testo-nota");
  if (!campo) return;
  campo.remove();
  const testo = campo.value.trim();
  if (!conferma) return;
  const esistente = campo.dataset.id && noteDelloSchema().find((x) => x.id === campo.dataset.id);
  if (esistente) {
    if (testo === esistente.testo) return;
    ricordaStato();
    if (testo) esistente.testo = testo;
    else schemaCorrente.annotazioni = noteDelloSchema().filter((x) => x.id !== esistente.id);
  } else {
    if (!testo) return;
    ricordaStato();
    const y = inYarde({ x: +campo.dataset.x, y: +campo.dataset.y });
    const nuova = { id: nuovoIdNota(), tipo: "testo", x: y.x, y: y.y, testo, colore: NoteCampo.colore };
    noteDelloSchema().push(nuova);
    NoteCampo.sel = null;
    scegliStrumento("sposta");
  }
  ridisegna();
  salvaTraPoco();
}

/* ---------- Tasti con le note aperte. Restituisce true se il tasto è stato usato. ---------- */
function tastiNote(e, staScrivendo) {
  if (!NoteCampo.attivo || staScrivendo) return false;
  if (e.key === "Escape") {
    if (NoteCampo.sel) { NoteCampo.sel = null; ridisegna(); } else chiudiNoteCampo();
    return true;
  }
  if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); eliminaNotaScelta(); return true; }
  const tasti = { v: "sposta", t: "testo", f: "freccia", z: "zona" };
  const cmd = e.ctrlKey || e.metaKey;
  if (!cmd && tasti[e.key.toLowerCase()]) { scegliStrumento(tasti[e.key.toLowerCase()]); return true; }
  // Con le note aperte le altre scorciatoie dell'editor non valgono
  // (restano Annulla / Ripeti e Stampa)
  if (cmd && ["z", "y", "p"].includes(e.key.toLowerCase())) return false;
  return true;
}
