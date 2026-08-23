import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection } from "astro:content";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const prerender = true;

export const getStaticPaths = (async () => {
  const isProd = import.meta.env.PROD;
  const all = await getCollection("notes");
  const entries = all.filter((e) => !isProd || !e.data.draft);
  return entries.map((entry) => ({
    params: { slug: entry.id },
    props: { id: entry.id },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { id } = props as { id: string };
  const raw = await readFile(
    join(process.cwd(), "src/content/library/notes", `${id}.md`),
    "utf8",
  );
  return new Response(raw, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
};
