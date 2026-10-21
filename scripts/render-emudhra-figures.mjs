// Renders the eMudhra post figures from src/assets/emudhra/ into public/blog/emudhra/.
//
//   <id>.svg   standalone wide layout: resolved light tokens, prefers-color-scheme: dark overrides,
//              animations play once (the .md mirror serves this file)
//   <id>.png   final state, light theme, 2x, wide layout, 24px export footer (1416 px wide: the wide
//              layouts are drawn on 708 units)
//   <id>.gif   trust-basic, d4-keyspace, attack-path, two-lanes, incident-timeline (not go-fix-flow): light theme, 2x,
//              12 fps, mpdecimate, palettegen stats_mode=diff max_colors=64, paletteuse dither=none,
//              frame 1 = final state, hold 1.6s, cut to empty, rebuild, hold 1.6s, loop
//   og-hero*.png              hero art and its crops
//
// Frames come from stepping document.getAnimations() (pause + currentTime) in Playwright; ffmpeg
// builds the GIFs. Nothing here installs anything.
//
// Usage: node scripts/render-emudhra-figures.mjs [id ...] [--no-gif] [--no-hero] [--check]
//        [--compact-dir=<dir>]   also write compact-layout PNGs there (review aid, not shipped)
//        [--keep-frames=<dir>]   keep the GIF frame PNGs there
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";
import { loadTokens } from "../src/assets/emudhra/tokens.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "src/assets/emudhra");
const OUT = join(ROOT, "public/blog/emudhra");

const IDS = ["trust-basic", "d4-keyspace", "two-lanes", "attack-path", "go-fix-flow", "incident-timeline"];
const GIF_IDS = new Set(["trust-basic", "d4-keyspace", "attack-path", "two-lanes", "incident-timeline"]);
const FOOTER = "ashwingopalsamy.in · as of 21 Oct 2026";
const FOOTER_H = 24;
const FPS = 12;
const HOLD_FRAMES = 19; // 1.6 s at 12 fps
const GIF_MAX_BYTES = 1.2 * 1024 * 1024;
// GIF pacing: the site staggers the grid rows at 16ms (--dur-stagger); at 12 fps that would show most
// rows in one frame, so the keyspace GIF slows the stagger to step visibly. No other figure staggers.
const GIF_STAGGER_MS = { "d4-keyspace": 64 };

const args = process.argv.slice(2);
const flag = (name) => args.some((a) => a === `--${name}`);
const opt = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const wanted = args.filter((a) => !a.startsWith("--"));
const ids = wanted.length ? IDS.filter((i) => wanted.includes(i)) : IDS;
const doHero = !flag("no-hero") && (!wanted.length || wanted.includes("og-hero"));
const doGif = !flag("no-gif");
const checkOnly = flag("check");

const { colors } = loadTokens();

// ---------------------------------------------------------------- fonts (data URIs, so the page is self-contained)
const b64 = (path) => readFileSync(join(ROOT, path)).toString("base64");
const FONT_CSS =
  `@font-face{font-family:"Inter Variable";font-style:normal;font-weight:100 900;src:url(data:font/woff2;base64,${b64("node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2")}) format("woff2-variations")}` +
  `@font-face{font-family:"JetBrains Mono";font-style:normal;font-weight:400;src:url(data:font/woff2;base64,${b64("node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2")}) format("woff2")}`;

// ---------------------------------------------------------------- standalone SVG
function tokenBlock(id) {
  const decl = (set) => Object.entries(set).map(([k, v]) => `--${k}:${v}`).join(";");
  return (
    `#fig-${id}{${decl(colors.light)}}` + `@media (prefers-color-scheme:dark){#fig-${id}{${decl(colors.dark)}}}`
  );
}

function viewBox(svg) {
  const m = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
  return { w: +m[1], h: +m[2] };
}

function standalone(id, layout = "wide", { armed = false, play = false, client = "" } = {}) {
  let svg = readFileSync(join(SRC, `${id}.${layout}.svg`), "utf8").trim();
  const { w, h } = viewBox(svg);
  const attrs =
    ` id="fig-${id}" width="${w}" height="${h}"` + (armed ? ' data-armed=""' : "") + (play ? ' data-play=""' : "") + (client ? ` data-client="${client}"` : "");
  svg = svg.replace(/^<svg /, `<svg${attrs} `).replace("<style>", `<style>${tokenBlock(id)}`);
  return { svg, w, h };
}

