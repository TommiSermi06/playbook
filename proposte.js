/* ==========================================================================
   PERMESSI DEI CO-ALLENATORI E PROPOSTE
   --------------------------------------------------------------------------
   Ogni co-allenatore ha un permesso, scelto dal proprietario all'invito:
   - "modifica": modifica il playbook direttamente;
   - "proposta": ogni sua modifica è una BOZZA che vede solo lui; con
     «Invia proposta» la manda al proprietario, che la accetta o la rifiuta;
   - "lettura": guarda e stampa, senza modificare.
   ========================================================================== */

// Vero se nel playbook aperto non si può modificare niente (solo lettura o link condiviso)
function modificheVietate() {
  return Playbook.permesso(playbookCorrente && playbookCorrente.id) === "lettura";
}
// Vero se nel playbook aperto si possono solo mandare proposte
function soloProposte() {
  return Boolean(playbookCorrente) && Playbook.permesso(playbookCorrente.id) === "proposta";
}

/* Prepara l'app per il permesso del playbook appena aperto */
function aggiornaPermessiUI() {
  const vietate = modificheVietate();
  document.body.classList.toggle("blocco-modifiche", vietate);
  document.body.classList.toggle("modo-proposte", soloProposte());
  $("#nome-schema").readOnly = vietate;
  $("#note-schema").readOnly = vietate;
  $("#note-schema").placeholder = vietate ? "Nessuna nota" : "Chiamata, letture, compiti per ruolo…";
  $("#btn-elimina").textContent = soloProposte() ? "Proponi di eliminarlo…" : "Elimina schema…";
  mostraContoProposte();
}

/* ---------- Banner sopra il campo ---------- */
function aggiornaBannerBozza() {
  const s = schemaCorrente;
  const permesso = Playbook.permesso(playbookCorrente && playbookCorrente.id);
  const conBozza = Boolean(s && s.bozza) && permesso !== "lettura" && !CODICE_VISTA;
  $("#banner-bozza").hidden = !conBozza;
  if (conBozza) {
    $("#banner-bozza-testo").textContent = permesso === "modifica"
      ? "✏️ Bozza rimasta da prima: ora puoi salvarla direttamente nel playbook."
      : s.nuovo
        ? "✏️ Schema nuovo: lo vedi solo tu finché non lo mandi al proprietario."
        : "✏️ Bozza: le modifiche le vedi solo tu finché non le mandi al proprietario.";
    $("#btn-invia-bozza").textContent = permesso === "modifica" ? "Salva nel playbook" : "Invia proposta";
  }
  const info = !conBozza && !CODICE_VISTA && (permesso === "lettura" || permesso === "proposta");
  $("#banner-lettura").hidden = !info;
  if (info) {
    $("#banner-lettura-testo").textContent = permesso === "lettura"
      ? "👁 Solo lettura: puoi guardare e stampare questo playbook, non modificarlo."
      : `📨 Solo proposte: se modifichi lo schema nasce una bozza da mandare a ${playbookCorrente.squadra || "chi ha creato il playbook"}.`;
  }
}

// Le righe dell'elenco segnalano bozze e proposte in attesa
let proposteMieInAttesa = new Set(); // id degli schemi con una mia proposta in attesa
function prefissoRiga(schema) {
  if (schema.bozza) return "✏️ Bozza · ";
  if (proposteMieInAttesa.has(schema.id)) return "⏳ Proposta inviata · ";
  return "";
}

/* ---------- Chi propone: invia o scarta la bozza ---------- */
async function inviaBozza() {
  salvaInSospeso();
  const pb = playbookCorrente;
  const s = Dati.trova(schemaCorrente.id);
  if (!s || !s.bozza) return;
  const bottone = $("#btn-invia-bozza");
  bottone.disabled = true;
  try {
    const dati = { ...s };
    delete dati.bozza;
    delete dati.nuovo;
    // Permesso cambiato in "modifica": la bozza diventa subito ufficiale
    if (Playbook.permesso(pb.id) === "modifica") {
      Dati.salva(dati);
      apriEditor(dati.id);
      mostraAvviso("Salvato nel playbook");
      return;
    }
    await Cloud.inviaProposta({
      playbook: pb.id,
      proprietario: pb.proprietario,
      schema_id: s.id,
      tipo: s.nuovo ? "nuovo" : "modifica",
      dati,
    });
    proposteMieInAttesa.add(s.id);
    await tornaAllaVersioneUfficiale(s);
    festeggiaStemma();
    mostraAvviso("Proposta inviata: entra nel playbook quando il proprietario la accetta");
  } catch (errore) {
    mostraAvviso(errore.message);
  } finally {
    bottone.disabled = false;
  }
}

