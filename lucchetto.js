/* ==========================================================================
   LUCCHETTO: bloccare uno schema finito
   --------------------------------------------------------------------------
   Quando lo schema è bloccato (schema.bloccato = true) niente sul campo
   si può modificare: giocatori, tracce, formazione, ribalta, annulla.
   Nome e note restano scrivibili. Si sblocca con lo stesso pulsante (tasto L).
   ========================================================================== */

// Vero se lo schema aperto è bloccato. Se lo è, avvisa il coach.
function schemaBloccato() {
  if (!schemaCorrente || !schemaCorrente.bloccato) return false;
  avvisaBloccato();
  return true;
}

let ultimoAvvisoBlocco = 0;
function avvisaBloccato() {
  if (CODICE_VISTA) return; // nel link condiviso non c'è niente da sbloccare
  // Il lucchetto "fa no" con la testa
  const btn = $("#btn-lucchetto");
  btn.classList.remove("scuoti");
  void btn.offsetWidth;
  btn.classList.add("scuoti");
  if (Date.now() - ultimoAvvisoBlocco > 2500) {
    ultimoAvvisoBlocco = Date.now();
    mostraAvviso("Schema bloccato: clicca il lucchetto per modificarlo");
  }
}

// Aggiorna pulsante e aspetto dell'editor (senza animazioni)
function aggiornaLucchetto() {
  const bloccato = Boolean(schemaCorrente && schemaCorrente.bloccato);
  const btn = $("#btn-lucchetto");
  btn.classList.toggle("chiuso", bloccato);
  btn.querySelector(".testo-lucchetto").textContent = bloccato ? "Bloccato" : "Blocca";
  btn.title = bloccato ? "Sblocca lo schema (L)" : "Blocca lo schema (L)";
  document.body.classList.toggle("schema-bloccato", bloccato);
  $("#btn-ribalta").disabled = bloccato;
  if (bloccato) {
    $("#btn-annulla").disabled = true;
    $("#btn-ripeti").disabled = true;
  } else {
    aggiornaPulsantiStoria();
  }
}

function commutaBlocco() {
  if (!schemaCorrente) return;
  chiudiMenuTracce();
  if (Tracce.disegno) Tracce.annullaDisegno();
  schemaCorrente.bloccato = !schemaCorrente.bloccato;
  giocatoreSelezionato = null;
  if (schemaCorrente.bloccato) tavolozzaAperta = false;
  ridisegna();
  salvaSubito();
  animaSigillo(schemaCorrente.bloccato);
  mostraAvviso(schemaCorrente.bloccato ? "Schema bloccato 🔒" : "Schema sbloccato: puoi modificarlo");
}

/* Animazione: il lucchetto grande compare sul campo, si chiude (o si apre)
   e svanisce; intanto quello nella barra fa un piccolo salto. */
function animaSigillo(chiudi) {
  const sigillo = $("#sigillo");
  sigillo.classList.remove("anima", "chiudi", "apri");
  void sigillo.offsetWidth;
  sigillo.classList.add("anima", chiudi ? "chiudi" : "apri");
  const btn = $("#btn-lucchetto");
  btn.classList.remove("salta");
  void btn.offsetWidth;
  btn.classList.add("salta");
}

$("#btn-lucchetto").addEventListener("click", commutaBlocco);
