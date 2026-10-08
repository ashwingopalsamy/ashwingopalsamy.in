#!/usr/bin/env node
// Design-token guard. Manual and read-only: not a test, not wired into the build.
//
//   node scripts/check-tokens.mjs [--json] [--strict] [--examples=N]
//
// Reports (1) raw values in src/styles/*.css and <style> blocks in src/**/*.astro
// that bypass the token system, and (2) drift between DESIGN.md frontmatter and
// the CSS custom properties. Counts are per declaration per category (a
// box-shadow with three raw colours is one colour finding); --json lists every
// finding. Custom properties declared in TOKEN_FILES are token definitions and
// exempt; elsewhere only the property-independent colour check applies to them.

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// go-tour.css is a self-contained code-playground theme: its --code-*/--gt-* palette blocks are token definitions.
const TOKEN_FILES = new Set(['geometry', 'motion', 'fonts', 'global', 'go-tour'].map((n) => `src/styles/${n}.css`));
const ALLOWED_BREAKPOINTS = ['38rem', '42.5rem', '72rem'];
const DRIFT_GROUPS = ['colors', 'rounded', 'spacing', 'motion'];
const DRIFT_SKIP = new Set(['nestingRule', 'rhythm', 'step']); // prose / meta keys
// DESIGN.md `colors` keys keep their names (src/pages/design.astro reads them), so they map to CSS names
// explicitly. `-light` is compared with the first definition (light theme), `-dark` with the first one
// inside the [data-theme="dark"] block of global.css. Unmapped keys fall back to `--<key>`.
const COLOR_MAP = {
  ...Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`neutral-0${i + 1}`, `--color-${i + 1}`])),
  success: '--acc-green', warning: '--acc-amber', information: '--acc-blue', important: '--acc-violet', caution: '--acc-red',
};
const LEGACY = /var\(\s*(--(?:space-\d+|dur-[1-5]|ease(?:-out|-in-out|-drawer|-spring)?))\s*[,)]/g;

// ---- CLI ---------------------------------------------------------------
const args = process.argv.slice(2);
const bad = args.find((a) => !['--json', '--strict'].includes(a) && !/^--examples=\d+$/.test(a));
if (bad) {
  console.error(`unknown argument: ${bad}\nusage: node scripts/check-tokens.mjs [--json] [--strict] [--examples=N]`);
  process.exit(2);
}
const examplesN = Number(args.find((a) => a.startsWith('--examples='))?.split('=')[1] ?? 8);

