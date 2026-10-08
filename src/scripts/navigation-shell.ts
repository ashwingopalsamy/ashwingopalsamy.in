import {
  isNavigationItemActive,
  normalizeNavigationPath,
  resolveBackTarget,
} from "../data/navigation";

declare global {
  interface Window {
    __siteNavigationShellReady?: boolean;
  }
}

export function updateNavigation(pathname = location.pathname, root: Document = document) {
  const backTarget = resolveBackTarget(pathname);
  root.querySelectorAll<HTMLAnchorElement>(".logo-control").forEach((logo) => {
    const state = backTarget.isHome ? "home" : "back";
    if (logo.dataset.state !== state) logo.dataset.state = state;
    if (logo.getAttribute("href") !== backTarget.href) logo.setAttribute("href", backTarget.href);
    if (logo.getAttribute("aria-label") !== backTarget.label) logo.setAttribute("aria-label", backTarget.label);
  });

  root.querySelectorAll<HTMLElement>(".site-nav, .site-nav-bottom").forEach((navigation) => {
    const links = Array.from(navigation.querySelectorAll<HTMLAnchorElement>("a[href]"));
    let selected = -1;
    links.forEach((link, index) => {
      const active = isNavigationItemActive(pathname, new URL(link.href, location.href).pathname);
      if (active) selected = index;
      if (link.classList.contains("active") !== active) link.classList.toggle("active", active);
      if (active) {
        if (link.getAttribute("aria-current") !== "page") link.setAttribute("aria-current", "page");
      } else if (link.hasAttribute("aria-current")) link.removeAttribute("aria-current");
    });
    const noActive = selected < 0;
    if (navigation.hasAttribute("data-no-active") !== noActive) navigation.toggleAttribute("data-no-active", noActive);
    const activeIndex = String(Math.max(0, selected));
    if (navigation.dataset.activeIndex !== activeIndex) navigation.dataset.activeIndex = activeIndex;
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
  if (!link || link.hasAttribute("download") || link.dataset.astroReload !== undefined ||
    (link.target && link.target !== "_self")) return;
  const target = new URL(link.href, location.href);
  if (target.origin !== location.origin) return;

  const isSameDestination = normalizeNavigationPath(target.pathname) === normalizeNavigationPath(location.pathname) &&
    target.search === location.search && target.hash === location.hash;
  if (isSameDestination && !target.hash) {
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
}

function initNavigationShell() {
  updateNavigation(location.pathname);
  if (window.__siteNavigationShellReady) return;
  window.__siteNavigationShellReady = true;
  document.addEventListener("click", handleNavigationPress, { capture: true });
}

initNavigationShell();
