import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";
import { markdownProcessor } from "./src/lib/markdown/index.js";
import { codeMetaTransformers } from "./src/lib/markdown/shiki-transformers.js";

const designMarkdownPath = fileURLToPath(new URL("./DESIGN.md", import.meta.url));

const designMarkdownDevFallback = {
  name: "design-markdown-dev-fallback",
  configureServer(server) {
    server.httpServer?.prependListener("request", (request) => {
      const pathname = new URL(request.url ?? "/", "http://localhost").pathname;
      if (request.method !== "GET" || (pathname !== "/design.md" && pathname !== "/DESIGN.md" && pathname !== "/design.md/")) {
        return;
      }

      request.url = `/@fs${designMarkdownPath}`;
    });
  },
};

export default defineConfig({
  site: "https://ashwingopalsamy.in",
  redirects: {
    "/craft": "/work/",
    "/craft/[...slug]": "/work/[...slug]",
    "/library/notes": "/library/?view=notes",
    "/library/notes/[slug]": "/blog/[slug]",
  },
  devToolbar: {
    enabled: false,
  },
  build: {
    inlineStylesheets: "always",
  },
  prefetch: {
    // Safari/Firefox fallback for Speculation Rules; Chromium uses prerender.
    defaultStrategy: "hover",
  },
  markdown: {
    // Satteri (Astro 7's Rust markdown engine) extended with the notes-engine
    // plugins: mermaid at mdast, KaTeX + callouts + anchors at hast. See
    // src/lib/markdown/index.js for the ordering rationale.
    processor: markdownProcessor,
    shikiConfig: {
      // Keep syntax markup colorless so prose.css can apply the Steel palette.
      themes: { light: "github-light-default", dark: "github-dark-default" },
      defaultColor: false,
      wrap: false,
      transformers: codeMetaTransformers(),
    },
  },
  vite: {
    plugins: [designMarkdownDevFallback],
    build: {
      cssMinify: "lightningcss",
    },
  },
});
