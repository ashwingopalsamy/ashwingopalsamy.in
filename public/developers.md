# Ashwin Gopalsamy · Developer Resources & API Documentation

APIs, OpenAPI 3.1.0 specification, Model Context Protocol (MCP) server, official multi-language SDK packages (npm, PyPI, Go, RubyGems), and integration guides for developers and AI agents.

## Open Access & Sandbox

All read-only REST and agent interfaces on `ashwingopalsamy.in` operate with zero onboarding friction. No API keys, payment methods, or authentication credentials are required for standard discovery.

The live endpoints serve as an open sandbox environment returning deterministic, authoritative data.

## Official Multi-Language SDKs

Official client packages auto-generated and validated against the OpenAPI 3.1.0 specification, featuring verified package homepages pointing to `https://ashwingopalsamy.in/developers`:

### TypeScript / JavaScript (npm)

```bash
npm install @ashwingopalsamy/sdk
```

```typescript
import { AshwinGopalsamyClient } from "@ashwingopalsamy/sdk";

const client = new AshwinGopalsamyClient();
const profile = await client.getProfile();
const results = await client.searchSite("rate limiters", 5);
```

### Python (PyPI)

```bash
pip install ashwingopalsamy
```

```python
from ashwingopalsamy import Client

client = Client()
profile = client.get_profile()
results = client.search_site("rate limiters", limit=5)
```

### Go (Go Modules)

```bash
go get github.com/ashwingopalsamy/ashwingopalsamy.in/packages/go
```

```go
import ashwingopalsamy "github.com/ashwingopalsamy/ashwingopalsamy.in/packages/go"

client := ashwingopalsamy.NewClient()
profile, err := client.GetProfile(ctx)
results, err := client.SearchSite(ctx, "rate limiters", 5)
```

### Ruby (RubyGems)

```bash
gem install ashwingopalsamy
```

```ruby
require "ashwingopalsamy"

client = AshwinGopalsamy::Client.new
profile = client.get_profile
results = client.search_site("rate limiters", limit: 5)
```

## Official CLI Tool (ashwingopalsamy)

Script interactions with Ashwin Gopalsamy's profile, notes, and search index directly from your terminal or automation pipeline:

### NPX / NPM

```bash
npx ashwingopalsamy profile
npx ashwingopalsamy search "rate limiters"
npx ashwingopalsamy content note --limit 5
npx ashwingopalsamy note designing-rate-limiters-for-payment-systems
npx ashwingopalsamy status
```

### Curl / POSIX Shell

```bash
curl -sSL https://ashwingopalsamy.in/cli.sh | sh -s -- profile
curl -sSL https://ashwingopalsamy.in/cli.sh | sh -s -- search "ISO 8583"
```

## REST v1 Endpoints

Base URL: `https://ashwingopalsamy.in/api/v1`

- `GET /api/v1/profile`: Authoritative profile summary and career history.
- `GET /api/v1/search?query={q}&limit={n}`: Search published notes, projects, and reading list entries.
- `GET /api/v1/content?kind={k}&limit={n}`: List catalog items filtered by kind (`note`, `craft`, `book`, `watch`, `all`).
- `GET /api/v1/notes/{slug}`: Retrieve raw Markdown body and metadata for a note.
- `GET /api/v1/status`: Operational status, rate limits, and capability flags.

## Protocol Interfaces (MCP & A2A)

- **Model Context Protocol (MCP)**: `https://ashwingopalsamy.in/mcp` (Streamable HTTP, legacy POST, and SSE). Inspect with `npx -y @modelcontextprotocol/inspector https://ashwingopalsamy.in/mcp`. Server card available at `/.well-known/mcp/server-card.json` and catalog at `/mcp/catalog.json`.
- **Agent-to-Agent (A2A)**: `https://ashwingopalsamy.in/a2a` (JSON-RPC 2.0 tasks and messages).

## Web Bot Authentication (RFC 9421)

Legitimate automated agents and bots can sign HTTP requests according to RFC 9421 (HTTP Message Signatures).

Ashwin Gopalsamy's public signing directory is published at `https://ashwingopalsamy.in/.well-known/http-message-signatures-directory` exposing Ed25519 JWKs with `kid`, `nbf`, and `exp` timestamps to cryptographically distinguish genuine bot agents from spoofers.

## Headers & Rate Limiting

All endpoints return standard RFC rate limiting headers and API versioning metadata:

- `RateLimit-Limit`: Maximum requests per window (120 per minute).
- `RateLimit-Remaining`: Remaining request quota.
- `RateLimit-Reset`: Seconds remaining until reset (60s window).
- `RateLimit-Policy`: Active rate limit policy window (`120;w=60`).
- `X-RateLimit-Limit / Remaining / Reset`: Legacy compatibility headers.
- `API-Version`: API release contract timestamp (e.g. `2026-08-22`).

Clients exceeding quota receive HTTP `429 Too Many Requests` with a `Retry-After` header.

## API Versioning & Deprecation Policy

- **Versioning Strategy**: Major revisions use URL paths (`/api/v1/`). Minor non-breaking additions preserve path stability.
- **Deprecation Signaling**: Deprecated surfaces emit the RFC 9594 `Deprecation` header and RFC 8594 `Sunset` header with the retirement timestamp.
- **Grace Period**: Breaking changes are announced minimum 6 months prior to retirement.

## Typed Error Model (RFC 9457)

All error responses return structured `application/problem+json`:

```json
{
  "type": "https://ashwingopalsamy.in/developers#errors",
  "title": "Resource Not Found",
  "status": 404,
  "detail": "Note slug 'non-existent' was not found in published index.",
  "code": "note_not_found",
  "resolution_hint": "Check /api/v1/content?kind=note for a complete list of valid note slugs."
}
```

## Security & Authentication

OAuth 2.0 protected resource metadata is published at `/.well-known/oauth-protected-resource` and `/auth.md`. All discovery endpoints allow unauthenticated read-only access.

## Machine Discovery Reference

- OpenAPI 3.1.0: `https://ashwingopalsamy.in/openapi.json`
- LLM Context: `https://ashwingopalsamy.in/llms.txt` and `https://ashwingopalsamy.in/llms-full.txt`
- Web Bot Auth Directory: `https://ashwingopalsamy.in/.well-known/http-message-signatures-directory`
- MCP Server Card: `https://ashwingopalsamy.in/.well-known/mcp/server-card.json`
- Agent Guide: `https://ashwingopalsamy.in/.well-known/agents.md`
- AI Catalog: `https://ashwingopalsamy.in/.well-known/ai-catalog.json`
- Knowledge Dump: `https://ashwingopalsamy.in/knowledge.json`

