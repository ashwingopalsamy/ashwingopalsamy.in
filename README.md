<div align="center">

# ashwingopalsamy.in

**Personal engineering site, digital garden, and agent-native web hub.**

[![Astro](https://img.shields.io/badge/Astro-7.1.1-BC52EE?style=flat-square&logo=astro&logoColor=white)](https://astro.build)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Cloudflare](https://img.shields.io/badge/Cloudflare_Pages-Edge-F38020?style=flat-square&logo=cloudflare&logoColor=white)](https://pages.cloudflare.com)
[![Agent Native](https://img.shields.io/badge/Agent_Native-Level_5-10B981?style=flat-square)](https://ashwingopalsamy.in/developers)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)

[Live Site](https://ashwingopalsamy.in) · [Developer Hub](https://ashwingopalsamy.in/developers) · [AI Discovery](https://ashwingopalsamy.in/ai) · [Design System](DESIGN.md)

</div>

---

## Overview

High-performance static-first personal portfolio engineered with modern web standards, progressive enhancement, custom typography in OKLCH, and Level 5 Agent-Native protocol support.

- **Fast by Default:** Pure Astro static builds powered by Rust markdown processing (satteri), fine-tuned Shiki dual-theme syntax highlighting, and zero-JS core readability.
- **Edge Powered:** Cloudflare Pages Functions delivering dynamic MCP transport, Agent-to-Agent (A2A) protocol negotiation, and zero-trust security header policies.
- **Agent Native:** First-class discovery and interaction interfaces for autonomous AI agents via WebMCP, streamable HTTP MCP, OpenAPI, and typed context manifests.
- **Multi-Platform SDKs:** First-party client libraries across Go, Python, Ruby, and TypeScript plus an interactive CLI.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Astro 7 with satteri engine |
| Styling | Global OKLCH Design Tokens, Scoped Prose System |
| Edge Runtime | Cloudflare Pages Functions |
| Search | Local Pagefind WebAssembly Indexing |
| Content Pipeline | GFM, KaTeX Math, Mermaid Diagrams, Github Slugger |
| Package Ecosystem | Multi-language SDKs (Go, Python, Ruby, TypeScript, CLI) |

---

## Quickstart

### Requirements

- Node.js 22+
- npm 10+

### Setup

```bash
# Clone the repository
git clone https://github.com/ashwingopalsamy/ashwingopalsamy.in.git
cd ashwingopalsamy.in

# Install dependencies
npm ci

# Start development server
npm run dev

# Type check
npm run check
npm run check:functions

# Build for production
npm run build
```

---

## Agent Interfaces & Machine Endpoints

This site implements Level 5 Agent-Native architecture:

| Protocol / Format | Endpoint | Description |
|---|---|---|
| WebMCP | `window.modelContext` / `navigator.modelContext` | In-browser DOM tool registry |
| HTTP MCP | `/mcp` | Streamable Model Context Protocol endpoint |
| Agent-to-Agent | `/a2a` | A2A JSON-RPC communication bridge |
| OpenAPI Spec | `/openapi.json` | Complete machine API definitions |
| LLM Context | `/llms.txt`, `/llms-full.txt`, `/llms-ctx.txt` | Hierarchical site context |
| Machine Catalog | `/.well-known/ai-catalog.json` | Discovery catalog for autonomous agents |
| Knowledge Graph | `/knowledge.json` | Person JSON-LD entity graph |

Explore full capabilities at [/developers](https://ashwingopalsamy.in/developers) and [/ai](https://ashwingopalsamy.in/ai).

---

## Project Structure

```
├── bin/                 # CLI entry point
├── functions/           # Cloudflare Pages Functions (MCP, A2A, API)
├── packages/            # Multi-language SDKs (Go, Python, Ruby, TS)
├── public/              # Static assets, AI manifests, headers, redirects
├── src/
│   ├── assets/          # Fonts, maps, imagery
│   ├── components/      # UI components & interactive widgets
│   ├── content/         # Craft showcases & digital library notes
│   ├── data/            # Canonical typed single source of truth
│   ├── layouts/         # Base Page and Note layouts
│   ├── lib/             # Markdown plugins, JSON-LD, utilities
│   ├── pages/           # Static routes & JSON endpoints
│   ├── scripts/         # Client-side progressive enhancement
│   └── styles/          # OKLCH tokens, global styles, prose system
├── DESIGN.md            # Visual and interaction design specification
└── astro.config.mjs     # Build and markdown pipeline configuration
```

---

## Security

- Hardened HTTP security headers (HSTS, strict CSP, Permissions-Policy) enforced via `public/_headers`.
- RFC 9421 HTTP Message Signatures support for verified agent interaction.
- Bounded payload ingestion (64 KiB) across edge protocols.
- Security disclosures and vulnerability reporting via `/.well-known/security.txt`.

---

## License

[MIT](LICENSE) © Ashwin Gopalsamy
