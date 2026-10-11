// Tombstone. This file exists only so browsers that installed the earlier navigation
// service worker fetch this version, clear its caches and unregister it. There is no
// fetch handler. Safe to delete in a few releases.
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) await caches.delete(key);
      await self.registration.unregister();
    })(),
  );
});
