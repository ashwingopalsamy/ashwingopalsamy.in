/**
 * callouts - GitHub-style admonitions, plus a legacy bridge.
 *
 * Syntax (both supported):
 *
 *   > [!warning]
 *   > Never rate-limit at the ingress.
 *
 *   > **Warning:** Set C carefully.        Legacy, still in use.
 *
 * Recognised kinds: note, tip, important, warning, caution. The first form is
 * the GitHub Alerts spec; the second detects a leading bolded label
 * (`**Warning:**`, `**Tip:**`, …) and is kept so existing notes render without
 * an edit. New writing should use the bracket form.
 *
 * The blockquote is restyled in place into a callout: a label row (a small
 * stroked SVG icon + the kind) is prepended, and the marker is stripped from
 * the leading paragraph. The element stays a <blockquote> with role="note" +
 * aria-label, which is accessible and keeps the node identity (satteri's arena
 * stays happy - we only mutate, never rebuild+reparent).
 *
 * A plain blockquote (no marker, no bolded label) is left untouched and styled
 * as a quiet pull-aside by `.prose blockquote`.
 */
import type { Element, ElementContent } from "hast";
import type { HastVisitorContext } from "satteri";
import { h, rawNode, text, classes } from "./hast";
import { iconMarkup, type IconName } from "../ui-icons";

const KINDS = ["note", "tip", "important", "warning", "caution"] as const;
type Kind = (typeof KINDS)[number];
const BRACKET_RE = /^\[!(note|tip|important|warning|caution)\]\s*\n?/i;

// Lucide-derived stroked icons, 24x24 viewBox (MIT). One per kind so a glance
// tells the surface apart; colour comes from the callout's accent token.
const ICONS: Record<Kind, IconName> = {
  note: "info",
  tip: "tip",
  important: "alert",
  warning: "warning",
  caution: "ban",
};

function labelOf(kind: Kind): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function findFirstP(node: Element): Element | undefined {
  return (node.children ?? []).find(
    (c): c is Element => c.type === "element" && c.tagName === "p",
  );
}

export const callouts = {
  name: "callouts",
  element: {
    filter: ["blockquote"],
    visit(node: Element, ctx: HastVisitorContext): void {
      if (classes(node).includes("callout")) return; // idempotent

      const firstP = findFirstP(node);
      if (!firstP?.children?.length) return;

      const t = ctx.textContent(firstP);
      let kind: Kind | undefined;
      let markerLen = 0;
      let stripStrong = false;

      // GitHub bracket form: marker lives at the start of the first text node.
      const bracket = t.match(BRACKET_RE);
      if (bracket) {
        kind = bracket[1].toLowerCase() as Kind;
        markerLen = bracket[0].length;
      } else {
        // Legacy `**Warning:** …` form: first child is a <strong> whose text
        // is one of the kinds (optionally colon-terminated).
        const first = firstP.children[0];
        if (first?.type === "element" && first.tagName === "strong") {
          const st = ctx.textContent(first).trim().toLowerCase();
          const k = KINDS.find((kk) => st === kk || st === kk + ":");
          if (k) {
            kind = k;
            stripStrong = true;
          }
        }
      }

      if (!kind) return;
      const label = labelOf(kind);

      if (stripStrong) {
        // Drop the leading <strong>; trim the leading space off the next text.
        const first = firstP.children[0];
        ctx.replaceNode(first, text(""));
        const second = firstP.children[1];
        if (second?.type === "text" && typeof second.value === "string") {
          ctx.replaceNode(second, text(second.value.replace(/^ +/, "")));
        }
      } else {
        const first = firstP.children[0];
        if (first?.type === "text" && typeof first.value === "string") {
          // Chop the matched bracket marker off the leading text node.
          ctx.replaceNode(first, text(first.value.slice(markerLen)));
        }
      }

      ctx.setProperty(node, "className", ["callout", "callout-" + kind]);
      ctx.setProperty(node, "role", "note");
      ctx.setProperty(node, "ariaLabel", label);
      ctx.setProperty(node, "dataCallout", kind);

      const head: ElementContent = h("p", { className: ["callout-head"] }, [
        h("span", { className: ["callout-icon"] }, [rawNode(iconMarkup(ICONS[kind], { size: 14, strokeWidth: 1.8 }))]),
        h("span", { className: ["callout-label"] }, [text(label)]),
      ]);
      ctx.prependChild(node, head);
    },
  },
};
