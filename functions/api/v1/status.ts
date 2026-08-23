import { apiJson, apiProblem } from "../../_api-response";
import { CANONICAL_KNOWLEDGE } from "../../../src/data/canonical-knowledge";

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
      "Send a GET request to check status.",
      context.request.url,
    );
  }

  return apiJson({
    service: "ashwingopalsamy.in-api",
    version: "v1",
    apiVersion: "2026-08-22",
    status: "operational",
    mode: "read-only-discovery",
    rateLimit: {
      limit: 120,
      windowSeconds: 60,
      policy: "120;w=60",
    },
    versioning: {
      strategy: "url-path-and-header",
      current: "v1",
      deprecationPolicy: "Deprecation announced minimum 6 months prior to retirement with Sunset header (RFC 8594) and Deprecation header (RFC 9594), documented at /developers.",
      sunsetHeader: "Sunset",
      deprecationHeader: "Deprecation",
    },
    capabilities: {
      profile: true,
      search: true,
      contentListing: true,
      noteMarkdown: true,
      mcp: true,
      a2a: true,
    },
    links: {
      openapi: `${CANONICAL_KNOWLEDGE.origin}/openapi.json`,
      developers: `${CANONICAL_KNOWLEDGE.origin}/developers`,
      mcp: `${CANONICAL_KNOWLEDGE.origin}/mcp`,
      a2a: `${CANONICAL_KNOWLEDGE.origin}/a2a`,
      llms: `${CANONICAL_KNOWLEDGE.origin}/llms.txt`,
    },
  });
};
