import { applySecurityHeaders } from "../src/lib/security-headers";
import { applyRateLimitHeaders } from "./_unavailable";

export const API_VERSION = "2026-08-22";

export function apiJson(data: unknown, status = 200, extraHeaders?: HeadersInit): Response {
  let headers = applySecurityHeaders(new Headers(extraHeaders), "json-api-public");
  headers = applyRateLimitHeaders(headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("API-Version", API_VERSION);
  if (!headers.has("Cache-Control")) {
    headers.set("Cache-Control", "public, max-age=3600");
  }

  return new Response(`${JSON.stringify(data)}\n`, {
    status,
    headers,
  });
}

export function apiProblem(
  status: number,
  title: string,
  detail: string,
  code: string,
  resolutionHint: string,
  instanceUrl?: string,
): Response {
  let headers = applySecurityHeaders(new Headers(), "json-api-public");
  headers = applyRateLimitHeaders(headers);
  headers.set("Content-Type", "application/problem+json; charset=utf-8");
  headers.set("API-Version", API_VERSION);
  headers.set("X-Robots-Tag", "noindex");

  if (status === 429) {
    headers.set("Retry-After", "60");
  }
  if (status === 405) {
    headers.set("Allow", "GET, HEAD");
  }

  const problem = {
    type: "https://ashwingopalsamy.in/developers#errors",
    title,
    status,
    detail,
    code,
    resolution_hint: resolutionHint,
    ...(instanceUrl ? { instance: instanceUrl } : {}),
  };

  return new Response(`${JSON.stringify(problem)}\n`, {
    status,
    headers,
  });
}
