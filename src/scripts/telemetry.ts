import { onScrollFrame, type ScrollFrame } from "./scroll-scheduler";

export interface ClientTelemetryEvent {
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

const ENDPOINT = "/api/v1/telemetry";
const MAX_QUEUE_SIZE = 20;
const FLUSH_THRESHOLD = 15;
const FLUSH_INTERVAL_MS = 30000;
const MAX_ERRORS_PER_SESSION = 3;

let eventQueue: ClientTelemetryEvent[] = [];
let flushTimer: number | undefined;
let isInitialized = false;
let errorCount = 0;
const seenErrorSignatures = new Set<string>();

let activeDwellMs = 0;
let lastVisibilityChange = Date.now();
let maxScrollPercent = 0;

function currentRoute(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname || "/";
}

export function track(event: ClientTelemetryEvent): void {
  if (typeof window === "undefined") return;
  const normalized: ClientTelemetryEvent = {
    ...event,
    route: event.route ?? currentRoute(),
  };

  eventQueue.push(normalized);
  if (eventQueue.length >= FLUSH_THRESHOLD) {
    flush();
  } else if (!flushTimer) {
    flushTimer = window.setTimeout(flush, FLUSH_INTERVAL_MS);
  }
}

export function flush(): void {
  if (typeof window === "undefined" || eventQueue.length === 0) return;
  if (flushTimer) {
    window.clearTimeout(flushTimer);
    flushTimer = undefined;
  }

  const batch = eventQueue.slice(0, MAX_QUEUE_SIZE);
  eventQueue = eventQueue.slice(MAX_QUEUE_SIZE);

  const payload = JSON.stringify({ events: batch });

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    try {
      const blob = new Blob([payload], { type: "application/json" });
      const sent = navigator.sendBeacon(ENDPOINT, blob);
      if (sent) return;
    } catch {
      // Fall back to keepalive fetch
    }
  }

  try {
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
      credentials: "same-origin",
    }).catch(() => undefined);
  } catch {
    return;
  }
}

export function trackPageView(route = currentRoute()): void {
  track({
    type: "page_view",
    target: route,
    route,
  });
}

export function trackSearch(source: "palette" | "pagefind", queryLength: number, resultCount: number): void {
  const lengthBucket = queryLength <= 3 ? "short" : queryLength <= 10 ? "medium" : "long";
  track({
    type: "search",
    target: `${source}:${lengthBucket}`,
    count: resultCount,
    value: queryLength,
  });
}

export function trackPalette(mode: string, actionId?: string): void {
  track({
    type: "palette",
    target: actionId ? `${mode}:${actionId}` : mode,
  });
}

export function trackCopy(category: string, label?: string): void {
  track({
    type: "copy",
    target: label ? `${category}:${label}` : category,
  });
}

export function trackDownload(target: string): void {
  track({
    type: "download",
    target,
  });
}

export function trackOutbound(url: string): void {
  try {
    const host = new URL(url).hostname.toLowerCase();
    track({
      type: "outbound",
      target: host,
    });
  } catch {
    track({
      type: "outbound",
      target: "external",
    });
  }
}

export function trackTheme(theme: string): void {
  track({
    type: "theme_toggle",
    target: theme,
  });
}

export function trackSound(enabled: boolean): void {
  track({
    type: "sound_toggle",
    target: enabled ? "enabled" : "disabled",
  });
}

export function trackWebMcp(
  toolName: string,
  durationMs: number,
  success: boolean,
  resultCount: number,
  contextKind?: string,
): void {
  track({
    type: "webmcp",
    target: contextKind ? `${toolName}@${contextKind}` : toolName,
    durationMs,
    success,
    count: resultCount,
  });
}

function sanitizeErrorSignature(message: string, filename?: string, lineNo?: number): string {
  const cleanMsg = (message || "unknown_error")
    .replace(/https?:\/\/[^\s]+/g, "[url]")
    .replace(/\/[\w.-]+/g, "[path]")
    .slice(0, 64);
  const file = (filename || "unknown").split("/").pop()?.slice(0, 32) || "unknown";
  return `${file}:${lineNo ?? 0}:${cleanMsg}`;
}

export function trackClientError(error: unknown, source = "window"): void {
  if (errorCount >= MAX_ERRORS_PER_SESSION) return;

  let message = "Unknown error";
  let filename = source;
  let lineNo = 0;

  if (error instanceof Error) {
    message = error.message;
    if (error.stack) {
      const match = error.stack.match(/at\s+.*?\((.*?):(\d+):(\d+)\)/);
      if (match) {
        filename = match[1] ?? source;
        lineNo = Number.parseInt(match[2] ?? "0", 10);
      }
    }
  } else if (typeof error === "string") {
    message = error;
  }

  const signature = sanitizeErrorSignature(message, filename, lineNo);
  if (seenErrorSignatures.has(signature)) return;
  seenErrorSignatures.add(signature);
  errorCount += 1;

  track({
    type: "client_error",
    target: signature.slice(0, 96),
    success: false,
  });
}

/**
 * Scroll depth, from numbers the scheduler has already measured.
 *
 * This used to run on every scroll event with no throttling and read five
 * layout properties each time, forcing a synchronous layout mid-scroll for
 * a metric that is only ever reported in 25% buckets.
 */
function updateScrollDepth(frame: ScrollFrame): void {
  const percent = Math.min(
    100,
    Math.round(((frame.y + frame.viewport) / frame.docHeight) * 100),
  );
  if (percent > maxScrollPercent) {
    maxScrollPercent = percent;
  }
}

function flushPageDwell(): void {
  const now = Date.now();
  if (typeof document !== "undefined" && document.visibilityState === "visible") {
    activeDwellMs += Math.max(0, now - lastVisibilityChange);
  }
  const dwellSeconds = Math.round(activeDwellMs / 1000);
  if (dwellSeconds >= 2) {
    const scrollBucket = maxScrollPercent >= 75 ? 75 : maxScrollPercent >= 50 ? 50 : maxScrollPercent >= 25 ? 25 : 0;
    track({
      type: "dwell",
      target: `scroll_${scrollBucket}`,
      durationMs: activeDwellMs,
      value: dwellSeconds,
    });
  }
  activeDwellMs = 0;
  lastVisibilityChange = now;
  maxScrollPercent = 0;
  flush();
}

export function initTelemetry(): void {
  if (typeof window === "undefined" || isInitialized) return;
  isInitialized = true;

  lastVisibilityChange = Date.now();
  activeDwellMs = 0;
  maxScrollPercent = 0;

  window.addEventListener("error", (event) => {
    trackClientError(event.error ?? event.message, event.filename);
  });

  window.addEventListener("unhandledrejection", (event) => {
    trackClientError(event.reason, "unhandledrejection");
  });

  document.addEventListener("visibilitychange", () => {
    const now = Date.now();
    if (document.visibilityState === "hidden") {
      activeDwellMs += Math.max(0, now - lastVisibilityChange);
      flush();
    } else {
      lastVisibilityChange = now;
    }
  });

  window.addEventListener("pagehide", () => {
    flushPageDwell();
  });

  // null signal: telemetry outlives client-side navigations, so it must
  // not be torn down by the per-page cleanup registry.
  onScrollFrame(updateScrollDepth, null);

  document.addEventListener("astro:before-swap", () => {
    flushPageDwell();
  });

  document.addEventListener("astro:page-load", () => {
    activeDwellMs = 0;
    maxScrollPercent = 0;
    trackPageView(currentRoute());
  });

  trackPageView(currentRoute());
}
