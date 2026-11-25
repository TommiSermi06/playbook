/* ==========================================================================
   CONDIVISIONE IN SOLA LETTURA
   --------------------------------------------------------------------------
   Il coach crea un link per un playbook (menu ⋯ → Condividi…) e lo manda
   a staff e giocatori. Chi lo apre:
   - non ha bisogno di un account;
   - vede gli schemi e può stamparli (playbook, wristband, call sheet);
   - non può modificare niente.
   Il coach può disattivare il link quando vuole, o crearne uno nuovo
   (il vecchio smette di funzionare).

   Su Supabase: tabella "condivisioni" e funzione "playbook_condiviso"
   (file supabase/condivisione.sql).
   ========================================================================== */

/* ---------- Lato coach: la finestra "Condividi" ---------- */
let playbookDaCondividere = null;

// Promemoria sul computer: quali playbook hanno un link (per tenerne aggiornato l'ordine)
function chiaveCondivisi() {
  return "playbook.condivisi." + (Cloud.utente ? Cloud.utente.id : "locale");
}
function ricordaCondiviso(idPlaybook, codice) {
  const mappa = leggiLocale(chiaveCondivisi()) || {};
  if (codice) mappa[idPlaybook] = codice;
  else delete mappa[idPlaybook];
  scriviLocale(chiaveCondivisi(), mappa);
}

function linkCondivisione(codice) {
  return `${location.origin}${location.pathname}?vedi=${codice}`;
}

function ordineSchemi(idPlaybook) {
  return schemiDelPlaybook(idPlaybook).map((s) => s.id);
}

async function apriFoglioCondividi(pb) {
  playbookDaCondividere = pb;
  $("#titolo-condividi").textContent = `Condividi «${pb.nome}»`;
  $("#errore-condividi").textContent = "";
  mostraStatoCondivisione(null, true);
  $("#velo").hidden = false;
  $("#foglio-condividi").hidden = false;
  requestAnimationFrame(() => {
    $("#velo").classList.add("visibile");
    $("#foglio-condividi").classList.add("visibile");
  });

  $("#lista-coach").innerHTML = "";
  $("#email-invito").value = "";
  $("#errore-invito").textContent = "";
  if (!Cloud.attivo) {
    mostraStatoCondivisione(null, false);
    $("#btn-invita").disabled = true;
    $("#btn-crea-link").disabled = true;
    $("#errore-condividi").textContent = "Per condividere serve un account online (ora sei in modalità locale).";
    return;
  }
  caricaCoach(pb);
  try {
    const codice = await Cloud.leggiCondivisione(pb.id);
    ricordaCondiviso(pb.id, codice);
    if (codice) Cloud.aggiornaOrdineCondivisione(pb.id, ordineSchemi(pb.id)).catch(() => {});
    mostraStatoCondivisione(codice, false);
  } catch (errore) {
    mostraStatoCondivisione(null, false);
    $("#errore-condividi").textContent = errore.message;
  }
}

// Due stati: senza link (pulsante "Crea link") e con link (copia / disattiva)
function mostraStatoCondivisione(codice, caricamento) {
  $("#condividi-attesa").hidden = !caricamento;
  $("#condividi-senza").hidden = caricamento || Boolean(codice);
  $("#condividi-con").hidden = caricamento || !codice;
  $("#btn-crea-link").disabled = false;
  if (codice) $("#link-condiviso").value = linkCondivisione(codice);
}

function chiudiFoglioCondividi() {
  $("#velo").classList.remove("visibile");
  $("#foglio-condividi").classList.remove("visibile");
  setTimeout(() => {
    $("#velo").hidden = true;
    $("#foglio-condividi").hidden = true;
  }, 220);
}

