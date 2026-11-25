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

  if (!Cloud.attivo) {
    mostraStatoCondivisione(null, false);
    $("#btn-crea-link").disabled = true;
    $("#errore-condividi").textContent = "Per condividere serve un account online (ora sei in modalità locale).";
    return;
  }
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
    salvaSubito();
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