function publicSvg(id) {
  const { svg } = standalone(id, "wide", { armed: true, play: true });
  return `<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n`;
}

// ---------------------------------------------------------------- browser
async function launch() {
  const tries = [() => chromium.launch(), () => chromium.launch({ channel: "chrome" })];
  const cache = join(homedir(), "Library/Caches/ms-playwright");
  if (existsSync(cache)) {
    for (const dir of readdirSync(cache).filter((d) => d.startsWith("chromium-")).sort().reverse()) {
      const exe = join(cache, dir, "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing");
      if (existsSync(exe)) tries.push(() => chromium.launch({ executablePath: exe }));
    }
  }
  let last;
  for (const t of tries) {
    try {
      return await t();
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

const pageHtml = (inner, extra = "") =>
  `<!doctype html><meta charset="utf-8"><style>${FONT_CSS}html,body{margin:0;padding:0;background:${colors.light.canvas}}svg{display:block}${extra}</style><body>${inner}</body>`;

async function fontsReady(page) {
  await page.evaluate(async () => {
    await Promise.all([
      document.fonts.load('12px "Inter Variable"'),
      document.fonts.load('550 12px "Inter Variable"'),
      document.fonts.load('600 48px "Inter Variable"'),
      document.fonts.load('10px "JetBrains Mono"'),
      document.fonts.load('20px "JetBrains Mono"'),
    ]);
    await document.fonts.ready;
  });
}

const footerSvg = (w) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${FOOTER_H}" viewBox="0 0 ${w} ${FOOTER_H}"><text x="16" y="16" font-family='"JetBrains Mono",ui-monospace,monospace' font-size="12" fill="${colors.light.ghost}">${FOOTER}</text></svg>`;

async function pngBuffer(buf, exact) {
  let img = sharp(buf).removeAlpha();
  const meta = await sharp(buf).metadata();
  if (exact && (meta.width !== exact.w || meta.height !== exact.h)) img = img.resize(exact.w, exact.h, { fit: "fill" });
  return img.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
}

// ---------------------------------------------------------------- layout check
async function layoutIssues(page, tag) {
  const issues = await page.evaluate(() => {
    const out = [];
    const svg = document.querySelector("svg");
    const vb = svg.viewBox.baseVal;
    const texts = [...svg.querySelectorAll("text")].filter((t) => {
      // skip hidden state variants (opacity 0 through .ov or .av classes) and compact/wide twins
      const cs = getComputedStyle(t);
      let el = t;
      while (el && el !== svg) {
        if (getComputedStyle(el).opacity === "0") return false;
        el = el.parentElement;
      }
      return cs.display !== "none";
    });
    const label = (t) => `"${t.textContent.trim().slice(0, 40)}"`;
    for (const t of texts) {
      const px = parseFloat(getComputedStyle(t).fontSize);
      if (px < 14) out.push(`font below 14: ${label(t)} (${px}px)`);
    }
    const boxes = texts.map((t) => ({ t, b: t.getBBox() }));
    for (const { t, b } of boxes) {
      if (b.x < -0.5 || b.y < -0.5 || b.x + b.width > vb.width + 0.5 || b.y + b.height > vb.height + 0.5) {
        out.push(`outside viewBox: ${label(t)} (${b.x.toFixed(1)}, ${b.y.toFixed(1)}, ${b.width.toFixed(1)} x ${b.height.toFixed(1)})`);
      }
    }
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i].b;
        const c = boxes[j].b;
        const ox = Math.min(a.x + a.width, c.x + c.width) - Math.max(a.x, c.x);
        const oy = Math.min(a.y + a.height, c.y + c.height) - Math.max(a.y, c.y);
        // glyph boxes are taller than the ink; require a real overlap
        if (ox > 1 && oy > 4) out.push(`text overlap: ${label(boxes[i].t)} x ${label(boxes[j].t)} (${ox.toFixed(1)} x ${oy.toFixed(1)})`);
      }
    }
    const nodes = [...svg.querySelectorAll("rect.node")];
    for (const { t, b } of boxes) {
      const x = +t.getAttribute("x");
      const y = +t.getAttribute("y");
      const anchor = getComputedStyle(t).textAnchor;
      const cx = anchor === "middle" ? b.x + b.width / 2 : anchor === "end" ? b.x + b.width : x;
      const host = nodes
        .filter((r) => {
          const rb = r.getBBox();
          return cx > rb.x && cx < rb.x + rb.width && y > rb.y && y < rb.y + rb.height;
        })
        .sort((p, q) => p.getBBox().width * p.getBBox().height - q.getBBox().width * q.getBBox().height)[0];
      if (!host) continue;
      const rb = host.getBBox();
      const pad = 6;
      if (b.x < rb.x + pad - 0.5 || b.x + b.width > rb.x + rb.width - pad + 0.5) {
        out.push(`text crowds its node: ${label(t)} spans ${b.x.toFixed(1)}-${(b.x + b.width).toFixed(1)}, node ${rb.x}-${rb.x + rb.width}`);
      }
    }
    return out;
  });
  return issues.map((m) => `${tag}: ${m}`);
}

