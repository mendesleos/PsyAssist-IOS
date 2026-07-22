// PsyAssist Service Worker - Cache & Offline Strategy
const CACHE_NAME = 'psyassist-v49';

// Recursos essenciais para cache (app funciona offline depois do primeiro acesso)
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  // Google Fonts (cached para carregamento offline)
  'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap',
  // FontAwesome icons (cached para ícones offline)
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Instalação: Pre-cacheia todos os recursos essenciais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[PsyAssist SW] Pre-caching assets...');
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        // Falha silenciosa em recursos externos (fontes/CDN podem bloquear em alguns casos)
        console.warn('[PsyAssist SW] Some assets failed to cache:', err);
      });
    })
  );
  // Força o service worker a ativar imediatamente sem esperar aba fechar
  self.skipWaiting();
});

// Ativação: Remove caches antigos de versões anteriores
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[PsyAssist SW] Removing old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // Torna o service worker ativo para todas as abas imediatamente
  self.clients.claim();
});

// Interceptação de requisições: Cache First, depois Network
self.addEventListener('fetch', (event) => {
  // Ignora requisições de extensões de browser e POST requests
  if (
    !event.request.url.startsWith('http') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Retorna do cache imediatamente (ultrarápido)
        return cachedResponse;
      }

      // Se não está em cache, busca na rede e armazena para próxima vez
      return fetch(event.request)
        .then((networkResponse) => {
          // Só cacheia respostas válidas
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Offline fallback: retorna index.html para rotas desconhecidas
          if (event.request.destination === 'document') {
            return caches.match('/index.html');
          }
        });
    })
  );
});
