/**
 * page-store - the whole site in memory, so every navigation is a parse + swap.
 *
 * WebKit (every iOS browser, Chrome included) has no prefetch or speculation
 * rules, and HTML is private,no-cache without validators because each response
 * carries its own CSP nonce, so a plain fetch can never be served from cache.
 * The entire site is ~280 KB brotli in one immutable file (scripts/page-bundle.mjs),
 * so after load we fetch it once per build and answer ClientRouter's
 * `astro:before-preparation` from it: slice the bytes, DOMParser, swap. A page
 * missing from the store falls through to Astro's network loader.
 *
 * Version skew: the store is keyed by build id, a network-loaded document from
 * another build forces a full load, and a visible tab re-checks /build.json
 * (at most every 10 minutes) so a redeploy turns the next tap into a full load.
 */

import type { TransitionBeforePreparationEvent } from "astro:transitions/client";

type Entry = [offset: number, length: number];

const BUILD = document.documentElement.dataset.buildId;
const ROUTER_META = '[name="astro-view-transitions-enabled"]';
const RECHECK_MS = 10 * 60 * 1000;
const DECODE_BUDGET_MS = 120;
const HEADER_BYTES = 8;

const decoder = new TextDecoder();
const parser = new DOMParser();

let bytes: Uint8Array | null = null;
let base = 0;
let pages: Record<string, Entry> = {};
let stale = false;
let checkedAt = Date.now();
let pending: { key: string; doc: Document } | null = null;

const canonical = (pathname: string): string => (pathname.endsWith("/") ? pathname : `${pathname}/`);

function connectionAllowsBundle(): boolean {
  if (!navigator.onLine) return false;
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean; effectiveType?: string };
  }).connection;
  if (connection?.saveData) return false;
  return !/^(slow-2g|2g|3g)$/.test(connection?.effectiveType ?? "");
}

async function loadBundle(): Promise<void> {
  if (!BUILD || !connectionAllowsBundle()) return;
  try {
    const response = await fetch(`/_pages/${BUILD}.txt`);
    if (!response.ok) return;
    const data = new Uint8Array(await response.arrayBuffer());
    const indexLength = Number(decoder.decode(data.subarray(0, HEADER_BYTES)));
    if (!Number.isInteger(indexLength) || indexLength <= 0) return;
    const index = JSON.parse(decoder.decode(data.subarray(HEADER_BYTES, HEADER_BYTES + indexLength)));
    if (index?.v !== 1 || index.build !== BUILD || typeof index.pages !== "object") return;
    base = HEADER_BYTES + indexLength;
    pages = index.pages;
    bytes = data;
  } catch {
    // Dev server or a stale build id after a deploy: the network loader still works.
  }
}

function parse(key: string): Document | null {
  const entry = bytes && pages[key];
  if (!bytes || !entry) return null;
  try {
    const doc = parser.parseFromString(decoder.decode(bytes.subarray(base + entry[0], base + entry[0] + entry[1])), "text/html");
    doc.querySelectorAll("noscript").forEach((el) => el.remove());
    return doc.querySelector(ROUTER_META) ? doc : null;
  } catch {
    return null;
  }
}

// Hold the swap (briefly) until the incoming page's lead image is decoded so it paints with the page.
async function decodeLeadImage(doc: Document, signal: AbortSignal): Promise<void> {
  const lead = doc.querySelector<HTMLImageElement>("main img[src], main img[srcset]");
  if (!lead || signal.aborted) return;
  let timer: number | undefined;
  try {
    const image = new Image();
    for (const name of ["sizes", "srcset", "src"]) {
      const value = lead.getAttribute(name);
      if (value) image.setAttribute(name, value);
    }
    await Promise.race([
      image.decode(),
      new Promise<void>((resolve) => {
        timer = window.setTimeout(resolve, DECODE_BUDGET_MS);
      }),
    ]);
  } catch {
    // A failed decode must never block navigation.
  } finally {
    clearTimeout(timer);
  }
}

document.addEventListener("astro:before-preparation", (event) => {
  const prep = event as TransitionBeforePreparationEvent;
  // At most one pre-parsed document, consumed or dropped by the navigation that follows it.
  const warm = pending;
  pending = null;
  if (prep.formData) return;
  if (stale) {
    prep.preventDefault();
    return;
  }

  const fetchPage = prep.loader;
  const networkLoader = async () => {
    await fetchPage();
    const incoming = prep.defaultPrevented ? undefined : prep.newDocument?.documentElement?.dataset.buildId;
    if (incoming && incoming !== BUILD) prep.preventDefault();
  };
  const key = canonical(prep.to.pathname);

  if (!bytes || !pages[key]) {
    prep.loader = networkLoader;
    return;
  }
  if (key !== prep.to.pathname && prep.navigationType !== "traverse") {
    const url = new URL(prep.to.href);
    url.pathname = key;
    prep.to = url;
  }
  prep.loader = async () => {
    // The router mutates the document it swaps from, so a Document is never reused.
    const doc = (warm?.key === key ? warm.doc : null) ?? parse(key);
    if (!doc) return networkLoader();
    await decodeLeadImage(doc, prep.signal);
    prep.newDocument = doc;
  };
});

// Parse the likely next page while the finger is still down (or the mouse button is).
function preparse(event: Event): void {
  if (!bytes || stale) return;
  if (event instanceof PointerEvent && event.pointerType !== "mouse") return;
  const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
  if (!link || link.target || link.hasAttribute("download") || link.origin !== location.origin) return;
  const key = canonical(link.pathname);
  if (!pages[key] || key === canonical(location.pathname) || pending?.key === key) return;
  setTimeout(() => {
    if (pending?.key === key) return;
    const doc = parse(key);
    if (doc) pending = { key, doc };
  }, 0);
}

document.addEventListener("touchstart", preparse, { capture: true, passive: true });
document.addEventListener("pointerdown", preparse, { capture: true, passive: true });

async function checkForNewBuild(): Promise<void> {
  if (stale || import.meta.env.DEV || Date.now() - checkedAt < RECHECK_MS) return;
  checkedAt = Date.now();
  try {
    const response = await fetch("/build.json", { cache: "no-store" });
    if (!response.ok) return;
    const manifest = await response.json();
    // Same derivation as src/lib/build.ts: commit ?? builtAt.
    const live = manifest.gitCommitShort ?? manifest.builtAt;
    if (live && live !== BUILD) stale = true;
  } catch {
    // Offline or blocked: keep serving the current build.
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void checkForNewBuild();
});

// The navigation service worker from earlier releases cannot help a router; remove it.
async function removeLegacyWorker(): Promise<void> {
  try {
    for (const registration of (await navigator.serviceWorker?.getRegistrations()) ?? []) {
      const workers = [registration.active, registration.waiting, registration.installing];
      if (workers.some((worker) => worker?.scriptURL.endsWith("/sw.js"))) await registration.unregister();
    }
  } catch {
    // Unsupported or blocked storage.
  }
}

function whenIdle(task: () => void): void {
  const run = () => {
    if ("requestIdleCallback" in window) window.requestIdleCallback(task, { timeout: 1500 });
    else window.setTimeout(task, 800);
  };
  if (document.readyState === "complete") run();
  else window.addEventListener("load", run, { once: true });
}

whenIdle(() => {
  void loadBundle();
  void removeLegacyWorker();
});
