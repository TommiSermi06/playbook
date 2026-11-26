/* ==========================================================================
   SEZIONI (cartelle) DEGLI SCHEMI
   --------------------------------------------------------------------------
   Il coach divide gli schemi di un playbook in sezioni sue, es. «Base»,
   «Red zone», «Game plan vs Lions». Ogni lato (attacco, difesa, special
   teams) ha le sue.
     playbook.sezioni = [ { id, nome, lato } ]   (nell'ordine voluto)
     schema.sezione   = id della sezione (assente = «Senza sezione»)
   - nell'elenco: gli schemi sotto il titolo della loro sezione; un clic sul
     titolo la chiude / apre (ricordato su questo computer)
   - «＋ Sezione» sopra l'elenco crea una sezione; ⋯ sul titolo: rinomina,
     sposta su / giù, elimina (gli schemi restano, «Senza sezione»)
   - uno schema va in una sezione trascinandolo sul titolo (o tra i suoi
     schemi), oppure dal pannello a destra «Sezione»
   Le sezioni le crea e le modifica il proprietario del playbook; chi può
   modificare gli schemi può spostarli da una sezione all'altra.
   ========================================================================== */

const nuovoIdSezione = () => "sez_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const puoGestireSezioni = () => Boolean(playbookCorrente) && Playbook.permesso(playbookCorrente.id) === "proprietario";

function sezioniDel(lato, pb = playbookCorrente) {
  return ((pb && pb.sezioni) || []).filter((s) => s.lato === lato);
}
// La sezione di uno schema (null se nessuna o se la sezione non esiste più)
function sezioneDi(schema, pb = playbookCorrente) {
  if (!schema.sezione) return null;
  return ((pb && pb.sezioni) || []).find((s) => s.id === schema.sezione && s.lato === schema.lato) || null;
}

/* ---------- Sezioni chiuse (solo su questo computer) ---------- */
const chiaveChiuse = () => `playbook.sezioni-chiuse.${playbookCorrente ? playbookCorrente.id : ""}`;
function sezioniChiuse() { return new Set(leggiLocale(chiaveChiuse()) || []); }
function commutaSezione(id) {
  const chiuse = sezioniChiuse();
  if (chiuse.has(id)) chiuse.delete(id); else chiuse.add(id);
  scriviLocale(chiaveChiuse(), [...chiuse]);
  mostraElenco();
}

/* ---------- Gruppi per l'elenco ----------
   null se il lato non ha sezioni (elenco semplice, come prima). */
function gruppiElenco(schemi, lato) {
  const sezioni = sezioniDel(lato);
  if (!sezioni.length) return null;
  const gruppi = sezioni.map((sez) => ({ sezione: sez, schemi: schemi.filter((s) => s.sezione === sez.id) }));
  const ids = new Set(sezioni.map((s) => s.id));
  gruppi.push({ sezione: null, schemi: schemi.filter((s) => !s.sezione || !ids.has(s.sezione)) });
  return gruppi;
}

