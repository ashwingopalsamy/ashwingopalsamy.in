import type { APIRoute } from "astro";
import { site } from "../data/home";
import { ogPngResponse, renderOgPng } from "../lib/og";

export const prerender = true;

export const GET: APIRoute = async () => {
  const png = await renderOgPng({
    title: site.name,
    meta: "Builds the infrastructure behind global payments.",
  });
  return ogPngResponse(png);
};
