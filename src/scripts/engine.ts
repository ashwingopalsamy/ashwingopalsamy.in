/**
 * engine - filter and sort for the photo, cafe and people pages.
 *
 *   [data-engine]                      one per page
 *     [data-engine-filter] .ui-seg     pressed items, data-value = "all" | tag
 *     [data-engine-sort]   .ui-seg     pressed items, data-sort-key, data-sort-dir
 *     [data-engine-group]              hidden while none of its items show
 *       [data-engine-list]             its item children are re-ordered in place
 *         [data-engine-item]           data-tags="a b", data-k-<key>="value"
 *     [data-engine-status]             polite count after each change
 *
 * A change is one FLIP: every box is read, the DOM is written once, every
 * box is read again, then only what is near the viewport animates. Movers
 * ride the snap spring on transform; arrivals fade and settle from 0.96 on
 * the enter curve; departures leave at once (leaving is always the faster
 * gesture). Nested boxes subtract their group's travel so nothing moves
 * twice. State is mirrored to ?filter= and ?sort= with replaceState.
 */
import { onPageCleanup, pageSignal } from "./lifecycle";
import { initSegmented } from "./segmented";
import { playAccent } from "./sound";

const ITEM = "[data-engine-item]";
const GROUP = "[data-engine-group]";
const MARGIN = 64;

function duration(value: string, fallback: number): number {
  const text = value.trim();
  if (text.endsWith("ms")) return parseFloat(text) || fallback;
  if (text.endsWith("s")) return parseFloat(text) * 1000 || fallback;
  return fallback;
}

