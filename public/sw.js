const CACHE_NAME = 'sitescope-v4-cache-v5';
const CACHE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB cache cap

// Only stable, unhashed shell files belong here. Vite fingerprints the JS/CSS
// bundles, so they are cached by the runtime handler after the first request.
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json', '/favicon.svg'];

// ── Install: pre-cache the app shell ───────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

// ── Activate: drop old cache generations ───────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

// ── Fetch: stale-while-revalidate for same-origin GETs only ────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (
    request.method !== 'GET' ||
    !request.url.startsWith(self.location.origin) ||
    request.url.includes('/api/')
  ) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // Navigations are network-first: serving a stale index.html can point at
      // hashed bundles that no longer exist after a deploy. Offline falls back
      // to the cached shell.
      if (request.mode === 'navigate') {
        try {
          const response = await fetch(request);
          if (response && response.status === 200 && response.type === 'basic') {
            cache.put(request, response.clone()).catch(() => {});
          }
          return response;
        } catch {
          const cachedNav = await cache.match(request);
          if (cachedNav) return cachedNav;
          const shell = await cache.match('/index.html');
          if (shell) return shell;
          return Response.error();
        }
      }

      const cached = await cache.match(request);

      const network = fetch(request)
        .then((response) => {
          const length = response.headers.get('content-length');
          const withinLimit = length === null || Number(length) < CACHE_MAX_BYTES;
          if (response && response.status === 200 && response.type === 'basic' && withinLimit) {
            cache.put(request, response.clone()).catch(() => {});
          }
          return response;
        })
        .catch(() => null);

      const fresh = await network;
      if (cached) return cached;
      if (fresh) return fresh;
      return Response.error();
    })(),
  );
});
