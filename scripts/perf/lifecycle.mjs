// Manual navigation-lifecycle check (not a test): heap/listener/DOM growth over repeated library -> post -> back
// rounds, scroll restore on back, last-click-wins under rapid navigation, and bfcache eligibility per route.
// Profile: desktop 1440x900, unthrottled, Chrome launched with bfcache enabled. Failed requests and fetch/xhr are listed.
// Env: BASE=<origin> or DIST=<dir, default dist>; OUT=<file.json>; CHROME_CHANNEL (empty = bundled Chromium).
import fs from "node:fs";
import { chromium } from "playwright";
import { startServer } from "./serve.mjs";

const server = process.env.BASE ? undefined : await startServer(process.env.DIST || "dist", 0);
const B = (process.env.BASE || server.base).replace(/\/+$/, "");
const browser = await chromium.launch({
  channel: (process.env.CHROME_CHANNEL ?? "chrome") || undefined,
  ignoreDefaultArgs: ["--disable-back-forward-cache"],
  args: ["--enable-features=BackForwardCache"],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send("Performance.enable");
const failed = new Set();
const fetches = new Set();
page.on("response", (r) => {
  if (r.status() >= 400) failed.add(r.status() + " " + r.url().replace(B, ""));
  const t = r.request().resourceType();
  if (t === "fetch" || t === "xhr") fetches.add(r.url().replace(B, ""));
});
const results = { rounds: [], rapidNav: "", bfcache: [] };
async function m(label) {
  await cdp.send("HeapProfiler.collectGarbage");
  const pm = Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((x) => [x.name, x.value]));
  const e = await page.evaluate(() => ({
    url: location.pathname,
    scrollY: Math.round(scrollY),
    domNodes: document.getElementsByTagName("*").length,
  }));
  const row = { ...e, heapMB: +(pm.JSHeapUsedSize / 1048576).toFixed(2), listeners: pm.JSEventListeners, Nodes: pm.Nodes };
  console.log(label, JSON.stringify(row));
  results.rounds.push({ label: label.trim(), ...row });
}

// Heap/listener rounds and post -> back scroll restore (scrollY after ' back' should equal the 1200 set before the click)
await page.goto(B + "/library/");
await page.waitForTimeout(1000);
await m("library");
const href = await page.$eval('main a[href^="/blog/"]', (a) => a.getAttribute("href"));
console.log("post", href);
for (let i = 0; i < 3; i++) {
  await page.evaluate(() => scrollTo(0, 1200));
  await page.waitForTimeout(400);
  await m(" scrolled");
  await page.click(`main a[href="${href}"]`);
  await page.waitForURL("**" + href);
  await page.waitForTimeout(1500);
  await m(" post");
  await page.goBack();
  await page.waitForTimeout(1500);
  await m(" back");
}
results.failed = [...failed].slice(0, 20);
results.fetches = [...fetches];
console.log("failed", results.failed);
console.log("fetches", results.fetches);

// Rapid navigation: the last click (/about/) must win
await page.goto(B + "/");
await page.waitForTimeout(1000);
const missing = await page.evaluate(async () => {
  const notFound = [];
  for (const h of ["/work/", "/more/", "/about/"]) {
    const a = document.querySelector(`a[href="${h}"]`);
    if (a) a.click();
    else notFound.push(h);
    await new Promise((r) => setTimeout(r, 30));
  }
  return notFound;
});
if (missing.length) console.log("rapid nav: links not found", missing);
await page.waitForTimeout(2500);
results.rapidNav = await page.evaluate(() => location.pathname + " h1=" + document.querySelector("h1")?.textContent?.trim().slice(0, 30));
console.log("rapid nav: clicked /work/,/more/,/about/ => ended at", results.rapidNav);

// bfcache per route: leave to a 404, go back, and check the pageshow persisted flag plus blocking reasons
const p2 = await ctx.newPage();
const c2 = await ctx.newCDPSession(p2);
await c2.send("Page.enable");
for (const r of ["/", "/work/", "/blog/go-was-never-bad/", "/more/"]) {
  const reasons = [];
  const h = (e) => reasons.push(...e.notRestoredExplanations.map((x) => x.reason));
  c2.on("Page.backForwardCacheNotUsed", h);
  await p2.goto(B + r);
  await p2.evaluate(() => {
    window.__bf = false;
    addEventListener("pageshow", (e) => {
      if (e.persisted) window.__bf = true;
    });
  });
  await p2.waitForTimeout(1500);
  await p2.goto(B + "/zz-not-found/");
  await p2.waitForTimeout(300);
  await p2.goBack({ waitUntil: "commit" }).catch((e) => console.log("goBack", e.message.slice(0, 40)));
  await p2.waitForTimeout(800);
  const persisted = await p2.evaluate(
    () => performance.getEntriesByType("navigation")[0].type + " restoredFromBF=" + (window.__bf === true),
  );
  c2.off("Page.backForwardCacheNotUsed", h);
  console.log("bfcache", r, "navType", persisted, "blocked", JSON.stringify(reasons));
  results.bfcache.push({ route: r, navType: persisted, blocked: reasons });
}
await browser.close();
await server?.close();
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(results, null, 1));
