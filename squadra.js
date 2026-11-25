/* ==========================================================================
   SQUADRA: nome e logo della squadra dell'allenatore.
   --------------------------------------------------------------------------
   - Il logo si carica in PNG, JPG o PDF (del PDF usiamo la prima pagina).
   - Lo "puliamo" in automatico: tagliamo i bordi bianchi e rendiamo
     trasparente lo sfondo bianco attorno al disegno, così sta bene
     sul tema scuro e sulle stampe.
   - Nome e logo compaiono in alto a sinistra e come filigrana sul campo.
   ========================================================================== */

const Squadra = {
  nome: "",
  logo: null, // indirizzo dell'immagine (o null)

  imposta(profilo) {
    this.nome = (profilo && profilo.nome_squadra) || "";
    this.logo = (profilo && profilo.logo_url) || null;
    this.mostra();
  },

  // Aggiorna intestazione della barra laterale e filigrana sul campo
  mostra() {
    $("#squadra-nome").textContent = this.nome || "La tua squadra";
    $("#squadra-nome").classList.toggle("da-impostare", !this.nome);
    disegnaStemma($("#stemma"), this.logo, this.nome);
    document.title = this.nome ? `${this.nome} · Playbook` : "Playbook";
    if (typeof schemaCorrente !== "undefined" && schemaCorrente) ridisegna();
    if (typeof aggiornaTestaHome === "function" && !$("#home").hidden) aggiornaTestaHome();
  },
};

// Stemma: il logo se c'è, altrimenti le iniziali della squadra
function disegnaStemma(contenitore, logo, nome) {
  contenitore.innerHTML = "";
  if (logo) {
    const img = document.createElement("img");
    img.src = logo;
    img.alt = "";
    contenitore.appendChild(img);
    contenitore.classList.remove("senza-logo");
  } else {
    const iniziali = (nome || "").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("");
    contenitore.textContent = iniziali.toUpperCase() || "PB";
    contenitore.classList.add("senza-logo");
  }
}

/* ==========================================================================
   PREPARAZIONE DEL LOGO (immagine o PDF -> PNG pulito)
   ========================================================================== */
const DIMENSIONE_MAX_FILE = 15 * 1024 * 1024; // 15 MB

async function preparaLogo(file) {
  if (file.size > DIMENSIONE_MAX_FILE) throw new Error("Il file è troppo grande (massimo 15 MB).");

  let tela;
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    tela = await disegnaPrimaPaginaPdf(file);
  } else if (/^image\/(png|jpeg)$/.test(file.type) || /\.(png|jpe?g)$/i.test(file.name)) {
    tela = await disegnaImmagine(file);
  } else {
    throw new Error("Formato non supportato: usa PNG, JPG o PDF.");
  }

  rendiTrasparenteSfondo(tela);
  const ritagliata = ritagliaBordi(tela);
  const finale = ridimensiona(ritagliata, 512);

  const dataUrl = finale.toDataURL("image/png");
  const blob = await new Promise((ok) => finale.toBlob(ok, "image/png"));
  return { blob, dataUrl };
}

// Disegna un'immagine (PNG/JPG) su una tela
async function disegnaImmagine(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => ko(new Error("Non riesco a leggere l'immagine."));
      i.src = url;
    });
    const scala = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const tela = document.createElement("canvas");
    tela.width = Math.round(img.naturalWidth * scala);
    tela.height = Math.round(img.naturalHeight * scala);
    tela.getContext("2d").drawImage(img, 0, 0, tela.width, tela.height);
    return tela;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Carica pdf.js solo quando serve (è una libreria pesante)
let promessaPdfJs = null;
function caricaPdfJs() {
  if (!promessaPdfJs) {
    promessaPdfJs = new Promise((ok, ko) => {
      const script = document.createElement("script");
      script.src = "lib/pdf.min.js";
      script.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = "lib/pdf.worker.min.js";
        ok(window.pdfjsLib);
      };
      script.onerror = () => { promessaPdfJs = null; ko(new Error("Non riesco a caricare il lettore PDF.")); };
      document.head.appendChild(script);
    });
  }
  return promessaPdfJs;
}

