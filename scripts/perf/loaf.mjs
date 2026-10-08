// Manual long-animation-frame (LoAF) attribution (not a test): LoAF >50ms during load and during one interaction
// (theme toggle, palette, library tab, hover rows), plus events >=40ms, via loaf-init.js.
// Profile: mobile 412x823 @1.75 with 4x CPU (no network throttling); the hover case is desktop 1440x900 at 4x CPU.
// Env: BASE=<origin> or DIST=<dir, default dist>; OUT=<file.json>; CHROME_CHANNEL (empty = bundled Chromium).
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { startServer } from "./serve.mjs";

const server = process.env.BASE ? undefined : await startServer(process.env.DIST || "dist", 0);
const B = (process.env.BASE || server.base).replace(/\/+$/, "");
const browser = await chromium.launch({ channel: (process.env.CHROME_CHANNEL ?? "chrome") || undefined });
const initScript = path.join(import.meta.dirname, "loaf-init.js");
const out = [];

async function run(route, label, act, mobile = true) {
  const ctx = await browser.newContext(
    mobile
      ? { viewport: { width: 412, height: 823 }, deviceScaleFactor: 1.75, isMobile: true, hasTouch: true }
      : { viewport: { width: 1440, height: 900 } },
  );
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.addInitScript({ path: initScript });
  await page.goto(B + route, { waitUntil: "load" });
  await page.waitForTimeout(2500);
  const n0 = await page.evaluate(() => window.__l.length);
  if (act) {
    await act(page);
    await page.waitForTimeout(1200);
  }
  const r = await page.evaluate(
    (n0) => ({
      loafLoad: window.__l.slice(0, n0).filter((x) => x.d > 50),
      loafAct: window.__l.slice(n0).filter((x) => x.d > 50),
      events: window.__e.filter((x) => x.d >= 40),
    }),
    n0,
  );
  console.log(`\n=== ${label} ${route}`);
  console.log("load LoAF>50ms:", JSON.stringify(r.loafLoad));
  if (act) {
    console.log("interaction LoAF>50ms:", JSON.stringify(r.loafAct));
    console.log("events>=40ms:", JSON.stringify(r.events));
  }
  out.push({ label, route, ...r });
  await ctx.close();
}

const themeSel = '[data-theme-toggle], button[aria-label*="theme" i], #theme-toggle';
await run("/", "home theme toggle (mobile 4x)", async (p) => {
  const t = await p.$(themeSel);
  console.log("theme btn", !!t);
  await t?.click();
});
await run("/", "home palette Meta+K + type (mobile 4x)", async (p) => {
  await p.keyboard.press("Meta+k");
  await p.waitForTimeout(800);
  await p.keyboard.type("go");
});
await run("/library/", "library tab click (mobile 4x)", async (p) => {
  const tabs = await p.$$('[role="tab"]');
  console.log("tabs", tabs.length);
  if (tabs[2]) await tabs[2].click();
});
await run("/blog/go-was-never-bad/", "mermaid post load (mobile 4x)", null);
await run(
  "/",
  "home hover rows (desktop 4x)",
  async (p) => {
    const rows = await p.$$("main a");
    for (const r of rows.slice(0, 8)) {
      await r.hover();
      await p.waitForTimeout(60);
    }
  },
  false,
);
await browser.close();
await server?.close();
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(out, null, 1));
