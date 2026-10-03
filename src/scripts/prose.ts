/**
 * prose.ts - client behaviour for the long-form reading layer.
 *
 * Wires up every interactive piece the note engine promises:
 *
 *   1. code-figure copy buttons (clipboard + toast + sound, execCommand fallback)
 *   2. Mermaid diagrams: lazy-loaded, theme-aware, cached per theme, re-rendered
 *      on theme toggle, with an expand-to-overlay lightbox and a graceful
 *      keep-the-source fallback on parse failure or no-JS
 *   3. heading-anchor click copies the section URL and shows a toast
 *   4. TOC scroll-spy maps IntersectionObserver state to aria-current
 *   5. reading-progress hairline (rAF scroll listener)
 *
 * Everything is idempotent and re-runs on `astro:page-load` so view transitions
 * are safe. Reduced motion is respected (no animated transitions, the progress
 * bar is hidden by CSS). No-JS: the page still reads - diagrams show their
 * source, no dead buttons are rendered.
 */
import { showToast } from "./toast";
import { playAccent, isSoundEnabled } from "./sound";
import { pageSignal, onPageCleanup } from "./lifecycle";
import { invalidateScrollMetrics, onScrollFrame } from "./scroll-scheduler";
import { copyToClipboard } from "./clipboard";
import { mermaidFallbacks, STEEL_9 } from "../lib/theme";
import { iconMarkup } from "../lib/ui-icons";
import { track, trackCopy } from "./telemetry";

/* ------------------------------------------------------------------ */
/*  code-figure copy                                                   */
/* ------------------------------------------------------------------ */

const COPY_ICON = iconMarkup("copy", { size: 13, strokeWidth: 1.8 });
const DONE_ICON = iconMarkup("check", { size: 13, strokeWidth: 2.2 });

function initCodeCopy(signal: AbortSignal) {
  document.querySelectorAll<HTMLElement>(".prose .code-figure").forEach((fig) => {
    if (fig.querySelector(".code-actions")) return;
    const pre = fig.querySelector("pre");
    if (!pre) return;

    const toolbar = document.createElement("div");
    toolbar.className = "code-actions";

    // Copy button
    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "code-btn code-copy";
    copyBtn.title = "Copy code";
    copyBtn.setAttribute("aria-label", "Copy code");
    copyBtn.innerHTML = COPY_ICON;
    let resetTimer = 0;

    copyBtn.addEventListener(
      "click",
      async () => {
        const text = pre.innerText.replace(/\n$/, "");
        const ok = await copyToClipboard(text, signal);
        if (signal.aborted || !copyBtn.isConnected) return;
        if (ok) {
          copyBtn.classList.add("is-done");
          copyBtn.innerHTML = DONE_ICON;
          if (isSoundEnabled()) playAccent("copy");
          trackCopy("code");
          showToast({ message: "Copied to clipboard", anchor: copyBtn, duration: 1600 });
          window.clearTimeout(resetTimer);
          resetTimer = window.setTimeout(() => {
            copyBtn.classList.remove("is-done");
            copyBtn.innerHTML = COPY_ICON;
          }, 1400);
        } else {
          showToast({ message: "Copy failed", anchor: copyBtn, duration: 2600 });
        }
      },
      { signal },
    );

    toolbar.appendChild(copyBtn);
    fig.appendChild(toolbar);
    onPageCleanup(() => {
      window.clearTimeout(resetTimer);
      toolbar.remove();
    }, signal);
  });
}

/* ------------------------------------------------------------------ */
/*  heading anchors                                                    */
/* ------------------------------------------------------------------ */

function initHeadingAnchors(signal: AbortSignal) {
  document.querySelectorAll<HTMLElement>(".prose .h-anchor").forEach((a) => {
    if (a.dataset.enhanced) return;
    a.dataset.enhanced = "true";
    signal.addEventListener("abort", () => delete a.dataset.enhanced, { once: true });
    a.addEventListener(
      "click",
      async () => {
        // let the default hash navigation happen, but also copy the link
        const href = a.getAttribute("href") ?? "";
        const url = location.origin + location.pathname + href;
        const ok = await copyToClipboard(url, signal);
        if (signal.aborted || !a.isConnected) return;
        if (ok) {
          if (isSoundEnabled()) playAccent("copy");
          trackCopy("heading_anchor");
          showToast({ message: "Section link copied", duration: 1600 });
        }
      },
      { signal },
    );
  });
}