function scartaBozza() {
  const s = Dati.trova(schemaCorrente.id);
  if (!s) return;
  chiediConferma(s.nuovo ? "Eliminare questo schema nuovo?" : "Scartare le modifiche?",
    s.nuovo ? "Non è ancora stato mandato al proprietario." : "Lo schema torna com'è nel playbook.",
    s.nuovo ? "Elimina" : "Scarta", async () => {
      await tornaAllaVersioneUfficiale(s);
      mostraAvviso(s.nuovo ? "Schema eliminato" : "Modifiche scartate");
    });
}

// Dopo l'invio (o lo scarto) sul computer resta la versione del playbook
async function tornaAllaVersioneUfficiale(s) {
  modificheInSospeso = false;
  clearTimeout(timerSalvataggio);
  let ufficiale = null;
  if (!s.nuovo) ufficiale = await Cloud.schemaUfficiale(s.id).catch(() => null);
  const tutti = Dati.tutti();
  Dati._scrivi(ufficiale
    ? tutti.map((x) => (x.id === s.id ? ufficiale : x))
    : tutti.filter((x) => x.id !== s.id));
  if (ufficiale) apriEditor(s.id);
  else { schemaCorrente = null; chiudiEditor(); }
}

// "Elimina" per chi può solo proporre
function proponiEliminazione() {
  const s = schemaCorrente;
  const pb = playbookCorrente;
  if (s.bozza && s.nuovo) { scartaBozza(); return; }
  chiediConferma(`Proporre di eliminare «${s.nome || "Senza nome"}»?`,
    "Lo schema sparisce dal playbook solo se il proprietario accetta.", "Proponi", async () => {
      try {
        await Cloud.inviaProposta({ playbook: pb.id, proprietario: pb.proprietario, schema_id: s.id, tipo: "elimina", dati: null });
        proposteMieInAttesa.add(s.id);
        mostraElenco();
        mostraAvviso("Proposta di eliminazione inviata");
      } catch (errore) {
        mostraAvviso(errore.message);
      }
    });
}

$("#btn-invia-bozza").addEventListener("click", inviaBozza);
$("#btn-scarta-bozza").addEventListener("click", scartaBozza);

// Chi propone: com'è andata? (proposte accettate o rifiutate dal proprietario)
async function controllaEsiti() {
  if (!Cloud.attivo || CODICE_VISTA || !Cloud.utente) return;
  if (!Playbook.tutti().some((p) => p.proprietario)) { proposteMieInAttesa = new Set(); return; }
  let mie = [];
  try { mie = await Cloud.mieProposte(); } catch { return; }
  proposteMieInAttesa = new Set(mie.filter((p) => p.stato === "in attesa").map((p) => p.schema_id));
  const decise = mie.filter((p) => p.stato !== "in attesa");
  if (decise.length) {
    const si = decise.filter((p) => p.stato === "accettata").length;
    const no = decise.length - si;
    const parti = [];
    if (si) parti.push(`${si === 1 ? "accettato 1 proposta" : `accettato ${si} proposte`}`);
    if (no) parti.push(`${no === 1 ? "rifiutato 1 proposta" : `rifiutato ${no} proposte`}`);
    mostraAvviso(`Il proprietario ha ${parti.join(" e ")}`);
    for (const p of decise) Cloud.eliminaProposta(p.id).catch(() => {});
  }
  if (!document.body.classList.contains("in-home")) mostraElenco();
}

/* ==========================================================================
   Il proprietario: proposte da accettare o rifiutare
   ========================================================================== */
let proposteInAttesa = [];

async function controllaProposte() {
  if (!Cloud.attivo || CODICE_VISTA || !Cloud.utente) return;
  try { proposteInAttesa = await Cloud.proposteDaDecidere(); } catch { proposteInAttesa = []; }
  mostraContoProposte();
}

function mostraContoProposte() {
  const n = proposteInAttesa.length;
  $("#btn-proposte-home").hidden = !n;
  $("#conta-proposte-home").textContent = n;
  const qui = playbookCorrente ? proposteInAttesa.filter((p) => p.playbook === playbookCorrente.id).length : 0;
  $("#btn-proposte-laterale").hidden = !qui;
  $("#testo-proposte-laterale").textContent = `${qui} ${qui === 1 ? "proposta" : "proposte"} dello staff da decidere`;
}

const NOMI_TIPO_PROPOSTA = { modifica: "Modifica", nuovo: "Schema nuovo", elimina: "Eliminazione" };