async function creaLink() {
  const pb = playbookDaCondividere;
  const bottone = $("#btn-crea-link");
  bottone.disabled = true;
  $("#errore-condividi").textContent = "";
  try {
    salvaInSospeso();
    await Dati.invia(); // il link deve mostrare gli schemi aggiornati
    const codice = await Cloud.creaCondivisione(pb.id, ordineSchemi(pb.id));
    ricordaCondiviso(pb.id, codice);
    mostraStatoCondivisione(codice, false);
    festeggiaStemma();
    copiaLink(true);
  } catch (errore) {
    $("#errore-condividi").textContent = errore.message;
  } finally {
    bottone.disabled = false;
  }
}

async function copiaLink(silenzioso = false) {
  const campo = $("#link-condiviso");
  try {
    await navigator.clipboard.writeText(campo.value);
  } catch {
    campo.select();
    document.execCommand("copy");
  }
  const b = $("#btn-copia-link");
  b.textContent = "Copiato ✓";
  b.classList.add("fatto");
  setTimeout(() => { b.textContent = "Copia"; b.classList.remove("fatto"); }, 1600);
  if (!silenzioso) mostraAvviso("Link copiato: incollalo nel gruppo della squadra");
}

function disattivaLink() {
  const pb = playbookDaCondividere;
  // Al posto della finestra compare la conferma (il velo resta)
  $("#foglio-condividi").classList.remove("visibile");
  $("#foglio-condividi").hidden = true;
  chiediConferma("Disattivare il link?", "Chi ha il link non potrà più vedere il playbook. Potrai crearne uno nuovo quando vuoi.", "Disattiva", async () => {
    try {
      await Cloud.eliminaCondivisione(pb.id);
      ricordaCondiviso(pb.id, null);
      mostraAvviso("Link disattivato");
    } catch (errore) {
      mostraAvviso(errore.message);
    }
  });
}

async function nuovoLink() {
  const pb = playbookDaCondividere;
  $("#errore-condividi").textContent = "";
  try {
    await Cloud.eliminaCondivisione(pb.id);
    ricordaCondiviso(pb.id, null);
    await creaLink();
    mostraAvviso("Nuovo link creato e copiato: il vecchio non funziona più");
  } catch (errore) {
    $("#errore-condividi").textContent = errore.message;
  }
}

$("#btn-crea-link").addEventListener("click", creaLink);
$("#btn-copia-link").addEventListener("click", () => copiaLink());
$("#btn-disattiva-link").addEventListener("click", disattivaLink);
$("#btn-nuovo-link").addEventListener("click", nuovoLink);
$("#btn-condividi-chiudi").addEventListener("click", chiudiFoglioCondividi);
$("#link-condiviso").addEventListener("focus", (e) => e.target.select());

// Quando il coach apre un playbook condiviso, il link segue il nuovo ordine degli schemi
function aggiornaOrdineSeCondiviso(idPlaybook) {
  if (!Cloud.attivo || CODICE_VISTA) return;
  const mappa = leggiLocale(chiaveCondivisi()) || {};
  if (!mappa[idPlaybook]) return;
  Cloud.aggiornaOrdineCondivisione(idPlaybook, ordineSchemi(idPlaybook)).catch(() => {});
}

/* ==========================================================================
   CO-ALLENATORI
   Il proprietario invita un coach con la sua email; quando quel coach
   accede con la stessa email, il playbook compare tra i suoi e può
   modificarne gli schemi.
   ========================================================================== */
