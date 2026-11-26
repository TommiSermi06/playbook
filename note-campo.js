/* ==========================================================================
   NOTE SUL CAMPO (computer): crearle e modificarle
   --------------------------------------------------------------------------
   Pulsante «✎ Note» sopra il campo: si apre la barra degli strumenti.
   Mentre è aperta il mouse lavora solo sulle note (i giocatori non si
   spostano per sbaglio):
   - ↖ Sposta: clic su una nota per sceglierla, trascinala per spostarla;
     doppio clic su un testo per riscriverlo
     · più note insieme: Maiusc + clic, riquadro sul prato, Ctrl/⌘ + A
     · le note scelte si spostano, si ricolorano e si eliminano insieme
   - T Testo: clic sul campo e scrivi (Invio per confermare)
   - ↗ Freccia: trascina dal punto di partenza a quello d'arrivo
   - ▭ Zona: trascina per disegnare il rettangolo colorato
   - «🗑 Elimina» o Canc tolgono le note scelte; Esc deseleziona / chiude
   Tutto con Annulla (Ctrl+Z).
   ========================================================================== */

const NoteCampo = {
  attivo: false,
  strumento: "sposta",
  colore: "giallo",
  sel: new Set(),   // id delle note scelte
  gesto: null,      // trascinamento in corso
  ultimoClic: null, // per riconoscere il doppio clic
};

const nuovoIdNota = () => "n_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const noteDelloSchema = () => (schemaCorrente.annotazioni = schemaCorrente.annotazioni || []);
const noteScelte = () => (schemaCorrente ? (schemaCorrente.annotazioni || []).filter((a) => NoteCampo.sel.has(a.id)) : []);
const inYarde = (p) => ({ x: +p.x.toFixed(2), y: +(YARDE_AVANTI - p.y).toFixed(2) }); // dal disegno alle yarde

// Ridisegna il campo e aggiorna il pulsante «Elimina» (quante note sono scelte)
function ridisegnaNote() {
  ridisegna();
  aggiornaBarraNote();
}
function aggiornaBarraNote() {
  const n = noteScelte().length;
  const b = $("#btn-note-elimina");
  b.disabled = !n;
  b.textContent = n > 1 ? `🗑 Elimina (${n})` : "🗑 Elimina";
}

/* ---------- Aprire e chiudere ---------- */
function apriNoteCampo() {
  if (!schemaCorrente || schemaBloccato()) return;
  if (typeof fermaGioco === "function") fermaGioco();
  chiudiMenuTracce();
  if (typeof Selezione !== "undefined") Selezione.ids.clear();
  giocatoreSelezionato = null;
  NoteCampo.attivo = true;
  NoteCampo.sel.clear();
  scegliStrumento("sposta");
  document.body.classList.add("modo-note");
  $("#barra-note").hidden = false;
  $("#btn-note-campo").classList.add("attivo");
  ridisegnaNote();
}

