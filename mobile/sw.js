/* ==========================================================================
   Service worker: fa funzionare la versione per telefono anche senza rete
   (per esempio a bordo campo). Prima prova la rete, così le novità arrivano
   subito; se non c'è rete usa la copia salvata.
   I dati degli schemi stanno nella copia del telefono (localStorage).
   ========================================================================== */
const CACHE = "playbook-mobile-m1";
const FILE = [
  "./", "index.html", "mobile.css?v=m1", "campo.js?v=m1", "mobile.js?v=m1", "manifest.json",
  "../config.js?v=m1", "../lib/supabase.js", "../formazioni.js?v=m1", "../regole.js?v=m1",
  "../tracce.js?v=m1", "../cloud.js?v=m1", "../icon-180.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  // Via le copie delle versioni vecchie
  e.waitUntil(caches.keys()
    .then((nomi) => Promise.all(nomi.filter((n) => n.startsWith("playbook-mobile-") && n !== CACHE).map((n) => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Solo i file dell'app (non Supabase, non altri siti)
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((risposta) => {
        const copia = risposta.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copia));
        return risposta;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: false }).then((r) => r || caches.match("index.html")))
  );
});
