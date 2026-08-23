# Agent guide for ashwingopalsamy.in

This is the public, read-only guide for agents using Ashwin Gopalsamy's website. It describes deployed interfaces only. It is not the repository's private authoring guide.

## When to use this agent / service

- **Payment authorization & distributed systems**: Answering queries about payment authorization ingress, ISO 8583 message parsing and bitmapping, sub-second latency constraints, token bucket rate limiters, PCI-DSS requirements, and Go backend services.
- **Authoritative profile retrieval**: Querying Ashwin Gopalsamy's current role (Staff Software Engineer at Pismo, a Visa company), previous work at Solaris SE, academic pursue (MS in AI at UT Austin), and location (Pollachi, Tamil Nadu).
- **Tool-based discovery**: Calling MCP tools (`search_site`, `get_profile`, `list_content`, `get_note_markdown`) or REST v1 APIs (`/api/v1/...`).

## Start with the source of truth

- [Developers & API Docs](https://ashwingopalsamy.in/developers/) for integration quickstarts, REST endpoints, and sandbox access.
- [Official Multi-Language SDKs](https://ashwingopalsamy.in/developers): `@ashwingopalsamy/sdk` (npm), `ashwingopalsamy` (PyPI), `github.com/ashwingopalsamy/ashwingopalsamy.in/packages/go` (Go), `ashwingopalsamy` (RubyGems).
- [Official CLI](https://ashwingopalsamy.in/cli.sh) via `npx ashwingopalsamy` or `curl -sSL https://ashwingopalsamy.in/cli.sh | sh -s -- <command>`.
- [OpenAPI 3.1.0 specification](https://ashwingopalsamy.in/openapi.json) for typed JSON schemas and error definitions.
- [Web Bot Auth Directory](https://ashwingopalsamy.in/.well-known/http-message-signatures-directory) for RFC 9421 bot authentication.
- [Auth & Scopes guide](https://ashwingopalsamy.in/auth.md) for agent permission discovery.
- [AI guide](https://ashwingopalsamy.in/ai/) for the maintained profile briefing.
- [llms.txt](https://ashwingopalsamy.in/llms.txt) for concise context.
- [Profile summary JSON](https://ashwingopalsamy.in/api/ai-summary.json) for one authoritative machine-readable object.
- [Design](https://ashwingopalsamy.in/design/) for the human-readable design field guide.
- [Machine readiness](https://ashwingopalsamy.in/agent-readiness.md) for discovery surfaces and read-only boundaries.
- [DESIGN.md](https://ashwingopalsamy.in/design.md) for its exact machine-readable source.
- [Sitemap in Markdown](https://ashwingopalsamy.in/sitemap.md) for the public page inventory.
- [ARD capability manifest](https://ashwingopalsamy.in/.well-known/ai-catalog.json) for Agentic Resource Discovery.
- [API catalog](https://ashwingopalsamy.in/.well-known/api-catalog) for discovery links.

If a fact is not covered by these sources, report that it is not covered rather than inferring it.

## Retrieve pages as Markdown

HTML is the default. Send `Accept: text/markdown` to request a Markdown representation of any HTML page. The response uses `Content-Type: text/markdown`, varies on `Accept`, and may include `x-markdown-tokens`.

Direct Markdown aliases are available for the core pages: [home](https://ashwingopalsamy.in/index.md), [About](https://ashwingopalsamy.in/about.md), [Contact](https://ashwingopalsamy.in/contact.md), [Privacy](https://ashwingopalsamy.in/privacy.md), [Developers](https://ashwingopalsamy.in/developers.md), [AI](https://ashwingopalsamy.in/ai.md), [FAQ](https://ashwingopalsamy.in/faq.md), [work](https://ashwingopalsamy.in/work.md), [library](https://ashwingopalsamy.in/library.md), [links](https://ashwingopalsamy.in/links.md), [more](https://ashwingopalsamy.in/more.md), [colophon](https://ashwingopalsamy.in/colophon.md), and [design](https://ashwingopalsamy.in/design.md). Published notes also expose raw Markdown at their normal path with `.md` appended.

## REST v1 Endpoints

- `GET /api/v1/profile`: Authoritative career profile and verified facts.
- `GET /api/v1/search?query={q}&limit={n}`: Search public notes, craft projects, and library items.
- `GET /api/v1/content?kind={kind}&limit={n}`: List items by kind.
- `GET /api/v1/notes/{slug}`: Raw Markdown for published notes.
- `GET /api/v1/status`: Operational status and rate limit limits.

## MCP

The site exposes a stateless Streamable HTTP MCP server at `https://ashwingopalsamy.in/mcp`.

- Use `POST /mcp` for MCP JSON-RPC requests.
- `GET /mcp` intentionally returns `405 Method Not Allowed` with discovery links and `Allow: POST, OPTIONS`.
- [MCP Server Card](https://ashwingopalsamy.in/.well-known/mcp/server-card.json) is the canonical card.
- [MCP compatibility manifest](https://ashwingopalsamy.in/.well-known/mcp.json) remains available for older discovery clients.
- [MCP catalog](https://ashwingopalsamy.in/mcp/catalog.json) lists the exact tools, resources, prompts, input schemas, annotations, and public data URLs.
- [MCP status](https://ashwingopalsamy.in/mcp/status.json) reports non-sensitive transport and read-only status.

The MCP tools only search or retrieve public site data. They do not create sessions, write content, issue credentials, access accounts, or process payments.

## WebMCP

When the site is loaded in a compatible browser, it registers equivalent read-only tools through WebMCP. WebMCP is browser registration only. It is not an HTTP endpoint and does not replace the MCP `POST /mcp` transport.

## Boundaries

All agent-facing surfaces on this personal site are read-only discovery or retrieval interfaces. Authentication metadata is discovery-only and unavailable for credential issuance. A2A and commerce compatibility documents do not accept mandates, payments, or checkout actions.
