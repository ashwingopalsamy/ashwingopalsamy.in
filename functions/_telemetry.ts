import { buildMeta } from "../src/lib/build";

export interface AnalyticsEngineDataset {
  writeDataPoint(event?: {
    blobs?: (string | null | undefined)[];
    doubles?: (number | null | undefined)[];
    indexes?: (string | ArrayBuffer | ArrayBufferView | null | undefined)[];
  }): void;
}

export interface TelemetryEnv {
  SITE_TELEMETRY?: AnalyticsEngineDataset;
  CF_PAGES_COMMIT_SHA?: string;
  CF_PAGES_BRANCH?: string;
  CF_PAGES_URL?: string;
}

export type ClientClass =
  | "human_browser"
  | "ai_crawler"
  | "search_crawler"
  | "agent_tool"
  | "automated_client"
  | "other";

export type Surface =
  | "page"
  | "markdown"
  | "api"
  | "mcp"
  | "a2a"
  | "telemetry"
  | "agent_doc"
  | "oauth"
  | "static";

export type Representation =
  | "html"
  | "markdown"
  | "json"
  | "problem_json"
  | "sse"
  | "text"
  | "pdf"
  | "binary"
  | "other";

export interface CrawlerInfo {
  isCrawler: boolean;
  name: string;
  operator: string;
  category: "ai" | "search" | "agent" | "scraper" | "none";
}

export interface EdgeTelemetryEvent {
  schema: "site.telemetry.edge/v1";
  timestamp: string;
  requestId: string;
  deploymentSha: string;
  request: {
    method: string;
    path: string;
    route: string;
    surface: Surface;
    clientClass: ClientClass;
    crawler: string;
    operator: string;
    country: string;
    colo: string;
    asn: number;
    referrerHost: string;
    bytes: number;
  };
  response: {
    status: number;
    statusClass: string;
    representation: Representation;
    contentType: string;
    durationMs: number;
    bytes: number;
    tokensEst: number;
    error: boolean;
  };
  protocol?: {
    name: string;
    op: string;
    target: string;
    success: boolean;
    resultCount: number;
  };
}

const KNOWN_AI_CRAWLERS: Array<{ pattern: RegExp; name: string; operator: string }> = [
  { pattern: /gptbot/i, name: "GPTBot", operator: "OpenAI" },
  { pattern: /oai-searchbot/i, name: "OAI-SearchBot", operator: "OpenAI" },
  { pattern: /chatgpt-user/i, name: "ChatGPT-User", operator: "OpenAI" },
  { pattern: /claudebot/i, name: "ClaudeBot", operator: "Anthropic" },
  { pattern: /claude-searchbot/i, name: "Claude-SearchBot", operator: "Anthropic" },
  { pattern: /claude-web/i, name: "Claude-Web", operator: "Anthropic" },
  { pattern: /google-extended/i, name: "Google-Extended", operator: "Google" },
  { pattern: /googleother/i, name: "GoogleOther", operator: "Google" },
  { pattern: /perplexitybot/i, name: "PerplexityBot", operator: "Perplexity" },
  { pattern: /perplexity-user/i, name: "Perplexity-User", operator: "Perplexity" },
  { pattern: /applebot-extended/i, name: "Applebot-Extended", operator: "Apple" },
  { pattern: /bytespider/i, name: "Bytespider", operator: "ByteDance" },
  { pattern: /ccbot/i, name: "CCBot", operator: "Common Crawl" },
  { pattern: /diffbot/i, name: "Diffbot", operator: "Diffbot" },
  { pattern: /cohere-ai/i, name: "Cohere-ai", operator: "Cohere" },
  { pattern: /meta-externalagent/i, name: "Meta-ExternalAgent", operator: "Meta" },
  { pattern: /facebookbot/i, name: "FacebookBot", operator: "Meta" },
  { pattern: /amazonbot/i, name: "Amazonbot", operator: "Amazon" },
];

const KNOWN_SEARCH_CRAWLERS: Array<{ pattern: RegExp; name: string; operator: string }> = [
  { pattern: /googlebot/i, name: "Googlebot", operator: "Google" },
  { pattern: /bingbot/i, name: "Bingbot", operator: "Microsoft" },
  { pattern: /duckduckbot/i, name: "DuckDuckBot", operator: "DuckDuckGo" },
  { pattern: /applebot/i, name: "Applebot", operator: "Apple" },
  { pattern: /yandexbot/i, name: "YandexBot", operator: "Yandex" },
  { pattern: /baiduspider/i, name: "Baiduspider", operator: "Baidu" },
];

