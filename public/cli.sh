#!/bin/sh
set -e

API_BASE="${ASHWIN_API_BASE:-https://ashwingopalsamy.in}"

case "$1" in
  profile)
    curl -sSL -H "Accept: application/json" "${API_BASE}/api/v1/profile"
    ;;
  search)
    shift
    QUERY="$*"
    if [ -z "$QUERY" ]; then
      echo "Error: search query required. Example: curl -sSL https://ashwingopalsamy.in/cli.sh | sh -s -- search 'rate limiters'" >&2
      exit 1
    fi
    curl -sSL -G --data-urlencode "query=${QUERY}" -H "Accept: application/json" "${API_BASE}/api/v1/search"
    ;;
  content)
    KIND="${2:-all}"
    curl -sSL -H "Accept: application/json" "${API_BASE}/api/v1/content?kind=${KIND}"
    ;;
  note)
    SLUG="$2"
    if [ -z "$SLUG" ]; then
      echo "Error: note slug required. Example: curl -sSL https://ashwingopalsamy.in/cli.sh | sh -s -- note designing-rate-limiters-for-payment-systems" >&2
      exit 1
    fi
    curl -sSL "${API_BASE}/blog/${SLUG}.md"
    ;;
  status)
    curl -sSL -H "Accept: application/json" "${API_BASE}/api/v1/status"
    ;;
  openapi)
    curl -sSL "${API_BASE}/openapi.json"
    ;;
  mcp)
    curl -sSL -H "Accept: application/json" "${API_BASE}/mcp/status.json"
    ;;
  *)
    echo "ashwingopalsamy CLI runner (POSIX shell)"
    echo "Usage: curl -sSL https://ashwingopalsamy.in/cli.sh | sh -s -- <command> [args]"
    echo ""
    echo "Commands:"
    echo "  profile              Get verified career profile"
    echo "  search <query>       Search published notes and projects"
    echo "  content [kind]       List content (note, craft, book, watch, all)"
    echo "  note <slug>          Fetch raw note Markdown"
    echo "  status               Check API operational status"
    echo "  openapi              Output OpenAPI 3.1.0 specification"
    echo "  mcp                  Show MCP server status"
    ;;
esac