function chiudiNoteCampo() {
  if (!NoteCampo.attivo) return;
  chiudiCampoTesto(false);
  NoteCampo.attivo = false;
  NoteCampo.sel.clear();
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

function mostraColore(c) {
  NoteCampo.colore = c;
  document.querySelectorAll("#barra-note [data-colore]").forEach((b) => b.classList.toggle("attivo", b.dataset.colore === c));
}

// Un colore: vale per le note nuove e ricolora quelle scelte
function scegliColore(c) {
  mostraColore(c);
  const scelte = noteScelte().filter((a) => a.colore !== c);
  if (!scelte.length) return;
  ricordaStato();
  for (const a of scelte) a.colore = c;
  ridisegnaNote();
  salvaTraPoco();
}

function eliminaNoteScelte() {
  const scelte = noteScelte();
  if (!scelte.length) { mostraAvviso("Prima scegli una nota (clic), o più note con Maiusc + clic o il riquadro"); return; }
  ricordaStato();
  const via = new Set(scelte.map((a) => a.id));
  schemaCorrente.annotazioni = noteDelloSchema().filter((x) => !via.has(x.id));
  NoteCampo.sel.clear();
  ridisegnaNote();
  salvaTraPoco();
  mostraAvviso(scelte.length > 1 ? `${scelte.length} note tolte` : "Nota tolta", annulla);
}

function scegliTutteLeNote() {
  NoteCampo.sel = new Set(noteDelloSchema().map((a) => a.id));
  scegliStrumento("sposta");
  ridisegnaNote();
}

$("#btn-note-campo").addEventListener("click", () => (NoteCampo.attivo ? chiudiNoteCampo() : apriNoteCampo()));
$("#btn-note-fine").addEventListener("click", chiudiNoteCampo);
$("#btn-note-elimina").addEventListener("click", eliminaNoteScelte);
document.querySelectorAll("#barra-note [data-strumento]").forEach((b) => b.addEventListener("click", () => scegliStrumento(b.dataset.strumento)));
document.querySelectorAll("#barra-note [data-colore]").forEach((b) => b.addEventListener("click", () => scegliColore(b.dataset.colore)));

/* ---------- Riquadro di selezione delle note ---------- */
// Il rettangolo (in yarde) che contiene una nota
function ingombroNota(a) {
  if (a.tipo === "testo") {
    const mezzo = Math.max(1.5, (a.testo || "").length * 0.38);
    return { x0: a.x - mezzo, x1: a.x + mezzo, y0: a.y - 0.7, y1: a.y + 0.7 };
  }
  return { x0: Math.min(a.x1, a.x2), x1: Math.max(a.x1, a.x2), y0: Math.min(a.y1, a.y2), y1: Math.max(a.y1, a.y2) };
}
function noteNelRiquadro(da, a) {
  const x0 = Math.min(da.x, a.x), x1 = Math.max(da.x, a.x), y0 = Math.min(da.y, a.y), y1 = Math.max(da.y, a.y);
  return noteDelloSchema().filter((n) => {
    const b = ingombroNota(n);
    return b.x1 >= x0 && b.x0 <= x1 && b.y1 >= y0 && b.y0 <= y1; // basta toccarla
  });
}

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
    NoteCampo.sel.clear();
    svgCampo.setPointerCapture(e.pointerId);
    return;
  }

  // ↖ Sposta
  const el = e.target.closest && e.target.closest(".annotazione");
  const a = el && noteDelloSchema().find((x) => x.id === el.dataset.id);
  svgCampo.setPointerCapture(e.pointerId);

  // Prato vuoto: riquadro di selezione (con Maiusc si aggiunge alle note già scelte)
  if (!a) {
    if (!e.shiftKey) NoteCampo.sel.clear();
    NoteCampo.gesto = { tipo: "riquadro", da: inYarde(p), a: inYarde(p), aggiungi: e.shiftKey, gia: new Set(NoteCampo.sel) };
    ridisegnaNote();
    return;
  }

  // Maiusc + clic: aggiunge o toglie la nota dalle scelte
  if (e.shiftKey) {
    NoteCampo.sel.has(a.id) ? NoteCampo.sel.delete(a.id) : NoteCampo.sel.add(a.id);
    ridisegnaNote();
    return;
  }

  // Doppio clic su un testo (due clic veloci sulla stessa nota): si riscrive
  const adesso = Date.now();
  if (a.tipo === "testo" && NoteCampo.ultimoClic && NoteCampo.ultimoClic.id === a.id && adesso - NoteCampo.ultimoClic.t < 350) {
    NoteCampo.ultimoClic = null;
    NoteCampo.sel = new Set([a.id]);
    ridisegnaNote();
    apriCampoTesto({ x: a.x, y: yDisegno(a.y) }, a);
    return;
  }
  NoteCampo.ultimoClic = { id: a.id, t: adesso };

  // Clic su una nota non scelta: diventa l'unica scelta. Poi si trascinano tutte le scelte.
  if (!NoteCampo.sel.has(a.id)) NoteCampo.sel = new Set([a.id]);
  if (NoteCampo.sel.size === 1) mostraColore(a.colore || "giallo");
  NoteCampo.gesto = {
    tipo: "sposta",
    da: inYarde(p),
    copie: noteScelte().map((n) => ({ nota: n, copia: JSON.parse(JSON.stringify(n)) })),
    prima: istantanea(),
    mosso: false,
  };
  ridisegnaNote();
}, true);

