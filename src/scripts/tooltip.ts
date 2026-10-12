/**
 * tooltip - the two things a CSS-first .ui-tip cannot do alone.
 *
 * Warm: a tooltip that was shown in the last 600ms lets the next one skip
 * the 400ms dwell (:root[data-tip-warm], read by controls.css). A tooltip
 * counts as shown when its opacity transition starts, which is after the
 * dwell, so sweeping across a row of triggers warms nothing the pointer did
 * not stop on.
 *
 * Long press: touch has no hover, so holding a trigger for 500ms opens its
 * tooltip ([data-tip-open]) for 1.5s. A tap never does. The click that ends
 * a long press is swallowed, so holding to read does not toggle the control.
 *
 * Delegated on document and never torn down: nothing is bound to a node, so
 * elements the page store swaps in need no wiring.
 */

const WARM_MS = 600;
const HOLD_MS = 500;
const SHOW_MS = 1500;
const CLICK_GRACE_MS = 400;

const WARM = "data-tip-warm";
const OPEN = "data-tip-open";
const TRIGGER = ":has(> .ui-tip)";

let coolTimer: number | undefined;
let holdTimer: number | undefined;
let pressed = false;
let swallow: HTMLElement | null = null;
let swallowUntil = 0;

function onTransitionStart(event: TransitionEvent) {
  const tip = event.target;
  if (event.propertyName !== "opacity" || !(tip instanceof HTMLElement) || !tip.matches(".ui-tip")) return;
  window.clearTimeout(coolTimer);
  const root = document.documentElement;
  if (tip.parentElement?.matches(`:hover, :focus-visible, [${OPEN}]`)) {
    root.setAttribute(WARM, "");
  } else {
    coolTimer = window.setTimeout(() => root.removeAttribute(WARM), WARM_MS);
  }
}

function onDown(event: PointerEvent) {
  swallow = null; // a new gesture ends the last long press's claim on its click
  if (event.pointerType !== "touch" || !(event.target instanceof Element)) return;
  const trigger = event.target.closest<HTMLElement>(TRIGGER);
  if (!trigger) return;
  pressed = true;
  window.clearTimeout(holdTimer);
  holdTimer = window.setTimeout(() => {
    swallow = trigger;
    trigger.setAttribute(OPEN, "");
    window.setTimeout(() => trigger.removeAttribute(OPEN), SHOW_MS);
  }, HOLD_MS);
}

function onUp() {
  pressed = false;
  window.clearTimeout(holdTimer);
  if (swallow) swallowUntil = performance.now() + CLICK_GRACE_MS;
}

function onClick(event: MouseEvent) {
  if (!swallow) return;
  const held = swallow;
  swallow = null;
  if (performance.now() <= swallowUntil && event.target instanceof Node && held.contains(event.target)) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}

/* Android shows its link menu on a long press; the tooltip is the answer
   here, so the menu stays down while a touch is held on a trigger. */
function onContextMenu(event: Event) {
  if (pressed && event.target instanceof Element && event.target.closest(TRIGGER)) event.preventDefault();
}

if (typeof document !== "undefined") {
  const passive = { passive: true };
  document.addEventListener("transitionstart", onTransitionStart, passive);
  document.addEventListener("pointerdown", onDown, passive);
  document.addEventListener("pointerup", onUp, passive);
  document.addEventListener("pointercancel", onUp, passive);
  document.addEventListener("click", onClick, true);
  document.addEventListener("contextmenu", onContextMenu);
}
