import type {
  TransitionBeforePreparationEvent,
  TransitionBeforeSwapEvent,
} from "astro:transitions/client";
import {
  isNavigationItemActive,
  normalizeNavigationPath,
  resolveBackTarget,
} from "../data/navigation";

export type NavigationPhase = "idle" | "preparing" | "entering";

declare global {
  interface Window {
    __siteNavigationShellReady?: boolean;
    __siteIntroAnimated?: boolean;
  }
}

const contentSelector = "[data-route-content]";
let settleFrame = 0;
let navigationEpoch = 0;

function setPhase(phase: NavigationPhase, root: Document = document) {
  const content = root.querySelector<HTMLElement>(contentSelector);
  if (content) content.dataset.navigationPhase = phase;
  if (root === document) document.documentElement.dataset.navigationPhase = phase;
}

export function updateNavigation(pathname = location.pathname, root: Document = document) {
  const backTarget = resolveBackTarget(pathname);
  root.querySelectorAll<HTMLAnchorElement>(".logo-control").forEach((logo) => {
    logo.dataset.state = backTarget.isHome ? "home" : "back";
    logo.href = backTarget.href;
    logo.setAttribute("aria-label", backTarget.label);
  });

  root.querySelectorAll<HTMLElement>(".site-nav, .site-nav-bottom").forEach((navigation) => {
    const links = Array.from(navigation.querySelectorAll<HTMLAnchorElement>("a[href]"));
    let selected = -1;
    links.forEach((link, index) => {
      const active = isNavigationItemActive(pathname, new URL(link.href, location.href).pathname);
      if (active) selected = index;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    navigation.toggleAttribute("data-no-active", selected < 0);
    navigation.dataset.activeIndex = String(Math.max(0, selected));
  });
}

function settleIncoming() {
  cancelAnimationFrame(settleFrame);
  const content = document.querySelector<HTMLElement>(contentSelector);
  if (!content) {
    document.documentElement.dataset.navigationPhase = "idle";
    return;
  }
  settleFrame = requestAnimationFrame(() => {
    settleFrame = requestAnimationFrame(() => setPhase("idle"));
  });
}

function handleNavigationPress(event: MouseEvent) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    !(event.target instanceof Element)
  ) return;

  const link = event.target.closest<HTMLAnchorElement>(".site-nav a[href], .site-nav-bottom a[href], .logo-control[href]");
  if (!link) return;
  const target = new URL(link.href, location.href);
  if (target.origin !== location.origin) return;

  const isSamePath = normalizeNavigationPath(target.pathname) === normalizeNavigationPath(location.pathname);
  if (isSamePath) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const isLogo = link.classList.contains("logo-control");
    const isHomePage = normalizeNavigationPath(location.pathname) === "/";
    if (isHomePage && isLogo) {
      return;
    }

    window.scrollTo({
      top: 0,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
    return;
  }

  updateNavigation(target.pathname);
}

function handleBeforePreparation(event: Event) {
  const navigation = event as TransitionBeforePreparationEvent;
  if (normalizeNavigationPath(navigation.to.pathname) === normalizeNavigationPath(navigation.from.pathname)) {
    const isMobile = window.matchMedia("(max-width: 38rem)").matches;
    if (!isMobile) {
      navigation.preventDefault();
      return;
    }
  }
  const epoch = ++navigationEpoch;
  setPhase("preparing");
  updateNavigation(navigation.to.pathname);
  navigation.signal.addEventListener("abort", () => {
    requestAnimationFrame(() => {
      if (epoch !== navigationEpoch) return;
      setPhase("idle");
      updateNavigation(location.pathname);
    });
  }, { once: true });
}

function handleBeforeSwap(event: Event) {
  const navigation = event as TransitionBeforeSwapEvent;
  // The transition is deliberately NOT skipped. The browser has already
  // captured both documents by this point; skipping threw that capture
  // away and the effect had to be re-created by blurring live DOM. The
  // route blur now runs on the snapshot layers instead (motion.css),
  // which is the same look for a fraction of the cost.
  setPhase("entering", navigation.newDocument);
  try {
    if (
      window.__siteIntroAnimated ||
      sessionStorage.getItem("intro-animated") === "true" ||
      document.documentElement.dataset.introAnimated === "true"
    ) {
      navigation.newDocument.documentElement.dataset.introAnimated = "true";
      document.documentElement.dataset.introAnimated = "true";
    }
  } catch {}
  updateNavigation(navigation.to.pathname, navigation.newDocument);
  updateNavigation(navigation.to.pathname, document);
}

function handleAfterSwap() {
  navigationEpoch += 1;
  try {
    if (
      window.__siteIntroAnimated ||
      sessionStorage.getItem("intro-animated") === "true"
    ) {
      document.documentElement.dataset.introAnimated = "true";
    }
  } catch {}
  updateNavigation(location.pathname, document);
  settleIncoming();
}

function initNavigationShell() {
  updateNavigation(location.pathname);
  if (window.__siteNavigationShellReady) return;
  window.__siteNavigationShellReady = true;
  document.addEventListener("click", handleNavigationPress, { capture: true });
  document.addEventListener("astro:before-preparation", handleBeforePreparation);
  document.addEventListener("astro:before-swap", handleBeforeSwap);
  document.addEventListener("astro:after-swap", handleAfterSwap);
  document.addEventListener("astro:page-load", handleAfterSwap);
}

initNavigationShell();
