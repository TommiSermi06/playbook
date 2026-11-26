/* ==========================================================================
   CATEGORIE E TAG DEGLI SCHEMI
   --------------------------------------------------------------------------
   Ogni schema può avere:
     schema.categoria = "corsa"            una sola (attacco o difesa)
     schema.tag = ["jet", "vs cover 2"]    quanti se ne vuole
   - nel pannello «Categoria e tag»: un clic sulla categoria, i tag si
     scrivono e si confermano con Invio (con i suggerimenti di quelli già usati)
   - nell'elenco: filtri per categoria sopra gli schemi; la ricerca trova
     anche i tag (es. «jet») e le categorie (es. «screen»)
   Le categorie servono anche al telefono e alla stampa (CATEGORIE e
   nomeCategoria sono usati anche lì).
   ========================================================================== */

const CATEGORIE = {
  attacco: [
    { id: "corsa", nome: "Corsa", icona: "🏃" },
    { id: "passaggio", nome: "Passaggio", icona: "🎯" },
    { id: "play-action", nome: "Play action", icona: "🎭" },
    { id: "rpo", nome: "RPO", icona: "🔀" },
    { id: "screen", nome: "Screen", icona: "🧱" },
    { id: "trick", nome: "Trick play", icona: "🪄" },
  ],
  difesa: [
    { id: "zona", nome: "Zona", icona: "🛡" },
    { id: "uomo", nome: "Uomo", icona: "🤝" },
    { id: "blitz", nome: "Blitz", icona: "⚡" },
    { id: "contro-corsa", nome: "Contro la corsa", icona: "🧱" },
    { id: "speciale", nome: "Speciale", icona: "⭐" },
  ],
};

function categoriaDi(schema) {
  return (CATEGORIE[schema.lato] || []).find((c) => c.id === schema.categoria) || null;
}
function nomeCategoria(schema) {
  const c = categoriaDi(schema);
  return c ? c.nome : "";
}

// Il testo con cui la ricerca trova uno schema per categoria e tag
function testoCategoriaETag(schema) {
  return [nomeCategoria(schema), ...(schema.tag || [])].join(" ").toLowerCase();
}

/* ==========================================================================
   Da qui in giù: solo per l'app del computer (pannello e filtri)
   ========================================================================== */
let filtroCategoria = "tutte";

// I tag già usati negli schemi del playbook (per i suggerimenti)
function tagDelPlaybook() {
  const conta = new Map();
  for (const s of schemiDelPlaybook()) for (const t of s.tag || []) conta.set(t, (conta.get(t) || 0) + 1);
  return [...conta.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
}

/* ---------- Pannello «Categoria e tag» ---------- */
function mostraCategoria() {
  const box = $("#pannello-categoria");
  if (!box || !schemaCorrente) return;
  const s = schemaCorrente;
  const vietato = typeof modificheVietate === "function" && modificheVietate();
  box.innerHTML = `
    <div class="scelte-categoria" id="scelte-categoria"></div>
    <div class="tag-schema" id="tag-schema"></div>
    ${vietato ? "" : `<input id="nuovo-tag" type="text" maxlength="20" placeholder="＋ Aggiungi un tag e premi Invio" autocomplete="off" list="suggerimenti-tag">
    <datalist id="suggerimenti-tag"></datalist>`}`;

  for (const c of CATEGORIE[s.lato]) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "scelta-categoria" + (s.categoria === c.id ? " attiva" : "");
    b.textContent = `${c.icona} ${c.nome}`;
    b.disabled = vietato;
    b.addEventListener("click", () => {
      schemaCorrente.categoria = schemaCorrente.categoria === c.id ? undefined : c.id; // secondo clic: la toglie
      if (!schemaCorrente.categoria) delete schemaCorrente.categoria;
      salvaTraPoco();
      mostraCategoria();
      mostraFiltriCategoria();
      aggiornaRigaCorrente();
    });
    $("#scelte-categoria").appendChild(b);
  }

  const tags = $("#tag-schema");
  for (const t of s.tag || []) {
    const chip = document.createElement("span");
    chip.className = "chip-tag";
    chip.textContent = "#" + t;
    if (!vietato) {
      const x = document.createElement("button");
      x.type = "button";
      x.textContent = "×";
      x.title = `Togli «${t}»`;
      x.addEventListener("click", () => {
        schemaCorrente.tag = (schemaCorrente.tag || []).filter((y) => y !== t);
        if (!schemaCorrente.tag.length) delete schemaCorrente.tag;
        salvaTraPoco();
        mostraCategoria();
        aggiornaRigaCorrente();
      });
      chip.appendChild(x);
    }
    tags.appendChild(chip);
  }
  if (!(s.tag || []).length) tags.appendChild(Object.assign(document.createElement("span"), { className: "testo-secondario", textContent: "Nessun tag" }));

  const campo = $("#nuovo-tag");
  if (!campo) return;
  const suggerimenti = $("#suggerimenti-tag");
  for (const t of tagDelPlaybook().filter((t) => !(s.tag || []).includes(t))) {
    suggerimenti.appendChild(Object.assign(document.createElement("option"), { value: t }));
  }
  campo.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { campo.blur(); return; }
    if (e.key !== "Enter" && e.key !== ",") return;
    e.preventDefault();
    aggiungiTag(campo.value);
  });
}

function aggiungiTag(testo) {
  const t = testo.trim().replace(/^#/, "").toLowerCase().slice(0, 20);
  if (!t) return;
  const lista = schemaCorrente.tag || [];
  if (lista.includes(t)) { mostraAvviso(`«${t}» c'è già`); return; }
  if (lista.length >= 8) { mostraAvviso("Al massimo 8 tag per schema"); return; }
  schemaCorrente.tag = [...lista, t];
  salvaTraPoco();
  mostraCategoria();
  aggiornaRigaCorrente();
  $("#nuovo-tag").focus(); // si può scrivere subito il prossimo
}

/* ---------- Filtri per categoria sopra l'elenco ---------- */
function mostraFiltriCategoria() {
  const box = $("#filtro-categorie");
  if (!box) return;
  // (lo schema aperto conta con le modifiche non ancora salvate)
  const delLato = playbookCorrente
    ? schemiDelPlaybook().map((s) => (schemaCorrente && s.id === schemaCorrente.id ? schemaCorrente : s)).filter((s) => s.lato === latoSelezionato)
    : [];
  const usate = (CATEGORIE[latoSelezionato] || []).filter((c) => delLato.some((s) => s.categoria === c.id));
  if (filtroCategoria !== "tutte" && !usate.some((c) => c.id === filtroCategoria)) filtroCategoria = "tutte";
  box.hidden = !usate.length;
  box.innerHTML = "";
  for (const c of [{ id: "tutte", nome: "Tutti", icona: "" }, ...usate]) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "filtro-categoria" + (filtroCategoria === c.id ? " attivo" : "");
    b.textContent = c.icona ? `${c.icona} ${c.nome}` : c.nome;
    b.addEventListener("click", () => {
      filtroCategoria = c.id;
      mostraFiltriCategoria();
      mostraElenco();
    });
    box.appendChild(b);
  }
}
