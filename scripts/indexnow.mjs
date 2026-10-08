// Submit URLs to IndexNow. Usage: node scripts/indexnow.mjs [url ...]
// With no args, submits every <loc> in dist/sitemap.xml (or the live sitemap if dist is absent).
import { readFile } from "node:fs/promises";

const KEY = "a7ea2ebaa759a79056ec919d2a4fcd7c"; // must equal the public/<key>.txt file name
const HOST = "ashwingopalsamy.in";
const ORIGIN = `https://${HOST}`;

async function sitemapXml() {
  try {
    return await readFile("dist/sitemap.xml", "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const response = await fetch(`${ORIGIN}/sitemap.xml`);
    if (!response.ok) throw new Error(`GET sitemap.xml -> ${response.status}`);
    return response.text();
  }
}

const urlList = process.argv.length > 2
  ? process.argv.slice(2)
  : [...(await sitemapXml()).matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((match) => match[1]);

if (urlList.length === 0) throw new Error("No URLs to submit.");

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "content-type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `${ORIGIN}/${KEY}.txt`, urlList }),
});

console.log(`IndexNow: ${response.status} ${response.statusText} (${urlList.length} URLs)`);
if (!response.ok) {
  console.error(await response.text());
  process.exit(1);
}
