/**
 * page-scrollbar - sizes the in-card root scrollbar thumb, makes it draggable
 * and shows it while the page scrolls. Its position needs no script: a
 * scroll-driven animation moves it on the compositor (global.css). Geometry is
 * re-measured only when the viewport or document height changes, through the
 * shared scroll scheduler. The bar persists across navigations, so it is bound
 * once and re-measured when a page swap changes the document height. Fine
 * pointers only: touch devices keep the platform's own overlay indicator.
 */
import { invalidateScrollMetrics, onScrollFrame } from "./scroll-scheduler";

const MIN_THUMB = 32;
/* A narrow window (a phone-width desktop window) gets a short indicator rather
   than a proportional bar, which on a short page would span most of the card. */
const COMPACT_THUMB = 40;
const compact = matchMedia("(max-width: 38rem)");
const FADE_DELAY = 800;

if (CSS.supports("animation-timeline: scroll()") && matchMedia("(hover: hover) and (pointer: fine)").matches) {
  let bar: HTMLElement | null = null;
  let fade = 0;
  let view = -1;
  let doc = -1;
  let track = 0;
  let travel = 0;

  const bind = () => {
    const next = document.querySelector<HTMLElement>(".page-scrollbar");
    if (next === bar) return;
    bar = next;
    view = -1;
    doc = -1;
    track = 0;
    travel = 0;
    const thumb = next?.querySelector<HTMLElement>(".page-scrollbar-thumb");
    if (!next || !thumb) return;

    thumb.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      thumb.setPointerCapture(event.pointerId);
      next.toggleAttribute("data-dragging", true);
      const startY = event.clientY;
      const startScroll = window.scrollY;
      const ratio = (doc - view) / Math.max(1, travel);
      const move = (e: PointerEvent) => {
        window.scrollTo({ top: startScroll + (e.clientY - startY) * ratio, behavior: "instant" });
      };
      const end = () => {
        next.toggleAttribute("data-dragging", false);
        thumb.removeEventListener("pointermove", move);
      };
      thumb.addEventListener("pointermove", move);
      thumb.addEventListener("pointerup", end, { once: true });
      thumb.addEventListener("pointercancel", end, { once: true });
    });
  };
  bind();

  // The node outlives any one page, so the subscription does too (null signal).
  onScrollFrame(
    ({ viewport, docHeight, direction }) => {
      if (!bar) return;
      if (direction) {
        bar.toggleAttribute("data-scrolling", true);
        clearTimeout(fade);
        fade = window.setTimeout(() => bar?.toggleAttribute("data-scrolling", false), FADE_DELAY);
      }
      if (viewport === view && docHeight === doc) return;
      const scrollable = docHeight > viewport + 1;
      bar.toggleAttribute("data-idle", !scrollable);
      // Unmeasured geometry is not cached, so the next frame retries.
      if (scrollable && track <= 0) return;
      view = viewport;
      doc = docHeight;
      if (!scrollable) return;
      const natural = Math.round((track * viewport) / docHeight);
      const size = compact.matches
        ? Math.min(COMPACT_THUMB, Math.max(MIN_THUMB, natural))
        : Math.max(MIN_THUMB, natural);
      travel = Math.max(0, track - size);
      bar.style.setProperty("--thumb-size", `${size}px`);
      bar.style.setProperty("--thumb-travel", `${travel}px`);
    },
    null,
    ({ viewport, docHeight }) => {
      if (bar && (viewport !== view || docHeight !== doc)) track = bar.clientHeight;
    },
  );

  document.addEventListener("astro:page-load", () => {
    bind();
    invalidateScrollMetrics();
  });

  // Crossing the narrow breakpoint changes the size with no height change.
  compact.addEventListener("change", () => {
    view = -1;
    invalidateScrollMetrics();
  });
}