// Il titolo di una sezione nell'elenco (con il conteggio, ▸ / ▾ e il menu ⋯)
function intestazioneSezione(gruppo, { chiusa, filtrato }) {
  const sez = gruppo.sezione;
  const li = document.createElement("li");
  li.className = "intestazione-sezione" + (chiusa ? " chiusa" : "") + (sez ? "" : " senza-sezione");
  li.dataset.sezione = sez ? sez.id : "";
  li.innerHTML = `<span class="freccia-sezione" aria-hidden="true">▾</span><span class="nome-sezione"></span><span class="conto-sezione"></span>`;
  li.querySelector(".nome-sezione").textContent = sez ? sez.nome : "Senza sezione";
  li.querySelector(".conto-sezione").textContent = gruppo.schemi.length;
  li.tabIndex = 0;
  li.title = filtrato ? "" : chiusa ? "Apri la sezione" : "Chiudi la sezione";
  const chiave = sez ? sez.id : "__senza";
  // Clic: apre / chiude (dopo un attimo, così il doppio clic può rinominare)
  let timer = null;
  li.addEventListener("click", (e) => {
    if (e.target.closest(".menu-sezione-btn") || e.target.closest(".input-sezione") || filtrato) return;
    clearTimeout(timer);
    timer = setTimeout(() => commutaSezione(chiave), e.detail > 1 ? 99999 : 230);
  });
  li.addEventListener("keydown", (e) => { if (e.key === "Enter" && !filtrato) commutaSezione(chiave); });
  if (sez && puoGestireSezioni()) {
    const altro = document.createElement("button");
    altro.type = "button";
    altro.className = "menu-sezione-btn";
    altro.textContent = "⋯";
    altro.title = "Rinomina, sposta o elimina la sezione";
    altro.addEventListener("click", (e) => { e.stopPropagation(); apriMenuSezione(altro, sez); });
    li.appendChild(altro);
    li.addEventListener("dblclick", (e) => {
      clearTimeout(timer);
      if (!e.target.closest(".menu-sezione-btn")) rinominaSezioneInRiga(li, sez);
    });
  }
  abilitaRilascioSezione(li, sez);
  return li;
}

/* ---------- Trascinare uno schema su una sezione ---------- */
function abilitaRilascioSezione(li, sez) {
  li.addEventListener("dragover", (e) => {
    if (typeof idTrascinato === "undefined" || !idTrascinato) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    li.classList.add("rilascio");
  });
  li.addEventListener("dragleave", (e) => { if (!li.contains(e.relatedTarget)) li.classList.remove("rilascio"); });
  li.addEventListener("drop", (e) => {
    if (!idTrascinato) return;
    e.preventDefault();
    li.classList.remove("rilascio");
    const id = idTrascinato;
    idTrascinato = null; // la riga trascinata sparisce col ridisegno: niente «dragend»
    document.body.classList.remove("riordino-in-corso");
    impostaSezione(id, sez ? sez.id : null);
  });
}

// Chiamata dal riordino: rilasciando uno schema tra quelli di un'altra sezione, cambia sezione
function seguiSezioneDi(idMosso, schemaRif) {
  if (!sezioniDel(schemaRif.lato).length) return null;
  const mosso = idMosso === (schemaCorrente && schemaCorrente.id) ? schemaCorrente : Dati.trova(idMosso);
  const verso = sezioneDi(schemaRif) ? schemaRif.sezione : null;
  const prima = mosso && sezioneDi(mosso) ? mosso.sezione : null;
  if (!mosso || prima === verso) return null;
  impostaSezione(idMosso, verso, { silenzioso: true });
  return () => impostaSezione(idMosso, prima, { silenzioso: true }); // per «Annulla»
}

/* Mette uno schema in una sezione (null = nessuna), con Annulla */
function impostaSezione(id, idSezione, { silenzioso = false } = {}) {
  const corrente = schemaCorrente && schemaCorrente.id === id;
  if (corrente) salvaInSospeso();
  const schema = corrente ? schemaCorrente : Dati.trova(id);
  if (!schema) return;
  const prima = schema.sezione;
  const applica = (valore) => {
    const s = corrente ? schemaCorrente : Dati.trova(id);
    if (valore) s.sezione = valore; else delete s.sezione;
    if (corrente) salvaSubito(); else Dati.aggiornaMolti([s]);
    // se la sezione era chiusa, la apriamo per far vedere dove è finito
    const chiuse = sezioniChiuse();
    if (chiuse.delete(valore || "__senza")) scriviLocale(chiaveChiuse(), [...chiuse]);
    mostraElenco();
    if (corrente) mostraCategoria();
  };
  if ((prima || null) === (idSezione || null)) return;
  applica(idSezione);
  if (silenzioso) return;
  const sez = (playbookCorrente.sezioni || []).find((s) => s.id === idSezione);
  mostraAvviso(sez ? `Spostato in «${sez.nome}»` : "Tolto dalla sezione", () => applica(prima));
}

