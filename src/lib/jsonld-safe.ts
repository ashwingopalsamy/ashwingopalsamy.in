/** Escape JSON for embedding inside <script type="application/ld+json">. */
export function stringifyJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** Word count from already-computed plain text (or markdown via plainText). */
export function wordCount(text: string): number {
  if (!text.trim()) return 0;
  try {
    const seg = new Intl.Segmenter("en", { granularity: "word" });
    let n = 0;
    for (const part of seg.segment(text)) {
      if (part.isWordLike) n++;
    }
    return n;
  } catch {
    return text.split(/\s+/).filter(Boolean).length;
  }
}
