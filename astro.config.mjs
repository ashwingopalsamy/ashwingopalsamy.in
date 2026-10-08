import { defineConfig } from "astro/config";
import { markdownProcessor } from "./src/lib/markdown/index.js";
import { codeMetaTransformers } from "./src/lib/markdown/shiki-transformers.js";
import { writeFile } from "node:fs/promises";

// Dev only: the DevTuner panel POSTs its values here; they land in
// .tune.json (gitignored) so they can be read back without copy-paste.
const devTuner = {
  name: "dev-tuner",
  configureServer(server) {
    server.middlewares.use("/__tune", (req, res) => {
      if (req.method !== "POST") {
        res.statusCode = 405;
        return res.end();
      }
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
        if (body.length > 16384) req.destroy();
      });
      req.on("end", async () => {
        try {
          const values = JSON.parse(body);
          await writeFile(".tune.json", `${JSON.stringify({ savedAt: new Date().toISOString(), ...values }, null, 2)}\n`);
          res.statusCode = 204;
        } catch {
          res.statusCode = 400;
        }
        res.end();
      });
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
    plugins: [devTuner],
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
