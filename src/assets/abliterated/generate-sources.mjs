// Writes the abliterated post's figures: <id>.wide.svg, <id>.compact.svg and <id>.data.json here for
// the inline-figures plugin, plus public/blog/abliterated/<id>.svg for the .md mirror.
// Run: node src/assets/abliterated/generate-sources.mjs
// Counts are from Hugging Face's public API (name search), read on 2026-11-01.
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(HERE, "../../../public/blog/abliterated");

const INK = "var(--ink,#1a1a1a)";
const GHOST = "var(--ghost,#6b6e70)";
const FAINT = "var(--edge-soft,#e8e8e8)";
const VIOLET = "var(--viz-violet,#7844f0)";
const AMBER = "var(--viz-amber,#f59926)";
const BLUE = "var(--viz-blue,#0278e7)";
const GREEN = "var(--viz-green,#20b46b)";

const r = (n) => Math.round(n * 100) / 100;
const text = (x, y, s, { size = 13, fill = INK, anchor = "start", weight = 400 } = {}) =>
  `<text x="${r(x)}" y="${r(y)}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-weight="${weight}" font-family="inherit">${s}</text>`;

function svg(id, layout, w, h, title, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" data-layout="${layout}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="${id}-${layout}-t ${id}-${layout}-d" font-family="ui-sans-serif, system-ui, sans-serif"><title id="${id}-${layout}-t">${title}</title><desc id="${id}-${layout}-d"></desc>${body}</svg>\n`;
}

function emit(id, title, alt, wide, compact) {
  writeFileSync(join(HERE, `${id}.wide.svg`), svg(id, "wide", wide.w, wide.h, title, wide.body));
  writeFileSync(join(HERE, `${id}.compact.svg`), svg(id, "compact", compact.w, compact.h, title, compact.body));
  writeFileSync(join(HERE, `${id}.data.json`), `${JSON.stringify({ id, title, alt }, null, 2)}\n`);
  copyFileSync(join(HERE, `${id}.wide.svg`), join(PUBLIC, `${id}.svg`));
}

mkdirSync(PUBLIC, { recursive: true });

// ---- one direction removed: the OG mark, before and after
function burst(cx, cy, r0, r1, removed) {
  const n = 16;
  let out = "";
  for (let i = 0; i < n; i += 1) {
    const a = (i * 2 * Math.PI) / n - Math.PI / 4;
    const p = (d) => `x1="${r(cx + r0 * Math.cos(a))}" y1="${r(cy + r0 * Math.sin(a))}" x2="${r(cx + d * Math.cos(a))}" y2="${r(cy + d * Math.sin(a))}"`;
    if (i === 0) {
      out += removed
        ? `<line data-ray-dashed ${p(r1)} stroke="${VIOLET}" stroke-width="3" stroke-dasharray="6 6"/><line data-ray-solid ${p(r1)} stroke="${VIOLET}" stroke-width="4" stroke-linecap="round" opacity="0"/>`
        : `<line ${p(r1)} stroke="${VIOLET}" stroke-width="4" stroke-linecap="round"/>`;
    } else {
      out += `<line ${p(r1)} stroke="${GHOST}" stroke-width="1.5" stroke-linecap="round" opacity="0.55"/>`;
    }
  }
  return out;
}

function direction(w, h, gap, size) {
  const [a, b] = [w / 2 - gap, w / 2 + gap];
  const cy = size + 14;
  const half = Math.min(22, (gap - size) * 0.8);
  const arrow = `<path d="M${w / 2 - half} ${cy}h${2 * half}m-7 -6l7 6l-7 6" fill="none" stroke="${GHOST}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
  const labelY = cy + size + 30;
  return {
    w,
    h,
    body:
      burst(a, cy, size * 0.28, size, false) +
      `<g data-after><rect x="${r(b - size - 10)}" y="0" width="${r(2 * size + 20)}" height="${h}" fill="transparent"/>` +
      burst(b, cy, size * 0.28, size, true) +
      "</g>" +
      arrow +
      text(a, labelY, "Trained model", { anchor: "middle", weight: 500, size: 14 }) +
      text(a, labelY + 20, "says no", { anchor: "middle", fill: GHOST }) +
      text(b, labelY, "Abliterated", { anchor: "middle", weight: 500, size: 14 }).replace("<text", "<text data-after-title") +
      text(b, labelY + 20, "stops saying no", { anchor: "middle", fill: GHOST }).replace("<text", "<text data-after-note"),
  };
}

emit(
  "one-direction",
  "One direction, erased",
  "Two bursts of lines. In the trained model one line is solid violet and the model says no. In the abliterated model that line is dashed and the model stops saying no.",
  direction(640, 250, 170, 90),
  direction(360, 190, 90, 58),
);