async function caricaCoach(pb) {
  const lista = $("#lista-coach");
  if (!Cloud.attivo) return;
  try {
    const coach = await Cloud.elencoCollaboratori(pb.id);
    ricordaStaff(pb.id, coach.length);
    if (playbookDaCondividere !== pb) return;
    lista.innerHTML = "";
    if (!coach.length) lista.appendChild(elemento("li", "coach-vuoto", "Nessun co-allenatore per ora."));
    for (const c of coach) {
      const riga = elemento("li", "riga-coach");
      riga.appendChild(elemento("span", "coach-iniziale", c.email[0].toUpperCase()));
      const testi = elemento("span", "coach-testi");
      testi.appendChild(elemento("span", "coach-email", c.email));
      testi.appendChild(elemento("span", "coach-stato" + (c.utente ? " attivo" : ""),
        c.utente ? "Attivo · può modificare" : "In attesa del primo accesso"));
      riga.appendChild(testi);
      const togli = elemento("button", "coach-togli", "×");
      togli.type = "button";
      togli.title = "Togli l'accesso";
      togli.addEventListener("click", () => togliCoach(pb, c.email, riga));
      riga.appendChild(togli);
      lista.appendChild(riga);
    }
  } catch (errore) {
    $("#errore-invito").textContent = errore.message;
  }
}

$("#form-invita").addEventListener("submit", async (e) => {
  e.preventDefault();
  const pb = playbookDaCondividere;
  const email = $("#email-invito").value.trim().toLowerCase();
  $("#errore-invito").textContent = "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    $("#errore-invito").textContent = "Controlla l'indirizzo email.";
    return;
  }
  if (Cloud.utente && email === (Cloud.utente.email || "").toLowerCase()) {
    $("#errore-invito").textContent = "Questa è la tua email: il playbook è già tuo.";
    return;
  }
  const bottone = $("#btn-invita");
  bottone.disabled = true;
  try {
    await Cloud.invitaCollaboratore(pb.id, email, Squadra.nome || (Cloud.utente && Cloud.utente.email) || "");
    $("#email-invito").value = "";
    await caricaCoach(pb);
    festeggiaStemma();
    mostraAvviso(`Invitato ${email}: digli di accedere con questa mail`);
  } catch (errore) {
    $("#errore-invito").textContent = errore.message;
  } finally {
    bottone.disabled = false;
  }
});

async function togliCoach(pb, email, riga) {
  riga.classList.add("in-uscita");
  try {
    await Cloud.rimuoviCollaboratore(pb.id, email);
    await caricaCoach(pb);
    mostraAvviso(`${email} non può più modificare «${pb.nome}»`);
  } catch (errore) {
    riga.classList.remove("in-uscita");
    $("#errore-invito").textContent = errore.message;
  }
}

// Quanti co-allenatori ha ogni mio playbook (promemoria sul computer)
function chiaveStaff() { return "playbook.coach-invitati." + (Cloud.utente ? Cloud.utente.id : "locale"); }
function staffDi(idPlaybook) { return (leggiLocale(chiaveStaff()) || {})[idPlaybook] || 0; }
function ricordaStaff(idPlaybook, quanti) {
  const mappa = leggiLocale(chiaveStaff()) || {};
  if (quanti) mappa[idPlaybook] = quanti; else delete mappa[idPlaybook];
  scriviLocale(chiaveStaff(), mappa);
}

// "Condiviso da Guelfi" sulle schede e nella barra laterale
function testoStaff(pb) {
  return `Condiviso da ${pb.squadra || "un altro coach"}`;
}

// Il co-allenatore lascia un playbook condiviso con lui
function lasciaPlaybook(pb) {
  chiediConferma(`Lasciare «${pb.nome}»?`,
    "Non lo vedrai più tra i tuoi playbook. Gli schemi restano al proprietario, che può invitarti di nuovo.", "Lascia", async () => {
      try {
        await Cloud.lasciaPlaybook(pb.id);
        Playbook._scrivi(Playbook.tutti().filter((p) => p.id !== pb.id));
        Dati._scrivi(Dati.tutti().filter((s) => s.playbook !== pb.id));
        disegnaHome();
        mostraAvviso(`Hai lasciato «${pb.nome}»`);
      } catch (errore) {
        mostraAvviso(errore.message);
      }
    });
}

/* ---------- Aggiornamento dal lavoro degli altri coach ----------
   Ogni minuto (e quando si torna sulla finestra) l'app scarica le
   modifiche fatte dai co-allenatori. Non lo fa mentre si sta lavorando
   a qualcosa di non ancora salvato. */
