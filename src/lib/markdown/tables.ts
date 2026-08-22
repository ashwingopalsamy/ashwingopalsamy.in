/**
 * tables - wrap GFM tables in a horizontal-scroll container.
 *
 * Wide tables (the runes note has a four-row reference table) overflow the
 * 640px column on phones. A `.table-scroll` wrapper lets them scroll without
 * breaking the document, and lets CSS give the table booktabs styling.
 */
import type { Element } from "hast";
import type { HastVisitorContext } from "satteri";

export const tables = {
  name: "tables",
  element: {
    filter: ["table"],
    visit(node: Element, ctx: HastVisitorContext): void {
      ctx.wrapNode(node, {
        type: "element",
        tagName: "div",
        properties: { className: ["table-scroll"] },
        children: [],
      });
    },
  },
};