/*
 * Service worker - instant navigations for browsers without speculation rules.
 *
 * Chromium prefetches and prerenders through speculation rules. WebKit (Safari,
 * and every browser on iPhone) has neither those nor <link rel="prefetch">,
 * and pages are served `private, no-cache` with no validators (each carries a
 * fresh CSP nonce), so every tap there waited for a full page download.
 *
 * Pages warm documents here ahead of a likely tap (src/scripts/
 * navigation-prefetch.ts). A navigation is answered from that copy when it is
 * younger than HELD_MS - the same window Chromium keeps a prefetch for - and
 * each copy is used once, exactly like a prefetch. Everything else, reloads
 * included, goes to the network unchanged; no other request is intercepted.
 *
 * Registered only where speculation rules are unsupported.
 */

const CACHE = "documents-v1";
const HELD_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 24;
const WARMED_AT = "x-warmed-at";

/** Warm-ups in flight, so a tap that lands mid-download waits for it. */
const inflight = new Map();

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)));
      // The network request starts while the worker boots, so a miss costs
      // nothing over having no worker at all.
      await self.registration.navigationPreload?.enable();
      await self.clients.claim();
    })(),
  );
});

function keyFor(href) {
  try {
    const url = new URL(href, self.location.origin);
    if (url.origin !== self.location.origin) return null;
    url.hash = "";
    return url.href;
  } catch {
    return null;
  }
}

function age(response) {
  return Date.now() - Number(response.headers.get(WARMED_AT) || 0);
}

function isFresh(response) {
  return age(response) < HELD_MS;
}

function storable(response) {
  if (!response.ok || response.type !== "basic" || response.redirected) return false;
  if (/\bno-store\b/i.test(response.headers.get("cache-control") || "")) return false;
  return /^text\/html\b/i.test(response.headers.get("content-type") || "");
}

function warm(key) {
  const pending = inflight.get(key);
  if (pending) return pending;
  const task = (async () => {
    const cache = await caches.open(CACHE);
    // Past half its life a copy is renewed, so a page in active use keeps
    // its next taps covered without ever serving one older than HELD_MS.
    const cached = await cache.match(key);
    if (cached && age(cached) < HELD_MS / 2) return null;
    const response = await fetch(key, {
      credentials: "same-origin",
      // Purpose lets edge telemetry tell a warm-up from a page view;
      // Sec-Purpose cannot be set from script.
      headers: { Accept: "text/html", Purpose: "prefetch" },
    });
    if (!storable(response)) return null;
    const headers = new Headers(response.headers);
    // The body below is already decoded and fully buffered.
    headers.delete("content-encoding");
    headers.delete("content-length");
    headers.set(WARMED_AT, String(Date.now()));
    const held = new Response(await response.arrayBuffer(), {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
    await cache.put(key, held.clone());
    return held;
  })()
    .catch(() => null)
    .finally(() => inflight.delete(key));
  inflight.set(key, task);
  return task;
}

async function prune() {
  const cache = await caches.open(CACHE);
  const requests = await cache.keys();
  const entries = await Promise.all(
    requests.map(async (request) => {
      const response = await cache.match(request);
      return { request, at: Number(response?.headers.get(WARMED_AT) || 0) };
    }),
  );
  entries.sort((a, b) => b.at - a.at);
  await Promise.all(
    entries
      .filter((entry, index) => index >= MAX_ENTRIES || Date.now() - entry.at >= HELD_MS)
      .map((entry) => cache.delete(entry.request)),
  );
}

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "warm" || !Array.isArray(data.urls)) return;
  const work = (async () => {
    await prune();
    const keys = data.urls.slice(0, 16).map(keyFor).filter(Boolean);
    await Promise.all(keys.map(warm));
  })().catch(() => undefined);
  // Keeps the worker alive until the copies are stored.
  if (typeof event.waitUntil === "function") event.waitUntil(work);
});

/** The warmed copy of a document, used once, or null. */
async function take(key) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(key);
  // A fresh copy beats waiting on a renewal that is still downloading; only
  // a tap with nothing usable held waits for the warm-up in flight.
  let response = cached && isFresh(cached) ? cached : null;
  if (!response && inflight.has(key)) response = await inflight.get(key);
  if (response) await cache.delete(key);
  return response;
}

async function respond(event) {
  const { request } = event;
  // A reload asks for the network; honour it.
  const reload = request.cache === "reload" || request.cache === "no-cache" || request.cache === "no-store";
  const key = reload ? null : keyFor(request.url);
  if (key) {
    try {
      const held = await take(key);
      if (held) {
        event.waitUntil(Promise.resolve(event.preloadResponse).catch(() => undefined));
        return held;
      }
    } catch {
      /* fall through to the network */
    }
  }
  try {
    const preloaded = await event.preloadResponse;
    if (preloaded) return preloaded;
  } catch {
    /* preload failed; fetch directly */
  }
  return fetch(request);
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.mode !== "navigate" || request.method !== "GET") return;
  if (new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(respond(event));
});