let aggiornamentoInCorso = false;
async function aggiornaDaStaff() {
  if (!Cloud.attivo || !Cloud.utente || CODICE_VISTA || aggiornamentoInCorso) return;
  if (document.visibilityState !== "visible" || !$("#intro").hidden) return;
  const condivisi = Playbook.tutti().some((p) => p.proprietario);
  const mieiCondivisi = Object.keys(leggiLocale("playbook.coach-invitati." + Cloud.utente.id) || {}).length;
  if (!condivisi && !mieiCondivisi) return; // nessuno staff: niente da scaricare
  if (modificheInSospeso || Tracce.disegno || Dati.daInviare.size) return;
  aggiornamentoInCorso = true;
  try {
    const persi = await Playbook.sincronizza();
    const cambiato = await Dati.sincronizza(persi);
    if (modificheInSospeso || Tracce.disegno) return; // nel frattempo il coach ha toccato qualcosa
    if (document.body.classList.contains("in-home")) { disegnaHome(); return; }
    if (playbookCorrente && !Playbook.trova(playbookCorrente.id)) {
      mostraHome();
      mostraAvviso("Non hai più accesso a questo playbook");
      return;
    }
    if (!cambiato) return;
    if (schemaCorrente) {
      const fresco = Dati.trova(schemaCorrente.id);
      if (!fresco) {
        chiudiEditor();
        mostraAvviso("Questo schema è stato eliminato da un co-allenatore");
      } else if (fresco.modificato > schemaCorrente.modificato) {
        const selezionato = giocatoreSelezionato;
        apriEditor(fresco.id);
        if (selezionato && fresco.giocatori.some((g) => g.id === selezionato)) { giocatoreSelezionato = selezionato; ridisegna(); }
        mostraAvviso("Schema aggiornato da un co-allenatore");
      } else {
        mostraElenco();
      }
    } else {
      mostraElenco();
    }
  } finally {
    aggiornamentoInCorso = false;
  }
}
setInterval(aggiornaDaStaff, 60000);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") aggiornaDaStaff(); });

/* ==========================================================================
   Lato di chi apre il link: l'app in sola lettura
   ========================================================================== */
async function apriVista(codice) {
  let dati = null;
  try {
    dati = await Cloud.apriCondivisione(codice);
  } catch (errore) {
    console.warn("Link condiviso:", errore);
  }
  if (!dati || !dati.playbook) {
    mostraAccesso();
    impostaModo("vista-errore");
    return;
  }

  // Ordine degli schemi come nel playbook del coach; i nuovi in fondo
  const posizione = new Map((dati.ordine || []).map((id, i) => [id, i]));
  const schemi = (dati.schemi || [])
    .map((s) => ({ ...s, bloccato: true }))
    .sort((a, b) => (posizione.get(a.id) ?? 1e9) - (posizione.get(b.id) ?? 1e9) || a.creato - b.creato);

  // Archivi "di passaggio", separati da quelli di un eventuale account
  Dati.chiave = "playbook.vista.schemi";
  Dati.daInviare = new Set();
  Dati._scrivi(schemi);
  FormazioniMie.chiave = "playbook.vista.formazioni";
  scriviLocale(FormazioniMie.chiave, dati.formazioni || []);
  Playbook.chiave = "playbook.vista.playbook";
  scriviLocale(Playbook.chiave, [dati.playbook]);

  document.body.classList.add("sola-lettura");
  $("#nome-schema").readOnly = true;
  $("#note-schema").readOnly = true;
  $("#note-schema").placeholder = "Nessuna nota";
  $("#email-utente").textContent = "Sola lettura";
  Squadra.imposta(dati.squadra || {});
  apriPlaybook(dati.playbook.id);

  $("#intro").classList.add("esce");
  document.body.classList.add("app-pronta");
  setTimeout(() => { $("#intro").hidden = true; }, 600);
}
