import { readFile } from "node:fs/promises";
import { join } from "node:path";
import satori from "satori";
import sharp from "sharp";
import { site } from "../data/home";
import {
  CANVAS_LIGHT,
  INK_LIGHT,
  STEEL_3,
  STEEL_7,
  STEEL_8,
} from "./theme";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const fontsDir = join(process.cwd(), "src/assets/fonts");

let fontCache: { regular: Buffer; medium: Buffer; wordmark: string } | null = null;

async function loadAssets() {
  if (fontCache) return fontCache;
  const [regular, medium, wordmarkSvg] = await Promise.all([
    readFile(join(fontsDir, "Inter-Regular.woff")),
    readFile(join(fontsDir, "Inter-Medium.woff")),
    readFile(join(process.cwd(), "public/ag-black-text.svg")),
  ]);
  fontCache = {
    regular,
    medium,
    wordmark: `data:image/svg+xml;base64,${wordmarkSvg.toString("base64")}`,
  };
  return fontCache;
}

/** Escape text for satori string children (defense against markup injection). */
export function escapeOgText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fitTitle(title: string): { text: string; fontSize: number } {
  const clean = title.trim();
  if (clean.length <= 42) return { text: clean, fontSize: 54 };
  if (clean.length <= 64) return { text: clean, fontSize: 44 };
  if (clean.length <= 90) return { text: clean, fontSize: 36 };
  const truncated = clean.slice(0, 96).replace(/\s+\S*$/, "").trimEnd() + "…";
  return { text: truncated, fontSize: 32 };
}

export interface OgCardOptions {
  title: string;
  eyebrow?: string;
  meta?: string;
  tags?: string[];
}

export async function renderOgPng(opts: OgCardOptions): Promise<Buffer> {
  const { wordmark, regular, medium } = await loadAssets();
  const host = new URL(site.url).host;
  const { text: title, fontSize } = fitTitle(opts.title);
  const eyebrow = opts.eyebrow ? escapeOgText(opts.eyebrow) : null;
  const meta = opts.meta ? escapeOgText(opts.meta) : null;
  const tags = (opts.tags ?? []).slice(0, 4).map(escapeOgText);

  const midChildren: object[] = [];
  if (eyebrow) {
    midChildren.push({
      type: "div",
      props: {
        style: {
          fontSize: 18,
          fontWeight: 500,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: STEEL_7,
        },
        children: eyebrow,
      },
    });
  }
  midChildren.push({
    type: "div",
    props: {
      style: {
        fontSize,
        fontWeight: 500,
        letterSpacing: "-0.025em",
        lineHeight: 1.12,
      },
      children: escapeOgText(title),
    },
  });
  if (meta) {
    midChildren.push({
      type: "div",
      props: {
        style: {
          fontSize: 22,
          fontWeight: 400,
          color: STEEL_8,
          letterSpacing: "-0.01em",
        },
        children: meta,
      },
    });
  }
  if (tags.length) {
    midChildren.push({
      type: "div",
      props: {
        style: {
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          gap: "10px",
          marginTop: "4px",
        },
        children: tags.map((t) => ({
          type: "div",
          props: {
            style: {
              fontSize: 18,
              fontWeight: 400,
              color: STEEL_8,
              border: `1px solid ${STEEL_3}`,
              borderRadius: "999px",
              padding: "4px 14px",
            },
            children: `#${t}`,
          },
        })),
      },
    });
  }

  const svg = await satori(
    {
      type: "div",
      props: {
        style: {
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: CANVAS_LIGHT,
          color: INK_LIGHT,
          padding: "64px 72px",
          fontFamily: "Inter",
        },
        children: [
          {
            type: "img",
            props: {
              src: wordmark,
              height: 40,
              width: 120,
              style: { objectFit: "contain", objectPosition: "left center" },
            },
          },
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                maxWidth: "980px",
              },
              children: midChildren,
            },
          },
          {
            type: "div",
            props: {
              style: {
                fontSize: 20,
                fontWeight: 400,
                color: STEEL_7,
                letterSpacing: "-0.01em",
              },
              children: host,
            },
          },
        ],
      },
    },
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
      fonts: [
        { name: "Inter", data: regular, weight: 400, style: "normal" },
        { name: "Inter", data: medium, weight: 500, style: "normal" },
      ],
    },
  );

  return sharp(Buffer.from(svg)).png().toBuffer();
}

export function ogPngResponse(png: Buffer): Response {
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
