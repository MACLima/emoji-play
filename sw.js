// SW do RAIZ (escopo "/") — HTML network-first; estáticos cache-first
const CACHE = 'root-pwa-v1';
const ASSETS = [
  '/',                // index
  '/manifest.webmanifest',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k.startsWith('root-pwa-')).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Só cuida do que está no mesmo host (raiz)
  if (url.origin !== location.origin) return;

  const isHTML =
    req.destination === 'document' ||
    req.headers.get('accept')?.includes('text/html');

  // HTML: network-first com fallback ao cache
  if (isHTML) {
    e.respondWith(
      fetch(req).then(net => {
        const copy = net.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return net;
      }).catch(() => caches.match(req).then(r => r || caches.match('/')))
    );
    return;
  }

  // Outros: cache-first
  e.respondWith(
    caches.match(req).then(r => r || fetch(req).then(net => {
      if (req.method === 'GET' && url.origin === location.origin) {
        const copy = net.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return net;
    }))
  );
});

// Suporte a "SKIP_WAITING" para atualizar na hora
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING' && self.skipWaiting) self.skipWaiting();
});
