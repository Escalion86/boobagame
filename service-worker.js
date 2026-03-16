const CACHE_NAME = "booba-pwa-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./game.js",
  "./manifest.webmanifest",
  "./register-sw.js",
  "./assets/booba.png",
  "./assets/Booba_idle.webp",
  "./assets/booba_walk.png",
  "./assets/booba_jump.png",
  "./assets/booba_crawl.png",
  "./appstore-images/android/launchericon-48x48.png",
  "./appstore-images/android/launchericon-72x72.png",
  "./appstore-images/android/launchericon-96x96.png",
  "./appstore-images/android/launchericon-144x144.png",
  "./appstore-images/android/launchericon-192x192.png",
  "./appstore-images/android/launchericon-512x512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200) return response;

          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});