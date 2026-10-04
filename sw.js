// Minimal offline support so the installed app opens with no signal (a
// garage or a hotel room is where dryland sets happen). Pages are
// network-first so a redeploy shows up on the next open; hashed assets
// are cache-first. Cross-origin requests (the relay) are never cached.
const CACHE = "swimcord-v2";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(["./", "./manifest.webmanifest", "./icon-192.png"])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }
  // When the relay serves this app, its API shares the origin. Live data
  // must never come from the cache.
  if (url.pathname.includes("/api/") || url.pathname.endsWith("/ws")) {
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          void caches.open(CACHE).then((c) => c.put("./", copy));
          return res;
        })
        .catch(() => caches.match("./")),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ??
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            void caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
