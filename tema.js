/* ==========================================================================
   TEMA CHIARO / SCURO (computer)
   --------------------------------------------------------------------------
   L'app nasce scura («campo di notte»). Con i pulsanti ☀️ / 🌙 (nella
   schermata d'accesso, nella pagina dei playbook e in fondo alla barra
   laterale) si passa al tema chiaro, e la scelta resta su questo computer.
   I colori sono tutti variabili CSS: il tema chiaro le cambia in
   html[data-tema="chiaro"] (style.css). Il tema si imposta già nella <head>,
   così all'apertura non si vede un lampo del tema sbagliato.
   ========================================================================== */

function temaChiaro() {
  return document.documentElement.dataset.tema === "chiaro";
}

function impostaTema(tema, { salva = true } = {}) {
  const chiaro = tema === "chiaro";
  if (chiaro) document.documentElement.dataset.tema = "chiaro";
  else delete document.documentElement.dataset.tema;
  if (salva) { try { localStorage.setItem("playbook.tema", chiaro ? "chiaro" : "scuro"); } catch { /* niente */ } }
  document.querySelectorAll(".btn-tema").forEach((b) => {
    b.textContent = chiaro ? "🌙 Tema scuro" : "☀️ Tema chiaro";
    b.title = chiaro ? "Passa al tema scuro" : "Passa al tema chiaro";
  });
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = chiaro ? "#F3F5F4" : "#0F1412";
  // I colori cambiano da soli; il logo a metà campo ha una versione per tema
  if (!salva) return;
  if (typeof schemaCorrente !== "undefined" && schemaCorrente && typeof ridisegna === "function") ridisegna();
  if (document.body.classList.contains("in-home") && typeof disegnaHome === "function") disegnaHome();
}

document.addEventListener("click", (e) => {
  const b = e.target.closest(".btn-tema");
  if (!b) return;
  e.preventDefault();
  impostaTema(temaChiaro() ? "scuro" : "chiaro");
});

impostaTema(temaChiaro() ? "chiaro" : "scuro", { salva: false }); // scritte dei pulsanti
