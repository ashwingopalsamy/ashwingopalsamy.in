import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import {
  appendMcpDiscoveryLinks,
  applyMcpCors,
  MCP_ANNOTATIONS,
  MCP_PROMPTS,
  MCP_RESOURCES,
  MCP_SERVER_INFO,
  MCP_TOOLS,
} from "../_mcp-catalog";
import {
  getNoteMarkdown,
  getPalette,
  getProfile,
  listContent,
  searchSite,
} from "../_site-data";
import type { RuntimeEnv } from "../_site-data";
import { applySecurityHeaders } from "../../src/lib/security-headers";
import { applyRateLimitHeaders } from "../_unavailable";
import { MAX_BODY_BYTES } from "../_ingress";

interface PagesContext {
  request: Request;
  env: RuntimeEnv;
  waitUntil?: (promise: Promise<unknown>) => void;
}

function textResult(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
    structuredContent: value,
  };
}

import { getDeploymentSha, recordToAnalyticsEngine } from "../_telemetry";

function recordMcpOp(
  env: RuntimeEnv,
  op: string,
  target: string,
  success: boolean,
  durationMs: number,
  resultCount = 1,
) {
  recordToAnalyticsEngine(env.SITE_TELEMETRY, {
    eventType: "mcp_protocol_op",
    surface: "mcp",
    route: "/mcp",
    method: "POST",
    statusCode: success ? 200 : 500,
    representation: "json",
    clientClass: "agent_tool",
    crawlerName: "mcp_client",
    crawlerOperator: "unknown",
    country: "XX",
    colo: "UNKNOWN",
    referrerHost: "direct",
    protocolOp: op,
    targetName: target,
    success,
    deploymentSha: getDeploymentSha(env),
    correlationId: "mcp",
    durationMs,
    resultCount,
  });
}

function createServer(env: RuntimeEnv, requestUrl: string) {
  const server = new McpServer(MCP_SERVER_INFO);

  server.registerTool(
    MCP_TOOLS.searchSite.name,
    {
      description: MCP_TOOLS.searchSite.description,
      inputSchema: MCP_TOOLS.searchSite.inputSchema,
      annotations: MCP_TOOLS.searchSite.annotations,
    },
    async ({ query, limit }) => {
      const t0 = performance.now();
      try {
        const results = await searchSite(query, limit, env, requestUrl);
        recordMcpOp(env, "tools/call", MCP_TOOLS.searchSite.name, true, performance.now() - t0, results.length);
        return textResult(results);
      } catch (err) {
        recordMcpOp(env, "tools/call", MCP_TOOLS.searchSite.name, false, performance.now() - t0, 0);
        throw err;
      }
    },
  );

  server.registerTool(
    MCP_TOOLS.getProfile.name,
    {
      description: MCP_TOOLS.getProfile.description,
      inputSchema: MCP_TOOLS.getProfile.inputSchema,
      annotations: MCP_TOOLS.getProfile.annotations,
    },
    async () => {
      const t0 = performance.now();
      try {
        const profile = await getProfile(env, requestUrl);
        recordMcpOp(env, "tools/call", MCP_TOOLS.getProfile.name, true, performance.now() - t0, 1);
        return textResult(profile);
      } catch (err) {
        recordMcpOp(env, "tools/call", MCP_TOOLS.getProfile.name, false, performance.now() - t0, 0);
        throw err;
      }
    },
  );

  server.registerTool(
    MCP_TOOLS.listContent.name,
    {
      description: MCP_TOOLS.listContent.description,
      inputSchema: MCP_TOOLS.listContent.inputSchema,
      annotations: MCP_TOOLS.listContent.annotations,
    },
    async ({ kind, limit }) => {
      const t0 = performance.now();
      try {
        const items = await listContent(kind, limit, env, requestUrl);
        recordMcpOp(env, "tools/call", MCP_TOOLS.listContent.name, true, performance.now() - t0, items.length);
        return textResult(items);
      } catch (err) {
        recordMcpOp(env, "tools/call", MCP_TOOLS.listContent.name, false, performance.now() - t0, 0);
        throw err;
      }
    },
  );

  server.registerTool(
    MCP_TOOLS.getNoteMarkdown.name,
    {
      description: MCP_TOOLS.getNoteMarkdown.description,
      inputSchema: MCP_TOOLS.getNoteMarkdown.inputSchema,
      annotations: MCP_TOOLS.getNoteMarkdown.annotations,
    },
    async ({ slug }) => {
      const t0 = performance.now();
      try {
        const markdown = await getNoteMarkdown(slug, env, requestUrl);
        const ok = markdown !== null;
        recordMcpOp(env, "tools/call", MCP_TOOLS.getNoteMarkdown.name, ok, performance.now() - t0, ok ? 1 : 0);
        return textResult(markdown === null ? { error: "note_not_found" } : { slug, markdown });
      } catch (err) {
        recordMcpOp(env, "tools/call", MCP_TOOLS.getNoteMarkdown.name, false, performance.now() - t0, 0);
        throw err;
      }
    },
  );

  const profileResource = MCP_RESOURCES[0];
  server.registerResource(
    profileResource.name,
    profileResource.uri,
    {
      title: profileResource.title,
      description: profileResource.description,
      mimeType: profileResource.mimeType,
    },
    async (uri) => {
      const t0 = performance.now();
      try {
        const profile = await getProfile(env, requestUrl);
        recordMcpOp(env, "resources/read", profileResource.uri, true, performance.now() - t0, 1);
        return {
          contents: [{ uri: uri.href, mimeType: profileResource.mimeType, text: JSON.stringify(profile) }],
        };
      } catch (err) {
        recordMcpOp(env, "resources/read", profileResource.uri, false, performance.now() - t0, 0);
        throw err;
      }
    },
  );

  const contentResource = MCP_RESOURCES[1];
  server.registerResource(
    contentResource.name,
    contentResource.uri,
    {
      title: contentResource.title,
      description: contentResource.description,
      mimeType: contentResource.mimeType,
    },
    async (uri) => {
      const t0 = performance.now();
      try {
        const palette = await getPalette(env, requestUrl);
        recordMcpOp(env, "resources/read", contentResource.uri, true, performance.now() - t0, palette.content.length);
        return {
          contents: [{ uri: uri.href, mimeType: contentResource.mimeType, text: JSON.stringify(palette) }],
        };
      } catch (err) {
        recordMcpOp(env, "resources/read", contentResource.uri, false, performance.now() - t0, 0);
        throw err;
      }
    },
  );

  server.registerPrompt(
    MCP_PROMPTS.profileBriefing.name,
    {
      title: MCP_PROMPTS.profileBriefing.title,
      description: MCP_PROMPTS.profileBriefing.description,
      argsSchema: MCP_PROMPTS.profileBriefing.argsSchema,
    },
    async ({ focus }) => {
      const t0 = performance.now();
      recordMcpOp(env, "prompts/get", MCP_PROMPTS.profileBriefing.name, true, performance.now() - t0, 1);
      return {
        messages: [
          {
            role: "user" as const,
            content: {
              type: "text" as const,
              text: `Use the authoritative profile resource to prepare a concise briefing${focus ? ` focused on ${focus}` : ""}. Do not infer facts that are not present.`,
            },
          },
        ],
      };
    },
  );

  return server;
}