/* ------------------------------------------------------------------ */
/*  Copy page link                                                     */
/* ------------------------------------------------------------------ */

function initCopyLink(signal: AbortSignal) {
  document.querySelectorAll<HTMLButtonElement>("[data-copy-link]").forEach((btn) => {
    if (btn.dataset.enhanced === "true") return;
    btn.dataset.enhanced = "true";
    signal.addEventListener("abort", () => delete btn.dataset.enhanced, { once: true });
    btn.addEventListener(
      "click",
      async () => {
        const url = location.href.split("#")[0];
        const ok = await copyToClipboard(url, signal);
        if (signal.aborted || !btn.isConnected) return;
        if (ok) {
          if (isSoundEnabled()) playAccent("copy");
          trackCopy("page_link");
          showToast({ message: "Link copied", anchor: btn, duration: 1600 });
        } else {
          showToast({ message: "Copy failed", anchor: btn, duration: 2600 });
        }
      },
      { signal },
    );
  });
}

/* ------------------------------------------------------------------ */
/*  Footnote previews                                                  */
/* ------------------------------------------------------------------ */

function initFootnotePreviews(signal: AbortSignal) {
  const prose = document.querySelector<HTMLElement>(".prose");
  if (!prose) return;

  const refs = Array.from(
    prose.querySelectorAll<HTMLAnchorElement>("a.footnote-ref, sup a[href^='#']"),
  ).filter((a) => {
    const href = a.getAttribute("href") ?? "";
    return href.includes("fn") || a.classList.contains("footnote-ref");
  });
  if (!refs.length) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let card: HTMLElement | null = null;
  let openFor: HTMLElement | null = null;
  let hideTimer = 0;
  let sizeDirty = true;
  let cardSize = { width: 0, height: 0 };
  let pendingPosition: { left: number; top: number } | null = null;
  let sizeObserver: ResizeObserver | null = null;

  onPageCleanup(() => {
    window.clearTimeout(hideTimer);
    sizeObserver?.disconnect();
    if (openFor) openFor.removeAttribute("aria-describedby");
    card?.remove();
    card = null;
    openFor = null;
    pendingPosition = null;
    refs.forEach((ref) => delete ref.dataset.fnPreview);
  }, signal);

  const ensureCard = () => {
    if (card) return card;
    card = document.createElement("div");
    card.id = "fn-preview-tooltip";
    card.className = "fn-preview";
    card.setAttribute("role", "tooltip");
    card.hidden = true;
    card.style.position = "fixed";
    document.body.appendChild(card);
    if ("ResizeObserver" in window) {
      sizeObserver = new ResizeObserver(() => {
        sizeDirty = true;
        invalidateScrollMetrics();
      });
      sizeObserver.observe(card);
    }
    return card;
  };

  const hide = () => {
    window.clearTimeout(hideTimer);
    if (openFor) {
      openFor.removeAttribute("aria-describedby");
      openFor = null;
    }
    if (!card) return;
    pendingPosition = null;
    card.hidden = true;
    card.innerHTML = "";
  };

  const measurePosition = () => {
    pendingPosition = null;
    if (!card || card.hidden || !openFor?.isConnected || signal.aborted) return;
    const gap = 8;
    const rect = openFor.getBoundingClientRect();
    if (sizeDirty) {
      const box = card.getBoundingClientRect();
      cardSize = { width: box.width, height: box.height };
      sizeDirty = false;
    }
    const box = cardSize;
    let left = rect.left + rect.width / 2 - box.width / 2;
    let top = rect.bottom + gap;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    left = Math.max(8, Math.min(left, vw - box.width - 8));
    if (top + box.height > vh - 8) {
      top = rect.top - box.height - gap;
    }
    top = Math.max(8, top);
    pendingPosition = { left: Math.round(left), top: Math.round(top) };
  };

  const applyPosition = () => {
    if (!card || !pendingPosition || signal.aborted) return;
    card.style.left = `${pendingPosition.left}px`;
    card.style.top = `${pendingPosition.top}px`;
    card.style.visibility = "";
  };

  const show = (anchor: HTMLElement) => {
    if (signal.aborted || !anchor.isConnected) return;
    const href = anchor.getAttribute("href") ?? "";
    const id = href.replace(/^#/, "");
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;

    window.clearTimeout(hideTimer);
    if (openFor && openFor !== anchor) {
      openFor.removeAttribute("aria-describedby");
    }
    const el = ensureCard();
    const clone = target.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(".footnote-backref").forEach((n) => n.remove());
    el.innerHTML = clone.innerHTML;
    el.hidden = false;
    el.style.left = "0";
    el.style.top = "0";
    el.style.visibility = "hidden";
    sizeDirty = true;
    openFor = anchor;
    anchor.setAttribute("aria-describedby", "fn-preview-tooltip");
    measurePosition();
    applyPosition();
  };

  const scheduleHide = () => {
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(hide, reduce ? 0 : 120);
  };

  refs.forEach((ref) => {
    if (ref.dataset.fnPreview === "true") return;
    ref.dataset.fnPreview = "true";

    ref.addEventListener(
      "pointerenter",
      () => {
        if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) show(ref);
      },
      { signal },
    );
    ref.addEventListener("pointerleave", scheduleHide, { signal });
    ref.addEventListener(
      "focus",
      () => {
        show(ref);
      },
      { signal },
    );
    ref.addEventListener("blur", scheduleHide, { signal });

    // touch-tap: first tap previews (prevent jump); second tap follows
    ref.addEventListener(
      "click",
      (e) => {
        if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
        if (openFor === ref && card && !card.hidden) return; // allow navigation
        e.preventDefault();
        show(ref);
      },
      { signal },
    );
  });

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" && card && !card.hidden) {
        e.preventDefault();
        hide();
      }
    },
    { signal },
  );

  document.addEventListener(
    "pointerdown",
    (e) => {
      if (!card || card.hidden) return;
      const t = e.target as Node | null;
      if (card.contains(t) || (openFor && openFor.contains(t as Node))) return;
      hide();
    },
    { signal },
  );

  onScrollFrame(applyPosition, signal, measurePosition);
}

