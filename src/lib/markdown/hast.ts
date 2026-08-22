/**
 * Tiny hast node builders for the satteri markdown plugins.
 *
 * Satteri visitors may RETURN a hast node to replace the visited node, and
 * accept plain hast-shaped objects (the same shape shiki's `codeToHast`
 * returns). `raw` nodes are serialized verbatim into the output HTML, the
 * standard hast escape hatch for injecting pre-built HTML (icons, KaTeX).
 *
 * `@types/hast` supplies the discriminated-union node types; satteri's
 * `HastContent` is exactly hast's `ElementContent` union. Property keys are
 * hast camelCase: `className`, `dataLanguage`, `ariaHidden`, `href`, … Keys
 * named `dataX` serialize to `data-x`.
 */
import type { Element, ElementContent, Properties, Text } from "hast";
// Importing satteri loads its `declare module "hast"` augmentations, which add
// `raw: HastRaw` to hast's content maps - so the `raw` literal returned by
// `rawNode()` is a valid `ElementContent` without naming HastRaw directly.
import "satteri";

export function h(
  tagName: string,
  properties: Properties = {},
  children: ElementContent[] = [],
): Element {
  return { type: "element", tagName, properties, children };
}

export function text(value: string): Text {
  return { type: "text", value };
}

export function rawNode(value: string): ElementContent {
  return { type: "raw", value };
}

/** Read an element's class list as a normalised string array.
 *
 *  Satteri exposes two property spellings: pre-conversion mdast to hast nodes use
 *  the hast `className` convention; Shiki-built nodes (rebuilt by the
 *  highlighter) use the HTML `class` convention. We accept either so plugins
 *  don't have to care which phase produced the node. */
export function classes(node: { properties?: Properties | Record<string, unknown> }): string[] {
  const props = (node.properties ?? {}) as Record<string, unknown>;
  const c = props.className ?? props.class;
  if (!c) return [];
  return Array.isArray(c) ? c.map(String) : [String(c)];
}

/** Cheap HTML-escape for text that must render as literal content (diagram
 *  source carried inside a <pre><code> fallback). */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
