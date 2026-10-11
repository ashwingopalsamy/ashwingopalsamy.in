// Phone navigation harness: node scripts/perf/nav.mjs --dist dist [--browser chromium|webkit]
// Emulates Pixel 7 (chromium, 4x CPU throttle) or iPhone 14 (webkit). Taps tab bar links, a /work/ item, a note
// and its next link, then history.back() twice. Per step: tap->painted ms, document/fetch/xhr requests issued,
// whether a view-transition animation ran, scroll restoration on back, console errors. Prints a table + JSON.
import { chromium, webkit, devices } from "playwright";
import { startServer } from "./serve.mjs";

const argv = process.argv.slice(2);
const opt = (name, def) => {
  const i = argv.indexOf(`--${name}`);
  return i < 0 ? def : argv[i + 1];
};
const dist = opt("dist", "dist");
const browserName = opt("browser", "chromium");
const NOTE = "/blog/consistent-hashing-distributed-caches/";

// Runs in every document. Epoch times (timeOrigin + now) survive full document loads via sessionStorage.
const initScript = () => {
  const ss = window.sessionStorage;
  const epoch = () => performance.timeOrigin + performance.now();
  const sampleVT = () => {
    const until = performance.now() + 1500;
    const tick = () => {
      try {
        if (document.getAnimations().some((a) => String(a.effect?.pseudoElement || "").includes("view-transition"))) ss.setItem("__vt", "1");
      } catch {}
      if (performance.now() < until) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const painted = () => {
    if (!ss.getItem("__tap") || ss.getItem("__painted")) return;
    requestAnimationFrame(() => requestAnimationFrame(() => ss.setItem("__painted", String(epoch()))));
  };
  window.addEventListener(
    "pointerup",
    () => {
      ss.setItem("__tap", String(epoch()));
      ss.removeItem("__painted");
      ss.removeItem("__vt");
      sampleVT();
    },
    true,
  );
  document.addEventListener("astro:page-load", painted);
  window.addEventListener("load", painted);
  // New document right after a tap (full load): keep sampling view transitions.
  const t = Number(ss.getItem("__tap"));
  if (t && Date.now() - t < 2000 && !ss.getItem("__painted")) sampleVT();
  window.__navMark = () => {
    ss.setItem("__tap", String(epoch()));
    ss.removeItem("__painted");
    ss.removeItem("__vt");
    sampleVT();
  };
};

const server = await startServer(dist, 0);
const isWebkit = browserName === "webkit";
const browser = await (isWebkit ? webkit : chromium).launch();
const ctx = await browser.newContext({ ...devices[isWebkit ? "iPhone 14" : "Pixel 7"] });
await ctx.addInitScript(initScript);
const page = await ctx.newPage();
if (!isWebkit) {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
}

let reqs = [];
let errors = [];
page.on("request", (r) => {
  if (["document", "fetch", "xhr"].includes(r.resourceType())) reqs.push(`${r.resourceType()} ${new URL(r.url()).pathname}`);
});
page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 160)));
page.on("pageerror", (e) => errors.push(String(e.message).slice(0, 160)));

const results = [];
const leftScroll = new Map(); // pathname -> scrollY when we left it

async function currentPath() {
  return page.evaluate(() => location.pathname);
}

async function waitPainted() {
  await page.waitForFunction(() => !!sessionStorage.getItem("__painted"), null, { timeout: 15000 });
  const r = await page.evaluate(() => ({
    tap: Number(sessionStorage.getItem("__tap")),
    painted: Number(sessionStorage.getItem("__painted")),
    vt: sessionStorage.getItem("__vt") === "1",
  }));
  return r;
}

