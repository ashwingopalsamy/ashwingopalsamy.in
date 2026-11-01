/**
 * inline-figures - the eMudhra post's figures, inlined at build.
 *
 * The post writes each figure as plain Markdown:
 *
 *   ![alt](/blog/emudhra/<id>.svg)
 *
 *   _caption_
 *
 * so the `.md` mirror and Substack keep a normal image and a caption line. Here, at the hast
 * stage, a paragraph whose only child is such an image (and the paragraph after it, when it is
 * just one `<em>`) becomes
 *
 *   figure.fig[data-fig] > p.fig__title, div.fig__art > svg (wide) + svg (compact), figcaption.fig__cap
 *
 * with the SVGs inline so they take the site's tokens and the theme toggle and can play once on
 * view (boot.ts toggles [data-armed] and [data-play] on the figure). No controls: the figures
 * explain, they do not do anything on their own.
 *
 * Sources live in `src/assets/emudhra/<id>.{wide,compact}.svg` and `<id>.data.json` ({ id, title,
 * alt }); see generate-sources.mjs there. The standalone files under public/blog/emudhra/ come from
 * scripts/render-emudhra-figures.mjs; this plugin never reads them.
 *
 * Runs after `externalLinks` so a caption link is already marked up when it is serialized. An
 * unknown id, a missing source file or a non-matching caption leaves the paragraph untouched.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Element, ElementContent, Properties } from "hast";
import type { HastVisitorContext } from "satteri";
import { escapeHtml, rawNode } from "./hast";

const SRC = /^\/blog\/(emudhra|abliterated)\/([a-z0-9-]+)\.svg$/;
const ASSETS = join(process.cwd(), "src/assets");

interface Figure {
  id: string;
  title: string;
  alt: string;
  wide: string;
  compact: string;
}

const cache = new Map<string, Figure | null>();
const warned = new Set<string>();

function load(post: string, id: string): Figure | null {
  const key = `${post}/${id}`;
  if (cache.has(key)) return cache.get(key) ?? null;
  const files = [`${id}.data.json`, `${id}.wide.svg`, `${id}.compact.svg`].map((f) => join(ASSETS, post, f));
  let figure: Figure | null = null;
  if (files.every((f) => existsSync(f))) {
    const data = JSON.parse(readFileSync(files[0], "utf8")) as { id: string; title: string; alt: string };
    figure = { ...data, wide: readFileSync(files[1], "utf8").trim(), compact: readFileSync(files[2], "utf8").trim() };
  } else if (!warned.has(key)) {
    warned.add(key);
    console.warn(`[inline-figures] ${id}: source SVG or data file is missing in src/assets/${post}; leaving the image as is.`);
  }
  cache.set(key, figure);
  return figure;
}

// ---- hast -> html (caption only: text, inline elements, raw icon markup)
const VOID = new Set(["br", "img", "hr", "wbr"]);
const attrEscape = (s: string) => escapeHtml(s).replace(/"/g, "&quot;");

function attrName(key: string): string {
  if (key === "className") return "class";
  if (key === "htmlFor") return "for";
  return key.replace(/^(data|aria)([A-Z])/, (_, p, c) => `${p}-${c}`).replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function serialize(node: ElementContent): string {
  if (node.type === "text") return escapeHtml(node.value);
  if (node.type === "raw") return (node as { value: string }).value;
  if (node.type !== "element") return "";
  const props = (node.properties ?? {}) as Properties;
  const attrs = Object.entries(props)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => {
      const value = Array.isArray(v) ? v.join(" ") : String(v);
      return v === true ? ` ${attrName(k)}` : ` ${attrName(k)}="${attrEscape(value)}"`;
    })
    .join("");
  if (VOID.has(node.tagName)) return `<${node.tagName}${attrs}>`;
  return `<${node.tagName}${attrs}>${(node.children ?? []).map(serialize).join("")}</${node.tagName}>`;
}

// ---- markup
/** Put the post's alt text in the SVG's <desc> (the source carries the same text; the post is authoritative). */
function withDesc(svg: string, alt: string): string {
  return svg.replace(/(<desc\b[^>]*>)[\s\S]*?(<\/desc>)/, `$1${escapeHtml(alt)}$2`);
}

function build(fig: Figure, alt: string, captionHtml: string): string {
  return (
    `<figure class="fig" id="fig-${fig.id}" data-fig="${fig.id}">` +
    `<p class="fig__title">${escapeHtml(fig.title)}</p>` +
    `<div class="fig__art" data-layouts style="container: fig / inline-size">${withDesc(fig.wide, alt)}${withDesc(fig.compact, alt)}</div>` +
    (captionHtml ? `<figcaption class="fig__cap">${captionHtml}</figcaption>` : "") +
    `</figure>`
  );
}

// ---- plugin
const blank = (n: ElementContent) => n.type === "text" && !n.value.trim();
const significant = (el: Element) => (el.children ?? []).filter((c) => !blank(c));

export const inlineFigures = {
  name: "inline-figures",
  element: {
    filter: ["p"],
    visit(node: Element, ctx: HastVisitorContext): void {
      const kids = significant(node);
      if (kids.length !== 1) return;
      const img = kids[0];
      if (img.type !== "element" || img.tagName !== "img") return;
      const src = img.properties?.src;
      const m = typeof src === "string" ? src.match(SRC) : null;
      if (!m) return;
      const fig = load(m[1], m[2]);
      if (!fig) return;
      const alt = typeof img.properties?.alt === "string" ? (img.properties.alt as string) : fig.alt;

      // the caption: the next block sibling, when it is a paragraph holding a single <em>
      let caption: Element | undefined;
      const parent = ctx.parent(node);
      const index = ctx.indexOf(node);
      if (index !== undefined) {
        const siblings = (parent as { children: ElementContent[] }).children;
        for (let j = index + 1; j < siblings.length; j += 1) {
          const s = siblings[j];
          if (blank(s)) continue;
          if (s.type === "element" && s.tagName === "p") {
            const inner = significant(s);
            if (inner.length === 1 && inner[0].type === "element" && inner[0].tagName === "em") caption = s;
          }
          break;
        }
      }
      const captionHtml = caption
        ? ((significant(caption)[0] as Element).children ?? []).map(serialize).join("").trim()
        : "";

      ctx.replaceNode(node, rawNode(build(fig, alt, captionHtml)));
      if (caption) ctx.removeNode(caption);
    },
  },
};
