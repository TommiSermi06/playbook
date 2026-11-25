/* ==========================================================================
   CLOUD: tutto quello che parla con il servizio online (Supabase).
   --------------------------------------------------------------------------
   - account: registrazione, accesso, password dimenticata, uscita
   - profilo della squadra: nome e logo
   - schemi: scaricare, salvare, eliminare

   Se config.js è vuoto l'app lavora in "modalità locale" e queste funzioni
   salvano tutto nel browser, così l'app resta usabile anche senza account.
   ========================================================================== */

const Cloud = {
  client: null,
  utente: null, // { id, email }

  // Vero se config.js contiene i dati di Supabase
  get attivo() {
    return Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_KEY && window.supabase);
  },

  inizializza() {
    if (this.attivo && !this.client) {
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
    this.utente = u ? { id: u.id, email: u.email } : null;
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
    const { error } = await this.client.auth.updateUser({ password });
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
      utente: this.utente.id,
      dati: s,
      modificato: new Date(s.modificato).toISOString(),
    }));
    const { error } = await this.client.from("schemi").upsert(righe);
    if (error) throw new Error(traduciErrore(error));
  },

  async eliminaSchema(id) {
    const { error } = await this.client.from("schemi").delete().eq("id", id);
    if (error) throw new Error(traduciErrore(error));
  },
};

/* ---------- Piccoli aiuti ---------- */
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
  if (/already registered|already been registered/i.test(m)) return "Esiste già un account con questa mail. Prova ad accedere.";
  if (/Password should be at least/i.test(m)) return "La password deve avere almeno 6 caratteri.";
  if (/valid email|invalid format|Unable to validate email/i.test(m)) return "Controlla l'indirizzo email.";
  if (/rate limit|too many/i.test(m)) return "Troppi tentativi ravvicinati. Riprova tra qualche minuto.";
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "Nessuna connessione. Controlla internet e riprova.";
  return m;
}
