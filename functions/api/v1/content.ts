import { apiJson, apiProblem } from "../../_api-response";
import { listContent } from "../../_site-data";
import type { RuntimeEnv } from "../../_site-data";

interface PagesContext {
  request: Request;
  env: RuntimeEnv;
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    return apiProblem(
      405,
      "Method Not Allowed",
      `HTTP method ${context.request.method} is not supported on this endpoint.`,
      "method_not_allowed",
      "Send a GET request with optional ?kind=... and ?limit=... parameters.",
      context.request.url,
    );
  }

  const url = new URL(context.request.url);
  const kind = url.searchParams.get("kind") ?? "all";
  const rawLimit = url.searchParams.get("limit");
  let limit: number | undefined;
  if (rawLimit) {
    const parsed = Number.parseInt(rawLimit, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > 50) {
      return apiProblem(
        400,
        "Bad Request",
        "The 'limit' parameter must be an integer between 1 and 50.",
        "invalid_parameter",
        "Provide a valid limit integer between 1 and 50 (default: 20).",
        context.request.url,
      );
    }
    limit = parsed;
  }

  const items = await listContent(kind, limit ?? 20, context.env, context.request.url);
  return apiJson({ kind, count: items.length, items });
};
