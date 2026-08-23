/**
 * toast 2.0 - queued notices (max 2 visible, FIFO).
 *
 * Corner toasts stack from the bottom-right; anchored toasts sit above an
 * element and reposition on scroll/resize. When an anchor leaves the DOM the
 * toast dismisses. aria-live is preserved via role="status".
 */

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

interface ToastEntry {
  el: HTMLElement;
  anchor: HTMLElement | null;
  timer: number;
  stackIndex: number;
}

const MAX_VISIBLE = 2;
const queue: ToastEntry[] = [];
let repositionBound = false;

function ensureReposition() {
  if (repositionBound) return;
  repositionBound = true;
  const onMove = () => {
    for (const t of queue) {
      if (t.anchor) placeAnchored(t.el, t.anchor);
    }
  };
  window.addEventListener("scroll", onMove, { passive: true });
  window.addEventListener("resize", onMove, { passive: true });
}

function placeAnchored(el: HTMLElement, anchor: HTMLElement) {
  if (!document.contains(anchor)) {
    dismiss(el);
    return;
  }
  const r = anchor.getBoundingClientRect();
  el.style.left = `${Math.round(r.left + r.width / 2)}px`;
  el.style.top = `${Math.round(r.top)}px`;
}

function stackCorners() {
  let i = 0;
  for (const t of queue) {
    if (t.anchor) continue;
    t.stackIndex = i++;
    t.el.style.setProperty("--toast-stack", String(t.stackIndex));
  }
}

function dismiss(el: HTMLElement) {
  const idx = queue.findIndex((t) => t.el === el);
  if (idx < 0) return;
  const [entry] = queue.splice(idx, 1);
  window.clearTimeout(entry.timer);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  entry.el.classList.remove("is-in");
  const cleanup = () => entry.el.remove();
  if (reduce) cleanup();
  else entry.el.addEventListener("transitionend", cleanup, { once: true });
  stackCorners();
}

export function showToast(opts: ToastOptions): void {
  const { message, anchor = null, duration = 3200, sound = false } = opts;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  while (queue.length >= MAX_VISIBLE) {
    dismiss(queue[0].el);
  }

  const el = document.createElement("div");
  el.className = anchor ? "toast toast-anchored" : "toast toast-corner";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.textContent = message;
  document.body.appendChild(el);

  const entry: ToastEntry = {
    el,
    anchor,
    timer: 0,
    stackIndex: 0,
  };
  queue.push(entry);

  if (anchor) {
    ensureReposition();
    placeAnchored(el, anchor);
  } else {
    stackCorners();
  }

  if (sound && isSoundEnabled()) playAccent("chime");

  requestAnimationFrame(() => el.classList.add("is-in"));

  entry.timer = window.setTimeout(() => dismiss(el), duration);

  if (anchor) {
    const obs = new MutationObserver(() => {
      if (!document.contains(anchor)) {
        obs.disconnect();
        dismiss(el);
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  if (reduce) {
    /* instant - class already applied next frame */
  }
}
