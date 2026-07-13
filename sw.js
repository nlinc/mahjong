const CACHE_NAME = 'mahjong-pwa-v1';
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
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    }).catch(() => {
      // Fallback if network fails and asset is not in cache
      return caches.match('./index.html');
    })
  );
});
