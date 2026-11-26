/* ==========================================================================
   AGGIORNAMENTO AUTOMATICO
   --------------------------------------------------------------------------
   Il browser tiene in memoria la pagina per qualche minuto: dopo una nuova
   versione si poteva continuare a vedere quella vecchia finché non si
   premeva Ctrl+F5. Ora all'apertura (e quando si torna sulla scheda) si
   controlla versione.json: se online c'è una versione più nuova, la pagina
   si ricarica da sola, ma solo se non ci sono modifiche in attesa di
   salvataggio (altrimenti si salva prima).
   ========================================================================== */
const VERSIONE_PAGINA = "0.37";

async function controllaAggiornamento() {
  let online;
  try {
    const r = await fetch(`versione.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return;
    online = (await r.json()).versione;
  } catch { return; } // senza rete: si resta sulla versione che c'è
  if (!online || online === VERSIONE_PAGINA) return;
  // Una sola volta per versione, così non si entra mai in un giro di ricariche
  const chiave = "playbook.aggiornato-a";
  try { if (sessionStorage.getItem(chiave) === online) return; sessionStorage.setItem(chiave, online); } catch { /* niente */ }
  if (typeof salvaInSospeso === "function") salvaInSospeso();
  try { await fetch(location.href, { cache: "reload" }); } catch { /* niente */ } // rinfresca la copia in memoria
  location.reload();
}

controllaAggiornamento();
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") controllaAggiornamento();
});
