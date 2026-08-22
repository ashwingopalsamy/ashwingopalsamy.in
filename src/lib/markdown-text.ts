/**
 * Plain-text and metadata helpers for markdown content.
 *
 * Used by the note layout (reading time, auto-excerpt lede), the library index
 * (tag pills already come from frontmatter; nothing here), and the feeds (note
 * summaries, which today are blank). All operate on the raw markdown `body`
 * string so they need no render pass.
 */

/** Strip everything that isn't prose:
 *   - fenced code / mermaid (```…```)
 *   - inline code (`…`)
 *   - display math ($$…$$) and inline math ($…$)
 *   - images, links keep their text
 *   - HTML comments, emphasis markers, headings' leading #
 *
 *  Good enough for excerpts and word counts; not a spec-perfect renderer. */
export function plainText(markdown: string): string {
  const noCode = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`\n]*`/g, " ")
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    // inline math: only `$…$` tight pairs, not currency like "$5" (which has
    // no closing $, and satteri's math parser follows the same rule)
    .replace(/\$[^\s$][^$\n]*?\$/g, " ");
  const noMedia = noCode
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1");
  const noSyntax = noMedia
    .replace(/^\s{0,3}#+\s*/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/[*_~]{1,3}([^*_~\n]+)[*_~]{1,3}/g, "$1")
    .replace(/<!--[\s\S]*?-->/g, " ");
  return noSyntax
    .replace(/\s+/g, " ")
    .trim();
}

/** First paragraph as a single-line excerpt for feeds, OG description, and an
 *  optional lede. Falls back to the title-less body opener. */
export function excerpt(markdown: string, max = 200): string {
  const text = plainText(markdown);
  if (text.length <= max) return text;
  // cut on a word boundary, then add the ellipsis the site's voice avoids in
  // prose but tolerates in metadata
  const slice = text.slice(0, max);
  const atWord = slice.lastIndexOf(" ");
  return (atWord > max * 0.6 ? slice.slice(0, atWord) : slice).trimEnd() + "…";
}

/** Estimate reading time from word count. Uses Intl.Segmenter so Tamil, Emoji
 *  and other non-space-delimited scripts count correctly (the runes and
 *  utf8-identifier notes contain Tamil). Falls back to a whitespace split on
 *  runtimes without Intl.Segmenter. */
export function readingTimeMinutes(markdown: string): number {
  const text = plainText(markdown);
  if (!text) return 1;
  let words: number;
  try {
    const seg = new Intl.Segmenter("en", { granularity: "word" });
    words = 0;
    for (const _ of seg.segment(text)) words++;
  } catch {
    words = text.split(/\s+/).filter(Boolean).length;
  }
  const wpm = 200;
  const mins = Math.max(1, Math.round(words / wpm));
  return mins;
}