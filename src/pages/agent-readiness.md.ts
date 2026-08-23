export const prerender = true;

const source = `# Machine readiness

This document keeps the site's discovery and read-only machine interfaces separate from its visual design reference.

## Canonical public material

- \`/llms.txt\`, \`/llms-full.txt\`, and \`/llms-ctx.txt\` provide progressively richer text context.
- \`/ai.txt\` and \`/api/ai-summary.json\` provide compact identity and capability summaries.
- \`/knowledge.json\` is generated from the shared Person JSON-LD source.
- \`/sitemap.md\` and \`/sitemap.xml\` expose the canonical page inventory.
- \`/design.md\` serves the exact \`DESIGN.md\` source.
- Library RSS and JSON feeds expose public writing and saved material.

## Constraints

All interfaces are public, read-only, static, and bounded to information already published on the site. They do not expose private data, mutate state, track visitors, or require credentials. Human pages remain canonical when a machine-facing representation disagrees.

## Identity changes

Role, employer, location, and biography updates must be applied to the shared home data, Person JSON-LD, LLM text files, AI summaries, and the AI page together. Rebuild afterward so generated knowledge data stays aligned.

## Discovery

The AI page is the human index for these surfaces. \`/.well-known/agents.md\`, \`/.well-known/ai-catalog.json\`, and \`/.well-known/api-catalog\` describe the available public documents, capability manifests, and read-only endpoints for clients that look there.
`;

export function GET() {
  return new Response(source, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": 'inline; filename="agent-readiness.md"',
      "X-Robots-Tag": "noindex, follow",
    },
  });
}
