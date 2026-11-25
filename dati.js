/* ==========================================================================
   DATI: l'unico punto dell'app che legge e scrive gli schemi.
   --------------------------------------------------------------------------
   Come funziona:
   1. Gli schemi stanno in una copia sul computer (localStorage), una per
      ogni account: così l'app è velocissima e funziona anche senza internet.
   2. Ogni modifica viene poi mandata online (Supabase) dopo un attimo,
      in sottofondo. Se manca la connessione, riprova più tardi.
   3. All'accesso uniamo la copia locale con quella online, tenendo per
      ogni schema la versione modificata più di recente.

   Com'è fatto uno schema:
   {
     id: "s_...",            identificativo unico
     nome: "Inside Zone",
     lato: "attacco" | "difesa",
     formazione: "pro-i",    formazione di partenza (null = nessuna, "libera" = da zero)
     bloccato: false,        vero se lo schema è chiuso col lucchetto
     ribaltato: false,       vero se lo schema è a specchio
     giocatori: [ { id, etichetta, x, y, forma } ],  posizioni in yarde
     note: "",
     creato: 1732400000000,  data in millisecondi
     modificato: 1732400000000
   }
   ========================================================================== */

const VECCHIA_CHIAVE = "playbook.schemi.v1"; // prima degli account

const Dati = {
  chiave: VECCHIA_CHIAVE,
  daInviare: new Set(), // id degli schemi modificati da mandare online
  timerInvio: null,

  // Sceglie l'archivio dell'utente collegato
  imposta(idUtente) {
    this.chiave = `${VECCHIA_CHIAVE}.${idUtente}`;
    this.daInviare = new Set(leggiLocale(this.chiave + ".da-inviare") || []);

    // Gli schemi creati prima che esistessero gli account passano
    // al primo utente che accede su questo computer.
    const vecchi = leggiLocale(VECCHIA_CHIAVE);
    if (vecchi && vecchi.length) {
      const attuali = this.tutti();
      const ids = new Set(attuali.map((s) => s.id));
      const nuovi = vecchi.filter((s) => !ids.has(s.id));
      this._scrivi([...attuali, ...nuovi]);
      nuovi.forEach((s) => this.daInviare.add(s.id));
      this._ricordaDaInviare();
      localStorage.removeItem(VECCHIA_CHIAVE);
    }
  },

  // Legge tutti gli schemi (lista vuota se non ce ne sono)
  tutti() {
    return leggiLocale(this.chiave) || [];
  },

  _scrivi(schemi) {
    try {
      localStorage.setItem(this.chiave, JSON.stringify(schemi));
      return true;
    } catch (errore) {
      console.warn("Impossibile salvare gli schemi:", errore);
      return false;
    }
  },

  trova(id) {
    return this.tutti().find((s) => s.id === id) || null;
  },

  nuovoId() {
    return "s_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },

  // Crea un nuovo schema: campo vuoto, il coach sceglie o crea la formazione
  crea(lato) {
    const adesso = Date.now();
    const schema = {
      id: this.nuovoId(),
      nome: "",
      lato,
      playbook: playbookCorrente ? playbookCorrente.id : null, // a quale playbook appartiene
      formato: playbookCorrente ? playbookCorrente.formato : formatoPreferito(), // "11", "9", "7" o "flag"
      formazione: null,       // null = nessuna, "libera" = creata da zero
      ribaltato: false,
      bloccato: false,
      giocatori: [],
      note: "",
      creato: adesso,
      modificato: adesso,
    };
    this.salva(schema);
    return schema;
  },

  // Salva: uno schema già esistente resta al suo posto nell'elenco
  // (così l'ordine del playbook non cambia), uno nuovo va in cima.
  salva(schema) {
    schema.modificato = Date.now();
    const tutti = this.tutti();
    const i = tutti.findIndex((s) => s.id === schema.id);
    const bozza = this._segnaBozza(schema, i >= 0 ? tutti[i] : null);
    if (i >= 0) tutti[i] = schema;
    else tutti.unshift(schema);
    const ok = this._scrivi(tutti);
    if (bozza) segnalaSync("fine"); // resta solo sul computer finché non diventa una proposta
    else this.programmaInvio(schema.id);
    return ok;
  },

  /* Nei playbook dove posso solo proporre, ogni modifica diventa una BOZZA:
     la vedo solo io finché non la mando al proprietario (bozza = true;
     nuovo = true se lo schema non esiste nel playbook ufficiale). */
  _segnaBozza(schema, prima) {
    const permesso = Playbook.permesso(schema.playbook);
    if (permesso !== "proposta" && permesso !== "lettura") return false;
    schema.bozza = true;
    schema.nuovo = !prima || Boolean(prima.nuovo);
    return true;
  },

  // Aggiorna molti schemi in una volta, lasciandoli al loro posto nell'elenco
  aggiornaMolti(schemi) {
    const perId = new Map(schemi.map((s) => [s.id, s]));
    const adesso = Date.now();
    const prima = new Map(this.tutti().map((s) => [s.id, s]));
    schemi.forEach((s) => { s.modificato = adesso; });
    const daMandare = schemi.filter((s) => !this._segnaBozza(s, prima.get(s.id)));
    this._scrivi(this.tutti().map((s) => perId.get(s.id) || s));
    daMandare.forEach((s) => this.daInviare.add(s.id));
    this._ricordaDaInviare();
    clearTimeout(this.timerInvio);
    this.timerInvio = setTimeout(() => this.invia(), 300);
  },

  // Importa molti schemi in una volta, mantenendo il loro ordine
  importa(schemi) {
    this._scrivi([...schemi, ...this.tutti()]);
    schemi.forEach((s) => this.daInviare.add(s.id));
    this._ricordaDaInviare();
    clearTimeout(this.timerInvio);
    this.timerInvio = setTimeout(() => this.invia(), 300);
  },

  duplica(id) {
    const originale = this.trova(id);
    if (!originale) return null;
    const copia = JSON.parse(JSON.stringify(originale));
    copia.id = this.nuovoId();
    copia.nome = (originale.nome || "Schema") + " (copia)";
    copia.bloccato = false; // la copia nasce sbloccata, pronta da modificare
    copia.creato = Date.now();
    this.salva(copia);
    return copia;
  },

  // Elimina uno schema e lo restituisce (serve per "Annulla")
  elimina(id) {
    const schemi = this.tutti();
    const eliminato = schemi.find((s) => s.id === id) || null;
    this._scrivi(schemi.filter((s) => s.id !== id));
    this.daInviare.delete(id);
    this._ricordaDaInviare();
    if (Cloud.attivo) {
      segnalaSync("inizio");
      Cloud.eliminaSchema(id)
        .then(() => segnalaSync("fine"))
        .catch((e) => segnalaSync("errore", e));
    }
    return eliminato;
  },

  /* ---------------- Sincronizzazione online ---------------- */

  _ricordaDaInviare() {
    scriviLocale(this.chiave + ".da-inviare", [...this.daInviare]);
  },

  // Raccoglie le modifiche e le manda online dopo un attimo (non a ogni tasto)
  programmaInvio(id) {
    if (!Cloud.attivo) { segnalaSync("fine"); return; }
    this.daInviare.add(id);
    this._ricordaDaInviare();
    clearTimeout(this.timerInvio);
    this.timerInvio = setTimeout(() => this.invia(), 800);
  },

  async invia() {
    if (!Cloud.attivo || !this.daInviare.size) return;
    // Bozze e playbook dove non posso scrivere non partono mai
    const ids = [...this.daInviare];
    const schemi = this.tutti().filter((s) => ids.includes(s.id)
      && !s.bozza && ["proprietario", "modifica"].includes(Playbook.permesso(s.playbook)));
    ids.filter((id) => !schemi.some((s) => s.id === id)).forEach((id) => this.daInviare.delete(id));
    if (!schemi.length) { this._ricordaDaInviare(); return; }
    segnalaSync("inizio");
    try {
      await Cloud.salvaSchemi(schemi);
      ids.forEach((id) => this.daInviare.delete(id));
      this._ricordaDaInviare();
      segnalaSync("fine");
    } catch (errore) {
      segnalaSync("errore", errore);
      // Riprova tra 15 secondi (es. connessione tornata)
      clearTimeout(this.timerInvio);
      this.timerInvio = setTimeout(() => this.invia(), 15000);
    }
  },

  /* Unisce gli schemi online con quelli sul computer (all'accesso e,
     con i co-allenatori, di tanto in tanto). Per ogni schema vince la
     versione modificata più di recente.
     "persi" = playbook condivisi non più accessibili: i loro schemi
     spariscono dal computer. Restituisce true se qualcosa è cambiato. */
  async sincronizza(persi = []) {
    if (!Cloud.attivo) return false;
    segnalaSync("inizio");
    try {
      const online = await Cloud.scaricaSchemi();
      const locali = this.tutti();
      const perId = new Map(online.map((s) => [s.id, s]));
      const tolti = new Set(persi);
      let cambiato = false;

      for (const s of locali) {
        if (tolti.has(s.playbook)) { this.daInviare.delete(s.id); cambiato = true; continue; }
        if (s.bozza) { perId.set(s.id, s); continue; } // la mia bozza resta finché non la mando
        const remoto = perId.get(s.id);
        if (!remoto) {
          // Non è online: se aspettava di essere inviato è nuovo e lo teniamo,
          // altrimenti è stato eliminato (anche da un co-allenatore)
          if (this.daInviare.has(s.id)) perId.set(s.id, s);
          else cambiato = true;
        } else if (s.modificato > remoto.modificato) {
          perId.set(s.id, s);
          this.daInviare.add(s.id);
        } else if (remoto.modificato > s.modificato) {
          cambiato = true;
        }
      }
      if (online.some((s) => !locali.some((l) => l.id === s.id))) cambiato = true;

      // L'ordine del computer resta; gli schemi arrivati da online vanno in cima
      const posizione = new Map(locali.map((s, i) => [s.id, i]));
      const uniti = [...perId.values()].sort((a, b) =>
        (posizione.has(a.id) ? posizione.get(a.id) : -1) - (posizione.has(b.id) ? posizione.get(b.id) : -1)
        || b.modificato - a.modificato);
      this._scrivi(uniti);
      this._ricordaDaInviare();
      segnalaSync("fine");
      await this.invia();
      return cambiato;
    } catch (errore) {
      segnalaSync("errore", errore);
      return false;
    }
  },
};

/* Avvisa il resto dell'app quando inizia o finisce un salvataggio online.
   Serve per l'indicatore "Sincronizzato" e per l'animazione del logo. */
function segnalaSync(stato, errore = null) {
  if (errore) console.warn("Sincronizzazione:", errore);
  document.dispatchEvent(new CustomEvent("playbook:sync", { detail: { stato, errore } }));
}