/* ------------------------------------------------------------------ */
/*  reading progress                                                   */
/* ------------------------------------------------------------------ */

function initProgress(signal: AbortSignal) {
  const article = document.querySelector<HTMLElement>(".note[data-note]");
  const bar = document.querySelector<HTMLElement>(".note-progress-bar");
  if (!article || !bar) return;

  /* Scroll-driven animations run this off the compositor (see Note.astro).
     When they are available there is nothing for the main thread to do,
     and binding a handler anyway would fight the CSS animation for
     control of the same transform. */
  if (CSS.supports("animation-timeline", "view()")) return;

  let progress = 0;
  onScrollFrame(() => {
    bar.style.transform = `scaleX(${progress})`;
  }, signal, ({ viewport }) => {
    const rect = article.getBoundingClientRect();
    const total = rect.height - viewport;
    const scrolled = Math.min(Math.max(-rect.top, 0), Math.max(total, 1));
    progress = total > 0 ? scrolled / total : 0;
  });
}

/* ------------------------------------------------------------------ */
/*  Mermaid diagrams                                                   */
/* ------------------------------------------------------------------ */

let mermaidLoader: Promise<typeof import("mermaid").default> | null = null;

function loadMermaid(): Promise<typeof import("mermaid").default> {
  if (!mermaidLoader) {
    mermaidLoader = import("mermaid").then((m) => m.default).catch((error: unknown) => {
      mermaidLoader = null;
      throw error;
    });
  }
  return mermaidLoader;
}

