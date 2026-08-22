import type { LibraryKind } from "./library";

interface LibraryCatalogBase {
  kind: LibraryKind;
  title: string;
  date: Date;
  tags: string[];
}

export type LibraryCatalogItem =
  | (LibraryCatalogBase & {
      kind: "books";
      author: string;
      status: "reading" | "finished" | "dropped";
      rating?: "up" | "mixed" | "down";
      href: string | null;
    })
  | (LibraryCatalogBase & {
      kind: "watch";
      platform: string;
      status: "watching" | "finished" | "dropped";
      rating?: "up" | "mixed" | "down";
      href: string | null;
    })
  | (LibraryCatalogBase & {
      kind: "notes";
      description?: string;
      href: string;
    })
  | (LibraryCatalogBase & {
      kind: "articles";
      source: string;
      hostname: string;
      href: string;
    });

type LibraryCatalogItemInput =
  | Omit<Extract<LibraryCatalogItem, { kind: "books" }>, "tags"> & { tags?: string[] | null }
  | Omit<Extract<LibraryCatalogItem, { kind: "watch" }>, "tags"> & { tags?: string[] | null }
  | Omit<Extract<LibraryCatalogItem, { kind: "notes" }>, "tags"> & { tags?: string[] | null }
  | Omit<Extract<LibraryCatalogItem, { kind: "articles" }>, "tags"> & { tags?: string[] | null };

export const libraryViews = ["all", "notes", "books", "articles", "watch"] as const;
export type LibraryView = (typeof libraryViews)[number];

export const libraryKinds = ["notes", "books", "articles", "watch"] as const;

export const libraryLabels = {
  notes: "Writings",
  books: "Books",
  articles: "Bookmarks",
  watch: "Watched",
} as const satisfies Record<LibraryKind, string>;

export interface LibraryShelf {
  kind: LibraryKind;
  total: number;
  items: LibraryCatalogItem[];
}

export function normalizeLibraryCatalogItem(input: LibraryCatalogItemInput): LibraryCatalogItem {
  const tags = (input.tags ?? []).map((tag) => tag.trim()).filter(Boolean);
  if (input.kind === "books") return { ...input, author: input.author.trim(), href: input.href ?? null, tags };
  if (input.kind === "watch") return { ...input, platform: input.platform.trim(), href: input.href ?? null, tags };
  if (input.kind === "notes") return { ...input, description: input.description?.trim() || undefined, tags };
  return { ...input, source: input.source.trim(), hostname: input.hostname.trim(), tags };
}

export function sortLibraryCatalogItems(items: LibraryCatalogItem[]): LibraryCatalogItem[] {
  return [...items].sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function filterLibraryCatalogItems(
  items: LibraryCatalogItem[],
  kind: LibraryKind,
): LibraryCatalogItem[] {
  return items.filter((item) => item.kind === kind);
}

export function libraryShelves(items: LibraryCatalogItem[], limit = 3): LibraryShelf[] {
  return libraryKinds.map((kind) => {
    const categoryItems = filterLibraryCatalogItems(items, kind);
    return { kind, total: categoryItems.length, items: categoryItems.slice(0, limit) };
  });
}

export function isLibraryView(value: string | null): value is LibraryView {
  return value !== null && libraryViews.includes(value as LibraryView);
}
