/**
 * photo-detail - swipe and arrow keys on a photo's own page.
 *
 * A horizontal drag on the stage carries the photo with the finger (rubber
 * at an end with nowhere to go). Let go past a third of the way, or flick,
 * and the pager link is followed: the photo's offset is handed to the view
 * transition as --photo-drag, so it leaves from exactly where the finger
 * left it instead of snapping back to centre first. Short of that it springs
 * home. Vertical drags stay with the page's own scroll (touch-action).
 */
import { onPageCleanup, pageSignal } from "./lifecycle";
import { spring, springs } from "./spring";

const rubber = (overshoot: number, dimension: number) =>
  Math.sign(overshoot) * dimension * (1 - 1 / ((Math.abs(overshoot) * 0.55) / dimension + 1));

function enhanceDetail(): void {
  const detail = document.querySelector<HTMLElement>("[data-photo-detail]");
  const stage = detail?.querySelector<HTMLElement>(".photo-stage");
  const media = stage?.querySelector<HTMLElement>("[data-photo-media]");
  if (!detail || !stage || !media || detail.dataset.swipeReady === "true") return;
  const signal = pageSignal();
  detail.dataset.swipeReady = "true";
  const prev = detail.querySelector<HTMLAnchorElement>('a[rel="prev"]');
  const next = detail.querySelector<HTMLAnchorElement>('a[rel="next"]');
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");

  let pointer = -1;
  let x0 = 0;
  let y0 = 0;
  let dx = 0;
  let axis: "x" | "y" | null = null;
  let samples: { x: number; t: number }[] = [];

  /* The photo stays where the finger left it while the next one warms: the
     swap group is untransformed, so the outgoing snapshot starts from
     --photo-drag, which is that same offset. */
  const follow = (link: HTMLAnchorElement | null, offset: number) => {
    if (!link) return;
    document.documentElement.style.setProperty("--photo-drag", `${Math.round(offset)}px`);
    media.getAnimations().forEach((animation) => animation.cancel());
    link.click();
    // a navigation that never happens must not strand the photo off centre
    window.setTimeout(() => {
      if (!signal.aborted && media.style.transform) home(0);
    }, 1600);
  };

  const home = (velocity: number) => {
    const from = media.style.transform;
    media.style.transform = "";
    if (!from || reduce.matches) return;
    const distance = -dx;
    const v = Math.abs(distance) > 1 ? Math.max(0, (velocity * 1000) / distance) : 0;
    const { easing, duration } = spring({ ...springs.settle, velocity: v });
    media.animate([{ transform: from }, { transform: "none" }], { duration, easing });
  };

  stage.addEventListener("dragstart", (event) => event.preventDefault(), { signal });

  stage.addEventListener("pointerdown", (event) => {
    if (pointer !== -1 || (event.pointerType === "mouse" && event.button !== 0)) return;
    pointer = event.pointerId;
    x0 = event.clientX;
    y0 = event.clientY;
    dx = 0;
    axis = null;
    samples = [{ x: event.clientX, t: event.timeStamp }];
  }, { signal });

  stage.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointer) return;
    const moveX = event.clientX - x0;
    const moveY = event.clientY - y0;
    if (!axis) {
      if (Math.hypot(moveX, moveY) < 8) return;
      axis = Math.abs(moveX) > Math.abs(moveY) ? "x" : "y";
      if (axis === "y") {
        pointer = -1;
        return;
      }
      stage.setPointerCapture(event.pointerId);
    }
    dx = moveX;
    samples.push({ x: event.clientX, t: event.timeStamp });
    while (samples.length > 2 && event.timeStamp - samples[0].t > 100) samples.shift();
    const blocked = (dx > 0 && !prev) || (dx < 0 && !next);
    const offset = blocked ? rubber(dx, stage.clientWidth) : dx;
    media.getAnimations().forEach((animation) => animation.cancel());
    media.style.transform = `translate3d(${offset}px, 0, 0)`;
  }, { signal });

  const release = (event: PointerEvent) => {
    if (event.pointerId !== pointer) return;
    pointer = -1;
    if (axis !== "x") return;
    const first = samples[0];
    const last = samples[samples.length - 1];
    const v = last.t - first.t > 8 && event.type !== "pointercancel" ? (last.x - first.x) / (last.t - first.t) : 0;
    const width = stage.clientWidth;
    if (next && (dx < -width / 3 || (v < -0.4 && dx < 0))) follow(next, dx);
    else if (prev && (dx > width / 3 || (v > 0.4 && dx > 0))) follow(prev, dx);
    else home(v);
  };
  stage.addEventListener("pointerup", release, { signal });
  stage.addEventListener("pointercancel", release, { signal });

  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return;
    const target = event.target as Element | null;
    if (target?.closest("input, textarea, select, [contenteditable], dialog[open]")) return;
    if (event.key === "ArrowRight" && next) follow(next, 0);
    else if (event.key === "ArrowLeft" && prev) follow(prev, 0);
    else return;
    event.preventDefault();
  }, { signal });

  onPageCleanup(() => {
    delete detail.dataset.swipeReady;
  }, signal);
}

enhanceDetail();
document.addEventListener("astro:page-load", enhanceDetail);
