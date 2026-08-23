import type { APIRoute } from "astro";
import { buildPaletteManifest } from "../../lib/palette-manifest";

export const prerender = true;

export const GET: APIRoute = async () => {
  const manifest = await buildPaletteManifest();
  return new Response(JSON.stringify(manifest).replace(/</g, "\\u003c") + "\n", {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
