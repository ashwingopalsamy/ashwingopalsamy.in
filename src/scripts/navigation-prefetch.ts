import { prefetch } from "astro:prefetch";
import { prefersReducedData } from "./network";
import { onScrollFrame } from "./scroll-scheduler";

declare global {
  interface Window {
    __siteNavigationPrefetchReady?: boolean;
  }
}

function normalizedPath(pathname: string): string {
  return pathname.replace(/\/+$/, "") || "/";
}

const suppressedTapLinks = new Map<HTMLAnchorElement, string | null>();

function restoreTapPreferences(): void {
  for (const [link, preference] of suppressedTapLinks) {
    if (link.getAttribute("data-astro-prefetch") !== "false") continue;
    if (preference === null) link.removeAttribute("data-astro-prefetch");
    else link.setAttribute("data-astro-prefetch", preference);
  }
  suppressedTapLinks.clear();
}

function respectReducedData(event: Event): void {
  if (!prefersReducedData()) {
    restoreTapPreferences();
    return;
  }
  if (!(event.target instanceof Element)) return;
  const link = event.target.closest<HTMLAnchorElement>("a[href]");
  if (!link || link.dataset.astroPrefetch === "false") return;
  // Astro's built-in tap strategy bypasses its slow-connection gate.
  // Apply the opt-out before that listener runs; restore it when data
  // preferences change or the current page leaves.
  suppressedTapLinks.set(link, link.getAttribute("data-astro-prefetch"));
  link.dataset.astroPrefetch = "false";
}

/** The same-origin page a link leads to, if it is worth fetching ahead. */
function navigableUrl(link: HTMLAnchorElement): URL | null {
  if (
    link.hasAttribute("download") ||
    (link.target && link.target !== "_self") ||
    link.dataset.astroPrefetch === "false" ||
    link.hasAttribute("data-astro-reload") ||
    link.hasAttribute("data-no-prerender")
  ) return null;

  const url = new URL(link.href, location.href);
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.origin !== location.origin ||
    (normalizedPath(url.pathname) === normalizedPath(location.pathname) && url.search === location.search) ||
    /^\/(?:api|pagefind|og|_astro|\.well-known)(?:\/|$)/i.test(url.pathname) ||
    /\.(?!html?\/?$)[^/]+\/?$/i.test(url.pathname)
  ) return null;
  url.hash = "";
  return url;
}

/* ------------------------------------------------------------------
   Warming likely next pages on phones.

   A touchstart lands ~100ms before the click, far less than a cellular
   round trip, so touch intent alone still left most taps waiting on the
   network. The bottom tab bar, the back target and a note's previous/next
   are fetched once the page is idle; content links are fetched after they
   have stayed on screen for a moment.

   Chromium takes them as speculation-rules prefetches, which the touch
   prerender below then builds on. WebKit (Safari, and every browser on
   iPhone) supports neither speculation rules nor <link rel="prefetch">, and
   pages are served `private, no-cache` without validators, so there the
   copies are held by public/sw.js and answered from it on navigation.
   Desktop keeps Astro's hover strategy and is not touched.
   ------------------------------------------------------------------ */

const speculates = typeof HTMLScriptElement !== "undefined" &&
  HTMLScriptElement.supports?.("speculationrules") === true;
const touchFirst = typeof window !== "undefined" &&
  window.matchMedia("(hover: none) and (pointer: coarse)").matches;
/** Matches HELD_MS in public/sw.js and Chromium's prefetch lifetime. */
const HELD_MS = 5 * 60_000;
const VIEWPORT_WARM_CAP = 8;
const VIEWPORT_DWELL_MS = 300;

const warmedAt = new Map<string, number>();

function sendToWorker(urls: string[]): void {
  const container = navigator.serviceWorker;
  if (!container) return;
  const message = { type: "warm", urls };
  if (container.controller) {
    container.controller.postMessage(message);
    return;
  }
  // First visit: the worker claims this page once it activates.
  container.addEventListener("controllerchange", () => container.controller?.postMessage(message), { once: true });
}

