/**
 * RFC 9421 HTTP Message Signatures for HTML GET responses and edge middleware.
 *
 * When SIGNATURE_PRIVATE_KEY is set (Cloudflare Pages secret - JWK JSON with
 * Ed25519 `d`+`x`, matching /.well-known/http-message-signatures-directory),
 * each HTML response is buffered, digest-tagged, and signed over
 * @method + @path + content-digest. Absent key -> clean pass-through so local
 * preview and pure-static deploys stay unsigned.
 */

import { applySecurityHeaders } from "../src/lib/security-headers";
import { applyRateLimitHeaders } from "./_unavailable";
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
  next: () => Promise<Response>;
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

function jsonProblemResponse(status: number, requestUrl: string): Response {
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
  headers = applyRateLimitHeaders(headers);
  headers.set("Content-Type", "application/problem+json; charset=utf-8");
  headers.set("API-Version", API_VERSION);
  headers.set("X-Robots-Tag", "noindex");
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

function markdownAssetPath(pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (decoded.includes("..")) return null;
  let clean = decoded.replace(/^\/+|\/+$/g, "");
  if (clean.endsWith(".html")) clean = clean.slice(0, -5);
  return clean ? `/__agent-markdown/${clean}/index.md` : "/__agent-markdown/index.md";
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

function applyContentSignals(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);
  const userAgent = request.headers.get("User-Agent") ?? "";
  const blocked = /bytespider|ccbot/i.test(userAgent);
  headers.set(
    "Content-Signal",
    blocked ? "ai-train=no, search=no, ai-input=no" : "ai-train=yes, search=yes, ai-input=yes",
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function markdownResponse(
  response: Response,
  context: PagesContext,
): Promise<Response> {
  const assetPath = markdownAssetPath(new URL(context.request.url).pathname);
  const assets = context.env.ASSETS;
  if (!assetPath) return response;

  let mirror: Response;
  try {
    const assetUrl = new URL(assetPath, context.request.url);
    mirror = assets
      ? await assets.fetch(assetUrl)
      : await fetch(assetUrl);
  } catch {
    return response;
  }
  if (!mirror.ok) {
    if (response.status === 404) {
      try {
        const notFoundUrl = new URL("/__agent-markdown/404/index.md", context.request.url);
        const notFoundMirror = assets ? await assets.fetch(notFoundUrl) : await fetch(notFoundUrl);
        if (notFoundMirror.ok) {
          mirror = notFoundMirror;
        } else {
          return response;
        }
      } catch {
        return response;
      }
    } else {
      return response;
    }
  }

  const body = await mirror.arrayBuffer();
  const text = new TextDecoder().decode(body);
  let headers = applySecurityHeaders(new Headers(response.headers), "markdown");
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
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const startTime = performance.now();
  const req = context.request;
  const correlationId = generateCorrelationId(req);

  const resolveResponse = async (): Promise<Response> => {
    const rawResponse = await context.next();
    const response = applyContentSignals(rawResponse, req);
    const responseType = response.headers.get("content-type") ?? "";
    const isHtml = responseType.toLowerCase().includes("text/html");
    const methodSupportsNegotiation = req.method === "GET" || req.method === "HEAD";
    const url = new URL(req.url);
    const isApiRoute = url.pathname.startsWith("/api/") || url.pathname === "/api";

    if (response.status >= 400 && isHtml) {
      if (acceptsMarkdown(req.headers.get("Accept"))) {
        let headers = applySecurityHeaders(new Headers(response.headers), "html");
        const varied = new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers,
        });
        appendVary(varied.headers, "Accept");
        return markdownResponse(varied, context);
      }
      if (isApiRoute || acceptsJson(req.headers.get("Accept"))) {
        return jsonProblemResponse(response.status, req.url);
      }
    }

    if (methodSupportsNegotiation && isHtml) {
      let headers = applySecurityHeaders(new Headers(response.headers), "html");
      const varied = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
      appendVary(varied.headers, "Accept");
      if (acceptsMarkdown(req.headers.get("Accept"))) {
        return markdownResponse(varied, context);
      }
      if (!context.env.SIGNATURE_PRIVATE_KEY) return varied;
      return signHtmlResponse(varied, context);
    }

    return response;
  };

  let finalResponse = await resolveResponse();
  if (!finalResponse.headers.has("X-Request-Id")) {
    const headers = new Headers(finalResponse.headers);
    headers.set("X-Request-Id", correlationId);
    finalResponse = new Response(finalResponse.body, {
      status: finalResponse.status,
      statusText: finalResponse.statusText,
      headers,
    });
  }

  emitEdgeTelemetry(req, finalResponse, startTime, context.env, correlationId);
  return finalResponse;
};

async function signHtmlResponse(
  response: Response,
  context: PagesContext,
): Promise<Response> {
  const keyMaterial = context.env.SIGNATURE_PRIVATE_KEY;
  if (!keyMaterial) return response;

  const req = context.request;
  if (req.method !== "GET") return response;

  const ct = response.headers.get("content-type") ?? "";
  if (!ct.toLowerCase().includes("text/html")) return response;

  const key = await getOrCreateSigningKey(keyMaterial);
  if (!key) return response;

  const body = await response.arrayBuffer();
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

  const headers = new Headers(response.headers);
  headers.set("Content-Digest", contentDigest);
  headers.set("Signature-Input", `sig=${params}`);
  headers.set("Signature", `sig=${sfByteSequence(sig)}`);

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