/* ---------- Creare, rinominare, spostare, eliminare ---------- */
function salvaSezioni(nuove, messaggio) {
  const pb = playbookCorrente;
  const prima = pb.sezioni ? pb.sezioni.map((s) => ({ ...s })) : [];
  pb.sezioni = nuove;
  Playbook.salva(pb);
  mostraElenco();
  if (schemaCorrente) mostraCategoria();
  if (messaggio) {
    mostraAvviso(messaggio, () => {
      pb.sezioni = prima;
      Playbook.salva(pb);
      mostraElenco();
      if (schemaCorrente) mostraCategoria();
    });
  }
}

// «＋ Sezione»: una riga con il nome da scrivere in cima all'elenco
function nuovaSezione(dopo = null) {
  if (!puoGestireSezioni()) return;
  $("#cerca").value = "";
  if (typeof filtroCategoria !== "undefined") filtroCategoria = "tutte";
  mostraElenco();
  const lista = $("#lista-schemi");
  lista.hidden = false;
  $("#lista-vuota").hidden = true;
  const li = document.createElement("li");
  li.className = "intestazione-sezione nuova";
  li.innerHTML = `<span class="freccia-sezione" aria-hidden="true">▾</span>`;
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 40;
  input.placeholder = "Nome della sezione e Invio";
  input.className = "input-sezione";
  li.appendChild(input);
  lista.prepend(li);
  input.focus();
  let fatto = false;
  const conferma = () => {
    if (fatto) return;
    fatto = true;
    const nome = input.value.trim();
    if (!nome) { mostraElenco(); return; }
    const sez = { id: nuovoIdSezione(), nome, lato: latoSelezionato };
    const tutte = [...(playbookCorrente.sezioni || [])];
    // dopo quella indicata (es. dal pannello) oppure in fondo alle sezioni del lato
    tutte.push(sez);
    salvaSezioni(tutte, `Sezione «${nome}» creata: trascinaci gli schemi`);
    if (dopo) dopo(sez);
  };
  input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") conferma();
    if (e.key === "Escape") { fatto = true; mostraElenco(); }
  });
  input.addEventListener("blur", conferma);
}

function rinominaSezioneInRiga(li, sez) {
  const nome = li.querySelector(".nome-sezione");
  const input = document.createElement("input");
  input.type = "text";
  input.maxLength = 40;
  input.value = sez.nome;
  input.className = "input-sezione";
  nome.replaceWith(input);
  input.focus();
  input.select();
  let fatto = false;
  const conferma = () => {
    if (fatto) return;
    fatto = true;
    const nuovo = input.value.trim();
    if (!nuovo || nuovo === sez.nome) { mostraElenco(); return; }
    salvaSezioni((playbookCorrente.sezioni || []).map((s) => (s.id === sez.id ? { ...s, nome: nuovo } : s)), `Sezione rinominata in «${nuovo}»`);
  };
  input.addEventListener("click", (e) => e.stopPropagation());
  input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Enter") conferma();
    if (e.key === "Escape") { fatto = true; mostraElenco(); }
  });
  input.addEventListener("blur", conferma);
}

function spostaSezione(sez, verso) {
  const tutte = [...(playbookCorrente.sezioni || [])];
  const stessoLato = tutte.filter((s) => s.lato === sez.lato);
  const i = stessoLato.findIndex((s) => s.id === sez.id);
  const altra = stessoLato[i + verso];
  if (!altra) return;
  const a = tutte.findIndex((s) => s.id === sez.id), b = tutte.findIndex((s) => s.id === altra.id);
  [tutte[a], tutte[b]] = [tutte[b], tutte[a]];
  salvaSezioni(tutte);
}

