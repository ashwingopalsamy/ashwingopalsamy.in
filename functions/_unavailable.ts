import { applySecurityHeaders } from "../src/lib/security-headers";

export function applyRateLimitHeaders(
  headers: Headers,
  opts: { limit?: number; remaining?: number; reset?: number; window?: number } = {},
): Headers {
  const limit = opts.limit ?? 120;
  const remaining = opts.remaining ?? 119;
  const reset = opts.reset ?? 60;
  const windowSeconds = opts.window ?? 60;

  if (!headers.has("RateLimit-Limit")) headers.set("RateLimit-Limit", String(limit));
  if (!headers.has("RateLimit-Remaining")) headers.set("RateLimit-Remaining", String(remaining));
  if (!headers.has("RateLimit-Reset")) headers.set("RateLimit-Reset", String(reset));
  if (!headers.has("RateLimit-Policy")) headers.set("RateLimit-Policy", `${limit};w=${windowSeconds}`);

  if (!headers.has("X-RateLimit-Limit")) headers.set("X-RateLimit-Limit", String(limit));
  if (!headers.has("X-RateLimit-Remaining")) headers.set("X-RateLimit-Remaining", String(remaining));
  if (!headers.has("X-RateLimit-Reset")) headers.set("X-RateLimit-Reset", String(reset));

  const exposed = [
    "RateLimit-Limit",
    "RateLimit-Remaining",
    "RateLimit-Reset",
    "RateLimit-Policy",
    "X-RateLimit-Limit",
    "X-RateLimit-Remaining",
    "X-RateLimit-Reset",
    "Retry-After",
    "API-Version",
    "Sunset",
    "Deprecation",
  ];
  const currentExpose = headers.get("Access-Control-Expose-Headers");
  if (currentExpose) {
    const existing = currentExpose.split(",").map((s) => s.trim());
    const merged = Array.from(new Set([...existing, ...exposed]));
    headers.set("Access-Control-Expose-Headers", merged.join(", "));
  } else {
    headers.set("Access-Control-Expose-Headers", exposed.join(", "));
  }

  return headers;
}

export async function unavailableResponse(message: string): Promise<Response> {
  let headers = applySecurityHeaders(new Headers(), "json-api-public");
  headers = applyRateLimitHeaders(headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Retry-After", "86400");
  headers.set("X-Robots-Tag", "noindex");

  return new Response(
    JSON.stringify({
      error: "temporarily_unavailable",
      error_description: message,
      code: "temporarily_unavailable",
      message,
      service_status: "discovery-only",
      resolution_hint: "This discovery-only service does not issue credentials. Use public read-only endpoints.",
    }) + "\n",
    {
      status: 503,
      headers,
    },
  );
}
