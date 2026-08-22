import { site } from "../data/home";
import coreMarkdownMirrors from "../data/core-markdown-mirrors.json";

const FILE_EXT = /\.[a-z0-9]+$/i;
const origin = new URL(site.url).origin;

/** Absolute URL aligned to the site's trailing-slash canonicals.
 *  Same-origin HTML paths get a trailing slash; file-like paths and
 *  off-site URLs are left alone. */
export function absUrl(path = "/"): string {
  if (/^https?:\/\//i.test(path)) {
    const u = new URL(path);
    if (u.origin !== origin) return path;
    if (u.pathname === "/" || FILE_EXT.test(u.pathname)) return u.href;
    u.pathname = u.pathname.replace(/\/?$/, "/");
    return u.href;
  }
  const base = site.url.replace(/\/$/, "");
  let p = path.startsWith("/") ? path : `/${path}`;
  if (p === "/") return `${base}/`;
  if (FILE_EXT.test(p)) return `${base}${p}`;
  return `${base}${p.replace(/\/$/, "")}/`;
}

/** Site-relative path with trailing slash (HTML pages only). */
export function slashPath(path: string): string {
  if (path === "/") return "/";
  if (FILE_EXT.test(path)) return path;
  return `${path.replace(/\/$/, "")}/`;
}

export function coreMarkdownMirrorPath(path: string): string | undefined {
  const normalized = path === "/" ? "/" : `${path.replace(/\/+$/, "")}/`;
  return (coreMarkdownMirrors as Record<string, string>)[normalized];
}
