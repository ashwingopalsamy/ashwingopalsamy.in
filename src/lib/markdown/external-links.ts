/**
 * external-links - harden and mark off-site links.
 *
 * Adds `target="_blank"` + `rel="noopener noreferrer"` (security), an
 * `external` class, and a trailing registry `arrow-up-right` in an
 * `.external-icon` span, so readers know they're leaving the site. prose.css
 * sizes it (0.72em), hides it at rest with no space, and eases it in when the
 * block or the link is under a fine pointer; the link itself is ink, never an
 * underline or a wash. Same-origin links (pages, `.md` and other files,
 * `#anchors`) are left alone and carry no glyph.
 */
import type { Element } from "hast";
import type { HastVisitorContext } from "satteri";
import { iconMarkup } from "../ui-icons";
import { h, rawNode } from "./hast";

const SITE_HOSTS = new Set(["ashwingopalsamy.in", "localhost", "127.0.0.1"]);

function isInternalHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (SITE_HOSTS.has(host)) return true;
  if (host.endsWith(".ashwingopalsamy.in")) return true;
  return false;
}

export const externalLinks = {
  name: "external-links",
  element: {
    filter: ["a"],
    visit(node: Element, ctx: HastVisitorContext): void {
      const href = node.properties?.href;
      if (typeof href !== "string") return;
      if (!/^https?:\/\//.test(href)) return; // relative, mailto, tel, #anchor

      try {
        const url = new URL(href);
        if (isInternalHost(url.hostname)) return;
      } catch {
        return;
      }

      ctx.setProperty(node, "target", "_blank");
      ctx.setProperty(node, "rel", "noopener noreferrer");
      const cls = node.properties?.className;
      const arr = Array.isArray(cls) ? cls.map(String) : cls ? [String(cls)] : [];
      if (!arr.includes("external")) arr.push("external");
      ctx.setProperty(node, "className", arr);
      ctx.appendChild(node, h("span", { className: ["external-icon"] }, [
        rawNode(iconMarkup("arrow-up-right", { size: 12, strokeWidth: 2.2 })),
      ]));
    },
  },
};
