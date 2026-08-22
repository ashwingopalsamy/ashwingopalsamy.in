/**
 * diagrams - Mermaid, at the mdast stage.
 *
 * Runs BEFORE Shiki highlighting, where the fenced `code` node still carries
 * the raw, newline-intact source in `node.value`. Returning `{ rawHtml }`
 * injects the figure as literal HTML, so Shiki (which only highlights
 * `<pre><code>` fences) never sees the mermaid block: no wasted tokenizing, no
 * dark code block, no flash of un-styled source.
 *
 * Output is a `<figure class="diagram">` carrying:
 *   - `.diagram-canvas` - the mount point the client renders SVG into.
 *   - `.diagram-source` - the escaped source, the no-JS / parse-failure
 *     fallback that stays perfectly readable (a normal `<pre>`).
 *
 * The client (`src/scripts/prose.ts`) lazy-imports mermaid only when a
 * `.diagram` exists, reads the source from `.diagram-source`, and swaps it out.
 *
 * `langAlias` and the like are not needed: `node.lang` is the literal fence
 * info string. We also accept `mermaid` written with a filename meta
 * (`mermaid title="..."`) by matching the leading word.
 */
import { escapeHtml } from "./hast";

export const diagrams = {
  name: "diagrams",
  code(node: { lang?: string | null; value?: string }) {
    const lang = (node.lang ?? "").trim().split(/\s+/)[0]?.toLowerCase();
    if (lang !== "mermaid") return;
    const source = (node.value ?? "").replace(/\n$/, "");
    const esc = source
      .split(/\n[ \t]*\n/)
      .map(escapeHtml)
      .join("\n<!--diagram-blank-->\n");
    return {
      rawHtml: `<figure class="diagram" data-diagram>` +
        `<div class="diagram-canvas" role="img" aria-label="Mermaid diagram"></div>` +
        `<pre class="diagram-source">${esc}</pre>` +
        `</figure>`,
    };
  },
};
