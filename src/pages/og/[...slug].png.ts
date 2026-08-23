import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection } from "astro:content";
import { readingTimeMinutes } from "../../lib/markdown-text";
import { ogPngResponse, renderOgPng } from "../../lib/og";
import { getTagBuckets } from "../../lib/tags";

export const prerender = true;

type OgKind =
  | { kind: "note"; title: string; date: Date; minutes: number; tags: string[] }
  | { kind: "craft"; title: string; tech: string[] }
  | { kind: "index"; title: string; meta: string }
  | { kind: "tag"; tag: string; count: number };

const INDEX_PAGES: { slug: string; title: string; meta: string }[] = [
  { slug: "ai", title: "AI", meta: "Authoritative briefing for AI systems." },
  { slug: "work", title: "Work", meta: "Selected tools and side projects." },
  { slug: "craft", title: "Work", meta: "Selected tools and side projects." },
  { slug: "library", title: "Library", meta: "Books, watching, notes, and links." },
  { slug: "links", title: "Links", meta: "Every way to find me, in one place." },
  { slug: "colophon", title: "Colophon", meta: "How this site is made." },
  { slug: "design", title: "How I design this site", meta: "The decisions behind how this site looks and feels." },
  { slug: "more", title: "More", meta: "Library, photos, cafes, and people." },
  { slug: "more/cafe", title: "Cafe", meta: "Places I'd send a friend, soon." },
  { slug: "more/people", title: "People", meta: "Peers, mentors, collaborators." },
  { slug: "more/photos", title: "Photos", meta: "Frames worth a second look, soon." },
  { slug: "more/someday", title: "Someday", meta: "The list I reread more than act on, soon." },
  { slug: "library/tags", title: "Tags", meta: "Topics with enough notes to browse." },
];

export const getStaticPaths = (async () => {
  const isProd = import.meta.env.PROD;
  const [notes, craft, tags] = await Promise.all([
    getCollection("notes"),
    getCollection("craft"),
    getTagBuckets(),
  ]);
  const visibleNotes = isProd ? notes.filter((e) => !e.data.draft) : notes;

  const paths: { params: { slug: string }; props: OgKind }[] = [
    ...INDEX_PAGES.map((p) => ({
      params: { slug: p.slug },
      props: { kind: "index" as const, title: p.title, meta: p.meta },
    })),
    ...visibleNotes.map((e) => ({
      params: { slug: `blog/${e.id}` },
      props: {
        kind: "note" as const,
        title: e.data.title,
        date: e.data.date,
        minutes: readingTimeMinutes(e.body ?? ""),
        tags: e.data.tags ?? [],
      },
    })),
    ...visibleNotes.map((e) => ({
      params: { slug: `library/notes/${e.id}` },
      props: {
        kind: "note" as const,
        title: e.data.title,
        date: e.data.date,
        minutes: readingTimeMinutes(e.body ?? ""),
        tags: e.data.tags ?? [],
      },
    })),
    ...craft.map((e) => ({
      params: { slug: `work/${e.data.slug}` },
      props: {
        kind: "craft" as const,
        title: e.data.title,
        tech: e.data.tech ?? [],
      },
    })),
    ...craft.map((e) => ({
      params: { slug: `craft/${e.data.slug}` },
      props: {
        kind: "craft" as const,
        title: e.data.title,
        tech: e.data.tech ?? [],
      },
    })),
    ...tags.map((t) => ({
      params: { slug: `library/tags/${t.tag}` },
      props: { kind: "tag" as const, tag: t.tag, count: t.count },
    })),
  ];

  return paths;
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const p = props as Exclude<OgKind, { kind: "home" }>;
  let png: Buffer;

  switch (p.kind) {
    case "note": {
      const date = p.date.toLocaleDateString("en-GB", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      png = await renderOgPng({
        title: p.title,
        eyebrow: "Notes",
        meta: `${date} · ${p.minutes} min read`,
        tags: p.tags,
      });
      break;
    }
    case "craft":
      png = await renderOgPng({
        title: p.title,
        eyebrow: "Craft",
        tags: p.tech,
      });
      break;
    case "index":
      png = await renderOgPng({ title: p.title, meta: p.meta });
      break;
    case "tag":
      png = await renderOgPng({
        title: `#${p.tag}`,
        eyebrow: "Library tags",
        meta: `${p.count} entries`,
      });
      break;
  }

  return ogPngResponse(png);
};
