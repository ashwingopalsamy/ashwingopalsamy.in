import { prefetch } from "astro:prefetch";
import { prefersReducedData } from "./network";

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

function handleTouchIntent(event: TouchEvent): void {
  respectReducedData(event);
  if (event.defaultPrevented || prefersReducedData() || !(event.target instanceof Element)) return;
  const link = event.target.closest<HTMLAnchorElement>("a[href]");
  if (
    !link ||
    link.hasAttribute("download") ||
    (link.target && link.target !== "_self") ||
    link.dataset.astroPrefetch === "false" ||
    link.hasAttribute("data-astro-reload") ||
    link.hasAttribute("data-no-prerender")
  ) return;

  const url = new URL(link.href, location.href);
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.origin !== location.origin ||
    (normalizedPath(url.pathname) === normalizedPath(location.pathname) && url.search === location.search) ||
    /^\/(?:api|pagefind|og|_astro|\.well-known)(?:\/|$)/i.test(url.pathname) ||
    /\.(?!html?\/?$)[^/]+\/?$/i.test(url.pathname)
  ) return;

  // Astro owns deduplication and the network cache for hover and touch intent.
  prefetch(url.href);
}

if (typeof document !== "undefined" && !window.__siteNavigationPrefetchReady) {
  window.__siteNavigationPrefetchReady = true;
  document.addEventListener("touchstart", handleTouchIntent, { capture: true, passive: true });
  document.addEventListener("mousedown", respectReducedData, { capture: true, passive: true });
  document.addEventListener("astro:before-swap", restoreTapPreferences);
  const connection = (navigator as Navigator & { connection?: EventTarget }).connection;
  connection?.addEventListener("change", () => {
    if (!prefersReducedData()) restoreTapPreferences();
  });
}