/** Resolve any CSS color (OKLCH, hex, named, color()) to `rgb(r, g, b)`.
 *  Mermaid's colour library can't parse OKLCH. Modern Chromium serializes
 *  getComputedStyle().color as oklch(...), so we paint into a 1×1 canvas and
 *  read sRGB bytes - format-agnostic and stable across browsers. */
let probeCanvas: HTMLCanvasElement | null = null;
let probeCtx: CanvasRenderingContext2D | null = null;
function toRgb(token: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(token).trim();
  if (!value) return fallback;
  if (!probeCanvas) {
    probeCanvas = document.createElement("canvas");
    probeCanvas.width = 1;
    probeCanvas.height = 1;
    probeCtx = probeCanvas.getContext("2d", { willReadFrequently: true });
  }
  if (!probeCtx) return fallback;
  probeCtx.clearRect(0, 0, 1, 1);
  probeCtx.fillStyle = STEEL_9;
  probeCtx.fillStyle = value;
  probeCtx.fillRect(0, 0, 1, 1);
  const [r, g, b] = probeCtx.getImageData(0, 0, 1, 1).data;
  return `rgb(${r}, ${g}, ${b})`;
}

function readThemeVars(theme: string): Record<string, string> {
  const fb = mermaidFallbacks(theme === "dark" ? "dark" : "light");
  const canvas = toRgb("--canvas", fb.canvas);
  const ink = toRgb("--ink", fb.ink);
  const muted = toRgb("--muted", fb.muted);
  const rule = toRgb("--rule", fb.rule);
  const ruleStrong = toRgb("--rule-strong", fb.ruleStrong);
  return {
    fontFamily: '"Inter Variable", system-ui, -apple-system, sans-serif',
    fontSize: "13px",
    background: canvas,
    primaryColor: canvas,
    primaryTextColor: ink,
    primaryBorderColor: ruleStrong,
    lineColor: muted,
    secondaryColor: rule,
    tertiaryColor: canvas,
    textColor: ink,
    nodeBkg: canvas,
    nodeBorder: ruleStrong,
    clusterBkg: rule,
    clusterBorder: ruleStrong,
    edgeLabelBackground: canvas,
    actorBkg: canvas,
    actorBorder: ruleStrong,
    actorTextColor: ink,
    actorLineColor: muted,
    signalColor: muted,
    signalTextColor: ink,
    labelBoxBkgColor: canvas,
    labelBoxBorderColor: ruleStrong,
    labelTextColor: ink,
    loopTextColor: ink,
    noteBkgColor: rule,
    noteBorderColor: ruleStrong,
    noteTextColor: ink,
    activationBorderColor: ruleStrong,
    activationBkgColor: rule,
    sequenceNumberColor: canvas,
    git0: toRgb("--acc-blue", "#2563eb"),
    git1: toRgb("--acc-violet", "#7c3aed"),
    git2: toRgb("--acc-green", "#16a34a"),
    git3: toRgb("--acc-amber", "#ea580c"),
    gitBranchLabel0: canvas,
    gitBranchLabel1: canvas,
    gitBranchLabel2: canvas,
    gitBranchLabel3: canvas,
    commitLabelColor: ink,
    commitLabelBackground: canvas,
  };
}

let initTheme = "";
let mermaidWork: Promise<void> = Promise.resolve();

async function ensureMermaidReady(theme: string, current: () => boolean) {
  const mermaid = await loadMermaid();
  if (!current()) return null;
  if (initTheme !== theme) {
    try {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "loose",
        suppressErrorRendering: true,
        theme: "base",
        themeVariables: readThemeVars(theme),
        flowchart: { useMaxWidth: true, htmlLabels: true, curve: "basis" },
        sequence: { useMaxWidth: true, actorMargin: 50, boxMargin: 10 },
        gantt: { useMaxWidth: true },
        journey: { useMaxWidth: true },
        gitGraph: { useMaxWidth: true },
      });
      initTheme = theme;
    } catch (err) {
      initTheme = "";
      throw err;
    }
  }
  return mermaid;
}

