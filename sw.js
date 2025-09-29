// sw.js — Emoji Play (PWA)
const CACHE_VERSION = 'v6'; // ↑ aumente a cada deploy
const STATIC_CACHE  = `emoji-play-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `emoji-play-runtime-${CACHE_VERSION}`;

const PRECACHE = [
  './',
  './index.html',
  './style.css?v=6',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// Instala: precache do essencial
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)));
  self.skipWaiting();
});

// Ativa: limpa caches antigos + habilita navigation preload se houver
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch {}
    }
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter(k => ![STATIC_CACHE, RUNTIME_CACHE].includes(k))
        .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// Mensagem opcional para “pular espera”
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

// Estratégias de fetch
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const accept = req.headers.get('accept') || '';
  const isHTML = req.mode === 'navigate'
              || req.destination === 'document'
              || accept.includes('text/html');

  if (isHTML) {
    event.respondWith(htmlNetworkFirst(event));
    return;
  }

  event.respondWith(staleWhileRevalidate(req));
});

async function htmlNetworkFirst(event) {
  const req = event.request;
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const preload = await event.preloadResponse;
    const net = preload || await fetch(req, { cache: 'no-store' });
    if (net && net.ok) cache.put(req, net.clone());
    return net;
  } catch {
    const cached = await cache.match(req);
    return cached || caches.match('./index.html');
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(req);
  const fetching = fetch(req).then((res) => {
    if (res && res.ok && req.url.startsWith(self.location.origin)) {
      cache.put(req, res.clone());
    }
    return res;
  }).catch(() => null);

  return cached || fetching || new Response(null, { status: 504 });
}