// ---- CSS helpers -------------------------------------------------------
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const all = (re, s) => Array.from(s.matchAll(re));
const squash = (s) => s.replace(/\s+/g, ' ').trim();
const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 3)}...` : s);
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' ')); // keeps line numbers

function closeParen(s, open) {
  let depth = 0;
  for (let i = open, q = null; i < s.length; i++) {
    const c = s[i];
    if (q) q = c === '\\' ? (i++, q) : c === q ? null : q;
    else if (c === '"' || c === "'") q = c;
    else if (c === '(') depth++;
    else if (c === ')' && --depth === 0) return i;
  }
  return s.length - 1;
}

// Replace outermost calls matched by `re` (which must end at the opening paren) when pred(callText).
function blank(s, re, pred) {
  let out = '', last = 0, m;
  re.lastIndex = 0;
  while ((m = re.exec(s))) {
    const end = closeParen(s, m.index + m[0].length - 1);
    if (!pred(s.slice(m.index, end + 1))) continue;
    out += `${s.slice(last, m.index)} `;
    last = re.lastIndex = end + 1;
  }
  return out + s.slice(last);
}

// Remove everything a token already governs: math containing var(), then var() itself.
const scrub = (v) =>
  blank(blank(v, /(?<![\w-])(?:calc|clamp|min|max)\(/g, (t) => t.includes('var(')), /(?<![\w-])var\(/g, () => true);

// Split into declarations (with file line numbers) and @media preludes.
function parseCss(src, line) {
  const decls = [], medias = [];
  let buf = '', start = line, depth = 0, quote = null;
  const flush = (end) => {
    const text = buf.trim();
    buf = '';
    if (end === '{') {
      if (text.startsWith('@media')) medias.push({ prelude: text, line: start });
    } else if (text && !text.startsWith('@')) {
      const i = text.indexOf(':');
      const prop = text.slice(0, i).trim();
      if (i > 0 && /^-{0,2}[a-z][\w-]*$/i.test(prop)) {
        decls.push({ prop: prop.toLowerCase(), value: squash(text.slice(i + 1).replace(/!important\s*$/i, '')), line: start });
      }
    }
  };
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (c === '\n') line++;
    if (!quote && depth === 0 && (c === '{' || c === '}' || c === ';')) { flush(c); continue; }
    if (buf.trim() === '' && /\S/.test(c)) start = line;
    buf += c;
    if (c === '\\') { buf += src[++i] ?? ''; if (buf.endsWith('\n')) line++; }
    else if (quote) { if (c === quote) quote = null; }
    else if (c === '"' || c === "'") quote = c;
    else if (c === '(') depth++;
    else if (c === ')') depth = Math.max(0, depth - 1);
  }
  return { decls, medias };
}

function* sources() {
  for (const f of readdirSync(join(ROOT, 'src/styles')).sort()) {
    if (f.endsWith('.css')) yield { file: `src/styles/${f}`, css: read(`src/styles/${f}`), line: 1 };
  }
  for (const f of readdirSync(join(ROOT, 'src'), { recursive: true }).sort()) {
    if (!f.endsWith('.astro')) continue;
    const file = `src/${f}`, text = read(file);
    for (const m of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)) {
      const at = m.index + m[0].length - '</style>'.length - m[1].length;
      yield { file, css: m[1], line: text.slice(0, at).split('\n').length };
    }
  }
}

// ---- rules -------------------------------------------------------------
const LEN = /(?<![\w.-])(-?\d*\.?\d+)(px|rem)(?![\w-])/g;
const TIME = /(?<![\w.-])(-?\d*\.?\d+)(ms|s)(?![\w-])/g;
const EASE = /(?<![\w-])(?:cubic-bezier\(|linear\(|(?:ease-in-out|ease-in|ease-out|ease)(?![\w(-]))/g;
const COLOR = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])|(?<![\w-])(?:rgba?|hsla?|oklch|oklab)\(/gi;
const SPACING = /^(?:(?:scroll-)?(?:margin|padding)(?:-.+)?|inset(?:-.+)?|(?:row-|column-|grid-)?gap|top|right|bottom|left|(?:min-|max-)?(?:width|height|inline-size|block-size))$/;
const MOTION = /^(?:transition|animation)(?:-|$)/;
const lens = (v) => all(LEN, v).map((m) => ({ text: m[0], px: parseFloat(m[1]) * (m[2] === 'rem' ? 16 : 1) }));
const onLattice = (px) => Math.abs(px / 4 - Math.round(px / 4)) < 1e-3;

// [category, applies to property, offending literals in value]
const RULES = [
  ['spacing', (p) => SPACING.test(p), (v) => lens(scrub(v)).filter((l) => Math.abs(l.px) > 2 && !onLattice(l.px)).map((l) => l.text)],
  ['radius', (p) => /^border(?:-[a-z]+)*-radius$/.test(p), (v) => lens(scrub(v)).filter((l) => l.px !== 0).map((l) => l.text)],
  ['duration', (p) => MOTION.test(p), (v) => all(TIME, scrub(v)).filter((m) => parseFloat(m[1]) !== 0).map((m) => m[0])],
  ['easing', (p) => MOTION.test(p) || p.endsWith('-timing-function'), (v) => all(EASE, scrub(v)).map((m) => m[0])],
  ['z-index', (p) => p === 'z-index', (v) => { const s = scrub(v).trim(); return /^-?\d+$/.test(s) && Math.abs(+s) > 3 ? [s] : []; }],
  ['color', () => true, (v) => all(COLOR, blank(v, /(?<![\w-])url\(/g, () => true)).map((m) => m[0])],
  ['font-size', (p) => p === 'font-size', (v) => lens(scrub(v)).map((l) => l.text)],
];
const CATEGORIES = [...RULES.map((r) => r[0]), 'breakpoint'];

// ---- scan --------------------------------------------------------------
const findings = [], legacy = {}, tokens = new Map(), darkTokens = new Map(), breakpoints = new Map();
let nDecls = 0, nSources = 0;

for (const src of sources()) {
  nSources++;
  const css = stripComments(src.css);
  const { decls, medias } = parseCss(css, src.line);
  const darkAt = src.file === 'src/styles/global.css' ? css.split('\n').findIndex((l) => l.includes('[data-theme="dark"]')) : -1;
  for (const d of decls) {
    nDecls++;
    for (const m of d.value.matchAll(LEGACY)) legacy[m[1]] = (legacy[m[1]] ?? 0) + 1;
    const custom = d.prop.startsWith('--');
    if (custom && TOKEN_FILES.has(src.file)) {
      if (!tokens.has(d.prop)) tokens.set(d.prop, d.value);
      if (darkAt >= 0 && d.line > src.line + darkAt && !darkTokens.has(d.prop)) darkTokens.set(d.prop, d.value);
      continue;
    }
    for (const [cat, applies, find] of RULES) {
      if (!applies(d.prop) || (custom && cat !== 'color')) continue;
      const hits = find(d.value);
      if (hits.length) findings.push({ cat, file: src.file, line: d.line, prop: d.prop, value: d.value, hits });
    }
  }
  for (const m of medias) {
    for (const g of m.prelude.matchAll(/\(([^()]*)\)/g)) {
      if (!/(?<![\w-])(?:min-|max-)?width(?![\w-])/.test(g[1])) continue;
      for (const v of all(/(?<![\w.])\d*\.?\d+(?:px|rem|em)(?![\w-])/g, g[1]).map((x) => x[0])) {
        const b = breakpoints.get(v) ?? { value: v, count: 0, allowed: ALLOWED_BREAKPOINTS.includes(v) };
        b.count++;
        breakpoints.set(v, b);
        if (!b.allowed) findings.push({ cat: 'breakpoint', file: src.file, line: m.line, prop: '@media', value: m.prelude, hits: [v] });
      }
    }
  }
}

// ---- DESIGN.md drift ---------------------------------------------------
function norm(v) {
  return String(v).trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s*([,()])\s*/g, '$1')
    .replace(/(?<![\w.])\.(\d)/g, '0.$1')
    .replace(/(?<![\w.])(\d*\.?\d+)rem(?![\w-])/g, (_, n) => `${+(n * 16).toFixed(3)}px`)
    .replace(/(?<![\w.])(\d*\.?\d+)s(?![\w-])/g, (_, n) => `${+(n * 1000).toFixed(3)}ms`);
}

function drift() {
  let fm;
  try {
    const m = read('DESIGN.md').match(/(?:^|\n)---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) return { error: 'no frontmatter found in DESIGN.md' };
    fm = parseYaml(m[1]);
  } catch (e) {
    return { error: `DESIGN.md frontmatter: ${e.message}` };
  }
  const out = {};
  for (const g of DRIFT_GROUPS) {
    const r = (out[g] = { ok: [], missing: [], mismatch: [], unresolved: [], unchecked: [] });
    for (const [key, want] of Object.entries(fm?.[g] ?? {})) {
      if (DRIFT_SKIP.has(key) || !['string', 'number'].includes(typeof want)) continue;
      const split = g === 'colors' && key.match(/^(.+)-(light|dark)$/);
      const name = (g === 'colors' && (COLOR_MAP[key] ?? (split && COLOR_MAP[split[1]]))) || `--${key}`;
      const scope = split?.[2] === 'dark' && name !== `--${key}` ? darkTokens : tokens;
      let have = scope.get(name);
      if (have === undefined) { (scope === tokens ? r.missing : r.unchecked).push(key); continue; }
      const ref = have.match(/^var\(\s*(--[\w-]+)\s*\)$/);
      if (ref) have = scope.get(ref[1]) ?? tokens.get(ref[1]) ?? have; // resolve one level
      if (/(?<![\w-])(?:calc|linear|clamp|min|max|color-mix|var)\(/.test(have)) r.unresolved.push(key);
      else if (norm(want) === norm(have)) r.ok.push(key);
      else r.mismatch.push({ key, design: String(want), css: have });
    }
  }
  return out;
}

// ---- report ------------------------------------------------------------
const totals = Object.fromEntries(CATEGORIES.map((c) => [c, findings.filter((f) => f.cat === c).length]));
const files = {};
for (const f of findings) ((files[f.file] ??= {})[f.cat] = (files[f.file][f.cat] ?? 0) + 1);
const bps = [...breakpoints.values()].sort((a, b) => b.count - a.count);
const driftResult = drift();

if (args.includes('--json')) {
  console.log(JSON.stringify({ totals, files, findings, legacy, breakpoints: bps, drift: driftResult }, null, 2));
} else {
  const L = [`Token report: ${nDecls} declarations in ${nSources} CSS sources`, '', 'Category      Findings'];
  for (const c of CATEGORIES) L.push(`${c.padEnd(12)}  ${String(totals[c]).padStart(8)}`);

  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  const top = Object.entries(files).sort((a, b) => sum(b[1]) - sum(a[1])).slice(0, 15);
  const w = Math.max(4, ...top.map(([f]) => f.length));
  L.push('', `Top files (${top.length} of ${Object.keys(files).length})`);
  L.push(`${'file'.padEnd(w)}  total  ${CATEGORIES.map((c) => c.slice(0, 4).padStart(4)).join(' ')}`);
  for (const [f, c] of top) L.push(`${f.padEnd(w)}  ${String(sum(c)).padStart(5)}  ${CATEGORIES.map((k) => String(c[k] ?? '').padStart(4)).join(' ')}`);

  L.push('', `Examples (up to ${examplesN} per category)`);
  for (const c of CATEGORIES.filter((k) => totals[k])) {
    L.push(`[${c}] ${totals[c]}`);
    for (const f of findings.filter((x) => x.cat === c).slice(0, examplesN)) L.push(`  ${f.file}:${f.line}  ${f.prop}: ${cut(f.value, 80)}`);
  }

  L.push('', 'Legacy aliases in use');
  const aliases = Object.entries(legacy).sort((a, b) => b[1] - a[1]);
  for (const [a, n] of aliases) L.push(`  var(${a})`.padEnd(26) + String(n).padStart(5));
  if (!aliases.length) L.push('  none');
  L.push(`  total ${sum(legacy)}`);

  L.push('', `Breakpoints (allowed: ${ALLOWED_BREAKPOINTS.join(', ')})`);
  for (const b of bps) L.push(`  ${b.value.padEnd(8)} ${String(b.count).padStart(4)}  ${b.allowed ? 'ok' : 'OFF-SCALE'}`);

  L.push('', 'Drift: DESIGN.md frontmatter vs CSS tokens');
  if (driftResult.error) L.push(`  ${driftResult.error}`);
  else {
    for (const [g, r] of Object.entries(driftResult)) {
      const n = Object.values(r).reduce((a, b) => a + b.length, 0);
      L.push(`  ${g}: ${n} keys  ok ${r.ok.length}  mismatch ${r.mismatch.length}  unresolved ${r.unresolved.length}  unchecked ${r.unchecked.length}  missing ${r.missing.length}`);
      for (const m of r.mismatch) L.push(`    mismatch    ${m.key}: DESIGN "${cut(m.design, 40)}" vs CSS "${cut(m.css, 40)}"`);
      if (r.unresolved.length) L.push(`    unresolved  ${r.unresolved.join(', ')}`);
      if (r.unchecked.length) L.push(`    unchecked   ${r.unchecked.join(', ')} (no dark-theme definition found)`);
      if (r.missing.length) L.push(`    missing     ${r.missing.join(', ')}`);
    }
  }
  console.log(L.join('\n'));
}

if (args.includes('--strict') && CATEGORIES.some((c) => c !== 'breakpoint' && totals[c])) process.exitCode = 1;