function markDiagramError(fig: HTMLElement) {
  fig.classList.add("is-enhanced", "has-error");
  fig.classList.remove("is-rendered");
  if (!fig.querySelector(".diagram-error")) {
    const note = document.createElement("p");
    note.className = "diagram-error";
    note.textContent = "Diagram couldn't be rendered. The source is shown above.";
    fig.appendChild(note);
  }
}

const svgCache = new WeakMap<HTMLElement, Record<string, string>>();
let mermaidId = 0;

function renderDiagram(fig: HTMLElement, theme: string, signal: AbortSignal, latest: () => boolean): Promise<void> {
  const sourceEl = fig.querySelector<HTMLElement>(".diagram-source");
  const canvas = fig.querySelector<HTMLElement>(".diagram-canvas");
  if (!sourceEl || !canvas) return Promise.resolve();
  const source = sourceEl.textContent ?? "";
  const current = () => !signal.aborted && fig.isConnected && latest();
  const commit = (svg: string) => {
    if (!current()) return;
    canvas.innerHTML = svg;
    fig.classList.add("is-enhanced", "is-rendered");
    fig.classList.remove("has-error");
    addExpandButton(fig, signal);
  };

  // Mermaid owns global configuration and temporary DOM. Keep initialize
  // and render in the same serial job across pages and theme changes.
  const job = mermaidWork.then(async () => {
    if (!current()) return;
    const cache = svgCache.get(fig) ?? {};
    if (cache[theme]) {
      commit(cache[theme]);
      return;
    }
    let id = "";
    try {
      const mermaid = await ensureMermaidReady(theme, current);
      if (!mermaid || !current()) return;
      id = `mmd-${++mermaidId}`;
      const { svg } = await mermaid.render(id, source);
      if (!current()) return;
      document.getElementById(`d${id}`)?.remove();
      document.getElementById(id)?.remove();
      id = "";
      cache[theme] = svg;
      svgCache.set(fig, cache);
      commit(svg);
    } catch {
      if (current()) markDiagramError(fig);
    } finally {
      if (id) {
        document.getElementById(`d${id}`)?.remove();
        document.getElementById(id)?.remove();
      }
    }
  });
  mermaidWork = job.catch(() => undefined);
  return mermaidWork;
}

function addExpandButton(fig: HTMLElement, signal: AbortSignal) {
  if (fig.querySelector(".diagram-toolbar")) return;
  const toolbar = document.createElement("div");
  toolbar.className = "diagram-toolbar";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "diagram-expand";
  btn.setAttribute("aria-label", "Expand diagram");
  btn.innerHTML = iconMarkup("expand", { size: 15, strokeWidth: 1.8 });
  btn.addEventListener("click", () => openOverlay(fig, signal), { signal });
  toolbar.appendChild(btn);
  fig.appendChild(toolbar);
  onPageCleanup(() => toolbar.remove(), signal);
}

/* --- expand overlay (lightbox) --- */

let overlay: HTMLElement | null = null;
let overlayPrevFocus: HTMLElement | null = null;
let overlayBody: HTMLElement | null = null;
let overlayOverflow = "";

function closeOverlay(restoreFocus = true) {
  if (!overlay) return;
  overlay.remove();
  overlay = null;
  document.removeEventListener("keydown", onOverlayKey);
  if (restoreFocus && overlayPrevFocus?.isConnected) overlayPrevFocus.focus();
  overlayPrevFocus = null;
  if (overlayBody) overlayBody.style.overflow = overlayOverflow;
  overlayBody = null;
}

function onOverlayKey(e: KeyboardEvent) {
  if (e.key === "Escape") {
    e.preventDefault();
    closeOverlay();
  }
}

