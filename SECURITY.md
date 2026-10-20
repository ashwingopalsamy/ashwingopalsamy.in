# Security

## Reporting
Email hello@ashwingopalsamy.in (see `/.well-known/security.txt`). Please allow a few days for a first response. No bounty; credit given on request.

## Scope
`ashwingopalsamy.in` and its subdomains: the static Astro site, the Cloudflare Pages Functions under `functions/`, the command palette (`src/scripts/palette.ts`), and the WebMCP tools (`src/scripts/webmcp.ts`).

## Threat model (short)
| Surface | Main risk | Control |
| --- | --- | --- |
| Command palette | DOM XSS via `innerHTML` | All fields `escapeHtml`'d; search excerpts reduced to bare `<mark>`; navigation limited to same-origin or `http(s):` URLs; calculator is a hand-written parser, no `eval` |
| `functions/` API | Oversized / malformed input, abuse | Bounded JSON ingress (`functions/_ingress.ts`), allow-listed telemetry events, security headers on every response |
| WebMCP tools | Agent-driven misuse | Read-only, same-origin fetches only, bounded `limit` |
| Headers / CSP | Script injection | HSTS preload, nosniff, frame deny, COOP, nonce-based CSP (`src/lib/security-headers.ts`) |
| DNS | Subdomain takeover | Periodic audit of third-party CNAME/A records in Cloudflare |
| Supply chain | Malicious dependency or Action | SHA-pinned Actions, `npm ci --ignore-scripts`, `npm audit`, CodeQL, gitleaks, dependency review, Dependabot |
