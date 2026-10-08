// Prerender Mermaid diagrams into src/assets/diagrams/<key>.<theme>.svg.
// Run after `npm run build`: every diagram the build could not inline renders client-side in dist,
// so this opens those pages in a real browser (site fonts, tokens and mermaid config), once per
// theme, and stores the SVG the client produced. Rebuild afterwards to inline them.
// Usage: npm run diagrams [-- --prune]   Env: DIST (default dist), CHROME_CHANNEL (empty = bundled Chromium).
import { readFile, readdir, rm, writeFile, unlink } from "node:fs/promises";
import { join, relative } from "node:path";
import { chromium } from "playwright";
import { startServer } from "./perf/serve.mjs";

const DIST = process.env.DIST ?? "dist";
const cache = JSON.parse(await readFile("src/lib/markdown/diagram-cache.json", "utf8"));
const THEMES = ["light", "dark"];
const prune = process.argv.includes("--prune");

async function htmlFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return htmlFiles(path);
    return e.name.endsWith(".html") ? [path] : [];
  }));
  return nested.flat();
}

// Mermaid ids are per-page counters (mmd-N) and some markers use fixed ids; both variants of every
// diagram share one document, so namespace every id and every reference to it (CSS selectors,
// url(#…), href="#…", aria-labelledby/-describedby).
function namespaceIds(svg, prefix) {
  const root = svg.match(/^<svg\b[^>]*\sid="([^"]+)"/)?.[1];
  const ids = new Set([...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const rename = (id) => (root && id.startsWith(root) ? prefix + id.slice(root.length) : `${prefix}-${id}`);
  const map = (id) => (ids.has(id) ? rename(id) : id);
  return svg
    .replace(/(\sid=")([^"]+)"/g, (_, attr, id) => `${attr}${map(id)}"`)
    .replace(/(\saria-(?:labelledby|describedby)=")([^"]+)"/g, (_, attr, list) => `${attr}${list.split(/\s+/).map(map).join(" ")}"`)
    .replace(/#([A-Za-z_][\w-]*)/g, (whole, id) => (ids.has(id) ? `#${rename(id)}` : whole));
}

const pages = [];
const known = new Set();
for (const file of await htmlFiles(DIST)) {
  const html = await readFile(file, "utf8");
  for (const [tag] of html.matchAll(/<figure\b[^>]*\sdata-diagram-key="[0-9a-f]+"[^>]*>/g)) {
    known.add(tag.match(/data-diagram-key="([0-9a-f]+)"/)[1]);
    if (!/\sdata-prerendered\b/.test(tag) && !pages.includes(file)) pages.push(file);
  }
}

const { base, close } = await startServer(DIST, 0);
const browser = await chromium.launch({ channel: (process.env.CHROME_CHANNEL ?? "chrome") || undefined });
let written = 0;
try {
  for (const file of pages) {
    const route = `/${relative(DIST, file).replace(/index\.html$/, "")}`;
    for (const theme of THEMES) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
      await context.addInitScript((t) => localStorage.setItem("theme", t), theme);
      const page = await context.newPage();
      await page.goto(base + route, { waitUntil: "load" });
      await page.waitForFunction(() => [...document.querySelectorAll("figure.diagram[data-diagram]:not([data-prerendered])")]
        .every((fig) => fig.classList.contains("is-rendered") || fig.classList.contains("has-error")), null, { timeout: 60_000 });
      const figures = await page.$$eval("figure.diagram[data-diagram]:not([data-prerendered])", (figs) => figs.map((fig) => ({
        key: fig.getAttribute("data-diagram-key"),
        svg: fig.classList.contains("is-rendered") ? fig.querySelector(".diagram-canvas")?.innerHTML.trim() ?? "" : "",
      })));
      for (const { key, svg } of figures) {
        if (!svg.startsWith("<svg")) {
          console.warn(`render-diagrams: ${key} (${route}, ${theme}) failed to render; left client-side.`);
          continue;
        }
        await writeFile(join(cache.dir, `${key}.${theme}.svg`), `${namespaceIds(svg, `d-${key}-${theme}`)}\n`);
        written += 1;
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  await close();
}
console.log(`render-diagrams: ${written} SVGs written from ${pages.length} page(s).`);

if (prune) {
  for (const name of await readdir(cache.dir)) {
    const key = name.split(".")[0];
    if (name.endsWith(".svg") && !known.has(key)) {
      await unlink(join(cache.dir, name));
      console.log(`render-diagrams: pruned ${name}`);
    }
  }
}
if (written > 0) {
  // Astro's content layer caches rendered markdown by source digest; new SVGs don't change any
  // source, so drop the cache or the next build would keep the client-side fallback markup.
  await rm("node_modules/.astro/data-store.json", { force: true });
  console.log("render-diagrams: cleared the content cache; rebuild to inline them (npm run build).");
}
