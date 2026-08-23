import { paymentRequiredHeader } from "../_x402";
import { applySecurityHeaders } from "../../src/lib/security-headers";
import { applyRateLimitHeaders } from "../_unavailable";
import { API_VERSION, apiProblem } from "../_api-response";

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
  const body = JSON.stringify({
    error: "payment_required",
    code: "payment_required",
    status: "discovery-only",
    message: "This compatibility route has no payable offer and does not accept payment.",
    resolution_hint: "Use public read-only endpoints at /api/v1/profile, /api/v1/search, or /mcp.",
  });
  const resourceUrl = new URL(context.request.url);
  resourceUrl.search = "";

  let headers = applySecurityHeaders(new Headers(), "json-api-public");
  headers = applyRateLimitHeaders(headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("API-Version", API_VERSION);
  headers.set("PAYMENT-REQUIRED", paymentRequiredHeader(resourceUrl.toString()));
  const expose = headers.get("Access-Control-Expose-Headers") ?? "";
  if (!expose.includes("PAYMENT-REQUIRED")) {
    headers.set("Access-Control-Expose-Headers", expose ? `${expose}, PAYMENT-REQUIRED` : "PAYMENT-REQUIRED");
  }
  headers.set("X-Robots-Tag", "noindex");
  headers.set("Allow", "GET, HEAD");

  return new Response(context.request.method === "HEAD" ? null : `${body}\n`, {
    status: 402,
    headers,
  });
};