// ---- uploads per month
const MONTHS = [
  ["2024-05", 201], ["2024-06", 99], ["2024-07", 133], ["2024-08", 67], ["2024-09", 136], ["2024-10", 207],
  ["2024-11", 237], ["2024-12", 195], ["2025-01", 295], ["2025-02", 218], ["2025-03", 334], ["2025-04", 310],
  ["2025-05", 298], ["2025-06", 208], ["2025-07", 110], ["2025-08", 189], ["2025-09", 145], ["2025-10", 115],
  ["2025-11", 260], ["2025-12", 236], ["2026-01", 251], ["2026-02", 220], ["2026-03", 504], ["2026-04", 676],
  ["2026-05", 359], ["2026-06", 565], ["2026-07", 371], ["2026-08", 714], ["2026-09", 539], ["2026-10", 715],
];
const YEARS = { 2024: ["1,275", 0.42], 2025: ["2,718", 0.68], 2026: ["4,916", 1] };
const NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function uploads(w, h, labelSize) {
  const [left, right, top, base] = [30, 4, 30, h - 50];
  const step = (w - left - right) / MONTHS.length;
  const y = (v) => base - (v / 800) * (base - top);
  let body = "";
  for (const v of [250, 500, 750]) {
    body += `<line x1="${left}" x2="${w - right}" y1="${r(y(v))}" y2="${r(y(v))}" stroke="${FAINT}" stroke-width="1"/>`;
    body += text(left - 6, y(v) + 4, String(v), { size: 11, fill: GHOST, anchor: "end" });
  }
  body += `<g data-bars data-left="${left}" data-top="${top}" data-width="${r(w - left - right)}" data-height="${base - top}">`;
  MONTHS.forEach(([ym, v], i) => {
    const [yr, mo] = ym.split("-");
    const bw = Math.min(8, step * 0.55);
    const x = left + i * step + (step - bw) / 2;
    const rad = bw / 2;
    const t = y(v);
    body += `<path data-v="${v}" data-label="${NAMES[+mo - 1]} ${yr}" d="M${r(x)} ${base}V${r(t + rad)}Q${r(x)} ${r(t)} ${r(x + rad)} ${r(t)}H${r(x + bw - rad)}Q${r(x + bw)} ${r(t)} ${r(x + bw)} ${r(t + rad)}V${base}Z" fill="${VIOLET}" fill-opacity="${YEARS[yr][1]}"><title>${NAMES[+mo - 1]} ${yr}: ${v} models</title></path>`;
  });
  body += "</g>";
  body += `<line x1="${left}" x2="${w - right}" y1="${base}" y2="${base}" stroke="${GHOST}" stroke-width="1"/>`;
  for (const yr of Object.keys(YEARS)) {
    const idx = MONTHS.map(([m], i) => (m.startsWith(yr) ? i : -1)).filter((i) => i >= 0);
    const x = left + idx[0] * step;
    body += text(x + 1, base + 20, yr, { size: labelSize, weight: 500 });
    body += text(x + 1, base + 38, `${YEARS[yr][0]} models`, { size: labelSize - 1, fill: GHOST });
  }
  body += text(w - right, 13, "715 in Oct 2026", { size: labelSize - 1, anchor: "end" }).replace("<text", "<text data-readout");
  return { w, h, body };
}

emit(
  "uploads",
  "New “abliterated” models each month",
  "Monthly bars rising from about 200 in May 2024 to 715 in October 2026. 2024 had 1,275 models, 2025 had 2,718 and 2026 has 4,916 so far.",
  uploads(640, 300, 13),
  uploads(360, 280, 12),
);

// ---- models and downloads by name
const ROWS = [
  ["abliterated", 8909, "8,909", 25.4, VIOLET, "8,909 models from 2,255 accounts, about 2,850 downloads per model."],
  ["uncensored", 8061, "8,061", 36.0, AMBER, "8,061 models from 2,691 accounts, about 4,470 downloads per model."],
  ["heretic", 7147, "7,147", 13.1, BLUE, "7,147 models from 1,612 accounts, about 1,830 downloads per model."],
  ["obliterated", 472, "472", 2.0, GREEN, "472 models from 230 accounts, about 4,340 downloads per model. All uploaded in 2026."],
];
const rowOpen = (name, say, y, w, h) =>
  `<g data-row="${name}" data-say="${name}: ${say}"><rect x="0" y="${r(y)}" width="${w}" height="${h}" fill="transparent"/>`;
const barRect = (x, y, width, h, fill) =>
  `<rect x="${r(x)}" y="${r(y)}" width="${r(Math.max(width, 3))}" height="${h}" rx="${h / 2}" fill="${fill}"/>`;

