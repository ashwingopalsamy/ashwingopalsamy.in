import { site } from "../data/home";
import { STEEL_1, STEEL_9 } from "../lib/theme";

type Theme = "light" | "dark";
type IntegrationState = "absent" | "idle" | "loading" | "ready" | "degraded" | "fallback";

export interface IntegrationStatus {
  state: IntegrationState;
  errors: number;
  missingImages?: number;
  missingImageIds?: readonly string[];
}

export interface SiteStatus {
  route: string;
  build: Readonly<{ commit: string | null; builtAt: string }>;
  theme: Theme;
  reducedMotion: boolean;
  spotify: Readonly<IntegrationStatus>;
  map: Readonly<IntegrationStatus>;
}

export interface AshwinConsole {
  help(): void;
  status(): Readonly<SiteStatus>;
  source(): string;
  secrets(): readonly string[];
}

declare global {
  interface Window {
    ashwin?: AshwinConsole;
  }
}

const READY = Symbol.for("ashwin.console.ready");
const SECRETS = Object.freeze(["whoami", "vanakkam", "42", "sudo hire ashwin"]);

function readBuildMeta(): { builtAt: string; commit: string | null } {
  const root = document.documentElement;
  return {
    builtAt: root.dataset.buildAt ?? new Date().toISOString(),
    commit: root.dataset.buildCommit ?? null,
  };
}

function stateFromInit(init?: string): IntegrationState {
  if (init === "true" || init === "ready" || init === "facade") return "ready";
  if (init === "fallback") return "fallback";
  if (init === "pending") return "loading";
  return "idle";
}

function readMapStatus(): Readonly<IntegrationStatus> {
  const map = document.querySelector<HTMLElement>(".loc-map, .loc-map-wrap");
  if (!map) return Object.freeze({ state: "absent", errors: 0, missingImages: 0 });
  const isFallback = Boolean(map.closest(".loc-card.is-fallback"));
  const state: IntegrationState = isFallback
    ? "fallback"
    : ((map.dataset.mapStatus as IntegrationState | undefined) ?? stateFromInit(map.dataset.mapInit));
  let missingImageIds: readonly string[] = [];
  try {
    const parsed = JSON.parse(map.dataset.mapMissingImageIds ?? "[]");
    if (Array.isArray(parsed)) missingImageIds = parsed.filter((id): id is string => typeof id === "string");
  } catch {
    missingImageIds = [];
  }
  return Object.freeze({
    state,
    errors: Number(map.dataset.mapErrors ?? 0),
    missingImages: Number(map.dataset.mapMissingImages ?? 0),
    missingImageIds: Object.freeze(missingImageIds),
  });
}

function readSpotifyStatus(): Readonly<IntegrationStatus> {
  const spotify = document.querySelector<HTMLElement>(".spotify-wrap");
  if (!spotify) return Object.freeze({ state: "absent", errors: 0 });
  return Object.freeze({
    state: stateFromInit(spotify.dataset.spotifyInit),
    errors: Number(spotify.dataset.spotifyErrors ?? 0),
  });
}

function status(): Readonly<SiteStatus> {
  const buildMeta = readBuildMeta();
  return Object.freeze({
    route: window.location.pathname,
    build: Object.freeze({ commit: buildMeta.commit, builtAt: buildMeta.builtAt }),
    theme: document.documentElement.dataset.theme === "dark" ? "dark" : "light",
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    spotify: readSpotifyStatus(),
    map: readMapStatus(),
  });
}

function source(): string {
  const buildMeta = readBuildMeta();
  const url = buildMeta.commit ? `${site.repoUrl}/commit/${buildMeta.commit}` : site.repoUrl;
  console.info("[ashwin.dev] source", url);
  return url;
}

function help(): void {
  console.info(
    "[ashwin.dev] Try ashwin.help(), ashwin.status(), ashwin.source(), or ashwin.secrets(). The helpers are read-only."
  );
}

function secrets(): readonly string[] {
  console.info("[ashwin.dev] Press ⌘K or Ctrl+K, then try:", SECRETS.join(" · "));
  return SECRETS;
}

function installApi(): AshwinConsole {
  if (window.ashwin) return window.ashwin;
  const api = Object.freeze({ help, status, source, secrets });
  Object.defineProperty(window, "ashwin", {
    value: api,
    configurable: false,
    enumerable: false,
    writable: false,
  });
  return api;
}

function formatBuildTime(): string {
  const buildMeta = readBuildMeta();
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: site.timeZone,
  }).format(new Date(buildMeta.builtAt));
}

export function initConsole(): void {
  if (Object.getOwnPropertyDescriptor(window, READY)?.value === true) return;
  Object.defineProperty(window, READY, {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });

  const api = installApi();
  const buildMeta = readBuildMeta();
  const sourceUrl = buildMeta.commit ? `${site.repoUrl}/commit/${buildMeta.commit}` : site.repoUrl;
  const route = window.location.pathname;
  console.info(
    "%c[ashwin.dev]%c payments infrastructure, notes, and the long way around.",
    `color:${STEEL_1};background:${STEEL_9};padding:3px 6px;border-radius:4px;font-weight:600`,
    "color:inherit;font-weight:500"
  );
  console.info("[ashwin.dev] Hand-built with Astro and vanilla JS. No framework was hydrated. The coconut trees remain unaffected.");
  console.groupCollapsed("[ashwin.dev] field notes");
  console.info("[ashwin.dev] route", route);
  console.info("[ashwin.dev] build", buildMeta.commit ?? "unavailable", "at", formatBuildTime());
  console.info("[ashwin.dev] source", sourceUrl);
  console.info("[ashwin.dev] colophon /colophon · machine context /llms.txt · /llms-full.txt · /ai.txt · /knowledge.json · /api/ai-summary.json");
  console.info("[ashwin.dev] secrets", SECRETS.join(" · "), "· helper ashwin.help()");
  console.groupEnd();
  void api;
}
