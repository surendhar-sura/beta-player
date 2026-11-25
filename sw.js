/* ================================================================
   BETA PLAYER — Service Worker (100% Offline PWA & APK Engine)
   ================================================================ */
const CACHE_NAME = 'beta-player-offline-v2.2';
const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon.svg'
];

// Pre-cache all essential files for 100% offline playback
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CORE_ASSETS);
    }).catch(err => {
      console.warn('[SW] Offline cache preloading note:', err);
    })
  );
});

// Clean old caches and claim immediate control of all client tabs
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// Offline Fetch Handler: Cache-First with Stale-While-Revalidate
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Bypass range requests and chrome extensions
  if (req.method !== 'GET' || req.headers.has('range') || url.protocol.startsWith('chrome')) {
    return;
  }

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(cached => {
      // If found in offline cache, serve immediately!
      if (cached) {
        // Background check for latest version if internet is available
        fetch(req).then(networkRes => {
          if (networkRes && networkRes.status === 200) {
            caches.open(CACHE_NAME).then(c => c.put(req, networkRes));
          }
        }).catch(() => {});
        return cached;
      }

      // If not in cache, fetch from network and store for next time
      return fetch(req).then(networkRes => {
        if (!networkRes || networkRes.status !== 200 || networkRes.type !== 'basic') {
          return networkRes;
        }
        const cloned = networkRes.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, cloned));
        return networkRes;
      }).catch(() => {
        // Total offline fallback for page navigation
        if (req.mode === 'navigate') {
          return caches.match('./index.html') || caches.match('index.html');
        }
      });
    })
  );
});
