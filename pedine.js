/* ==========================================================================
   PEDINE PERSONALIZZATE: NUMERO E NOME DEL GIOCATORE
   --------------------------------------------------------------------------
   Ogni pedina può avere, oltre al ruolo (g.etichetta, es. "X"):
     g.numero = "12"       → dentro il cerchio compare «#12» al posto del ruolo
     g.nome   = "Rossi"    → scritto sotto il cerchio
   Numero e nome stanno nello stesso gruppo SVG della pedina, quindi si
   muovono con lei (trascinamento, frecce, animazione, ribalta…).
   Il colore resta quello del ruolo: il ruolo non si perde, si vede nel
   pannello e nel colore.
   Usato da computer, telefono e stampa (nelle miniature il nome non si
   scrive, sarebbe illeggibile).
   ========================================================================== */

const MAX_NOME_PEDINA = 16;

// Il testo dentro la pedina: il numero se c'è, altrimenti il ruolo
function testoPedina(g) {
  return g.numero ? `#${g.numero}` : g.etichetta;
}

// Classe della scritta in base alla lunghezza (più lunga = più piccola)
function classeTestoPedina(g) {
  const t = testoPedina(g);
  if (g.numero) return "etichetta numero" + (t.length > 3 ? " lunghissima" : "");
  return "etichetta" + (t.length > 1 ? " lunga" : "");
}

// Scrive il testo dentro la pedina e, se c'è, il nome sotto
function scriviPedina(el, g, { miniatura = false } = {}) {
  const testo = crea("text", {
    class: classeTestoPedina(g),
    "text-anchor": "middle",
    "dominant-baseline": "central",
  }, el);
  testo.textContent = testoPedina(g);
  if (g.nome && !miniatura) {
    const sotto = g.forma === "lettera" ? 1.35 : RAGGIO_GIOCATORE + 0.5;
    const nome = crea("text", {
      class: "nome-pedina",
      y: sotto,
      "text-anchor": "middle",
      "dominant-baseline": "central",
    }, el);
    nome.textContent = g.nome;
  }
  return testo;
}

// Pulisce quello che scrive il coach
function pulisciNumero(v) {
  return String(v || "").replace(/[^0-9]/g, "").slice(0, 3);
}
function pulisciNome(v) {
  return String(v || "").replace(/\s+/g, " ").trim().slice(0, MAX_NOME_PEDINA);
}

// Imposta numero e nome (vuoti = tolti)
function impostaNumeroNome(g, numero, nome) {
  const n = pulisciNumero(numero);
  const s = pulisciNome(nome);
  if (n) g.numero = n; else delete g.numero;
  if (s) g.nome = s; else delete g.nome;
}

/* La «rosa»: i giocatori (numero + nome) già usati negli schemi passati,
   per i suggerimenti. Non serve un elenco a parte: si ricava dagli schemi. */
function rosaDaSchemi(schemi) {
  const visti = new Map();
  for (const s of schemi) {
    for (const g of s.giocatori || []) {
      if (!g.numero && !g.nome) continue;
      const chiave = `${g.numero || ""}|${(g.nome || "").toLowerCase()}`;
      if (!visti.has(chiave)) visti.set(chiave, { numero: g.numero || "", nome: g.nome || "" });
    }
  }
  return [...visti.values()].sort((a, b) => (+a.numero || 999) - (+b.numero || 999) || a.nome.localeCompare(b.nome));
}

// Testo di una voce della rosa, es. "#12 Rossi"
function testoRosa(r) {
  return [r.numero ? `#${r.numero}` : "", r.nome].filter(Boolean).join(" ");
}

// Da "#12 Rossi" (o "12 Rossi", "Rossi") a { numero, nome }
function leggiTestoRosa(testo) {
  const m = String(testo || "").trim().match(/^#?\s*(\d{1,3})?\s*(.*)$/);
  return { numero: pulisciNumero(m && m[1]), nome: pulisciNome(m && m[2]) };
}
