import type {
  ApiStatus,
  ClientOptions,
  ContentKind,
  ContentList,
  NoteMarkdown,
  ProfileSummary,
  SearchResults,
} from "./types.js";

export class AshwinGopalsamyError extends Error {
  public status: number;
  public code?: string;
  public resolutionHint?: string;

  constructor(message: string, status: number, code?: string, resolutionHint?: string) {
    super(message);
    this.name = "AshwinGopalsamyError";
    this.status = status;
    this.code = code;
    this.resolutionHint = resolutionHint;
  }
}

export class AshwinGopalsamyClient {
  private baseUrl: string;
  private fetchFn: typeof globalThis.fetch;
  private defaultHeaders: Record<string, string>;

  constructor(options: ClientOptions = {}) {
    this.baseUrl = (options.baseUrl || "https://ashwingopalsamy.in").replace(/\/+$/, "");
    this.fetchFn = options.fetch || globalThis.fetch.bind(globalThis);
    this.defaultHeaders = {
      Accept: "application/json",
      "User-Agent": "@ashwingopalsamy/sdk/1.0.0",
      ...options.headers,
    };
  }

  private async request<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const response = await this.fetchFn(url.toString(), {
      headers: this.defaultHeaders,
    });

    if (!response.ok) {
      let parsed: any;
      try {
        parsed = await response.json();
      } catch {
        parsed = null;
      }
      const message =
        parsed?.detail || parsed?.message || parsed?.title || `HTTP ${response.status}: ${response.statusText}`;
      throw new AshwinGopalsamyError(
        message,
        response.status,
        parsed?.code,
        parsed?.resolution_hint,
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Fetch authoritative profile summary and career facts for Ashwin Gopalsamy.
   */
  public async getProfile(): Promise<ProfileSummary> {
    return this.request<ProfileSummary>("/api/v1/profile");
  }

  /**
   * Search published technical notes, craft projects, and reading list entries.
   */
  public async searchSite(query?: string, limit = 10): Promise<SearchResults> {
    return this.request<SearchResults>("/api/v1/search", { query, limit });
  }

  /**
   * List public entries filtered by kind (all, note, craft, book, watch, article).
   */
  public async listContent(kind: ContentKind = "all", limit = 20): Promise<ContentList> {
    return this.request<ContentList>("/api/v1/content", { kind, limit });
  }

  /**
   * Retrieve raw Markdown content and slug for a published note.
   */
  public async getNoteMarkdown(slug: string): Promise<NoteMarkdown> {
    return this.request<NoteMarkdown>(`/api/v1/notes/${encodeURIComponent(slug)}`);
  }

  /**
   * Check operational status, rate limits, and protocol links.
   */
  public async getStatus(): Promise<ApiStatus> {
    return this.request<ApiStatus>("/api/v1/status");
  }
}
