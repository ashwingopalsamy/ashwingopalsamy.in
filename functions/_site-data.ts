import type { TelemetryEnv } from "./_telemetry";

const ORIGIN = "https://ashwingopalsamy.in";

export interface RuntimeEnv extends TelemetryEnv {
  ASSETS?: {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  };
}

export interface PaletteItem {
  id: string;
  kind: string;
  title: string;
  href: string;
  subtitle?: string;
  description?: string;
  date?: string;
  keywords?: string[];
  external?: boolean;
}

export interface PaletteManifest {
  profile: Record<string, unknown>;
  content: PaletteItem[];
  quotes?: unknown[];
  aiResources?: unknown[];
}

async function getAsset(path: string, env: RuntimeEnv, requestUrl?: string): Promise<Response | null> {
  const url = new URL(path, requestUrl ?? ORIGIN);
  try {
    if (env.ASSETS) return await env.ASSETS.fetch(url);
    return await fetch(url);
  } catch {
    return null;
  }
}

async function getJson<T>(path: string, env: RuntimeEnv, requestUrl?: string): Promise<T | null> {
  const response = await getAsset(path, env, requestUrl);
  if (!response?.ok) return null;
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function getPalette(env: RuntimeEnv, requestUrl?: string): Promise<PaletteManifest> {
  return (
    (await getJson<PaletteManifest>("/api/palette.json", env, requestUrl)) ?? {
      profile: {},
      content: [],
    }
  );
}

export async function getProfile(env: RuntimeEnv, requestUrl?: string): Promise<Record<string, unknown>> {
  return (await getJson<Record<string, unknown>>("/api/ai-summary.json", env, requestUrl)) ?? {};
}

function safeLimit(value: unknown, fallback = 10): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(25, Math.floor(value)));
}

export async function searchSite(
  query: string,
  limit: unknown,
  env: RuntimeEnv,
  requestUrl?: string,
): Promise<PaletteItem[]> {
  const manifest = await getPalette(env, requestUrl);
  const needle = query.trim().toLowerCase();
  if (!needle) return manifest.content.slice(0, safeLimit(limit));
  return manifest.content
    .map((item) => {
      const haystack = [
        item.title,
        item.subtitle,
        item.description,
        item.href,
        ...(item.keywords ?? []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const titleScore = item.title.toLowerCase().includes(needle) ? 3 : 0;
      const score = titleScore + (haystack.includes(needle) ? 1 : 0);
      return { item, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
    .slice(0, safeLimit(limit))
    .map(({ item }) => item);
}

export async function listContent(
  kind: unknown,
  limit: unknown,
  env: RuntimeEnv,
  requestUrl?: string,
): Promise<PaletteItem[]> {
  const manifest = await getPalette(env, requestUrl);
  const requested = typeof kind === "string" ? kind.toLowerCase() : "all";
  const items = requested === "all" ? manifest.content : manifest.content.filter((item) => item.kind === requested);
  return items.slice(0, safeLimit(limit));
}

export async function getNoteMarkdown(
  slug: string,
  env: RuntimeEnv,
  requestUrl?: string,
): Promise<string | null> {
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(slug)) return null;
  const manifest = await getPalette(env, requestUrl);
  const cleanSlug = encodeURIComponent(slug);
  const allowed = manifest.content.some((item) => {
    if (item.kind !== "note") return false;
    const cleanHref = item.href.replace(/\/+$/, "");
    return (
      cleanHref === `/blog/${cleanSlug}` ||
      cleanHref === `/blog/${slug}` ||
      cleanHref === `/blog/${cleanSlug}.md` ||
      cleanHref === `/blog/${slug}.md` ||
      cleanHref === `/library/notes/${cleanSlug}` ||
      cleanHref === `/library/notes/${slug}` ||
      cleanHref === `/library/notes/${cleanSlug}.md` ||
      cleanHref === `/library/notes/${slug}.md`
    );
  });
  if (!allowed) return null;
  const response =
    (await getAsset(`/blog/${cleanSlug}.md`, env, requestUrl)) ||
    (await getAsset(`/library/notes/${cleanSlug}.md`, env, requestUrl));
  return response?.ok ? response.text() : null;
}

export function origin(): string {
  return ORIGIN;
}
