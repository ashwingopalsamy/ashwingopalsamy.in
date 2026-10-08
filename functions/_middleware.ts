/**
 * RFC 9421 HTTP Message Signatures for HTML GET responses and edge middleware.
 *
 * When SIGNATURE_PRIVATE_KEY is set (Cloudflare Pages secret - JWK JSON with
 * Ed25519 `d`+`x`, matching /.well-known/http-message-signatures-directory),
 * each HTML response is buffered, digest-tagged, and signed over
 * @method + @path + content-digest. Absent key -> clean pass-through so local
 * preview and pure-static deploys stay unsigned.
 */

import {
  applySecurityHeaders,
  CSP_REPORT_PATH,
  STRICT_CSP_REPORT_ONLY,
  strictCspDirectives,
} from "../src/lib/security-headers";
import coreMarkdownMirrors from "../src/data/core-markdown-mirrors.json";
import { API_VERSION } from "./_api-response";
import {
  emitEdgeTelemetry,
  generateCorrelationId,
  type TelemetryEnv,
} from "./_telemetry";

const KEY_ID = "7SRZzy6CqMvWeWIb6HRcmXQA3TDHTCGcoa7SzLpfPMw";
const PUB_X = "G1vVWVBlUFdXVz1reXiKNZz4drxF2-FKtNDBpAoyul8";

interface Env extends TelemetryEnv {
  SIGNATURE_PRIVATE_KEY?: string;
  ASSETS?: {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  };
}

interface PagesContext {
  request: Request;
  next: (input?: Request | string, init?: RequestInit) => Promise<Response>;
  env: Env;
  waitUntil?: (promise: Promise<unknown>) => void;
}

let cachedKeyMaterial: string | null = null;
let cachedCryptoKey: CryptoKey | null = null;

function bytesToBase64(bytes: ArrayBuffer | Uint8Array): string {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!);
  return btoa(s);
}

function sfByteSequence(bytes: ArrayBuffer): string {
  return `:${bytesToBase64(bytes)}:`;
}

async function sha256(data: ArrayBuffer): Promise<ArrayBuffer> {
  return crypto.subtle.digest("SHA-256", data);
}

async function importSigningKey(raw: string): Promise<CryptoKey | null> {
  try {
    const jwk = JSON.parse(raw) as JsonWebKey;
    if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || !jwk.d) return null;
    if (jwk.x && jwk.x !== PUB_X) return null;
    return await crypto.subtle.importKey(
      "jwk",
      {
        kty: "OKP",
        crv: "Ed25519",
        alg: "EdDSA",
        key_ops: ["sign"],
        ext: true,
        d: jwk.d,
        x: jwk.x ?? PUB_X,
      },
      { name: "Ed25519" },
      false,
      ["sign"],
    );
  } catch {
    return null;
  }
}

async function getOrCreateSigningKey(raw: string): Promise<CryptoKey | null> {
  if (raw === cachedKeyMaterial && cachedCryptoKey) {
    return cachedCryptoKey;
  }
  const key = await importSigningKey(raw);
  if (key) {
    cachedKeyMaterial = raw;
    cachedCryptoKey = key;
  }
  return key;
}

function buildSignatureBase(
  method: string,
  path: string,
  contentDigest: string,
  params: string,
): string {
  return [
    `"@method": ${method}`,
    `"@path": ${path}`,
    `"content-digest": ${contentDigest}`,
    `"@signature-params": ${params}`,
  ].join("\n");
}

function acceptsMarkdown(header: string | null): boolean {
  if (!header) return false;
  return header.split(",").some((part) => {
    const [media, ...parameters] = part.trim().toLowerCase().split(";");
    if (media?.trim() !== "text/markdown") return false;
    const quality = parameters.find((parameter) => parameter.trim().startsWith("q="));
    if (!quality) return true;
    const value = Number(quality.trim().slice(2));
    return Number.isFinite(value) && value > 0;
  });
}

function acceptsJson(header: string | null): boolean {
  if (!header) return false;
  return header.split(",").some((part) => {
    const [media, ...parameters] = part.trim().toLowerCase().split(";");
    if (media?.trim() !== "application/json" && media?.trim() !== "application/problem+json") return false;
    const quality = parameters.find((parameter) => parameter.trim().startsWith("q="));
    if (!quality) return true;
    const value = Number(quality.trim().slice(2));
    return Number.isFinite(value) && value > 0;
  });
}

