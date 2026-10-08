import { defineConfig } from "astro/config";
import { markdownProcessor } from "./src/lib/markdown/index.js";
import { codeMetaTransformers } from "./src/lib/markdown/shiki-transformers.js";

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
    // Astro owns hover prefetch; touch intent uses the same prefetch API.
    // Every same-origin link opts in; Chromium prerenders it (clientPrerender)
    // so the cross-document view transition activates an already-rendered page.
    prefetchAll: true,
    defaultStrategy: "hover",
  },
  experimental: {
    clientPrerender: true,
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
    build: {
      cssMinify: "lightningcss",
      rolldownOptions: {
        output: {
          codeSplitting: {
            // Mermaid's d3/dayjs stack otherwise lands in the same automatic
            // chunk as rolldown's shared runtime helpers, which sound and
            // telemetry import on every route (~13 KB br per page).
            groups: [
              { name: "diagram-vendor", test: /node_modules[\\/](?:d3|d3-[^\\/]+|dayjs)[\\/]/ },
            ],
          },
        },
      },
    },
  },
});