function namesWide() {
  const [w, rowH, top] = [640, 44, 34];
  const [c1, c2, max] = [108, 380, 170];
  let body = text(c1, 16, "Models", { fill: GHOST }) + text(c2, 16, "Downloads, last 30 days", { fill: GHOST });
  ROWS.forEach(([name, n, nl, d, color, say], i) => {
    const y = top + i * rowH;
    body += rowOpen(name, say, y - 8, w, rowH);
    body += text(0, y + 15, name, { size: 14, weight: 500 });
    body += barRect(c1, y + 6, (n / 8909) * max, 10, color);
    body += text(c1 + Math.max((n / 8909) * max, 3) + 8, y + 15, nl);
    body += barRect(c2, y + 6, (d / 36) * max, 10, color);
    body += text(c2 + Math.max((d / 36) * max, 3) + 8, y + 15, `${d.toFixed(1)}M`);
    body += "</g>";
  });
  return { w, h: top + ROWS.length * rowH - 12, body };
}

function namesCompact() {
  const [w, rowH, top] = [360, 76, 4];
  const max = 240;
  let body = "";
  ROWS.forEach(([name, n, nl, d, color, say], i) => {
    const y = top + i * rowH;
    body += rowOpen(name, say, y, w, rowH - 8);
    body += text(0, y + 13, name, { size: 14, weight: 500 });
    body += barRect(0, y + 22, (n / 8909) * max, 8, color);
    body += text(Math.max((n / 8909) * max, 3) + 8, y + 30, `${nl} models`, { size: 12 });
    body += barRect(0, y + 40, (d / 36) * max, 8, color);
    body += text(Math.max((d / 36) * max, 3) + 8, y + 48, `${d.toFixed(1)}M downloads`, { size: 12 });
    body += "</g>";
  });
  return { w, h: top + ROWS.length * rowH - 10, body };
}

emit(
  "names",
  "Models on Hugging Face, by name",
  "Abliterated: 8,909 models, 25.4 million downloads in the last 30 days. Uncensored: 8,061 models, 36.0 million. Heretic: 7,147 models, 13.1 million. Obliterated: 472 models, 2.0 million.",
  namesWide(),
  namesCompact(),
);

// ---- safeguards, as rings
function rings(cx, cy, scale, level) {
  // A dotted trace under every ring; a solid ring that isn't here yet stays in the file at opacity 0 for the peel.
  const ring = (rad, color, name, on, traceColor = GHOST, trace = 'stroke-width="1" stroke-dasharray="2 5" opacity="0.6"') =>
    `<circle cx="${cx}" cy="${cy}" r="${rad * scale}" fill="none" stroke="${traceColor}" ${trace}/>` +
    `<circle data-solid="${name}" cx="${cx}" cy="${cy}" r="${rad * scale}" fill="none" stroke="${color}" stroke-width="4"${on ? "" : ' opacity="0"'}/>`;
  return (
    ring(66, BLUE, "monitoring", level === 3) +
    ring(46, AMBER, "classifiers", level === 3) +
    (level === 1
      ? ring(26, VIOLET, "refusal", false, VIOLET, 'stroke-width="2.5" stroke-dasharray="5 6"')
      : ring(26, VIOLET, "refusal", true)) +
    `<circle cx="${cx}" cy="${cy}" r="${7 * scale}" fill="${INK}"/>`
  );
}

function safeguards(w, scale, size, sub) {
  const xs = [w / 6, w / 2, (5 * w) / 6];
  const cy = 34 + 72 * scale;
  const labelY = cy + 66 * scale + 30;
  const legend = [["Monitoring", BLUE], ["Classifiers", AMBER], ["Refusal", VIOLET]];
  const lx = [w / 2 - size * 11.5, w / 2 - size * 3, w / 2 + size * 5.5];
  let body = "";
  legend.forEach(([name, color], i) => {
    body += `<circle cx="${r(lx[i])}" cy="11" r="5" fill="${color}"/>` + text(lx[i] + 11, 15.5, name, { size: size - 1, fill: GHOST });
  });
  [
    ["Hosted", "all three", 3, "Hosted: requests pass through the provider, with classifiers and monitoring around the model."],
    ["Downloaded", "refusal only", 2, "Downloaded: no provider in the loop. Only the trained refusal is left."],
    ["Abliterated", "none of them", 1, "Abliterated: the trained refusal is gone too."],
  ].forEach(([name, note, level, say], i) => {
    body += `<g data-col="${name}" data-say="${say}"><rect x="${r(xs[i] - w / 6)}" y="24" width="${r(w / 3)}" height="${r(labelY + sub - 18)}" fill="transparent"/>`;
    body += rings(xs[i], cy, scale, level);
    body += text(xs[i], labelY, name, { anchor: "middle", weight: 500, size });
    body += text(xs[i], labelY + sub, note, { anchor: "middle", fill: GHOST, size: size - 1 });
    body += "</g>";
  });
  return { w, h: labelY + sub + 6, body };
}

emit(
  "safeguards",
  "What surrounds the model",
  "Three sets of rings around a dot. A hosted model has monitoring, classifiers and refusal. A downloaded model has refusal only. An abliterated model has none of them, and its refusal ring is dashed.",
  safeguards(640, 1, 14, 20),
  safeguards(360, 0.68, 13, 18),
);
