/**
 * page-flow - on touch devices, pulling past the end of a page continues to
 * the next one and pulling past the top returns to the previous one, so the
 * site reads as one continuous column. Sections follow the bottom navigation
 * order; notes follow their own previous/next links. A pill fills as the
 * pull nears its threshold, the destination starts prerendering on the way,
 * and releasing past the threshold navigates with the route transition
 * running in the direction of travel. Short or partial pulls simply retract.
 */
import { prefetch } from "astro:prefetch";
import { iconMarkup } from "../lib/ui-icons";
import { playAccent } from "./sound";

interface Target {
  href: string;
  label: string;
}
type Edge = "start" | "end";

/** Finger travel past the edge, after resistance, that commits a move. */
const THRESHOLD = 88;
const RESISTANCE = 0.5;

const root = document.documentElement;
const normalize = (path: string) => (path.endsWith("/") ? path : `${path}/`);

function findTargets(): Partial<Record<Edge, Target>> {
  const note = (dir: "prev" | "next") => {
    const link = document.querySelector<HTMLAnchorElement>(`a[data-note-nav="${dir}"]`);
    if (!link) return undefined;
    const title = link.querySelector(".note-page-title")?.textContent?.trim();
    return { href: link.href, label: title || (dir === "next" ? "Next note" : "Previous note") };
  };
  if (document.querySelector("a[data-note-nav]")) return { start: note("prev"), end: note("next") };

  const tabs = Array.from(document.querySelectorAll<HTMLAnchorElement>(".site-nav-bottom a.tab"));
  const here = normalize(location.pathname);
  const index = tabs.findIndex((tab) => normalize(new URL(tab.href).pathname) === here);
  if (index < 0) return {};
  const toTarget = (tab?: HTMLAnchorElement) =>
    tab ? { href: tab.href, label: tab.querySelector(".tab-label")?.textContent?.trim() ?? "" } : undefined;
  return { start: toTarget(tabs[index - 1]), end: toTarget(tabs[index + 1]) };
}

function createIndicator(edge: Edge, target: Target): HTMLElement {
  const el = document.createElement("div");
  el.className = "page-flow";
  el.dataset.edge = edge;
  el.setAttribute("aria-hidden", "true");
  const icon = iconMarkup(edge === "end" ? "arrow-right" : "arrow-left", { size: 14 });
  el.innerHTML =
    `<span class="page-flow-pill"><span class="page-flow-fill"></span>` +
    `<span class="page-flow-dir">${edge === "end" ? "Next" : "Previous"}</span>` +
    `<span class="page-flow-label"></span><span class="page-flow-icon">${icon}</span></span>`;
  el.querySelector(".page-flow-label")!.textContent = target.label;
  document.body.append(el);
  return el;
}

const targets = findTargets();
if (targets.start || targets.end) {
  root.toggleAttribute("data-page-flow", true);
  const indicators: Partial<Record<Edge, HTMLElement>> = {};
  const prefetched = new Set<string>();

  let startY = 0;
  let anchor: number | null = null;
  let edge: Edge | null = null;
  let progress = 0;
  let armed = false;
  let frame = 0;

  const paint = () => {
    frame = 0;
    const el = edge ? indicators[edge] : undefined;
    if (!el) return;
    el.style.setProperty("--flow", progress.toFixed(3));
    el.toggleAttribute("data-active", progress > 0);
    el.toggleAttribute("data-armed", armed);
  };

  const reset = () => {
    for (const el of Object.values(indicators)) {
      el.style.setProperty("--flow", "0");
      el.removeAttribute("data-active");
      el.removeAttribute("data-armed");
    }
    edge = null;
    anchor = null;
    progress = 0;
    armed = false;
  };

  window.addEventListener("touchstart", (event) => {
    if (event.touches.length !== 1) return;
    startY = event.touches[0].clientY;
    anchor = null;
    edge = null;
  }, { passive: true });

  window.addEventListener("touchmove", (event) => {
    if (event.touches.length !== 1) return;
    const y = event.touches[0].clientY;
    if (!edge) {
      const bottom = window.scrollY + window.innerHeight >= root.scrollHeight - 2;
      if (targets.end && y < startY && bottom) edge = "end";
      else if (targets.start && y > startY && window.scrollY <= 0) edge = "start";
      if (!edge) return;
      anchor = y;
      indicators[edge] ??= createIndicator(edge, targets[edge]!);
    }
    const pull = (edge === "end" ? anchor! - y : y - anchor!) * RESISTANCE;
    progress = Math.min(1, Math.max(0, pull / THRESHOLD));
    const target = targets[edge]!;
    if (progress > 0.2 && !prefetched.has(target.href)) {
      prefetched.add(target.href);
      prefetch(target.href, { ignoreSlowConnection: false });
    }
    const nowArmed = progress >= 1;
    if (nowArmed && !armed) {
      playAccent("select");
      (navigator as Navigator & { vibrate?: (ms: number) => boolean }).vibrate?.(8);
    }
    armed = nowArmed;
    if (!frame) frame = requestAnimationFrame(paint);
  }, { passive: true });

  const release = () => {
    if (edge && armed) {
      const target = targets[edge]!;
      // The route transition reads this to travel in the gesture's direction.
      try {
        sessionStorage.setItem("route-dir", edge === "start" ? "back" : "forward");
      } catch {}
      location.assign(target.href);
      return;
    }
    reset();
  };
  window.addEventListener("touchend", release, { passive: true });
  window.addEventListener("touchcancel", reset, { passive: true });
  // Back/forward cache restores must not come back mid-pull.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) reset();
  });
}
