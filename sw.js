// sw.js — Emoji Play (versão completa)
const VERSION = 'v5'; // ↑ aumente a cada deploy para forçar atualização
const CACHE = `emoji-play-${VERSION}`;

// Liste aqui o essencial para abrir offline (HTML, manifest, ícones e bundles principais)
const PRECACHE = [
  '/',                 // garante raiz
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Pequenos utilitários
const isGET = (req) => req.method === 'GET';
const sameOrigin = (url) => url.origin === self.location.origin;

// Instala: pré-cache do essencial e ativa imediatamente
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      await cache.addAll(PRECACHE);
      await self.skipWaiting();
    })()
  );
});

// Ativa: limpa caches antigos, habilita Navigation Preload e assume controle
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Limpa caches antigos do app
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(k => k.startsWith('emoji-play-') && k !== CACHE)
          .map(k => caches.delete(k))
      );

      // Habilita Navigation Preload para acelerar navegação (se disponível)
      if ('navigationPreload' in self.registration) {
        try { await self.registration.navigationPreload.enable(); } catch {}
      }

      await self.clients.claim();
    })()
  );
});

// Atualização “forçada” a partir do app
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Estratégias de cache
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (!isGET(req)) return; // só tratamos GET

  const url = new URL(req.url);
  const accept = req.headers.get('accept') || '';

  // 1) Páginas HTML (navegação): NETWORK FIRST com fallback offline
  const isHTML = req.mode === 'navigate' || accept.includes('text/html');
  if (isHTML) {
    event.respondWith(htmlNetworkFirst(event));
    return;
  }

  // 2) Mesma origem (JS/CSS/IMG/manifest…): STALE-WHILE-REVALIDATE
  if (sameOrigin(url)) {
    event.respondWith(staleWhileRevalidate(req));
    return;
  }

  // 3) Terceiros: passa direto (evita poluir o cache com CDNs)
  event.respondWith(fetch(req).catch(() => caches.match('/index.html')));
});

// ===== Implementações =====

async function htmlNetworkFirst(event) {
  const req = event.request;
  const cache = await caches.open(CACHE);

  try {
    // Usa Navigation Preload se disponível; senão, fetch normal
    const preload = await event.preloadResponse;
    const netRes = preload || await fetch(req);

    // Guarda cópia bem-sucedida
    if (netRes && netRes.ok && netRes.type !== 'opaque') {
      cache.put(req, netRes.clone());
    }
    return netRes;
  } catch (err) {
    // Offline: devolve versão em cache (index.html como fallback)
    const cached = await cache.match(req, { ignoreSearch: true });
    return cached || cache.match('/index.html');
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req, { ignoreSearch: true });

  // Dispara atualização em background
  const fetchPromise = fetch(req).then((res) => {
    if (res && res.ok && res.type !== 'opaque') {
      cache.put(req, res.clone());
    }
    return res;
  }).catch(() => null);

  // Responde rápido com cache, senão espera a rede
  return cached || (await fetchPromise) || (await caches.match('/index.html'));
}
