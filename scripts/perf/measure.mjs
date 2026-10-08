// Manual page-load measurement (not a test): FCP/LCP/CLS/TBT, INP proxy, transfer bytes, heap, listeners per route.
// Profiles: mobile 412x823 @1.75, 4x CPU, CDP 150ms/1.6Mbps (CDP throttling may not apply to a localhost document,
// so prefer BASE=<live or preview URL> for network-bound numbers); desktop 1440x900 @2, unthrottled.
// Env: BASE=<origin> or DIST=<dir, default dist>; ROUTES=/a/,/b/; OUT=<file.json>; CHROME_CHANNEL (empty = bundled Chromium).
import fs from "node:fs";
import { chromium } from "playwright";
import { startServer } from "./serve.mjs";

const server = process.env.BASE ? undefined : await startServer(process.env.DIST || "dist", 0);
const BASE = (process.env.BASE || server.base).replace(/\/+$/, "");
const routes = (
  process.env.ROUTES ||
  "/,/work/,/work/uuidv8/,/library/,/blog/go-was-never-bad/,/blog/designing-rate-limiters-for-payment-systems/,/blog/go-error-wrapping/,/more/,/more/photos/,/about/,/links/,/ai/,/design/,/no-such-page/"
).split(",");
const browser = await chromium.launch({ channel: (process.env.CHROME_CHANNEL ?? "chrome") || undefined });
const profiles = {
  mobile: { viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true, throttle: true },
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, throttle: false },
};
const out = [];
for (const [pname, prof] of Object.entries(profiles))
  for (const r of routes) {
    const ctx = await browser.newContext({
      viewport: prof.viewport,
      deviceScaleFactor: prof.deviceScaleFactor,
      isMobile: prof.isMobile,
      hasTouch: prof.hasTouch,
    });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    if (prof.throttle) {
      await cdp.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 150,
        downloadThroughput: 1638400 / 8,
        uploadThroughput: 750000 / 8,
      });
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    }
    const bytes = {};
    let reqs = 0;
    const reqTypes = new Map();
    cdp.on("Network.responseReceived", (e) => reqTypes.set(e.requestId, e.type));
    cdp.on("Network.loadingFinished", (e) => {
      const t = reqTypes.get(e.requestId) || "Other";
      bytes[t] = (bytes[t] || 0) + e.encodedDataLength;
      reqs++;
    });
    await page.addInitScript(() => {
      window.__m = { lcp: 0, cls: 0, lt: [], ev: [] };
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) {
          window.__m.lcp = e.startTime;
          window.__m.lcpEl = e.element && e.element.tagName + "." + (e.element.className || "").toString().slice(0, 40);
        }
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) if (!e.hadRecentInput) window.__m.cls += e.value;
      }).observe({ type: "layout-shift", buffered: true });
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) window.__m.lt.push([Math.round(e.startTime), Math.round(e.duration)]);
      }).observe({ type: "longtask", buffered: true });
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) window.__m.ev.push([e.name, Math.round(e.duration)]);
      }).observe({ type: "event", buffered: true, durationThreshold: 16 });
    });
    let status;
    try {
      const resp = await page.goto(BASE + r, { waitUntil: "load", timeout: 90000 });
      status = resp.status();
    } catch (e) {
      status = "ERR " + e.message.slice(0, 60);
    }
    await page.waitForTimeout(prof.throttle ? 3000 : 1500);
    // interactions (INP proxy)
    try {
      await page.keyboard.press("Meta+k");
      await page.waitForTimeout(600);
      await page.keyboard.type("go");
      await page.waitForTimeout(600);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
      const tt = await page.$('[data-theme-toggle], button[aria-label*="theme" i], #theme-toggle');
      if (tt) {
        await tt.click();
        await page.waitForTimeout(500);
        await tt.click();
        await page.waitForTimeout(500);
      }
    } catch {}
    const m = await page.evaluate(() => {
      const n = performance.getEntriesByType("navigation")[0];
      const fcp = performance.getEntriesByName("first-contentful-paint")[0];
      return {
        ...window.__m,
        ttfb: n?.responseStart,
        fcp: fcp?.startTime,
        dcl: n?.domContentLoadedEventEnd,
        load: n?.loadEventEnd,
        nodes: document.getElementsByTagName("*").length,
        anims: document.getAnimations().length,
      };
    });
    const pm = Object.fromEntries(
      (await cdp.send("Performance.enable").then(() => cdp.send("Performance.getMetrics"))).metrics.map((x) => [x.name, x.value]),
    );
    const tbt = m.lt.filter(([s]) => s >= (m.fcp || 0)).reduce((a, [, d]) => a + Math.max(0, d - 50), 0);
    const row = {
      profile: pname,
      route: r,
      status,
      ttfb: Math.round(m.ttfb),
      fcp: Math.round(m.fcp),
      lcp: Math.round(m.lcp),
      lcpEl: m.lcpEl,
      cls: +m.cls.toFixed(4),
      tbt,
      longtasks: m.lt.length,
      maxLT: Math.max(0, ...m.lt.map((x) => x[1])),
      inpProxy: Math.max(0, ...m.ev.map((x) => x[1])),
      worstEv: m.ev
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map((x) => x.join(":"))
        .join(" "),
      reqs,
      kb: Object.fromEntries(Object.entries(bytes).map(([k, v]) => [k, +(v / 1024).toFixed(1)])),
      heapMB: +(pm.JSHeapUsedSize / 1048576).toFixed(1),
      listeners: pm.JSEventListeners,
      nodes: m.nodes,
      anims: m.anims,
    };
    out.push(row);
    console.log(JSON.stringify(row));
    await ctx.close();
  }
await browser.close();
await server?.close();
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(out, null, 1));
