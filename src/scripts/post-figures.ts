/**
 * post-figures - the reading-font toggle and the live figures for /blog/abliterated/ posts.
 *
 * Each figure is complete as a static SVG; this only adds to it:
 *   one-direction  the refusal line erases once on view; tap the model to erase or restore it
 *   names          hover, tap or focus a row to single it out and read more about it
 *   uploads        scrub across the months for a running total; bars sweep in once on view
 *   safeguards     the rings peel away once on view; tap a column for what is left
 * Runs on astro:page-load and ends with the page signal. Reduced motion skips the playback only.
 */

import { pageSignal } from "./lifecycle";

let started: AbortSignal | null = null;

const FONT_KEY = "reading-font";
const SVG_NS = "http://www.w3.org/2000/svg";

function readFont(): string | null {
  try {
    return localStorage.getItem(FONT_KEY);
  } catch {
    return null;
  }
}

function saveFont(value: string) {
  try {
    localStorage.setItem(FONT_KEY, value);
  } catch {
    /* the choice just lasts for this page */
  }
}

function mountFontToggle(root: HTMLElement, signal: AbortSignal) {
  const button = root.querySelector<HTMLButtonElement>("[data-font-toggle]");
  const apply = (font: string) => {
    if (font === "sans") root.dataset.font = "sans";
    else delete root.dataset.font;
    if (!button) return;
    const serif = font !== "sans";
    button.setAttribute("aria-pressed", String(serif));
    button.setAttribute("aria-label", serif ? "Switch to the sans font" : "Switch to Newsreader");
    const tip = button.querySelector(".ui-tip");
    if (tip) tip.textContent = serif ? "Switch to sans" : "Switch to serif";
  };
  apply(readFont() ?? "serif");
  button?.addEventListener(
    "click",
    () => {
      const next = root.dataset.font === "sans" ? "serif" : "sans";
      saveFont(next);
      apply(next);
    },
    { signal },
  );
}

/** A line under the art that the figure writes to; the space is reserved so nothing jumps. */
function addLine(fig: HTMLElement, text: string): HTMLParagraphElement {
  const line = document.createElement("p");
  line.className = "fig__live";
  line.setAttribute("aria-live", "polite");
  line.textContent = text;
  fig.querySelector(".fig__art")?.after(line);
  return line;
}

function onView(fig: HTMLElement, signal: AbortSignal, run: () => void) {
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      run();
    },
    { threshold: 0.4 },
  );
  io.observe(fig);
  signal.addEventListener("abort", () => io.disconnect(), { once: true });
}

