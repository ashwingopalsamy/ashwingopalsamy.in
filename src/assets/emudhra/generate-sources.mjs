// Generates the eMudhra figure sources in this directory (figure-specs-v2):
//   <id>.wide.svg, <id>.compact.svg  (inline-ready SVG; tokens as var(--x, light literal))
//   <id>.data.json                   ({ id, title, alt })
//   og-hero.svg                      (raster source for the hero crops)
// Run: node src/assets/emudhra/generate-sources.mjs
// Figures: trust-basic, d4-keyspace, attack-path, two-lanes, go-fix-flow, incident-timeline.
// Every box, line, cell and text baseline sits on the 4px lattice by construction (the only
// exceptions are the arrow chevron and the status glyphs). Type floor is 14px. The SVG files are
// the source of truth after generation; the script exists so the lattice and the 256 grid cells
// stay verifiable.
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTokens, STAGGER_FALLBACK } from "./tokens.mjs";

const OUT = dirname(fileURLToPath(import.meta.url));
const POST = join(OUT, "../../content/library/notes/emudhra-ca-key-compromise-go-developers.md");
const { colors, motion } = loadTokens();
const LIGHT = colors.light;

// ---------------------------------------------------------------- helpers
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n = (v) => {
  const r = Math.round(v * 10) / 10;
  return Object.is(r, -0) ? "0" : String(r);
};
const tidy = (v) => v.replace(/\(\s+/g, "(").replace(/\s+\)/g, ")").replace(/\s+/g, " ");
const DUR = (k) => `var(--dur-${k},${motion["dur-" + k]})`;
const EASE = (k) => `var(--ease-${k},${tidy(motion["ease-" + k])})`;
const STG = `var(--dur-stagger,${STAGGER_FALLBACK})`;
const col = (k) => `var(--${k},${LIGHT[k]})`;

const T = (x, y, s, cls, attrs = "") => `<text x="${n(x)}" y="${n(y)}" class="${cls}"${attrs}>${esc(s)}</text>`;
const TS = (x, y, parts, cls, attrs = "") =>
  `<text x="${n(x)}" y="${n(y)}"${cls ? ` class="${cls}"` : ""}${attrs}>${parts.map(([c, s]) => `<tspan${c ? ` class="${c}"` : ""}>${esc(s)}</tspan>`).join("")}</text>`;
const P = (d, cls, attrs = "") => `<path d="${d}" class="${cls}"${attrs}/>`;
const dia = (cx, cy, cls = "ink") => `<path class="${cls}" d="M${n(cx)} ${n(cy - 2.83)}l2.83 2.83-2.83 2.83-2.83-2.83z"/>`;
const R = (x, y, w, h, cls, attrs = "", rx = 0) =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${rx ? ` rx="${rx}"` : ""} class="${cls}"${attrs}/>`;
const C = (cx, cy, r, cls, attrs = "") => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${r}" class="${cls}"${attrs}/>`;
const G = (attrs, inner) => `<g${attrs ? " " + attrs : ""}>${inner}</g>`;

// text class shorthands: font family, 14px floor, weight, paint
const MG = "m f14 ghost";
const MI = "m f14 ink";
const SG = "s f14 ghost";
const SI = "s f14 ink";
const SW = "s f14 w ink";

// Wide layouts are drawn on 708 units: the rail is 800 minus two 20px gutters, so the figure is
// ~709 CSS px wide on desktop and one unit is one CSS px (text lands at its real size, marks on the
// 4px lattice). Compact layouts are drawn on 352 (a 390px phone shows ~358).
const WW = 708;
const CW = 352;

const FS = `"Inter Variable","Inter Fallback",system-ui,-apple-system,sans-serif`;
const FM = `"JetBrains Mono","JetBrains Mono Fallback",ui-monospace,monospace`;

// ---------------------------------------------------------------- css
function baseCss(id) {
  const S = `:is(#fig-${id},[data-fig-clone="${id}"])`;
  const out = [];
  const d = (sel, body) => out.push(`${sel.split(",").map((x) => `${S} ${x}`).join(",")}{${body}}`);
  d("text", `font-family:${FS};font-weight:400`);
  d(".s", `font-family:${FS}`);
  d(".m", `font-family:${FM}`);
  d(".f14", "font-size:14px");
  d(".w", "font-weight:550");
  d(".mid", "text-anchor:middle");
  d(".end", "text-anchor:end");
  d(".ink", `fill:${col("ink")}`);
  d(".ghost", `fill:${col("ghost")}`);
  d(".cell", `fill:${col("wash")}`);
  d(".key", `fill:${col("acc-violet")}`);
  d(".ok", `fill:${col("acc-green")}`);
  d(".cv", `fill:${col("canvas")}`);
  d(".tr", `fill:${col("edge-strong")}`);
  d(".okbox", `fill:${col("ok-wash")};stroke:${col("acc-green")};stroke-width:1`);
  d(".axis", `stroke:${col("edge-strong")};stroke-width:.5`);
  d(".edge", `stroke:${col("ink")};stroke-opacity:.7;stroke-width:1`);
  d(".sk", `stroke:${col("ink")};stroke-width:1.5`);
  d(".bad", `stroke:${col("acc-red")};stroke-width:1.5`);
  d(".washb", `fill:${col("err-wash")}`);
  d(".hl", `stroke:${col("ink")};stroke-opacity:.45;stroke-width:.5`);
  d(".dash", "stroke-dasharray:2 2");
  d(".dash43", "stroke-dasharray:4 3");
  d(".cur", `fill:none;stroke:${col("ink")};stroke-width:1.5`);
  d("path.axis,path.edge,path.bad,path.hl", "fill:none");
  // layout switch: wide by default, compact below 560px of the .fig__art container
  d('svg[data-layout="compact"]', "display:none");
  out.push(`@container fig (max-width:559px){${S} svg[data-layout="wide"]{display:none}${S} svg[data-layout="compact"]{display:block}}`);
  return { S, out, d };
}

