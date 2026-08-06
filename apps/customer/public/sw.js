const CACHE_NAME = "trylo-customer-shell-v1";
const CACHEABLE_DESTINATIONS = new Set(["style", "script", "image", "font"]);

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first, and deliberately narrow: this app is realtime-driven (live
// rides, sockets, wallet balances), so we never cache API responses or serve
// stale HTML — only static assets get a cache fallback for offline resilience.
// The service worker's main job is satisfying PWA installability criteria.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.pathname.startsWith("/api")) return;
  if (!CACHEABLE_DESTINATIONS.has(request.destination)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      } catch (err) {
        const cached = await cache.match(request);
        if (cached) return cached;
        throw err;
      }
    })
  );
});
