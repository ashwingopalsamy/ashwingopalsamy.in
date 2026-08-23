import { apiJson, apiProblem } from "../../../_api-response";
import { getNoteMarkdown } from "../../../_site-data";
import type { RuntimeEnv } from "../../../_site-data";

interface PagesContext {
  request: Request;
  params: { slug?: string };
  env: RuntimeEnv;
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    return apiProblem(
      405,
      "Method Not Allowed",
      `HTTP method ${context.request.method} is not supported on this endpoint.`,
      "method_not_allowed",
      "Send a GET request with a valid note slug.",
      context.request.url,
    );
  }

  const slug = context.params.slug;
  if (!slug || !/^[a-z0-9][a-z0-9-]*$/i.test(slug)) {
    return apiProblem(
      400,
      "Bad Request",
      "Invalid note slug format.",
      "invalid_slug",
      "Provide an alphanumeric slug such as 'designing-rate-limiters-for-payment-systems'.",
      context.request.url,
    );
  }

  const markdown = await getNoteMarkdown(slug, context.env, context.request.url);
  if (markdown === null) {
    return apiProblem(
      404,
      "Not Found",
      `Note '${slug}' was not found in the published catalog.`,
      "note_not_found",
      "List available notes using /api/v1/content?kind=note or search using /api/v1/search.",
      context.request.url,
    );
  }

  return apiJson({ slug, markdown });
};
