import { readBoundedJson } from "../../_ingress";
import { applySecurityHeaders } from "../../../src/lib/security-headers";
import { applyRateLimitHeaders } from "../../_unavailable";
import {
  getDeploymentSha,
  recordToAnalyticsEngine,
  type TelemetryEnv,
} from "../../_telemetry";

interface PagesContext {
  request: Request;
  env: TelemetryEnv;
}

interface ClientTelemetryEvent {
  type: string;
  name?: string;
  target?: string;
  route?: string;
  durationMs?: number;
  value?: number;
  count?: number;
  success?: boolean;
  metadata?: Record<string, string | number | boolean>;
}

interface TelemetryBatch {
  events?: ClientTelemetryEvent[];
}

const ALLOWED_EVENT_TYPES = new Set([
  "page_view",
  "dwell",
  "search",
  "palette",
  "copy",
  "download",
  "outbound",
  "theme_toggle",
  "sound_toggle",
  "webmcp",
  "client_error",
]);

const MAX_BATCH_EVENTS = 25;
const MAX_STRING_LEN = 128;

function sanitizeString(val: unknown, maxLen = MAX_STRING_LEN): string {
  if (typeof val !== "string") return "";
  return val.trim().slice(0, maxLen);
}

function sanitizeNumber(val: unknown, fallback = 0, min = 0, max = 1000000): number {
  if (typeof val !== "number" || !Number.isFinite(val)) return fallback;
  return Math.max(min, Math.min(max, Math.round(val)));
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  if (context.request.method === "OPTIONS") {
    const headers = applySecurityHeaders(new Headers(), "json-api-public");
    headers.set("Access-Control-Allow-Headers", "Content-Type");
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    return new Response(null, { status: 204, headers });
  }

  if (context.request.method !== "POST") {
    let headers = applySecurityHeaders(new Headers(), "json-api-public");
    headers = applyRateLimitHeaders(headers);
    headers.set("Allow", "POST, OPTIONS");
    return new Response(null, { status: 405, headers });
  }

  const ingress = await readBoundedJson<TelemetryBatch>(context.request, 32768);
  if (!ingress.ok) {
    return ingress.response;
  }

  const batch = ingress.data;
  if (!batch || !Array.isArray(batch.events)) {
    let headers = applySecurityHeaders(new Headers(), "json-api-public");
    headers.set("Content-Type", "application/json; charset=utf-8");
    return new Response(JSON.stringify({ error: "invalid_payload" }) + "\n", { status: 400, headers });
  }

  const events = batch.events.slice(0, MAX_BATCH_EVENTS);
  const deploymentSha = getDeploymentSha(context.env);

  const requestCf = (context.request as unknown as { cf?: Record<string, unknown> }).cf;
  const country = typeof requestCf?.country === "string" ? requestCf.country : "XX";
  const colo = typeof requestCf?.colo === "string" ? requestCf.colo : "UNKNOWN";

  for (const event of events) {
    if (!event || typeof event !== "object") continue;
    const type = sanitizeString(event.type, 32);
    if (!ALLOWED_EVENT_TYPES.has(type)) continue;

    const target = sanitizeString(event.target ?? event.name, 96);
    const route = sanitizeString(event.route, 96) || "/";
    const durationMs = sanitizeNumber(event.durationMs, 0, 0, 300000);
    const count = sanitizeNumber(event.count ?? event.value, 1, 0, 10000);
    const success = event.success !== false;

    recordToAnalyticsEngine(context.env.SITE_TELEMETRY, {
      eventType: `client_${type}`,
      surface: "client",
      route,
      method: "POST",
      statusCode: success ? 200 : 500,
      representation: "json",
      clientClass: "human_browser",
      crawlerName: "none",
      crawlerOperator: "none",
      country,
      colo,
      referrerHost: "self",
      protocolOp: type,
      targetName: target || "none",
      success,
      deploymentSha,
      correlationId: "client_event",
      durationMs,
      resultCount: count,
    });
  }

  let headers = applySecurityHeaders(new Headers(), "json-api-public");
  headers = applyRateLimitHeaders(headers);
  return new Response(null, { status: 204, headers });
};
