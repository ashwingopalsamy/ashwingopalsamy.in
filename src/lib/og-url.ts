import { site } from "../data/home";

/** Absolute URL for a per-page OG image under `/og/…`. */
export function ogPath(slugPath: string): string {
  const clean = slugPath.replace(/^\/+|\/+$/g, "");
  return `${site.url}/og/${clean}.png`;
}
