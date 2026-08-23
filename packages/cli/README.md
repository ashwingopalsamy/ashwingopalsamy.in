# ashwingopalsamy

Official command-line interface for Ashwin Gopalsamy's personal site, technical notes, and developer APIs.

## Installation / Execution

Run directly with zero installation via `npx`:

```bash
npx ashwingopalsamy profile
npx ashwingopalsamy search "rate limiters"
npx ashwingopalsamy content note --limit 5
npx ashwingopalsamy note designing-rate-limiters-for-payment-systems
npx ashwingopalsamy status
```

Or install globally:

```bash
npm install -g ashwingopalsamy
ashwingopalsamy --help
```

## Commands

- `profile`: Fetch authoritative career profile and verified background facts.
- `search <query>`: Search published technical notes, craft projects, and reading list.
- `content [kind]`: List published content items (`note`, `craft`, `book`, `watch`, `all`).
- `note <slug>`: Retrieve raw Markdown body for a published note.
- `status`: Check API operational status, rate limit policy, and capabilities.
- `openapi`: Output the complete OpenAPI 3.1.0 specification.
- `mcp`: Display Model Context Protocol (MCP) server configuration.

## Options

- `--json`: Output raw JSON response instead of formatted text.
- `--limit <n>`: Maximum number of results to return (1-50, default: 10).

## Documentation

- Developer Portal: [ashwingopalsamy.in/developers](https://ashwingopalsamy.in/developers)
- OpenAPI Specification: [ashwingopalsamy.in/openapi.json](https://ashwingopalsamy.in/openapi.json)
- Model Context Protocol: [ashwingopalsamy.in/mcp](https://ashwingopalsamy.in/mcp)

## License

MIT
