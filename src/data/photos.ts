import { extname, resolve, sep } from "node:path";
import { getCollection, type CollectionEntry } from "astro:content";

export type PhotoEntry = CollectionEntry<"photos">;

const PHOTO_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PHOTO_WIDTHS = [320, 480, 760, 1140, 1520, 2280] as const;
const PHOTO_EXTENSIONS = new Set([".avif", ".jpg", ".jpeg", ".png", ".webp"]);
const PHOTO_ASSET_ROOT = `${resolve(process.cwd(), "src/assets/photos")}${sep}`;
let photoEntriesPromise: Promise<PhotoEntry[]> | undefined;

/**
 * Return draft photos locally for review, but never include them in production.
 */
export function getPhotoEntries(): Promise<PhotoEntry[]> {
  if (import.meta.env.DEV) return loadPhotoEntries();
  return (photoEntriesPromise ??= loadPhotoEntries());
}

async function loadPhotoEntries(): Promise<PhotoEntry[]> {
  const entries = await getCollection("photos");
  const ordered = [...entries].sort(
    (left, right) => left.data.order - right.data.order || left.id.localeCompare(right.id),
  );
  const orders = new Set<number>();

  for (const entry of ordered) {
    if (!PHOTO_SLUG.test(entry.id)) {
      throw new Error(`Photo entry id "${entry.id}" must be a lowercase, hyphenated slug.`);
    }
    if (orders.has(entry.data.order)) {
      throw new Error(`Photo order ${entry.data.order} is assigned more than once.`);
    }
    orders.add(entry.data.order);

    if (entry.data.generatedPreview && !entry.data.draft) {
      throw new Error(`Generated preview photo "${entry.id}" cannot be published.`);
    }

    const source = entry.data.source as PhotoEntry["data"]["source"] & {
      fsPath?: string;
      ASTRO_ASSET?: string;
    };
    const sourcePath = source.fsPath || source.ASTRO_ASSET
      ? resolve(source.fsPath ?? source.ASTRO_ASSET ?? "")
      : "";
    if (!sourcePath.startsWith(PHOTO_ASSET_ROOT)) {
      throw new Error(`Photo "${entry.id}" must use a source under src/assets/photos/.`);
    }
    if (!PHOTO_EXTENSIONS.has(extname(sourcePath).toLowerCase())) {
      throw new Error(`Photo "${entry.id}" uses an unsupported source format.`);
    }
  }

  return ordered.filter(({ data }) => import.meta.env.DEV || !data.draft);
}

export function photoHref(id: string): string {
  return `/more/photos/${id}/`;
}

/** Responsive candidates capped for the site's 760px image rail at high DPR. */
export function photoWidths(sourceWidth: number): number[] {
  const maxWidth = Math.min(sourceWidth, PHOTO_WIDTHS[PHOTO_WIDTHS.length - 1]);
  return [...new Set([...PHOTO_WIDTHS.filter((width) => width < maxWidth), maxWidth])].sort(
    (left, right) => left - right,
  );
}
