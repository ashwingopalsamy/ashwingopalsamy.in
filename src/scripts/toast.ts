/**
 * One bottom-centre notice at a time; a newer toast retires the current one.
 * Each toast owns its timer, its ring and its page cleanup, including the time
 * spent animating out. Hover or focus pauses the timer and the ring together.
 */

import { pageSignal } from "./lifecycle";
import { iconMarkup } from "../lib/ui-icons";

export interface ToastAction {
  /** "undo" also draws the draining ring */
  kind: "undo" | "retry";
  run: () => void;
}

interface ToastOptions {
  message: string;
  tone?: "ok" | "err";
  action?: ToastAction;
  /** ms visible; defaults to --dur-toast with an action, 3200 without */
  duration?: number;
}

interface Toast {
  el: HTMLElement;
  page: AbortSignal;
  events: AbortController;
  remaining: number;
  startedAt: number;
  timer: number;
  frame: number;
  ring: Animation | null;
  hovered: boolean;
  focused: boolean;
  remove: () => void;
}

const RING =
  '<svg class="ring" viewBox="0 0 38 38"><circle cx="19" cy="19" r="17" pathLength="1" stroke-dasharray="1"/></svg>';

let current: Toast | null = null;

/** A duration token (`1.6s`, `1600ms`) in ms, or `fallback` when unset. */
export function tokenMs(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const value = parseFloat(raw);
  if (!Number.isFinite(value)) return fallback;
  return raw.endsWith("ms") || !raw.endsWith("s") ? value : value * 1000;
}

function pause(toast: Toast) {
  if (!toast.timer) return;
  window.clearTimeout(toast.timer);
  toast.timer = 0;
  toast.remaining -= performance.now() - toast.startedAt;
  toast.ring?.pause();
}

function resume(toast: Toast) {
  if (toast.timer || toast.el.dataset.state !== "in" || toast.hovered || toast.focused) return;
  toast.startedAt = performance.now();
  toast.timer = window.setTimeout(() => retire(toast), Math.max(0, toast.remaining));
  toast.ring?.play();
}

function remove(toast: Toast) {
  if (current === toast) current = null;
  toast.events.abort();
  window.clearTimeout(toast.timer);
  cancelAnimationFrame(toast.frame);
  toast.ring?.cancel();
  toast.page.removeEventListener("abort", toast.remove);
  toast.el.remove();
}

function retire(toast: Toast) {
  if (toast.events.signal.aborted) return;
  if (current === toast) current = null;
  toast.events.abort();
  pause(toast);
  cancelAnimationFrame(toast.frame);
  if (toast.el.dataset.state !== "in") {
    toast.remove();
    return;
  }
  toast.el.dataset.state = "out";
  // getAnimations() flushes style, so the CSS exit is already running here.
  const running = toast.el.getAnimations();
  if (!running.length) {
    toast.remove();
    return;
  }
  void Promise.allSettled(running.map((animation) => animation.finished)).then(toast.remove);
}

export function showToast({ message, tone = "ok", action, duration }: ToastOptions): void {
  const page = pageSignal();
  if (page.aborted) return;
  if (current) retire(current);

  const el = document.createElement("div");
  el.className = action ? "ui-toast" : "ui-toast solo";
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");

  const icon = document.createElement("span");
  icon.className = `ti ${tone}`;
  icon.setAttribute("aria-hidden", "true");
  icon.innerHTML =
    (action?.kind === "undo" ? RING : "") + iconMarkup(tone === "ok" ? "check" : "alert", { size: 14 });
  const text = document.createElement("span");
  text.className = "msg";
  el.append(icon, text);

  const toast: Toast = {
    el,
    page,
    events: new AbortController(),
    remaining: duration ?? (action ? tokenMs("--dur-toast", 4000) : 3200),
    startedAt: 0,
    timer: 0,
    frame: 0,
    ring: null,
    hovered: false,
    focused: false,
    remove: () => remove(toast),
  };
  const on = { signal: toast.events.signal };

  if (action) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "act";
    button.textContent = action.kind === "undo" ? "Undo" : "Retry";
    button.addEventListener("click", () => {
      retire(toast);
      action.run();
    }, on);
    el.append(button);
  }

  el.addEventListener("pointerenter", () => {
    toast.hovered = true;
    pause(toast);
  }, on);
  el.addEventListener("pointerleave", () => {
    toast.hovered = false;
    resume(toast);
  }, on);
  el.addEventListener("focusin", () => {
    toast.focused = true;
    pause(toast);
  }, on);
  el.addEventListener("focusout", (event) => {
    toast.focused = event.relatedTarget instanceof Node && el.contains(event.relatedTarget);
    resume(toast);
  }, on);

  page.addEventListener("abort", toast.remove, { once: true });
  document.body.append(el);
  current = toast;

  // The empty live region gets one rendered frame before its text arrives, so
  // it is announced, and the entry pose is styled before data-state="in".
  toast.frame = requestAnimationFrame(() => {
    toast.frame = requestAnimationFrame(() => {
      toast.frame = 0;
      text.textContent = message;
      el.dataset.state = "in";
      const circle = el.querySelector("circle");
      if (circle) {
        toast.ring = circle.animate(
          [{ strokeDashoffset: "0" }, { strokeDashoffset: "1" }],
          { duration: toast.remaining, fill: "forwards" },
        );
        toast.ring.pause();
      }
      resume(toast);
    });
  });
}
