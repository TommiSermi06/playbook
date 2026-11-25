/* ==========================================================================
   ACCESSO: animazione iniziale e login dell'allenatore.
   --------------------------------------------------------------------------
   1. Parte l'animazione del marchio (campo, traccia, giocatori).
   2. Se il coach è già collegato, si entra direttamente nell'app.
   3. Altrimenti compare il riquadro per accedere o registrarsi.
   ========================================================================== */

const DURATA_INTRO = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1700;
let modoAccesso = "accedi"; // "accedi" | "registrati" | "recupera" | "nuova-password"

async function avvio() {
  Cloud.inizializza();

  // Link "reimposta password" arrivato via mail: Supabase ce lo segnala
  if (Cloud.attivo) {
    Cloud.client.auth.onAuthStateChange((evento) => {
      if (evento === "PASSWORD_RECOVERY") {
        mostraAccesso();
        impostaModo("nuova-password");
      }
    });
  }

  // Link condiviso (?vedi=...): niente login, si apre il playbook in sola lettura
  if (CODICE_VISTA) {
    await new Promise((ok) => setTimeout(ok, DURATA_INTRO));
    if (Cloud.configurato) return apriVista(CODICE_VISTA);
    mostraAccesso();
    impostaModo("vista-errore");
    return;
  }

  // L'animazione e la verifica della sessione vanno in parallelo
  const [utente] = await Promise.all([
    Cloud.sessione().catch(() => null),
    new Promise((ok) => setTimeout(ok, DURATA_INTRO)),
  ]);

  // Entrato dal link d'invito di un altro coach: prima sceglie la password
  const m = (utente && utente.metadati) || {};
  if (utente && m.invitato && !m.password_scelta && modoAccesso !== "nuova-password") {
    mostraAccesso();
    impostaModo("benvenuto");
    return;
  }
  if (utente && modoAccesso !== "nuova-password") await entra(utente);
  else mostraAccesso();
}

function mostraAccesso() {
  $("#intro").classList.add("compatta");
  $("#accesso").hidden = false;
  requestAnimationFrame(() => $("#accesso").classList.add("visibile"));
  impostaModo(Cloud.attivo ? modoAccesso : "locale");
}

/* Mostra i campi giusti per ogni modalità del riquadro */
function impostaModo(modo) {
  modoAccesso = modo;
  const testi = {
    accedi:          ["Bentornato, coach", "Accedi per ritrovare i tuoi playbook.", "Accedi"],
    registrati:      ["Crea il tuo account", "Un account per ogni allenatore: i tuoi schemi restano tuoi, su ogni computer.", "Crea account"],
    recupera:        ["Password dimenticata", "Ti mandiamo una mail con il link per sceglierne una nuova.", "Invia il link"],
    "nuova-password":["Nuova password", "Scegli la nuova password per il tuo account.", "Salva password"],
    benvenuto:       ["Benvenuto nello staff", "Un altro coach ti ha invitato nel suo playbook. Scegli una password per i prossimi accessi.", "Salva ed entra"],
    "vista-errore":  ["Link non disponibile", "Il coach ha disattivato questo link, oppure non è scritto giusto. Chiedigliene uno nuovo.", "Vai a Playbook"],
    locale:          ["Modalità locale", "Gli account online non sono ancora attivi: puoi usare l'app su questo computer.", "Continua"],
  }[modo];
  $("#accesso-titolo").textContent = testi[0];
  $("#accesso-testo").textContent = testi[1];
  $("#accesso-invia").textContent = testi[2];
  $("#accesso-messaggio").textContent = "";
  $("#accesso-messaggio").className = "accesso-messaggio";

  $("#accesso-schede").hidden = !(modo === "accedi" || modo === "registrati");
  $("#accesso-schede").dataset.scelto = modo === "registrati" ? "destra" : "sinistra";
  document.querySelectorAll("#accesso-schede .segmento").forEach((b) =>
    b.classList.toggle("attivo", b.dataset.modo === modo));
  const senzaCampi = modo === "locale" || modo === "vista-errore";
  const soloPassword = modo === "nuova-password" || modo === "benvenuto";
  $("#campo-email").hidden = soloPassword || senzaCampi;
  $("#campo-password").hidden = modo === "recupera" || senzaCampi;
  $("#accesso-password").autocomplete = modo === "accedi" ? "current-password" : "new-password";
  $("#link-dimenticata").hidden = modo !== "accedi";
  $("#link-indietro").hidden = modo !== "recupera";
  $("#accesso-email").required = !$("#campo-email").hidden;
  $("#accesso-password").required = !$("#campo-password").hidden;
}