function openOverlay(fig: HTMLElement, signal: AbortSignal) {
  if (signal.aborted || !fig.isConnected) return;
  closeOverlay();
  track({ type: "palette", target: "diagram:expand" });
  const svg = fig.querySelector<HTMLElement>(".diagram-canvas svg")?.cloneNode(true) as HTMLElement | null;
  if (!svg) return;
  overlayPrevFocus = document.activeElement as HTMLElement | null;

  const ov = document.createElement("div");
  ov.className = "diagram-overlay";
  ov.setAttribute("role", "dialog");
  ov.setAttribute("aria-modal", "true");
  ov.setAttribute("aria-label", "Expanded diagram");

  const stage = document.createElement("div");
  stage.className = "diagram-overlay-stage";
  stage.appendChild(svg);

  const close = document.createElement("button");
  close.type = "button";
  close.className = "diagram-overlay-close";
  close.setAttribute("aria-label", "Close");
  close.innerHTML = iconMarkup("close", { size: 16, strokeWidth: 2 });
  close.addEventListener("click", () => closeOverlay(), { signal });

  stage.appendChild(close);
  ov.appendChild(stage);

  ov.addEventListener(
    "click",
    (e) => {
      if (e.target === ov) closeOverlay();
    },
    { signal },
  );

  document.body.appendChild(ov);
  overlayBody = document.body;
  overlayOverflow = overlayBody.style.overflow;
  document.body.style.overflow = "hidden";
  document.addEventListener("keydown", onOverlayKey, { signal });
  onPageCleanup(() => {
    if (overlay === ov) closeOverlay(false);
  }, signal);
  overlay = ov;
  close.focus();
}

function initDiagrams(signal: AbortSignal) {
  const diagrams = Array.from(document.querySelectorAll<HTMLElement>(".prose .diagram[data-diagram]"));
  if (diagrams.length === 0) return;

  const root = document.documentElement;
  const readTheme = () => root.dataset.theme === "dark" ? "dark" : "light";
  let desiredTheme = readTheme();
  let revision = 0;
  let rendering = false;

  const renderLatest = async () => {
    if (rendering || signal.aborted) return;
    rendering = true;
    try {
      let completedRevision = -1;
      while (!signal.aborted && completedRevision !== revision) {
        const requestedRevision = revision;
        const theme = desiredTheme;
        const latest = () => requestedRevision === revision && theme === readTheme();
        for (const fig of diagrams) {
          if (signal.aborted || !latest()) break;
          await renderDiagram(fig, theme, signal, latest);
          if (signal.aborted || !latest()) break;
        }
        completedRevision = requestedRevision;
      }
    } finally {
      rendering = false;
    }
  };

  const obs = new MutationObserver(() => {
    const next = readTheme();
    if (signal.aborted || next === desiredTheme) return;
    desiredTheme = next;
    revision += 1;
    void renderLatest();
  });
  onPageCleanup(() => {
    revision += 1;
    obs.disconnect();
  }, signal);
  obs.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  void renderLatest();
}

function initNotePagerKeys(signal: AbortSignal) {
  if (!document.querySelector(".note[data-note]")) return;
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "[" && e.key !== "]") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (e.target as HTMLElement)?.isContentEditable
      )
        return;
      if (document.documentElement.dataset.palette === "open") return;
      const dir = e.key === "[" ? "prev" : "next";
      const link = document.querySelector<HTMLAnchorElement>(`a[data-note-nav="${dir}"]`);
      if (!link) return;
      e.preventDefault();
      playAccent("tap");
      link.click();
    },
    { signal },
  );
}

/* ------------------------------------------------------------------ */
/*  init                                                               */
/* ------------------------------------------------------------------ */

let initializedSignal: AbortSignal | null = null;

function init() {
  if (!document.querySelector(".prose, .note[data-note], [data-copy-link]")) return;
  const signal = pageSignal();
  if (initializedSignal === signal || signal.aborted) return;
  initializedSignal = signal;
  initCodeCopy(signal);
  initHeadingAnchors(signal);
  initCopyLink(signal);
  initFootnotePreviews(signal);
  initProgress(signal);
  initDiagrams(signal);
  initNotePagerKeys(signal);
}

init();
document.addEventListener("astro:page-load", init);
