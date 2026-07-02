const CACHE_NAME = 'sitescope-v4-cache-v3';
const CACHE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB cache cap

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/manifest.json',
];

// ── Install: pre-cache static shell ──────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate: evict old caches ────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: stale-while-revalidate for own-origin GET only ─────
self.addEventListener('fetch', event => {
  const { request } = event;

  // Only handle same-origin GET requests — never intercept API/external calls
  if (
    request.method !== 'GET' ||
    !request.url.startsWith(self.location.origin) ||
    request.url.includes('/api/')
  ) {
    return;
  }

  // Reject opaque (cross-origin) responses — they can mask errors
  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(request);

      const networkFetch = fetch(request).then(response => {
        // Only cache valid, non-opaque, same-origin responses
        if (
          response &&
          response.status === 200 &&
          response.type === 'basic' &&
          response.headers.get('content-length') !== null
            ? parseInt(response.headers.get('content-length'), 10) < CACHE_MAX_BYTES
            : true
        ) {
          cache.put(request, response.clone());
        }
        return response;
      }).catch(() => cached); // Network error — serve cache if available

      // Stale-while-revalidate: serve cached immediately, update in background
      return cached || networkFetch;
    })
  );
});
