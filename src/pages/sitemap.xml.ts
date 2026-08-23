import type { APIRoute } from "astro";
import { getSitemapEntries } from "../lib/sitemap";
import { absUrl } from "../lib/urls";

function urlEntry(loc: string, lastmod?: string): string {
  const lastmodTag = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : "";
  return `  <url>
    <loc>${loc}</loc>${lastmodTag}
  </url>`;
}

export const GET: APIRoute = async () => {
  const entries = await getSitemapEntries();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((entry) => urlEntry(absUrl(entry.path), entry.lastmod)).join("\n")}
</urlset>
`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
