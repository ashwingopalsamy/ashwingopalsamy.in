/**
 * markdown pipeline - the satteri plugin assembly.
 *
 *   mdast:   [ diagrams ]
 *   hast:    [ callouts, math, headingAnchors, codeFigures, tables, externalLinks ]
 *
 * Ordering rationale (see satteri-processor.js):
 *   - Shiki highlight runs BEFORE user hast plugins, so codeFigures sees
 *     `<pre class="astro-code" data-language="…">`. Mermaid never makes it that
 *     far: `diagrams` intercepts the fence at mdast and returns raw HTML.
 *   - `callouts` mutates blockquotes in place (cheap, identity-safe); run early.
 *   - `math` replaces math `<pre>`/`<code>` with KaTeX HTML so codeFigures never
 *     wraps a math block.
 *   - `headingAnchors` runs BEFORE satteri's built-in heading-ids, which then
 *     adopts our ids (its `existingId` check) for the `headings` metadata.
 *   - `codeFigures` wraps the now-sole remaining highlighted <pre> blocks.
 *   - `tables`, `externalLinks` are independent leaf transforms.
 *
 * `headingAnchors` is a factory so each document gets a fresh slugger; the rest
 * are stateless definitions.
 */
import { satteri } from "@astrojs/markdown-satteri";
import { diagrams } from "./diagrams";
import { callouts } from "./callouts";
import { math } from "./math";
import { headingAnchors } from "./heading-anchors";
import { codeFigures } from "./code-figures";
import { tables } from "./tables";
import { externalLinks } from "./external-links";

export const markdownProcessor = satteri({
  // mdast (pre-Shiki): diagrams and math both return rawHtml, bypassing the
  // highlighter entirely. Order doesn't matter - they handle disjoint node
  // types (code vs math/inlineMath).
  mdastPlugins: [diagrams, math],
  // `headingAnchors` is a factory that satteri invokes once per document so
  // each note gets a fresh slugger (no cross-note slug contamination).
  hastPlugins: [callouts, headingAnchors, codeFigures, tables, externalLinks],
  features: { math: true },
});
