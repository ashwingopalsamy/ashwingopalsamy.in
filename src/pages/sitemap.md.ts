import type { APIRoute } from "astro";
import { getSitemapEntries } from "../lib/sitemap";
import { absUrl } from "../lib/urls";

function markdownSitemap(entries: Awaited<ReturnType<typeof getSitemapEntries>>): string {
  const sections = new Map<string, typeof entries>();
  for (const entry of entries) {
    const section = sections.get(entry.section) ?? [];
    section.push(entry);
    sections.set(entry.section, section);
  }

  const groups = [...sections.entries()].map(([section, items]) => {
    const links = items
      .map((entry) => `- [${entry.title}](${absUrl(entry.path)})${entry.lastmod ? `, updated ${entry.lastmod}` : ""}`)
      .join("\n");
    return `## ${section}\n\n${links}`;
  });

  return `# Sitemap

Public pages on ashwingopalsamy.in. For agent-specific retrieval guidance, read the [public agent guide](${absUrl("/.well-known/agents.md")}).

${groups.join("\n\n")}
`;
}

export const GET: APIRoute = async () => {
  const headers = new Headers({
    "Content-Type": "text/markdown; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
  });
  headers.set("Link", `<${absUrl("/sitemap.xml")}>; rel="alternate"; type="application/xml"`);
  return new Response(markdownSitemap(await getSitemapEntries()), { headers });
};
