/* ==========================================================================
   CLOUD: tutto quello che parla con il servizio online (Supabase).
   --------------------------------------------------------------------------
   - account: registrazione, accesso, password dimenticata, uscita
   - profilo della squadra: nome e logo
   - schemi: scaricare, salvare, eliminare

   Se config.js è vuoto l'app lavora in "modalità locale" e queste funzioni
   salvano tutto nel browser, così l'app resta usabile anche senza account.
   ========================================================================== */

/* Link condiviso in sola lettura: index.html?vedi=CODICE
   In questa modalità non c'è nessun account e niente viene salvato online. */
const CODICE_VISTA = new URLSearchParams(location.search).get("vedi");

const Cloud = {
  client: null,
  utente: null, // { id, email }

  // Vero se config.js contiene i dati di Supabase
  // (e non stiamo guardando un link condiviso: lì non si salva niente)
  get attivo() {
    return this.configurato && !CODICE_VISTA;
  },

  get configurato() {
    return Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_KEY && window.supabase);
  },

  inizializza() {
    if (this.configurato && !this.client) {
      this.client = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
    }
  },

  /* ---------------- Account ---------------- */

  // Restituisce l'utente già collegato (sessione salvata), oppure null
  async sessione() {
    if (!this.attivo) {
      const locale = leggiLocale("playbook.utente-locale");
      this.utente = locale;
      return locale;
    }
    const { data } = await this.client.auth.getSession();
    const u = data.session && data.session.user;
    this.utente = u ? { id: u.id, email: u.email, metadati: u.user_metadata || {} } : null;
    return this.utente;
  },

  async accedi(email, password) {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(traduciErrore(error));
    this.utente = { id: data.user.id, email: data.user.email };
    return this.utente;
  },

  // Crea l'account. Se Supabase chiede di confermare la mail, non c'è ancora
  // una sessione: lo segnaliamo con daConfermare = true.
  async registrati(email, password) {
    const { data, error } = await this.client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: location.origin + location.pathname },
    });
    if (error) throw new Error(traduciErrore(error));
    if (!data.session) return { daConfermare: true };
    this.utente = { id: data.user.id, email: data.user.email };
    return { utente: this.utente };
  },

  async recuperaPassword(email) {
    const { error } = await this.client.auth.resetPasswordForEmail(email, {
      redirectTo: location.origin + location.pathname,
    });
    if (error) throw new Error(traduciErrore(error));
  },

  async aggiornaPassword(password) {
    // password_scelta: chi è entrato dal link d'invito non la richiede più
    const { error } = await this.client.auth.updateUser({ password, data: { password_scelta: true } });
    if (error) throw new Error(traduciErrore(error));
  },

  // Modalità locale: "entra" senza account, solo su questo computer
  accediLocale() {
    this.utente = { id: "locale", email: null };
    scriviLocale("playbook.utente-locale", this.utente);
    return this.utente;
  },

  async esci() {
    if (this.attivo) await this.client.auth.signOut();
    else localStorage.removeItem("playbook.utente-locale");
    this.utente = null;
  },

  /* ---------------- Profilo della squadra ---------------- */

  async caricaProfilo() {
    const chiave = "playbook.profilo." + this.utente.id;
    if (!this.attivo) return leggiLocale(chiave) || {};
    const { data, error } = await this.client
      .from("profili").select("nome_squadra, logo_url").eq("id", this.utente.id).maybeSingle();
    if (error) {
      console.warn("Profilo non caricato, uso la copia locale:", error);
      return leggiLocale(chiave) || {};
    }
    const profilo = data || {};
    scriviLocale(chiave, profilo); // copia per quando si è offline
    return profilo;
  },

  async salvaProfilo(profilo) {
    scriviLocale("playbook.profilo." + this.utente.id, profilo);
    if (!this.attivo) return;
    const { error } = await this.client.from("profili").upsert({
      id: this.utente.id,
      nome_squadra: profilo.nome_squadra || null,
      logo_url: profilo.logo_url || null,
      aggiornato: new Date().toISOString(),
    });
    if (error) throw new Error(traduciErrore(error));
  },

  // Carica il logo (già trasformato in PNG) e restituisce l'indirizzo dell'immagine
  async caricaLogo(blobPng, dataUrl) {
    if (!this.attivo) return dataUrl; // in locale teniamo l'immagine nel browser
    const percorso = `${this.utente.id}/logo.png`;
    const { error } = await this.client.storage.from("loghi")
      .upload(percorso, blobPng, { upsert: true, contentType: "image/png", cacheControl: "3600" });
    if (error) throw new Error(traduciErrore(error));
    const { data } = this.client.storage.from("loghi").getPublicUrl(percorso);
    return data.publicUrl + "?v=" + Date.now(); // il ?v= evita di vedere il logo vecchio
  },

  /* ---------------- Schemi ---------------- */

  async scaricaSchemi() {
    const { data, error } = await this.client.from("schemi").select("dati");
    if (error) throw new Error(traduciErrore(error));
    return data.map((riga) => riga.dati);
  },

  async salvaSchemi(schemi) {
    if (!schemi.length) return;
    const righe = schemi.map((s) => ({
      id: s.id,
      // Lo schema di un playbook condiviso resta del proprietario del playbook
      utente: Playbook.proprietarioDi(s.playbook) || this.utente.id,
      dati: s,
      modificato: new Date(s.modificato).toISOString(),
    }));
    const { error } = await this.client.from("schemi").upsert(righe);
    if (error) throw new Error(traduciErrore(error));
  },

  /* ---------------- Tabelle "semplici" (es. playbook) ----------------
     Ogni riga: id, utente, dati (JSON), modificato. */
  async scaricaRighe(tabella) {
    const { data, error } = await this.client.from(tabella).select("dati");
    if (error) throw new Error(traduciErrore(error));
    return data.map((riga) => riga.dati);
  },

  async salvaRighe(tabella, elementi) {
    const righe = elementi.map((x) => ({
      id: x.id, utente: this.utente.id, dati: x, modificato: new Date(x.modificato).toISOString(),
    }));
    const { error } = await this.client.from(tabella).upsert(righe);
    if (error) throw new Error(traduciErrore(error));
  },

  async eliminaRiga(tabella, id) {
    const { error } = await this.client.from(tabella).delete().eq("id", id);
    if (error) throw new Error(traduciErrore(error));
  },

  /* ---------------- Formazioni salvate dal coach ---------------- */

  // Formazioni: le proprie e (in sola lettura) quelle dello staff
  async scaricaFormazioni() {
    const { data, error } = await this.client.from("formazioni").select("dati, utente");
    if (error) throw new Error(traduciErrore(error));
    return data.map((riga) => ({ ...riga.dati, _utente: riga.utente }));
  },

  async salvaFormazioni(formazioni) {
    const righe = formazioni.map((f) => ({
      id: f.id,
      utente: this.utente.id,
      dati: f,
      modificato: new Date(f.modificato).toISOString(),
    }));
    const { error } = await this.client.from("formazioni").upsert(righe);
    if (error) throw new Error(traduciErrore(error));
  },

  async eliminaFormazione(id) {
    const { error } = await this.client.from("formazioni").delete().eq("id", id);
    if (error) throw new Error(traduciErrore(error));
  },

  /* ---------------- Co-allenatori ---------------- */

  // Playbook visibili: i propri e quelli in cui si è co-allenatori
  async scaricaPlaybook() {
    const { data, error } = await this.client.from("playbook").select("dati, utente");
    if (error) throw new Error(traduciErrore(error));
    return data.map((riga) => ({ dati: riga.dati, utente: riga.utente }));
  },

  // Collega all'account gli inviti fatti alla sua email
  async accettaInviti() {
    const { data, error } = await this.client.rpc("accetta_inviti");
    if (error) throw new Error(traduciErrore(error));
    return data || 0;
  },

  // I playbook in cui sono co-allenatore (con il nome della squadra del proprietario)
  async mieCollaborazioni() {
    const { data, error } = await this.client.from("collaboratori")
      .select("playbook, proprietario, squadra").eq("utente", this.utente.id);
    if (error) throw new Error(traduciErrore(error));
    return data;
  },

  async elencoCollaboratori(idPlaybook) {
    const { data, error } = await this.client.from("collaboratori")
      .select("email, utente, creato").eq("playbook", idPlaybook).eq("proprietario", this.utente.id);
    if (error) throw new Error(traduciErrore(error));
    return data.sort((a, b) => a.creato.localeCompare(b.creato));
  },

  async invitaCollaboratore(idPlaybook, email, squadra) {
    const { error } = await this.client.from("collaboratori")
      .insert({ playbook: idPlaybook, proprietario: this.utente.id, email, squadra });
    if (error) throw new Error(traduciErrore(error));
  },

  /* Manda al coach invitato una mail con il link per entrare in Playbook.
     Se non ha un account, il link glielo crea (poi sceglie la password).
     Usa un "client" separato, così l'account del proprietario non cambia. */
  async mandaInvito(email) {
    const invii = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
              flowType: "implicit", storageKey: "playbook-invito" },
    });
    const { error } = await invii.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: location.origin + location.pathname,
        data: { invitato: true },
      },
    });
    if (error) throw new Error(traduciErrore(error));
  },

  async rimuoviCollaboratore(idPlaybook, email) {
    const { error } = await this.client.from("collaboratori")
      .delete().eq("playbook", idPlaybook).eq("email", email);
    if (error) throw new Error(traduciErrore(error));
  },

  // Il co-allenatore lascia il playbook
  async lasciaPlaybook(idPlaybook) {
    const { error } = await this.client.from("collaboratori")
      .delete().eq("playbook", idPlaybook).eq("utente", this.utente.id);
    if (error) throw new Error(traduciErrore(error));
  },

  /* ---------------- Condivisione in sola lettura ---------------- */

  // Il link già creato per questo playbook (o null)
  async leggiCondivisione(idPlaybook) {
    const { data, error } = await this.client.from("condivisioni")
      .select("codice").eq("playbook", idPlaybook).maybeSingle();
    if (error) throw new Error(traduciErrore(error));
    return data ? data.codice : null;
  },

  async creaCondivisione(idPlaybook, ordine) {
    const codice = nuovoCodice();
    const { error } = await this.client.from("condivisioni")
      .insert({ codice, utente: this.utente.id, playbook: idPlaybook, ordine });
    if (error) throw new Error(traduciErrore(error));
    return codice;
  },

  async eliminaCondivisione(idPlaybook) {
    const { error } = await this.client.from("condivisioni").delete().eq("playbook", idPlaybook);
    if (error) throw new Error(traduciErrore(error));
  },

  async aggiornaOrdineCondivisione(idPlaybook, ordine) {
    const { error } = await this.client.from("condivisioni").update({ ordine }).eq("playbook", idPlaybook);
    if (error) throw new Error(traduciErrore(error));
  },

  // Chi apre il link: legge il playbook condiviso (senza account)
  async apriCondivisione(codice) {
    const { data, error } = await this.client.rpc("playbook_condiviso", { codice_link: codice });
    if (error) throw new Error(traduciErrore(error));
    return data; // null se il link non esiste più
  },

  async eliminaSchema(id) {
    const { error } = await this.client.from("schemi").delete().eq("id", id);
    if (error) throw new Error(traduciErrore(error));
  },
};