document.querySelectorAll("#accesso-schede .segmento").forEach((b) =>
  b.addEventListener("click", () => impostaModo(b.dataset.modo)));
$("#link-dimenticata").addEventListener("click", () => impostaModo("recupera"));
$("#link-indietro").addEventListener("click", () => impostaModo("accedi"));

function messaggioAccesso(testo, tipo = "errore") {
  const el = $("#accesso-messaggio");
  el.textContent = testo;
  el.className = "accesso-messaggio " + tipo;
}

$("#accesso").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("#accesso-email").value.trim();
  const password = $("#accesso-password").value;
  const bottone = $("#accesso-invia");
  bottone.disabled = true;
  bottone.classList.add("in-corso");
  messaggioAccesso("", "");

  try {
    if (modoAccesso === "vista-errore") {
      location.href = location.pathname; // l'app normale, senza il link
      return;
    } else if (modoAccesso === "locale") {
      await entra(Cloud.accediLocale());
    } else if (modoAccesso === "accedi") {
      await entra(await Cloud.accedi(email, password));
    } else if (modoAccesso === "registrati") {
      const esito = await Cloud.registrati(email, password);
      if (esito.daConfermare) {
        impostaModo("accedi");
        messaggioAccesso(`Ti abbiamo mandato una mail a ${email}: apri il link per confermare, poi accedi.`, "ok");
      } else {
        await entra(esito.utente);
      }
    } else if (modoAccesso === "recupera") {
      await Cloud.recuperaPassword(email);
      messaggioAccesso("Fatto! Controlla la posta (anche lo spam) e apri il link.", "ok");
    } else if (modoAccesso === "nuova-password" || modoAccesso === "benvenuto") {
      await Cloud.aggiornaPassword(password);
      await entra(await Cloud.sessione());
    }
  } catch (errore) {
    messaggioAccesso(errore.message);
    $("#accesso").classList.remove("scuoti");
    void $("#accesso").offsetWidth; // fa ripartire l'animazione
    $("#accesso").classList.add("scuoti");
  } finally {
    bottone.disabled = false;
    bottone.classList.remove("in-corso");
  }
});

/* Entra nell'app: prepara i dati dell'utente e fa sparire l'introduzione */
async function entra(utente) {
  Dati.imposta(utente.id);
  FormazioniMie.imposta(utente.id);
  Playbook.imposta(utente.id);
  $("#email-utente").textContent = utente.email || "Solo su questo computer";
  $("#btn-esci").textContent = utente.email ? "Esci" : "Cambia";

  // Prima i playbook (anche quelli condivisi dai co-allenatori), poi gli schemi
  const [profilo, persi] = await Promise.all([
    Cloud.caricaProfilo().catch(() => ({})),
    Playbook.sincronizza(),
    FormazioniMie.sincronizza(),
  ]);
  await Dati.sincronizza(persi);
  sistemaSchemiSenzaPlaybook(); // gli schemi di prima finiscono in un playbook
  Squadra.imposta(profilo);
  avviaApp();

  // L'introduzione si dissolve e l'app "entra" in scena
  $("#intro").classList.add("esce");
  document.body.classList.add("app-pronta");
  setTimeout(() => { $("#intro").hidden = true; }, 600);

  // Primo accesso: chiediamo nome e logo della squadra
  if (!profilo.nome_squadra && !leggiLocale("playbook.squadra-rimandata." + utente.id)) {
    setTimeout(() => apriFoglioSquadra({ primaVolta: true }), 700);
  }
}

// "Più tardi" al primo accesso: non lo richiediamo a ogni apertura
$("#btn-squadra-annulla").addEventListener("click", () => {
  if (Cloud.utente) scriviLocale("playbook.squadra-rimandata." + Cloud.utente.id, true);
});

$("#btn-esci").addEventListener("click", async () => {
  salvaInSospeso();
  await Dati.invia().catch(() => {});
  await Cloud.esci();
  location.reload(); // si riparte puliti dalla schermata di accesso
});

avvio();
