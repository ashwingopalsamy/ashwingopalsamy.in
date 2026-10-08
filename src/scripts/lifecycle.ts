/**
 * lifecycle - one cleanup scope per document.
 *
 * Every navigation is a full document load (native cross-document view
 * transitions), so a page's listeners, observers and timers live exactly as
 * long as its document, including while it waits in the back/forward cache.
 * Modules still take `{ signal: pageSignal() }` or register via
 * `onPageCleanup`, which keeps teardown explicit and lets init functions
 * dedupe on the signal they were started with.
 */

const page = new AbortController();

/** AbortSignal for this document. */
export function pageSignal(): AbortSignal {
  return page.signal;
}

/** Run `fn` when the scope ends (or now if it already has). */
export function onPageCleanup(fn: () => void, signal = pageSignal()): void {
  const run = () => {
    try {
      fn();
    } catch {
      /* cleanup must not throw */
    }
  };
  if (signal.aborted) {
    run();
    return;
  }
  signal.addEventListener("abort", run, { once: true });
}