// Motion helpers, scoped to the armed/play attribute pair. Start states ("init") apply only when
// motion is allowed; reduced motion, no JavaScript, the .md mirror and the PNG show the final frame.
function motionCss(id, S, build) {
  const A = `${S}[data-armed]:not([data-play])`;
  const Pl = `${S}[data-armed][data-play]`;
  const out = [];
  const list = (pre, sel) => sel.split(",").map((x) => `${pre} ${x}`).join(",");
  const init = (sel, body, pre = A) => out.push(`@media (prefers-reduced-motion:no-preference){${list(pre, sel)}{${body}}}`);
  const play = (sel, body, pre = Pl) => out.push(`${list(pre, sel)}{${body}}`);
  const kf = (name, body) => out.push(`@keyframes ${id}-${name}{${body}}`);
  const base = (sel, body) => out.push(`${list(S, sel)}{${body}}`);
  build({ init, play, kf, base, A, Pl, K: (name) => `${id}-${name}` });
  // reduced motion: final state, no entrance; colour (tint) transitions stay
  out.push(`@media (prefers-reduced-motion:reduce){${S} *{animation:none!important}}`);
  return out;
}
const anim = (name, dur, ease) => `animation:${name} ${dur} ${ease} both`;
const D = DUR("enter");
const TT = DUR("tint");
const E = EASE("enter");
const LIN = "linear";
const fadeA = (K, dur = D, ease = E) => anim(K("fade"), dur, ease);