function warm(urls: URL[]): void {
  if (!touchFirst || prefersReducedData() || !navigator.onLine) return;
  const now = Date.now();
  const due = urls
    .map((url) => url.href)
    .filter((href, index, all) => all.indexOf(href) === index && now - (warmedAt.get(href) ?? 0) > HELD_MS / 2);
  if (!due.length) return;
  due.forEach((href) => warmedAt.set(href, now));

  if (speculates) {
    const rules = document.createElement("script");
    rules.type = "speculationrules";
    rules.textContent = JSON.stringify({ prefetch: [{ source: "list", urls: due, eagerness: "immediate" }] });
    document.head.append(rules);
  } else {
    sendToWorker(due);
  }
}

let navigationWarmedAt = 0;

function warmNavigationTargets(): void {
  // Called from every scroll frame: bail on the clock before touching the DOM.
  if (Date.now() - navigationWarmedAt <= HELD_MS / 2) return;
  navigationWarmedAt = Date.now();
  const links = document.querySelectorAll<HTMLAnchorElement>(
    ".site-nav-bottom a[href], .logo-control[href], a[data-note-nav]",
  );
  warm(Array.from(links, navigableUrl).filter((url): url is URL => url !== null));
}

function connectionAllowsViewportWarm(): boolean {
  const type = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection?.effectiveType;
  return type === undefined || type === "4g";
}

function warmVisibleContentLinks(): void {
  const main = document.querySelector("main");
  if (!main || !("IntersectionObserver" in window) || !connectionAllowsViewportWarm()) return;
  let remaining = VIEWPORT_WARM_CAP;
  const timers = new Map<Element, number>();
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const link = entry.target as HTMLAnchorElement;
      if (!entry.isIntersecting) {
        window.clearTimeout(timers.get(link));
        timers.delete(link);
        continue;
      }
      if (timers.has(link)) continue;
      timers.set(link, window.setTimeout(() => {
        timers.delete(link);
        observer.unobserve(link);
        const url = navigableUrl(link);
        if (!url || remaining <= 0) return;
        remaining -= 1;
        warm([url]);
        if (remaining <= 0) observer.disconnect();
      }, VIEWPORT_DWELL_MS));
    }
  });
  main.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
    if (navigableUrl(link)) observer.observe(link);
  });
}

function registerWorker(): void {
  const container = navigator.serviceWorker;
  if (!container) return;
  if (speculates || !touchFirst) {
    // A browser that gained speculation rules no longer needs the worker.
    void container.getRegistration("/").then((registration) => {
      if (registration?.active?.scriptURL.endsWith("/sw.js")) void registration.unregister();
    }).catch(() => undefined);
    return;
  }
  void container.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined);
}

function startWarming(): void {
  registerWorker();
  if (!touchFirst) return;
  warmNavigationTargets();
  warmVisibleContentLinks();
  // A long read outlives the held copies; refresh them while the page is in use.
  onScrollFrame(warmNavigationTargets, null);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") warmNavigationTargets();
  });
}

function handleTouchIntent(event: TouchEvent): void {
  respectReducedData(event);
  if (event.defaultPrevented || prefersReducedData() || !(event.target instanceof Element)) return;
  const link = event.target.closest<HTMLAnchorElement>("a[href]");
  const url = link ? navigableUrl(link) : null;
  if (!url) return;

  // Chromium: Astro prerenders on touch intent, reusing any prefetch above.
  // WebKit: Astro's fallback is a plain fetch() the navigation cannot reuse,
  // so hand the URL to the worker, which a tap mid-download will wait for.
  if (speculates) prefetch(url.href);
  else warm([url]);
}

if (typeof document !== "undefined" && !window.__siteNavigationPrefetchReady) {
  window.__siteNavigationPrefetchReady = true;
  document.addEventListener("touchstart", handleTouchIntent, { capture: true, passive: true });
  document.addEventListener("mousedown", respectReducedData, { capture: true, passive: true });
  const connection = (navigator as Navigator & { connection?: EventTarget }).connection;
  connection?.addEventListener("change", () => {
    if (!prefersReducedData()) restoreTapPreferences();
  });
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(startWarming, { timeout: 2000 });
  else window.setTimeout(startWarming, 1000);
}
