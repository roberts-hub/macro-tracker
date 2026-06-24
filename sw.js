// Service worker — cache para uso offline (PWA).
const CACHE = "macrotrack-v12";
const ASSETS = [
  "./", "./index.html", "./styles.css",
  "./foods.js", "./nlparse.js", "./off.js", "./ai.js", "./nutrition.js", "./store.js", "./sync.js", "./app.js",
  "./manifest.webmanifest", "./icons/icon.svg",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // Supabase y terceros (fuentes): directo a la red.
  if (url.origin !== location.origin) return;
  // Red primero: siempre intenta traer la versión más reciente; usa la caché
  // solo como respaldo offline. Así las actualizaciones llegan al instante.
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
