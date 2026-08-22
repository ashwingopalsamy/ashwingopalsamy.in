/**
 * code-figures - wrap highlighted code blocks in a labelled "figure".
 *
 * Runs after Shiki (hast plugins run after the highlighter), so fenced code is
 * already `<pre class="astro-code" data-language="go">…`. We wrap it in a
 * `.code-figure` whose `data-language` drives a quiet language label drawn by
 * CSS, and acts as the anchor for the client-injected copy button. Optional
 * `data-title` (from fence meta via shiki transformers) becomes a real caption
 * element. Mermaid and math blocks never reach here.
 */
import type { Element, Properties } from "hast";
import type { HastVisitorContext } from "satteri";
import { classes, h, text } from "./hast";

function langOf(node: Element): string {
  const props = (node.properties ?? {}) as Record<string, unknown>;
  if (typeof props.dataLanguage === "string" && props.dataLanguage) return props.dataLanguage;
  const code = (node.children ?? []).find(
    (c): c is Element => c.type === "element" && c.tagName === "code",
  );
  const fromData = (code?.data as { lang?: string } | undefined)?.lang;
  if (typeof fromData === "string") return fromData;
  for (const c of classes(node)) {
    if (c.startsWith("language-")) return c.slice("language-".length);
  }
  return "";
}

function titleOf(node: Element): string {
  const props = (node.properties ?? {}) as Record<string, unknown>;
  const t = props.dataTitle ?? props["data-title"];
  return typeof t === "string" ? t : "";
}

export const codeFigures = {
  name: "code-figures",
  element: {
    filter: ["pre"],
    visit(node: Element, ctx: HastVisitorContext): void {
      if (classes(node).includes("diagram-source")) return;
      const cls = classes(node).join(" ");
      const lang = langOf(node).toLowerCase();
      if (!/astro-code/.test(cls) && !cls.includes("language-")) return;
      if (lang === "mermaid" || lang === "math" || classes(node).some((c) => c.startsWith("math-"))) return;

      const title = titleOf(node);
      const props: Properties = {
        className: ["code-figure", ...(title ? ["has-title"] : [])],
        dataLanguage: lang || "text",
      };
      if (title) props.dataTitle = title;

      const children = title
        ? [h("div", { className: ["code-caption"] }, [text(title)]), node]
        : [node];

      ctx.replaceNode(node, {
        type: "element",
        tagName: "div",
        properties: props,
        children,
      });
    },
  },
};
