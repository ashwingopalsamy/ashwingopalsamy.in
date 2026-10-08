/**
 * diagrams - Mermaid, at the mdast stage.
 *
 * Runs BEFORE Shiki highlighting, where the fenced `code` node still carries
 * the raw, newline-intact source in `node.value`. Returning `{ rawHtml }`
 * injects the figure as literal HTML, so Shiki (which only highlights
 * `<pre><code>` fences) never sees the mermaid block: no wasted tokenizing, no
 * dark code block, no flash of un-styled source.
 *
 * Diagrams are prerendered: `npm run diagrams` renders every diagram of a
 * built site in a real browser (the same fonts, tokens and mermaid config as
 * the client path), once per theme, into `src/assets/diagrams/<key>.<theme>.svg`.
 * The key hashes the source with `diagram-cache.json#salt`, so a source,
 * mermaid or theme change misses the cache instead of serving a stale SVG.
 *
 * A cached diagram is inlined as both theme variants (CSS shows one), so it
 * needs no JavaScript, never reflows and never re-renders on a theme flip.
 * An uncached one falls back to the client path:
 *   - `.diagram-canvas` - the mount point the client renders SVG into.
 *   - `.diagram-source` - the escaped source, the no-JS / parse-failure
 *     fallback that stays perfectly readable (a normal `<pre>`).
 *
 * `langAlias` and the like are not needed: `node.lang` is the literal fence
 * info string. We also accept `mermaid` written with a filename meta
 * (`mermaid title="..."`) by matching the leading word.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import cache from "./diagram-cache.json";
import { iconMarkup } from "../ui-icons";
import { escapeHtml } from "./hast";

const THEMES = ["light", "dark"] as const;
const warned = new Set<string>();

/** Blank lines collapse to one form so the key matches the client's
 *  `.diagram-source` textContent, which is what the renderer saw. */
function diagramKey(source: string): string {
  const normalized = source.split(/\n[ \t]*\n/).join("\n\n");
  return createHash("sha256").update(`${cache.salt}\0${normalized}`).digest("hex").slice(0, 16);
}

function prerendered(key: string): string | null {
  const variants: string[] = [];
  for (const theme of THEMES) {
    const file = join(process.cwd(), cache.dir, `${key}.${theme}.svg`);
    if (!existsSync(file)) return null;
    variants.push(readFileSync(file, "utf8").replace(/^<svg\b/, `<svg data-variant="${theme}"`));
  }
  return variants.join("");
}

export const diagrams = {
  name: "diagrams",
  code(node: { lang?: string | null; value?: string }) {
    const lang = (node.lang ?? "").trim().split(/\s+/)[0]?.toLowerCase();
    if (lang !== "mermaid") return;
    const source = (node.value ?? "").replace(/\n$/, "");
    const key = diagramKey(source);

    const svg = prerendered(key);
    if (svg) {
      return {
        rawHtml: `<figure class="diagram is-enhanced is-rendered" data-diagram data-diagram-key="${key}" data-prerendered>` +
          `<div class="diagram-canvas" role="img" aria-label="Mermaid diagram">${svg}</div>` +
          // Shipped in the HTML so enhancement never grows the figure; hidden
          // (space kept) until prose.ts wires it.
          `<div class="diagram-toolbar"><button type="button" class="diagram-expand" aria-label="Expand diagram" data-pending>` +
          `${iconMarkup("expand", { size: 15, strokeWidth: 1.8 })}</button></div>` +
          `</figure>`,
      };
    }

    if (!warned.has(key)) {
      warned.add(key);
      console.warn(`[diagrams] ${key} is not prerendered; it will render client-side. Run \`npm run diagrams\` after this build.`);
    }
    const esc = source
      .split(/\n[ \t]*\n/)
      .map(escapeHtml)
      .join("\n<!--diagram-blank-->\n");
    return {
      rawHtml: `<figure class="diagram" data-diagram data-diagram-key="${key}">` +
        `<div class="diagram-canvas" role="img" aria-label="Mermaid diagram"></div>` +
        `<pre class="diagram-source">${esc}</pre>` +
        `</figure>`,
    };
  },
};
