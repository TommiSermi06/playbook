/* ==========================================================================
   COLORI DELLE FORMAZIONI scelti dal coach
   --------------------------------------------------------------------------
   Nel call sheet ogni formazione ha il suo colore. In automatico: il
   colore nel nome (GOLD → oro, RED → rosso…) oppure uno fisso diverso per
   ognuna. Il coach può sceglierlo lui, formazione per formazione:
   - nell'elenco «Formazione» a destra: il pallino accanto al nome
   - nelle opzioni del call sheet, nella finestra di stampa
   Il colore sta nel playbook (playbook.coloriFormazioni = { "lato|id": "#colore" }),
   quindi vale su computer, telefono e per i co-allenatori. Lo sceglie il
   proprietario del playbook.
   ========================================================================== */

const TAVOLOZZA_FORMAZIONI = [
  "#D7263D", "#F46036", "#C9A100", "#E2B400", "#1E9E57", "#1B998B",
  "#2E86AB", "#1679C2", "#5C6BC0", "#7B2CBF", "#C2185B", "#8A4A1C", "#222222", "#8A9399",
];

// Il colore di una formazione nel playbook aperto (scelto o automatico); null se non è usata
function coloreFormazione(lato, chiave) {
  const scelto = ((playbookCorrente && playbookCorrente.coloriFormazioni) || {})[`${lato}|${chiave}`];
  if (scelto) return scelto;
  return coloriFormazioni(schemiDelPlaybook()).get(`${lato}|${chiave}`) || null;
}
const coloreSceltoDalCoach = (lato, chiave) =>
  Boolean(((playbookCorrente && playbookCorrente.coloriFormazioni) || {})[`${lato}|${chiave}`]);
const puoScegliereColori = () => Boolean(playbookCorrente) && Playbook.permesso(playbookCorrente.id) === "proprietario";

function impostaColoreFormazione(lato, chiave, colore) {
  const pb = playbookCorrente;
  if (!pb) return;
  const k = `${lato}|${chiave}`;
  const prima = { ...(pb.coloriFormazioni || {}) };
  const nuovi = { ...prima };
  if (colore) nuovi[k] = colore; else delete nuovi[k];
  pb.coloriFormazioni = nuovi;
  Playbook.salva(pb);
  aggiornaDopoColori();
  mostraAvviso(colore ? "Colore della formazione salvato" : "Colore automatico", () => {
    pb.coloriFormazioni = prima;
    Playbook.salva(pb);
    aggiornaDopoColori();
  });
}

function aggiornaDopoColori() {
  if (schemaCorrente) mostraFormazioni();
  if (!$("#foglio-stampa").hidden && typeof mostraColoriCallsheet === "function") {
    mostraColoriCallsheet();
    aggiornaAnteprimaStampa();
  }
}

/* Il pallino colorato: mostra il colore e, per il proprietario, apre la tavolozza */
function puntinoColore(lato, chiave, nome) {
  const colore = coloreFormazione(lato, chiave);
  const p = document.createElement("span");
  p.className = "puntino-colore" + (colore ? "" : " senza") + (coloreSceltoDalCoach(lato, chiave) ? " scelto" : "");
  if (colore) p.style.setProperty("--colore", colore);
  if (puoScegliereColori()) {
    p.setAttribute("role", "button");
    p.tabIndex = 0;
    p.title = `Colore di «${nome}» nel call sheet: clicca per sceglierlo`;
    const apri = (e) => { e.preventDefault(); e.stopPropagation(); apriTavolozzaColori(p, lato, chiave, nome); };
    p.addEventListener("click", apri);
    p.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") apri(e); });
  } else {
    p.title = colore ? `Colore di «${nome}» nel call sheet` : "";
  }
  return p;
}

/* ---------- Tavolozza (piccola finestra accanto al pallino) ---------- */
function apriTavolozzaColori(ancora, lato, chiave, nome) {
  chiudiTavolozzaColori();
  const attuale = coloreFormazione(lato, chiave);
  const scelto = coloreSceltoDalCoach(lato, chiave);
  const box = document.createElement("div");
  box.className = "tavolozza-colori";
  box.id = "tavolozza-colori";
  box.innerHTML = `<p class="tavolozza-colori-titolo"></p><div class="tavolozza-colori-griglia"></div>
    <div class="tavolozza-colori-azioni">
      <label class="btn-mini">🎨 Altro… <input type="color"></label>
      <button type="button" class="btn-mini" data-auto>Automatico</button>
    </div>`;
  box.querySelector(".tavolozza-colori-titolo").textContent = nome;
  const griglia = box.querySelector(".tavolozza-colori-griglia");
  for (const c of TAVOLOZZA_FORMAZIONI) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "campione-colore" + (scelto && attuale && attuale.toLowerCase() === c.toLowerCase() ? " attivo" : "");
    b.style.setProperty("--colore", c);
    b.title = c;
    b.addEventListener("click", () => { chiudiTavolozzaColori(); impostaColoreFormazione(lato, chiave, c); });
    griglia.appendChild(b);
  }
  const altro = box.querySelector('input[type="color"]');
  altro.value = attuale || "#2E86AB";
  altro.addEventListener("change", () => { chiudiTavolozzaColori(); impostaColoreFormazione(lato, chiave, altro.value); });
  const auto = box.querySelector("[data-auto]");
  auto.disabled = !scelto;
  auto.addEventListener("click", () => { chiudiTavolozzaColori(); impostaColoreFormazione(lato, chiave, null); });
  document.body.appendChild(box);
  // Accanto al pallino, dentro la finestra
  const r = ancora.getBoundingClientRect();
  const w = box.offsetWidth, h = box.offsetHeight;
  box.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left - w / 2 + r.width / 2))}px`;
  box.style.top = `${r.bottom + 8 + h > innerHeight - 8 ? r.top - h - 8 : r.bottom + 8}px`;
  requestAnimationFrame(() => box.classList.add("visibile"));
}
function chiudiTavolozzaColori() {
  const box = $("#tavolozza-colori");
  if (box) box.remove();
}
document.addEventListener("pointerdown", (e) => {
  if ($("#tavolozza-colori") && !e.target.closest("#tavolozza-colori") && !e.target.closest(".puntino-colore")) chiudiTavolozzaColori();
}, true);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && $("#tavolozza-colori")) { e.stopPropagation(); chiudiTavolozzaColori(); }
}, true);

/* ---------- Nelle opzioni del call sheet: le formazioni stampate ---------- */
function mostraColoriCallsheet() {
  const box = $("#colori-formazioni-stampa");
  if (!box) return;
  box.innerHTML = "";
  const schemi = schemiDaStampare(cosaScelta());
  const viste = new Map();
  for (const s of schemi) {
    const k = `${s.lato}|${chiaveFormazione(s)}`;
    if (!viste.has(k)) viste.set(k, { lato: s.lato, chiave: chiaveFormazione(s), nome: nomeFormazione(s) });
  }
  for (const f of viste.values()) {
    const riga = document.createElement("span");
    riga.className = "colore-formazione-stampa";
    riga.appendChild(puntinoColore(f.lato, f.chiave, f.nome));
    riga.appendChild(Object.assign(document.createElement("span"), { textContent: f.nome }));
    box.appendChild(riga);
  }
  $("#riga-colori-formazioni").hidden = !viste.size || !$("#stampa-dettagli-callsheet").checked;
}
