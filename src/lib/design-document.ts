import designSource from "../../DESIGN.md?raw";
import { parse } from "yaml";

interface DesignTypographyToken {
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: number;
  lineHeight?: number | string;
  letterSpacing?: string;
  fontFeature?: string;
  fontVariation?: string;
}

interface DesignFrontmatter {
  version: string;
  name: string;
  description: string;
  namingNote: string;
  colors: Record<string, string>;
  typography: Record<string, DesignTypographyToken>;
  rounded: Record<string, string>;
  spacing: Record<string, string | number>;
  components: Record<string, Record<string, string>>;
}

function splitFrontmatter(source: string): { frontmatter: DesignFrontmatter; markdown: string } {
  const match = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error("DESIGN.md must begin with YAML frontmatter");
  return {
    frontmatter: parse(match[1] ?? "") as DesignFrontmatter,
    markdown: match[2] ?? "",
  };
}

const parsed = splitFrontmatter(designSource);

export const designDocument = Object.freeze({
  source: designSource,
  frontmatter: parsed.frontmatter,
  markdown: parsed.markdown,
  contractVersion: "1.1",
  auditedAt: "2026-08-10",
});
