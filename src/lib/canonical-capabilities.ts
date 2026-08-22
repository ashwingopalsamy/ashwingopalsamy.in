import { z } from "zod";
import { CANONICAL_KNOWLEDGE } from "../data/canonical-knowledge";

export const CAPABILITY_SERVER_INFO = {
  name: "ashwingopalsamy.in",
  version: "1.0.0",
} as const;

export const CAPABILITY_PROTOCOL_VERSION = "2026-07-28";
export const CAPABILITY_DESCRIPTION = "Read-only discovery tools for Ashwin Gopalsamy's site.";

export const CAPABILITY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  untrustedContentHint: false,
} as const;

export const FIRST_PARTY_TOOL_NAMES = [
  "search_site",
  "get_profile",
  "list_content",
  "get_note_markdown",
] as const;

export type FirstPartyToolName = (typeof FIRST_PARTY_TOOL_NAMES)[number];

export const searchSiteZodSchema = z.object({
  query: z.string().describe("Search phrase"),
  limit: z.number().int().min(1).max(25).optional(),
});

export const getProfileZodSchema = z.object({});

export const listContentZodSchema = z.object({
  kind: z
    .string()
    .optional()
    .describe("Content kind such as note, craft, book, watch, article, tag, or all"),
  limit: z.number().int().min(1).max(25).optional(),
});

export const getNoteMarkdownZodSchema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]*$/i).describe("Published note slug"),
});

export function jsonSchemaFromZod(schema: z.ZodType): Record<string, unknown> {
  return z.toJSONSchema(schema) as Record<string, unknown>;
}

export const TOOL_SCHEMAS = {
  searchSite: {
    name: "search_site" as const,
    description: "Search the public site content manifest.",
    zodSchema: searchSiteZodSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
      untrustedContentHint: true,
    },
    get jsonSchema() {
      return jsonSchemaFromZod(searchSiteZodSchema);
    },
  },
  getProfile: {
    name: "get_profile" as const,
    description: "Return the authoritative public profile summary.",
    zodSchema: getProfileZodSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
      untrustedContentHint: false,
    },
    get jsonSchema() {
      return jsonSchemaFromZod(getProfileZodSchema);
    },
  },
  listContent: {
    name: "list_content" as const,
    description: "List public content from the site manifest.",
    zodSchema: listContentZodSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
      untrustedContentHint: false,
    },
    get jsonSchema() {
      return jsonSchemaFromZod(listContentZodSchema);
    },
  },
  getNoteMarkdown: {
    name: "get_note_markdown" as const,
    description: "Return a published note's raw Markdown by allowlisted slug.",
    zodSchema: getNoteMarkdownZodSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
      untrustedContentHint: false,
    },
    get jsonSchema() {
      return jsonSchemaFromZod(getNoteMarkdownZodSchema);
    },
  },
} as const;

export const CANONICAL_RESOURCES = [
  {
    name: "profile-summary",
    uri: `${CANONICAL_KNOWLEDGE.origin}/api/ai-summary.json`,
    title: "Authoritative profile summary",
    description: "The site's canonical machine-readable profile summary.",
    mimeType: "application/json",
  },
  {
    name: "content-manifest",
    uri: `${CANONICAL_KNOWLEDGE.origin}/api/palette.json`,
    title: "Public content manifest",
    description: "The read-only searchable content manifest.",
    mimeType: "application/json",
  },
] as const;

export const CANONICAL_PROMPTS = {
  profileBriefing: {
    name: "profile-briefing",
    title: "Profile briefing",
    description: "Prepare a concise briefing from the authoritative profile.",
    argsSchema: z.object({ focus: z.string().optional() }),
  },
} as const;

export const CANONICAL_MCP_DISCOVERY = {
  serverCard: `${CANONICAL_KNOWLEDGE.origin}/.well-known/mcp/server-card.json`,
  legacyManifest: `${CANONICAL_KNOWLEDGE.origin}/.well-known/mcp.json`,
  status: `${CANONICAL_KNOWLEDGE.origin}/mcp/status.json`,
  catalog: `${CANONICAL_KNOWLEDGE.origin}/mcp/catalog.json`,
} as const;

export const CANONICAL_PUBLIC_DATA = {
  profile: `${CANONICAL_KNOWLEDGE.origin}/api/ai-summary.json`,
  contentManifest: `${CANONICAL_KNOWLEDGE.origin}/api/palette.json`,
  noteMarkdown: `${CANONICAL_KNOWLEDGE.origin}/blog/{slug}.md`,
} as const;
