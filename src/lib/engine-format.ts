/**
 * Labels for the photo, cafe and people pages. Everything is formatted at
 * build time from the hand-written records in src/content, so a photo's
 * time reads as the wall clock where it was taken, not the visitor's.
 */
import type { CollectionEntry } from "astro:content";

type PhotoData = CollectionEntry<"photos">["data"];
type Camera = NonNullable<PhotoData["camera"]>;
type Place = NonNullable<PhotoData["place"]>;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MINUS = "−";

interface LocalTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}

/** The wall-clock parts as written; no time zone conversion happens. */
function localParts(value: string): LocalTime {
  const [date, time] = value.split("T");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return { year, month, day, hour, minute, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() };
}

/** Milliseconds since the epoch, for sorting photos taken in different zones. */
export function takenEpoch(value: string | undefined): number {
  return value ? Date.parse(value) : 0;
}

export function shortDate(value: string): string {
  const { year, month, day } = localParts(value);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** "Sunday · 12 Oct 2025 · 6:42 PM", as the phone's info panel puts it. */
export function longDateTime(value: string): string {
  const { weekday, hour, minute } = localParts(value);
  const clock = `${hour % 12 || 12}:${String(minute).padStart(2, "0")} ${hour < 12 ? "AM" : "PM"}`;
  return `${DAYS[weekday]} · ${shortDate(value)} · ${clock}`;
}

/** "2026-03" as "Mar 2026". */
export function monthYear(value: string): string {
  const [year, month] = value.split("-").map(Number);
  return `${MONTHS[month - 1]} ${year}`;
}

export function photoDateLabel(data: PhotoData): string | undefined {
  return data.date ?? (data.taken ? shortDate(data.taken) : undefined);
}

export function photoLocationLabel(data: PhotoData): string | undefined {
  return data.location ?? data.place?.locality;
}

export function placeLine(place: Place): string {
  return [place.locality, place.region, place.country].filter(Boolean).join(", ");
}

/** "10.33° N, 76.95° E" */
export function coordinates(lat: number, lon: number): string {
  const part = (value: number, positive: string, negative: string) =>
    `${Math.abs(value).toFixed(2)}° ${value >= 0 ? positive : negative}`;
  return `${part(lat, "N", "S")}, ${part(lon, "E", "W")}`;
}

export function mapsHref(lat: number, lon: number, label?: string): string {
  const query = label ? `${label} @${lat},${lon}` : `${lat},${lon}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function cameraName(camera: Camera): string {
  return camera.model.startsWith(camera.make) ? camera.model : `${camera.make} ${camera.model}`;
}

const aperture = (value: number) => `ƒ${Number(value.toFixed(2))}`;
const shutter = (value: string) => `${value} s`;
const focal = (value: number) => `${Number(value.toFixed(1))} mm`;
const ev = (value: number) =>
  `${value > 0 ? "+" : value < 0 ? MINUS : ""}${Number(Math.abs(value).toFixed(1))} ev`;

/** "Main Camera · 24 mm ƒ1.78" */
export function lensLine(camera: Camera): string | undefined {
  const optics = [camera.focal && focal(camera.focal), camera.aperture && aperture(camera.aperture)]
    .filter(Boolean)
    .join(" ");
  return [camera.lens, optics].filter(Boolean).join(" · ") || undefined;
}

/** "24 MP · 5712 × 4284 · 3.2 MB" */
export function captureLine(camera: Camera): string | undefined {
  const parts: string[] = [];
  if (camera.pixels) {
    const [width, height] = camera.pixels;
    parts.push(`${Math.floor((width * height) / 1e6)} MP`, `${width} × ${height}`);
  }
  if (camera.bytes) {
    const mb = camera.bytes / 1e6;
    parts.push(`${mb >= 100 ? Math.round(mb) : Number(mb.toFixed(1))} MB`);
  }
  return parts.join(" · ") || undefined;
}

/** The exposure strip: ISO, focal length, exposure bias, aperture, shutter. */
export function exposureCells(camera: Camera): { label: string; value: string }[] {
  const cells: { label: string; value: string }[] = [];
  if (camera.iso) cells.push({ label: "ISO", value: `ISO ${camera.iso}` });
  if (camera.focal) cells.push({ label: "Focal length", value: focal(camera.focal) });
  if (camera.ev !== undefined) cells.push({ label: "Exposure bias", value: ev(camera.ev) });
  if (camera.aperture) cells.push({ label: "Aperture", value: aperture(camera.aperture) });
  if (camera.shutter) cells.push({ label: "Shutter", value: shutter(camera.shutter) });
  return cells;
}

/** "ƒ1.78 · 1/120 s · ISO 80", for the wall's hover strip. */
export function exposureSummary(camera: Camera | undefined): string | undefined {
  if (!camera) return undefined;
  const parts = [
    camera.aperture && aperture(camera.aperture),
    camera.shutter && shutter(camera.shutter),
    camera.iso && `ISO ${camera.iso}`,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : undefined;
}

export function titleCase(value: string): string {
  return value.replace(/(^|-)([a-z])/g, (_, dash: string, letter: string) => `${dash ? " " : ""}${letter.toUpperCase()}`);
}

/** Initials for a monogram: first and last name. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  const first = words[0]?.[0] ?? "";
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}

/** A stable hue per name, so a monogram keeps its colour across builds. */
export function nameHue(name: string): number {
  let hash = 2166136261;
  for (const char of name) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 360;
}

export interface EngineFacet {
  id: string;
  label: string;
  count: number;
}

/** "All N" followed by every value in first-seen order, or by `order`. */
export function facets<T>(
  items: T[],
  valueOf: (item: T) => string | string[],
  labelOf: (value: string) => string = titleCase,
  order?: (left: EngineFacet, right: EngineFacet) => number,
): EngineFacet[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const values = valueOf(item);
    for (const value of Array.isArray(values) ? values : [values]) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  const list = [...counts].map(([id, count]) => ({ id, label: labelOf(id), count }));
  if (order) list.sort(order);
  return [{ id: "all", label: "All", count: items.length }, ...list];
}

export function tagSlug(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
