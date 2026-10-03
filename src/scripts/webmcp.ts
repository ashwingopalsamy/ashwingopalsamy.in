import { TOOL_SCHEMAS } from "../lib/canonical-capabilities";
import { onPageCleanup, pageSignal } from "./lifecycle";
import { trackWebMcp } from "./telemetry";

interface ToolContext {
  getTools?: (options?: { fromOrigins?: string[] }) => Promise<Array<{ name: string; description?: string; inputSchema?: Record<string, unknown>; annotations?: Record<string, unknown> }>> | Array<{ name: string; description?: string; inputSchema?: Record<string, unknown>; annotations?: Record<string, unknown> }>;
  registerTool: (tool: BrowserTool, options?: { signal?: AbortSignal; exposedTo?: unknown }) => Promise<unknown> | unknown;
  unregisterTool?: (name: string) => Promise<unknown> | unknown;
  executeTool?: (name: string, input?: Record<string, unknown>, options?: { signal?: AbortSignal }) => Promise<unknown>;
  addEventListener?: (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => void;
  removeEventListener?: (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) => void;
  ontoolchange?: ((event: Event) => void) | null;
}

interface BrowserTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Record<string, unknown>, options?: { signal?: AbortSignal }) => Promise<unknown>;
  annotations?: Record<string, unknown>;
}

type DocumentWithModelContext = Document & { modelContext?: ToolContext };
type NavigatorWithModelContext = Navigator & { modelContext?: ToolContext };
type WindowWithModelContext = Window & { modelContext?: ToolContext };

let registeredSignal: AbortSignal | null = null;
const contextWork = new WeakMap<ToolContext, Promise<void>>();
const contextOwners = new WeakMap<ToolContext, Map<string, AbortSignal>>();

export function contexts(): ToolContext[] {
  const doc = typeof document !== "undefined" ? (document as DocumentWithModelContext).modelContext : undefined;
  const nav = typeof navigator !== "undefined" ? (navigator as NavigatorWithModelContext).modelContext : undefined;
  const win = typeof window !== "undefined" ? (window as unknown as WindowWithModelContext).modelContext : undefined;
  const candidates = [doc, nav, win];
  return candidates.filter((context, index): context is ToolContext => Boolean(context) && candidates.indexOf(context) === index);
}

function sameOrigin(path: string): URL {
  const url = new URL(path, window.location.href);
  if (url.origin !== window.location.origin) throw new Error("WebMCP tools only access this site");
  return url;
}

function mergeSignals(pageSignal: AbortSignal, execSignal?: AbortSignal): { signal: AbortSignal; dispose: () => void } {
  const noop = () => {};
  if (!execSignal) return { signal: pageSignal, dispose: noop };
  if (typeof AbortSignal.any === "function") {
    return { signal: AbortSignal.any([pageSignal, execSignal]), dispose: noop };
  }
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  const dispose = () => {
    pageSignal.removeEventListener("abort", onAbort);
    execSignal.removeEventListener("abort", onAbort);
  };
  if (pageSignal.aborted || execSignal.aborted) {
    controller.abort();
    return { signal: controller.signal, dispose };
  }
  pageSignal.addEventListener("abort", onAbort, { once: true });
  execSignal.addEventListener("abort", onAbort, { once: true });
  return { signal: controller.signal, dispose };
}

function requireActive(signal: AbortSignal): void {
  if (signal.aborted) throw signal.reason ?? new DOMException("Operation aborted", "AbortError");
}

async function fetchJson(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(sameOrigin(path), { signal, headers: { Accept: "application/json" } });
  requireActive(signal);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  const result: unknown = await response.json();
  requireActive(signal);
  return result;
}

async function fetchMarkdown(path: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(sameOrigin(path), { signal, headers: { Accept: "text/markdown" } });
  requireActive(signal);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  const result = await response.text();
  requireActive(signal);
  return result;
}

function integer(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(1, Math.min(25, Math.floor(value))) : fallback;
}

