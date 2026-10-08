/**
 * scroll-scheduler — one scroll listener for the whole site.
 *
 * Before this, three modules each bound their own scroll handler and each
 * did its own layout reads inside it. telemetry's ran unthrottled and read
 * five layout properties per event; floating-toc swept getBoundingClientRect
 * over every heading per frame; prose measured the article on top of that.
 * Scrolling therefore cost a forced synchronous layout several times per
 * frame, which is the classic way to lose frames on an otherwise static page.
 *
 * Everything now shares one passive listener, coalesced into a single rAF,
 * with the expensive document metrics measured once per frame and the
 * really expensive ones (document height) cached until something can
 * plausibly have changed them.
 *
 * Subscribers receive already-measured numbers. Extra geometry belongs in
 * an optional measurement callback; all measurements finish before any
 * subscriber writes to the page.
 */

import { pageSignal } from "./lifecycle";

export interface ScrollFrame {
  /** window.scrollY at the top of this frame */
  y: number;
  /** viewport height */
  viewport: number;
  /** full scrollable document height */
  docHeight: number;
  /** 0..1 through the scrollable distance; 0 when there is nothing to scroll */
  progress: number;
  /** 1 down, -1 up, 0 for the first frame or no movement */
  direction: 1 | -1 | 0;
}

type Subscriber = (frame: ScrollFrame) => void;

interface Subscription {
  update: Subscriber;
  measure?: Subscriber;
}

const subscribers = new Set<Subscription>();

let frameHandle = 0;
let listening = false;
let lastY = 0;

/* Document height is the expensive read (it can force a full layout), and
   it only changes when content or the viewport does. Cache it and let
   resize / DOM mutation invalidate it rather than paying per frame. */
let cachedDocHeight = 0;
let docHeightValid = false;

function invalidateDocHeight() {
  docHeightValid = false;
}

function measureDocHeight(): number {
  if (docHeightValid) return cachedDocHeight;
  cachedDocHeight = Math.max(
    document.body.scrollHeight,
    document.documentElement.scrollHeight,
    1,
  );
  docHeightValid = true;
  return cachedDocHeight;
}

function runFrame() {
  frameHandle = 0;
  if (!subscribers.size) return;

  const y = window.scrollY;
  const viewport = window.innerHeight;
  const docHeight = measureDocHeight();
  const scrollable = Math.max(1, docHeight - viewport);

  const frame: ScrollFrame = {
    y,
    viewport,
    docHeight,
    progress: Math.min(1, Math.max(0, y / scrollable)),
    direction: y === lastY ? 0 : y > lastY ? 1 : -1,
  };
  lastY = y;

  const ready: Subscription[] = [];
  for (const subscription of subscribers) {
    try {
      subscription.measure?.(frame);
      ready.push(subscription);
    } catch {
      /* A failed measurement must not commit stale geometry. */
    }
  }
  for (const subscription of ready) {
    if (!subscribers.has(subscription)) continue;
    try {
      subscription.update(frame);
    } catch {
      /* one bad subscriber must not stop the rest of the frame */
    }
  }
}

function schedule() {
  if (frameHandle) return;
  frameHandle = requestAnimationFrame(runFrame);
}

function startListening() {
  if (listening) return;
  listening = true;

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener(
    "resize",
    () => {
      invalidateDocHeight();
      schedule();
    },
    { passive: true },
  );

  /* Content that arrives late (Mermaid diagrams, images, expanded
     details) changes the document height without a resize event. */
  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(() => {
      invalidateDocHeight();
      schedule();
    });
    observer.observe(document.documentElement);
  }
}

/**
 * Subscribe to coalesced scroll frames.
 *
 * Unsubscribes automatically when the page signal aborts. Pass `null` for a
 * subscriber that should outlive it (telemetry), in which case
 * the returned function is the only way to detach.
 * `measure` may read layout, but must not mutate it. `fn` may write DOM,
 * but must not read layout. Existing subscribers need no extra callback.
 */
export function onScrollFrame(
  fn: Subscriber,
  signal: AbortSignal | null = pageSignal(),
  measure?: Subscriber,
): () => void {
  if (signal?.aborted) return () => {};
  startListening();
  const subscription = { update: fn, measure };
  subscribers.add(subscription);

  const off = () => {
    subscribers.delete(subscription);
    signal?.removeEventListener("abort", off);
  };
  signal?.addEventListener("abort", off, { once: true });

  /* Deliver one frame immediately so subscribers do not have to
     duplicate an initial-state read. */
  schedule();
  return off;
}

/** Force the cached document height to be re-measured on the next frame. */
export function invalidateScrollMetrics(): void {
  invalidateDocHeight();
  schedule();
}
