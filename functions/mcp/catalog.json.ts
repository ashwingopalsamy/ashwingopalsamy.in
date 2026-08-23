import { appendMcpDiscoveryLinks, applyMcpCors, createMcpCatalog } from "../_mcp-catalog";
import { applySecurityHeaders } from "../../src/lib/security-headers";
import { applyRateLimitHeaders } from "../_unavailable";

interface PagesContext {
  request: Request;
}

function jsonResponse(body: unknown, status = 200, requestMethod = "GET"): Response {
  let headers = applySecurityHeaders(new Headers(), "json-api-public");
  headers = applyRateLimitHeaders(headers);
  headers = applyMcpCors(appendMcpDiscoveryLinks(headers));
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", "public, max-age=3600");
  return new Response(requestMethod === "HEAD" ? null : JSON.stringify(body), { status, headers });
}

function methodNotAllowed(): Response {
  let headers = applySecurityHeaders(new Headers(), "json-api-public");
  headers = applyRateLimitHeaders(headers);
  headers = applyMcpCors(appendMcpDiscoveryLinks(headers));
  headers.set("Allow", "GET, HEAD, OPTIONS");
  return new Response(null, { status: 405, headers });
}

export const onRequest = async ({ request }: PagesContext): Promise<Response> => {
  if (request.method === "OPTIONS") {
    let headers = applySecurityHeaders(new Headers(), "json-api-public");
    headers = applyMcpCors(appendMcpDiscoveryLinks(headers));
    headers.set("Allow", "GET, HEAD, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization, MCP-Protocol-Version, Mcp-Session-Id");
    headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "GET" && request.method !== "HEAD") return methodNotAllowed();
  if (new URL(request.url).search) return jsonResponse({ error: "query_parameters_not_supported" }, 400, request.method);
  return jsonResponse(createMcpCatalog(), 200, request.method);
};
