/* ==========================================================================
   LE TUE FORMAZIONI: formazioni create da zero e salvate dal coach
   --------------------------------------------------------------------------
   Funzionano come gli schemi:
   - una copia sul computer (una per account), veloce e utilizzabile offline;
   - una copia online (tabella "formazioni" su Supabase) visibile SOLO al
     coach che l'ha creata, grazie alle regole di sicurezza.

   Com'è fatta una formazione salvata:
   {
     id: "f_...",
     nome: "Trips Bunch",
     lato: "attacco" | "difesa",
     giocatori: [ { etichetta, x, y, forma } ],   (senza tracce)
     creato, modificato
   }
   ========================================================================== */

const FormazioniMie = {
  chiave: "playbook.formazioni.v1",
  daInviare: new Set(),
  daEliminare: new Set(),

  imposta(idUtente) {
    this.chiave = `playbook.formazioni.v1.${idUtente}`;
    this.daInviare = new Set(leggiLocale(this.chiave + ".da-inviare") || []);
    this.daEliminare = new Set(leggiLocale(this.chiave + ".da-eliminare") || []);
  },

  tutte() {
    return leggiLocale(this.chiave) || [];
  },

  // Le formazioni di un lato e di un formato (11, 9, 7, flag), in ordine alfabetico
  perLato(lato, formato = "11") {
    return this.tutte()
      .filter((f) => f.lato === lato && (f.formato || "11") === formato)
      .sort((a, b) => a.nome.localeCompare(b.nome, "it"));
  },

  // Cerca anche tra le formazioni dello staff (co-allenatori), solo per leggerle
  trova(id) {
    return this.tutte().find((f) => f.id === id)
      || (leggiLocale(this.chiave + ".staff") || []).find((f) => f.id === id)
      || null;
  },

  // Vero se esiste già una formazione con questo nome (stesso lato)
  nomeUsato(nome, lato, formato) {
    const n = nome.trim().toLocaleLowerCase("it");
    const pronte = formazioniPronte(lato, formato).some((f) => f.nome.toLocaleLowerCase("it") === n);
    return pronte || this.perLato(lato, formato).some((f) => f.nome.toLocaleLowerCase("it") === n);
  },

  crea(nome, lato, formato, giocatori) {
    const adesso = Date.now();
    const formazione = {
      id: "f_" + adesso.toString(36) + Math.random().toString(36).slice(2, 6),
      nome: nome.trim(),
      lato,
      formato,
      // Salviamo solo le posizioni: le tracce restano nello schema
      giocatori: giocatori.map(({ etichetta, x, y, forma }) => ({ etichetta, x, y, forma })),
      creato: adesso,
      modificato: adesso,
    };
    scriviLocale(this.chiave, [...this.tutte(), formazione]);
    this.daInviare.add(formazione.id);
    this._ricorda();
    this.invia();
    return formazione;
  },

  elimina(id) {
    const tutte = this.tutte();
    const eliminata = tutte.find((f) => f.id === id) || null;
    scriviLocale(this.chiave, tutte.filter((f) => f.id !== id));
    this.daInviare.delete(id);
    this.daEliminare.add(id);
    this._ricorda();
    this.invia();
    return eliminata;
  },

  // Per "Annulla" dopo un'eliminazione
  ripristina(formazione) {
    scriviLocale(this.chiave, [...this.tutte().filter((f) => f.id !== formazione.id), formazione]);
    this.daEliminare.delete(formazione.id);
    this.daInviare.add(formazione.id);
    this._ricorda();
    this.invia();
  },

  _ricorda() {
    scriviLocale(this.chiave + ".da-inviare", [...this.daInviare]);
    scriviLocale(this.chiave + ".da-eliminare", [...this.daEliminare]);
  },

  /* ---------------- Sincronizzazione online ---------------- */

  async invia() {
    if (!Cloud.attivo || (!this.daInviare.size && !this.daEliminare.size)) return;
    segnalaSync("inizio");
    try {
      const daSalvare = this.tutte().filter((f) => this.daInviare.has(f.id));
      if (daSalvare.length) await Cloud.salvaFormazioni(daSalvare);
      for (const id of this.daEliminare) await Cloud.eliminaFormazione(id);
      this.daInviare.clear();
      this.daEliminare.clear();
      this._ricorda();
      segnalaSync("fine");
    } catch (errore) {
      // Restano in coda: le riproviamo al prossimo salvataggio o accesso
      segnalaSync("errore", errore);
    }
  },

  // All'accesso: unisce le formazioni online con quelle del computer
  async sincronizza() {
    if (!Cloud.attivo) return;
    try {
      const tutte = await Cloud.scaricaFormazioni();
      // Quelle degli altri coach dello staff: solo per mostrarne il nome
      scriviLocale(this.chiave + ".staff", tutte.filter((f) => f._utente !== Cloud.utente.id).map(({ _utente, ...f }) => f));
      const online = tutte.filter((f) => f._utente === Cloud.utente.id && !this.daEliminare.has(f.id))
        .map(({ _utente, ...f }) => f);
      const perId = new Map(online.map((f) => [f.id, f]));
      for (const f of this.tutte()) {
        const remota = perId.get(f.id);
        if (!remota || f.modificato > remota.modificato) {
          perId.set(f.id, f);
          if (!remota) this.daInviare.add(f.id);
        }
      }
      scriviLocale(this.chiave, [...perId.values()]);
      this._ricorda();
      await this.invia();
    } catch (errore) {
      console.warn("Formazioni non sincronizzate (uso la copia sul computer):", errore);
    }
  },
};

/* ==========================================================================
   SALVARE LA FORMAZIONE CREATA DA ZERO
   ========================================================================== */
function salvaFormazioneCorrente(nome) {
  if (schemaBloccato()) return;
  const campo = $("#nome-formazione");
  nome = (nome || "").trim();
  if (!nome) {
    campo.focus();
    campo.classList.add("scuoti");
    setTimeout(() => campo.classList.remove("scuoti"), 400);
    return;
  }
  if (!statoRegole(schemaCorrente).completa) return; // le regole del formato vanno rispettate
  if (FormazioniMie.nomeUsato(nome, schemaCorrente.lato, formatoDi(schemaCorrente).id)) {
    $("#errore-formazione").textContent = "Hai già una formazione con questo nome: scegline un altro.";
    return;
  }
  const f = FormazioniMie.crea(nome, schemaCorrente.lato, formatoDi(schemaCorrente).id, schemaCorrente.giocatori);
  ricordaStato();
  schemaCorrente.formazione = f.id;
  tavolozzaAperta = false;
  formazioneAppenaSalvata = f.id; // per far "brillare" la riga nuova nell'elenco
  ridisegna();
  salvaSubito();
  festeggiaStemma();
  mostraAvviso(`«${f.nome}» salvata tra le tue formazioni`);
}

let formazioneAppenaSalvata = null;

function eliminaFormazioneMia(f) {
  chiediConferma(`Eliminare la formazione «${f.nome}»?`,
    "Gli schemi già creati con questa formazione non cambiano.", "Elimina", () => {
      const eliminata = FormazioniMie.elimina(f.id);
      ridisegna();
      mostraAvviso(`Formazione «${f.nome}» eliminata`, () => {
        FormazioniMie.ripristina(eliminata);
        ridisegna();
      });
    });
}
