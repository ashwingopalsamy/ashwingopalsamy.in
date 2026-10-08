// Writes dist/<mirror> for each route in core-markdown-mirrors.json by converting the built page's <main> to Markdown.
// Runs after `astro build`. Mirrors already in dist (public/developers.md, the design.md endpoint) are left alone.
import { access, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { NodeHtmlMarkdown } from "node-html-markdown";

const ORIGIN = "https://ashwingopalsamy.in";
const TITLE_SUFFIX = " · Ashwin Gopalsamy";
const IGNORE = ["script", "style", "svg", "button", "nav", "template", "noscript"];
const ENTITIES = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&#x27;": "'" };

const mirrors = JSON.parse(await readFile("src/data/core-markdown-mirrors.json", "utf8"));
const exists = (path) => access(path).then(() => true, () => false);

for (const [route, mirror] of Object.entries(mirrors)) {
  const target = join("dist", mirror);
  if (await exists(target)) {
    console.log(`markdown-mirrors: skip ${mirror} (already in dist)`);
    continue;
  }

  const page = join("dist", route, "index.html");
  const html = await readFile(page, "utf8");
  const rawTitle = html.match(/<title>([\s\S]*?)<\/title>/)?.[1];
  const main = html.match(/<main\b[^>]*>([\s\S]*)<\/main>/)?.[1];
  if (rawTitle === undefined || main === undefined) throw new Error(`markdown-mirrors: no <title> or <main> in ${page}`);

  const title = rawTitle.trim().replace(/&(?:amp|lt|gt|quot|#39|#x27);/g, (entity) => ENTITIES[entity]);
  const body = NodeHtmlMarkdown.translate(main, { ignore: IGNORE }).replace(/\n{3,}/g, "\n\n").trim();
  const heading = title.endsWith(TITLE_SUFFIX) ? title.slice(0, -TITLE_SUFFIX.length) : title;

  // Most pages render their own <h1>; only add one when the page has none.
  const titleLine = body.startsWith("# ") ? "" : `# ${heading}\n\n`;
  await writeFile(target, `${titleLine}> Markdown mirror of ${ORIGIN}${route}\n\n${body}\n`);
  console.log(`markdown-mirrors: wrote ${mirror}`);
}
