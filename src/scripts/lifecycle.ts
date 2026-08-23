/**
 * lifecycle - per-page cleanup registry for Astro ClientRouter navigations.
 *
 * One AbortController per page. Listeners/observers/timers take
 * `{ signal: pageSignal() }` or register via `onPageCleanup`.
 * `astro:before-swap` aborts the controller so nothing leaks across visits.
 * A capture-phase `astro:page-load` handler rotates the controller so any
 * eager module-level `init()` listeners are cleared before the bubble-phase
 * page inits re-bind.
 */

let page: AbortController | null = null;

/** AbortSignal for the current page. Fresh after each navigation. */
export function pageSignal(): AbortSignal {
  if (!page || page.signal.aborted) {
    page = new AbortController();
  }
  return page.signal;
}

/** Run `fn` when the page is about to swap away (or if already aborted). */
export function onPageCleanup(fn: () => void): void {
  const signal = pageSignal();
  const run = () => {
    try {
      fn();
    } catch {
      /* cleanup must not throw into the router */
    }
  };
  if (signal.aborted) {
    run();
    return;
  }
  signal.addEventListener("abort", run, { once: true });
}

if (typeof document !== "undefined") {
  document.addEventListener("astro:before-swap", () => {
    page?.abort();
    page = null;
  });
  document.addEventListener(
    "astro:page-load",
    () => {
      page?.abort();
      page = new AbortController();
    },
    { capture: true },
  );
}
