import { getCollection, type CollectionEntry } from "astro:content";
import { excerpt } from "./markdown-text";
import { absUrl, slashPath } from "./urls";

export type LibraryKind = "books" | "watch" | "notes" | "articles";

export interface LibraryFeedItem {
  kind: LibraryKind;
  title: string;
  date: Date;
  url: string;
  isExternal: boolean;
  summary?: string;
  /** Unique feed GUID. May be a tag: URI when the item has no unique permalink. */
  guid: string;
  guidIsPermaLink: boolean;
}

function hasBody(entry: { body?: string }): boolean {
  return (entry.body ?? "").trim().length > 0;
}

function feedDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function tagGuid(kind: LibraryKind, slug: string, date: Date): string {
  return `tag:ashwingopalsamy.in,${feedDate(date)}:${kind}/${slug}`;
}

export function bookHref(entry: CollectionEntry<"books">): string | undefined {
  return hasBody(entry) ? slashPath(`/library/books/${entry.id}`) : undefined;
}

export function watchHref(entry: CollectionEntry<"watch">): string | undefined {
  return hasBody(entry) ? slashPath(`/library/watch/${entry.id}`) : undefined;
}

export function noteHref(entry: CollectionEntry<"notes">): string {
  return slashPath(`/blog/${entry.id}`);
}

export function articleSource(entry: CollectionEntry<"articles">): string {
  if (entry.data.source) return entry.data.source;
  return articleHostname(entry.data.url);
}

export function articleHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** All four kinds, merged and sorted reverse-chronological by date. Used by
 * the /library index and the combined library feed. */
export async function getLibraryFeedItems(siteUrl: string): Promise<LibraryFeedItem[]> {
  const isProd = import.meta.env.PROD;
  const [books, watch, notes, articles] = await Promise.all([
    getCollection("books"),
    getCollection("watch"),
    getCollection("notes"),
    getCollection("articles"),
  ]);

  // siteUrl kept for call-site compatibility; absUrl owns the host.
  void siteUrl;

  const items: LibraryFeedItem[] = [
    ...books.map((e) => {
      const href = bookHref(e);
      const url = href ? absUrl(href) : absUrl("/library");
      return {
        kind: "books" as const,
        title: e.data.title,
        date: e.data.date,
        url,
        isExternal: false,
        summary: e.data.take,
        guid: href ? url : tagGuid("books", e.id, e.data.date),
        guidIsPermaLink: Boolean(href),
      };
    }),
    ...watch.map((e) => {
      const href = watchHref(e);
      const url = href ? absUrl(href) : absUrl("/library");
      return {
        kind: "watch" as const,
        title: e.data.title,
        date: e.data.date,
        url,
        isExternal: false,
        summary: e.data.take,
        guid: href ? url : tagGuid("watch", e.id, e.data.date),
        guidIsPermaLink: Boolean(href),
      };
    }),
    ...notes.filter((e) => !isProd || !e.data.draft).map((e) => {
      const url = absUrl(noteHref(e));
      return {
        kind: "notes" as const,
        title: e.data.title,
        date: e.data.date,
        url,
        isExternal: false,
        summary: e.data.description ?? excerpt(e.body ?? "", 200),
        guid: url,
        guidIsPermaLink: true,
      };
    }),
    ...articles.map((e) => ({
      kind: "articles" as const,
      title: e.data.title,
      date: e.data.date,
      url: e.data.url,
      isExternal: true,
      summary: articleSource(e),
      guid: e.data.url,
      guidIsPermaLink: false,
    })),
  ];

  return items.sort((a, b) => b.date.getTime() - a.date.getTime());
}