function apriFoglioProposte() {
  mostraProposte();
  $("#velo").hidden = false;
  $("#foglio-proposte").hidden = false;
  requestAnimationFrame(() => {
    $("#velo").classList.add("visibile");
    $("#foglio-proposte").classList.add("visibile");
  });
}

function chiudiFoglioProposte() {
  $("#velo").classList.remove("visibile");
  $("#foglio-proposte").classList.remove("visibile");
  setTimeout(() => {
    $("#velo").hidden = true;
    $("#foglio-proposte").hidden = true;
  }, 220);
}

function miniCampo(schema, etichetta, classe = "") {
  const box = elemento("figure", "proposta-campo " + classe);
  const svg = document.createElementNS(SVG_NS, "svg");
  disegnaCampo(svg, schema, { miniatura: true });
  box.appendChild(svg);
  box.appendChild(elemento("figcaption", "", etichetta));
  return box;
}

function mostraProposte() {
  const lista = $("#lista-proposte");
  lista.innerHTML = "";
  if (!proposteInAttesa.length) {
    lista.appendChild(elemento("p", "coach-vuoto", "Nessuna proposta da decidere."));
    return;
  }
  for (const p of proposteInAttesa) {
    const pb = Playbook.trova(p.playbook);
    const attuale = Dati.trova(p.schema_id);
    const card = elemento("article", "proposta");
    const testa = elemento("div", "proposta-testa");
    testa.appendChild(elemento("span", "proposta-tipo tipo-" + p.tipo, NOMI_TIPO_PROPOSTA[p.tipo]));
    const nome = (p.dati && p.dati.nome) || (attuale && attuale.nome) || "Senza nome";
    testa.appendChild(elemento("strong", "", nome));
    card.appendChild(testa);
    card.appendChild(elemento("p", "proposta-info",
      `Da ${p.autore_email || "un co-allenatore"} · ${pb ? "«" + pb.nome + "» · " : ""}${dataBreve(new Date(p.creato).getTime())}`));

    const campi = elemento("div", "proposta-campi");
    if (p.tipo === "modifica") {
      if (attuale) campi.appendChild(miniCampo(attuale, "Adesso"));
      campi.appendChild(miniCampo(p.dati, "Proposta", "nuova"));
    } else if (p.tipo === "nuovo") {
      campi.appendChild(miniCampo(p.dati, "Schema proposto", "nuova"));
    } else if (attuale) {
      campi.appendChild(miniCampo(attuale, "Da eliminare", "da-eliminare"));
    }
    card.appendChild(campi);
    if (p.tipo === "modifica" && attuale && attuale.modificato > new Date(p.creato).getTime()) {
      card.appendChild(elemento("p", "proposta-avviso", "Attenzione: lo schema è cambiato dopo questa proposta. Se accetti, vince la proposta."));
    }

    const azioni = elemento("div", "proposta-azioni");
    const no = elemento("button", "btn-secondario", "Rifiuta");
    const si = elemento("button", "btn-pieno", "Accetta");
    no.type = si.type = "button";
    no.addEventListener("click", () => decidi(p, false, card));
    si.addEventListener("click", () => decidi(p, true, card));
    azioni.append(no, si);
    card.appendChild(azioni);
    lista.appendChild(card);
  }
}

async function decidi(p, accetta, card) {
  card.classList.add("in-uscita");
  try {
    if (accetta) {
      if (p.tipo === "elimina") {
        Dati.elimina(p.schema_id);
      } else {
        const s = { ...p.dati, playbook: p.playbook };
        delete s.bozza;
        delete s.nuovo;
        Dati.salva(s);
      }
    }
    await Cloud.decidiProposta(p.id, accetta ? "accettata" : "rifiutata");
    proposteInAttesa = proposteInAttesa.filter((x) => x.id !== p.id);
    mostraContoProposte();
    // Se lo schema è aperto, lo si ricarica con la versione nuova
    if (accetta && schemaCorrente && schemaCorrente.id === p.schema_id) {
      if (Dati.trova(p.schema_id)) apriEditor(p.schema_id);
      else { schemaCorrente = null; chiudiEditor(); }
    } else if (!document.body.classList.contains("in-home")) {
      mostraElenco();
    } else {
      disegnaHome();
    }
    mostraAvviso(accetta ? "Proposta accettata" : "Proposta rifiutata");
    setTimeout(mostraProposte, 220);
  } catch (errore) {
    card.classList.remove("in-uscita");
    mostraAvviso(errore.message);
  }
}

$("#btn-proposte-home").addEventListener("click", apriFoglioProposte);
$("#btn-proposte-laterale").addEventListener("click", apriFoglioProposte);
$("#btn-proposte-chiudi").addEventListener("click", chiudiFoglioProposte);
