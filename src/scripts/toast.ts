/**
 * Queued notices (max 2 visible, FIFO). Every entry owns its movement,
 * dismissal and page cleanup, including the time spent animating out.
 */

import { pageSignal } from "./lifecycle";
import { onScrollFrame, invalidateScrollMetrics } from "./scroll-scheduler";
import { playAccent, isSoundEnabled } from "./sound";

interface ToastOptions {
  message: string;
  /** position above this element (anchored mode). Omit for a corner toast. */
  anchor?: HTMLElement | null;
  /** ms visible before auto-dismiss */
  duration?: number;
  /** play the soft chime (still gated on the mute toggle) */
  sound?: boolean;
}

interface AnchorPosition {
  left: string;
  top: string;
}

interface ToastEntry {
  el: HTMLElement;
  anchor: HTMLElement | null;
  page: AbortSignal;
  controller: AbortController;
  timer: number;
  enterFrame: number;
  exitFrame: number;
  exitAnimations: Animation[];
  stackIndex: number;
  position: AnchorPosition | null;
  observer: MutationObserver | null;
  offReposition: (() => void) | null;
  state: "visible" | "retiring" | "removed";
  cleanup: () => void;
}

const MAX_VISIBLE = 2;
const queue: ToastEntry[] = [];

function measureAnchor(anchor: HTMLElement): AnchorPosition | null {
  if (!anchor.isConnected) return null;
  const rect = anchor.getBoundingClientRect();
  return {
    left: `${Math.round(rect.left + rect.width / 2)}px`,
    top: `${Math.round(rect.top)}px`,
  };
}

function placeAnchored(entry: ToastEntry) {
  if (!entry.position) {
    dismiss(entry);
    return;
  }
  const { left, top } = entry.position;
  if (entry.el.style.left !== left) entry.el.style.left = left;
  if (entry.el.style.top !== top) entry.el.style.top = top;
}

function stackCorners() {
  let index = 0;
  for (const entry of queue) {
    if (entry.anchor) continue;
    const next = index++;
    if (entry.stackIndex === next) continue;
    entry.stackIndex = next;
    entry.el.style.setProperty("--toast-stack", String(next));
  }
}

function stopActivity(entry: ToastEntry) {
  window.clearTimeout(entry.timer);
  entry.timer = 0;
  cancelAnimationFrame(entry.enterFrame);
  entry.enterFrame = 0;
  entry.observer?.disconnect();
  entry.observer = null;
  entry.offReposition?.();
  entry.offReposition = null;
}

function removeEntry(entry: ToastEntry) {
  if (entry.state === "removed") return;
  entry.state = "removed";
  stopActivity(entry);
  cancelAnimationFrame(entry.exitFrame);
  entry.exitFrame = 0;
  entry.exitAnimations.forEach((animation) => animation.cancel());
  entry.exitAnimations = [];
  entry.controller.abort();
  entry.page.removeEventListener("abort", entry.cleanup);
  entry.el.remove();
  const index = queue.indexOf(entry);
  if (index >= 0) {
    queue.splice(index, 1);
    stackCorners();
  }
}

function dismiss(entry: ToastEntry) {
  if (entry.state !== "visible") return;
  entry.state = "retiring";
  const index = queue.indexOf(entry);
  if (index >= 0) queue.splice(index, 1);
  stopActivity(entry);
  entry.el.classList.remove("is-in");
  stackCorners();

  if (entry.page.aborted || !entry.el.isConnected ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    entry.cleanup();
    return;
  }

  // Let the unchanged CSS exit finish. Finished promises also settle on
  // cancellation; an element with no active transition is removed directly.
  entry.exitFrame = requestAnimationFrame(() => {
    entry.exitFrame = 0;
    if (entry.state !== "retiring" || !entry.el.isConnected) {
      entry.cleanup();
      return;
    }
    const animations = entry.el.getAnimations();
    entry.exitAnimations = animations;
    if (!animations.length) {
      entry.cleanup();
      return;
    }
    void Promise.allSettled(animations.map((animation) => animation.finished))
      .then(entry.cleanup);
  });
}

function observeAnchor(entry: ToastEntry) {
  const { anchor, observer } = entry;
  if (!anchor || !observer) return;
  observer.disconnect();
  // Observe direct ancestor removals, rather than every mutation in the
  // document. Rebuild this chain if the anchor moves to another parent.
  for (let parent = anchor.parentElement; parent; parent = parent.parentElement) {
    observer.observe(parent, { childList: true });
  }
}

export function showToast(opts: ToastOptions): void {
  const { message, anchor = null, duration = 3200, sound = false } = opts;
  const page = pageSignal();
  if (page.aborted) return;
  // Capture initial geometry before queue changes or the new DOM insertion.
  const position = anchor ? measureAnchor(anchor) : null;
  if (anchor && !position) return;

  while (queue.length >= MAX_VISIBLE) dismiss(queue[0]!);

  const el = document.createElement("div");
  el.className = anchor ? "toast toast-anchored" : "toast toast-corner";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.textContent = message;

  const entry: ToastEntry = {
    el,
    anchor,
    page,
    controller: new AbortController(),
    timer: 0,
    enterFrame: 0,
    exitFrame: 0,
    exitAnimations: [],
    stackIndex: -1,
    position,
    observer: null,
    offReposition: null,
    state: "visible",
    cleanup: () => removeEntry(entry),
  };
  page.addEventListener("abort", entry.cleanup, { once: true });
  if (anchor) placeAnchored(entry);
  document.body.appendChild(el);
  queue.push(entry);
  if (!anchor) stackCorners();

  if (anchor) {
    entry.offReposition = onScrollFrame(
      () => {
        if (entry.state === "visible") placeAnchored(entry);
      },
      entry.controller.signal,
      () => {
        if (entry.state === "visible") entry.position = measureAnchor(anchor);
      },
    );
    if ("MutationObserver" in window) {
      entry.observer = new MutationObserver(() => {
        if (entry.state !== "visible") return;
        if (!anchor.isConnected) {
          dismiss(entry);
          return;
        }
        observeAnchor(entry);
        invalidateScrollMetrics();
      });
      observeAnchor(entry);
    }
  }

  if (sound && isSoundEnabled()) playAccent("chime");
  entry.enterFrame = requestAnimationFrame(() => {
    entry.enterFrame = 0;
    if (entry.state === "visible" && !page.aborted && el.isConnected) el.classList.add("is-in");
  });
  entry.timer = window.setTimeout(() => dismiss(entry), duration);
}
