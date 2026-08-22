export type SecurityResponseClass =
  | "html"
  | "json-api"
  | "json-api-public"
  | "markdown"
  | "well-known"
  | "static";

export const CSP_DIRECTIVES = [
  "default-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://cloudflareinsights.com https://*.cloudflareinsights.com",
  "frame-src 'self' https://open.spotify.com",
  "worker-src 'self' blob:",
].join("; ");

export const PERMISSIONS_POLICY = [
  "accelerometer=()",
  'autoplay=(self "https://open.spotify.com")',
  "camera=()",
  'clipboard-write=(self "https://open.spotify.com")',
  'encrypted-media=(self "https://open.spotify.com")',
  'fullscreen=(self "https://open.spotify.com")',
  "geolocation=()",
  "gyroscope=()",
  "magnetometer=()",
  "microphone=()",
  "payment=()",
  'picture-in-picture=(self "https://open.spotify.com")',
  "usb=()",
  "interest-cohort=()",
].join(", ");

export const GLOBAL_SECURITY_HEADERS: Record<string, string> = {
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-Permitted-Cross-Domain-Policies": "none",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": PERMISSIONS_POLICY,
  "Cross-Origin-Opener-Policy": "same-origin",
};

export function applySecurityHeaders(
  headers: Headers,
  responseClass: SecurityResponseClass = "html",
): Headers {
  for (const [key, value] of Object.entries(GLOBAL_SECURITY_HEADERS)) {
    if (!headers.has(key)) {
      headers.set(key, value);
    }
  }

  if (responseClass === "html") {
    if (!headers.has("Content-Security-Policy")) {
      headers.set("Content-Security-Policy", CSP_DIRECTIVES);
    }
    if (!headers.has("Content-Signal")) {
      headers.set("Content-Signal", "ai-train=yes, search=yes, ai-input=yes");
    }
  } else if (responseClass === "json-api" || responseClass === "json-api-public") {
    if (!headers.has("Cache-Control")) {
      headers.set("Cache-Control", "no-store");
    }
    if (responseClass === "json-api-public") {
      headers.set("Access-Control-Allow-Origin", "*");
    }
  } else if (responseClass === "markdown") {
    if (!headers.has("Content-Signal")) {
      headers.set("Content-Signal", "ai-train=yes, search=yes, ai-input=yes");
    }
  }

  return headers;
}
