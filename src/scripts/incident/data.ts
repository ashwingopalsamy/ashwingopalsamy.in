/**
 * data - what the eMudhra post's two scripts share: the intermediates slice and two helpers.
 * Nothing here touches the network or the DOM at import.
 */

import { pageSignal } from "../lifecycle";

export { intermediates } from "../../data/emudhra-incident.json";
export { pageSignal };

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Runs cb once when el comes within rootMargin of the viewport; torn down with the signal. */
export function onVisible(el: Element, cb: () => void, signal: AbortSignal, rootMargin = "200px 0px"): void {
  if (signal.aborted) return;
  if (typeof IntersectionObserver === "undefined") {
    cb();
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      io.disconnect();
      cb();
    },
    { rootMargin },
  );
  io.observe(el);
  signal.addEventListener("abort", () => io.disconnect(), { once: true });
}
