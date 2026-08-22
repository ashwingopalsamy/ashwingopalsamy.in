import { getCollection } from "astro:content";
import { slashPath } from "./urls";

const MIN_TAG_COUNT = 2;

export interface TagBucket {
  tag: string;
  count: number;
  notes: { id: string; title: string; date: Date }[];
}

/** Tags that appear on ≥2 library entries (notes + books + articles). */
export async function getTagBuckets(): Promise<TagBucket[]> {
  const isProd = import.meta.env.PROD;
  const [notes, books, articles] = await Promise.all([
    getCollection("notes"),
    getCollection("books"),
    getCollection("articles"),
  ]);

  const visibleNotes = isProd ? notes.filter((e) => !e.data.draft) : notes;
  const map = new Map<string, TagBucket>();

  const bump = (tag: string, note?: { id: string; title: string; date: Date }) => {
    const cur = map.get(tag) ?? { tag, count: 0, notes: [] };
    cur.count += 1;
    if (note) cur.notes.push(note);
    map.set(tag, cur);
  };

  for (const e of visibleNotes) {
    for (const tag of e.data.tags ?? []) {
      bump(tag, { id: e.id, title: e.data.title, date: e.data.date });
    }
  }
  for (const e of books) {
    for (const tag of e.data.tags ?? []) bump(tag);
  }
  for (const e of articles) {
    for (const tag of e.data.tags ?? []) bump(tag);
  }

  return [...map.values()]
    .filter((b) => b.count >= MIN_TAG_COUNT)
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function tagHref(tag: string): string {
  return slashPath(`/library/tags/${encodeURIComponent(tag)}`);
}

export function isLinkedTag(tag: string, linked: Set<string>): boolean {
  return linked.has(tag);
}

export async function linkedTagSet(): Promise<Set<string>> {
  const buckets = await getTagBuckets();
  return new Set(buckets.map((b) => b.tag));
}

const TAG_BLURBS: Record<string, string> = {
  go: "Writing about Go: the runtime, the standard library, and the trade-offs that make it fit payment and cloud systems.",
  "distributed-systems": "Hashing, caches, rate limits, and the failure modes that show up when money moves across machines.",
  engineering: "Craft notes on reviewing, shipping, and keeping production codebases honest.",
  payments: "Authorization paths, ISO 8583, idempotency, and the infrastructure behind card taps.",
  infrastructure: "The systems under the systems: logging, schedulers, and the boring reliability work.",
  "engineering-practices": "Habits that survive code review: git hygiene, self-review, and production discipline.",
};

export function tagPageDescription(tag: string, count: number): string {
  const blurb = TAG_BLURBS[tag];
  if (blurb) {
    const suffix = ` ${count} linked entr${count === 1 ? "y" : "ies"}.`;
    const combined = blurb + suffix;
    return combined.length <= 160 ? combined : blurb;
  }
  return `Notes and library entries tagged “${tag}”: ${count} item${count === 1 ? "" : "s"} on ashwingopalsamy.in.`;
}
