import { apiJson, apiProblem } from "../../_api-response";
import { getProfile } from "../../_site-data";
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
      "Send a GET request to retrieve the profile summary.",
      context.request.url,
    );
  }

  const profile = await getProfile(context.env, context.request.url);
  return apiJson(profile);
};