// ---------------------------------------------------------------- GIF
function ffmpeg(args, label) {
  const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`ffmpeg failed (${label}): ${r.stderr}`);
}

async function makeGif(browser, id, frameDir) {
  const context = await browser.newContext({ deviceScaleFactor: 2, colorScheme: "light", reducedMotion: "no-preference" });
  const page = await context.newPage();
  const { w, h } = viewBox(readFileSync(join(SRC, `${id}.wide.svg`), "utf8"));
  await page.setViewportSize({ width: w, height: h + FOOTER_H });
  const { svg } = standalone(id, "wide", { armed: true });
  await page.setContent(pageHtml(`${svg}${footerSvg(w)}`));
  await fontsReady(page);
  const shot = async () => pngBuffer(await page.screenshot({ clip: { x: 0, y: 0, width: w, height: h + FOOTER_H } }));

  // empty canvas: armed, not yet played (initial states apply)
  const empty = await shot();
  // play, then step every animation to a shared timeline position
  await page.evaluate(
    ([fid, stagger]) => {
      const el = document.getElementById(`fig-${fid}`);
      if (stagger) el.style.setProperty("--dur-stagger", `${stagger}ms`);
      el.setAttribute("data-play", "");
    },
    [id, GIF_STAGGER_MS[id]],
  );
  const total = await page.evaluate(() => {
    const anims = document.getAnimations();
    return Math.max(0, ...anims.map((a) => a.effect.getComputedTiming().endTime));
  });
  const steps = Math.ceil(total / (1000 / FPS)) + 1;
  const rebuild = [];
  for (let k = 0; k < steps; k += 1) {
    const t = Math.min(total, (k * 1000) / FPS);
    await page.evaluate((time) => {
      for (const a of document.getAnimations()) {
        a.pause();
        a.currentTime = time;
      }
    }, t);
    rebuild.push(await shot());
  }
  // final state = last rebuild frame (animations finished); verify against the untouched final render
  const final = rebuild[rebuild.length - 1];
  await context.close();

  const sequence = [];
  for (let i = 0; i < HOLD_FRAMES; i += 1) sequence.push(final);
  sequence.push(empty);
  for (const f of rebuild.slice(0, -1)) sequence.push(f);
  for (let i = 0; i < HOLD_FRAMES; i += 1) sequence.push(final);

  const dir = join(frameDir, id);
  mkdirSync(dir, { recursive: true });
  sequence.forEach((buf, i) => writeFileSync(join(dir, `f${String(i + 1).padStart(4, "0")}.png`), buf));

  const gif = join(OUT, `${id}.gif`);
  const graph =
    "mpdecimate=hi=64*12:lo=64*5:frac=0.33,split[a][b];[a]palettegen=stats_mode=diff:max_colors=64[p];[b][p]paletteuse=dither=none:diff_mode=rectangle";
  ffmpeg(
    ["-framerate", String(FPS), "-i", join(dir, "f%04d.png"), "-filter_complex", graph, "-fps_mode", "vfr", "-loop", "0", "-final_delay", "158", gif],
    id,
  );
  const size = statSync(gif).size;
  return { size, frames: sequence.length, rebuild: rebuild.length, total, flagged: size > GIF_MAX_BYTES };
}

// ---------------------------------------------------------------- hero
const HERO_FILES = [
  // name, device scale factor, css clip, exact output
  ["og-hero.png", 1200 / 1280, { x: 0, y: 24, width: 1280, height: 672 }, { w: 1200, h: 630 }],
  ["og-hero-16x9.png", 1, { x: 0, y: 0, width: 1280, height: 720 }, { w: 1280, h: 720 }],
  ["og-hero-4x3.png", 1.25, { x: 160, y: 0, width: 960, height: 720 }, { w: 1200, h: 900 }],
  ["og-hero-1x1.png", 1200 / 720, { x: 280, y: 0, width: 720, height: 720 }, { w: 1200, h: 1200 }],
];

