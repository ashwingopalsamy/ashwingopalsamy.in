/**
 * Shiki transformers for the notes engine:
 *   - title / filename from fence meta (`title=main.go` or bare `main.go`)
 *   - line highlight via trailing `// [!code hl]` / `# [!code hl]` markers
 *
 * Wired through astro.config `markdown.shikiConfig.transformers`. Meta is
 * available during highlight (satteri passes codeChild.data.meta) but is
 * otherwise discarded from the resulting <pre> - these transformers stamp
 * it onto data attributes before the hast leaves Shiki.
 */
import type { ShikiTransformer } from "shiki";

const TITLE_RE = /(?:^|\s)title=([^\s]+)/;
const BARE_FILE_RE = /^[\w./@+-]+\.\w[\w.-]*$/;
const HL_MARK_RE = /\s*(?:\/\/|#|--)\s*\[!code\s+hl\]\s*$/;

function parseTitle(meta: string | undefined, lang: string | undefined): string | undefined {
  const raw = (meta ?? "").trim();
  if (raw) {
    const m = TITLE_RE.exec(raw);
    if (m) return m[1];
    if (BARE_FILE_RE.test(raw)) return raw;
  }
  // ```go:title=main.go - some authors use colon form in the info string
  if (lang) {
    const colon = /^([^:]+):title=(.+)$/.exec(lang);
    if (colon) return colon[2];
  }
  return undefined;
}

function parseLang(lang: string | undefined): string | undefined {
  if (!lang) return lang;
  const colon = /^([^:]+):title=/.exec(lang);
  return colon ? colon[1] : lang;
}

export function codeMetaTransformers(): ShikiTransformer[] {
  return [
    {
      name: "code-title",
      preprocess(code, options) {
        const title = parseTitle(options.meta?.__raw, options.lang);
        const cleanLang = parseLang(options.lang);
        if (cleanLang && cleanLang !== options.lang) {
          options.lang = cleanLang;
        }
        if (title) {
          options.meta = { ...options.meta, title };
        }
        return code;
      },
      pre(node) {
        const title = (this.options.meta as { title?: string } | undefined)?.title;
        if (!title) return;
        node.properties = node.properties ?? {};
        node.properties["data-title"] = title;
      },
    },
    {
      name: "code-line-highlight",
      preprocess(code) {
        const lines = code.split("\n");
        const highlighted: number[] = [];
        const cleaned = lines.map((line, i) => {
          if (HL_MARK_RE.test(line)) {
            highlighted.push(i + 1);
            return line.replace(HL_MARK_RE, "");
          }
          return line;
        });
        if (highlighted.length) {
          this.meta ??= {};
          (this.meta as { highlightLines?: number[] }).highlightLines = highlighted;
        }
        return cleaned.join("\n");
      },
      line(node, line) {
        const lines = (this.meta as { highlightLines?: number[] } | undefined)?.highlightLines;
        if (!lines?.includes(line)) return;
        node.properties = node.properties ?? {};
        const cls = node.properties.class;
        const list = Array.isArray(cls) ? cls.map(String) : cls ? [String(cls)] : [];
        if (!list.includes("line-highlight")) list.push("line-highlight");
        node.properties.class = list;
      },
    },
  ];
}
