import { getCollection } from "astro:content";
import { getPhotoEntries } from "../data/photos";
import type { MoreDestinationId } from "../data/more";

/**
 * The More pages that have something to show in this build, by the same
 * rule each page applies to itself: sample rows count in `astro dev`, only
 * real ones in production. A page with nothing to show stays a quiet
 * "coming soon" tile.
 */
export async function liveMoreDestinations(): Promise<Set<MoreDestinationId>> {
  const prod = import.meta.env.PROD;
  const shows = (items: { data: { placeholder: boolean } }[]) =>
    items.some(({ data }) => !prod || !data.placeholder);
  const [photos, cafes, people, someday] = await Promise.all([
    getPhotoEntries(),
    getCollection("cafes"),
    getCollection("people"),
    getCollection("someday"),
  ]);
  const live = new Set<MoreDestinationId>();
  if (photos.length > 0) live.add("photos");
  if (shows(cafes)) live.add("cafe");
  if (shows(people)) live.add("people");
  if (shows(someday)) live.add("someday");
  return live;
}
