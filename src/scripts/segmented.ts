/**
 * segmented - the ink indicator and its ink-through labels for every .ui-seg.
 *
 *   .ui-seg > .ui-seg__track > .ui-seg__ind + .ui-seg__item ...   (controls.css)
 *
 * Selection lives in the markup: aria-selected on a role="tablist" track
 * (roving tabindex, arrow keys, aria-controls panels shown and hidden),
 * aria-pressed on plain buttons, aria-current="page" on links (links
 * navigate, so they are never intercepted).
 *
 * The indicator rests at its item's true box (inline transform and size).
 * A move is a FLIP from wherever it is drawn: --slide-* holds the old box
 * re-expressed against the new one and data-slide alternates a/b, so a new
 * slide restarts without a forced reflow. The overlay is a canvas-ink copy
 * of the items, built once, aria-hidden and inert, clipped to the same box;
 * its clip rides the same spring, so a label inverts exactly where the ink
 * passes under it.
 *
 * Layout is read before anything is written, and only on init, resize and
 * selection. Everything is torn down with the page (lifecycle.ts).
 */

import { onPageCleanup, pageSignal } from "./lifecycle";

export interface SegChangeDetail {
  value: string;
  index: number;
}

export interface SegmentedOptions {
  /** Lifetime of the wiring. Defaults to the current page. */
  signal?: AbortSignal;
}

export interface SelectOptions {
  /** Move focus to the item (tabs: the roving tabindex follows). */
  focus?: boolean;
  /** Dispatch seg:change, as a click or arrow key does. */
  emit?: boolean;
}

export interface Segmented {
  readonly element: HTMLElement;
  readonly value: string;
  readonly index: number;
  /** Select by data-value or index. Returns whether the selection changed. */
  select(target: string | number, options?: SelectOptions): boolean;
  /** Re-read the selected item from the markup and re-place the ink. */
  refresh(): void;
}

declare global {
  interface HTMLElementEventMap {
    "seg:change": CustomEvent<SegChangeDetail>;
  }
}

type Box = { x: number; y: number; w: number; h: number };
type Mode = "tab" | "pressed" | "link";
type Measured = { next: Box; drawn: DOMMatrixReadOnly | null; overflow: boolean; scroll: number; view: number; max: number };

const SELECTED = '[aria-selected="true"], [aria-current="page"], [aria-pressed="true"]';
/* the track's edge fade (controls.css, --step-4): an item under it is not in view */
const EDGE = 16;
const COPY_STRIPPED = ["id", "role", "tabindex", "href", "aria-selected", "aria-controls", "aria-current", "aria-pressed", "aria-label", "data-value"];

const instances = new WeakMap<HTMLElement, Segmented>();

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const isDisabled = (item: HTMLElement) => item.matches(':disabled, [aria-disabled="true"]');
const clipFor = ({ x, y, w, h }: Box) =>
  `inset(${y}px calc(100% - ${x + w}px) calc(100% - ${y + h}px) ${x}px round var(--r-pill))`;

/** Wire every .ui-seg in `scope` (or `scope` itself). Already-wired ones are returned as they are. */
export function initSegmented(scope: ParentNode = document, options: SegmentedOptions = {}): Segmented[] {
  const signal = options.signal ?? pageSignal();
  if (signal.aborted) return [];
  const roots = scope instanceof HTMLElement && scope.matches(".ui-seg")
    ? [scope]
    : Array.from(scope.querySelectorAll<HTMLElement>(".ui-seg"));
  const wired: Segmented[] = [];
  for (const root of roots) {
    const segmented = instances.get(root) ?? wire(root, signal);
    if (segmented) wired.push(segmented);
  }
  return wired;
}

/** The controller wired onto `root`, once initSegmented has run on it. */
export function getSegmented(root: HTMLElement | null): Segmented | undefined {
  return root ? instances.get(root) : undefined;
}

/* Canvas-ink copies of the items, laid out exactly like them (controls.css
   gives the overlay the track's padding and gap). Nothing in it is
   reachable: no ids, no roles, no transition names, inert. */
