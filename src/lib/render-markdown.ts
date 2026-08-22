import type { MarkdownRenderer } from "@astrojs/internal-helpers/markdown";
import { markdownProcessor } from "./markdown/index";
import { codeMetaTransformers } from "./markdown/shiki-transformers";

let renderer: MarkdownRenderer | null = null;

async function getRenderer(): Promise<MarkdownRenderer> {
  if (renderer) return renderer;
  renderer = await markdownProcessor.createRenderer({
    syntaxHighlight: "shiki",
    shikiConfig: {
      themes: { light: "github-light-default", dark: "github-dark-default" },
      defaultColor: false,
      wrap: false,
      transformers: codeMetaTransformers(),
    },
  });
  return renderer;
}

/** Render note body markdown to HTML for full-text feeds. */
export async function renderMarkdownHtml(body: string): Promise<string> {
  if (!body.trim()) return "";
  const r = await getRenderer();
  const { code } = await r.render(body);
  return code;
}

export async function renderMarkdownDocument(body: string) {
  if (!body.trim()) return { code: "", headings: [] };
  const r = await getRenderer();
  return r.render(body);
}