/* ---------- Piccoli aiuti ---------- */
// Codice casuale e lungo per i link: impossibile da indovinare
function nuovoCodice() {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const byte = crypto.getRandomValues(new Uint8Array(24));
  return [...byte].map((b) => alfabeto[b % alfabeto.length]).join("");
}

function leggiLocale(chiave) {
  try { return JSON.parse(localStorage.getItem(chiave)); } catch { return null; }
}
function scriviLocale(chiave, valore) {
  try { localStorage.setItem(chiave, JSON.stringify(valore)); } catch (e) { console.warn(e); }
}

// Messaggi di errore di Supabase tradotti in italiano semplice
function traduciErrore(errore) {
  const m = (errore && errore.message) || String(errore);
  if (/Invalid login credentials/i.test(m)) return "Email o password non corretti.";
  if (/Email not confirmed/i.test(m)) return "Devi ancora confermare la mail: controlla la posta (anche lo spam).";
  if (/already registered|already been registered/i.test(m)) return "Esiste già un account con questa mail. Prova ad accedere: se ti hanno invitato e non hai ancora una password, apri il link nella mail o usa «Password dimenticata?».";
  if (/Password should be at least/i.test(m)) return "La password deve avere almeno 6 caratteri.";
  if (/valid email|invalid format|Unable to validate email/i.test(m)) return "Controlla l'indirizzo email.";
  if (/rate limit|too many/i.test(m)) return "Troppi tentativi ravvicinati. Riprova tra qualche minuto.";
  if (/collaboratori|accetta_inviti/i.test(m) && /does not exist|Could not find|schema cache/i.test(m))
    return "Manca un passaggio su Supabase: esegui lo script «coallenatori.sql» nell'SQL Editor.";
  if (/not authorized|not allowed to send/i.test(m))
    return "Supabase per ora manda mail solo agli indirizzi del tuo team: serve collegare un servizio mail (gratuito).";
  if (/collaboratori_pkey/i.test(m)) return "Questa email è già stata invitata.";
  if (/condivisioni|playbook_condiviso/i.test(m) && /does not exist|Could not find|schema cache/i.test(m))
    return "Manca un passaggio su Supabase: esegui lo script «condivisione.sql» nell'SQL Editor.";
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "Nessuna connessione. Controlla internet e riprova.";
  return m;
}
