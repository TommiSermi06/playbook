/* ==========================================================================
   DATI: l'unico punto dell'app che legge e scrive gli schemi.
   --------------------------------------------------------------------------
   Per ora i dati restano sul dispositivo (localStorage). Tutto il resto
   dell'app passa da queste funzioni: quando aggiungeremo l'account e la
   sincronizzazione online (es. Supabase) cambieremo solo questo file.

   Com'è fatto uno schema:
   {
     id: "s_...",            identificativo unico
     nome: "Inside Zone",
     lato: "attacco" | "difesa",
     formazione: "pro-i",    id della formazione di partenza
     giocatori: [ { id, etichetta, x, y, forma } ],  posizioni in yarde
     note: "",
     creato: 1732400000000,  data in millisecondi
     modificato: 1732400000000
   }
   ========================================================================== */

const CHIAVE_ARCHIVIO = "playbook.schemi.v1";

const Dati = {
  // Legge tutti gli schemi salvati (lista vuota se non ce ne sono)
  tutti() {
    try {
      const testo = localStorage.getItem(CHIAVE_ARCHIVIO);
      return testo ? JSON.parse(testo) : [];
    } catch (errore) {
      console.warn("Impossibile leggere gli schemi:", errore);
      return [];
    }
  },

  // Riscrive l'intero archivio
  _scrivi(schemi) {
    try {
      localStorage.setItem(CHIAVE_ARCHIVIO, JSON.stringify(schemi));
      return true;
    } catch (errore) {
      console.warn("Impossibile salvare gli schemi:", errore);
      return false;
    }
  },

  // Cerca uno schema per id
  trova(id) {
    return this.tutti().find((s) => s.id === id) || null;
  },

  // Crea un nuovo schema con la prima formazione del lato scelto
  crea(lato) {
    const formazione = FORMAZIONI[lato][0];
    const adesso = Date.now();
    const schema = {
      id: "s_" + adesso.toString(36) + Math.random().toString(36).slice(2, 6),
      nome: "",
      lato,
      formazione: formazione.id,
      giocatori: giocatoriDaFormazione(lato, formazione.id),
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
    return this._scrivi([schema, ...altri]);
  },

  // Crea una copia di uno schema esistente
  duplica(id) {
    const originale = this.trova(id);
    if (!originale) return null;
    const copia = JSON.parse(JSON.stringify(originale));
    const adesso = Date.now();
    copia.id = "s_" + adesso.toString(36) + Math.random().toString(36).slice(2, 6);
    copia.nome = (originale.nome || "Schema") + " (copia)";
    copia.creato = adesso;
    this.salva(copia);
    return copia;
  },

  // Elimina uno schema e lo restituisce (serve per "Annulla")
  elimina(id) {
    const schemi = this.tutti();
    const eliminato = schemi.find((s) => s.id === id) || null;
    this._scrivi(schemi.filter((s) => s.id !== id));
    return eliminato;
  },
};
