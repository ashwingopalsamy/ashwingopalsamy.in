/**
 * floating-toc - universal floating Table of Contents engine.
 *
 * Automatically detects any page with >3 visible content headings (h2/h3) and
 * sufficient scroll room, dynamically mounting the sleek right-side dash rail
 * with gliding tooltips, keyboard navigation, and audio tick feedback.
 */

import { pageSignal } from "./lifecycle";
import { isSoundEnabled, playAccent } from "./sound";

interface HeadingItem {
  id: string;
  title: string;
  depth: number;
  el: HTMLElement;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function cleanHeadingTitle(el: HTMLElement): string {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(".h-anchor, svg, .ui-icon, .visually-hidden, script, style").forEach((node) => node.remove());
  return (clone.textContent || "").trim();
}

function isHeadingVisible(el: HTMLElement): boolean {
  if (el.classList.contains("visually-hidden")) return false;
  if (el.getAttribute("aria-hidden") === "true") return false;
  if (el.closest(".visually-hidden, .palette, .command-palette, [hidden]")) return false;
  const details = el.closest("details");
  if (details && !details.open && !el.closest("summary")) return false;
  return true;
}

function scanContentHeadings(main: HTMLElement): HeadingItem[] {
  const elements = Array.from(main.querySelectorAll<HTMLElement>("h2, h3"));
  const seenIds = new Set<string>();
  const items: HeadingItem[] = [];

  for (const el of elements) {
    if (!isHeadingVisible(el)) continue;

    const title = cleanHeadingTitle(el);
    if (!title) continue;

    let id = el.id || el.dataset.specId;
    if (!id) {
      const baseSlug = slugify(title) || "section";
      id = baseSlug;
      let counter = 2;
      while (seenIds.has(id) || document.getElementById(id)) {
        id = `${baseSlug}-${counter++}`;
      }
      el.id = id;
    }
    seenIds.add(id);

    const depth = el.tagName.toLowerCase() === "h3" ? 3 : 2;
    items.push({ id, title, depth, el });
  }

  return items;
}

function hasScrollRoom(): boolean {
  if (typeof window === "undefined") return false;
  const isDesktop = window.matchMedia("(min-width: 72rem)").matches;
  const hasHeight = document.documentElement.scrollHeight >= window.innerHeight + 200;
  return isDesktop && hasHeight;
}

export function initUniversalFloatingToc() {
  // Clean up any stale floating rail instances
  document.querySelectorAll<HTMLElement>("[data-toc-rail]").forEach((r) => r.remove());

  const main = document.querySelector<HTMLElement>("main#main, main");
  if (!main) return;

  const headings = scanContentHeadings(main);
  if (headings.length < 4) return;

  const signal = pageSignal();

  // Create floating rail container
  const rail = document.createElement("nav");
  rail.className = "note-toc-rail";
  rail.setAttribute("aria-label", "Table of contents");
  rail.setAttribute("data-toc-rail", "");

  const track = document.createElement("div");
  track.className = "note-toc-rail-track";
  track.setAttribute("data-toc-track", "");

  const tooltip = document.createElement("div");
  tooltip.className = "note-toc-tooltip";
  tooltip.setAttribute("data-toc-tooltip", "");
  tooltip.setAttribute("aria-hidden", "true");
  tooltip.textContent = headings[0].title;
  track.appendChild(tooltip);

  const buttons: { id: string; btn: HTMLButtonElement; el: HTMLElement }[] = [];

  headings.forEach((h, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `note-toc-btn${h.depth === 3 ? " is-sub" : ""}${i === 0 ? " is-active" : ""}`;
    btn.setAttribute("data-toc-target", h.id);
    btn.setAttribute("data-toc-depth", String(h.depth));
    btn.setAttribute("data-toc-title", h.title);
    btn.setAttribute("aria-label", `Jump to ${h.title}`);

    const dash = document.createElement("span");
    dash.className = "note-toc-dash";
    btn.appendChild(dash);

    track.appendChild(btn);
    buttons.push({ id: h.id, btn, el: h.el });
  });

  rail.appendChild(track);

  // Mount rail inside main
  main.appendChild(rail);

  const checkVisibility = () => {
    rail.style.display = hasScrollRoom() ? "" : "none";
  };
  checkVisibility();
  window.addEventListener("resize", checkVisibility, { passive: true, signal });

  const narrowLinks = Array.from(
    document.querySelectorAll<HTMLAnchorElement>(".note-toc-narrow a[data-toc-target]"),
  );

  let currentActiveId = headings[0].id;

  const setActive = (id: string) => {
    if (currentActiveId === id) return;
    currentActiveId = id;

    buttons.forEach((b) => {
      const isActive = b.id === id;
      b.btn.classList.toggle("is-active", isActive);
      if (isActive) b.btn.setAttribute("aria-current", "true");
      else b.btn.removeAttribute("aria-current");
    });

    narrowLinks.forEach((link) => {
      const target = link.dataset.tocTarget;
      const isActive = target === id;
      if (isActive) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
  };

  const scrollToTarget = (id: string) => {
    const target = buttons.find((b) => b.id === id);
    if (!target) return;
    setActive(id);
    const headerOffset = 80;
    const y = target.el.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({ top: Math.max(0, y), behavior: "smooth" });
  };

  buttons.forEach(({ btn, id }) => {
    btn.addEventListener(
      "click",
      () => {
        if (isSoundEnabled()) playAccent("tick");
        scrollToTarget(id);
      },
      { signal },
    );

    btn.addEventListener(
      "mouseenter",
      () => {
        const title = btn.dataset.tocTitle || btn.getAttribute("aria-label")?.replace(/^Jump to\s+/, "") || "";
        tooltip.textContent = title;
        const btnTop = btn.offsetTop + btn.offsetHeight / 2;
        tooltip.style.top = `${btnTop}px`;
        track.classList.add("is-hovered");
      },
      { signal },
    );
  });

  track.addEventListener(
    "mouseleave",
    () => {
      track.classList.remove("is-hovered");
    },
    { signal },
  );

  let ticking = false;
  const updateSpy = () => {
    const scrollY = window.scrollY;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = window.innerHeight;

    if (scrollY < 120) {
      setActive(headings[0].id);
      return;
    }

    if (scrollHeight - (scrollY + clientHeight) < 60) {
      setActive(headings[headings.length - 1].id);
      return;
    }

    let activeIdx = 0;
    for (let i = 0; i < buttons.length; i++) {
      const rect = buttons[i].el.getBoundingClientRect();
      if (rect.top <= 240) {
        activeIdx = i;
      }
    }
    setActive(buttons[activeIdx].id);
  };

  const onScroll = () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        updateSpy();
        ticking = false;
      });
      ticking = true;
    }
  };

  window.addEventListener("scroll", onScroll, { passive: true, signal });
  updateSpy();

  document.addEventListener(
    "keydown",
    (e: KeyboardEvent) => {
      if (e.key !== "j" && e.key !== "k") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      if (document.documentElement.dataset.palette === "open") return;

      const currentIdx = Math.max(
        0,
        buttons.findIndex((b) => b.id === currentActiveId),
      );

      if (e.key === "j") {
        const nextIdx = Math.min(buttons.length - 1, currentIdx + 1);
        if (nextIdx !== currentIdx) {
          e.preventDefault();
          if (isSoundEnabled()) playAccent("tick");
          scrollToTarget(buttons[nextIdx].id);
        }
      } else if (e.key === "k") {
        const prevIdx = Math.max(0, currentIdx - 1);
        if (prevIdx !== currentIdx) {
          e.preventDefault();
          if (isSoundEnabled()) playAccent("tick");
          scrollToTarget(buttons[prevIdx].id);
        }
      }
    },
    { signal },
  );
}

if (typeof document !== "undefined") {
  initUniversalFloatingToc();
  document.addEventListener("astro:page-load", initUniversalFloatingToc);
}
