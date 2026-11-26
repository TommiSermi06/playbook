/* ==========================================================================
   AVVERSARI IN TRASPARENZA (computer): metterli e spostarli
   --------------------------------------------------------------------------
   Nel pannello a destra, sezione «Avversari»:
   - «Carica…»: una formazione pronta, una delle tue o uno schema del
     playbook dell'altro lato (solo le posizioni)
   - le pedine: un clic ne aggiunge una nella sua posizione tipica
   - Mostra / nascondi, Togli tutti
   Sul campo le pedine avversarie si trascinano come le tue (i tuoi
   giocatori hanno la precedenza se sono sovrapposti); clic per sceglierne
   una, Canc per toglierla. Tutto con Annulla (Ctrl+Z).
   ========================================================================== */

const Avversari = { sel: null }; // id della pedina avversaria scelta

const nuovoIdAvversario = () => "a_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

// Pedine dell'altro lato (come la tavolozza, ma per l'avversario)
function pedineAvversarie() {
  const lato = latoAvversario(schemaCorrente);
  const flag = formatoDi(schemaCorrente).flag;
  if (lato === "attacco") {
    return flag ? ["C", "QB", "RB", "X", "Y", "Z", "H", "WR"] : ["C", "G", "T", "QB", "RB", "FB", "X", "Y", "Z", "H", "TE"];
  }
  return flag ? ["R", "W", "M", "C", "FS", "SS", "NB"] : ["E", "T", "N", "DE", "W", "M", "S", "B", "C", "FS", "SS", "NB"];
}

// Pedina avversaria sotto il mouse (se visibili)
function avversarioVicino(p) {
  let migliore = null, distanza = 1.4;
  for (const g of avversariVisibili(schemaCorrente)) {
    const d = Math.hypot(g.x - p.x, yDisegno(g.y) - p.y);
    if (d < distanza) { distanza = d; migliore = g; }
  }
  return migliore;
}

// Posizione tipica di una pedina avversaria (dalle formazioni pronte dell'altro lato)
function posizioneAvversario(sigla) {
  const lato = latoAvversario(schemaCorrente);
  const occupati = schemaCorrente.avversari || [];
  const libero = (x, y) => occupati.every((g) => Math.hypot(g.x - x, g.y - y) > 1.6);
  const formato = formatoDi(schemaCorrente).id;
  for (const f of [...formazioniPronte(lato, formato), ...FORMAZIONI[lato].filter((x) => x.formato !== formato)]) {
    for (const g of f.giocatori) if (g.etichetta === sigla && libero(g.x, g.y)) return { x: g.x, y: g.y };
  }
  const base = lato === "attacco" ? { x: CENTRO, y: -4 } : { x: CENTRO, y: 5 };
  for (let passo = 0; passo < 20; passo++) {
    const x = base.x + (passo % 2 ? 1 : -1) * Math.ceil(passo / 2) * 2.4;
    if (libero(x, base.y)) return { x, y: base.y };
  }
  return base;
}

/* ---------- Azioni ---------- */
function aggiungiAvversario(sigla) {
  if (schemaBloccato()) return;
  const lista = schemaCorrente.avversari = schemaCorrente.avversari || [];
  const max = formatoDi(schemaCorrente).giocatori;
  if (lista.length >= max) { mostraAvviso(`Gli avversari in campo sono già ${max}`); return; }
  ricordaStato();
  const lato = latoAvversario(schemaCorrente);
  const pos = posizioneAvversario(sigla);
  const g = { id: nuovoIdAvversario(), etichetta: sigla, x: +pos.x.toFixed(1), y: limitaY(lato, pos.y, { avvisa: false }), forma: formaAvversario(lato, sigla) };
  lista.push(g);
  schemaCorrente.avversariNascosti = false;
  Avversari.sel = g.id;
  ridisegna();
  salvaTraPoco();
}

function caricaAvversari(chiave) {
  if (!chiave || schemaBloccato()) return;
  const lato = latoAvversario(schemaCorrente);
  const [tipo, id] = chiave.split(":");
  let giocatori = [];
  if (tipo === "schema") {
    const s = Dati.trova(id);
    giocatori = s ? s.giocatori : [];
  } else {
    giocatori = giocatoriDaFormazione(lato, id);
  }
  if (!giocatori.length) return;
  ricordaStato();
  schemaCorrente.avversari = giocatori.map((g) => ({
    id: nuovoIdAvversario() + Math.random().toString(36).slice(2, 4),
    etichetta: g.etichetta,
    x: g.x,
    y: limitaY(lato, g.y, { avvisa: false }),
    forma: g.forma || formaAvversario(lato, g.etichetta),
  }));
  schemaCorrente.avversariNascosti = false;
  Avversari.sel = null;
  ridisegna();
  salvaTraPoco();
  mostraAvviso(`${lato === "difesa" ? "Difesa" : "Attacco"} avversaria caricata: trascina le pedine dove vuoi`, annulla);
}

function togliAvversari() {
  if (!(schemaCorrente.avversari || []).length || schemaBloccato()) return;
  ricordaStato();
  schemaCorrente.avversari = [];
  Avversari.sel = null;
  ridisegna();
  salvaTraPoco();
  mostraAvviso("Avversari tolti", annulla);
}

