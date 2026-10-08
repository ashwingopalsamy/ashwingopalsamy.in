import type { APIRoute } from "astro";
import designMarkdown from "../../DESIGN.md?raw";

export const prerender = true;

export const GET: APIRoute = () =>
  new Response(designMarkdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
