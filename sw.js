const CACHE_NAME = 'mahjong-pwa-v3';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './js/engine.js',
  './js/bot.js',
  './js/ui.js',
  './js/firebase.js',
  './js/app.js'
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
        // Fall back to cache when offline
        return caches.match(event.request).then((cachedResponse) => {
          return cachedResponse || caches.match('./index.html');
        });
      })
  );
});