/** Calls step(0..1) over `ms`; the returned function stops it early. */
function play(ms: number, signal: AbortSignal, step: (t: number) => void): () => void {
  let raf = 0;
  let first = 0;
  const frame = (now: number) => {
    first ||= now;
    const t = Math.min(1, (now - first) / ms);
    step(t);
    if (t < 1) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  const stop = () => cancelAnimationFrame(raf);
  signal.addEventListener("abort", stop, { once: true });
  return stop;
}

function mountDirection(fig: HTMLElement, signal: AbortSignal, calm: boolean) {
  const solid = fig.querySelectorAll<SVGElement>("[data-ray-solid]");
  const dashed = fig.querySelectorAll<SVGElement>("[data-ray-dashed]");
  const titles = fig.querySelectorAll("[data-after-title]");
  const notes = fig.querySelectorAll("[data-after-note]");
  const targets = Array.from(fig.querySelectorAll<SVGElement>("[data-after]"));
  const line = addLine(fig, "");

  let level = calm ? 0 : 100;
  const set = (v: number) => {
    level = v;
    solid.forEach((el) => (el.style.opacity = String(v / 100)));
    dashed.forEach((el) => (el.style.opacity = String(1 - v / 100)));
    const says = v >= 50;
    titles.forEach((el) => (el.textContent = says ? "Trained model" : "Abliterated"));
    notes.forEach((el) => (el.textContent = says ? "says no" : "stops saying no"));
    line.textContent = says
      ? "“Sorry, I can’t help with that.” Tap the model on the right to erase the direction."
      : "“Sure, here goes.” Tap the model on the right to put the direction back.";
    targets.forEach((el) => el.setAttribute("aria-pressed", String(!says)));
  };

  let stop = () => {};
  const moveTo = (target: number) => {
    stop();
    if (calm) return set(target);
    const from = level;
    stop = play(700, signal, (t) => set(Math.round(from + (target - from) * t)));
  };

  set(level);
  fig.querySelectorAll("svg").forEach((svg) => svg.setAttribute("role", "group"));
  for (const el of targets) {
    el.tabIndex = 0;
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", "Erase or restore the refusal direction");
    const flip = () => moveTo(level >= 50 ? 0 : 100);
    el.addEventListener("click", flip, { signal });
    el.addEventListener(
      "keydown",
      (e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        flip();
      },
      { signal },
    );
  }
  if (calm) return;
  onView(fig, signal, () => {
    if (level === 100) moveTo(0);
  });
}

function mountNames(fig: HTMLElement, signal: AbortSignal) {
  const line = addLine(fig, "Hover or tap a name for more.");
  const rows = Array.from(fig.querySelectorAll<SVGElement>("[data-row]"));
  const select = (name: string, say: string) => {
    rows.forEach((row) => row.classList.toggle("is-dim", row.dataset.row !== name));
    line.textContent = say;
  };
  fig.querySelectorAll("svg").forEach((svg) => svg.setAttribute("role", "group"));
  for (const row of rows) {
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.setAttribute("aria-label", row.dataset.say ?? "");
    const go = () => select(row.dataset.row ?? "", row.dataset.say ?? "");
    row.addEventListener("pointerenter", go, { signal });
    row.addEventListener("focus", go, { signal });
    row.addEventListener("click", go, { signal });
  }
}

function mountUploads(fig: HTMLElement, signal: AbortSignal, calm: boolean) {
  const groups = Array.from(fig.querySelectorAll<SVGGElement>("[data-bars]"));
  const readouts = fig.querySelectorAll("[data-readout]");
  const first = groups[0];
  if (!first) return;
  const firstBars = Array.from(first.querySelectorAll<SVGElement>("[data-v]"));
  const months = firstBars.map((b) => ({ v: Number(b.dataset.v), label: b.dataset.label ?? "" }));
  const totals: number[] = [];
  months.reduce((sum, m, i) => (totals[i] = sum + m.v), 0);
  const last = months.length - 1;
  const rest = readouts[0]?.textContent ?? "";
  const write = (text: string) => readouts.forEach((el) => (el.textContent = text));
  const sayMonth = (i: number) => `${months[i].label}: ${months[i].v} new, ${totals[i].toLocaleString("en-GB")} so far`;

  const allBars = groups.map((g) => Array.from(g.querySelectorAll<SVGElement>("[data-v]")));
  let stop = () => {};
  const show = (i: number) => {
    allBars.forEach((bars) => bars.forEach((b, j) => b.classList.toggle("is-dim", j !== i)));
    write(sayMonth(i));
  };
  const clear = () => {
    allBars.forEach((bars) => bars.forEach((b) => b.classList.remove("is-dim")));
    write(rest);
  };

  let cursor = last;
  for (const group of groups) {
    const svg = group.ownerSVGElement;
    if (!svg) continue;
    svg.setAttribute("role", "group");
    svg.setAttribute("tabindex", "0");
    svg.removeAttribute("aria-labelledby");
    svg.setAttribute("aria-label", "Monthly uploads. Use the left and right arrow keys to move between months.");
    const left = Number(group.dataset.left);
    const top = Number(group.dataset.top);
    const width = Number(group.dataset.width);
    const height = Number(group.dataset.height);
    const hit = document.createElementNS(SVG_NS, "rect");
    hit.setAttribute("x", String(left));
    hit.setAttribute("y", String(top));
    hit.setAttribute("width", String(width));
    hit.setAttribute("height", String(height));
    hit.setAttribute("fill", "transparent");
    hit.classList.add("fig__hit");
    svg.append(hit);
    const scrub = (e: PointerEvent) => {
      stop();
      const box = hit.getBoundingClientRect();
      const i = Math.floor(((e.clientX - box.left) / box.width) * months.length);
      cursor = Math.max(0, Math.min(last, i));
      show(cursor);
    };
    hit.addEventListener("pointermove", scrub, { signal });
    hit.addEventListener("pointerdown", scrub, { signal });
    // a finger lifting also "leaves", and the reading should stay up after a tap
    hit.addEventListener("pointerleave", (e) => e.pointerType === "mouse" && clear(), { signal });
    svg.addEventListener(
      "keydown",
      (e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        stop();
        cursor = Math.max(0, Math.min(last, cursor + (e.key === "ArrowLeft" ? -1 : 1)));
        show(cursor);
      },
      { signal },
    );
    svg.addEventListener("blur", clear, { signal });
  }

  if (calm) return;
  const reveal = (shown: number) =>
    allBars.forEach((bars) => bars.forEach((b, j) => (b.style.opacity = j <= shown ? "" : "0")));
  const box = fig.getBoundingClientRect();
  if (box.bottom <= 0 || box.top >= innerHeight) reveal(-1);
  onView(fig, signal, () => {
    stop = play(1600, signal, (t) => {
      const i = Math.round(t * last);
      reveal(i);
      if (t < 1) write(sayMonth(i));
      else write(rest);
    });
    const done = stop;
    stop = () => {
      done();
      reveal(last);
    };
  });
}

function mountSafeguards(fig: HTMLElement, signal: AbortSignal, calm: boolean) {
  const line = addLine(fig, "Tap a model to see what surrounds it.");
  const cols = Array.from(fig.querySelectorAll<SVGElement>("[data-col]"));
  const removed = Array.from(fig.querySelectorAll<SVGElement>('[data-solid][opacity="0"]'));
  fig.querySelectorAll("svg").forEach((svg) => svg.setAttribute("role", "group"));

  for (const col of cols) {
    col.tabIndex = 0;
    col.setAttribute("role", "button");
    col.setAttribute("aria-label", col.dataset.say ?? "");
    const go = () => {
      cols.forEach((c) => c.classList.toggle("is-dim", c.dataset.col !== col.dataset.col));
      line.textContent = col.dataset.say ?? "";
    };
    col.addEventListener("pointerenter", go, { signal });
    col.addEventListener("focus", go, { signal });
    col.addEventListener("click", go, { signal });
  }

  if (calm) return;
  const box = fig.getBoundingClientRect();
  if (box.bottom <= 0 || box.top >= innerHeight) removed.forEach((el) => (el.style.opacity = "1"));
  onView(fig, signal, () => {
    const timers = removed.map((el) => {
      const delay = el.dataset.solid === "refusal" ? 1500 : 500;
      return setTimeout(() => el.style.removeProperty("opacity"), delay);
    });
    signal.addEventListener("abort", () => timers.forEach(clearTimeout), { once: true });
  });
}

function init() {
  const root = document.querySelector<HTMLElement>(".note[data-post-figures]");
  if (!root) return;
  const signal = pageSignal();
  if (started === signal || signal.aborted) return;
  started = signal;
  mountFontToggle(root, signal);
  if (typeof IntersectionObserver === "undefined") return;
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // a page restored from the router's store may still carry what the last visit added
  root.querySelectorAll(".fig__live, .fig__hit").forEach((el) => el.remove());
  root.querySelectorAll<HTMLElement>("figure.fig[data-fig]").forEach((fig) => {
    if (fig.dataset.fig === "one-direction") mountDirection(fig, signal, calm);
    if (fig.dataset.fig === "names") mountNames(fig, signal);
    if (fig.dataset.fig === "uploads") mountUploads(fig, signal, calm);
    if (fig.dataset.fig === "safeguards") mountSafeguards(fig, signal, calm);
  });
}

init();
document.addEventListener("astro:page-load", init);