async function disegnaPrimaPaginaPdf(file) {
  const pdfjs = await caricaPdfJs();
  let documento;
  try {
    documento = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  } catch {
    throw new Error("Non riesco ad aprire il PDF.");
  }
  const pagina = await documento.getPage(1);
  const base = pagina.getViewport({ scale: 1 });
  const viewport = pagina.getViewport({ scale: 1600 / Math.max(base.width, base.height) });
  const tela = document.createElement("canvas");
  tela.width = Math.round(viewport.width);
  tela.height = Math.round(viewport.height);
  // Sfondo bianco (i PDF di solito sono su pagina bianca)
  const ctx = tela.getContext("2d");
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, tela.width, tela.height);
  await pagina.render({ canvasContext: ctx, viewport }).promise;
  documento.destroy();
  return tela;
}

// Un pixel è "sfondo" se è trasparente o quasi bianco
function eSfondo(dati, i) {
  return dati[i + 3] < 16 || (dati[i] > 238 && dati[i + 1] > 238 && dati[i + 2] > 238);
}

/* Rende trasparente lo sfondo bianco COLLEGATO AI BORDI dell'immagine.
   Partiamo dai bordi e "allaghiamo" verso l'interno solo i pixel bianchi:
   le parti bianche DENTRO il logo (es. una scritta bianca) restano. */
function rendiTrasparenteSfondo(tela) {
  const { width: L, height: A } = tela;
  const ctx = tela.getContext("2d");
  const immagine = ctx.getImageData(0, 0, L, A);
  const d = immagine.data;
  const visitato = new Uint8Array(L * A);
  const pila = [];
  const aggiungi = (x, y) => {
    const p = y * L + x;
    if (!visitato[p] && eSfondo(d, p * 4)) { visitato[p] = 1; pila.push(p); }
  };
  for (let x = 0; x < L; x++) { aggiungi(x, 0); aggiungi(x, A - 1); }
  for (let y = 0; y < A; y++) { aggiungi(0, y); aggiungi(L - 1, y); }
  while (pila.length) {
    const p = pila.pop();
    d[p * 4 + 3] = 0;
    const x = p % L, y = (p - x) / L;
    if (x > 0) aggiungi(x - 1, y);
    if (x < L - 1) aggiungi(x + 1, y);
    if (y > 0) aggiungi(x, y - 1);
    if (y < A - 1) aggiungi(x, y + 1);
  }
  ctx.putImageData(immagine, 0, 0);
}

