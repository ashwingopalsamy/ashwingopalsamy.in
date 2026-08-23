import type { APIRoute } from "astro";
import { getObservabilitySnapshot } from "../../lib/observability";

export const prerender = true;

export const GET: APIRoute = () => {
  const snapshot = getObservabilitySnapshot();
  return new Response(JSON.stringify(snapshot, null, 2) + "\n", {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "X-Robots-Tag": "noindex",
    },
  });
};