async function step(label, action, { checkScroll = false } = {}) {
  const from = await currentPath();
  const y = await page.evaluate(() => Math.round(scrollY));
  if (!checkScroll) leftScroll.set(from, y);
  reqs = [];
  errors = [];
  await action();
  let rec;
  try {
    const m = await waitPainted();
    await page.waitForTimeout(400); // let late requests/scroll restoration settle
    const to = await currentPath();
    rec = {
      step: label,
      from,
      to,
      ms: Math.round(m.painted - m.tap),
      requests: reqs.length,
      requestList: reqs.slice(0, 8),
      viewTransition: m.vt,
      scrollRestored: checkScroll ? { expected: leftScroll.get(to) ?? null, actual: await page.evaluate(() => Math.round(scrollY)) } : undefined,
      errors: errors.slice(),
    };
  } catch (e) {
    rec = { step: label, from, error: String(e.message).split("\n")[0], requests: reqs.length, errors: errors.slice() };
  }
  results.push(rec);
}

async function tapSel(sel) {
  const loc = page.locator(sel).first();
  await loc.scrollIntoViewIfNeeded();
  leftScroll.set(await currentPath(), await page.evaluate(() => Math.round(scrollY))); // scroll position at departure
  const b = await loc.boundingBox();
  if (!b) throw new Error(`no box for ${sel}`);
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
}

// Tap a link to href; inject a fixed anchor if none is rendered on the current page.
async function tapHref(href) {
  const sel = `a[href="${href}"]`;
  if (!(await page.locator(sel).first().isVisible().catch(() => false))) {
    await page.evaluate((h) => {
      const a = document.createElement("a");
      a.href = h;
      a.id = "__injected";
      a.style.cssText = "position:fixed;left:20px;top:100px;width:80px;height:40px;z-index:99999;background:#fff";
      a.textContent = "go";
      document.body.appendChild(a);
    }, href);
    const b = await page.locator("#__injected").boundingBox();
    return page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  }
  const b = await page.locator(sel).first().boundingBox();
  await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
}

await page.goto(server.base + "/", { waitUntil: "load" });
await page.waitForTimeout(3000);

const tabs = await page.$$eval(".site-nav-bottom a", (as) => as.map((a) => a.getAttribute("href")));
for (const href of tabs) {
  if (href === (await currentPath())) continue;
  await step(`tab ${href}`, () => tapSel(`.site-nav-bottom a[href="${href}"]`));
}

// /work/ item
await step("tab /work/", () => tapSel('.site-nav-bottom a[href="/work/"]'));
const item = await page.$eval('a.row-link[href^="/work/"]', (a) => a.getAttribute("href"));
await page.evaluate(() => scrollBy(0, 300));
await step(`work item ${item}`, () => tapSel(`a.row-link[href="${item}"]`));

// note + its next link
await step(`open note ${NOTE}`, () => tapHref(NOTE));
await page.evaluate(() => scrollBy(0, 400));
await page.waitForTimeout(300);
await step("note next", () => tapSel(".note-next:not(.is-empty)"));

for (let i = 1; i <= 2; i++)
  await step(`back ${i}`, async () => {
    await page.evaluate(() => window.__navMark());
    await page.goBack({ waitUntil: "commit" }).catch(() => {});
  }, { checkScroll: true });

await browser.close();
await server.close();

const pad = (s, n) => String(s ?? "").padEnd(n);
console.log(`\nbrowser=${browserName} device=${isWebkit ? "iPhone 14" : "Pixel 7 (4x CPU)"}`);
console.log(pad("step", 34) + pad("ms", 7) + pad("reqs", 6) + pad("VT", 5) + pad("scroll(exp/act)", 17) + "errors");
for (const r of results)
  console.log(
    pad(r.step, 34) +
      pad(r.error ? "ERR" : r.ms, 7) +
      pad(r.requests, 6) +
      pad(r.viewTransition ? "yes" : "no", 5) +
      pad(r.scrollRestored ? `${r.scrollRestored.expected}/${r.scrollRestored.actual}` : "-", 17) +
      (r.errors?.length || 0) +
      (r.error ? `  ${r.error}` : ""),
  );
console.log("\nJSON " + JSON.stringify({ browser: browserName, results }));
