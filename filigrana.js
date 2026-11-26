/* ==========================================================================
   LOGO A METÀ CAMPO (filigrana) che si vede con ogni logo
   --------------------------------------------------------------------------
   Un logo con parti scure (es. viola o blu notte) su un campo scuro quasi
   sparisce. Per la filigrana prepariamo una copia "adattata" del logo:
   - campo scuro: i colori scuri vengono schiariti (stesso colore, più luce:
     il viola diventa lilla), quelli già chiari restano come sono
   - campo chiaro: al contrario, i colori troppo chiari vengono scuriti
   La copia si prepara una volta sola (in un attimo) e si tiene in memoria;
   nel frattempo si vede il logo originale. Se il logo non si può
   elaborare (es. server che non lo permette) resta l'originale.
   ========================================================================== */
const Filigrana = {
  cache: new Map(), // "url|scuro" → immagine pronta (data URL), "in corso" o "errore"

  /* Restituisce l'indirizzo da usare per la filigrana.
     quandoPronta: chiamata quando la copia adattata è pronta (per ridisegnare). */
  versione(url, campoScuro, quandoPronta) {
    if (!url) return null;
    const chiave = `${url}|${campoScuro ? "scuro" : "chiaro"}`;
    const stato = this.cache.get(chiave);
    if (stato === "errore") return url;
    if (stato && stato !== "in corso") return stato;
    if (!stato) {
      this.cache.set(chiave, "in corso");
      this.prepara(url, campoScuro)
        .then((dati) => { this.cache.set(chiave, dati); if (quandoPronta) quandoPronta(); })
        .catch(() => this.cache.set(chiave, "errore"));
    }
    return url;
  },

  prepara(url, campoScuro) {
    return new Promise((ok, ko) => {
      const img = new Image();
      if (!url.startsWith("data:")) img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const lato = 512;
          const scala = Math.min(1, lato / Math.max(img.naturalWidth, img.naturalHeight));
          const w = Math.max(1, Math.round(img.naturalWidth * scala));
          const h = Math.max(1, Math.round(img.naturalHeight * scala));
          const tela = document.createElement("canvas");
          tela.width = w; tela.height = h;
          const c = tela.getContext("2d");
          c.drawImage(img, 0, 0, w, h);
          const pixel = c.getImageData(0, 0, w, h);
          const d = pixel.data;
          for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] < 8) continue; // trasparente
            const [hh, s, l] = rgbInHsl(d[i], d[i + 1], d[i + 2]);
            // Campo scuro: i colori più scuri (viola, blu notte, nero) salgono di più,
            // fino al 64% di luce; quelli medi (es. il rosso) quasi non si toccano.
            // Campo chiaro: al massimo il 38%.
            const nuovaL = campoScuro
              ? Math.max(l, 0.64 - 0.10 * Math.min(1, Math.max(0, (l - 0.2) / 0.3)))
              : Math.min(l, 0.38);
            if (nuovaL === l) continue;
            const [r, g, b] = hslInRgb(hh, Math.min(1, s * 1.25), nuovaL); // un po' più colore, così non diventa grigio
            d[i] = r; d[i + 1] = g; d[i + 2] = b;
          }
          c.putImageData(pixel, 0, 0);
          ok(tela.toDataURL("image/png"));
        } catch (e) {
          ko(e); // es. immagine di un altro sito che non si può leggere
        }
      };
      img.onerror = ko;
      img.src = url;
    });
  },
};

// Conversioni di colore (valori 0-1 per tinta, saturazione, luce)
function rgbInHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h / 6, s, l];
}
function hslInRgb(h, s, l) {
  if (s === 0) { const v = Math.round(l * 255); return [v, v, v]; }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const canale = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [Math.round(canale(h + 1 / 3) * 255), Math.round(canale(h) * 255), Math.round(canale(h - 1 / 3) * 255)];
}
