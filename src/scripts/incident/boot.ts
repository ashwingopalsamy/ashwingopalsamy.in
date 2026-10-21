/**
 * boot - plays the eMudhra post's figures and labels its tables.
 *
 * Tables: every td gets data-label from its header, status words get data-tone and the
 * mono / numeric columns data-fmt, for incident.css (a stacked layout on phones, a dot beside
 * each status word). Without this the tables are plain and complete.
 *
 * Each figure.fig plays once when it comes within 200px of the viewport; the figure's own CSS
 * does the animating, keyed on [data-armed][data-play]. Arming hides the parts, so a figure that
 * is already on screen when the page loads keeps its final state. A tap, click, or Enter / Space
 * on the focused figure replays it. Reduced motion leaves every figure on its final frame.
 * d4-keyspace also loads ./keyspace, which runs the key search. Runs on astro:page-load, ends
 * with the page signal, and imports nothing but lifecycle so the incident JSON stays out of it.
 */

import { pageSignal } from "../lifecycle";

let started: AbortSignal | null = null;

const TONE: Record<string, string> = {
  fixed: "ok",
  patched: "ok",
  covered: "ok",
  vulnerable: "bad",
  check: "warn",
  pending: "warn",
  unsupported: "mute",
  "unsupported, no fix": "mute",
  "no fix": "mute",
  "not hacked": "mute",
};
const YES_NO: Record<string, string> = { no: "ok", yes: "bad" };
const FMT: Record<string, string> = {
  year: "mono",
  utc: "mono",
  "t+": "mono",
  "date (utc)": "mono",
  "secret key": "num",
  d: "num",
  "patched version": "ver",
};

const text = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim();

function label(t: HTMLTableElement) {
  const heads = Array.from(t.tHead?.rows[0]?.cells ?? []);
  const rows = Array.from(t.tBodies).flatMap((b) => Array.from(b.rows));
  heads.forEach((th, i) => {
    const name = text(th).toLowerCase();
    const fmt = FMT[name];
    if (fmt) th.dataset.fmt = fmt;
    for (const row of rows) {
      const td = row.cells[i];
      if (!td) continue;
      td.dataset.label = text(th);
      if (fmt) td.dataset.fmt = fmt;
      const word = text(td).toLowerCase();
      const tone = name === "status" ? TONE[word] : name === "affected?" ? (YES_NO[word] ?? TONE[word]) : undefined;
      if (tone) td.dataset.tone = tone;
    }
  });
  if (heads.length) t.dataset.labeled = "";
}

function mount(fig: HTMLElement, signal: AbortSignal, calm: boolean) {
  if (!calm) {
    const r = fig.getBoundingClientRect();
    if (r.bottom <= 0 || r.top >= innerHeight) fig.dataset.armed = "";
  }

  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      if (!calm) fig.dataset.play = "";
      if (fig.dataset.fig !== "d4-keyspace") return;
      import("./keyspace")
        .then((m) => (signal.aborted ? undefined : m.mount(fig, { signal })))
        .catch(() => {
          /* the static figure stays complete */
        });
    },
    { rootMargin: "200px 0px" },
  );
  io.observe(fig);
  signal.addEventListener("abort", () => io.disconnect(), { once: true });
  if (calm) return;

  // Two frames: the hidden state has to be painted once, or the animation never restarts.
  let raf = 0;
  const replay = () => {
    cancelAnimationFrame(raf);
    fig.dataset.armed = "";
    delete fig.dataset.play;
    raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        fig.dataset.play = "";
        fig.dispatchEvent(new Event("fig:replay"));
      });
    });
  };
  fig.tabIndex = 0;
  fig.addEventListener(
    "click",
    (e) => {
      if ((e.target as Element).closest("a, button, summary") || getSelection()?.toString()) return;
      replay();
    },
    { signal },
  );
  fig.addEventListener(
    "keydown",
    (e) => {
      if (e.target !== fig || (e.key !== "Enter" && e.key !== " ")) return;
      e.preventDefault();
      replay();
    },
    { signal },
  );
  signal.addEventListener("abort", () => cancelAnimationFrame(raf), { once: true });
}

function init() {
  const root = document.querySelector(".note[data-incident]");
  if (!root) return;
  const signal = pageSignal();
  if (started === signal || signal.aborted) return;
  started = signal;
  root.querySelectorAll("table").forEach(label);
  const figs = root.querySelectorAll<HTMLElement>("figure.fig");
  if (!figs.length || typeof IntersectionObserver === "undefined") return;
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
  figs.forEach((fig) => mount(fig, signal, calm));
}

init();
document.addEventListener("astro:page-load", init);