async function renderHero(browser) {
  const file = join(SRC, "og-hero.svg");
  if (!existsSync(file)) {
    console.warn("render: og-hero.svg is missing; skipping the hero");
    return;
  }
  const svg = readFileSync(file, "utf8").trim().replace(/^<svg /, "<svg width=\"1280\" height=\"720\" ");
  const html = pageHtml(svg);
  for (const [name, dsf, clip, exact] of HERO_FILES) {
    const context = await browser.newContext({ deviceScaleFactor: dsf, colorScheme: "light", viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    await page.setContent(html);
    await fontsReady(page);
    const buf = await pngBuffer(await page.screenshot({ clip }), exact);
    writeFileSync(join(OUT, name), buf);
    await context.close();
    console.log(`  ${name}  ${exact.w}x${exact.h}  ${(buf.length / 1024).toFixed(0)} KB`);
  }
}

// ---------------------------------------------------------------- main
mkdirSync(OUT, { recursive: true });
// retired figures (perspective, blast-radius, the old trust-chain and its clients sheet)
for (const name of readdirSync(OUT)) if (/^(perspective|blast-radius|trust-chain)[.-]/.test(name)) rmSync(join(OUT, name));
const frameDir = opt("keep-frames") ?? mkdtempSync(join(tmpdir(), "emudhra-frames-"));
const compactDir = opt("compact-dir");
if (compactDir) mkdirSync(compactDir, { recursive: true });

const browser = await launch();
const problems = [];
try {
  const context = await browser.newContext({ deviceScaleFactor: 2, colorScheme: "light", reducedMotion: "no-preference" });
  for (const id of ids) {
    const { svg, w, h } = standalone(id, "wide");
    const page = await context.newPage();
    await page.setViewportSize({ width: w, height: h + FOOTER_H });
    await page.setContent(pageHtml(`${svg}${footerSvg(w)}`));
    await fontsReady(page);
    problems.push(...(await layoutIssues(page, `${id} wide`)));
    if (!checkOnly) {
      writeFileSync(join(OUT, `${id}.svg`), publicSvg(id));
      const png = await pngBuffer(await page.screenshot({ clip: { x: 0, y: 0, width: w, height: h + FOOTER_H } }));
      writeFileSync(join(OUT, `${id}.png`), png);
      console.log(`  ${id}.svg ${(statSync(join(OUT, `${id}.svg`)).size / 1024).toFixed(1)} KB, ${id}.png ${w * 2}x${(h + FOOTER_H) * 2} ${(png.length / 1024).toFixed(0)} KB`);
    }
    await page.close();

    // compact layout: layout check always, PNG only as a review aid 
    const c = standalone(id, "compact");
    const cpage = await context.newPage();
    await cpage.setViewportSize({ width: c.w, height: c.h });
    await cpage.setContent(pageHtml(c.svg));
    await fontsReady(cpage);
    problems.push(...(await layoutIssues(cpage, `${id} compact`)));
    if (compactDir) writeFileSync(join(compactDir, `${id}.compact.png`), await pngBuffer(await cpage.screenshot({ clip: { x: 0, y: 0, width: c.w, height: c.h } })));
    await cpage.close();

  }
  await context.close();

  if (!checkOnly && doGif) {
    for (const id of ids.filter((i) => GIF_IDS.has(i))) {
      const r = await makeGif(browser, id, frameDir);
      console.log(`  ${id}.gif ${(r.size / 1024).toFixed(0)} KB, ${r.frames} frames (rebuild ${r.rebuild}, ${Math.round(r.total)} ms)${r.flagged ? "  OVER 1.2 MB" : ""}`);
      if (r.flagged) problems.push(`${id}.gif is over 1.2 MB`);
    }
  }
  if (!checkOnly && doHero) {
    console.log("hero:");
    await renderHero(browser);
  }
} finally {
  await browser.close();
  if (!opt("keep-frames")) rmSync(frameDir, { recursive: true, force: true });
}

if (problems.length) {
  console.log(`\nlayout/size findings (${problems.length}):`);
  for (const p of problems) console.log(`  ${p}`);
} else console.log("\nno layout findings");
