import { onCLS, onFCP, onINP, onLCP, onTTFB } from "web-vitals/attribution";
import type { MetricWithAttribution } from "web-vitals/attribution";
import { track } from "./telemetry";

/**
 * First-party Core Web Vitals. Cookieless and identifier-free: one event per
 * metric per page lifetime through the same queue as everything else.
 *
 * No explicit flush is needed. web-vitals finalises CLS, INP and an
 * unfinished LCP from a capture-phase `visibilitychange` listener on
 * window, which runs before the telemetry module's bubble-phase listener on
 * document, so the events are already queued when that listener flushes.
 */

type Metadata = Record<string, string | number | boolean>;

const MAX_STRING_LEN = 128;
let started = false;

function clip(value: string | undefined): string | undefined {
  return value ? value.slice(0, MAX_STRING_LEN) : undefined;
}

/** Pathname only (no query, no hash); cross-origin scripts keep their host. */
function scriptPath(sourceURL: string): string | undefined {
  try {
    const url = new URL(sourceURL, location.href);
    return clip(url.origin === location.origin ? url.pathname : url.host + url.pathname);
  } catch {
    return undefined;
  }
}

function context(): Metadata {
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string };
    deviceMemory?: number;
  };
  const meta: Metadata = {
    viewport: matchMedia("(max-width: 38rem)").matches ? "compact" : "regular",
    theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
  if (nav.connection?.effectiveType) meta.effectiveType = nav.connection.effectiveType;
  // Already coarse (0.25 to 8) by the spec, so it is sent as reported.
  if (typeof nav.deviceMemory === "number") meta.deviceMemory = nav.deviceMemory;
  return meta;
}

function report(metric: MetricWithAttribution): void {
  const metadata: Metadata = {
    ...context(),
    rating: metric.rating,
    navigationType: metric.navigationType,
  };
  let target: string | undefined;

  switch (metric.name) {
    case "LCP": {
      const { attribution } = metric;
      target = attribution.target;
      metadata.timeToFirstByte = Math.round(attribution.timeToFirstByte);
      metadata.resourceLoadDelay = Math.round(attribution.resourceLoadDelay);
      metadata.resourceLoadDuration = Math.round(attribution.resourceLoadDuration);
      metadata.elementRenderDelay = Math.round(attribution.elementRenderDelay);
      break;
    }
    case "INP": {
      const { attribution } = metric;
      target = attribution.interactionTarget;
      if (attribution.interactionType) metadata.interactionType = attribution.interactionType;
      metadata.inputDelay = Math.round(attribution.inputDelay);
      metadata.processingDuration = Math.round(attribution.processingDuration);
      metadata.presentationDelay = Math.round(attribution.presentationDelay);
      const script = attribution.longestScript?.entry;
      const source = script?.sourceURL ? scriptPath(script.sourceURL) : undefined;
      if (source) metadata.scriptSource = source;
      const invoker = clip(script?.invoker);
      if (invoker) metadata.scriptInvoker = invoker;
      break;
    }
    case "CLS": {
      const { attribution } = metric;
      target = attribution.largestShiftTarget;
      if (typeof attribution.largestShiftValue === "number") {
        metadata.largestShiftValue = Math.round(attribution.largestShiftValue * 1000);
      }
      break;
    }
  }

  track({
    type: "web_vital",
    name: metric.name,
    // CLS is unitless and usually below 1, so it is sent x1000 to survive
    // integer rounding; every other metric is milliseconds.
    value: Math.round(metric.name === "CLS" ? metric.value * 1000 : metric.value),
    target: clip(target),
    metadata,
  });
}

export function initVitals(): void {
  if (typeof window === "undefined" || started) return;
  started = true;

  onTTFB(report);
  onFCP(report);
  onLCP(report);
  onINP(report, { reportAllChanges: false });
  onCLS(report);
}