export function isKnownDuplicateRegistration(error: unknown): boolean {
  if (!error) return false;
  if (typeof error === "object" && "name" in error && (error as { name: string }).name === "AbortError") return true;
  const msg = typeof error === "object" && "message" in error ? String((error as { message: unknown }).message).toLowerCase() : String(error).toLowerCase();
  return (
    msg.includes("already registered") ||
    msg.includes("already exists") ||
    msg.includes("duplicate") ||
    msg.includes("registered") ||
    msg.includes("invalidstateerror") ||
    msg.includes("aborted")
  );
}

export function tools(signal: AbortSignal): BrowserTool[] {
  return [
    {
      name: TOOL_SCHEMAS.searchSite.name,
      description: TOOL_SCHEMAS.searchSite.description,
      inputSchema: TOOL_SCHEMAS.searchSite.jsonSchema,
      annotations: TOOL_SCHEMAS.searchSite.annotations,
      execute: async ({ query, limit }, options?: { signal?: AbortSignal }) => {
        const operation = mergeSignals(signal, options?.signal);
        const opSignal = operation.signal;
        const t0 = performance.now();
        try {
          const manifest = (await fetchJson("/api/palette.json", opSignal)) as { content?: Array<Record<string, unknown>> };
          const needle = String(query ?? "").trim().toLowerCase();
          const content = manifest.content ?? [];
          const res = !needle
            ? content.slice(0, integer(limit, 10))
            : content
                .filter((item) => JSON.stringify(item).toLowerCase().includes(needle))
                .slice(0, integer(limit, 10));
          trackWebMcp(TOOL_SCHEMAS.searchSite.name, performance.now() - t0, true, res.length);
          return res;
        } catch (err) {
          trackWebMcp(TOOL_SCHEMAS.searchSite.name, performance.now() - t0, false, 0);
          throw err;
        } finally {
          operation.dispose();
        }
      },
    },
    {
      name: TOOL_SCHEMAS.getProfile.name,
      description: TOOL_SCHEMAS.getProfile.description,
      inputSchema: TOOL_SCHEMAS.getProfile.jsonSchema,
      annotations: TOOL_SCHEMAS.getProfile.annotations,
      execute: async (_input, options?: { signal?: AbortSignal }) => {
        const operation = mergeSignals(signal, options?.signal);
        const opSignal = operation.signal;
        const t0 = performance.now();
        try {
          const res = await fetchJson("/api/ai-summary.json", opSignal);
          trackWebMcp(TOOL_SCHEMAS.getProfile.name, performance.now() - t0, true, 1);
          return res;
        } catch (err) {
          trackWebMcp(TOOL_SCHEMAS.getProfile.name, performance.now() - t0, false, 0);
          throw err;
        } finally {
          operation.dispose();
        }
      },
    },
    {
      name: TOOL_SCHEMAS.listContent.name,
      description: TOOL_SCHEMAS.listContent.description,
      inputSchema: TOOL_SCHEMAS.listContent.jsonSchema,
      annotations: TOOL_SCHEMAS.listContent.annotations,
      execute: async ({ kind, limit }, options?: { signal?: AbortSignal }) => {
        const operation = mergeSignals(signal, options?.signal);
        const opSignal = operation.signal;
        const t0 = performance.now();
        try {
          const manifest = (await fetchJson("/api/palette.json", opSignal)) as { content?: Array<Record<string, unknown>> };
          const requested = typeof kind === "string" && kind ? kind : "all";
          const content = manifest.content ?? [];
          const res = content
            .filter((item) => requested === "all" || item.kind === requested)
            .slice(0, integer(limit, 10));
          trackWebMcp(TOOL_SCHEMAS.listContent.name, performance.now() - t0, true, res.length);
          return res;
        } catch (err) {
          trackWebMcp(TOOL_SCHEMAS.listContent.name, performance.now() - t0, false, 0);
          throw err;
        } finally {
          operation.dispose();
        }
      },
    },
    {
      name: TOOL_SCHEMAS.getNoteMarkdown.name,
      description: TOOL_SCHEMAS.getNoteMarkdown.description,
      inputSchema: TOOL_SCHEMAS.getNoteMarkdown.jsonSchema,
      annotations: TOOL_SCHEMAS.getNoteMarkdown.annotations,
      execute: async ({ slug }, options?: { signal?: AbortSignal }) => {
        const operation = mergeSignals(signal, options?.signal);
        const opSignal = operation.signal;
        const t0 = performance.now();
        try {
          const res = await fetchMarkdown(`/blog/${encodeURIComponent(String(slug))}.md`, opSignal);
          trackWebMcp(TOOL_SCHEMAS.getNoteMarkdown.name, performance.now() - t0, true, 1);
          return res;
        } catch (err) {
          trackWebMcp(TOOL_SCHEMAS.getNoteMarkdown.name, performance.now() - t0, false, 0);
          throw err;
        } finally {
          operation.dispose();
        }
      },
    },
  ];
}

