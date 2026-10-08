import { applySecurityHeaders } from "../../src/lib/security-headers";
import { API_VERSION, apiProblem } from "../_api-response";

interface PagesContext {
  request: Request;
}

export const onRequest = async (context?: PagesContext): Promise<Response> => {
  if (context?.request && context.request.method !== "GET" && context.request.method !== "HEAD") {
    return apiProblem(
      405,
      "Method Not Allowed",
      `HTTP method ${context.request.method} is not supported on this endpoint.`,
      "method_not_allowed",
      "Send a GET request to retrieve agent readiness status.",
      context.request.url,
    );
  }
  const headers = applySecurityHeaders(new Headers(), "json-api-public");
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("API-Version", API_VERSION);
  headers.set("Access-Control-Expose-Headers", "API-Version");
  headers.set("Cache-Control", "public, max-age=3600");
  headers.set("X-Robots-Tag", "noindex");

  return new Response(
    JSON.stringify({
      status: "discovery-only",
      read_only: true,
      credentials: false,
      payments: false,
      capabilities: ["profile", "search", "content-discovery", "mcp", "a2a"],
      versioning: { strategy: "url-path", current: "v1", apiVersion: API_VERSION },
    }) + "\n",
    {
      headers,
    },
  );
};
