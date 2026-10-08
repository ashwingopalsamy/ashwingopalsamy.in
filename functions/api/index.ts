import { apiJson, apiProblem } from "../_api-response";

interface PagesContext {
  request: Request;
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    return apiProblem(
      405,
      "Method Not Allowed",
      `HTTP method ${context.request.method} is not supported on this endpoint.`,
      "method_not_allowed",
      "Send a GET request to access API discovery.",
      context.request.url,
    );
  }

  return apiJson(
    {
      status: "discovery-only",
      message: "Public read-only API index. No authentication or payment is required.",
      resolution_hint: "Use public read-only endpoints at /api/v1/profile, /api/v1/search, or /mcp, or see /openapi.json.",
    },
    200,
    { "X-Robots-Tag": "noindex", Allow: "GET, HEAD" },
  );
};
