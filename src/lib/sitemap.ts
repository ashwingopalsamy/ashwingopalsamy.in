import { getCollection } from "astro:content";
import { CANONICAL_KNOWLEDGE } from "../data/canonical-knowledge";
import { moreDestinations } from "../data/more";
import { bookHref, noteHref, watchHref } from "./library";
import { getTagBuckets, tagHref } from "./tags";
import { slashPath } from "./urls";

export interface SitemapEntry {
  path: string;
  title: string;
  section: string;
  lastmod?: string;
}

const staticEntries: readonly SitemapEntry[] = [
  { path: "/", title: "Home", section: "Profile", lastmod: CANONICAL_KNOWLEDGE.profileLastModified },
  { path: "/ai/", title: "AI guide", section: "Agent resources", lastmod: CANONICAL_KNOWLEDGE.profileLastModified },
  { path: "/faq/", title: "FAQ", section: "Profile", lastmod: CANONICAL_KNOWLEDGE.profileLastModified },
  { path: "/work/", title: "Work", section: "Work" },
  { path: "/library/", title: "Library", section: "Library" },
  { path: "/library/tags/", title: "Library tags", section: "Library" },
  { path: "/links/", title: "Links", section: "Profile" },
  { path: "/more/", title: "More", section: "More" },
  { path: "/colophon/", title: "Colophon", section: "Profile" },
  { path: "/design/", title: "How I design this site", section: "Profile", lastmod: "2026-08-10" },
  { path: "/about/", title: "About", section: "Profile", lastmod: CANONICAL_KNOWLEDGE.profileLastModified },
  { path: "/contact/", title: "Contact", section: "Profile", lastmod: CANONICAL_KNOWLEDGE.profileLastModified },
  { path: "/privacy/", title: "Privacy Policy", section: "Profile", lastmod: CANONICAL_KNOWLEDGE.profileLastModified },
  { path: "/developers/", title: "Developer Resources", section: "Agent resources", lastmod: CANONICAL_KNOWLEDGE.profileLastModified },
];

function day(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function getSitemapEntries(): Promise<SitemapEntry[]> {
  const [books, watch, notes, craft, tags] = await Promise.all([
    getCollection("books"),
    getCollection("watch"),
    getCollection("notes"),
    getCollection("craft"),
    getTagBuckets(),
  ]);
  const isProd = import.meta.env.PROD;
  const visibleNotes = isProd ? notes.filter((entry) => !entry.data.draft) : notes;
  const entries: SitemapEntry[] = [
    ...staticEntries,
    ...moreDestinations
      .filter((destination) => destination.status === "live" && destination.id !== "library" && destination.id !== "ai")
      .map((destination) => ({
        path: destination.href,
        title: destination.title,
        section: "More",
      })),
  ];

  for (const entry of books) {
    const path = bookHref(entry);
    if (!path) continue;
    entries.push({
      path,
      title: entry.data.title,
      section: "Library",
      lastmod: day(entry.data.date),
    });
  }

  for (const entry of watch) {
    const path = watchHref(entry);
    if (!path) continue;
    entries.push({
      path,
      title: entry.data.title,
      section: "Library",
      lastmod: day(entry.data.date),
    });
  }

  for (const entry of visibleNotes) {
    entries.push({
      path: noteHref(entry),
      title: entry.data.title,
      section: "Library",
      lastmod: day(entry.data.updated ?? entry.data.date),
    });
  }

  for (const entry of craft) {
    entries.push({
      path: slashPath(`/work/${entry.data.slug}`),
      title: entry.data.title,
      section: "Work",
      lastmod: day(entry.data.date),
    });
  }

  for (const tag of tags) {
    entries.push({
      path: tagHref(tag.tag),
      title: `#${tag.tag}`,
      section: "Library topics",
    });
  }

  return entries;
}
