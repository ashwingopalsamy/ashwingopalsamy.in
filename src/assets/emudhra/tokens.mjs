// Resolves the site's colour and motion tokens to literals for the eMudhra figures.
// The figure sources carry `var(--token, <light literal>)`; the standalone SVG, PNG and GIF
// export gets the light literals plus a `prefers-color-scheme: dark` block. Nothing here is
// invented: every value is read from src/styles/global.css and src/styles/motion.css.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

// The colour tokens the figures use (figure-specs.md section 0).
export const COLOR_TOKENS = [
  "canvas", "ink", "ghost", "faint", "edge", "edge-soft", "edge-strong", "wash",
  "acc-violet", "acc-green", "acc-amber", "acc-red", "acc-blue", "ok-wash", "err-wash",
];
export const MOTION_TOKENS = [
  "dur-enter", "dur-exit", "dur-tint", "dur-spring-snap", "dur-spring-soft", "dur-spring-pop",
  "ease-enter", "ease-exit", "ease-snap", "ease-spring-snap", "ease-spring-soft", "ease-spring-pop",
];
// Proposed token (experience-spec section 4.7); the figures fall back to it when the site lacks it.
export const STAGGER_FALLBACK = "16ms";

function block(css, header) {
  const start = css.indexOf(header);
  if (start < 0) throw new Error(`tokens: block not found: ${header}`);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}" && (depth -= 1) === 0) return css.slice(open + 1, i);
  }
  throw new Error(`tokens: unbalanced block: ${header}`);
}

function declarations(body) {
  const out = {};
  const clean = body.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of clean.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim().replace(/\s+/g, " ");
  return out;
}

function splitTop(str, sep) {
  const parts = [];
  let depth = 0;
  let cur = "";
  for (const ch of str) {
    if (ch === "(") depth += 1;
    if (ch === ")") depth -= 1;
    if (ch === sep && depth === 0) {
      parts.push(cur);
      cur = "";
    } else cur += ch;
  }
  parts.push(cur);
  return parts.map((s) => s.trim());
}

// ---- colour evaluation: oklch literals, var(), color-mix(in oklch, ...), transparent ----
function evalColor(value, env, depth = 0) {
  if (depth > 20) throw new Error(`tokens: cycle near ${value}`);
  const v = value.trim();
  if (v === "transparent") return { L: 0, C: 0, h: 0, a: 0, none: true };
  let m = v.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/);
  if (m) {
    if (env[m[1]] != null) return evalColor(env[m[1]], env, depth + 1);
    if (m[2]) return evalColor(m[2], env, depth + 1);
    throw new Error(`tokens: unresolved ${m[1]}`);
  }
  m = v.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/);
  if (m) {
    let a = 1;
    if (m[4]) a = m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return { L: +m[1], C: +m[2], h: +m[3], a };
  }
  m = v.match(/^color-mix\(\s*in oklch\s*,(.*)\)$/);
  if (m) {
    const [a1, a2] = splitTop(m[1], ",");
    const take = (s) => {
      const pm = s.match(/^(.*?)\s+([\d.]+)%$/);
      return pm ? { c: evalColor(pm[1], env, depth + 1), p: parseFloat(pm[2]) / 100 } : { c: evalColor(s, env, depth + 1), p: null };
    };
    let A = take(a1);
    let B = take(a2);
    if (A.p == null && B.p == null) A.p = B.p = 0.5;
    else if (A.p == null) A.p = 1 - B.p;
    else if (B.p == null) B.p = 1 - A.p;
    const alpha = A.c.a * A.p + B.c.a * B.p;
    if (alpha === 0) return { L: 0, C: 0, h: 0, a: 0 };
    const wA = (A.c.a * A.p) / alpha;
    const wB = (B.c.a * B.p) / alpha;
    // transparent contributes no hue; neutral colours take the other side's hue
    const hueA = A.c.none || A.c.C < 1e-4 ? B.c.h : A.c.h;
    const hueB = B.c.none || B.c.C < 1e-4 ? A.c.h : B.c.h;
    let dh = hueB - hueA;
    if (dh > 180) dh -= 360;
    if (dh < -180) dh += 360;
    const h = (((hueA + dh * wB) % 360) + 360) % 360;
    return { L: A.c.L * wA + B.c.L * wB, C: A.c.C * wA + B.c.C * wB, h, a: alpha };
  }
  throw new Error(`tokens: cannot evaluate "${value}"`);
}

function oklchToSrgb({ L, C, h }) {
  const hr = (h * Math.PI) / 180;
  const a = C * Math.cos(hr);
  const b = C * Math.sin(hr);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return lin.map((x) => {
    const c = Math.min(1, Math.max(0, x));
    const g = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.round(g * 255);
  });
}

export function toCss(color) {
  const [r, g, b] = oklchToSrgb(color);
  if (color.a >= 0.9995) return "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
  return `rgba(${r},${g},${b},${+color.a.toFixed(4)})`;
}

let cached;
export function loadTokens() {
  if (cached) return cached;
  const globalCss = readFileSync(join(ROOT, "src/styles/global.css"), "utf8");
  const motionCss = readFileSync(join(ROOT, "src/styles/motion.css"), "utf8");
  const light = declarations(block(globalCss, ":root {"));
  const darkOnly = declarations(block(globalCss, ':root[data-theme="dark"] {'));
  const dark = { ...light, ...darkOnly };
  const motion = declarations(block(motionCss, ":root {"));
  const colors = { light: {}, dark: {} };
  for (const name of COLOR_TOKENS) {
    colors.light[name] = toCss(evalColor(`var(--${name})`, light));
    colors.dark[name] = toCss(evalColor(`var(--${name})`, dark));
  }
  const motionOut = {};
  for (const name of MOTION_TOKENS) {
    if (!motion[`--${name}`]) throw new Error(`tokens: --${name} missing from motion.css`);
    motionOut[name] = motion[`--${name}`];
  }
  cached = { colors, motion: motionOut };
  return cached;
}
