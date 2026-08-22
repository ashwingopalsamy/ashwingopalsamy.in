/**
 * math - render LaTeX via KaTeX at build time, at the mdast stage.
 *
 * Satteri's `math` feature (`features: { math: true }`) parses `$...$` (inline)
 * and `$$...$$` (display) into mdast `math` / `inlineMath` nodes. Intercepting
 * them HERE, before the mdast to hast conversion, means Shiki never sees them,
 * so it can't swallow the math block and strip its classes (which happened
 * when math ran at hast: Shiki treated `math-display` as an unknown language,
 * fell back to plaintext, and rebuilt the <pre> without the math-* classes).
 *
 * Output is `rawHtml` (the standard satteri escape hatch), swapped in place of
 * the node. KaTeX renders to HTML + MathML; we wrap it in a semantic container
 * and let `.prose .math-*` in prose.css handle overflow and alignment.
 */
import katex from "katex";

function render(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, {
      displayMode,
      throwOnError: false,
      strict: "ignore",
    });
  } catch {
    // never break a page over a typo - fall back to the raw TeX
    return tex;
  }
}

export const math = {
  name: "math",
  math(node: { value: string }) {
    const tex = (node.value ?? "").trim();
    return { rawHtml: `<div class="math math-display">${render(tex, true)}</div>` };
  },
  inlineMath(node: { value: string }) {
    const tex = (node.value ?? "").trim();
    return { rawHtml: `<span class="math math-inline">${render(tex, false)}</span>` };
  },
};
