import { readBoundedJson } from "../../_ingress";
import { applySecurityHeaders } from "../../../src/lib/security-headers";
import {
  getDeploymentSha,
  normalizeRoute,
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
  "web_vital",
  "embed",
]);

const WEB_VITAL_NAMES = new Set(["LCP", "INP", "CLS", "FCP", "TTFB"]);
const WEB_VITAL_RATINGS = new Set(["good", "needs-improvement", "poor"]);
const NAVIGATION_TYPES = new Set([
  "navigate",
  "reload",
  "back-forward",
  "back-forward-cache",
  "prerender",
  "restore",
  "soft-navigation",
]);
const INTERACTION_TYPES = new Set(["pointer", "keyboard"]);
const EFFECTIVE_TYPES = new Set(["slow-2g", "2g", "3g", "4g"]);
const VIEWPORTS = new Set(["compact", "regular"]);
const THEMES = new Set(["light", "dark"]);

type AnalyticsFields = Partial<Parameters<typeof recordToAnalyticsEngine>[1]>;

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

function oneOf(val: unknown, allowed: Set<string>, fallback: string): string {
  return typeof val === "string" && allowed.has(val) ? val : fallback;
}

function jsonError(status: number, error: string): Response {
  const headers = applySecurityHeaders(new Headers(), "json-api");
  headers.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify({ error }) + "\n", { status, headers });
}

/**
 * recordToAnalyticsEngine has a fixed blob/double layout, so a vital rides
 * in slots that are constant for every other client event:
 *   protocolOp     metric:rating:navigationType
 *   targetName     attribution selector; INP: selector|interactionType|script#invoker
 *   correlationId  effectiveType|viewport|theme|reducedMotion(1/0)|deviceMemory
 *   durationMs     value (ms; CLS x1000)
 *   requestBytes, responseBytes, resultCount, tokensEst  attribution breakdown
 *     LCP  timeToFirstByte, resourceLoadDelay, resourceLoadDuration, elementRenderDelay
 *     INP  inputDelay, processingDuration, presentationDelay
 *     CLS  largestShiftValue (x1000)
 * Every free-text slot is whitelisted or length-capped.
 */
function readWebVital(event: ClientTelemetryEvent): AnalyticsFields | null {
  const name = event.name;
  if (typeof name !== "string" || !WEB_VITAL_NAMES.has(name)) return null;
  const meta: Record<string, unknown> =
    event.metadata && typeof event.metadata === "object" ? event.metadata : {};
  const num = (key: string) => sanitizeNumber(meta[key], 0, 0, 300000);

  let breakdown = [0, 0, 0, 0];
  if (name === "LCP") {
    breakdown = [num("timeToFirstByte"), num("resourceLoadDelay"), num("resourceLoadDuration"), num("elementRenderDelay")];
  } else if (name === "INP") {
    breakdown = [num("inputDelay"), num("processingDuration"), num("presentationDelay"), 0];
  } else if (name === "CLS") {
    breakdown = [num("largestShiftValue"), 0, 0, 0];
  }

  let targetName = sanitizeString(event.target, 96);
  if (name === "INP") {
    const script = sanitizeString(meta.scriptSource).slice(-30);
    const invoker = sanitizeString(meta.scriptInvoker).slice(0, 21);
    targetName = [
      targetName.slice(0, 32),
      oneOf(meta.interactionType, INTERACTION_TYPES, ""),
      invoker ? `${script}#${invoker}` : script,
    ].join("|");
  }

  const memory = meta.deviceMemory;
  const deviceMemory =
    typeof memory === "number" && Number.isFinite(memory) && memory >= 0 && memory <= 64
      ? String(Math.round(memory * 100) / 100)
      : "?";

  return {
    protocolOp: `${name}:${oneOf(meta.rating, WEB_VITAL_RATINGS, "unknown")}:${oneOf(meta.navigationType, NAVIGATION_TYPES, "unknown")}`,
    targetName: targetName || "none",
    correlationId: [
      oneOf(meta.effectiveType, EFFECTIVE_TYPES, "?"),
      oneOf(meta.viewport, VIEWPORTS, "?"),
      oneOf(meta.theme, THEMES, "?"),
      meta.reducedMotion === true ? "1" : "0",
      deviceMemory,
    ].join("|"),
    durationMs: sanitizeNumber(event.value, 0, 0, 300000),
    requestBytes: breakdown[0],
    responseBytes: breakdown[1],
    resultCount: breakdown[2],
    tokensEst: breakdown[3],
  };
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  // Same-origin only: no CORS headers, so a cross-origin preflight fails.
  if (context.request.method === "OPTIONS") {
    const headers = applySecurityHeaders(new Headers(), "json-api");
    headers.set("Allow", "POST, OPTIONS");
    return new Response(null, { status: 204, headers });
  }

  if (context.request.method !== "POST") {
    const headers = applySecurityHeaders(new Headers(), "json-api");
    headers.set("Allow", "POST, OPTIONS");
    return new Response(null, { status: 405, headers });
  }

  // Browsers always send Sec-Fetch-Site; anything but our own pages is a
  // cross-site write. Non-browser clients omit it and are not affected.
  const fetchSite = context.request.headers.get("Sec-Fetch-Site");
  if (fetchSite !== null && fetchSite !== "same-origin") {
    return jsonError(403, "forbidden");
  }

  const contentType = context.request.headers.get("Content-Type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return jsonError(415, "unsupported_media_type");
  }

  const ingress = await readBoundedJson<TelemetryBatch>(context.request, 32768);
  if (!ingress.ok) {
    return ingress.response;
  }

  const batch = ingress.data;
  if (!batch || !Array.isArray(batch.events)) {
    return jsonError(400, "invalid_payload");
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

    const target =
      type === "embed"
        ? `${sanitizeString(event.name, 32)}:${sanitizeString(event.target, 32)}`
        : sanitizeString(event.target ?? event.name, 96);
    const rawRoute = sanitizeString(event.route, 96);
    const route = normalizeRoute(rawRoute.startsWith("/") ? rawRoute.split(/[?#]/, 1)[0] : "/");
    const durationMs = sanitizeNumber(event.durationMs, 0, 0, 300000);
    const count = sanitizeNumber(event.count ?? event.value, 1, 0, 10000);
    const success = event.success !== false;
    const vital: AnalyticsFields | null = type === "web_vital" ? readWebVital(event) : {};
    if (!vital) continue;

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
      ...vital,
    });
  }

  const headers = applySecurityHeaders(new Headers(), "json-api");
  return new Response(null, { status: 204, headers });
};
