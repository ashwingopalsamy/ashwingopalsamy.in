/**
 * POST /api/csp-report — sink for Content Security Policy violation reports
 * during the strict-policy rollout (see src/lib/security-headers.ts).
 *
 * Accepts both formats browsers send: legacy `report-uri` bodies
 * (application/csp-report, `{ "csp-report": {...} }`) and Reporting API batches
 * (application/reports+json, `[{ type: "csp-violation", body: {...} }]`).
 * Each violation becomes one Analytics Engine data point plus a log line.
 * Bounded body, at most 20 violations per request, URLs reduced to
 * origin + path so no query strings or fragments are stored.
 */
import { readBoundedJson } from "../_ingress";
import { applySecurityHeaders } from "../../src/lib/security-headers";
import { getDeploymentSha, normalizeRoute, recordToAnalyticsEngine, type TelemetryEnv } from "../_telemetry";

interface PagesContext {
  request: Request;
  env: TelemetryEnv;
}

type Violation = Record<string, unknown>;

const MAX_VIOLATIONS = 20;
const REPORT_TYPES = ["application/csp-report", "application/reports+json", "application/json"];

function str(value: unknown, max = 96): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

/** Keep the origin and path; keywords such as "inline" or "eval" pass through. */
function stripUrl(value: unknown): string {
  const raw = str(value, 512);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname}`.slice(0, 96);
  } catch {
    return raw.slice(0, 32);
  }
}

function violations(payload: unknown): Violation[] {
  if (Array.isArray(payload)) {
    return payload
      .filter((report): report is { type: unknown; body: Violation } =>
        typeof report === "object" && report !== null && (report as { type?: unknown }).type === "csp-violation")
      .map((report) => report.body);
  }
  if (payload && typeof payload === "object" && "csp-report" in payload) {
    const body = (payload as { "csp-report": unknown })["csp-report"];
    return body && typeof body === "object" ? [body as Violation] : [];
  }
  return [];
}

function noContent(): Response {
  return new Response(null, { status: 204, headers: applySecurityHeaders(new Headers(), "json-api") });
}

export const onRequest = async (context: PagesContext): Promise<Response> => {
  const { request, env } = context;
  if (request.method !== "POST") {
    const headers = applySecurityHeaders(new Headers(), "json-api");
    headers.set("Allow", "POST");
    return new Response(null, { status: 405, headers });
  }

  const parsed = await readBoundedJson(request, undefined, REPORT_TYPES);
  if (!parsed.ok) return parsed.response;

  const deploymentSha = getDeploymentSha(env);
  const country = str((request as Request & { cf?: { country?: string } }).cf?.country, 8);
  for (const v of violations(parsed.data).slice(0, MAX_VIOLATIONS)) {
    const directive = str(v.effectiveDirective ?? v["effective-directive"] ?? v["violated-directive"], 48);
    const blocked = stripUrl(v.blockedURL ?? v["blocked-uri"]);
    const documentPath = (() => {
      try {
        return normalizeRoute(new URL(str(v.documentURL ?? v["document-uri"], 512)).pathname);
      } catch {
        return "unknown";
      }
    })();
    const disposition = str(v.disposition, 16) || "report";
    const source = stripUrl(v.sourceFile ?? v["source-file"]);
    console.log(JSON.stringify({ event: "csp_violation", directive, blocked, documentPath, disposition, source, deploymentSha }));
    recordToAnalyticsEngine(env?.SITE_TELEMETRY, {
      eventType: "csp_violation",
      surface: "security",
      route: documentPath,
      method: "POST",
      statusCode: 204,
      representation: "json",
      clientClass: "human_browser",
      crawlerName: "",
      crawlerOperator: "",
      country,
      colo: "",
      referrerHost: "",
      protocolOp: `${directive}:${disposition}`.slice(0, 64),
      targetName: blocked || source,
      success: false,
      deploymentSha,
      correlationId: str(v.sample ?? v["script-sample"], 32),
      durationMs: 0,
      resultCount: 1,
    });
  }
  return noContent();
};
