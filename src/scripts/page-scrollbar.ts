/**
 * page-scrollbar - sizes the in-card root scrollbar thumb and makes it
 * draggable. Its position needs no script: a scroll-driven animation moves it
 * on the compositor (global.css). Geometry is re-measured only when the
 * viewport or document height changes, through the shared scroll scheduler.
 */
import { onScrollFrame } from "./scroll-scheduler";

const MIN_THUMB = 32;
const bar = document.querySelector<HTMLElement>(".page-scrollbar");
const thumb = bar?.querySelector<HTMLElement>(".page-scrollbar-thumb");

if (bar && thumb && CSS.supports("animation-timeline: scroll()")) {
  let view = -1;
  let doc = -1;
  let track = 0;
  let travel = 0;

  onScrollFrame(
    ({ viewport, docHeight }) => {
      if (viewport === view && docHeight === doc) return;
      view = viewport;
      doc = docHeight;
      const scrollable = docHeight > viewport + 1;
      bar.toggleAttribute("data-idle", !scrollable);
      if (!scrollable || track <= 0) return;
      const size = Math.max(MIN_THUMB, Math.round((track * viewport) / docHeight));
      travel = Math.max(0, track - size);
      bar.style.setProperty("--thumb-size", `${size}px`);
      bar.style.setProperty("--thumb-travel", `${travel}px`);
    },
    undefined,
    ({ viewport, docHeight }) => {
      if (viewport !== view || docHeight !== doc) track = bar.clientHeight;
    },
  );

  thumb.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    thumb.setPointerCapture(event.pointerId);
    bar.toggleAttribute("data-dragging", true);
    const startY = event.clientY;
    const startScroll = window.scrollY;
    const ratio = (doc - view) / Math.max(1, travel);
    const move = (e: PointerEvent) => {
      window.scrollTo({ top: startScroll + (e.clientY - startY) * ratio, behavior: "instant" });
    };
    const end = () => {
      bar.toggleAttribute("data-dragging", false);
      thumb.removeEventListener("pointermove", move);
    };
    thumb.addEventListener("pointermove", move);
    thumb.addEventListener("pointerup", end, { once: true });
    thumb.addEventListener("pointercancel", end, { once: true });
  });
}
