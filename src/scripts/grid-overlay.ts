/**
 * grid-overlay — hold G to see the lattice the page was built on.
 *
 * The site's geometry is deliberately invisible: a 4px step, a rhythm of
 * body line boxes, and a twelve column rail (geometry.css). This makes it
 * checkable. If a rule, a card edge or a heading does not land on one of
 * these lines, that is a bug in the layout, not in the overlay.
 *
 * Costs nothing until first use: the element is created on the first
 * press and the key listener is the only thing bound up front.
 */

import { pageSignal } from "./lifecycle";

let overlay: HTMLElement | null = null;
let pinned = false;

function ensureOverlay(): HTMLElement {
  if (overlay?.isConnected) return overlay;
  overlay = document.createElement("div");
  overlay.className = "grid-overlay";
  overlay.setAttribute("aria-hidden", "true");
  overlay.dataset.pagefindIgnore = "true";
  document.body.appendChild(overlay);
  // Force a frame before the class lands, so the fade actually plays on
  // a freshly inserted element rather than being skipped.
  void overlay.offsetWidth;
  return overlay;
}

function show() {
  ensureOverlay().classList.add("is-on");
}

function hide() {
  if (pinned) return;
  overlay?.classList.remove("is-on");
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable
  );
}

export function initGridOverlay(): void {
  if (typeof document === "undefined") return;

  // ?grid pins it on, for screenshots and for checking a page at rest.
  pinned = new URLSearchParams(location.search).has("grid");
  if (pinned) show();

  document.addEventListener("keydown", (event) => {
    if (event.key !== "g" && event.key !== "G") return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (isTyping(event.target)) return;
    if (document.documentElement.dataset.palette === "open") return;
    if (event.repeat) return;
    show();
  });

  document.addEventListener("keyup", (event) => {
    if (event.key === "g" || event.key === "G") hide();
  });

  // A dropped keyup (tab away mid-press) must not leave it stuck on.
  window.addEventListener("blur", hide);

  document.addEventListener("astro:before-swap", () => {
    overlay?.remove();
    overlay = null;
  });
}

if (typeof document !== "undefined") {
  // Bound once for the document's lifetime, not per page.
  if (!window.__siteGridOverlayReady) {
    window.__siteGridOverlayReady = true;
    initGridOverlay();
  }
  void pageSignal;
}

declare global {
  interface Window {
    __siteGridOverlayReady?: boolean;
  }
}