// Taglia i bordi vuoti attorno al logo (lascia un piccolo margine)
function ritagliaBordi(tela) {
  const { width: L, height: A } = tela;
  const d = tela.getContext("2d").getImageData(0, 0, L, A).data;
  let minX = L, minY = A, maxX = -1, maxY = -1;
  for (let y = 0; y < A; y++) {
    for (let x = 0; x < L; x++) {
      if (d[(y * L + x) * 4 + 3] > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error("Il file sembra vuoto: non trovo nessun disegno.");
  const margine = Math.round(Math.max(maxX - minX, maxY - minY) * 0.04);
  const x0 = Math.max(0, minX - margine), y0 = Math.max(0, minY - margine);
  const x1 = Math.min(L, maxX + 1 + margine), y1 = Math.min(A, maxY + 1 + margine);
  const nuova = document.createElement("canvas");
  nuova.width = x1 - x0;
  nuova.height = y1 - y0;
  nuova.getContext("2d").drawImage(tela, x0, y0, nuova.width, nuova.height, 0, 0, nuova.width, nuova.height);
  return nuova;
}

function ridimensiona(tela, lato) {
  const scala = Math.min(1, lato / Math.max(tela.width, tela.height));
  const nuova = document.createElement("canvas");
  nuova.width = Math.max(1, Math.round(tela.width * scala));
  nuova.height = Math.max(1, Math.round(tela.height * scala));
  const ctx = nuova.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(tela, 0, 0, nuova.width, nuova.height);
  return nuova;
}

/* ==========================================================================
   FINESTRA "LA TUA SQUADRA"
   ========================================================================== */
let logoInAttesa = null;   // { blob, dataUrl } scelto ma non ancora salvato
let logoDaRimuovere = false;

function apriFoglioSquadra({ primaVolta = false } = {}) {
  logoInAttesa = null;
  logoDaRimuovere = false;
  $("#titolo-squadra").textContent = primaVolta ? "Benvenuto, coach!" : "La tua squadra";
  $("#testo-squadra").textContent = primaVolta
    ? "Dai un nome alla tua squadra e carica il logo: comparirà nell'app e sulle stampe del playbook."
    : "Nome e logo compaiono nell'app e sulle stampe del playbook.";
  $("#btn-squadra-annulla").textContent = primaVolta ? "Più tardi" : "Annulla";
  $("#nome-squadra").value = Squadra.nome;
  $("#errore-squadra").textContent = "";
  mostraAnteprimaLogo(Squadra.logo);

  $("#velo").hidden = false;
  $("#foglio-squadra").hidden = false;
  requestAnimationFrame(() => {
    $("#velo").classList.add("visibile");
    $("#foglio-squadra").classList.add("visibile");
    $("#nome-squadra").focus();
  });
}

function chiudiFoglioSquadra() {
  $("#velo").classList.remove("visibile");
  $("#foglio-squadra").classList.remove("visibile");
  setTimeout(() => {
    $("#velo").hidden = true;
    $("#foglio-squadra").hidden = true;
  }, 220);
}

function mostraAnteprimaLogo(url) {
  const zona = $("#zona-logo");
  zona.classList.toggle("con-logo", Boolean(url));
  $("#anteprima-logo").src = url || "";
  $("#btn-rimuovi-logo").hidden = !url;
}

async function sceltoFileLogo(file) {
  if (!file) return;
  const zona = $("#zona-logo");
  $("#errore-squadra").textContent = "";
  zona.classList.add("in-lavorazione");
  try {
    logoInAttesa = await preparaLogo(file);
    logoDaRimuovere = false;
    mostraAnteprimaLogo(logoInAttesa.dataUrl);
  } catch (errore) {
    $("#errore-squadra").textContent = errore.message;
  } finally {
    zona.classList.remove("in-lavorazione");
  }
}

$("#file-logo").addEventListener("change", (e) => {
  sceltoFileLogo(e.target.files[0]);
  e.target.value = ""; // permette di riscegliere lo stesso file
});

// Trascina e rilascia il file sulla zona del logo
const zonaLogo = $("#zona-logo");
["dragenter", "dragover"].forEach((tipo) => zonaLogo.addEventListener(tipo, (e) => {
  e.preventDefault();
  zonaLogo.classList.add("sopra");
}));
["dragleave", "drop"].forEach((tipo) => zonaLogo.addEventListener(tipo, (e) => {
  e.preventDefault();
  zonaLogo.classList.remove("sopra");
}));
zonaLogo.addEventListener("drop", (e) => sceltoFileLogo(e.dataTransfer.files[0]));

$("#btn-rimuovi-logo").addEventListener("click", (e) => {
  e.preventDefault();
  logoInAttesa = null;
  logoDaRimuovere = true;
  mostraAnteprimaLogo(null);
});

$("#btn-squadra-annulla").addEventListener("click", chiudiFoglioSquadra);

$("#foglio-squadra").addEventListener("submit", async (e) => {
  e.preventDefault();
  const bottone = $("#btn-squadra-salva");
  bottone.disabled = true;
  bottone.textContent = "Salvo…";
  $("#errore-squadra").textContent = "";
  try {
    let logo = Squadra.logo;
    if (logoInAttesa) logo = await Cloud.caricaLogo(logoInAttesa.blob, logoInAttesa.dataUrl);
    if (logoDaRimuovere) logo = null;
    const profilo = { nome_squadra: $("#nome-squadra").value.trim(), logo_url: logo };
    await Cloud.salvaProfilo(profilo);
    Squadra.imposta(profilo);
    chiudiFoglioSquadra();
    festeggiaStemma();
    mostraAvviso("Squadra aggiornata");
  } catch (errore) {
    $("#errore-squadra").textContent = errore.message;
  } finally {
    bottone.disabled = false;
    bottone.textContent = "Salva";
  }
});

$("#btn-squadra").addEventListener("click", () => apriFoglioSquadra());
