import { getCollection } from "astro:content";
import { currentRole, quotes, resumeUrl, site } from "../data/home";
import { profileLinks } from "../data/profile-links";
import { bookHref, noteHref, watchHref } from "./library";
import { getTagBuckets, tagHref } from "./tags";
import { slashPath } from "./urls";

export type PaletteContentKind = "note" | "craft" | "book" | "watch" | "article" | "tag";

export interface PaletteContent {
  id: string;
  kind: PaletteContentKind;
  title: string;
  href: string;
  subtitle?: string;
  description?: string;
  date?: string;
  keywords: string[];
  external?: boolean;
}

export interface PaletteManifest {
  version: 1;
  profile: {
    name: string;
    siteUrl: string;
    email: string;
    location: string;
    locationShort: string;
    timeZone: string;
    calendarUrl: string;
    resumeUrl: string | null;
    resumeProfileUrl: string;
    role: string;
    company: string;
    repoUrl: string;
    links: { id: string; label: string; handle: string; href: string; mail?: boolean }[];
  };
  content: PaletteContent[];
  quotes: { text: string; author: string; source?: string }[];
  aiResources: { id: string; label: string; href: string; description: string }[];
}

const pagefindSuffix = /\s·\sAshwin Gopalsamy$/;

export async function buildPaletteManifest(): Promise<PaletteManifest> {
  const isProd = import.meta.env.PROD;
  const [allNotes, craft, books, watch, articles, tagBuckets] = await Promise.all([
    getCollection("notes"),
    getCollection("craft"),
    getCollection("books"),
    getCollection("watch"),
    getCollection("articles"),
    getTagBuckets(),
  ]);

  const notes = isProd ? allNotes.filter((entry) => !entry.data.draft) : allNotes;
  const email = profileLinks.find((link) => link.id === "email")?.handle ?? "";
  const resumeProfileUrl =
    profileLinks.find((link) => link.id === "standard-resume")?.href ?? "";

  const content: PaletteContent[] = [
    ...notes.map((entry) => ({
      id: `note:${entry.id}`,
      kind: "note" as const,
      title: entry.data.title.replace(pagefindSuffix, ""),
      href: noteHref(entry),
      description: entry.data.description,
      date: entry.data.date.toISOString(),
      keywords: [...(entry.data.tags ?? []), "note", "writing", "library"],
    })),
    ...craft.map((entry) => ({
      id: `craft:${entry.id}`,
      kind: "craft" as const,
      title: entry.data.title,
      href: slashPath(`/work/${entry.data.slug}`),
      subtitle: entry.data.note,
      description: entry.data.description,
      date: entry.data.date.toISOString(),
      keywords: [...entry.data.tech, "work", "project", "craft"],
    })),
    ...books.flatMap((entry) => {
      const href = bookHref(entry);
      if (!href) return [];
      return [{
        id: `book:${entry.id}`,
        kind: "book" as const,
        title: entry.data.title,
        href,
        subtitle: entry.data.author,
        description: entry.data.take,
        date: entry.data.date.toISOString(),
        keywords: [...(entry.data.tags ?? []), "book", "reading", entry.data.status],
      }];
    }),
    ...watch.flatMap((entry) => {
      const href = watchHref(entry);
      if (!href) return [];
      return [{
        id: `watch:${entry.id}`,
        kind: "watch" as const,
        title: entry.data.title,
        href,
        subtitle: entry.data.platform,
        description: entry.data.take,
        date: entry.data.date.toISOString(),
        keywords: [...(entry.data.tags ?? []), "watch", "watching", entry.data.status],
      }];
    }),
    ...articles.map((entry) => ({
      id: `article:${entry.id}`,
      kind: "article" as const,
      title: entry.data.title,
      href: entry.data.url,
      subtitle: entry.data.source,
      date: entry.data.date.toISOString(),
      keywords: [...(entry.data.tags ?? []), "article", "link", "read"],
      external: true,
    })),
    ...tagBuckets.map((bucket) => ({
      id: `tag:${bucket.tag}`,
      kind: "tag" as const,
      title: bucket.tag,
      href: tagHref(bucket.tag),
      subtitle: `${bucket.count} linked entr${bucket.count === 1 ? "y" : "ies"}`,
      keywords: ["tag", "topic", "library", bucket.tag],
    })),
  ];

  return {
    version: 1,
    profile: {
      name: site.name,
      siteUrl: site.url,
      email,
      location: site.location,
      locationShort: site.locationShort,
      timeZone: site.timeZone,
      calendarUrl: site.cal,
      resumeUrl: resumeUrl ?? null,
      resumeProfileUrl,
      role: currentRole.role,
      company: currentRole.company,
      repoUrl: site.repoUrl,
      links: profileLinks.map(({ id, platform, handle, href, mail }) => ({
        id,
        label: platform,
        handle,
        href,
        ...(mail ? { mail: true } : {}),
      })),
    },
    content: content.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
    quotes: quotes.map(({ text, author, source }) => ({
      text,
      author,
      ...(source ? { source } : {}),
    })),
    aiResources: [
      { id: "ai-page", label: "AI guide", href: "/ai/", description: "How machine readers should use this site." },
      { id: "design-page", label: "Design", href: "/design/", description: "How Ashwin designs and refines this site." },
      { id: "design-md", label: "Design notes", href: "/design.md", description: "The exact implementation reference." },
      { id: "agent-readiness", label: "Machine readiness", href: "/agent-readiness.md", description: "Discovery surfaces and read-only machine interfaces." },
      { id: "ai-txt", label: "ai.txt", href: "/ai.txt", description: "AI usage declaration." },
      { id: "llms", label: "llms.txt", href: "/llms.txt", description: "Concise machine-readable context." },
      { id: "llms-full", label: "llms-full.txt", href: "/llms-full.txt", description: "Full machine-readable context." },
      { id: "llms-ctx", label: "llms-ctx.txt", href: "/llms-ctx.txt", description: "Compact context for IDE agents." },
      { id: "knowledge", label: "knowledge.json", href: "/knowledge.json", description: "Structured Person data." },
      { id: "ai-summary", label: "ai-summary.json", href: "/api/ai-summary.json", description: "One-object profile summary." },
      { id: "faq", label: "FAQ", href: "/faq/", description: "Fact-bounded questions and answers about the profile and site." },
      { id: "sitemap-markdown", label: "sitemap.md", href: "/sitemap.md", description: "Public page inventory in Markdown." },
      { id: "agents-guide", label: "Agent guide", href: "/.well-known/agents.md", description: "Public discovery, retrieval, and read-only boundary guide." },
      { id: "mcp-card", label: "MCP Server Card", href: "/.well-known/mcp/server-card.json", description: "Read-only MCP endpoint discovery." },
      { id: "mcp-catalog", label: "MCP catalog", href: "/mcp/catalog.json", description: "Read-only tools, resources, prompts, schemas, and annotations." },
      { id: "mcp-status", label: "MCP status", href: "/mcp/status.json", description: "Non-sensitive stateless MCP transport status." },
      { id: "a2a-card", label: "A2A Agent Card", href: "/.well-known/agent-card.json", description: "Read-only A2A skills and AP2 status." },
      { id: "agent-skills", label: "Agent Skills", href: "/.well-known/agent-skills/index.json", description: "Agent Skills Discovery v0.2.0 index." },
      { id: "auth-md", label: "auth.md", href: "/auth.md", description: "Discovery-only authentication guidance." },
    ],
  };
}
