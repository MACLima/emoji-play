
const CACHE = 'emoji-play-v1';
const ASSETS = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req).then(res => res || fetch(req).then(net => {
      const copy = net.clone();
      if (req.url.startsWith(self.location.origin)) {
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return net;
    }).catch(() => caches.match('./index.html')))
  );
});
