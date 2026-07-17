const CACHE_NAME = 'mahjong-pwa-v27';
const ASSETS = [
  './',
  './index.html',
  './style.css?v=23',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './js/engine.js?v=14',
  './js/practice-card.js?v=1',
  './js/bot.js?v=14',
  './js/ui.js?v=19',
  './js/firebase.js?v=10',
  './js/app.js?v=21'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Network-First strategy to prevent stale caches during active development
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache the updated version if it is a successful GET request from same origin
        if (response.status === 200 && event.request.method === 'GET' && event.request.url.startsWith(self.location.origin)) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Navigations fall back to the app shell; assets only fall back to an
        // exact cached response so a failed script never receives HTML.
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          if (event.request.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        });
      })
  );
});
