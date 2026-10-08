// Minimal service worker: makes the app installable and shows an offline page.
// Never caches /api/*, auth/session responses, page HTML or non-GET requests.
// Bump VERSION when offline.html changes.
const VERSION = "v1";
const CACHE = "app-" + VERSION;
const OFFLINE = "/offline.html";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.add(new Request(OFFLINE, { cache: "reload" })))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Pages: always network (HTML is per-user/auth-gated, never cached);
  // only when the network is unreachable fall back to the offline page.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
    return;
  }

  // Content-hashed build assets are immutable: cache-first.
  // ponytail: no eviction, stale hashes from old deploys pile up until VERSION
  // is bumped; add an LRU trim if storage ever matters.
  if (url.pathname.startsWith("/_next/static/")) {
    e.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
  }
});
