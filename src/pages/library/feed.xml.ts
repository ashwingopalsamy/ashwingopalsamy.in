import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { site } from "../../data/home";
import { getLibraryFeedItems } from "../../lib/library";
import { renderMarkdownHtml } from "../../lib/render-markdown";
import { absUrl } from "../../lib/urls";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cdata(html: string): string {
  return `<![CDATA[${html.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`;
}

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

  const lastBuild = items[0]?.date ?? new Date();
  const itemsXml = items
    .map((item) => {
      const description = item.summary
        ? `\n      <description>${escapeXml(item.summary)}</description>`
        : "";
      let encoded = "";
      if (item.kind === "notes") {
        const id = item.url.replace(/\/$/, "").split("/").pop() ?? "";
        const html = htmlById.get(id);
        if (html) {
          encoded = `\n      <content:encoded>${cdata(html)}</content:encoded>`;
        }
      }
      return `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.url)}</link>
      <guid isPermaLink="${item.guidIsPermaLink ? "true" : "false"}">${escapeXml(item.guid)}</guid>
      <pubDate>${item.date.toUTCString()}</pubDate>
      <category>${escapeXml(item.kind)}</category>${description}${encoded}
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="${absUrl("/feeds.xsl")}"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(`${site.name} Library`)}</title>
    <link>${absUrl("/library")}</link>
    <atom:link href="${absUrl("/library/feed.xml")}" rel="self" type="application/rss+xml"/>
    <description>Books, watching, notes, and links</description>
    <language>en</language>
    <lastBuildDate>${lastBuild.toUTCString()}</lastBuildDate>
    <ttl>60</ttl>
${itemsXml}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
};
