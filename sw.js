// Tripfolio · service worker: caché de la app (precarga) + teselas del mapa vistas (caché limitada).
const VERSION = 'v1.3.0';
const APP_CACHE = 'viajes-app-' + VERSION;
const TILE_CACHE = 'viajes-map-v2';
const MAX_TILES = 8000;
const APP_FILES = [
  './', './index.html', './manifest.webmanifest', './src/app.js', './src/model.js', './src/db.js', './src/map.js', './src/styles.css',
  './vendor/maplibre/maplibre-gl.js', './vendor/maplibre/maplibre-gl.css',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png',
  './icons/logo.svg', './icons/favicon-64.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP_CACHE).then(c => c.addAll(APP_FILES)));
});
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if ((k.startsWith('viajes-app-') && k !== APP_CACHE) || k === 'viajes-tiles-v1') await caches.delete(k);
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
  // Mapa (OpenFreeMap): estilo y TileJSON de red primero (para estar al día) con copia de respaldo;
  // teselas, fuentes y sprites de caché primero. Sin conexión y sin copia, fallan sin bloquear la app.
  if (url.hostname === 'tiles.openfreemap.org') {
    const fresh = url.pathname.startsWith('/styles/') || /^\/planet\/?$/.test(url.pathname);
    e.respondWith((async () => {
      const c = await caches.open(TILE_CACHE);
      if (fresh) {
        try { const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res; }
        catch { return (await c.match(req)) || new Response('', { status: 504 }); }
      }
      const hit = await c.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok) { c.put(req, res.clone()); if (Math.random() < 0.02) trimTiles(); }
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
