export interface ProfileSummary {
  name: string;
  role: string;
  employer: string;
  location: string;
  primaryLanguage: string;
  summary: string;
  knowsAbout?: string[];
  links?: {
    home: string;
    ai: string;
    design: string;
  };
}

export interface PaletteItem {
  id: string;
  kind: string;
  title: string;
  href: string;
  description?: string;
  keywords?: string[];
}

export interface SearchResults {
  query: string;
  total: number;
  results: PaletteItem[];
}

export type ContentKind = "all" | "note" | "craft" | "book" | "watch" | "article";

export interface ContentList {
  kind: string;
  count: number;
  items: PaletteItem[];
}

export interface NoteMarkdown {
  slug: string;
  markdown: string;
}

export interface ApiStatus {
  service: string;
  version: string;
  apiVersion: string;
  status: string;
  mode: string;
  rateLimit: {
    limit: number;
    windowSeconds: number;
    policy: string;
  };
  versioning: {
    strategy: string;
    current: string;
    deprecationPolicy: string;
    sunsetHeader?: string;
    deprecationHeader?: string;
  };
  capabilities: {
    profile: boolean;
    search: boolean;
    contentListing: boolean;
    noteMarkdown: boolean;
    mcp: boolean;
    a2a: boolean;
  };
  links: {
    openapi: string;
    developers: string;
    mcp: string;
    a2a: string;
    llms: string;
  };
}

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: string;
  resolution_hint: string;
  instance?: string;
}

export interface ClientOptions {
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  headers?: Record<string, string>;
}
