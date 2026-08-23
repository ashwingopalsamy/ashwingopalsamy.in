#!/usr/bin/env node

const API_BASE = process.env.ASHWIN_API_BASE || "https://ashwingopalsamy.in";
const VERSION = "1.0.0";

const HELP_TEXT = `
ashwingopalsamy CLI - Official command-line interface for ashwingopalsamy.in

Usage:
  ashwingopalsamy <command> [options]
  npx ashwingopalsamy <command> [options]

Commands:
  profile              Fetch authoritative profile summary and career facts
  search <query>       Search technical notes, projects, and reading list
  content [kind]       List published content (note, craft, book, watch, all)
  note <slug>          Retrieve raw Markdown for a published note
  status               Check API operational status, rate limits, and capabilities
  openapi              Output the OpenAPI 3.1.0 specification
  mcp                  Display Model Context Protocol server configuration
  help, --help, -h     Show this help message
  version, --version   Show CLI version

Options:
  --json               Output raw JSON format
  --limit <n>          Maximum results to return (1-50, default: 10)

Examples:
  npx ashwingopalsamy profile
  npx ashwingopalsamy search "rate limiters"
  npx ashwingopalsamy content note --limit 5
  npx ashwingopalsamy note designing-rate-limiters-for-payment-systems
  npx ashwingopalsamy status
`.trim();

async function requestJson(path) {
  const url = new URL(path, API_BASE);
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": `ashwingopalsamy-cli/${VERSION}`,
    },
  });
  if (!response.ok) {
    const errorText = await response.text();
    let parsed;
    try {
      parsed = JSON.parse(errorText);
    } catch {
      parsed = null;
    }
    const message = parsed?.detail || parsed?.message || parsed?.error || `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(message);
  }
  return response.json();
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const flags = { json: false, limit: 10 };
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--json") {
      flags.json = true;
    } else if (arg === "--limit" && i + 1 < args.length) {
      flags.limit = parseInt(args[++i], 10) || 10;
    } else if (arg === "--version" || arg === "-v") {
      return { command: "version", flags, positional: [] };
    } else if (arg === "--help" || arg === "-h") {
      return { command: "help", flags, positional: [] };
    } else if (!arg.startsWith("--")) {
      positional.push(arg);
    }
  }

  const command = positional[0] || "help";
  return { command, flags, positional: positional.slice(1) };
}

async function main() {
  const { command, flags, positional } = parseArgs(process.argv);

  try {
    switch (command) {
      case "help":
        console.log(HELP_TEXT);
        break;

      case "version":
        console.log(`ashwingopalsamy CLI v${VERSION}`);
        break;

      case "profile": {
        const data = await requestJson("/api/v1/profile");
        if (flags.json) {
          console.log(JSON.stringify(data, null, 2));
        } else {
          console.log(`${data.name}`);
          console.log(`${data.role} at ${data.employer}`);
          console.log(`Location: ${data.location}`);
          console.log(`Primary Language: ${data.primaryLanguage}`);
          console.log(`\n${data.summary}`);
        }
        break;
      }

      case "search": {
        const query = positional.join(" ").trim();
        if (!query) {
          console.error("Error: Search query required. Example: ashwingopalsamy search 'rate limiters'");
          process.exit(1);
        }
        const data = await requestJson(`/api/v1/search?query=${encodeURIComponent(query)}&limit=${flags.limit}`);
        if (flags.json) {
          console.log(JSON.stringify(data, null, 2));
        } else {
          console.log(`Search results for "${data.query}" (${data.total} found):\n`);
          if (data.results.length === 0) {
            console.log("No matching items found.");
          } else {
            data.results.forEach((r, idx) => {
              console.log(`${idx + 1}. [${r.kind.toUpperCase()}] ${r.title}`);
              if (r.description) console.log(`   ${r.description}`);
              console.log(`   ${API_BASE}${r.href}\n`);
            });
          }
        }
        break;
      }

      case "content": {
        const kind = positional[0] || "all";
        const data = await requestJson(`/api/v1/content?kind=${encodeURIComponent(kind)}&limit=${flags.limit}`);
        if (flags.json) {
          console.log(JSON.stringify(data, null, 2));
        } else {
          console.log(`Content items (${data.kind}, ${data.count} returned):\n`);
          data.items.forEach((item, idx) => {
            console.log(`${idx + 1}. [${item.kind.toUpperCase()}] ${item.title}`);
            if (item.description) console.log(`   ${item.description}`);
            console.log(`   ${API_BASE}${item.href}\n`);
          });
        }
        break;
      }

      case "note": {
        const slug = positional[0];
        if (!slug) {
          console.error("Error: Note slug required. Example: ashwingopalsamy note designing-rate-limiters-for-payment-systems");
          process.exit(1);
        }
        const data = await requestJson(`/api/v1/notes/${encodeURIComponent(slug)}`);
        if (flags.json) {
          console.log(JSON.stringify(data, null, 2));
        } else {
          console.log(data.markdown);
        }
        break;
      }

      case "status": {
        const data = await requestJson("/api/v1/status");
        if (flags.json) {
          console.log(JSON.stringify(data, null, 2));
        } else {
          console.log(`Service: ${data.service}`);
          console.log(`Status: ${data.status}`);
          console.log(`Version: ${data.version} (API-Version: ${data.apiVersion})`);
          console.log(`Rate Limit: ${data.rateLimit?.policy || "120;w=60"}`);
          console.log(`Deprecation Policy: ${data.versioning?.deprecationPolicy || "Standard RFC 8594 Sunset notices."}`);
        }
        break;
      }

      case "openapi": {
        const data = await requestJson("/openapi.json");
        console.log(JSON.stringify(data, null, 2));
        break;
      }

      case "mcp": {
        const data = await requestJson("/mcp/status.json");
        if (flags.json) {
          console.log(JSON.stringify(data, null, 2));
        } else {
          console.log("Model Context Protocol (MCP) Server Configuration:\n");
          console.log(`Endpoint: ${API_BASE}/mcp`);
          console.log(`Transport: ${data.transport?.type || "streamable-http"}`);
          console.log(`Status: ${data.status}`);
          console.log(`Catalog: ${API_BASE}/mcp/catalog.json`);
          console.log(`\nTo inspect using MCP inspector:`);
          console.log(`  npx -y @modelcontextprotocol/inspector ${API_BASE}/mcp`);
        }
        break;
      }

      default:
        console.error(`Unknown command: ${command}\n`);
        console.log(HELP_TEXT);
        process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
