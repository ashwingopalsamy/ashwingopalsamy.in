// Screenshot harness. Capture: node scripts/perf/shots.mjs --dist dist --out <dir> [--mode full|swap]
// Compare: node scripts/perf/shots.mjs --compare <dirA> <dirB> [--diff <outDir>]  (exit 1 if any image differs > 0.1%)
// Modes: full = direct page.goto per page; swap = load "/" then client-side navigate to each page.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";
import { startServer } from "./serve.mjs";

const argv = process.argv.slice(2);
const opt = (name, n = 1) => {
  const i = argv.indexOf(`--${name}`);
  return i < 0 ? undefined : n === 1 ? argv[i + 1] : argv.slice(i + 1, i + 1 + n);
};

const FREEZE_CSS = "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}";
const viewports = [
  { name: "m390", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: "d1280", viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
];
const schemes = ["light", "dark"];

function listPages(dist) {
  const pages = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === "index.html") {
        const html = fs.readFileSync(p, "utf8");
        if (/http-equiv=["']refresh["']/i.test(html)) continue;
        if (!/site-chrome/.test(html)) continue;
        const rel = "/" + path.relative(dist, path.dirname(p)).split(path.sep).join("/");
        pages.push(rel === "/" ? "/" : rel + "/");
      }
    }
  };
  walk(dist);
  return pages.sort();
}

const slug = (p) => (p === "/" ? "index" : p.replace(/^\/|\/$/g, "").replace(/\//g, "__"));

async function freeze(page) {
  await page.evaluate(async (css) => {
    if (!document.getElementById("__freeze")) {
      const s = document.createElement("style");
      s.id = "__freeze";
      s.textContent = css;
      document.head.appendChild(s);
    }
    await document.fonts.ready;
  }, FREEZE_CSS);
  await page.waitForTimeout(300);
}

async function capture() {
  const dist = opt("dist");
  const out = opt("out");
  const mode = opt("mode") || "full";
  if (!dist || !out) throw new Error("--dist and --out required");
  fs.mkdirSync(out, { recursive: true });
  const pages = listPages(path.resolve(dist));
  const server = await startServer(dist, 0);
  const browser = await chromium.launch();
  let count = 0;
  const failures = [];
  for (const vp of viewports)
    for (const scheme of schemes) {
      const { name, ...ctxOpts } = vp;
      const ctx = await browser.newContext({ ...ctxOpts, colorScheme: scheme, reducedMotion: "no-preference" });
      await ctx.addInitScript((t) => {
        try {
          localStorage.setItem("theme", t);
        } catch {}
      }, scheme);
      const page = await ctx.newPage();
      if (mode === "swap") {
        await page.goto(server.base + "/", { waitUntil: "load" });
        await freeze(page);
      }
      for (const p of pages) {
        try {
          if (mode === "full") {
            await page.goto(server.base + p, { waitUntil: "load" });
          } else if (p !== "/") {
            const router = await page.evaluate(
              () => !!(window.__astroNavigate || document.querySelector('meta[name="astro-view-transitions-enabled"]')),
            );
            if (!router) {
              await page.goto(server.base + p, { waitUntil: "load" });
            } else {
              await page.evaluate(
                (to) =>
                  new Promise((resolve) => {
                    document.addEventListener("astro:page-load", () => resolve(), { once: true });
                    if (window.__astroNavigate) return void window.__astroNavigate(to);
                    const a = document.createElement("a");
                    a.href = to;
                    a.style.cssText = "position:fixed;left:0;top:0;width:10px;height:10px;opacity:0";
                    document.body.appendChild(a);
                    a.click();
                  }),
                p,
              );
            }
          } else {
            // "/" in swap mode: already loaded first; re-swap back to it only if we are elsewhere.
            if (new URL(page.url()).pathname !== "/") await page.goto(server.base + "/", { waitUntil: "load" });
          }
          await freeze(page);
          await page.evaluate(() => window.scrollTo(0, 0));
          const file = path.join(out, `${slug(p)}.${name}.${scheme}.png`);
          await page.screenshot({ path: file });
          count++;
        } catch (e) {
          failures.push(`${p} ${name} ${scheme}: ${e.message.split("\n")[0]}`);
          if (mode === "swap") await page.goto(server.base + "/", { waitUntil: "load" }).catch(() => {});
        }
      }
      await ctx.close();
    }
  await browser.close();
  await server.close();
  console.log(`captured ${count} screenshots (${pages.length} pages x ${viewports.length} viewports x ${schemes.length} schemes) -> ${out}`);
  if (failures.length) {
    console.error(`${failures.length} failures:\n` + failures.join("\n"));
    process.exit(1);
  }
}

async function compare() {
  const [a, b] = opt("compare", 2);
  const diffDir = opt("diff");
  if (diffDir) fs.mkdirSync(diffDir, { recursive: true });
  const filesA = new Set(fs.readdirSync(a).filter((f) => f.endsWith(".png")));
  const filesB = new Set(fs.readdirSync(b).filter((f) => f.endsWith(".png")));
  const rows = [];
  for (const f of new Set([...filesA, ...filesB])) {
    if (!filesA.has(f) || !filesB.has(f)) {
      rows.push({ f, pct: 100, note: filesA.has(f) ? "missing in B" : "missing in A" });
      continue;
    }
    const [ia, ib] = await Promise.all(
      [a, b].map((d) => sharp(path.join(d, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })),
    );
    if (ia.info.width !== ib.info.width || ia.info.height !== ib.info.height) {
      rows.push({ f, pct: 100, note: `size ${ia.info.width}x${ia.info.height} vs ${ib.info.width}x${ib.info.height}` });
      continue;
    }
    const { data: da, info } = ia;
    const db = ib.data;
    const mask = diffDir ? Buffer.alloc(da.length) : null;
    let n = 0;
    for (let i = 0; i < da.length; i += 4) {
      const differs =
        Math.abs(da[i] - db[i]) > 8 ||
        Math.abs(da[i + 1] - db[i + 1]) > 8 ||
        Math.abs(da[i + 2] - db[i + 2]) > 8 ||
        Math.abs(da[i + 3] - db[i + 3]) > 8;
      if (differs) {
        n++;
        if (mask) {
          mask[i] = 255;
          mask[i + 3] = 255;
        }
      } else if (mask) {
        mask[i] = da[i] >> 2;
        mask[i + 1] = da[i + 1] >> 2;
        mask[i + 2] = da[i + 2] >> 2;
        mask[i + 3] = 255;
      }
    }
    const pct = (n / (da.length / 4)) * 100;
    if (mask && n)
      await sharp(mask, { raw: { width: info.width, height: info.height, channels: 4 } })
        .png()
        .toFile(path.join(diffDir, f));
    rows.push({ f, pct });
  }
  rows.sort((x, y) => y.pct - x.pct);
  console.log("diff%     image");
  for (const r of rows) if (r.pct > 0 || r.note) console.log(`${r.pct.toFixed(3).padStart(7)}   ${r.f}${r.note ? "  (" + r.note + ")" : ""}`);
  const bad = rows.filter((r) => r.pct > 0.1);
  console.log(`${rows.length} images compared, ${bad.length} over 0.1%`);
  if (bad.length) process.exit(1);
}

if (opt("compare", 2)) await compare();
else await capture();
