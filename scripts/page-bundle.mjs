// Packs every router-enabled page in dist/ into one immutable file, dist/_pages/<buildId>.txt, so the client can
// prefetch the whole site once and serve navigations from memory. Runs after `astro build` + markdown-mirrors,
// before pagefind.
//
// FORMAT (contract with the client loader). The file is UTF-8 bytes laid out as:
//   <indexLength>  8 ASCII decimal digits, zero-padded: the BYTE length of <index>
//   <index>        JSON: {"v":1,"build":"<id>","pages":{"/path/":[byteOffset, byteLength], ...}}
//   <bodies>       concatenated UTF-8 HTML documents
// byteOffset/byteLength are in BYTES, relative to the start of <bodies> (i.e. byte 8 + indexLength of the file).
// Keys are URL pathnames with a trailing slash ("/" for dist/index.html, "/work/" for dist/work/index.html).
//
// A page is included only if it carries the Astro ClientRouter meta and the site chrome; 404, meta-refresh redirect
// stubs and standalone documents are skipped. Persisted <style> blocks (site-css, site-fonts) are emptied because the
// live document keeps its own copy.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { brotliCompressSync, constants } from "node:zlib";

const DIST = process.env.PAGE_BUNDLE_DIST ?? "dist";
const PERSIST = /(<style\b[^>]*\bdata-astro-transition-persist="(?:site-css|site-fonts)"[^>]*>)[\s\S]*?(<\/style>)/g;
const ID_ATTRS = ["data-build-id", "data-build-commit", "data-build-at"];

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "_pages") continue;
      yield* walk(path);
    } else if (entry.name === "index.html") yield path;
  }
}

const htmlTag = (html) => html.match(/<html\b[^>]*>/i)?.[0] ?? "";
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

const pages = [];
for await (const file of walk(DIST)) {
  const html = await readFile(file, "utf8");
  if (!html.includes('name="astro-view-transitions-enabled"') || !html.includes("site-chrome")) continue;
  if (/http-equiv="refresh"/i.test(html)) continue;
  const dir = relative(DIST, file).split(sep).slice(0, -1).join("/");
  const key = dir ? `/${dir}/` : "/";
  pages.push({ key, html: html.replace(PERSIST, "$1$2"), tag: htmlTag(html) });
}
pages.sort((a, b) => (a.key < b.key ? -1 : 1));

let build;
if (pages.length) {
  for (const name of ID_ATTRS) {
    const values = pages.map((p) => attr(p.tag, name));
    if (values.every((v) => v === undefined)) continue;
    const distinct = new Set(values);
    if (distinct.has(undefined) || distinct.size > 1) {
      console.error(`page-bundle: pages disagree on ${name}: ${[...distinct].join(", ")}`);
      process.exit(1);
    }
    build = values[0];
    break;
  }
  if (!build) {
    console.error(`page-bundle: no ${ID_ATTRS.join(" / ")} on included pages`);
    process.exit(1);
  }
} else {
  console.warn("page-bundle: warning: 0 router-enabled pages found, writing an empty bundle");
  build = "empty";
}

const index = { v: 1, build, pages: {} };
const bodies = [];
let offset = 0;
for (const { key, html } of pages) {
  const bytes = Buffer.from(html, "utf8");
  index.pages[key] = [offset, bytes.length];
  bodies.push(bytes);
  offset += bytes.length;
}
const indexBytes = Buffer.from(JSON.stringify(index), "utf8");
const header = Buffer.from(String(indexBytes.length).padStart(8, "0"), "ascii");
const out = Buffer.concat([header, indexBytes, ...bodies]);

await mkdir(join(DIST, "_pages"), { recursive: true });
await writeFile(join(DIST, "_pages", `${build}.txt`), out);
const brotli = brotliCompressSync(out, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } });
console.log(`page-bundle: ${pages.length} pages, ${out.length} bytes raw, ${brotli.length} bytes brotli -> _pages/${build}.txt`);
