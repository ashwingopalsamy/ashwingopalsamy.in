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
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://cloudflareinsights.com https://*.cloudflareinsights.com",
  "frame-src 'self' https://open.spotify.com",
  "worker-src 'self' blob:",
].join("; ");

/**
 * Strict policy for HTML pages, issued per response by functions/_middleware.ts,
 * which stamps the same nonce on every <script> and <style> in the document.
 * No 'unsafe-inline' for scripts or style elements. Style attributes stay
 * allowed (style-src-attr): Shiki, prerendered Mermaid SVG and a few
 * components use them, and they cannot execute script.
 * The static CSP_DIRECTIVES above remain the fallback for anything served
 * without the middleware.
 */
export function strictCspDirectives(nonce: string): string {
  return [
    "default-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval' 'inline-speculation-rules' https://static.cloudflareinsights.com`,
    `style-src 'self' 'nonce-${nonce}'`,
    `style-src-elem 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https://image-cdn-ak.spotifycdn.com",
    "font-src 'self' data:",
    "connect-src 'self' https://cloudflareinsights.com https://*.cloudflareinsights.com",
    "frame-src https://open.spotify.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
    `report-uri ${CSP_REPORT_PATH}`,
    "report-to csp",
  ].join("; ");
}

export const CSP_REPORT_PATH = "/api/csp-report";

/**
 * While true the strict policy is sent as Content-Security-Policy-Report-Only
 * next to the permissive static one, so violations are reported, not
 * enforced. Flip to false once a full report window is clean.
 */
export const STRICT_CSP_REPORT_ONLY = true;

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
