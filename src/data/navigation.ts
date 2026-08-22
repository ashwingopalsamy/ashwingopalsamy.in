import type { IconName } from "../lib/ui-icons";

export interface SiteNavItem {
  label: "home" | "work" | "ai" | "more" | "links";
  ariaLabel?: string;
  href: string;
  icon: IconName;
}

export function normalizeNavigationPath(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0] || "/";
  if (path === "/") return path;
  return `/${path.replace(/^\/+|\/+$/g, "")}/`;
}

export function isNavigationItemActive(pathname: string, href: string): boolean {
  const current = normalizeNavigationPath(pathname);
  const target = normalizeNavigationPath(href);
  if (target === "/work/" && (current === "/craft/" || current.startsWith("/craft/"))) return true;
  if (target === "/craft/" && (current === "/work/" || current.startsWith("/work/"))) return true;
  return target === "/" ? current === "/" : current.startsWith(target);
}

export function activeNavigationIndex(
  pathname: string,
  items: readonly SiteNavItem[],
): number {
  return items.findIndex((item) => isNavigationItemActive(pathname, item.href));
}

export interface BackTarget {
  isHome: boolean;
  href: string;
  label: string;
}

export function resolveBackTarget(pathname: string): BackTarget {
  const norm = normalizeNavigationPath(pathname);
  if (norm === "/") {
    return {
      isHome: true,
      href: "/",
      label: "Ashwin Gopalsamy, home",
    };
  }

  if (norm.startsWith("/blog/") || norm.startsWith("/library/notes/")) {
    return { isHome: false, href: "/library/", label: "Back to library" };
  }
  if (norm.startsWith("/library/books/")) {
    return { isHome: false, href: "/library/?view=books", label: "Back to library" };
  }
  if (norm.startsWith("/library/watch/")) {
    return { isHome: false, href: "/library/?view=watch", label: "Back to library" };
  }
  if (norm.startsWith("/library/tags/")) {
    return { isHome: false, href: norm === "/library/tags/" ? "/library/" : "/library/tags/", label: "Back to tags" };
  }
  if (norm === "/library/") {
    return { isHome: false, href: "/", label: "Back to home" };
  }

  if (norm.startsWith("/craft/") || norm.startsWith("/work/")) {
    return {
      isHome: false,
      href: norm === "/craft/" || norm === "/work/" ? "/" : "/work/",
      label: norm === "/craft/" || norm === "/work/" ? "Back to home" : "Back to work",
    };
  }

  if (norm.startsWith("/more/")) {
    return { isHome: false, href: norm === "/more/" ? "/" : "/more/", label: norm === "/more/" ? "Back to home" : "Back to more" };
  }

  return {
    isHome: false,
    href: "/",
    label: "Back to home",
  };
}

export const desktopNavigation: readonly SiteNavItem[] = [
  { label: "home", href: "/", icon: "home", ariaLabel: "Home: Ashwin Gopalsamy" },
  { label: "work", href: "/work/", icon: "nav-work", ariaLabel: "Work: engineering projects and craft" },
  { label: "more", href: "/more/", icon: "nav-more", ariaLabel: "More: personal essays, photography, and collections" },
];

export const mobileNavigation: readonly SiteNavItem[] = [
  desktopNavigation[0],
  desktopNavigation[1],
  { label: "ai", href: "/ai/", icon: "nav-ai", ariaLabel: "AI: machine interfaces and tools" },
  desktopNavigation[2],
  { label: "links", href: "/links/", icon: "nav-links", ariaLabel: "Links: contact and profiles" },
];
