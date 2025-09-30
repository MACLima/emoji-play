// SW simples, escopo da pasta /emojicrush/
const CACHE = 'emojicrush-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './sw.js',
  './sounds/pop.mp3',
  './sounds/match.mp3',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k.startsWith('emojicrush-')).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first para HTML (evitar travar após deploy); Cache-first para estáticos
self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // apenas dentro do escopo da pasta
  if (!url.pathname.includes('/emojicrush/')) return;

  // HTML: network-first com fallback a cache
  const isHTML = request.destination === 'document' || request.headers.get('accept')?.includes('text/html');
  if (isHTML) {
    e.respondWith(
      fetch(request).then(net => {
        const copy = net.clone();
        caches.open(CACHE).then(c => c.put(request, copy));
        return net;
      }).catch(() => caches.match(request).then(res => res || caches.match('./index.html')))
    );
    return;
  }

  // Demais: cache-first
  e.respondWith(
    caches.match(request).then(res => res || fetch(request).then(net => {
      const copy = net.clone();
      if (request.url.startsWith(self.location.origin)) {
        caches.open(CACHE).then(c => c.put(request, copy));
      }
      return net;
    }))
  );
});