function methodNotAllowed(): Response {
  let headers = applySecurityHeaders(new Headers(), "json-api-public");
  headers = applyRateLimitHeaders(headers);
  headers = applyMcpCors(appendMcpDiscoveryLinks(headers));
  headers.set("Allow", "POST, OPTIONS");
  return new Response(null, { status: 405, headers });
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  if (context.request.method === "OPTIONS") {
    let headers = applySecurityHeaders(new Headers(), "json-api-public");
    headers = applyMcpCors(appendMcpDiscoveryLinks(headers));
    headers.set("Allow", "POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization, MCP-Protocol-Version, Mcp-Session-Id, Mcp-Method, Mcp-Name");
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    return new Response(null, { status: 204, headers });
  }

  if (context.request.method !== "POST") return methodNotAllowed();

  const contentLengthHeader = context.request.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number.parseInt(contentLengthHeader, 10);
    if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
      let headers = applySecurityHeaders(new Headers(), "json-api-public");
      headers = applyMcpCors(appendMcpDiscoveryLinks(headers));
      headers.set("Content-Type", "application/json; charset=utf-8");
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32600, message: `Payload too large. Maximum size is ${MAX_BODY_BYTES} bytes.` },
        }) + "\n",
        { status: 413, headers },
      );
    }
  }

  // Stream reader with 64 KiB hard cap
  let bodyBuffer: Uint8Array | null = null;
  if (context.request.body) {
    const reader = context.request.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.byteLength;
          if (totalBytes > MAX_BODY_BYTES) {
            await reader.cancel("Payload exceeded maximum allowed size");
            let headers = applySecurityHeaders(new Headers(), "json-api-public");
            headers = applyMcpCors(appendMcpDiscoveryLinks(headers));
            headers.set("Content-Type", "application/json; charset=utf-8");
            return new Response(
              JSON.stringify({
                jsonrpc: "2.0",
                id: null,
                error: { code: -32600, message: `Payload too large. Maximum size is ${MAX_BODY_BYTES} bytes.` },
              }) + "\n",
              { status: 413, headers },
            );
          }
          chunks.push(value);
        }
      }
    } catch {
      let headers = applySecurityHeaders(new Headers(), "json-api-public");
      headers = applyMcpCors(appendMcpDiscoveryLinks(headers));
      headers.set("Content-Type", "application/json; charset=utf-8");
      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: "Error reading request stream" },
        }) + "\n",
        { status: 400, headers },
      );
    }

    bodyBuffer = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bodyBuffer.set(chunk, offset);
      offset += chunk.byteLength;
    }
  }

  const handler = createMcpHandler(
    ({ requestInfo }) => createServer(context.env, requestInfo?.url ?? context.request.url),
    {
      responseMode: "json",
      legacy: "stateless",
    },
  );

  const requestHeaders = new Headers(context.request.headers);
  const accept = requestHeaders.get("Accept")?.toLowerCase() ?? "";
  if (!accept.includes("application/json") || !accept.includes("text/event-stream")) {
    requestHeaders.set("Accept", "application/json, text/event-stream");
  }

  const boundedRequest = new Request(context.request.url, {
    method: "POST",
    headers: requestHeaders,
    body: bodyBuffer,
  });

  const response = await handler.fetch(boundedRequest);
  let headers = applySecurityHeaders(new Headers(response.headers), "json-api-public");
  headers = applyRateLimitHeaders(headers);
  headers = applyMcpCors(appendMcpDiscoveryLinks(headers), true);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