function jsonProblemResponse(status: number, requestUrl: string, correlationId: string): Response {
  const is404 = status === 404;
  const title = is404 ? "Resource Not Found" : "Request Error";
  const detail = is404
    ? "The requested API resource or path was not found on this server."
    : `An error occurred while processing the request with HTTP status ${status}.`;
  const code = is404 ? "resource_not_found" : `http_error_${status}`;
  const resolutionHint = is404
    ? "Verify the endpoint URL, inspect the OpenAPI 3.1.0 specification at /openapi.json, or browse developer documentation at /developers.md."
    : "Review request parameters and ensure they match the OpenAPI specification at /openapi.json.";

  let headers = applySecurityHeaders(new Headers(), "json-api-public");
  headers.set("Content-Type", "application/problem+json; charset=utf-8");
  headers.set("API-Version", API_VERSION);
  headers.set("Access-Control-Expose-Headers", "API-Version");
  headers.set("X-Robots-Tag", "noindex");
  headers.set("X-Request-Id", correlationId);
  if (status === 429) headers.set("Retry-After", "60");

  const problem = {
    type: "https://ashwingopalsamy.in/developers#errors",
    title,
    status,
    detail,
    code,
    resolution_hint: resolutionHint,
    instance: requestUrl,
  };

  return new Response(`${JSON.stringify(problem)}\n`, {
    status,
    headers,
  });
}

const CORE_MARKDOWN_MIRRORS: Record<string, string> = coreMarkdownMirrors;
const NOTE_PATH = /^\/blog\/([a-z0-9][a-z0-9-]*)\/$/i;

function markdownAssetPath(pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("..")) return null;
  let path = decoded.endsWith(".html") ? decoded.slice(0, -5) : decoded;
  if (!path.endsWith("/")) path += "/";
  const core = CORE_MARKDOWN_MIRRORS[path];
  if (core) return core;
  const note = NOTE_PATH.exec(path);
  return note ? `/blog/${note[1]}.md` : null;
}

function appendVary(headers: Headers, value: string): void {
  const current = headers.get("Vary");
  if (!current) {
    headers.set("Vary", value);
    return;
  }
  const values = current.split(",").map((part) => part.trim().toLowerCase());
  if (!values.includes(value.toLowerCase())) headers.set("Vary", `${current}, ${value}`);
}

function applyContentSignal(headers: Headers, request: Request): void {
  const userAgent = request.headers.get("User-Agent") ?? "";
  const blocked = /bytespider|ccbot/i.test(userAgent);
  headers.set(
    "Content-Signal",
    blocked ? "ai-train=no, search=no, ai-input=no" : "ai-train=yes, search=yes, ai-input=yes",
  );
}

async function markdownResponse(
  source: Response,
  htmlHeaders: Headers,
  context: PagesContext,
): Promise<Response | null> {
  const assetPath = markdownAssetPath(new URL(context.request.url).pathname);
  if (!assetPath) return null;

  const assets = context.env.ASSETS;
  let mirror: Response;
  try {
    const assetUrl = new URL(assetPath, context.request.url);
    mirror = assets
      ? await assets.fetch(assetUrl)
      : await fetch(assetUrl);
  } catch {
    return null;
  }
  if (!mirror.ok) return null;

  const body = await mirror.arrayBuffer();
  const text = new TextDecoder().decode(body);
  let headers = applySecurityHeaders(new Headers(htmlHeaders), "markdown");
  const canonical = new URL(context.request.url);
  canonical.search = "";
  canonical.hash = "";
  headers.set("Content-Type", "text/markdown; charset=utf-8");
  headers.set("Link", `<${canonical.href}>; rel="canonical"`);
  appendVary(headers, "Accept");
  headers.set("x-markdown-tokens", String(Math.max(1, Math.ceil(text.length / 4))));
  for (const name of [
    "Content-Encoding",
    "Content-Length",
    "Content-Range",
    "ETag",
    "Last-Modified",
    "Transfer-Encoding",
    "Content-Digest",
    "Signature-Input",
    "Signature",
  ]) {
    headers.delete(name);
  }

  return new Response(context.request.method === "HEAD" ? null : body, {
    status: source.status,
    statusText: source.statusText,
    headers,
  });
}

/** Document requests drop their validators: every HTML body carries a fresh
 *  nonce, so a 304 must never pair a cached body with a new policy. */
function withoutValidators(req: Request): Request {
  if (!req.headers.has("If-None-Match") && !req.headers.has("If-Modified-Since")) return req;
  const isDocument = req.headers.get("Sec-Fetch-Dest") === "document" ||
    (req.headers.get("Accept") ?? "").includes("text/html");
  if (!isDocument) return req;
  const headers = new Headers(req.headers);
  headers.delete("If-None-Match");
  headers.delete("If-Modified-Since");
  return new Request(req, { headers });
}

function cspNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return bytesToBase64(bytes);
}

/** The strict policy plus one nonce stamped on every script and style
 *  element, streamed through HTMLRewriter (no buffering). */
function stampNonce(raw: Response, headers: Headers): Response {
  const nonce = cspNonce();
  headers.set(
    STRICT_CSP_REPORT_ONLY ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy",
    strictCspDirectives(nonce),
  );
  headers.set("Reporting-Endpoints", `csp="${CSP_REPORT_PATH}"`);
  for (const name of ["ETag", "Last-Modified", "Content-Length"]) headers.delete(name);
  headers.set("Cache-Control", "private, no-cache");
  return new HTMLRewriter()
    .on("script, style", {
      element(element) {
        element.setAttribute("nonce", nonce);
      },
    })
    .transform(raw);
}

async function resolveResponse(context: PagesContext, correlationId: string): Promise<Response> {
  const req = context.request;
  const raw = await context.next(withoutValidators(req));
  const isHtml = (raw.headers.get("content-type") ?? "").toLowerCase().includes("text/html");
  const accept = req.headers.get("Accept");
  const wantsMarkdown = isHtml && acceptsMarkdown(accept);
  const methodSupportsNegotiation = req.method === "GET" || req.method === "HEAD";

  if (isHtml && raw.status >= 400 && !wantsMarkdown) {
    const { pathname } = new URL(req.url);
    if (pathname.startsWith("/api/") || pathname === "/api" || acceptsJson(accept)) {
      return jsonProblemResponse(raw.status, req.url, correlationId);
    }
  }

  // One mutable header set, one Response construction per request.
  const headers = new Headers(raw.headers);
  applyContentSignal(headers, req);
  const negotiated = isHtml && (methodSupportsNegotiation || (raw.status >= 400 && wantsMarkdown));
  if (negotiated) {
    applySecurityHeaders(headers, "html");
    appendVary(headers, "Accept");
  }
  // Content-Signal differs by User-Agent, so shared caches must key on it.
  if (isHtml) appendVary(headers, "User-Agent");
  if (!headers.has("X-Request-Id")) headers.set("X-Request-Id", correlationId);

  if (negotiated) {
    if (wantsMarkdown) {
      const markdown = await markdownResponse(raw, headers, context);
      if (markdown) return markdown;
    }
    const stamped = stampNonce(raw, headers);
    if (context.env.SIGNATURE_PRIVATE_KEY) {
      const signed = await signHtmlResponse(stamped, headers, context);
      if (signed) return signed;
    }
    return new Response(stamped.body, {
      status: raw.status,
      statusText: raw.statusText,
      headers,
    });
  }

  return new Response(raw.body, {
    status: raw.status,
    statusText: raw.statusText,
    headers,
  });
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const startTime = performance.now();
  const req = context.request;
  const correlationId = generateCorrelationId(req);

  const finalResponse = await resolveResponse(context, correlationId);

  const emit = () => emitEdgeTelemetry(req, finalResponse, startTime, context.env, correlationId);
  if (context.waitUntil) context.waitUntil(Promise.resolve().then(emit));
  else emit();
  return finalResponse;
};

/** Returns null (body untouched) when the response is not signable. */
async function signHtmlResponse(
  source: Response,
  headers: Headers,
  context: PagesContext,
): Promise<Response | null> {
  const keyMaterial = context.env.SIGNATURE_PRIVATE_KEY;
  if (!keyMaterial) return null;

  const req = context.request;
  if (req.method !== "GET") return null;

  const ct = headers.get("content-type") ?? "";
  if (!ct.toLowerCase().includes("text/html")) return null;

  const key = await getOrCreateSigningKey(keyMaterial);
  if (!key) return null;

  const body = await source.arrayBuffer();
  const digest = await sha256(body);
  const contentDigest = `sha-256=${sfByteSequence(digest)}`;

  const url = new URL(req.url);
  const path = url.pathname || "/";
  const created = Math.floor(Date.now() / 1000);
  const covered = `("@method" "@path" "content-digest")`;
  const params = `${covered};created=${created};keyid="${KEY_ID}";alg="ed25519"`;
  const base = buildSignatureBase(req.method, path, contentDigest, params);
  const sig = await crypto.subtle.sign(
    "Ed25519",
    key,
    new TextEncoder().encode(base),
  );

  headers.set("Content-Digest", contentDigest);
  headers.set("Signature-Input", `sig=${params}`);
  headers.set("Signature", `sig=${sfByteSequence(sig)}`);

  return new Response(body, {
    status: source.status,
    statusText: source.statusText,
    headers,
  });
}
