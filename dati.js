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

  // Salva (nuovo o aggiornato). Lo schema modificato finisce in cima.
  salva(schema) {
    schema.modificato = Date.now();
    const altri = this.tutti().filter((s) => s.id !== schema.id);
    const ok = this._scrivi([schema, ...altri]);
    this.programmaInvio(schema.id);
    return ok;
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
    const ids = [...this.daInviare];
    const schemi = this.tutti().filter((s) => ids.includes(s.id));
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

  // All'accesso: unisce gli schemi online con quelli sul computer
  async sincronizza() {
    if (!Cloud.attivo) return;
    segnalaSync("inizio");
    try {
      const online = await Cloud.scaricaSchemi();
      const locali = this.tutti();
      const perId = new Map(online.map((s) => [s.id, s]));

      for (const s of locali) {
        const remoto = perId.get(s.id);
        // Più recente sul computer (o mai inviato): vince la copia locale
        if (!remoto || s.modificato > remoto.modificato) {
          perId.set(s.id, s);
          this.daInviare.add(s.id);
        }
      }
      const uniti = [...perId.values()].sort((a, b) => b.modificato - a.modificato);
      this._scrivi(uniti);
      this._ricordaDaInviare();
      segnalaSync("fine");
      await this.invia();
    } catch (errore) {
      segnalaSync("errore", errore);
    }
  },
};

/* Avvisa il resto dell'app quando inizia o finisce un salvataggio online.
   Serve per l'indicatore "Sincronizzato" e per l'animazione del logo. */
function segnalaSync(stato, errore = null) {
  if (errore) console.warn("Sincronizzazione:", errore);
  document.dispatchEvent(new CustomEvent("playbook:sync", { detail: { stato, errore } }));
}