function eliminaSezione(sez) {
  const quanti = schemiDelPlaybook().filter((s) => s.sezione === sez.id).length;
  chiediConferma(`Eliminare la sezione «${sez.nome}»?`,
    quanti ? `${quanti} ${quanti === 1 ? "schema resta" : "schemi restano"} nel playbook, in «Senza sezione».` : "La sezione è vuota.",
    "Elimina", () => {
      // gli schemi restano con l'id: se si annulla, tornano nella sezione
      salvaSezioni((playbookCorrente.sezioni || []).filter((s) => s.id !== sez.id), `Sezione «${sez.nome}» eliminata`);
    });
}

/* ---------- Menu ⋯ della sezione ---------- */
function apriMenuSezione(bottone, sez) {
  chiudiMenuSezione();
  const menu = document.createElement("div");
  menu.className = "menu-sezione";
  menu.id = "menu-sezione";
  const stessoLato = sezioniDel(sez.lato);
  const i = stessoLato.findIndex((s) => s.id === sez.id);
  const voci = [
    ["✏️ Rinomina", () => { const li = document.querySelector(`.intestazione-sezione[data-sezione="${sez.id}"]`); if (li) rinominaSezioneInRiga(li, sez); }],
    ...(i > 0 ? [["↑ Sposta su", () => spostaSezione(sez, -1)]] : []),
    ...(i < stessoLato.length - 1 ? [["↓ Sposta giù", () => spostaSezione(sez, 1)]] : []),
    ["🗑 Elimina sezione", () => eliminaSezione(sez), "distruttiva"],
  ];
  for (const [testo, azione, classe] of voci) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "voce-menu-sezione" + (classe ? " " + classe : "");
    b.textContent = testo;
    b.addEventListener("click", () => { chiudiMenuSezione(); azione(); });
    menu.appendChild(b);
  }
  document.body.appendChild(menu);
  const r = bottone.getBoundingClientRect();
  menu.style.left = `${Math.min(innerWidth - menu.offsetWidth - 8, r.left)}px`;
  menu.style.top = `${Math.min(innerHeight - menu.offsetHeight - 8, r.bottom + 4)}px`;
}
function chiudiMenuSezione() {
  const m = $("#menu-sezione");
  if (m) m.remove();
}
document.addEventListener("pointerdown", (e) => {
  if ($("#menu-sezione") && !e.target.closest("#menu-sezione") && !e.target.closest(".menu-sezione-btn")) chiudiMenuSezione();
}, true);

/* ---------- Pannello a destra: «Sezione» dello schema aperto ---------- */
function mostraSezioneSchema() {
  const box = $("#riga-sezione-schema");
  if (!box || !schemaCorrente) return;
  const sezioni = sezioniDel(schemaCorrente.lato);
  const vietato = typeof modificheVietate === "function" && modificheVietate();
  box.innerHTML = "";
  const card = box.closest(".card") || box;
  if (!sezioni.length && !puoGestireSezioni()) { card.hidden = true; return; }
  card.hidden = false;
  const etichetta = document.createElement("span");
  etichetta.textContent = "Sezione";
  const scelta = document.createElement("select");
  scelta.id = "sezione-schema";
  scelta.disabled = vietato;
  scelta.add(new Option("Nessuna", ""));
  for (const s of sezioni) scelta.add(new Option(s.nome, s.id));
  if (puoGestireSezioni()) scelta.add(new Option("＋ Nuova sezione…", "__nuova"));
  scelta.value = sezioneDi(schemaCorrente) ? schemaCorrente.sezione : "";
  scelta.addEventListener("change", () => {
    const id = schemaCorrente.id;
    if (scelta.value === "__nuova") {
      scelta.value = sezioneDi(schemaCorrente) ? schemaCorrente.sezione : "";
      nuovaSezione((sez) => impostaSezione(id, sez.id));
      return;
    }
    impostaSezione(id, scelta.value || null);
  });
  box.append(etichetta, scelta);
}

$("#btn-nuova-sezione").addEventListener("click", () => nuovaSezione());