svgCampo.addEventListener("pointermove", (e) => {
  if (!NoteCampo.attivo) return;
  e.stopImmediatePropagation();
  const gesto = NoteCampo.gesto;
  if (!gesto) return;
  const p = inYarde(puntoNelCampo(e));
  if (gesto.tipo === "nuova") {
    gesto.nota.x2 = Math.min(LARGHEZZA_CAMPO, Math.max(0, p.x));
    gesto.nota.y2 = Math.min(YARDE_AVANTI, Math.max(-YARDE_DIETRO, p.y));
    disegnaCampo(svgCampo, schemaCorrente, {});
  } else if (gesto.tipo === "riquadro") {
    gesto.a = p;
    const dentro = noteNelRiquadro(gesto.da, gesto.a).map((n) => n.id);
    NoteCampo.sel = new Set([...(gesto.aggiungi ? gesto.gia : []), ...dentro]);
    disegnaCampo(svgCampo, schemaCorrente, {});
    // Il rettangolo tratteggiato
    crea("rect", {
      class: "riquadro-selezione", rx: 0.3,
      x: Math.min(gesto.da.x, p.x), y: yDisegno(Math.max(gesto.da.y, p.y)),
      width: Math.abs(p.x - gesto.da.x), height: Math.abs(p.y - gesto.da.y),
    }, svgCampo);
  } else {
    const dx = p.x - gesto.da.x, dy = p.y - gesto.da.y;
    for (const { nota: a, copia: c } of gesto.copie) {
      if (a.tipo === "testo") { a.x = +(c.x + dx).toFixed(2); a.y = +(c.y + dy).toFixed(2); }
      else {
        a.x1 = +(c.x1 + dx).toFixed(2); a.y1 = +(c.y1 + dy).toFixed(2);
        a.x2 = +(c.x2 + dx).toFixed(2); a.y2 = +(c.y2 + dy).toFixed(2);
      }
    }
    gesto.mosso = gesto.mosso || Math.hypot(dx, dy) > 0.2;
    disegnaCampo(svgCampo, schemaCorrente, {});
  }
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
      mostraAvviso(a.tipo === "freccia" ? "Trascina dal punto di partenza a quello d'arrivo" : "Trascina per disegnare la zona");
    } else {
      ricordaStato(gesto.prima);
      salvaTraPoco();
      scegliStrumento("sposta"); // la nota nuova non resta scelta: il colore dopo vale per la prossima
    }
  } else if (gesto.tipo === "sposta" && gesto.mosso) {
    ricordaStato(gesto.prima);
    salvaTraPoco();
  }
  ridisegnaNote();
};
svgCampo.addEventListener("pointerup", fineGestoNote, true);
svgCampo.addEventListener("pointercancel", fineGestoNote, true);
svgCampo.addEventListener("dblclick", (e) => { if (NoteCampo.attivo) e.stopImmediatePropagation(); }, true);

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
    noteDelloSchema().push({ id: nuovoIdNota(), tipo: "testo", x: y.x, y: y.y, testo, colore: NoteCampo.colore });
    NoteCampo.sel.clear();
    scegliStrumento("sposta");
  }
  ridisegnaNote();
  salvaTraPoco();
}

/* ---------- Tasti con le note aperte. Restituisce true se il tasto è stato usato. ---------- */
function tastiNote(e, staScrivendo) {
  if (!NoteCampo.attivo || staScrivendo) return false;
  const cmd = e.ctrlKey || e.metaKey;
  if (e.key === "Escape") {
    if (NoteCampo.sel.size) { NoteCampo.sel.clear(); ridisegnaNote(); } else chiudiNoteCampo();
    return true;
  }
  if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); eliminaNoteScelte(); return true; }
  if (cmd && e.key.toLowerCase() === "a") { e.preventDefault(); scegliTutteLeNote(); return true; }
  const tasti = { v: "sposta", t: "testo", f: "freccia", z: "zona" };
  if (!cmd && tasti[e.key.toLowerCase()]) { scegliStrumento(tasti[e.key.toLowerCase()]); return true; }
  // Con le note aperte le altre scorciatoie dell'editor non valgono
  // (restano Annulla / Ripeti e Stampa)
  if (cmd && ["z", "y", "p"].includes(e.key.toLowerCase())) return false;
  return true;
}