function buildOverlay(track: HTMLElement, items: HTMLElement[]): HTMLElement {
  const overlay = document.createElement("span");
  overlay.className = "ui-seg__ov";
  overlay.setAttribute("aria-hidden", "true");
  overlay.inert = true;
  for (const item of items) {
    const copy = item.cloneNode(true) as HTMLElement;
    for (const name of COPY_STRIPPED) copy.removeAttribute(name);
    for (const node of [copy, ...copy.querySelectorAll<HTMLElement>("[id], [style]")]) {
      node.removeAttribute("id");
      node.style?.removeProperty("view-transition-name");
    }
    overlay.append(copy);
  }
  track.append(overlay);
  return overlay;
}

function wire(root: HTMLElement, signal: AbortSignal): Segmented | null {
  const track = root.querySelector<HTMLElement>(":scope > .ui-seg__track");
  const indicator = track?.querySelector<HTMLElement>(":scope > .ui-seg__ind");
  const items = track ? Array.from(track.querySelectorAll<HTMLElement>(":scope > .ui-seg__item")) : [];
  if (!track || !indicator || !items.length) return null;

  const mode: Mode = track.getAttribute("role") === "tablist"
    ? "tab"
    : items.every((item) => item.matches("a[href]")) ? "link" : "pressed";
  const valueAt = (index: number) => items[index]?.dataset.value ?? String(index);

  let overlay = track.querySelector<HTMLElement>(":scope > .ui-seg__ov");
  if (overlay && overlay.childElementCount !== items.length) {
    overlay.remove();
    overlay = null;
  }
  const ink = overlay ?? buildOverlay(track, items);

  let current = items.findIndex((item) => item.matches(SELECTED));
  let slot: Box | null = null;

  const measure = (index: number): Measured | null => {
    const item = items[index];
    // hidden (display: none somewhere above): the ResizeObserver brings it back
    if (!item || !item.offsetWidth) return null;
    const next = { x: item.offsetLeft, y: item.offsetTop, w: item.offsetWidth, h: item.offsetHeight };
    // where the ink is actually drawn, so a slide interrupted mid-flight restarts from there
    const drawn = slot ? new DOMMatrixReadOnly(getComputedStyle(indicator).transform) : null;
    const view = track.clientWidth;
    // The content's own extent, not scrollWidth: an item's 44px hit area
    // overhangs its box and would make a track that fits look scrollable.
    let last = items.length - 1;
    while (last > 0 && !items[last].offsetWidth) last--;
    const end = items[last].offsetLeft + items[last].offsetWidth + parseFloat(getComputedStyle(track).paddingInlineEnd);
    const max = Math.max(0, end - view);
    return { next, drawn, overflow: max > 1, scroll: track.scrollLeft, view, max };
  };

  /* Writes only. `slide` is a selection (FLIP on the spring); otherwise
     it is a relayout and both the ink and the clip jump. */
  const place = (measured: Measured, slide: boolean) => {
    const { next, drawn } = measured;
    if (!slot || slot.x !== next.x || slot.y !== next.y || slot.w !== next.w || slot.h !== next.h) {
      if (slide && slot && drawn) {
        indicator.style.setProperty("--slide-x", `${drawn.e}px`);
        indicator.style.setProperty("--slide-y", `${drawn.f}px`);
        indicator.style.setProperty("--slide-sx", String((slot.w * drawn.a) / next.w));
        indicator.style.setProperty("--slide-sy", String((slot.h * drawn.d) / next.h));
        indicator.dataset.slide = indicator.dataset.slide === "a" ? "b" : "a";
      }
      indicator.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;
      indicator.style.width = `${next.w}px`;
      indicator.style.height = `${next.h}px`;
      if (slide || !slot) {
        ink.style.clipPath = clipFor(next);
      } else {
        ink.style.transition = "none";
        ink.style.clipPath = clipFor(next);
        void getComputedStyle(ink).clipPath;
        ink.style.transition = "";
      }
      slot = next;
    }
    if (track.hasAttribute("data-overflow") !== measured.overflow) track.toggleAttribute("data-overflow", measured.overflow);
    if (!root.hasAttribute("data-ready")) {
      // The script-less look (ink on the item itself) hands over to the
      // indicator in one frame, not through a 110ms fade.
      indicator.style.transition = "none";
      root.setAttribute("data-ready", "");
      void getComputedStyle(indicator).opacity;
      indicator.style.transition = "";
    }
  };

  /* An overflowing (phone) track brings a selection under its edge fade
     into view, centred, without scrolling the page. */
  const reveal = ({ next, overflow, scroll, view, max }: Measured, smooth: boolean) => {
    if (!overflow || (next.x >= scroll + EDGE && next.x + next.w <= scroll + view - EDGE)) return;
    const left = Math.max(0, Math.min(max, next.x - (view - next.w) / 2));
    track.scrollTo({ left, behavior: smooth && !reducedMotion() ? "smooth" : "instant" });
  };

  const mark = (index: number) => {
    items.forEach((item, i) => {
      const on = i === index;
      if (mode === "tab") {
        item.setAttribute("aria-selected", String(on));
        item.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(item.getAttribute("aria-controls") ?? "");
        if (panel && panel.hidden === on) panel.hidden = !on;
      } else if (mode === "pressed") {
        item.setAttribute("aria-pressed", String(on));
      }
    });
  };

  const select = (target: string | number, options: SelectOptions = {}) => {
    const index = typeof target === "number" ? target : items.findIndex((_, i) => valueAt(i) === target);
    if (signal.aborted || index < 0 || index >= items.length || isDisabled(items[index])) return false;
    const changed = index !== current;
    const measured = measure(index);
    current = index;
    mark(index);
    if (measured) {
      place(measured, true);
      reveal(measured, true);
    }
    if (options.focus) items[index].focus({ preventScroll: true });
    if (changed && options.emit) {
      root.dispatchEvent(new CustomEvent<SegChangeDetail>("seg:change", {
        bubbles: true,
        detail: { value: valueAt(index), index },
      }));
    }
    return changed;
  };

  const relayout = () => {
    if (signal.aborted || current < 0) return;
    const measured = measure(current);
    if (measured) place(measured, false);
  };

  const refresh = () => {
    const marked = items.findIndex((item) => item.matches(SELECTED));
    if (marked >= 0 && marked !== current) select(marked);
    else relayout();
  };

  track.addEventListener("click", (event) => {
    const item = (event.target as Element | null)?.closest<HTMLElement>(".ui-seg__item");
    const index = item ? items.indexOf(item) : -1;
    if (index < 0 || mode === "link" || item!.matches("a[href]")) return;
    select(index, { emit: true });
  }, { signal });

  if (mode === "tab") {
    items.forEach((item) => {
      if (!item.hasAttribute("role")) item.setAttribute("role", "tab");
    });
    track.addEventListener("keydown", (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const from = items.indexOf(event.target as HTMLElement);
      if (from < 0) return;
      const forward = getComputedStyle(track).direction === "rtl" ? "ArrowLeft" : "ArrowRight";
      const backward = forward === "ArrowRight" ? "ArrowLeft" : "ArrowRight";
      const enabled = items.map((item, i) => (isDisabled(item) ? -1 : i)).filter((i) => i >= 0);
      if (!enabled.length) return;
      const at = enabled.indexOf(from);
      let next = -1;
      if (event.key === forward) next = enabled[(at + 1) % enabled.length];
      else if (event.key === backward) next = enabled[(at - 1 + enabled.length) % enabled.length];
      else if (event.key === "Home") next = enabled[0];
      else if (event.key === "End") next = enabled[enabled.length - 1];
      if (next < 0) return;
      event.preventDefault();
      select(next, { focus: true, emit: true });
    }, { signal });
  }

  // Item boxes change with fonts, breakpoints and the rail; the track with the viewport.
  const resize = new ResizeObserver(relayout);
  resize.observe(track);
  items.forEach((item) => resize.observe(item));

  const segmented: Segmented = {
    element: root,
    get value() {
      return valueAt(current);
    },
    get index() {
      return current;
    },
    select,
    refresh,
  };
  instances.set(root, segmented);
  onPageCleanup(() => {
    resize.disconnect();
    if (instances.get(root) === segmented) instances.delete(root);
  }, signal);

  if (current < 0 && mode === "tab") current = 0;
  if (current >= 0) {
    mark(current);
    const measured = measure(current);
    if (measured) {
      place(measured, false);
      reveal(measured, false);
    }
  }
  return segmented;
}