const KNOWN_AGENT_TOOLS: Array<{ pattern: RegExp; name: string; operator: string }> = [
  { pattern: /claude-code/i, name: "Claude-Code", operator: "Anthropic" },
  { pattern: /cursor/i, name: "Cursor", operator: "Anysphere" },
  { pattern: /aider/i, name: "Aider", operator: "Paul Gauthier" },
  { pattern: /copilot/i, name: "GitHub-Copilot", operator: "GitHub" },
  { pattern: /python-requests/i, name: "python-requests", operator: "Python" },
  { pattern: /python-urllib/i, name: "python-urllib", operator: "Python" },
  { pattern: /node-fetch/i, name: "node-fetch", operator: "Node.js" },
  { pattern: /undici/i, name: "undici", operator: "Node.js" },
  { pattern: /axios/i, name: "axios", operator: "JavaScript" },
  { pattern: /curl/i, name: "curl", operator: "cURL" },
  { pattern: /wget/i, name: "Wget", operator: "GNU" },
  { pattern: /postman/i, name: "Postman", operator: "Postman" },
  { pattern: /insomnia/i, name: "Insomnia", operator: "Kong" },
  { pattern: /go-http-client/i, name: "Go-http-client", operator: "Go" },
];

export function classifyCrawler(userAgent: string | null | undefined): CrawlerInfo {
  if (!userAgent) {
    return { isCrawler: false, name: "none", operator: "none", category: "none" };
  }

  for (const entry of KNOWN_AI_CRAWLERS) {
    if (entry.pattern.test(userAgent)) {
      return { isCrawler: true, name: entry.name, operator: entry.operator, category: "ai" };
    }
  }

  for (const entry of KNOWN_SEARCH_CRAWLERS) {
    if (entry.pattern.test(userAgent)) {
      return { isCrawler: true, name: entry.name, operator: entry.operator, category: "search" };
    }
  }

  for (const entry of KNOWN_AGENT_TOOLS) {
    if (entry.pattern.test(userAgent)) {
      return { isCrawler: true, name: entry.name, operator: entry.operator, category: "agent" };
    }
  }

  if (/bot|crawl|spider|slurp|archiver/i.test(userAgent)) {
    return { isCrawler: true, name: "GenericBot", operator: "unknown", category: "scraper" };
  }

  return { isCrawler: false, name: "none", operator: "none", category: "none" };
}

export function classifyClient(userAgent: string | null | undefined, crawler: CrawlerInfo): ClientClass {
  if (crawler.category === "ai") return "ai_crawler";
  if (crawler.category === "search") return "search_crawler";
  if (crawler.category === "agent") return "agent_tool";
  if (crawler.category === "scraper") return "automated_client";
  if (!userAgent) return "other";
  if (/mozilla|chrome|safari|firefox|edge|opera/i.test(userAgent)) return "human_browser";
  return "other";
}

export function normalizeRoute(pathname: string): string {
  let clean = pathname.replace(/\/+$/, "") || "/";
  if (clean.startsWith("/blog/")) {
    const rest = clean.slice(6);
    if (rest.endsWith(".md")) return "/blog/[slug].md";
    return "/blog/[slug]";
  }
  if (clean.startsWith("/library/notes/")) {
    const rest = clean.slice(15);
    if (rest.endsWith(".md")) return "/library/notes/[slug].md";
    return "/library/notes/[slug]";
  }
  if (clean.startsWith("/library/tags/")) return "/library/tags/[tag]";
  if (clean.startsWith("/library/books/")) return "/library/books/[slug]";
  if (clean.startsWith("/library/watch/")) return "/library/watch/[slug]";
  if (clean.startsWith("/work/")) return "/work/[slug]";
  if (clean.startsWith("/craft/")) return "/craft/[slug]";
  if (clean.startsWith("/api/v1/notes/")) return "/api/v1/notes/[slug]";
  if (clean.startsWith("/og/")) return "/og/[slug].png";
  return clean;
}

