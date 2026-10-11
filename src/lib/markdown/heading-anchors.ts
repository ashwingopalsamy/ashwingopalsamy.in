/**
 * heading-anchors - slugged ids + a hover-reveal link glyph.
 *
 * Satteri's built-in heading-ids plugin runs AFTER user hast plugins and
 * reuses an existing `id` (its `existingId` check), so we set the id ourselves
 * with a fresh github-slugger per document and the built-in simply adopts it
 * for the `headings` metadata (used by the TOC). Using the same slugger
 * package keeps our ids byte-identical to the built-in's own scheme.
 *
 * The anchor is an icon-only link: the registry `heading-link` glyph carries
 * no text, so `textContent` (which the TOC and built-in slugger both read)
 * stays clean. prose.css hangs it left of the heading; prose.ts copies the
 * section URL on click and confirms with the "Link copied" toast. Anchors are
 * added to h2 through h6 only; the page H1 is article chrome.
 */
import type { Element } from "hast";
import type { HastVisitorContext } from "satteri";
import Slugger from "github-slugger";
import { iconMarkup } from "../ui-icons";
import { h, rawNode } from "./hast";

export const headingAnchors = () => {
  const slugger = new Slugger();
  return {
    name: "heading-anchors",
    element: {
      filter: ["h2", "h3", "h4", "h5", "h6"],
      visit(node: Element, ctx: HastVisitorContext): void {
        const id = (node.properties?.id as string | undefined) ?? slugger.slug(ctx.textContent(node));
        ctx.setProperty(node, "id", id);
        ctx.appendChild(
          node,
          h("a", { className: ["h-anchor"], href: "#" + id, ariaLabel: "Copy link to this section" }, [
            rawNode(iconMarkup("heading-link", { size: 14, strokeWidth: 2, className: "heading-link-icon" })),
          ]),
        );
      },
    },
  };
};
