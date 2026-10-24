// Service worker: caché de la app (precarga) + teselas del mapa vistas (caché limitada).
const VERSION = 'v1.0.0';
const APP_CACHE = 'viajes-app-' + VERSION;
const TILE_CACHE = 'viajes-tiles-v1';
const MAX_TILES = 3000;
const APP_FILES = [
  './', './index.html', './manifest.webmanifest', './src/app.js', './src/model.js', './src/db.js', './src/map.js', './src/styles.css',
  './vendor/leaflet/leaflet.js', './vendor/leaflet/leaflet.css',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP_CACHE).then(c => c.addAll(APP_FILES)));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('viajes-app-') && k !== APP_CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

async function trimTiles() {
  const c = await caches.open(TILE_CACHE);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - MAX_TILES; i++) await c.delete(keys[i]);
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Teselas del mapa: primero la caché; si no hay conexión y no está guardada, falla sin bloquear nada.
  if (url.hostname.endsWith('basemaps.cartocdn.com')) {
    e.respondWith((async () => {
      const c = await caches.open(TILE_CACHE);
      const hit = await c.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok) { c.put(req, res.clone()); if (Math.random() < 0.05) trimTiles(); }
        return res;
      } catch { return new Response('', { status: 504 }); }
    })());
    return;
  }
  if (url.origin !== location.origin) return;
  // App: caché primero (funciona sin conexión); las versiones nuevas llegan con un service worker nuevo.
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try { return await fetch(req); }
    catch { if (req.mode === 'navigate') return caches.match('./index.html'); return new Response('', { status: 504 }); }
  })());
});