export function classifySurface(pathname: string): Surface {
  if (pathname === "/mcp" || pathname.startsWith("/mcp/")) return "mcp";
  if (pathname === "/a2a" || pathname.startsWith("/a2a/")) return "a2a";
  if (pathname === "/api/v1/telemetry") return "telemetry";
  if (pathname.startsWith("/api/") || pathname === "/api") return "api";
  if (pathname.startsWith("/oauth/") || pathname.startsWith("/agent/auth")) return "oauth";
  if (
    pathname === "/llms.txt" ||
    pathname === "/llms-full.txt" ||
    pathname === "/llms-ctx.txt" ||
    pathname === "/ai.txt" ||
    pathname === "/robots.txt" ||
    pathname === "/humans.txt" ||
    pathname === "/security.txt" ||
    pathname === "/openapi.json" ||
    pathname === "/knowledge.json" ||
    pathname.startsWith("/.well-known/")
  ) {
    return "agent_doc";
  }
  if (pathname.endsWith(".md") || pathname.includes("/__agent-markdown/")) return "markdown";
  return "page";
}

export function classifyRepresentation(contentType: string | null | undefined): Representation {
  if (!contentType) return "other";
  const lower = contentType.toLowerCase();
  if (lower.includes("text/html")) return "html";
  if (lower.includes("text/markdown")) return "markdown";
  if (lower.includes("application/problem+json")) return "problem_json";
  if (lower.includes("application/json")) return "json";
  if (lower.includes("text/event-stream")) return "sse";
  if (lower.includes("text/plain")) return "text";
  if (lower.includes("application/pdf")) return "pdf";
  if (lower.includes("image/") || lower.includes("font/") || lower.includes("octet-stream")) return "binary";
  return "other";
}

export function sanitizeReferrer(referrer: string | null | undefined, siteOrigin = "https://ashwingopalsamy.in"): string {
  if (!referrer) return "direct";
  try {
    const url = new URL(referrer);
    const host = url.hostname.toLowerCase();
    const siteHost = new URL(siteOrigin).hostname.toLowerCase();
    if (host === siteHost || host.endsWith(`.${siteHost}`)) return "self";
    return host.slice(0, 96);
  } catch {
    return "direct";
  }
}

export function generateCorrelationId(request: Request): string {
  const cfRay = request.headers.get("cf-ray");
  if (cfRay && /^[a-zA-Z0-9_-]+$/.test(cfRay)) {
    return cfRay.slice(0, 32);
  }
  const randomPart = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, "").slice(0, 16)
    : Math.random().toString(36).slice(2, 18);
  return `req_${randomPart}`;
}

export function getDeploymentSha(env?: TelemetryEnv): string {
  const envSha = env?.CF_PAGES_COMMIT_SHA;
  if (envSha) return envSha.slice(0, 7);
  return buildMeta.commit ?? "local";
}

export function recordToAnalyticsEngine(
  dataset: AnalyticsEngineDataset | undefined,
  event: {
    eventType: string;
    surface: string;
    route: string;
    method: string;
    statusCode: number;
    representation: string;
    clientClass: string;
    crawlerName: string;
    crawlerOperator: string;
    country: string;
    colo: string;
    referrerHost: string;
    protocolOp?: string;
    targetName?: string;
    success: boolean;
    deploymentSha: string;
    correlationId: string;
    durationMs: number;
    requestBytes?: number;
    responseBytes?: number;
    resultCount?: number;
    tokensEst?: number;
    sampleRate?: number;
  },
): void {
  if (!dataset || typeof dataset.writeDataPoint !== "function") return;
  try {
    dataset.writeDataPoint({
      indexes: [event.surface.slice(0, 96)],
      blobs: [
        event.eventType.slice(0, 32),
        event.surface.slice(0, 32),
        event.route.slice(0, 128),
        event.method.slice(0, 16),
        String(event.statusCode),
        event.representation.slice(0, 32),
        event.clientClass.slice(0, 32),
        event.crawlerName.slice(0, 48),
        event.crawlerOperator.slice(0, 48),
        event.country.slice(0, 8),
        event.colo.slice(0, 8),
        event.referrerHost.slice(0, 96),
        (event.protocolOp ?? "none").slice(0, 48),
        (event.targetName ?? "none").slice(0, 96),
        event.success ? "1" : "0",
        event.deploymentSha.slice(0, 16),
        event.correlationId.slice(0, 32),
      ],
      doubles: [
        Math.max(0, Math.round(event.durationMs)),
        Math.max(0, event.requestBytes ?? 0),
        Math.max(0, event.responseBytes ?? 0),
        Math.max(0, event.resultCount ?? 0),
        Math.max(0, event.tokensEst ?? 0),
        event.sampleRate ?? 1.0,
      ],
    });
  } catch {
    return;
  }
}