function togliAvversarioScelto() {
  const lista = schemaCorrente.avversari || [];
  const g = lista.find((x) => x.id === Avversari.sel);
  if (!g || schemaBloccato()) return false;
  ricordaStato();
  schemaCorrente.avversari = lista.filter((x) => x.id !== g.id);
  Avversari.sel = null;
  ridisegna();
  salvaTraPoco();
  mostraAvviso(`${g.etichetta} avversario tolto`, annulla);
  return true;
}

function commutaAvversariVisibili() {
  schemaCorrente.avversariNascosti = !schemaCorrente.avversariNascosti;
  Avversari.sel = null;
  ridisegna();
  salvaTraPoco();
}

/* ---------- Pannello «Avversari» ---------- */
function mostraPannelloAvversari() {
  const box = $("#pannello-avversari");
  if (!box || !schemaCorrente) return;
  const lato = latoAvversario(schemaCorrente);
  const formato = formatoDi(schemaCorrente).id;
  const lista = schemaCorrente.avversari || [];
  $("#titolo-avversari").textContent = lato === "difesa" ? "Difesa avversaria" : "Attacco avversario";

  // Cosa si può caricare: le tue formazioni, quelle pronte e gli schemi dell'altro lato
  const mie = FormazioniMie.perLato(lato, formato);
  const pronte = formazioniPronte(lato, formato);
  const schemi = schemiDelPlaybook().filter((s) => s.lato === lato && s.giocatori.length);
  const opzioni = (titolo, voci) => voci.length
    ? `<optgroup label="${titolo}">${voci.map(([v, n]) => `<option value="${v}">${n.replace(/</g, "&lt;")}</option>`).join("")}</optgroup>` : "";

  box.innerHTML = `
    <p class="testo-secondario aiuto-avversari">${lista.length
      ? `${lista.length} ${lista.length === 1 ? "pedina" : "pedine"} in trasparenza: trascinale sul campo, clic + Canc per toglierne una.`
      : `Opzionale: metti ${lato === "difesa" ? "la difesa" : "l'attacco"} contro cui giochi, tutto o solo qualche giocatore.`}</p>
    <select id="carica-avversari">
      <option value="">${lista.length ? "Sostituisci con…" : "Carica una formazione o uno schema…"}</option>
      ${opzioni("Le tue formazioni", mie.map((f) => [`formazione:${f.id}`, f.nome]))}
      ${opzioni("Formazioni pronte", pronte.map((f) => [`formazione:${f.id}`, f.nome]))}
      ${opzioni(`Schemi di ${lato} del playbook`, schemi.map((s) => [`schema:${s.id}`, s.nome || "Senza nome"]))}
    </select>
    <p class="etichetta-pedine-avv">Oppure aggiungi una pedina:</p>
    <div class="pedine-avversarie" id="pedine-avversarie"></div>
    ${lista.length ? `<div class="azioni-avversari">
      <label class="riga-mostra"><input type="checkbox" id="mostra-avversari" class="interruttore" ${schemaCorrente.avversariNascosti ? "" : "checked"}> Mostra sul campo</label>
      <button type="button" class="btn-mini distruttiva" id="togli-avversari">Togli tutti</button>
    </div>` : ""}`;

  const pedine = $("#pedine-avversarie");
  for (const sigla of pedineAvversarie()) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = `pedina-avv ruolo-${ruoloDi(lato, sigla)}`;
    b.textContent = sigla;
    b.title = `Aggiungi ${sigla}`;
    b.addEventListener("click", () => aggiungiAvversario(sigla));
    pedine.appendChild(b);
  }
  $("#carica-avversari").addEventListener("change", (e) => caricaAvversari(e.target.value));
  if (lista.length) {
    $("#mostra-avversari").addEventListener("change", commutaAvversariVisibili);
    $("#togli-avversari").addEventListener("click", togliAvversari);
  }
}

/* ---------- Trascinamento sul campo (chiamato da app.js) ---------- */
function iniziaTrascinamentoAvversario(g, p) {
  Avversari.sel = g.id;
  return { tipo: "avversario", avversario: g, scostX: g.x - p.x, scostY: yDisegno(g.y) - p.y, prima: istantanea(), mosso: false };
}

function muoviAvversario(t, p, agganciaMezza) {
  const passo = agganciaMezza ? 0.5 : 0.1;
  const g = t.avversario;
  const x = Math.round(Math.min(LARGHEZZA_CAMPO - 0.6, Math.max(0.6, p.x + t.scostX)) / passo) * passo;
  const y = limitaY(latoAvversario(schemaCorrente), Math.round((YARDE_AVANTI - (p.y + t.scostY)) / passo) * passo);
  if (+x.toFixed(1) === g.x && y === g.y) return;
  g.x = +x.toFixed(1);
  g.y = y;
  t.mosso = true;
  disegnaCampo(svgCampo, schemaCorrente, { selezionato: giocatoreSelezionato });
}

function fineTrascinamentoAvversario(t) {
  if (t.mosso) { ricordaStato(t.prima); salvaTraPoco(); }
  ridisegna();
}

/* ---------- Tasti: Canc toglie la pedina avversaria scelta, Esc la deseleziona ---------- */
function tastiAvversari(e, staScrivendo) {
  if (!Avversari.sel || staScrivendo || !schemaCorrente) return false;
  if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); return togliAvversarioScelto(); }
  if (e.key === "Escape") { Avversari.sel = null; ridisegna(); return true; }
  return false;
}
