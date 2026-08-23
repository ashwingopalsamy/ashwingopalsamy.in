# auth.md

This service publishes OAuth and OpenID Connect discovery metadata for agent
compatibility. It is a discovery-only surface and does not create accounts,
issue credentials, or accept registration.

## Audience

Agents reading this document can use the public site and its read-only discovery
interfaces. No authenticated write API is offered.

## Scopes and permissions

The following OAuth 2.0 permission scopes are defined across the discovery metadata:

- `site.read`: Full read-only access to Ashwin Gopalsamy's public profile and library content.
- `profile.read`: Read authoritative profile facts and career history.
- `content.search`: Search technical notes, books, and craft articles.
- `notes.read`: Retrieve raw markdown for published notes.

All discovery endpoints allow open, unauthenticated read-only access by default.

## Free tier and sandbox

All read-only REST and agent interfaces operate without payment or credential requirements.
Endpoints at `/api/v1/...`, `/mcp`, and `/a2a` serve as an open sandbox with deterministic responses.

## Discovery

- Protected resource metadata: `/.well-known/oauth-protected-resource`
- Authorization server metadata: `/.well-known/oauth-authorization-server`
- OpenID Connect metadata: `/.well-known/openid-configuration`
- JSON Web Key Set: `/.well-known/jwks.json`
- OpenAPI 3.1.0 specification: `/openapi.json`
- Developer resources: `/developers`

## Registration and credentials

`/agent/auth`, `/agent/auth/claim`, `/agent/auth/revoke`, and
`/oauth/authorize` return a standard unavailable error. The token endpoint
returns `temporarily_unavailable`. These endpoints never create accounts,
issue credentials, claim identities, revoke credentials, or persist
registration data.

The advertised registration method is `oauth-authorization-code` at
`/agent/auth`, with status `unavailable`.

## Identity assertion

The metadata advertises ID-JAG and verified-email assertion formats for
discovery compatibility only. Neither format can be registered, exchanged,
claimed, or used to obtain a credential on this service.

## ID-JAG

The ID-JAG identity-assertion flow is published for discovery compatibility.
This service does not issue identity assertions, credentials, or revocations.

## Verified email

The verified-email identity-assertion flow is published for discovery
compatibility. This service does not verify email addresses or issue credentials.

## Anonymous

The anonymous flow is published for discovery compatibility. This service does
not provision anonymous credentials or persist agent registrations.