function enhanceEngine() {
  const root = document.querySelector<HTMLElement>("[data-engine]");
  if (!root || root.dataset.engineReady === "true") return;
  const signal = pageSignal();
  const filterRoot = root.querySelector<HTMLElement>("[data-engine-filter]");
  const sortRoot = root.querySelector<HTMLElement>("[data-engine-sort]");
  const segs = initSegmented(root, { signal });
  const filterSeg = segs.find((seg) => seg.element === filterRoot);
  const sortSeg = segs.find((seg) => seg.element === sortRoot);
  const items = Array.from(root.querySelectorAll<HTMLElement>(ITEM));
  const lists = Array.from(root.querySelectorAll<HTMLElement>("[data-engine-list]"));
  const groups = Array.from(root.querySelectorAll<HTMLElement>(GROUP));
  const status = root.querySelector<HTMLElement>("[data-engine-status]");
  if (!items.length) return;
  root.dataset.engineReady = "true";

  items.forEach((item, index) => { item.dataset.engineIndex = String(index); });
  const defaults = { filter: filterSeg?.value ?? "all", sort: sortSeg?.value ?? "" };
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const tags = new Map(items.map((item) => [item, (item.dataset.tags ?? "").split(/\s+/).filter(Boolean)]));

  const sortSpec = () => {
    const value = sortSeg?.value;
    const button = value ? sortRoot?.querySelector<HTMLElement>(`[data-value="${CSS.escape(value)}"]`) : null;
    return { key: button?.dataset.sortKey ?? "", dir: button?.dataset.sortDir === "asc" ? 1 : -1 };
  };

  const compare = (key: string, dir: number) => (left: HTMLElement, right: HTMLElement) => {
    const a = left.getAttribute(`data-k-${key}`) ?? "";
    const b = right.getAttribute(`data-k-${key}`) ?? "";
    const na = Number(a);
    const nb = Number(b);
    const order = a !== "" && b !== "" && Number.isFinite(na) && Number.isFinite(nb)
      ? na - nb
      : a.localeCompare(b, undefined, { sensitivity: "base" });
    return order * dir || Number(left.dataset.engineIndex) - Number(right.dataset.engineIndex);
  };

  const measure = (elements: HTMLElement[]) => {
    const boxes = new Map<HTMLElement, DOMRect>();
    for (const element of elements) {
      if (element.hidden) continue;
      const box = element.getBoundingClientRect();
      if (box.width || box.height) boxes.set(element, box);
    }
    return boxes;
  };

  const apply = (animate: boolean) => {
    const filter = filterSeg?.value ?? "all";
    const { key, dir } = sortSpec();
    const motion = animate && !reduce.matches;
    const tracked = [...groups, ...items];
    const before = motion ? measure(tracked) : new Map<HTMLElement, DOMRect>();
    if (motion) tracked.forEach((element) => element.getAnimations().forEach((animation) => animation.cancel()));

    let shown = 0;
    for (const item of items) {
      const on = filter === "all" || (tags.get(item) ?? []).includes(filter);
      if (item.hidden === on) item.hidden = !on;
      if (on) shown += 1;
    }
    if (key) {
      for (const list of lists) {
        const children = Array.from(list.children).filter(
          (child): child is HTMLElement => child instanceof HTMLElement && child.matches(ITEM),
        );
        const sorted = [...children].sort(compare(key, dir));
        if (sorted.some((child, index) => child !== children[index])) list.append(...sorted);
      }
    }
    for (const group of groups) {
      const on = group.querySelector(`${ITEM}:not([hidden])`) !== null;
      if (group.hidden === on) group.hidden = !on;
    }
    // a scripted layout (masonry.ts) places the new set before it is read
    root.dispatchEvent(new CustomEvent("engine:layout"));
    if (status && animate) {
      status.textContent = `${shown} ${shown === 1 ? status.dataset.nounOne : status.dataset.nounMany}`;
    }
    if (!motion) return;

    const style = getComputedStyle(document.documentElement);
    const travel: KeyframeAnimationOptions = {
      duration: duration(style.getPropertyValue("--dur-spring-snap"), 247),
      easing: style.getPropertyValue("--ease-spring-snap").trim() || "ease-out",
    };
    const enterDuration = duration(style.getPropertyValue("--dur-enter"), 240);
    const enterEasing = style.getPropertyValue("--ease-enter").trim() || "ease-out";
    const after = measure(tracked);
    const view = window.innerHeight;
    const near = (box?: DOMRect) => !!box && box.bottom > -MARGIN && box.top < view + MARGIN;
    let arrivals = 0;

    for (const [element, last] of after) {
      const first = before.get(element);
      if (!near(last) && !near(first)) continue;
      const parent = element.parentElement?.closest<HTMLElement>(GROUP) ?? null;
      if (!first) {
        // an arriving group carries its items in with it
        if (parent && !before.has(parent)) continue;
        element.animate(
          [{ opacity: 0, transform: "scale(0.96)" }, { opacity: 1, transform: "none" }],
          { duration: enterDuration, easing: enterEasing, delay: Math.min(arrivals * 24, 144), fill: "backwards" },
        );
        arrivals += 1;
        continue;
      }
      let dx = first.left - last.left;
      let dy = first.top - last.top;
      const parentFirst = parent ? before.get(parent) : undefined;
      const parentLast = parent ? after.get(parent) : undefined;
      if (parentFirst && parentLast) {
        dx -= parentFirst.left - parentLast.left;
        dy -= parentFirst.top - parentLast.top;
      }
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;
      element.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], travel);
    }
  };

  const writeLocation = () => {
    const url = new URL(location.href);
    const pairs: [string, string | undefined, string][] = [
      ["filter", filterSeg?.value, defaults.filter],
      ["sort", sortSeg?.value, defaults.sort],
    ];
    for (const [name, value, fallback] of pairs) {
      if (!value || value === fallback) url.searchParams.delete(name);
      else url.searchParams.set(name, value);
    }
    history.replaceState(history.state, "", `${url.pathname}${url.search}${url.hash}`);
  };

  const onChange = () => {
    playAccent("tab");
    apply(true);
    writeLocation();
  };
  filterRoot?.addEventListener("seg:change", onChange, { signal });
  sortRoot?.addEventListener("seg:change", onChange, { signal });

  const params = new URL(location.href).searchParams;
  const requestedFilter = params.get("filter");
  const requestedSort = params.get("sort");
  if (requestedFilter) filterSeg?.select(requestedFilter);
  if (requestedSort) sortSeg?.select(requestedSort);
  apply(false);

  onPageCleanup(() => {
    delete root.dataset.engineReady;
  }, signal);
}

enhanceEngine();
document.addEventListener("astro:page-load", enhanceEngine);