function queueContextWork(context: ToolContext, work: () => Promise<void>): Promise<void> {
  const next = (contextWork.get(context) ?? Promise.resolve()).then(work);
  contextWork.set(context, next.catch(() => undefined));
  return next;
}

async function unregisterOwnedTools(context: ToolContext, signal: AbortSignal): Promise<void> {
  const owners = contextOwners.get(context);
  if (!owners) return;
  for (const [name, owner] of owners) {
    if (owner !== signal) continue;
    try {
      await context.unregisterTool?.(name);
    } catch {
      // A signal-aware context may already have removed this registration.
    } finally {
      if (owners.get(name) === signal) owners.delete(name);
    }
  }
}

export function registerContextTools(context: ToolContext, toolList: BrowserTool[], signal: AbortSignal): Promise<void> {
  return queueContextWork(context, () => registerOwnedTools(context, toolList, signal));
}

async function registerOwnedTools(context: ToolContext, toolList: BrowserTool[], signal: AbortSignal): Promise<void> {
  if (signal.aborted) return;
  let existingNames: Set<string> = new Set();
  if (typeof context.getTools === "function") {
    try {
      const existing = await context.getTools();
      if (signal.aborted) return;
      if (Array.isArray(existing)) {
        existingNames = new Set(existing.map((t) => t.name));
      }
    } catch {
      // getTools failure is non-fatal; continue to registerTool with duplicate catching
    }
  }

  let owners = contextOwners.get(context);
  if (!owners) {
    owners = new Map();
    contextOwners.set(context, owners);
  }

  for (const tool of toolList) {
    if (signal.aborted) return;
    if (existingNames.has(tool.name)) continue;
    try {
      await context.registerTool(tool, { signal });
      owners.set(tool.name, signal);
      if (signal.aborted) {
        await unregisterOwnedTools(context, signal);
        return;
      }
    } catch (error) {
      if (isKnownDuplicateRegistration(error) || signal.aborted) {
        continue;
      }
      console.warn(`[WebMCP] Failed to register tool "${tool.name}":`, error);
    }
  }
}

export async function initWebMcp(): Promise<void> {
  if (typeof document === "undefined" || typeof navigator === "undefined") return;
  const signal = pageSignal();
  if (registeredSignal === signal || signal.aborted) return;
  const available = contexts();
  if (!available.length) return;
  registeredSignal = signal;
  const registered = tools(signal);

  // Install cleanup before any context work can yield. The per-context
  // queue finishes old unregister calls before successor registration.
  onPageCleanup(() => {
    available.forEach((context) => {
      void queueContextWork(context, () => unregisterOwnedTools(context, signal)).catch(() => undefined);
    });
    if (registeredSignal === signal) registeredSignal = null;
  }, signal);

  for (const context of available) {
    if (signal.aborted) break;
    await registerContextTools(context, registered, signal);
    if (signal.aborted) break;
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("astro:page-load", () => {
    void initWebMcp().catch(() => undefined);
  });
}
