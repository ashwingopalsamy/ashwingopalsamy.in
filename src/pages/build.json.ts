import type { APIRoute } from "astro";
import { buildManifest } from "../lib/build";

export const prerender = true;

export const GET: APIRoute = () => {
  return new Response(JSON.stringify(buildManifest, null, 2) + "\n", {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "X-Robots-Tag": "noindex",
    },
  });
};