export function emitEdgeTelemetry(
  request: Request,
  response: Response,
  startTime: number,
  env: TelemetryEnv | undefined,
  correlationId: string,
  protocolMeta?: {
    name: string;
    op: string;
    target: string;
    success: boolean;
    resultCount: number;
  },
): void {
  const durationMs = Math.max(0, performance.now() - startTime);
  const url = new URL(request.url);
  const pathname = url.pathname;
  const route = normalizeRoute(pathname);
  const surface = classifySurface(pathname);
  const userAgent = request.headers.get("User-Agent");
  const crawler = classifyCrawler(userAgent);
  const clientClass = classifyClient(userAgent, crawler);
  const contentType = response.headers.get("Content-Type") ?? "";
  const representation = classifyRepresentation(contentType);
  const referrerHost = sanitizeReferrer(request.headers.get("Referer"));
  const deploymentSha = getDeploymentSha(env);

  const requestCf = (request as unknown as { cf?: Record<string, unknown> }).cf;
  const country = typeof requestCf?.country === "string" ? requestCf.country : "XX";
  const colo = typeof requestCf?.colo === "string" ? requestCf.colo : "UNKNOWN";
  const asn = typeof requestCf?.asn === "number" ? requestCf.asn : 0;

  const contentLength = Number.parseInt(response.headers.get("Content-Length") ?? "0", 10);
  const responseBytes = Number.isFinite(contentLength) && contentLength > 0 ? contentLength : 0;
  const reqContentLength = Number.parseInt(request.headers.get("Content-Length") ?? "0", 10);
  const requestBytes = Number.isFinite(reqContentLength) && reqContentLength > 0 ? reqContentLength : 0;

  const markdownTokensHeader = response.headers.get("x-markdown-tokens");
  const tokensEst = markdownTokensHeader ? Number.parseInt(markdownTokensHeader, 10) || 0 : 0;

  const status = response.status;
  const statusClass = `${Math.floor(status / 100)}xx`;
  const isError = status >= 400;

  const telemetryEvent: EdgeTelemetryEvent = {
    schema: "site.telemetry.edge/v1",
    timestamp: new Date().toISOString(),
    requestId: correlationId,
    deploymentSha,
    request: {
      method: request.method,
      path: pathname,
      route,
      surface,
      clientClass,
      crawler: crawler.name,
      operator: crawler.operator,
      country,
      colo,
      asn,
      referrerHost,
      bytes: requestBytes,
    },
    response: {
      status,
      statusClass,
      representation,
      contentType,
      durationMs: Math.round(durationMs * 100) / 100,
      bytes: responseBytes,
      tokensEst,
      error: isError,
    },
    ...(protocolMeta ? { protocol: protocolMeta } : {}),
  };

  try {
    console.log(JSON.stringify(telemetryEvent));
  } catch {
    return;
  }

  recordToAnalyticsEngine(env?.SITE_TELEMETRY, {
    eventType: protocolMeta ? `${protocolMeta.name}_${protocolMeta.op}` : "edge_request",
    surface,
    route,
    method: request.method,
    statusCode: status,
    representation,
    clientClass,
    crawlerName: crawler.name,
    crawlerOperator: crawler.operator,
    country,
    colo,
    referrerHost,
    protocolOp: protocolMeta?.op,
    targetName: protocolMeta?.target,
    success: protocolMeta ? protocolMeta.success : !isError,
    deploymentSha,
    correlationId,
    durationMs,
    requestBytes,
    responseBytes,
    resultCount: protocolMeta?.resultCount ?? (isError ? 0 : 1),
    tokensEst,
    sampleRate: 1.0,
  });
}