function svgOpen(id, layout, w, h, suffix) {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" data-layout="${layout}" viewBox="0 0 ${w} ${h}" role="img" ` +
    `aria-labelledby="${id}-t${suffix} ${id}-d${suffix}" style="aspect-ratio: ${w} / ${h}">`
  );
}
function assemble({ id, layout, w, h, title, alt, css, body, hatch = false }) {
  const suffix = layout === "compact" ? "c" : "";
  // the hatch strokes ink at .45 (hl): a hairline in edge-strong vanishes at mark size
  const pat = hatch
    ? `<defs><pattern id="${id}-hatch${layout === "compact" ? "-c" : ""}" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V4" class="hl"/></pattern></defs>`
    : "";
  // drop the simple `.class{…}` rules whose class this layout never uses
  const hay = pat + body;
  const used = (cls) => new RegExp(`class="([^"]*\\s)?${cls}(\\s[^"]*)?"`).test(hay);
  const kept = css.filter((r) => {
    const m = r.match(/^:is\(#fig-[^)]*\)\s+\.([A-Za-z0-9-]+)\{/);
    return !m || used(m[1]);
  });
  return (
    svgOpen(id, layout, w, h, suffix) +
    `<title id="${id}-t${suffix}">${esc(title)}</title><desc id="${id}-d${suffix}">${esc(alt)}</desc>` +
    `<style>${kept.join("")}</style>${pat}${body}</svg>\n`
  );
}
const hatchRef = (id, layout) => `url(#${id}-hatch${layout === "compact" ? "-c" : ""})`;

const OUTPUT = {};
function emit(id, layout, svg) {
  OUTPUT[`${id}.${layout}.svg`] = svg;
}

// Status glyphs (arbitrary geometry, not lattice) and the arrow chevron (3px arms).
const GLYPH = {
  blocked: (cx, cy, cls = "ok") =>
    `<circle cx="${cx}" cy="${cy}" r="6" class="${cls}"/><path d="M${cx - 3} ${cy}L${cx - 1} ${cy + 2}L${cx + 3} ${cy - 2}" fill="none" stroke="${col("canvas")}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  exposed: (cx, cy) => `<circle cx="${cx}" cy="${cy}" r="5.25" fill="none" class="bad"/>`,
};
const arrow = (x, y, dir) => {
  const d = { d: `M${x - 3} ${y - 4}L${x} ${y}L${x + 3} ${y - 4}`, l: `M${x + 4} ${y - 3}L${x} ${y}L${x + 4} ${y + 3}`, r: `M${x - 4} ${y - 3}L${x} ${y}L${x - 4} ${y + 3}` }[dir];
  return P(d, "edge");
};

// ---------------------------------------------------------------- titles and alts
// Titles come from figure-specs-v2; alts are read from the post so <desc> never drifts from it.
const META = {
  "trust-basic": {
    title: "Your device trusts your bank because the chain ends at a root on its list.",
    alt: "A locked-away root CA signs the everyday stamp, which signs your bank's certificate, and your device trusts it because that root is on its list.",
  },
  "d4-keyspace": {
    title: "Every key eMudhra used fits in this small square.",
    alt: "Every possible key from 0 to 255 fits in a small grid, and trying 1, 2, 3 and 4 finds eMudhra's key 4 on the fourth guess.",
  },
  "two-lanes": {
    title: "One fake certificate, three programs: only the old Go build accepts it.",
    alt: "An updated browser and a Go 1.27.3 or 1.26.10 build reject the same fake certificate, but an old Go build on an old CA list accepts it.",
  },
  "attack-path": {
    title: "A fake certificate only works on an app that skips blocklists.",
    alt: "A fake bank certificate needs an attacker on your network and an app that skips blocklists, so updated browsers reject it and old programs accept it.",
  },
  "go-fix-flow": {
    title: "Rebuild first. The deny-list is only a bridge.",
    alt: "Go teams find each binary's Go version, rebuild with 1.27.3 or 1.26.10, update ca-certificates, redeploy with a canary, and use the deny-list only if stuck.",
  },
  "incident-timeline": {
    title: "Firefox moved in hours. Apple, Go and Microsoft took three days.",
    alt: "Firefox blocked the keys within three hours of the report, eMudhra revoked them after 13 hours, and Apple, Go and Microsoft followed within three days.",
  },
};
if (existsSync(POST)) {
  const src = readFileSync(POST, "utf8");
  for (const m of src.matchAll(/!\[([^\]]*)\]\(\/blog\/emudhra\/([a-z0-9-]+)\.svg\)/g)) if (META[m[2]]) META[m[2]].alt = m[1];
}

// ================================================================ 1. trust-basic
function trustBasicCss(id) {
  const { S, out } = baseCss(id);
  const Sp = DUR("spring-soft");
  out.push(
    ...motionCss(id, S, ({ init, play, kf, base, K }) => {
      base(".sp", "transform-box:fill-box;transform-origin:center");
      init(".b1,.b5", "opacity:0;transform:translateY(4px)");
      init(".a1,.a2,.cn", "opacity:0");
      init(".sp", "opacity:0;transform:scale(.96)");
      init(".b6", "opacity:0;transform:translateX(8px)");
      play(".b1", anim(K("rise"), D, E));
      play(".a1", `${anim(K("fade"), TT, LIN)};animation-delay:${D}`);
      play(".sp", `${anim(K("grow"), Sp, EASE("spring-soft"))};animation-delay:calc(${D} + ${TT})`);
      play(".a2", `${anim(K("fade"), TT, LIN)};animation-delay:calc(${D} + ${TT} + ${Sp})`);
      play(".b5", `${anim(K("rise"), D, E)};animation-delay:calc(${D} + 2*${TT} + ${Sp})`);
      play(".b6", `${anim(K("slide"), D, E)};animation-delay:calc(2*${D} + 2*${TT} + ${Sp})`);
      play(".cn", `${anim(K("fade"), TT, LIN)};animation-delay:calc(3*${D} + 2*${TT} + ${Sp})`);
      kf("rise", "from{opacity:0;transform:translateY(4px)}");
      kf("fade", "from{opacity:0}");
      kf("grow", "from{opacity:0;transform:scale(.96)}");
      kf("slide", "from{opacity:0;transform:translateX(8px)}");
    }),
  );
  return out;
}

function trustBasicWide() {
  const id = "trust-basic";
  const css = trustBasicCss(id);
  let body = "";
  body += G(
    'class="b1" data-beat="1"',
    R(16, 24, 432, 80, "cv edge node", ' data-mark="root"', 8) +
      T(40, 56, "Root CA", SW) +
      T(40, 84, "Kept offline, locked away", SG) +
      R(404, 56, 24, 20, "edge", ' fill="none"', 4) +
      P("M408 56V52a8 8 0 0 1 16 0V56", "edge"),
  );
  body += G('class="a1" data-beat="2"', P("M232 104V136", "edge") + arrow(232, 136, "d"));
  body += G(
    'class="sp" data-beat="3"',
    R(16, 136, 432, 80, "cv sk node", ' data-mark="stamp"', 8) + T(40, 168, "Intermediate CA", SW) + T(40, 196, "The stamp, used every day", SG),
  );
  body += G('class="a2" data-beat="4"', P("M232 216V248", "edge") + arrow(232, 248, "d"));
  body += G(
    'class="b5" data-beat="5"',
    R(16, 248, 432, 80, "cv edge node", ' data-mark="bank"', 8) + T(40, 280, "Your bank's certificate", SW) + T(40, 308, "What your app checks", SG),
  );
  body += G(
    'class="b6" data-beat="6"',
    R(496, 24, 196, 88, "cell edge node", ' data-mark="list"', 8) +
      T(516, 52, "Your phone or server", SI) +
      T(516, 72, "keeps a list of roots", SI) +
      T(516, 92, "it trusts", SI),
  );
  body += G('class="cn" data-beat="7"', P("M496 64H448", "edge dash") + arrow(448, 64, "l"));
  emit(id, "wide", assemble({ id, layout: "wide", w: WW, h: 344, ...META[id], css, body }));
}

function trustBasicCompact() {
  const id = "trust-basic";
  const css = trustBasicCss(id);
  let body = "";
  body += G(
    'class="b1" data-beat="1"',
    R(16, 16, 320, 80, "cv edge node", ' data-mark="root"', 8) +
      T(40, 48, "Root CA", SW) +
      T(40, 76, "Kept offline, locked away", SG) +
      R(292, 40, 24, 20, "edge", ' fill="none"', 4) +
      P("M296 40V36a8 8 0 0 1 16 0V40", "edge"),
  );
  body += G('class="a1" data-beat="2"', P("M176 96V128", "edge") + arrow(176, 128, "d"));
  body += G(
    'class="sp" data-beat="3"',
    R(16, 128, 320, 80, "cv sk node", ' data-mark="stamp"', 8) + T(40, 160, "Intermediate CA", SW) + T(40, 188, "The stamp, used every day", SG),
  );
  body += G('class="a2" data-beat="4"', P("M176 208V240", "edge") + arrow(176, 240, "d"));
  body += G(
    'class="b5" data-beat="5"',
    R(16, 240, 320, 80, "cv edge node", ' data-mark="bank"', 8) + T(40, 272, "Your bank's certificate", SW) + T(40, 300, "What your app checks", SG),
  );
  body += G(
    'class="b6" data-beat="6"',
    R(16, 368, 320, 72, "cell edge node", ' data-mark="list"', 8) + T(40, 396, "Your phone or server keeps a list", SI) + T(40, 416, "of roots it trusts", SI),
  );
  body += G('class="cn" data-beat="7"', P("M336 404H344V56H336", "edge dash") + arrow(336, 56, "l"));
  emit(id, "compact", assemble({ id, layout: "compact", w: CW, h: 456, ...META[id], css, body }));
}

// ================================================================ 2. d4-keyspace
// The grid is the contract with keyspace.ts: 256 cells, each with data-d, the d=4 cell marked
// ov-tls-g3c, and data-state tried/match written by the script.
const KEYS = [
  [4, "ov-tls-g3c"],
  [56, "ev-tls-g3c"],
  [66, "ov-cs-g3b"],
  [115, "ev-tls-g3b"],
  [155, "ov-tls-g3b"],
  [156, "dv-tls-g3b"],
  [230, "dv-tls-g3c"],
  [237, "ov-cs-g3c"],
];
const KEY_BY_D = Object.fromEntries(KEYS.map(([d, mark], i) => [d, { mark, i }]));

function keyspaceCss(id) {
  const { S, out, d } = baseCss(id);
  d("rect[data-d]", `transition:fill ${TT} ${LIN},stroke ${TT} ${LIN}`);
  // the final frame: cells 1 to 3 tried, cell 4 matched (the search's own states below take over when it runs)
  const live = `${S}:not([data-live])`;
  out.push(`${live} rect[data-d="1"],${live} rect[data-d="2"],${live} rect[data-d="3"]{fill:${col("edge-strong")}}`);
  out.push(`${live} rect[data-d="4"]{stroke:${col("ink")};stroke-width:1}`);
  out.push(
    ...motionCss(id, S, ({ init, play, kf, base, K }) => {
      const Sp = DUR("spring-pop");
      const t3 = `calc(24*${STG} + ${D} + ${Sp})`;
      const t4 = `calc(${t3} + 3*${D})`;
      const b2 = `calc(16*${STG} + ${D} + var(--i,0)*${STG})`;
      const Pl = `${S}[data-armed][data-play]:not([data-live])`;
      const A = `${S}[data-armed]:not([data-play]):not([data-live])`;
      base(".pop,.cur", "transform-box:fill-box;transform-origin:center");
      base(".walk", "transform:translateX(60px)");
      init(".r", "opacity:0;transform:translateY(4px)");
      init(".lab,.lg,.cl,.sc,.cur", "opacity:0");
      init(".pop", "opacity:0;transform:scale(.5)");
      init('rect[data-d="1"],rect[data-d="2"],rect[data-d="3"]', `fill:${col("wash")}`, A);
      init('rect[data-d="4"]', "stroke:transparent", A);
      play(".r", `${anim(K("row"), D, E)};animation-delay:calc(var(--i)*${STG})`);
      play(".lab", fadeA(K));
      play(".lg", `${fadeA(K)};animation-delay:calc(16*${STG} + ${D})`);
      play(".pop", `${anim(K("pop"), Sp, EASE("spring-pop"))};animation-delay:${b2}`);
      // the walk: one guess per entrance time, the cursor steps 1, 2, 3, then rests on 4
      play(".walk", `animation:${K("walk")} calc(3*${D}) steps(3,jump-end) both;animation-delay:${t3}`, Pl);
      play(".cur", `animation:${K("fade")} ${TT} ${LIN} both,${K("pulse")} ${DUR("spring-snap")} ${EASE("spring-snap")} both;animation-delay:${t3},${t4}`, Pl);
      for (const k of [1, 2, 3]) {
        play(`rect[data-d="${k}"]`, `animation:${K("tried")} ${TT} ${LIN} both;animation-delay:calc(${t3} + ${k}*${D})`, Pl);
      }
      // cell 4 also pops with the other keys; its edge tints at t4
      play('rect[data-d="4"]', `animation:${K("pop")} ${Sp} ${EASE("spring-pop")} both,${K("match")} ${TT} ${LIN} both;animation-delay:${b2},${t4}`, Pl);
      play(".cl", `${fadeA(K)};animation-delay:calc(${t4} + ${DUR("spring-snap")})`, Pl);
      play(".sc", `${fadeA(K)};animation-delay:calc(${t4} + ${DUR("spring-snap")} + ${D})`, Pl);
      kf("row", "from{opacity:0;transform:translateY(4px)}");
      kf("fade", "from{opacity:0}");
      kf("pop", "from{opacity:0;transform:scale(.5)}");
      kf("walk", "from{transform:translateX(0)}to{transform:translateX(60px)}");
      kf("pulse", "from{transform:scale(1.25)}");
      kf("tried", `from{fill:${col("wash")}}`);
      kf("match", "from{stroke:transparent}");
    }),
  );
  // instrument states, written by keyspace.ts (colour only); last so they win over .key
  d('rect[data-state="tried"]', `fill:${col("edge-strong")}`);
  d('rect[data-state="match"]', `stroke:${col("ink")};stroke-width:1`);
  return out;
}

function gridRows(id, layout, x0, y0) {
  let rows = "";
  for (let r = 0; r < 16; r += 1) {
    let cells = "";
    for (let c = 0; c < 16; c += 1) {
      const dv = 16 * r + c;
      const x = x0 + 20 * c;
      const y = y0 + 20 * r;
      const geo = `x="${x}" y="${y}" width="16" height="16" rx="2"`;
      if (dv === 0) cells += `<rect ${geo} class="axis" fill="${hatchRef(id, layout)}" data-d="0" data-mark="zero"/>`;
      else if (KEY_BY_D[dv]) cells += `<rect ${geo} class="key pop" style="--i: ${KEY_BY_D[dv].i}" data-d="${dv}" data-mark="${KEY_BY_D[dv].mark}"/>`;
      else cells += `<rect ${geo} data-d="${dv}"/>`;
    }
    rows += `<g class="cell r" data-beat="1" style="--i: ${r}">${cells}</g>`;
  }
  return rows;
}

function keyspaceBody(layout) {
  const id = "d4-keyspace";
  const wide = layout === "wide";
  const hf = hatchRef(id, layout);
  let body = G('class="lab" data-beat="1"', T(24, 72, "0", `${MG} mid`) + T(324, 420, "255", `${MG} mid`));
  body += gridRows(id, layout, 16, 80);
  body += G('class="walk" data-mark="cursor"', R(32, 76, 24, 24, "cur", "", 4));
  const lx = wide ? 372 : 16;
  const ly = wide ? 84 : 444;
  const tx = lx + 24;
  const rows = [
    [`<rect x="${lx}" y="${ly}" width="16" height="16" rx="2" class="key"/>`, "eMudhra's eight keys", SI],
    [`<rect x="${lx}" y="${ly + 32}" width="16" height="16" rx="2" class="tr"/>`, "Tried and wrong", SI],
    [`<rect x="${lx}" y="${ly + 64}" width="16" height="16" rx="2" class="axis" fill="${hf}"/>`, "0 is not a valid key", SG],
  ];
  body += G('class="lg" data-beat="2"', rows.map(([sw, label, cls], i) => sw + T(tx, ly + 12 + 32 * i, label, cls)).join(""));
  const found = [["s f14 ink", "Found on guess "], ["m f14 w key", "4"]];
  body += G(
    'class="cl" data-mark="found" data-beat="5"',
    P(wide ? "M104 76V44H116" : "M104 76V40H116", "edge") + TS(120, wide ? 48 : 44, found, ""),
  );
  if (wide) {
    body += G(
      'class="sc" data-mark="scale" data-beat="6"',
      TS(16, 468, [["s f14 ink", "A random key: a "], ["m f14 ink", "116"], ["s f14 ink", "-digit number. eMudhra's: "], ["m f14 w key", "4"], ["s f14 ink", "."]], ""),
    );
  } else {
    body += G(
      'class="sc" data-mark="scale" data-beat="6"',
      TS(16, 564, [["s f14 ink", "A random key: a "], ["m f14 ink", "116"], ["s f14 ink", "-digit number."]], "") +
        TS(16, 588, [["s f14 ink", "eMudhra's: "], ["m f14 w key", "4"], ["s f14 ink", "."]], ""),
    );
  }
  return body;
}

function keyspaceWide() {
  const id = "d4-keyspace";
  emit(id, "wide", assemble({ id, layout: "wide", w: WW, h: 496, ...META[id], css: keyspaceCss(id), body: keyspaceBody("wide"), hatch: true }));
}
function keyspaceCompact() {
  const id = "d4-keyspace";
  emit(id, "compact", assemble({ id, layout: "compact", w: CW, h: 612, ...META[id], css: keyspaceCss(id), body: keyspaceBody("compact"), hatch: true }));
}

// ================================================================ 3. attack-path
function attackCss(id) {
  const { S, out } = baseCss(id);
  out.push(
    ...motionCss(id, S, ({ init, play, kf, base, K }) => {
      const Sp = DUR("spring-pop");
      base(".acg,.acr", "transform-box:fill-box;transform-origin:center");
      init(".st,.rjg", "opacity:0;transform:translateY(4px)");
      init(".fk", "opacity:0");
      init(".acg", "opacity:0;transform:scale(.96)");
      init(".rjr,.acr", `fill:${col("canvas")};stroke:${col("edge")}`);
      play(".st", `${anim(K("rise"), D, E)};animation-delay:calc(var(--k)*${D})`);
      play(".fk", `${anim(K("fade"), TT, LIN)};animation-delay:calc(4*${D})`);
      play(".rjg", `${anim(K("rise"), D, E)};animation-delay:calc(4*${D} + ${TT})`);
      play(".rjr", `${anim(K("ok"), TT, LIN)};animation-delay:calc(5*${D} + ${TT})`);
      play(".acg", `${anim(K("grow"), Sp, EASE("spring-pop"))};animation-delay:calc(5*${D} + ${TT})`);
      play(".acr", `${anim(K("bad"), TT, LIN)};animation-delay:calc(5*${D} + ${TT})`);
      kf("rise", "from{opacity:0;transform:translateY(4px)}");
      kf("fade", "from{opacity:0}");
      kf("grow", "from{opacity:0;transform:scale(.96)}");
      kf("ok", `from{fill:${col("canvas")};stroke:${col("edge")}}`);
      kf("bad", `from{fill:${col("canvas")};stroke:${col("edge")}}`);
    }),
  );
  return out;
}

function attackWide() {
  const id = "attack-path";
  const css = attackCss(id);
  // a step is one <text>: the number in mono at x 40, the sentence in Inter at x 72
  const step = (k, top, parts) =>
    G(
      `class="st" data-beat="${k + 1}" style="--k: ${k}"`,
      (k ? P(`M352 ${top - 24}V${top}`, "edge") + arrow(352, top, "d") : "") +
        R(16, top, 676, 56, "cv edge node", ` data-mark="step-${k + 1}"`, 8) +
        `<text y="${top + 32}"><tspan x="40" class="m f14 ghost">${k + 1}</tspan>` +
        parts.map(([c, s], i) => `<tspan${i === 0 ? ' x="72"' : ""} class="${c}">${esc(s)}</tspan>`).join("") +
        `</text>`,
    );
  let body = "";
  body += step(0, 16, [["s f14 ink", "The attacker sits between you and the server."]]);
  body += step(1, 96, [["s f14 ink", "The attacker knows a stamp's secret key. Anyone can: it is "], ["m f14 w key", "1 to 255"], ["s f14 ink", "."]]);
  body += step(2, 176, [["s f14 ink", "The attacker makes a fake certificate for your bank."]]);
  body += step(3, 256, [["s f14 ink", "Your app accepts it, unless it checks blocklists."]]);
  body += G('class="fk" data-beat="5"', P("M352 312V328H180V352M352 328H528V352", "edge") + arrow(180, 352, "d") + arrow(528, 352, "d"));
  body += G(
    'class="rjg" data-beat="6" data-mark="rejects"',
    R(16, 352, 328, 56, "okbox rjr node", "", 8) +
      GLYPH.blocked(44, 380) +
      TS(64, 384, [["s f14 ink", "Updated browser: "], ["s f14 w ink", "rejects it"]], ""),
  );
  body += G(
    'class="acg" data-beat="7" data-mark="accepts"',
    R(364, 352, 328, 56, "washb bad acr node", "", 8) +
      GLYPH.exposed(392, 380) +
      TS(412, 384, [["s f14 ink", "Old program: "], ["s f14 w ink", "accepts it"]], ""),
  );
  emit(id, "wide", assemble({ id, layout: "wide", w: WW, h: 424, ...META[id], css, body }));
}

function attackCompact() {
  const id = "attack-path";
  const css = attackCss(id);
  const step = (k, top, h, lines) =>
    G(
      `class="st" data-beat="${k + 1}" style="--k: ${k}"`,
      (k ? P(`M176 ${top - 24}V${top}`, "edge") + arrow(176, top, "d") : "") +
        R(16, top, 320, h, "cv edge node", ` data-mark="step-${k + 1}"`, 8) +
        `<text x="32" y="${top + 32}" class="m f14 ghost">${k + 1}</text>` +
        lines.map((parts, i) => TS(56, top + 32 + 20 * i, parts, "")).join(""),
    );
  let body = "";
  body += step(0, 16, 76, [[["s f14 ink", "The attacker sits between you"]], [["s f14 ink", "and the server."]]]);
  body += step(1, 116, 96, [
    [["s f14 ink", "The attacker knows a stamp's"]],
    [["s f14 ink", "secret key. Anyone can,"]],
    [["s f14 ink", "because it is "], ["m f14 w key", "1 to 255"], ["s f14 ink", "."]],
  ]);
  body += step(2, 236, 76, [[["s f14 ink", "The attacker makes a fake"]], [["s f14 ink", "certificate for your bank."]]]);
  body += step(3, 336, 76, [[["s f14 ink", "Your app accepts it, unless"]], [["s f14 ink", "it checks blocklists."]]]);
  body += G('class="fk" data-beat="5"', P("M176 412V428H92V448M176 428H260V448", "edge") + arrow(92, 448, "d") + arrow(260, 448, "d"));
  body += G(
    'class="rjg" data-beat="6" data-mark="rejects"',
    R(16, 448, 152, 88, "okbox rjr node", "", 8) + GLYPH.blocked(92, 472) + T(92, 500, "Updated browser", `${SI} mid`) + T(92, 520, "rejects it", `${SW} mid`),
  );
  body += G(
    'class="acg" data-beat="7" data-mark="accepts"',
    R(184, 448, 152, 88, "washb bad acr node", "", 8) + GLYPH.exposed(260, 472) + T(260, 500, "Old program", `${SI} mid`) + T(260, 520, "accepts it", `${SW} mid`),
  );
  emit(id, "compact", assemble({ id, layout: "compact", w: CW, h: 552, ...META[id], css, body }));
}

// ================================================================ 4. two-lanes
function lanesCss(id) {
  const { S, out } = baseCss(id);
  out.push(
    ...motionCss(id, S, ({ init, play, kf, base, K }) => {
      const Sp = DUR("spring-pop");
      const Ls = `calc(${D} + var(--k)*(2*${TT} + ${D}))`;
      base(".rr1", "transform-box:fill-box;transform-origin:center");
      init(".hd", "opacity:0");
      init(".lp,.lc,.lr", "opacity:0;transform:translateX(-8px)");
      init(".rr,.rr1", `fill:${col("canvas")};stroke:${col("edge")}`);
      play(".hd", fadeA(K));
      play(".lp", `${anim(K("slide"), D, E)};animation-delay:${Ls}`);
      play(".lc", `${anim(K("slide"), D, E)};animation-delay:calc(${Ls} + ${TT})`);
      play(".lr", `${anim(K("slide"), D, E)};animation-delay:calc(${Ls} + 2*${TT})`);
      play(".rr", `${anim(K("tint"), TT, LIN)};animation-delay:calc(${Ls} + 2*${TT} + ${D})`);
      // the one spring: the old Go program's "Accepted" box
      play(".rr1", `animation:${K("tint")} ${TT} ${LIN} both,${K("pop")} ${Sp} ${EASE("spring-pop")} both;animation-delay:calc(${Ls} + 2*${TT} + ${D}),calc(${Ls} + 2*${TT} + ${D})`);
      kf("fade", "from{opacity:0}");
      kf("slide", "from{opacity:0;transform:translateX(-8px)}");
      kf("tint", `from{fill:${col("canvas")};stroke:${col("edge")}}`);
      kf("pop", "from{transform:scale(.96)}");
    }),
  );
  return out;
}

const progLines = [
  [[["s f14 w ink", "Updated browser"]]],
  [[["s f14 w ink", "Old Go program"]], [["s f14 w ink", "on an old CA list"]]],
  [[["s f14 w ink", "Go "], ["m f14 w ink", "1.27.3"], ["s f14 w ink", " or "], ["m f14 w ink", "1.26.10"]]],
];
const checkText = [
  ["Checks its blocklist", SI],
  ["No check", SG],
  ["Block built in", SI],
];
const resultWord = ["Rejected", "Accepted", "Rejected"];

function lanesWide() {
  const id = "two-lanes";
  const css = lanesCss(id);
  let body = G('class="hd" data-beat="1"', T(16, 28, "One fake bank certificate, three programs", SG));
  for (let k = 0; k < 3; k += 1) {
    const y = 48 + 84 * k;
    const yc = y + 32;
    const lines = progLines[k];
    const progText = lines.length === 1 ? TS(32, y + 36, lines[0], "") : lines.map((l, i) => TS(32, y + 28 + 20 * i, l, "")).join("");
    const bad = k === 1;
    const rcls = bad ? "washb bad rr1 node" : "okbox rr node";
    body += G(`class="lp" data-beat="2" style="--k: ${k}"`, R(16, y, 232, 64, "cv edge node", "", 8) + progText);
    body += G(
      `class="lc" data-beat="3" style="--k: ${k}"`,
      P(`M248 ${yc}H284`, "edge") + arrow(284, yc, "r") + R(284, y, 208, 64, `cv edge${bad ? " dash43" : ""} node`, "", 8) + T(300, y + 36, checkText[k][0], checkText[k][1]),
    );
    body += G(
      `class="lr" data-beat="4" data-mark="result-${k}" style="--k: ${k}"`,
      P(`M492 ${yc}H528`, "edge") + arrow(528, yc, "r") + R(528, y, 164, 64, rcls, "", 8) + (bad ? GLYPH.exposed(552, yc) : GLYPH.blocked(552, yc)) + T(568, y + 36, resultWord[k], SW),
    );
  }
  emit(id, "wide", assemble({ id, layout: "wide", w: WW, h: 296, ...META[id], css, body }));
}

function lanesCompact() {
  const id = "two-lanes";
  const css = lanesCss(id);
  let body = G('class="hd" data-beat="1"', T(16, 24, "One fake bank certificate, three programs", SG));
  for (let k = 0; k < 3; k += 1) {
    const top = 40 + 108 * k;
    const bad = k === 1;
    const lines = progLines[k];
    const text =
      lines.length === 1
        ? TS(32, top + 36, lines[0], "") + T(32, top + 60, checkText[k][0], SG)
        : TS(32, top + 28, lines[0], "") + TS(32, top + 48, lines[1], "") + T(32, top + 72, checkText[k][0], SG);
    body += G(
      `class="lp" data-beat="2" data-mark="result-${k}" style="--k: ${k}"`,
      R(16, top, 320, 96, "cv edge node", "", 8) +
        text +
        R(212, top + 28, 108, 40, bad ? "washb bad rr1 node" : "okbox rr node", "", 8) +
        (bad ? GLYPH.exposed(232, top + 48) : GLYPH.blocked(232, top + 48)) +
        T(248, top + 52, resultWord[k], SW),
    );
  }
  emit(id, "compact", assemble({ id, layout: "compact", w: CW, h: 368, ...META[id], css, body }));
}

// ================================================================ 5. go-fix-flow (PNG only on the site's shares)
function goCss(id) {
  const { S, out } = baseCss(id);
  out.push(
    ...motionCss(id, S, ({ init, play, kf, base, K }) => {
      const Sp = DUR("spring-pop");
      const at = `calc(var(--k)*8*${STG})`;
      base(".mp", "transform-box:fill-box;transform-origin:center");
      init(".rw", "opacity:0;transform:translateY(4px)");
      init(".mt", `fill:${col("wash")}`);
      init(".mp", "opacity:0;transform:scale(.5)");
      play(".rw", `${anim(K("rise"), D, E)};animation-delay:${at}`);
      play(".mt", `${anim(K("tint"), TT, LIN)};animation-delay:calc(${at} + ${D})`);
      play(".mp", `${anim(K("pop"), Sp, EASE("spring-pop"))};animation-delay:calc(${at} + ${D})`);
      kf("rise", "from{opacity:0;transform:translateY(4px)}");
      kf("tint", `from{fill:${col("wash")}}`);
      kf("pop", "from{opacity:0;transform:scale(.5)}");
    }),
  );
  return out;
}

function goMarker(k, cx, cy) {
  // markers 0, 2, 3 tint to green; marker 1 (the rebuild) is the one that pops; marker 4 stays a dashed ring
  if (k === 4) return C(cx, cy, 6, "edge dash", ' fill="none"');
  const glyph = GLYPH.blocked(cx, cy, k === 1 ? "ok" : "ok mt");
  return k === 1 ? `<g class="mp">${glyph}</g>` : glyph;
}

function goBody(layout) {
  const wide = layout === "wide";
  const rows = [
    ["find", [[["s f14 ink", "Find which Go built each binary"]]]],
    ["rebuild", [[["s f14 ink", "Rebuild with Go "], ["m f14 ink", "1.27.3"], ["s f14 ink", " or "], ["m f14 ink", "1.26.10"]]]],
    ["ca", [[["s f14 ink", "Update "], ["m f14 ink", "ca-certificates"], ["s f14 ink", " in your images"]]]],
    ["redeploy", [[["s f14 ink", "Redeploy, starting with a canary"]]]],
    ["bridge", [[["s f14 ghost", "Only if you cannot rebuild: add the deny-list"]]]],
  ];
  const compactLines = [
    [[["s f14 ink", "Find which Go built each binary"]]],
    [[["s f14 ink", "Rebuild with Go"]], [["m f14 ink", "1.27.3"], ["s f14 ink", " or "], ["m f14 ink", "1.26.10"]]],
    [[["s f14 ink", "Update "], ["m f14 ink", "ca-certificates"]], [["s f14 ink", "in your images"]]],
    [[["s f14 ink", "Redeploy, starting with a canary"]]],
    [[["s f14 ghost", "Only if you cannot rebuild:"]], [["s f14 ghost", "add the deny-list"]]],
  ];
  let body = "";
  rows.forEach(([mark, wideLines], k) => {
    const y = wide ? 16 + 64 * k : 16 + 68 * k;
    const h = wide ? 48 : 56;
    const mx = wide ? 124 : 40;
    const my = y + h / 2;
    const dashed = k === 4;
    const joint = k ? (wide ? P(`M${mx} ${y - 16}V${y}`, `edge${dashed ? " dash" : ""}`) : P(`M${mx} ${y - 12}V${y}`, `edge${dashed ? " dash" : ""}`)) : "";
    let text = "";
    if (wide) text = TS(148, y + 28, wideLines[0], "");
    else {
      const lines = compactLines[k];
      text = lines.length === 1 ? TS(64, y + 32, lines[0], "") : lines.map((l, i) => TS(64, y + 24 + 20 * i, l, "")).join("");
    }
    body += G(
      `class="rw" data-beat="${k + 1}" style="--k: ${k}"`,
      joint + R(wide ? 96 : 16, y, wide ? 516 : 320, h, `cv edge${dashed ? " dash43" : ""} node`, ` data-mark="${mark}"`, 8) + goMarker(k, mx, my) + text,
    );
  });
  return body;
}

function goWide() {
  const id = "go-fix-flow";
  emit(id, "wide", assemble({ id, layout: "wide", w: WW, h: 336, ...META[id], css: goCss(id), body: goBody("wide") }));
}
function goCompact() {
  const id = "go-fix-flow";
  emit(id, "compact", assemble({ id, layout: "compact", w: CW, h: 360, ...META[id], css: goCss(id), body: goBody("compact") }));
}

// ================================================================ 6. incident-timeline
function timelineCss(id) {
  const { S, out } = baseCss(id);
  out.push(
    ...motionCss(id, S, ({ init, play, kf, base, K }) => {
      const Sp = DUR("spring-pop");
      const e1 = D;
      const e2 = `calc(2*${D})`;
      const e3 = `calc(2*${D} + ${Sp})`;
      base(".e1", `--d:${e1}`);
      base(".e2", `--d:${e2}`);
      base(".e3", `--d:${e3}`);
      base(".pt", "transform-box:fill-box;transform-origin:center");
      base(".bd", "transform-box:fill-box;transform-origin:0 50%");
      init(".ax,.ev,.bl,.nv", "opacity:0");
      init(".pt", "opacity:0;transform:scale(.5)");
      init(".bd", "transform:scaleX(0)");
      play(".ax", fadeA(K));
      play(".ev", `${fadeA(K)};animation-delay:var(--d)`);
      play(".pt", `${anim(K("pop"), D, E)};animation-delay:var(--d)`);
      // the one spring: the Firefox point
      play(".pt.sp", `${anim(K("pop"), Sp, EASE("spring-pop"))};animation-delay:var(--d)`);
      play(".bd", `${anim(K("grow"), D, E)};animation-delay:calc(3*${D} + ${Sp} + var(--k)*${D})`);
      play(".bl", `${fadeA(K)};animation-delay:calc(3*${D} + ${Sp} + var(--k)*${D})`);
      play(".nv", `${fadeA(K)};animation-delay:calc(6*${D} + ${Sp})`);
      kf("fade", "from{opacity:0}");
      kf("pop", "from{opacity:0;transform:scale(.5)}");
      kf("grow", "from{transform:scaleX(0)}");
    }),
  );
  return out;
}

function timelineBody(layout) {
  const id = "incident-timeline";
  const wide = layout === "wide";
  const hf = hatchRef(id, layout);
  const px = wide ? 6 : 3; // px per hour
  const x0 = wide ? 80 : 32;
  const ay = wide ? 168 : 180; // axis y
  const X = (h) => x0 + px * h;
  let body = "";
  // axis and ticks every day
  const ticks = [0, 1, 2, 3, 4].map((k) => x0 + 24 * px * k);
  const tl = ["0", "1 day", "2 days", "3 days", "4 days"];
  body += G(
    'class="ax" data-beat="1"',
    P(`M${x0} ${ay}H${X(96)}`, "axis") + P(ticks.map((x) => `M${x} ${ay}v4`).join(""), "axis") + ticks.map((x, k) => T(x, ay + 20, tl[k], `${SG} mid`)).join(""),
  );
  // events above the axis: the point (snapped to 4px), a leader and a label
  const ev = (cls, mark, cx, ly, tx, label, time, pt) =>
    G(
      `class="ev ${cls}" data-mark="${mark}" data-beat="2"`,
      P(`M${cx} ${ay - 8}V${ly}H${cx + 8}`, "axis") +
        TS(tx, ly + 4, [["s f14 ink", label], ["m f14 ghost", ` ${time}`]], "") +
        `<g class="pt ${pt}">${C(cx, ay, 6, mark === "report" ? "ink" : "ok")}</g>`,
    );
  if (wide) {
    body += ev("e1", "report", 80, 36, 92, "Report", "T+0", "");
    body += ev("e2", "firefox", 96, 76, 108, "Firefox blocks", "T+2h53m", "sp");
    body += ev("e3", "emudhra-revokes", 160, 116, 172, "eMudhra revokes", "T+13h18m", "");
  } else {
    body += ev("e1", "report", 32, 36, 44, "Report", "T+0", "");
    body += ev("e2", "firefox", 40, 84, 52, "Firefox blocks", "T+2h53m", "sp");
    body += ev("e3", "emudhra-revokes", 72, 132, 84, "eMudhra revokes", "T+13h18m", "");
  }
  // day bands (calendar midnights fall at T+3h54m, T+27h54m, T+51h54m, T+75h54m)
  const band = (k, mark, label, xa, xb, y, lx, ly) =>
    R(xa, y, xb - xa, 12, "okbox bd", ` data-mark="${mark}" style="--k: ${k}"`, 2) +
    G(`class="bl" style="--k: ${k}"`, wide ? T(lx, ly, label, `${SI} end`) : T(lx, ly, label, SI));
  if (wide) {
    body += band(0, "apple", "Apple: 19 Oct", 248, 392, 208, 240, 220);
    body += band(1, "go-release", "Go fix: 19 to 20 Oct", 248, 536, 236, 240, 248);
    body += band(2, "microsoft", "Microsoft and public news: 20 Oct", 392, 536, 264, 384, 276);
    body += G(
      'class="nv" data-mark="never" data-beat="6"',
      T(80, 296, "Devices that never update", SI) + R(80, 304, 576, 8, "axis", ` fill="${hf}"`) + P("M656 308H668", "edge") + arrow(668, 308, "r"),
    );
  } else {
    body += band(0, "apple", "Apple: 19 Oct", 116, 188, 244, 16, 236);
    body += band(1, "go-release", "Go fix: 19 to 20 Oct", 116, 260, 292, 16, 284);
    body += band(2, "microsoft", "Microsoft and public news: 20 Oct", 188, 260, 340, 16, 332);
    body += G(
      'class="nv" data-mark="never" data-beat="6"',
      T(16, 380, "Devices that never update", SI) + R(32, 388, 288, 8, "axis", ` fill="${hf}"`) + P("M320 392H332", "edge") + arrow(332, 392, "r"),
    );
  }
  return body;
}

function timeline(layout) {
  const id = "incident-timeline";
  const wide = layout === "wide";
  emit(id, layout, assemble({ id, layout, w: wide ? WW : CW, h: wide ? 336 : 416, ...META[id], css: timelineCss(id), body: timelineBody(layout), hatch: true }));
}

// ================================================================ 7. og-hero (raster source)
function hero() {
  const size = 420;
  const xEnd = 984 + 0.1 * size; // JetBrains Mono "4": advance 0.6em, ink ends 0.1em before the advance
  const rows = [0, 1, 2]
    .map((i) => `<text x="296" y="${400 + 28 * i}" class="z">${"0".repeat(29)}</text>`)
    .join("");
  const last = `<text x="296" y="484" class="z">${"0".repeat(28)}<tspan class="v">4</tspan></text>`;
  const alt = "The title Lets talk about eMudhra Certificate Vulnerability, beside a large violet 4 and four rows of zeros that end in 4.";
  const css =
    `.mono{font-family:${FM}}.sans{font-family:${FS}}` +
    `.ghost{fill:${col("ghost")}}.ink{fill:${col("ink")}}.z{fill:${col("faint")};font-family:${FM};font-size:20px}.v{fill:${col("acc-violet")}}`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" role="img" aria-labelledby="og-hero-t og-hero-d">` +
    `<title id="og-hero-t">${esc(alt)}</title><desc id="og-hero-d">${esc(alt)}</desc><style>${css}</style>` +
    `<rect width="1280" height="720" fill="${col("canvas")}"/>` +
    `<text x="296" y="120" class="mono ghost" font-size="18">CVE-2026-111943</text>` +
    ["Lets talk about", "eMudhra Certificate", "Vulnerability"]
      .map((l, i) => `<text x="296" y="${200 + 60 * i}" class="sans ink" font-size="48" font-weight="600" letter-spacing="-0.96">${esc(l)}</text>`)
      .join("") +
    rows +
    last +
    `<text x="${xEnd}" y="520" class="mono v" font-size="${size}" text-anchor="end">4</text>` +
    `<text x="744" y="576" class="mono ink" font-size="24">d = 4</text>` +
    `<text x="744" y="604" class="mono ghost" font-size="18">3 bits · 4 guesses</text>` +
    `<text x="296" y="648" class="mono ghost" font-size="16">ashwingopalsamy.in · as of 21 Oct 2026</text>` +
    `</svg>\n`;
  writeFileSync(join(OUT, "og-hero.svg"), svg);
}


// ================================================================ run
trustBasicWide();
trustBasicCompact();
keyspaceWide();
keyspaceCompact();
attackWide();
attackCompact();
lanesWide();
lanesCompact();
goWide();
goCompact();
timeline("wide");
timeline("compact");

mkdirSync(OUT, { recursive: true });
// retired figures: perspective, blast-radius and the old trust-chain
for (const name of readdirSync(OUT)) {
  if (/^(perspective|blast-radius|trust-chain)\./.test(name)) unlinkSync(join(OUT, name));
}
hero();
for (const [name, svg] of Object.entries(OUTPUT)) writeFileSync(join(OUT, name), svg);
for (const [id, meta] of Object.entries(META)) {
  writeFileSync(join(OUT, `${id}.data.json`), JSON.stringify({ id, title: meta.title, alt: meta.alt }, null, 2) + "\n");
}
console.log(`generate-sources: ${Object.keys(OUTPUT).length} SVGs, ${Object.keys(META).length} data files written to ${OUT}`);
