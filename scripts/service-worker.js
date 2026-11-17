// Build placeholders are replaced with the complete local bundle and its digest.
const FILES = __PRECACHE_FILES__;
const VERSION = __BUILD_VERSION__;
const BASE = self.registration.scope;
const PREFIX = `worldquiz:${BASE}:`;
const CACHE = `${PREFIX}${VERSION}`;
const URLS = FILES.map(path => new URL(path, BASE).href);
const BUNDLED = new Set(URLS);
const INDEX = new URL("index.html", BASE).href;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    try {
      await cache.addAll(URLS.map(url => new Request(url, { cache: "reload" })));
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(PREFIX) && name !== CACHE)
      .map(name => caches.delete(name)));
    // Claim the first visit only after the complete offline cache is available.
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  // Search parameters don't change the static entry page.
  const entry = url.origin === new URL(BASE).origin
    && (url.pathname === new URL(BASE).pathname || url.pathname === new URL(INDEX).pathname);
  const key = entry ? INDEX : url.href;
  if (!BUNDLED.has(key)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    return await cache.match(key) || fetch(event.request);
  })());
});
