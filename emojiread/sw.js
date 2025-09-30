// sw.js — minimal para Leitor
const CACHE_V = 'v7';                      // ↑ mude a cada deploy
const STATIC   = `ep-static-${CACHE_V}`;
const RUNTIME  = `ep-runtime-${CACHE_V}`;

const PRECACHE = [
  './',
  './index.html',
  './style.css?v=7',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(STATIC).then(c => c.addAll(PRECACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => ![STATIC, RUNTIME].includes(k)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const accept = req.headers.get('accept') || '';
  const isHTML = req.mode === 'navigate' || req.destination === 'document' || accept.includes('text/html');

  e.respondWith(isHTML ? htmlNetworkFirst(req) : staleWhileRevalidate(req));
});

async function htmlNetworkFirst(req) {
  const cache = await caches.open(RUNTIME);
  try {
    const fresh = await fetch(req, { cache: 'no-store' });
    if (fresh && fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    return (await cache.match(req)) || (await caches.match('./index.html')) || new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME);
  const cached = await cache.match(req);
  const fetching = fetch(req).then(res => {
    if (res && res.ok && req.url.startsWith(self.location.origin)) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  return cached || fetching || new Response(null, { status: 504 });
}
