import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { site } from "../../data/home";
import { getLibraryFeedItems } from "../../lib/library";
import { renderMarkdownHtml } from "../../lib/render-markdown";
import { absUrl } from "../../lib/urls";

export const GET: APIRoute = async () => {
  const items = await getLibraryFeedItems(site.url);
  const isProd = import.meta.env.PROD;
  const notes = await getCollection("notes");
  const visibleNotes = isProd ? notes.filter((e) => !e.data.draft) : notes;
  const htmlById = new Map<string, string>();
  await Promise.all(
    visibleNotes.map(async (e) => {
      htmlById.set(e.id, await renderMarkdownHtml(e.body ?? ""));
    }),
  );

  const feed = {
    version: "https://jsonfeed.org/version/1.1",
    title: `${site.name} Library`,
    home_page_url: absUrl("/library"),
    feed_url: absUrl("/library/feed.json"),
    description: "Books, watching, notes, and links",
    icon: `${site.url}/icon-512.png`,
    favicon: `${site.url}/favicon.ico`,
    authors: [
      {
        name: site.name,
        url: absUrl("/"),
        avatar: `${site.url}/portrait.webp`,
      },
    ],
    items: items.map((item) => {
      const base = {
        id: item.guid,
        url: item.url,
        title: item.title,
        content_text: item.summary ?? "",
        date_published: item.date.toISOString(),
        tags: [item.kind],
        authors: [{ name: site.name, url: absUrl("/") }],
        ...(item.isExternal ? { external_url: item.url } : {}),
      };
      if (item.kind === "notes") {
        const id = item.url.replace(/\/$/, "").split("/").pop() ?? "";
        const html = htmlById.get(id);
        if (html) return { ...base, content_html: html };
      }
      return base;
    }),
  };

  return new Response(JSON.stringify(feed, null, 2), {
    headers: { "Content-Type": "application/feed+json; charset=utf-8" },
  });
};
