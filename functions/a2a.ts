import { readBoundedJson } from "./_ingress";
import { applySecurityHeaders } from "../src/lib/security-headers";
import { applyRateLimitHeaders } from "./_unavailable";
import { getProfile, searchSite } from "./_site-data";
import type { RuntimeEnv } from "./_site-data";

interface PagesContext {
  request: Request;
  env: RuntimeEnv;
}

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

const MAX_PARTS = 10;
const MAX_PART_LENGTH = 4096;
const MAX_QUERY_LENGTH = 1024;

function json(value: unknown, status = 200): Response {
  let headers = applySecurityHeaders(new Headers(), "json-api-public");
  headers = applyRateLimitHeaders(headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(`${JSON.stringify(value)}\n`, {
    status,
    headers,
  });
}

function taskId(id: string | number | null, method: string, textSample: string): string {
  const input = `${id ?? ""}:${method}:${textSample.slice(0, 128)}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `task-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function messageText(params: Record<string, unknown> | undefined): string {
  const message = params?.message;
  if (!message || typeof message !== "object") return "";
  const parts = (message as { parts?: unknown }).parts;
  if (!Array.isArray(parts)) return "";
  const safeParts = parts.slice(0, MAX_PARTS);
  return safeParts
    .map((part) => {
      if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") {
        return (part as { text: string }).text.slice(0, MAX_PART_LENGTH);
      }
      return "";
    })
    .join(" ")
    .trim();
}

function isAp2PaymentRequest(params: Record<string, unknown> | undefined, text: string): boolean {
  if (/(?:intent|cart|payment)[ _-]?mandate/i.test(text)) return true;
  if (text.includes("ap2") && /\b(?:payment|purchase|checkout|pay)\b/i.test(text)) return true;
  if (params && typeof params === "object") {
    const keys = Object.keys(params).slice(0, 20);
    for (const key of keys) {
      if (/payment|mandate|checkout/i.test(key)) return true;
    }
  }
  return false;
}

function completed(id: string, text: string, metadata?: Record<string, unknown>) {
  return {
    id,
    status: { state: "completed" },
    artifacts: [{ name: "result", parts: [{ kind: "text", text }] }],
    ...(metadata ? { metadata } : {}),
  };
}

function rejected(id: string, text: string) {
  return {
    id,
    status: { state: "rejected", message: { role: "agent", parts: [{ kind: "text", text }] } },
    error: { code: "unsupported_operation", message: text },
  };
}

import { getDeploymentSha, recordToAnalyticsEngine } from "./_telemetry";

function recordA2aOp(
  env: RuntimeEnv,
  op: string,
  target: string,
  success: boolean,
  durationMs: number,
  resultCount = 1,
) {
  recordToAnalyticsEngine(env.SITE_TELEMETRY, {
    eventType: "a2a_protocol_op",
    surface: "a2a",
    route: "/a2a",
    method: "POST",
    statusCode: success ? 200 : 400,
    representation: "json",
    clientClass: "agent_tool",
    crawlerName: "a2a_client",
    crawlerOperator: "unknown",
    country: "XX",
    colo: "UNKNOWN",
    referrerHost: "direct",
    protocolOp: op,
    targetName: target,
    success,
    deploymentSha: getDeploymentSha(env),
    correlationId: "a2a",
    durationMs,
    resultCount,
  });
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const startTime = performance.now();
  if (context.request.method === "OPTIONS") {
    const headers = applySecurityHeaders(new Headers(), "json-api-public");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    return new Response(null, {
      status: 204,
      headers,
    });
  }
  if (context.request.method === "GET") {
    return json({ service: "a2a", status: "ready", endpoint: "https://ashwingopalsamy.in/a2a" });
  }
  if (context.request.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const ingress = await readBoundedJson<JsonRpcRequest>(context.request);
  if (!ingress.ok) {
    return ingress.response;
  }
  const request = ingress.data;
  if (!request || typeof request !== "object") {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Invalid Request" } }, 400);
  }

  const id = request.id ?? null;
  if (request.jsonrpc !== "2.0" || typeof request.method !== "string") {
    return json({ jsonrpc: "2.0", id, error: { code: -32600, message: "Invalid Request" } }, 400);
  }

  const params = request.params && typeof request.params === "object" ? request.params : {};
  const rawText = messageText(params);
  const text = rawText.toLowerCase();
  const requestId = taskId(id, request.method, text);

  if (isAp2PaymentRequest(params, text)) {
    recordA2aOp(context.env, request.method, "ap2-payment-mandate", false, performance.now() - startTime, 0);
    return json({ jsonrpc: "2.0", id, result: rejected(requestId, "AP2 payment mandates are not supported by this discovery-only service.") });
  }
  if (request.method !== "message/send" && request.method !== "tasks/send") {
    recordA2aOp(context.env, request.method, "unsupported_method", false, performance.now() - startTime, 0);
    return json({ jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } }, 404);
  }

  if (text.includes("search")) {
    const query = rawText.replace(/^\s*search(?:\s+for)?\s*/i, "").trim() || rawText;
    const safeQuery = query.slice(0, MAX_QUERY_LENGTH);
    const results = await searchSite(safeQuery, 10, context.env, context.request.url);
    recordA2aOp(context.env, request.method, "site-search", true, performance.now() - startTime, results.length);
    return json({ jsonrpc: "2.0", id, result: completed(requestId, JSON.stringify(results), { skill: "site-search" }) });
  }
  if (text.includes("ap2") || text.includes("commerce")) {
    recordA2aOp(context.env, request.method, "ap2-support-status", true, performance.now() - startTime, 1);
    return json({ jsonrpc: "2.0", id, result: completed(requestId, "AP2 compatibility is discovery-only. Payment mandates are rejected.", { skill: "ap2-support-status", supported: false }) });
  }
  const profile = await getProfile(context.env, context.request.url);
  recordA2aOp(context.env, request.method, "site-profile", true, performance.now() - startTime, 1);
  return json({ jsonrpc: "2.0", id, result: completed(requestId, JSON.stringify(profile), { skill: "site-profile" }) });
};
