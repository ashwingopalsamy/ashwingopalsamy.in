import { z } from "zod";
import {
  CANONICAL_MCP_DISCOVERY,
  CANONICAL_PROMPTS,
  CANONICAL_PUBLIC_DATA,
  CANONICAL_RESOURCES,
  CAPABILITY_ANNOTATIONS,
  CAPABILITY_DESCRIPTION,
  CAPABILITY_PROTOCOL_VERSION,
  CAPABILITY_SERVER_INFO,
  TOOL_SCHEMAS,
} from "../src/lib/canonical-capabilities";
import { origin } from "./_site-data";

export const MCP_SERVER_INFO = CAPABILITY_SERVER_INFO;
export const MCP_PROTOCOL_VERSION = CAPABILITY_PROTOCOL_VERSION;
export const MCP_DESCRIPTION = CAPABILITY_DESCRIPTION;
export const MCP_ENDPOINT = `${origin()}/mcp`;
export const MCP_ANNOTATIONS = CAPABILITY_ANNOTATIONS;

export const MCP_TOOLS = {
  searchSite: {
    name: TOOL_SCHEMAS.searchSite.name,
    description: TOOL_SCHEMAS.searchSite.description,
    inputSchema: TOOL_SCHEMAS.searchSite.zodSchema,
    annotations: TOOL_SCHEMAS.searchSite.annotations,
  },
  getProfile: {
    name: TOOL_SCHEMAS.getProfile.name,
    description: TOOL_SCHEMAS.getProfile.description,
    inputSchema: TOOL_SCHEMAS.getProfile.zodSchema,
    annotations: TOOL_SCHEMAS.getProfile.annotations,
  },
  listContent: {
    name: TOOL_SCHEMAS.listContent.name,
    description: TOOL_SCHEMAS.listContent.description,
    inputSchema: TOOL_SCHEMAS.listContent.zodSchema,
    annotations: TOOL_SCHEMAS.listContent.annotations,
  },
  getNoteMarkdown: {
    name: TOOL_SCHEMAS.getNoteMarkdown.name,
    description: TOOL_SCHEMAS.getNoteMarkdown.description,
    inputSchema: TOOL_SCHEMAS.getNoteMarkdown.zodSchema,
    annotations: TOOL_SCHEMAS.getNoteMarkdown.annotations,
  },
} as const;

export const MCP_RESOURCES = CANONICAL_RESOURCES;
export const MCP_PROMPTS = CANONICAL_PROMPTS;
export const MCP_DISCOVERY = CANONICAL_MCP_DISCOVERY;
export const MCP_PUBLIC_DATA = CANONICAL_PUBLIC_DATA;

function schemaFor(schema: z.ZodType): object {
  return z.toJSONSchema(schema) as object;
}

export function createMcpCatalog() {
  return {
    schemaVersion: "1.0",
    serverInfo: MCP_SERVER_INFO,
    description: MCP_DESCRIPTION,
    protocolVersion: MCP_PROTOCOL_VERSION,
    transport: {
      type: "streamable-http",
      endpoint: MCP_ENDPOINT,
      requestMethod: "POST",
      stateless: true,
      responseMode: "json",
    },
    mode: {
      readOnly: true,
      stateless: true,
      sessions: false,
      accounts: false,
      payments: false,
    },
    capabilities: {
      tools: true,
      resources: true,
      prompts: true,
    },
    discovery: MCP_DISCOVERY,
    tools: Object.values(MCP_TOOLS).map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: schemaFor(tool.inputSchema),
      annotations: tool.annotations,
    })),
    resources: MCP_RESOURCES,
    prompts: Object.values(MCP_PROMPTS).map((prompt) => ({
      name: prompt.name,
      title: prompt.title,
      description: prompt.description,
      argsSchema: schemaFor(prompt.argsSchema),
    })),
    data: MCP_PUBLIC_DATA,
  };
}

export function createMcpStatus() {
  return {
    service: "mcp",
    status: "ready",
    protocolVersion: MCP_PROTOCOL_VERSION,
    transport: {
      type: "streamable-http",
      endpoint: MCP_ENDPOINT,
      method: "POST",
    },
    mode: {
      readOnly: true,
      stateless: true,
    },
    discovery: MCP_DISCOVERY,
    data: MCP_PUBLIC_DATA,
  };
}

export function appendMcpDiscoveryLinks(headers: Headers): Headers {
  headers.append("Link", `<${MCP_DISCOVERY.serverCard}>; rel=\"service-desc\"; type=\"application/json\"`);
  headers.append("Link", `<${MCP_DISCOVERY.legacyManifest}>; rel=\"alternate\"; type=\"application/json\"`);
  headers.append("Link", `<${MCP_DISCOVERY.catalog}>; rel=\"describedby\"; type=\"application/json\"`);
  return headers;
}

export function applyMcpCors(headers: Headers, exposeSession = false): Headers {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Expose-Headers", exposeSession ? "Mcp-Session-Id, Link" : "Link");
  return headers;
}
