# auth.md

The public interfaces of this site need no authentication. There are no
accounts, API keys, tokens, or sign-in flows, and none are issued.

## Audience

Agents reading this document can use the public site and its read-only
interfaces directly. No authenticated write API is offered.

## Open interfaces

- Pages and their Markdown mirrors.
- REST v1: `/api/v1/...`
- MCP: `/mcp`
- A2A: `/a2a`
- Discovery documents under `/.well-known/`.

All of these are read-only and open. Send requests without credentials.

## Not offered

- Registration, credential issuance, claims, or revocation.
- OAuth or OpenID Connect.
- Authenticated writes or payments.

## Discovery

- OpenAPI 3.1.0 specification: `/openapi.json`
- Developer resources: `/developers`
