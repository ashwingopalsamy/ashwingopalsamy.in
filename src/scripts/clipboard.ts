/**
 * clipboard - copy primitives and the copy-control state machine.
 *
 * `[data-copy][data-state]` controls work through one delegated click
 * listener, so controls the page store swaps in later need no binding. The
 * value is the attribute, or this page's URL when it is empty. A control
 * confirms itself (data-state idle -> done | error -> idle, plus a visually
 * hidden live sibling) and never raises a toast; toasts are only for copies
 * with no visible control (keyboard, palette).
 */

import { onPageCleanup, pageSignal } from "./lifecycle";
import { playAccent } from "./sound";
import { showToast, tokenMs } from "./toast";

const holds = new Map<HTMLElement, number>();
let holdsPage: AbortSignal | null = null;

export async function copyToClipboard(value: string, signal = pageSignal()): Promise<boolean> {
  if (signal.aborted) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
  }

  if (signal.aborted) return false;
  const area = document.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "true");
  area.style.position = "fixed";
  area.style.opacity = "0";
  try {
    document.body.append(area);
    area.select();
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

function liveSibling(control: HTMLElement): HTMLElement {
  const next = control.nextElementSibling;
  if (next instanceof HTMLElement && next.hasAttribute("data-copy-live")) return next;
  const live = document.createElement("span");
  live.className = "visually-hidden";
  live.setAttribute("aria-live", "polite");
  live.setAttribute("data-copy-live", "");
  control.after(live);
  return live;
}

/** Copy `value` and confirm on `control` itself (data-state + live sibling). */
export async function copyControl(
  control: HTMLElement,
  value: string,
  signal = pageSignal(),
): Promise<boolean> {
  if (signal.aborted) return false;
  window.clearTimeout(holds.get(control));
  holds.delete(control);
  // Created before the await, so the region exists before its text changes.
  const live = liveSibling(control);
  live.textContent = "";

  const ok = await copyToClipboard(value, signal);
  if (signal.aborted || !control.isConnected) return ok;
  control.dataset.state = ok ? "done" : "error";
  live.textContent = ok ? "Copied" : "Couldn’t copy";
  if (ok) playAccent("copy");

  if (holdsPage !== signal) {
    holdsPage = signal;
    onPageCleanup(() => {
      holds.forEach((timer) => window.clearTimeout(timer));
      holds.clear();
    }, signal);
  }
  holds.set(control, window.setTimeout(() => {
    holds.delete(control);
    control.dataset.state = "idle";
    live.textContent = "";
  }, tokenMs("--dur-hold", 1600)));
  return ok;
}

/** Copy with no visible control: the toast is the confirmation. */
export async function copyWithToast(
  value: string,
  message: string,
  signal = pageSignal(),
): Promise<boolean> {
  const ok = await copyToClipboard(value, signal);
  if (signal.aborted) return ok;
  if (ok) {
    playAccent("copy");
    showToast({ message });
  } else {
    showToast({
      message: "Couldn’t copy",
      tone: "err",
      action: { kind: "retry", run: () => void copyWithToast(value, message) },
    });
  }
  return ok;
}

if (typeof document !== "undefined") {
  document.addEventListener("click", (event) => {
    const control = event.target instanceof Element
      ? event.target.closest<HTMLElement>("[data-copy][data-state]")
      : null;
    if (!control) return;
    void copyControl(control, control.dataset.copy || location.origin + location.pathname + location.search);
  });
}
