/**
 * masonry - row-major lanes for the photo wall.
 *
 * CSS columns fill one column top to bottom before the next, so a sorted
 * wall would read down the left edge first. Here each item, in DOM order,
 * drops into the shortest lane (the leftmost on a tie), so the newest sits
 * top left and the next beside it. Positions are written to the individual
 * `translate` property, never `transform`, so engine.ts can FLIP on
 * `transform` over the top and the two compose.
 *
 * Without script, or on phones (one lane), the wall stays in normal flow
 * (controls the CSS fallback in photos.astro). Layout is one batch of
 * height reads, then one batch of writes: on init, on engine:layout (sync,
 * so the engine's FLIP reads the new boxes), and on a coalesced
 * ResizeObserver frame when the rail or an item (a font, a caption) resizes.
 */
import { onPageCleanup, pageSignal } from "./lifecycle";

const ONE_LANE = "(max-width: 38rem)";
const LANES = 2;

function enhanceMasonry() {
  const list = document.querySelector<HTMLElement>("[data-masonry-list]");
  if (!list || list.dataset.masonryReady === "true") return;
  const signal = pageSignal();
  list.dataset.masonryReady = "true";
  const single = matchMedia(ONE_LANE);
  const items = () => Array.from(list.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement && !child.hidden,
  );
  let frame = 0;
  let width = -1;

  const release = () => {
    if (!list.hasAttribute("data-masonry")) return;
    list.removeAttribute("data-masonry");
    list.style.removeProperty("block-size");
    for (const child of Array.from(list.children) as HTMLElement[]) child.style.removeProperty("translate");
  };

  const layout = () => {
    cancelAnimationFrame(frame);
    if (single.matches) {
      release();
      return;
    }
    list.setAttribute("data-masonry", "");
    const style = getComputedStyle(list);
    const gapX = parseFloat(style.columnGap) || 0;
    const gapY = parseFloat(style.rowGap) || 0;
    width = list.clientWidth;
    const lane = (width - gapX * (LANES - 1)) / LANES;
    const visible = items();
    const heights = visible.map((child) => child.offsetHeight);
    const tops = new Array<number>(LANES).fill(0);
    visible.forEach((child, index) => {
      let target = 0;
      for (let next = 1; next < LANES; next += 1) if (tops[next] < tops[target] - 1) target = next;
      child.style.translate = `${Math.round(target * (lane + gapX))}px ${Math.round(tops[target])}px`;
      tops[target] += heights[index] + gapY;
    });
    list.style.blockSize = `${Math.max(0, Math.max(...tops) - gapY)}px`;
  };

  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(layout);
  };

  const observer = new ResizeObserver((entries) => {
    // the list's own height is ours; only a width change or an item's resize matters
    const relevant = entries.some((entry) => entry.target !== list || entry.contentRect.width !== width);
    if (relevant) schedule();
  });
  observer.observe(list);
  for (const child of Array.from(list.children)) observer.observe(child);

  list.closest("[data-engine]")?.addEventListener("engine:layout", layout, { signal });
  single.addEventListener("change", layout, { signal });
  onPageCleanup(() => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    delete list.dataset.masonryReady;
  }, signal);
  layout();
}

enhanceMasonry();
document.addEventListener("astro:page-load", enhanceMasonry);
