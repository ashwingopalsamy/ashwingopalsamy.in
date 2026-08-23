import { isSoundEnabled, playAccent, setSoundEnabled } from "./sound";
import { showToast } from "./toast";
import { copyToClipboard } from "./clipboard";
import { calculate, convertQuery, formatCalculation, generatePassword, isCalculationQuery, randomChoice, roll, transformText } from "./palette-utils";
import { hydratePaletteIcons, iconMarkup, paletteAiIcon, paletteContentIcon, paletteFallbackIcon, palettePageIcon, paletteRouteIcon, profileIconKey, type PaletteIconKey } from "./palette-icons";
import { BROWSE_CATEGORIES, QUERY_RECIPES, ROOT_RECIPE_IDS, recipeById, shouldTrackRecent, truncateMatches, type BrowseCategory, type QueryRecipe, type ResultSummary } from "./palette-discovery";
import type { PaletteManifest } from "../lib/palette-manifest";
import { moreDestinations } from "../data/more";
import { resumeUrl } from "../data/home";
import { mobileNavigation } from "../data/navigation";
import { trackCopy, trackDownload, trackOutbound, trackPalette } from "./telemetry";

type Kind = "page" | "content" | "action" | "utility" | "time" | "ai" | "fun";
export type PaletteOpenMode = "directory" | "search" | "help";
type PaletteMode = PaletteOpenMode | "actions" | "browse";

interface ActionItem {
  id: string;
  label: string;
  hint?: string;
  icon?: PaletteIconKey;
  action: () => void | Promise<unknown>;
  closeOnRun?: boolean;
  trackRecent?: boolean;
}

interface Item {
  id: string;
  kind: Kind;
  label: string;
  badge?: string;
  subtitle?: string;
  excerptHtml?: string;
  hint?: string;
  href?: string;
  external?: boolean;
  group: string;
  section?: string;
  context?: string;
  icon?: PaletteIconKey;
  keywords?: string[];
  value?: string;
  live?: () => string;
  action?: () => void | Promise<unknown>;
  closeOnRun?: boolean;
  trackRecent?: boolean;
  disabled?: boolean;
  actions?: ActionItem[];
  score?: number;
}

interface PaletteViewSnapshot {
  mode: PaletteMode;
  title: string;
  items: Item[];
  query: string;
  activeIndex: number;
  scrollTop: number;
  resultSummary: ResultSummary | null;
}

interface PagefindResultData {
  url: string;
  excerpt?: string;
  meta?: { title?: string };
}

interface PagefindSearch {
  results: { data: () => Promise<PagefindResultData> }[];
}

interface PagefindApi {
  init: () => Promise<void> | void;
  debouncedSearch: (q: string, opts?: object, debounceMs?: number) => Promise<PagefindSearch | null>;
  preload?: (q: string) => void;
}

interface StoredPaletteState {
  version: 1;
  pins: string[];
  recent: { id: string; usedAt: number; count: number }[];
}

interface PaletteLockedSibling {
  element: HTMLElement;
  supportsInert: boolean;
  inert: boolean;
  ariaHidden: string | null;
}

interface PalettePageLock {
  scrollX: number;
  scrollY: number;
  bodyStyle: {
    position: string;
    top: string;
    left: string;
    right: string;
    width: string;
    overflow: string;
    paddingRight: string;
  };
  htmlStyle: {
    overflow: string;
    overscrollBehavior: string;
  };
  siblings: PaletteLockedSibling[];
}

declare global {
  interface Window {
    __openPalette?: (mode?: PaletteOpenMode, instant?: boolean) => void;
  }
}

const PAGES: Array<{ label: string; href: string; hint?: string; keywords: string[]; icon: PaletteIconKey }> = [
  { label: "Home", href: "/", hint: "g h", keywords: ["start", "homepage"], icon: palettePageIcon("/") },
  { label: "Work", href: "/work/", hint: "g w", keywords: ["projects", "craft", "work"], icon: palettePageIcon("/work/") },
  { label: "Library", href: "/library/", hint: "g l", keywords: ["notes", "books", "watch", "articles"], icon: palettePageIcon("/library/") },
  { label: "Books", href: "/library/?view=books", keywords: ["reading", "library"], icon: "book" },
  { label: "Watch", href: "/library/?view=watch", keywords: ["films", "movies", "library"], icon: "watch" },
  { label: "Tags", href: "/library/tags/", keywords: ["topics", "library"], icon: palettePageIcon("/library/tags/") },
  { label: "Links", href: "/links/", keywords: ["contact", "social"], icon: palettePageIcon("/links/") },
  { label: "AI", href: "/ai/", keywords: ["agents", "llm", "machine-readable"], icon: palettePageIcon("/ai/") },
  { label: "Design", href: "/design/", keywords: ["design", "motion", "typography"], icon: palettePageIcon("/design/") },
  { label: "More", href: "/more/", keywords: ["photos", "cafes", "people"], icon: palettePageIcon("/more/") },
  { label: "Colophon", href: "/colophon/", keywords: ["about", "stack"], icon: palettePageIcon("/colophon/") },
  ...moreDestinations
    .filter((destination) => destination.status === "live" && destination.id !== "library" && destination.id !== "ai")
    .map((destination) => ({
      label: destination.title[0]?.toUpperCase() + destination.title.slice(1),
      href: destination.href,
      keywords: ["more", destination.title],
      icon: palettePageIcon(destination.href),
    })),
];

const STORAGE_KEY = "ag:palette:v1";
const RECENT_CAP = 20;
const PIN_CAP = 8;
const PALETTE_EXIT_MS = 160;

let pagefind: PagefindApi | null = null;
let pagefindPromise: Promise<PagefindApi | null> | null = null;
let manifest: PaletteManifest | null = null;
let manifestPromise: Promise<PaletteManifest | null> | null = null;
let timePromise: Promise<typeof import("./palette-time")> | null = null;
let open = false;
let mode: PaletteMode = "search";
let activeIndex = 0;
let items: Item[] = [];
let viewStack: PaletteViewSnapshot[] = [];
let currentContextTitle = "";
let resultSummary: ResultSummary | null = null;
let expandedQueryKey = "";
let pendingActiveItemId: string | undefined;
let prevFocus: HTMLElement | null = null;
let searchTimer = 0;
let queryVersion = 0;
let timeTicker: number | undefined;
let closeTimer: number | undefined;
let pageLock: PalettePageLock | null = null;
let storedState: StoredPaletteState = loadState();
let paletteViewportMedia: MediaQueryList | null = null;
let paletteViewportWired = false;

function els() {
  const root = document.getElementById("command-palette");
  const input = document.getElementById("palette-input") as HTMLInputElement | null;
  const list = document.getElementById("palette-list");
  const footer = document.getElementById("palette-footer");
  const footerHints = document.getElementById("palette-footer-hints");
  const count = document.getElementById("palette-count");
  const status = document.getElementById("palette-status");
  const queryShell = document.getElementById("palette-query-shell");
  const contextShell = document.getElementById("palette-context-shell");
  const contextTitle = document.getElementById("palette-context-title");
  const querySlotDesktop = document.getElementById("palette-query-slot-desktop");
  const querySlotMobile = document.getElementById("palette-query-slot-mobile");
  const panel = root?.querySelector<HTMLElement>(".palette-panel") ?? null;
  const mobileDock = document.getElementById("palette-mobile-dock");
  const mobileTitle = document.getElementById("palette-mobile-title");
  const mobileSearchLaunch = document.getElementById("palette-mobile-search-launch") as HTMLButtonElement | null;
  const mobileClose = document.getElementById("palette-mobile-close") as HTMLButtonElement | null;
  const back = root?.querySelector<HTMLButtonElement>(".palette-back") ?? null;
  return { root, input, list, footer, footerHints, count, status, queryShell, contextShell, contextTitle, querySlotDesktop, querySlotMobile, panel, mobileDock, mobileTitle, mobileSearchLaunch, mobileClose, back };
}

function isMobilePalette(): boolean {
  return window.matchMedia("(max-width: 38rem)").matches;
}

function syncQuerySlot() {
  const { queryShell, querySlotDesktop, querySlotMobile } = els();
  if (!queryShell) return;
  const target = isMobilePalette() ? querySlotMobile : querySlotDesktop;
  if (target && queryShell.parentElement !== target) target.appendChild(queryShell);
}

function syncPaletteViewport() {
  const { root } = els();
  if (!root || !open || !isMobilePalette()) return;
  const viewport = window.visualViewport;
  root.style.setProperty("--palette-visual-height", `${viewport?.height ?? window.innerHeight}px`);
  root.style.setProperty("--palette-visual-top", `${viewport?.offsetTop ?? 0}px`);
}

function clearPaletteViewport() {
  const { root } = els();
  root?.style.removeProperty("--palette-visual-height");
  root?.style.removeProperty("--palette-visual-top");
}

function wirePaletteViewport() {
  syncQuerySlot();
  if (paletteViewportWired) return;
  paletteViewportWired = true;
  paletteViewportMedia = window.matchMedia("(max-width: 38rem)");
  const onBreakpointChange = () => {
    syncQuerySlot();
    if (open) {
      setMode(mode, currentContextTitle);
      syncPaletteViewport();
    }
  };
  paletteViewportMedia.addEventListener("change", onBreakpointChange);
  window.visualViewport?.addEventListener("resize", syncPaletteViewport);
  window.visualViewport?.addEventListener("scroll", syncPaletteViewport);
}

function loadState(): StoredPaletteState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { version: 1, pins: [], recent: [] };
    const parsed = JSON.parse(raw) as Partial<StoredPaletteState>;
    if (parsed.version !== 1 || !Array.isArray(parsed.pins) || !Array.isArray(parsed.recent)) {
      return { version: 1, pins: [], recent: [] };
    }
    return {
      version: 1,
      pins: parsed.pins.filter((id): id is string => typeof id === "string").slice(0, PIN_CAP),
      recent: parsed.recent
        .filter((entry): entry is { id: string; usedAt: number; count: number } => Boolean(entry && typeof entry.id === "string" && typeof entry.usedAt === "number" && typeof entry.count === "number"))
        .sort((a, b) => b.usedAt - a.usedAt)
        .slice(0, RECENT_CAP),
    };
  } catch {
    return { version: 1, pins: [], recent: [] };
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storedState));
  } catch {
    return;
  }
}

function bumpRecent(id: string) {
  const existing = storedState.recent.find((entry) => entry.id === id);
  storedState.recent = [
    { id, usedAt: Date.now(), count: (existing?.count ?? 0) + 1 },
    ...storedState.recent.filter((entry) => entry.id !== id),
  ].slice(0, RECENT_CAP);
  saveState();
}

function isPinned(id: string): boolean {
  return storedState.pins.includes(id);
}

function togglePin(id: string) {
  if (isPinned(id)) {
    storedState.pins = storedState.pins.filter((value) => value !== id);
    showToast({ message: "Removed from pinned commands", duration: 1600 });
  } else if (storedState.pins.length < PIN_CAP) {
    storedState.pins = [id, ...storedState.pins];
    showToast({ message: "Pinned command", duration: 1600 });
  } else {
    showToast({ message: "You can pin up to eight commands", duration: 1800 });
  }
  saveState();
}

function clearHistory() {
  storedState.recent = [];
  storedState.pins = [];
  saveState();
  showToast({ message: "Command history cleared", duration: 1600 });
  void refresh("");
}

function loadManifest(): Promise<PaletteManifest | null> {
  if (manifest) return Promise.resolve(manifest);
  if (manifestPromise) return manifestPromise;
  manifestPromise = fetch("/api/palette.json", { credentials: "same-origin" })
    .then(async (response) => {
      if (!response.ok) throw new Error("Manifest unavailable");
      const value = (await response.json()) as PaletteManifest;
      if (value.version !== 1) throw new Error("Unsupported manifest");
      manifest = value;
      return value;
    })
    .catch(() => {
      manifestPromise = null;
      return null;
    });
  return manifestPromise;
}

function loadPagefind(): Promise<PagefindApi | null> {
  if (pagefind) return Promise.resolve(pagefind);
  if (pagefindPromise) return pagefindPromise;
  pagefindPromise = (new Function("return import('/pagefind/pagefind.js')")() as Promise<PagefindApi>)
    .then(async (mod) => {
      await mod.init?.();
      pagefind = mod;
      return mod;
    })
    .catch(() => {
      pagefindPromise = null;
      return null;
    });
  return pagefindPromise;
}

function loadTime() {
  if (timePromise) return timePromise;
  timePromise = import("./palette-time");
  return timePromise;
}

function browserZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function formatNativeTime(zone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: zone,
  }).format(new Date());
}

async function copyText(value: string, message = "Copied") {
  const copied = await copyToClipboard(value);
  if (copied) {
    playAccent("copy");
    showToast({ message, duration: 1600 });
    trackCopy("palette", message);
  } else {
    showToast({ message: "Copy failed", duration: 2200 });
  }
  return copied;
}

function lockPageForPalette(root: HTMLElement) {
  if (pageLock) return;
  const body = document.body;
  const html = document.documentElement;
  const rootBranch = Array.from(body.children).find((element) => element.contains(root));
  const lockTargets = [
    ...Array.from(body.children).filter((element) => element !== rootBranch),
    ...Array.from(root.parentElement?.children ?? []).filter((element) => element !== root),
  ];
  const siblings = lockTargets
    .filter((element): element is HTMLElement => element instanceof HTMLElement)
    .map((element) => {
      const supportsInert = typeof (element as unknown as { inert?: unknown }).inert !== "undefined";
      const locked: PaletteLockedSibling = {
        element,
        supportsInert,
        inert: supportsInert ? (element as HTMLElement & { inert: boolean }).inert : false,
        ariaHidden: element.getAttribute("aria-hidden"),
      };
      if (supportsInert) {
        (element as HTMLElement & { inert: boolean }).inert = true;
      }
      element.setAttribute("aria-hidden", "true");
      return locked;
    });

  pageLock = {
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    bodyStyle: {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
      paddingRight: body.style.paddingRight,
    },
    htmlStyle: {
      overflow: html.style.overflow,
      overscrollBehavior: html.style.overscrollBehavior,
    },
    siblings,
  };

  const scrollbarWidth = window.innerWidth - html.clientWidth;
  body.style.position = "fixed";
  body.style.top = `-${pageLock.scrollY}px`;
  body.style.left = `-${pageLock.scrollX}px`;
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";
  if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
  html.style.overflow = "hidden";
  html.style.overscrollBehavior = "none";
}

function unlockPageForPalette(restoreScroll = true) {
  const lock = pageLock;
  if (!lock) return;
  const body = document.body;
  const html = document.documentElement;
  body.style.position = lock.bodyStyle.position;
  body.style.top = lock.bodyStyle.top;
  body.style.left = lock.bodyStyle.left;
  body.style.right = lock.bodyStyle.right;
  body.style.width = lock.bodyStyle.width;
  body.style.overflow = lock.bodyStyle.overflow;
  body.style.paddingRight = lock.bodyStyle.paddingRight;
  html.style.overflow = lock.htmlStyle.overflow;
  html.style.overscrollBehavior = lock.htmlStyle.overscrollBehavior;
  lock.siblings.forEach(({ element, supportsInert, inert, ariaHidden }) => {
    if (supportsInert) (element as HTMLElement & { inert: boolean }).inert = inert;
    if (ariaHidden === null) element.removeAttribute("aria-hidden");
    else element.setAttribute("aria-hidden", ariaHidden);
  });
  pageLock = null;
  if (restoreScroll) requestAnimationFrame(() => window.scrollTo(lock.scrollX, lock.scrollY));
}

function keepActiveRowInView(list: HTMLElement, row: HTMLElement) {
  const inset = 12;
  const rowTop = row.offsetTop;
  const rowBottom = rowTop + row.offsetHeight;
  const viewTop = list.scrollTop;
  const viewBottom = viewTop + list.clientHeight;
  if (rowTop < viewTop + inset) {
    list.scrollTo({ top: Math.max(0, rowTop - inset), behavior: "auto" });
  } else if (rowBottom > viewBottom - inset) {
    list.scrollTo({ top: rowBottom - list.clientHeight + inset, behavior: "auto" });
  }
}

function navigate(href: string) {
  playAccent("tap");
  void import("astro:transitions/client")
    .then(({ navigate: astroNavigate }) => astroNavigate(href))
    .catch(() => location.assign(href));
}

function openExternal(href: string) {
  trackOutbound(href);
  window.open(href, "_blank", "noopener,noreferrer");
}

function currentUrl(): string {
  return location.href.split("#")[0];
}

function currentTitle(): string {
  return document.title.replace(/\s·\sAshwin Gopalsamy$/, "");
}

function downloadText(filename: string, value: string, type = "text/plain;charset=utf-8") {
  const blob = new Blob([value], { type });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 0);
}

function createItem(item: Omit<Item, "actions"> & { actions?: ActionItem[] }): Item {
  return { ...item, icon: item.icon ?? paletteFallbackIcon(item.kind), actions: item.actions, trackRecent: item.trackRecent ?? shouldTrackRecent(item.id) };
}

function coreItems(): Item[] {
  return [
    createItem({ id: "action:theme", kind: "action", group: "Quick actions", label: "Toggle theme", subtitle: "Switch between light and dark", hint: "⌘\\", icon: "theme", action: () => document.querySelector<HTMLButtonElement>(".theme-toggle")?.click(), closeOnRun: false }),
    createItem({ id: "action:sound", kind: "action", group: "Quick actions", label: isSoundEnabled() ? "Mute sound" : "Unmute sound", subtitle: "Interface feedback sounds", icon: isSoundEnabled() ? "sound-off" : "sound-on", action: () => { setSoundEnabled(!isSoundEnabled()); showToast({ message: isSoundEnabled() ? "Sound on" : "Sound muted", duration: 1600 }); }, closeOnRun: false }),
    createItem({ id: "action:copy-url", kind: "action", group: "Quick actions", label: "Copy page URL", subtitle: currentUrl(), icon: "link", action: () => copyText(currentUrl(), "Link copied") }),
    createItem({ id: "action:share", kind: "action", group: "Quick actions", label: "Share this page", subtitle: "Use the browser share sheet when available", icon: "share", action: async () => { if (navigator.share) { await navigator.share({ title: currentTitle(), url: currentUrl() }).catch(() => undefined); } else await copyText(currentUrl(), "Link copied"); } }),
    createItem({ id: "action:rss", kind: "action", group: "Quick actions", label: "Open RSS feed", href: "/library/feed.xml", icon: "rss", action: () => navigate("/library/feed.xml") }),
    createItem({ id: "action:help", kind: "action", group: "Quick actions", label: "Keyboard shortcuts", hint: "?", icon: "keyboard", action: () => showHelp(), closeOnRun: false }),
    createItem({ id: "action:clear-history", kind: "action", group: "Quick actions", label: "Clear pinned and recent commands", subtitle: "Removes only local palette history", icon: "trash", action: () => confirmClearHistory(), closeOnRun: false }),
  ];
}

function recipeItem(recipe: QueryRecipe, section = "Try it"): Item {
  return createItem({
    id: `recipe:${recipe.id}`,
    kind: recipe.kind === "calculate" || recipe.kind === "convert" || recipe.kind === "text" || recipe.kind === "utility" ? "utility" : recipe.kind,
    group: section,
    section,
    label: recipe.label,
    subtitle: recipe.subtitle,
    icon: recipe.icon,
    keywords: recipe.keywords,
    closeOnRun: false,
    trackRecent: false,
    action: () => applyRecipe(recipe.query),
  });
}

function recipeItems(section = "Try it", predicate?: (recipe: QueryRecipe) => boolean): Item[] {
  return QUERY_RECIPES.filter((recipe) => !predicate || predicate(recipe)).map((recipe) => recipeItem(recipe, section));
}

function exploreItem(): Item {
  return createItem({
    id: "action:explore",
    kind: "action",
    group: "Explore",
    section: "Explore",
    label: "Explore all capabilities",
    subtitle: "Browse everything this palette can do",
    icon: "library",
    keywords: ["explore", "browse", "all commands", "help", "what can i do", "capabilities", "directory"],
    action: () => showExplore(),
    closeOnRun: false,
    trackRecent: false,
  });
}

function pageItems(): Item[] {
  return PAGES.map((page) => createItem({
    id: `page:${page.href}`,
    kind: "page",
    group: "Pages",
    label: page.label,
    href: page.href,
    hint: page.hint,
    icon: page.icon,
    keywords: page.keywords,
    actions: linkActions(`page:${page.href}`, page.label, page.href, page.href.startsWith("http")),
  }));
}

function downloadResumeItem(): Item | null {
  if (!resumeUrl) return null;
  return createItem({
    id: "resume:download",
    kind: "action",
    group: "Resume",
    section: "Resume",
    label: "Download Resume",
    badge: "PDF",
    subtitle: "AshwinGopalsamy_Resume.pdf",
    icon: "file-down",
    keywords: ["resume", "résumé", "cv", "download", "pdf"],
    action: () => {
      const href = resumeUrl;
      if (!href) return;
      trackDownload("resume_pdf");
      const link = document.createElement("a");
      link.href = href;
      link.download = "AshwinGopalsamy_Resume.pdf";
      link.click();
      showToast({ message: "Resume download started", duration: 1800 });
    },
  });
}

function mobileDirectoryItems(): Item[] {
  const pages = pageItems();
  const pagesByHref = new Map(pages.map((item) => [item.href, item]));
  const primaryPages = mobileNavigation
    .map((entry) => pagesByHref.get(entry.href))
    .filter((item): item is Item => Boolean(item))
    .map((item) => ({ ...item, group: "Pages", section: "Pages", hint: undefined }));
  const allPages = createItem({
    id: "browse:navigate",
    kind: "action",
    group: "Pages",
    section: "Pages",
    label: "All pages",
    subtitle: `${PAGES.length} pages, collections, and essays`,
    icon: "navigate",
    keywords: ["pages", "navigate", "design", "colophon", "library"],
    closeOnRun: false,
    trackRecent: false,
    action: () => showBrowseCategory("navigate"),
  });
  const capabilities = BROWSE_CATEGORIES
    .filter((category) => ["content", "contact", "time", "calculate", "controls", "ai"].includes(category.id))
    .map((category) => createItem({
      id: `browse:${category.id}`,
      kind: "action",
      group: "Capabilities",
      section: "Capabilities",
      label: category.label,
      subtitle: category.id === "content" ? "Search notes, work, books, watch, articles, and tags" : category.id === "contact" ? "Email, calendar, resume, and social links" : category.id === "time" ? "Compare local time across cities" : category.id === "calculate" ? "Calculate, convert, and transform text" : category.id === "controls" ? "Theme, sound, files, and feeds" : "Machine-readable resources and context",
      icon: category.icon,
      keywords: category.keywords,
      closeOnRun: false,
      trackRecent: false,
      action: () => showBrowseCategory(category.id),
    }));
  const resume = downloadResumeItem();
  return dedupe([...(resume ? [resume] : []), ...primaryPages, allPages, ...capabilities]);
}

function linkActions(id: string, label: string, href: string, external = false): ActionItem[] {
  const actions: ActionItem[] = [
    { id: `${id}:open`, label: external ? `Open ${label}` : `Open ${label}`, icon: external ? "external" : "open", action: () => external ? openExternal(href) : navigate(href) },
    { id: `${id}:new-tab`, label: "Open in new tab", icon: "external", action: () => openExternal(href) },
    { id: `${id}:copy`, label: "Copy link", icon: "copy", action: () => copyText(new URL(href, location.origin).href, "Link copied") },
    { id: `${id}:pin`, label: isPinned(id) ? "Unpin command" : "Pin command", icon: isPinned(id) ? "pin-off" : "pin", action: () => { togglePin(id); }, closeOnRun: false },
  ];
  return actions;
}

function contentItems(value: PaletteManifest | null): Item[] {
  if (!value) return [];
  return value.content.map((entry) => createItem({
    id: entry.id,
    kind: "content",
    group: entry.kind === "tag" ? "Tags" : entry.kind === "article" ? "Articles" : entry.kind === "craft" ? "Work" : "Library",
    label: entry.title,
    subtitle: entry.subtitle ?? entry.description,
    href: entry.href,
    external: entry.external,
    icon: paletteContentIcon(entry.kind),
    keywords: entry.keywords,
    actions: linkActions(entry.id, entry.title, entry.href, entry.external),
  }));
}

function aiItems(value: PaletteManifest | null): Item[] {
  if (!value) return [];
  return value.aiResources.map((entry) => createItem({
    id: `ai:${entry.id}`,
    kind: "ai",
    group: "AI and machine-readable",
    label: `Open ${entry.label}`,
    subtitle: entry.description,
    href: entry.href,
    icon: paletteAiIcon(entry.id),
    keywords: ["ai", "agent", "llm", "machine", entry.label],
    actions: [
      ...linkActions(`ai:${entry.id}`, entry.label, entry.href),
      { id: `ai:${entry.id}:copy-content`, label: `Copy ${entry.label}`, icon: "copy", action: () => copyRemoteText(entry.href, `${entry.label} copied`) },
    ],
  }));
}

function profileItems(value: PaletteManifest | null): Item[] {
  if (!value) return [];
  const { profile } = value;
  const items: Item[] = [
    createItem({ id: "contact:email-copy", kind: "action", group: "Contact", label: "Copy email", subtitle: profile.email, icon: "copy", keywords: ["email", "mail", "contact"], action: () => copyText(profile.email, "Email copied") }),
    createItem({ id: "contact:email", kind: "action", group: "Contact", label: "Email Ashwin", subtitle: profile.email, icon: "mail", keywords: ["email", "mail", "contact"], href: `mailto:${profile.email}`, action: () => location.assign(`mailto:${profile.email}`) }),
    createItem({ id: "contact:call", kind: "action", group: "Contact", label: "Book a call", subtitle: profile.calendarUrl, icon: "call", keywords: ["call", "calendar", "cal", "meeting"], href: profile.calendarUrl, action: () => openExternal(profile.calendarUrl) }),
    createItem({ id: "contact:location", kind: "action", group: "Contact", label: "Copy location", subtitle: profile.location, icon: "location", keywords: ["location", "pollachi", "tamil nadu"], action: () => copyText(profile.location, "Location copied") }),
    createItem({ id: "contact:card", kind: "action", group: "Contact", label: "Copy contact card", subtitle: `${profile.name} · ${profile.role}`, icon: "contact", keywords: ["contact", "card", "vcard"], action: () => copyText(contactCard(profile), "Contact card copied") }),
    createItem({ id: "contact:vcard", kind: "action", group: "Contact", label: "Download contact card", subtitle: "Ashwin-Gopalsamy.vcf", icon: "download", keywords: ["contact", "card", "vcard", "download"], action: () => { downloadText("Ashwin-Gopalsamy.vcf", vCard(profile), "text/vcard;charset=utf-8"); showToast({ message: "Contact card downloaded", duration: 1800 }); } }),
    createItem({ id: "contact:x-copy", kind: "action", group: "Contact", label: "Copy X handle", subtitle: profile.links.find((link) => link.id === "x")?.handle ?? "@ashwin2125", icon: "handle", keywords: ["x", "twitter", "handle", "social"], action: () => copyText(profile.links.find((link) => link.id === "x")?.handle ?? "@ashwin2125", "X handle copied") }),
  ];
  profile.links.forEach((link) => {
    items.push(createItem({
      id: `contact:${link.id}`,
      kind: "action",
      group: "Contact",
      label: `Open ${link.label}`,
      subtitle: link.handle,
      href: link.href,
      external: !link.mail,
      icon: profileIconKey(link.id),
      keywords: [link.label, link.handle, "social", "profile"],
      action: () => link.mail ? location.assign(link.href) : openExternal(link.href),
      actions: linkActions(`contact:${link.id}`, link.label, link.href, !link.mail),
    }));
  });
  items.push(createItem({ id: "resume:profile", kind: "action", group: "Contact", label: "Open hosted Resume", subtitle: "Standard Resume", href: profile.resumeProfileUrl, external: true, icon: "resume", keywords: ["resume", "résumé", "cv", "profile"], action: () => openExternal(profile.resumeProfileUrl) }));
  if (profile.resumeUrl) {
    items.push(createItem({ id: "resume:download", kind: "action", group: "Contact", label: "Download Resume", badge: "PDF", subtitle: "AshwinGopalsamy_Resume.pdf", icon: "file-down", keywords: ["resume", "résumé", "cv", "download", "pdf"], action: () => { const link = document.createElement("a"); link.href = profile.resumeUrl ?? ""; link.download = "AshwinGopalsamy_Resume.pdf"; link.click(); showToast({ message: "Resume download started", duration: 1800 }); } }));
    items.push(createItem({ id: "resume:copy", kind: "action", group: "Contact", label: "Copy Resume link", subtitle: profile.resumeUrl, icon: "copy", keywords: ["résumé", "cv", "copy"], action: () => copyText(new URL(profile.resumeUrl ?? "", location.origin).href, "Resume link copied") }));
  }
  items.push(
    createItem({ id: "files:copy-site-url", kind: "action", group: "Files and links", label: "Copy site URL", subtitle: profile.siteUrl, icon: "link", keywords: ["site", "url", "link", "copy"], action: () => copyText(profile.siteUrl, "Site URL copied") }),
    createItem({ id: "files:source", kind: "action", group: "Files and links", label: "Open site source", subtitle: profile.repoUrl, href: profile.repoUrl, external: true, icon: "source", keywords: ["source", "github", "repo", "code"], action: () => openExternal(profile.repoUrl), actions: linkActions("files:source", "site source", profile.repoUrl, true) }),
    createItem({ id: "files:humans", kind: "action", group: "Files and links", label: "View humans.txt", subtitle: "A small note from the person behind the site", href: "/humans.txt", icon: "resume", keywords: ["humans", "about", "people"], action: () => navigate("/humans.txt"), actions: linkActions("files:humans", "humans.txt", "/humans.txt") }),
    createItem({ id: "files:view-source", kind: "action", group: "Files and links", label: "View source of this page", subtitle: "Open the browser's source view", icon: "source-page", keywords: ["source", "html", "inspect", "code"], action: () => openExternal(`view-source:${location.href}`) }),
  );
  return items;
}

function contactCard(profile: PaletteManifest["profile"]): string {
  return [profile.name, `${profile.role} · ${profile.company}`, profile.email, profile.siteUrl, profile.location].join("\n");
}

function vCard(profile: PaletteManifest["profile"]): string {
  return [
    "BEGIN:VCARD",
    "VERSION:4.0",
    `FN:${profile.name}`,
    `ORG:${profile.company}`,
    `TITLE:${profile.role}`,
    `EMAIL;TYPE=work:${profile.email}`,
    `URL:${profile.siteUrl}`,
    `ADR;TYPE=work:;;${profile.location};;;;`,
    "END:VCARD",
  ].join("\r\n");
}

async function copyRemoteText(href: string, message: string) {
  try {
    const response = await fetch(href, { credentials: "same-origin" });
    if (!response.ok) throw new Error("Request failed");
    await copyText(await response.text(), message);
  } catch {
    showToast({ message: "That file could not be read", duration: 2200 });
  }
}

function helpItems(): Item[] {
  const shortcuts = [
    createItem({ id: "help:open", kind: "action", group: "Shortcuts", section: "Shortcuts", label: "Open palette", subtitle: "Slash or Command/Ctrl K", hint: "/ · ⌘K", icon: "command", action: () => goBack(), closeOnRun: false, trackRecent: false }),
    createItem({ id: "help:navigate", kind: "action", group: "Shortcuts", section: "Shortcuts", label: "Navigate results", subtitle: "Arrow keys, Home, End", hint: "↑↓", icon: "navigate", closeOnRun: false, trackRecent: false }),
    createItem({ id: "help:actions", kind: "action", group: "Shortcuts", section: "Shortcuts", label: "Open actions for a result", subtitle: "Show copy, open, pin, and secondary actions", hint: "⌘K", icon: "actions", closeOnRun: false, trackRecent: false }),
    createItem({ id: "help:back", kind: "action", group: "Shortcuts", section: "Shortcuts", label: "Go back or close", subtitle: "Escape backs out before closing", hint: "esc", icon: "back", action: () => goBack(), closeOnRun: false, trackRecent: false }),
  ];
  const examples = recipeItems("Try it", (recipe) => recipe.kind !== "fun" || recipe.id === "fun-dice" || recipe.id === "fun-coin");
  const ai = createItem({ id: "help:ai", kind: "ai", group: "Try it", section: "Try it", label: "Copy AI context", subtitle: "Copy llms-ctx.txt for an agent", keywords: ["ai", "llm", "agent", "context"], icon: "ai", action: () => copyRemoteText("/llms-ctx.txt", "AI context copied"), closeOnRun: false, trackRecent: false });
  return [...shortcuts, ...examples, ai];
}

function staticItems(value: PaletteManifest | null): Item[] {
  return [...coreItems(), exploreItem(), ...recipeItems(), ...pageItems(), ...profileItems(value), ...aiItems(value), ...contentItems(value),
    createItem({ id: "action:random-note", kind: "action", group: "Quick actions", label: "Random note", subtitle: "Open a note chosen from the library", icon: "random", keywords: ["random", "note", "surprise", "library"], action: () => randomNote(value) }),
    createItem({ id: "fun:coin", kind: "fun", group: "Surprises", label: "Flip a coin", subtitle: "A local random result", icon: "coin", keywords: ["coin", "random"], action: () => { showToast({ message: roll(2) === 1 ? "Heads" : "Tails", duration: 1600 }); } }),
    createItem({ id: "fun:dice", kind: "fun", group: "Surprises", label: "Roll a die", subtitle: "Roll d6, d20, or any dN", icon: "dice", keywords: ["dice", "random", "roll"], action: () => { showToast({ message: `You rolled ${roll(6)}`, duration: 1600 }); } }),
    createItem({ id: "fun:quote", kind: "fun", group: "Surprises", label: "Copy a random quote", subtitle: "A line from the collection", icon: "quote", keywords: ["quote", "fortune", "inspire"], action: () => { const quote = randomChoice(value?.quotes ?? []); if (quote) void copyText(`“${quote.text}”\n - ${quote.author}`, "Quote copied"); else showToast({ message: "No quotes available", duration: 1800 }); } }),
    createItem({ id: "fun:surprise", kind: "fun", group: "Surprises", label: "Surprise me", subtitle: "Open something unexpected", icon: "surprise", keywords: ["random", "surprise", "fun"], action: () => surprise(value) }),
    createItem({ id: "fun:uuid", kind: "utility", group: "Utilities", label: "Generate UUID", subtitle: "A local UUID v4", icon: "hash", keywords: ["uuid", "id", "random"], action: () => { const value = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`; void copyText(value, "UUID copied"); } }),
    createItem({ id: "fun:password", kind: "utility", group: "Utilities", label: "Generate password", subtitle: "A local 20-character password", icon: "password", keywords: ["password", "secret", "random"], action: () => void copyText(generatePassword(), "Password copied") }),
  ];
}

function randomNote(value: PaletteManifest | null) {
  const notes = (value?.content ?? []).filter((entry) => entry.kind === "note");
  const note = randomChoice(notes);
  if (note) navigate(note.href);
  else showToast({ message: "No notes available yet", duration: 1800 });
}

function surprise(value: PaletteManifest | null) {
  const choices = [...(value?.content ?? [])].filter((entry) => entry.kind !== "tag");
  const choice = randomChoice(choices);
  if (choice) navigate(choice.href);
  else showToast({ message: "The site is still gathering surprises", duration: 1800 });
}

function applyRecipe(query: string) {
  if (!open) return;
  viewStack = [];
  resultSummary = null;
  expandedQueryKey = "";
  pendingActiveItemId = undefined;
  setMode("search", "");
  items = [];
  activeIndex = 0;
  const { input } = els();
  if (input) {
    input.value = query;
    input.readOnly = false;
    input.focus();
  }
  renderList();
}

function categoryCount(category: BrowseCategory, value: PaletteManifest | null): number | null {
  if (!value && ["content", "contact", "ai"].includes(category.id)) return null;
  if (category.id === "navigate") return PAGES.length;
  if (category.id === "content") return value?.content.length ?? 0;
  if (category.id === "contact") return profileItems(value).filter((item) => item.group === "Contact").length;
  if (category.id === "time") return 1 + QUERY_RECIPES.filter((recipe) => recipe.kind === "time").length;
  if (category.id === "calculate") return QUERY_RECIPES.filter((recipe) => ["calculate", "convert", "text"].includes(recipe.kind)).length;
  if (category.id === "controls") return coreItems().length + profileItems(value).filter((item) => item.group === "Files and links").length;
  if (category.id === "ai") return value?.aiResources.length ?? 0;
  return staticItems(value).filter((item) => item.kind === "fun" || item.id === "action:random-note" || item.id === "fun:uuid" || item.id === "fun:password").length + QUERY_RECIPES.filter((recipe) => recipe.kind === "fun").length;
}

function exploreItems(value: PaletteManifest | null, loading = false): Item[] {
  if (loading) {
    return [createItem({ id: "browse:loading", kind: "action", group: "Explore", section: "Explore", label: "Loading capabilities…", subtitle: "Gathering commands and site content", icon: "time", closeOnRun: false, trackRecent: false, action: () => undefined })];
  }
  return BROWSE_CATEGORIES.map((category) => {
    const count = categoryCount(category, value);
    const unavailable = count === null;
    return createItem({
      id: `browse:${category.id}`,
      kind: "action",
      group: "Capabilities",
      section: "Capabilities",
      label: category.label,
      subtitle: unavailable ? "Unavailable until site content loads" : `${count} command${count === 1 ? "" : "s"}`,
      icon: category.icon,
      keywords: category.keywords,
      closeOnRun: false,
      trackRecent: false,
      action: () => showBrowseCategory(category.id),
    });
  });
}

function unavailableItems(category: BrowseCategory): Item[] {
  return [createItem({ id: `browse:${category.id}:unavailable`, kind: "action", group: category.label, section: category.label, label: "Content is unavailable", subtitle: "Try again when the site manifest is reachable", icon: "alert", keywords: category.keywords, closeOnRun: false, trackRecent: false, action: () => showToast({ message: "Site content is unavailable right now", duration: 1800 }) })];
}

function categoryItems(categoryId: string, value: PaletteManifest | null): Item[] {
  const category = BROWSE_CATEGORIES.find((entry) => entry.id === categoryId);
  if (!category) return [];
  if (!value && ["content", "contact", "ai"].includes(categoryId)) return unavailableItems(category);
  let categoryRows: Item[];
  if (categoryId === "navigate") {
    categoryRows = pageItems();
  } else if (categoryId === "content") {
    categoryRows = contentItems(value);
  } else if (categoryId === "contact") {
    categoryRows = profileItems(value).filter((item) => item.group === "Contact");
  } else if (categoryId === "time") {
    categoryRows = [currentTimeItem(value), ...recipeItems("Time recipes", (recipe) => recipe.kind === "time")];
  } else if (categoryId === "calculate") {
    categoryRows = recipeItems("Calculate and transform", (recipe) => ["calculate", "convert", "text"].includes(recipe.kind));
  } else if (categoryId === "controls") {
    categoryRows = [...coreItems(), ...profileItems(value).filter((item) => item.group === "Files and links")];
  } else if (categoryId === "ai") {
    categoryRows = aiItems(value);
  } else {
    categoryRows = [
      ...staticItems(value).filter((item) => item.kind === "fun" || item.id === "action:random-note" || item.id === "fun:uuid" || item.id === "fun:password"),
      ...recipeItems("Fun recipes", (recipe) => recipe.kind === "fun"),
    ];
  }
  if (categoryId === "content") categoryRows.sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));
  return dedupe(categoryRows).map((item) => ({ ...item, section: item.section ?? item.group }));
}

function pushView() {
  const { input, list } = els();
  viewStack.push({
    mode,
    title: currentContextTitle,
    items,
    query: input?.value ?? "",
    activeIndex,
    scrollTop: list?.scrollTop ?? 0,
    resultSummary,
  });
}

function showExplore() {
  if (!open) return;
  pushView();
  setMode("browse", "Explore capabilities");
  resultSummary = null;
  items = exploreItems(manifest, !manifest);
  activeIndex = 0;
  renderList();
  focusNestedList();
  if (manifest) return;
  void loadManifest().then((value) => {
    if (!open || mode !== "browse" || currentContextTitle !== "Explore capabilities") return;
    items = exploreItems(value);
    activeIndex = 0;
    renderList();
    focusNestedList();
  });
}

function showBrowseCategory(categoryId: string) {
  const category = BROWSE_CATEGORIES.find((entry) => entry.id === categoryId);
  if (!category || !open) return;
  pushView();
  setMode("browse", category.label);
  resultSummary = null;
  items = categoryItems(categoryId, manifest);
  activeIndex = 0;
  renderList();
  focusNestedList();
  if (manifest) return;
  void loadManifest().then((value) => {
    if (!open || mode !== "browse" || currentContextTitle !== category.label) return;
    items = categoryItems(categoryId, value);
    activeIndex = 0;
    renderList();
    focusNestedList();
  });
}

function scoreItem(item: Item, query: string): number | null {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return 0;
  const fields = [item.label, item.subtitle ?? "", ...(item.keywords ?? [])].map((value) => value.toLocaleLowerCase());
  const tokens = needle.split(/\s+/).filter(Boolean);
  let score = 0;
  for (const token of tokens) {
    const exact = fields.some((field) => field === token);
    const prefix = fields.some((field) => field.startsWith(token));
    const contains = fields.some((field) => field.includes(token));
    if (exact) score += 1000;
    else if (prefix) score += 650;
    else if (contains) score += 350;
    else {
      const compact = fields.join(" ");
      let cursor = 0;
      for (const letter of token) {
        cursor = compact.indexOf(letter, cursor) + 1;
        if (!cursor) break;
      }
      if (!cursor) return null;
      score += 80;
    }
  }
  if (isPinned(item.id)) score += 45;
  const recent = storedState.recent.find((entry) => entry.id === item.id);
  if (recent) score += Math.min(40, recent.count * 2);
  return score;
}

function rank(itemsToRank: Item[], query: string): Item[] {
  return itemsToRank
    .map((item) => ({ ...item, score: scoreItem(item, query) }))
    .filter((item): item is Item & { score: number } => item.score !== null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.label.localeCompare(b.label));
}

function emptyItems(value: PaletteManifest | null): Item[] {
  const all = staticItems(value);
  const pinned = storedState.pins.map((id) => all.find((item) => item.id === id)).filter((item): item is Item => Boolean(item)).slice(0, 4);
  const pinnedIds = new Set(pinned.map((item) => item.id));
  const recent = [...storedState.recent]
    .map((entry) => all.find((item) => item.id === entry.id))
    .filter((item): item is Item => Boolean(item))
    .filter((item) => !pinnedIds.has(item.id))
    .slice(0, 4);
  const now = currentTimeItem(value);
  const suggestionIds = ["page:/work/", "page:/library/", "contact:email-copy", "contact:call", "resume:download", "resume:profile", "action:random-note"];
  const used = new Set([...pinnedIds, ...recent.map((item) => item.id)]);
  const suggestions = suggestionIds
    .map((id) => all.find((item) => item.id === id))
    .filter((item): item is Item => Boolean(item))
    .filter((item) => !used.has(item.id))
    .map((item) => ({ ...item, group: "Suggested", section: "Suggested" }));
  const recipeRows = ROOT_RECIPE_IDS.map((id) => recipeById(id)).filter((recipe): recipe is QueryRecipe => Boolean(recipe)).map((recipe) => recipeItem(recipe));
  const exploreRows = [exploreItem(), all.find((item) => item.id === "action:help")].filter((item): item is Item => Boolean(item)).map((item) => ({ ...item, group: "Explore", section: "Explore", trackRecent: false, closeOnRun: false }));
  const remaining = Math.max(0, 16 - 1 - pinned.length - recent.length - recipeRows.length - exploreRows.length);
  const taggedPinned = pinned.map((item) => ({ ...item, group: "Pinned", section: "Pinned" }));
  const taggedRecent = recent.map((item) => ({ ...item, group: "Recent", section: "Recent" }));
  return dedupe([now, ...taggedPinned, ...taggedRecent, ...recipeRows, ...exploreRows, ...suggestions.slice(0, remaining)]);
}

function dedupe(value: Item[]): Item[] {
  const seen = new Set<string>();
  return value.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function currentTimeItem(value: PaletteManifest | null): Item {
  const zone = value?.profile.timeZone ?? "Asia/Kolkata";
  return createItem({ id: "time:pollachi", kind: "time", group: "Right now", label: `Ashwin's time in ${value?.profile.locationShort ?? "Pollachi"}`, subtitle: "Live local clock · select to copy", icon: "time", keywords: ["time", "clock", "now", "pollachi", "timezone"], live: () => formatNativeTime(zone), action: () => copyText(`${value?.profile.locationShort ?? "Pollachi"}: ${formatNativeTime(zone)} (${zone})`, "Time copied"), actions: [{ id: "time:pollachi:copy", label: "Copy Pollachi time", icon: "copy", action: () => copyText(`${value?.profile.locationShort ?? "Pollachi"}: ${formatNativeTime(zone)} (${zone})`, "Time copied") }, { id: "time:pollachi:local", label: "Copy visitor and Pollachi times", icon: "compare", action: () => copyText(`Pollachi: ${formatNativeTime(zone)}\nYour time: ${formatNativeTime(browserZone())}`, "Times copied") }, { id: "time:pollachi:pin", label: isPinned("time:pollachi") ? "Unpin command" : "Pin command", icon: isPinned("time:pollachi") ? "pin-off" : "pin", action: () => togglePin("time:pollachi"), closeOnRun: false }] });
}

function webSearchItems(query: string): Item[] {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const encoded = encodeURIComponent(trimmed);
  return [
    createItem({ id: `web:google:${trimmed}`, kind: "action", group: "Search the web", label: `Search Google for “${trimmed}”`, subtitle: "Open in a new tab", href: `https://www.google.com/search?q=${encoded}`, external: true, icon: "search", keywords: ["google", "web", "search"], action: () => openExternal(`https://www.google.com/search?q=${encoded}`), actions: linkActions(`web:google:${trimmed}`, "Google search", `https://www.google.com/search?q=${encoded}`, true) }),
    createItem({ id: `web:duckduckgo:${trimmed}`, kind: "action", group: "Search the web", label: `Search DuckDuckGo for “${trimmed}”`, subtitle: "Open in a new tab", href: `https://duckduckgo.com/?q=${encoded}`, external: true, icon: "search", keywords: ["duckduckgo", "web", "search", "private"], action: () => openExternal(`https://duckduckgo.com/?q=${encoded}`), actions: linkActions(`web:duckduckgo:${trimmed}`, "DuckDuckGo search", `https://duckduckgo.com/?q=${encoded}`, true) }),
  ];
}

async function smartItems(query: string, value: PaletteManifest | null): Promise<Item[]> {
  const result: Item[] = [];
  const trimmed = query.trim();
  const lower = trimmed.toLocaleLowerCase();
  const calcInput = trimmed.replace(/^(?:calc|calculate)\s+/i, "");
  if (isCalculationQuery(trimmed)) {
    const answer = calculate(calcInput);
    result.push(createItem({ id: `utility:calc:${trimmed}`, kind: "utility", group: "Quick answer", label: answer === null ? "That calculation is not valid" : `Calculate ${trimmed}`, subtitle: answer === null ? "Use numbers, parentheses, and + - * / % ^" : `${formatCalculation(answer)} · press Enter to copy`, value: answer === null ? undefined : formatCalculation(answer), icon: answer === null ? "alert" : "calculator", keywords: ["calculator", "math", "calc"], action: answer === null ? () => undefined : () => copyText(formatCalculation(answer), "Result copied") }));
  }
  const conversion = convertQuery(trimmed);
  if (conversion) {
    result.push(createItem({ id: `utility:convert:${trimmed}`, kind: "utility", group: "Quick answer", label: conversion.label, subtitle: "Local unit conversion · press Enter to copy", value: conversion.label, icon: "convert", keywords: ["convert", "conversion", "units"], action: () => copyText(conversion.label, "Conversion copied") }));
  }
  const transformed = transformText(trimmed);
  if (transformed !== null) {
    result.push(createItem({ id: `utility:text:${trimmed}`, kind: "utility", group: "Quick answer", label: "Transform text", subtitle: transformed, value: transformed, icon: "text", keywords: ["text", "uppercase", "lowercase", "slug", "encode"], action: () => copyText(transformed, "Text copied") }));
  }
  if (/^(?:generate\s+)?uuid$/i.test(trimmed)) {
    const value = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    result.push(createItem({ id: "utility:uuid:result", kind: "utility", group: "Quick answer", label: value, subtitle: "UUID v4 · press Enter to copy", value, icon: "hash", keywords: ["uuid", "random"], action: () => copyText(value, "UUID copied") }));
  }
  const password = trimmed.match(/^(?:generate\s+)?password(?:\s+(16|20|24|32))?$/i);
  if (password) {
    const value = generatePassword(Number(password[1] ?? 20));
    result.push(createItem({ id: "utility:password:result", kind: "utility", group: "Quick answer", label: "Generate a local password", subtitle: `${value.length} characters · press Enter to copy`, value, icon: "password", keywords: ["password", "secret", "random"], action: () => copyText(value, "Password copied") }));
  }
  const dice = trimmed.match(/^roll\s+d?(\d{1,3})$/i);
  if (dice) {
    const sides = Number(dice[1]);
    if (sides > 0) {
      const value = String(roll(sides));
      result.push(createItem({ id: `fun:dice:${sides}`, kind: "fun", group: "Quick answer", label: `Roll d${sides}: ${value}`, subtitle: "Press Enter to copy or roll again", value, icon: "dice", keywords: ["dice", "roll", "random"], action: () => copyText(value, "Roll copied") }));
    }
  }
  if (/^(?:coin|flip(?:\s+a)?\s+coin)$/i.test(trimmed)) {
    const value = roll(2) === 1 ? "Heads" : "Tails";
    result.push(createItem({ id: "fun:coin:result", kind: "fun", group: "Quick answer", label: value, subtitle: "Coin flip · press Enter to copy", value, icon: "coin", keywords: ["coin", "random"], action: () => copyText(value, "Coin flip copied") }));
  }
  if (/^(?:whoami|sudo\s+hire\s+ashwin|42|vanakkam|coffee)$/i.test(trimmed)) {
    const messages: Record<string, string> = {
      whoami: value?.profile.name ?? "Ashwin Gopalsamy",
      "sudo hire ashwin": "Permission granted. Start with a conversation.",
      "42": "The answer is still 42.",
      vanakkam: "Vanakkam from Pollachi.",
      coffee: "The cafe guide is still brewing.",
    };
    const message = messages[lower] ?? messages.whoami;
    result.push(createItem({ id: `fun:easter:${lower}`, kind: "fun", group: "Easter eggs", label: message, subtitle: "A small site secret · press Enter to copy", value: message, icon: "egg", keywords: ["fun", "secret", lower], action: () => copyText(message, "Copied") }));
  }
  const timeKeyword = ["pollachi", "kolkata", "tamil nadu", "ist", "local", "utc", "gmt", "london", "uk", "brazil", "sao paulo", "austin", "texas", "singapore", "dubai", "uae", "tokyo", "japan", "new york", "nyc", "san francisco", "sf", "sydney", "australia"];
  const looksLikeClock = /^(?:today|tomorrow)?\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?$/i.test(trimmed);
  const looksLikeTimeConversion = /^(?:convert\s+)?(?:today|tomorrow)?\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?(?:\s+[\w./ -]+)?\s+(?:to|in)\s+[\w./ -]+$/i.test(trimmed);
  if (/^(?:time|now|clock|timezone|tz|zone)(?:\s|$)/i.test(trimmed) || looksLikeClock || looksLikeTimeConversion || timeKeyword.includes(lower)) {
    try {
      const time = await loadTime();
      const siteZone = value?.profile.timeZone ?? "Asia/Kolkata";
      const visitorZone = browserZone();
      const directZone = time.zoneChoice(trimmed, visitorZone);
      const bareRows = time.timeConversionRows(trimmed, siteZone, visitorZone);
      if (trimmed.match(/^(?:time|now|clock)$/i)) {
        result.unshift(...time.FAVORITE_ZONES.slice(0, 10).map((choice) => timeItem(choice.label, choice.zone === "local" ? browserZone() : choice.zone, value)));
      } else if (bareRows.length) {
        const group = `${time.formatClock(bareRows[0].source)} in ${bareRows[0].sourceLabel} is…`;
        result.unshift(...bareRows.map((conversion) => {
          const label = `${time.formatClock(conversion.target)} in ${conversion.targetLabel}`;
          const copyLabel = time.conversionLabel(conversion);
          return createItem({ id: `time:convert:${trimmed}:${conversion.targetZone}`, kind: "time", group, label, subtitle: `${time.offsetLabel(conversion.source, conversion.target)} · press Enter to copy`, value: copyLabel, icon: "time", keywords: ["time", "timezone", "convert", conversion.targetLabel], action: () => copyText(copyLabel, "Time conversion copied"), actions: [{ id: `time:convert:${trimmed}:${conversion.targetZone}:copy`, label: "Copy conversion", icon: "copy", action: () => copyText(copyLabel, "Time conversion copied") }, { id: `time:convert:${trimmed}:${conversion.targetZone}:pin`, label: isPinned(`time:convert:${trimmed}:${conversion.targetZone}`) ? "Unpin command" : "Pin command", icon: isPinned(`time:convert:${trimmed}:${conversion.targetZone}`) ? "pin-off" : "pin", action: () => togglePin(`time:convert:${trimmed}:${conversion.targetZone}`), closeOnRun: false }] });
        }));
      } else if (directZone) {
        result.unshift(timeItem(directZone.label, directZone.zone, value));
      } else {
        const parsed = time.parseTimeQuery(trimmed, siteZone, visitorZone);
        if (parsed && "zone" in parsed) {
          result.unshift(timeItem(parsed.zone.label, parsed.zone.zone, value));
        } else if (parsed) {
          const label = time.conversionLabel(parsed);
          result.unshift(createItem({ id: `time:convert:${trimmed}`, kind: "time", group: "Quick answer", label, subtitle: "Luxon timezone conversion · press Enter to copy", value: label, icon: "time", keywords: ["time", "timezone", "convert"], action: () => copyText(label, "Time conversion copied"), actions: [{ id: `time:convert:${trimmed}:copy`, label: "Copy conversion", icon: "copy", action: () => copyText(label, "Time conversion copied") }, { id: `time:convert:${trimmed}:reverse`, label: "Copy source time", icon: "repeat", action: () => copyText(time.formatTime(parsed.source, false), "Source time copied") }] }));
        }
      }
    } catch {
      result.push(createItem({ id: "time:unavailable", kind: "time", group: "Time", label: "Time tools are unavailable", subtitle: "Try a city name such as Tokyo or London", icon: "alert", keywords: ["time", "timezone"], action: () => undefined }));
    }
  }
  return result;
}

function timeItem(label: string, zone: string, value: PaletteManifest | null): Item {
  const labelText = label === "Your local time" ? "Your local time" : `${label} time`;
  return createItem({ id: `time:${zone}`, kind: "time", group: "Time", label: labelText, subtitle: "Live clock · select to copy", icon: "time", live: () => formatNativeTime(zone), keywords: ["time", "clock", "timezone", label], action: () => copyText(`${label}: ${formatNativeTime(zone)} (${zone})`, "Time copied"), actions: [{ id: `time:${zone}:copy`, label: "Copy time", icon: "copy", action: () => copyText(`${label}: ${formatNativeTime(zone)} (${zone})`, "Time copied") }, { id: `time:${zone}:copy-compare`, label: "Copy with Pollachi", icon: "compare", action: () => copyText(`${label}: ${formatNativeTime(zone)}\nPollachi: ${formatNativeTime(value?.profile.timeZone ?? "Asia/Kolkata")}`, "Times copied") }, { id: `time:${zone}:pin`, label: isPinned(`time:${zone}`) ? "Unpin command" : "Pin command", icon: isPinned(`time:${zone}`) ? "pin-off" : "pin", action: () => togglePin(`time:${zone}`), closeOnRun: false }] });
}

function sanitizeExcerpt(value: string): string {
  return value
    .replace(/<mark\b[^>]*>/gi, "<mark>")
    .replace(/<\/mark>/gi, "</mark>")
    .replace(/<(?!\/?mark>)[^>]*>/gi, "");
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
}

function renderList() {
  const { list, status, input } = els();
  if (!list) return;
  if (!items.length) {
    list.innerHTML = '<div class="palette-empty" role="presentation">Nothing matches. Try a page, command, city, or calculation.</div>';
    if (status) status.textContent = "No results";
    input?.removeAttribute("aria-activedescendant");
    list.removeAttribute("aria-activedescendant");
    setFooter(mode);
    return;
  }
  let html = "";
  let lastGroup = "";
  items.forEach((item, index) => {
    const section = item.section ?? item.group;
    if (section !== lastGroup) {
      lastGroup = section;
      html += `<div class="palette-group" role="presentation">${escapeHtml(section)}</div>`;
    }
    const selected = index === activeIndex ? "true" : "false";
    const icon = iconMarkup(item.icon ?? paletteFallbackIcon(item.kind));
    const subtitle = item.live ? `<span class="palette-subtitle palette-live" data-live-id="${escapeHtml(item.id)}">${escapeHtml(item.live())}</span>` : item.subtitle ? `<span class="palette-subtitle">${escapeHtml(item.subtitle)}</span>` : "";
    const excerpt = item.excerptHtml ? `<span class="palette-excerpt">${item.excerptHtml}</span>` : item.value && !item.live ? `<span class="palette-subtitle palette-value">${escapeHtml(item.value)}</span>` : "";
    const label = item.badge ? `<span class="palette-label"><span class="palette-label-text">${escapeHtml(item.label)}</span><span class="palette-badge">${escapeHtml(item.badge)}</span></span>` : `<span class="palette-label"><span class="palette-label-text">${escapeHtml(item.label)}</span></span>`;
    const hint = item.hint ? `<kbd class="palette-kbd">${escapeHtml(item.hint)}</kbd>` : "";
    const context = item.context ? `<span class="palette-meta">${escapeHtml(item.context)}</span>` : "";
    const external = item.external ? `<span class="palette-meta palette-external" aria-label="External link">${iconMarkup("external")}</span>` : "";
    const disabled = item.disabled ? ' aria-disabled="true"' : "";
    html += `<div class="palette-item" role="option" id="palette-opt-${index}" data-index="${index}" aria-selected="${selected}"${disabled}><span class="palette-icon">${icon}</span><span class="palette-item-main">${label}${subtitle}${excerpt}</span>${context}${external}${hint}</div>`;
  });
  list.innerHTML = html;
  hydratePaletteIcons(list);
  if (status) status.textContent = resultSummary ? `${resultSummary.shown} of ${resultSummary.total} matches` : `${items.length} result${items.length === 1 ? "" : "s"}`;
  list.querySelectorAll<HTMLElement>(".palette-item").forEach((row) => {
    row.addEventListener("pointerenter", () => {
      if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
      activeIndex = Number(row.dataset.index);
      syncActive();
    });
    row.addEventListener("click", () => {
      activeIndex = Number(row.dataset.index);
      if (items[activeIndex]?.disabled) return;
      void activate();
    });
  });
  setFooter(mode);
  syncActive();
}

function syncActive() {
  const { list, input } = els();
  if (!list) return;
  let selectedRow: HTMLElement | null = null;
  list.querySelectorAll<HTMLElement>(".palette-item").forEach((row) => {
    const selected = Number(row.dataset.index) === activeIndex;
    row.setAttribute("aria-selected", selected ? "true" : "false");
    if (selected) {
      selectedRow = row;
      keepActiveRowInView(list, row);
      const activeSurface = mode === "search" ? input : list;
      activeSurface?.setAttribute("aria-activedescendant", row.id);
    }
  });
  if (mode === "search" || !selectedRow) list.removeAttribute("aria-activedescendant");
  if (mode !== "search" || !selectedRow) input?.removeAttribute("aria-activedescendant");
  setFooter(mode);
}

function startTicker() {
  window.clearInterval(timeTicker);
  timeTicker = window.setInterval(() => {
    if (!open) return;
    document.querySelectorAll<HTMLElement>("[data-live-id]").forEach((element) => {
      const item = items.find((value) => value.id === element.dataset.liveId);
      if (item?.live) element.textContent = item.live();
    });
  }, 1000);
}

function stopTicker() {
  window.clearInterval(timeTicker);
  timeTicker = undefined;
}

function queryKey(query: string): string {
  return query.trim().toLocaleLowerCase();
}

function showAllItem(query: string, total: number, firstHidden: Item | undefined): Item {
  return createItem({
    id: `matches:show-all:${queryKey(query)}`,
    kind: "action",
    group: "Matches",
    section: "Matches",
    label: `Show all ${total} matches`,
    subtitle: "Reveal every local command and piece of content",
    icon: "open",
    keywords: ["show all", "more", "matches", "results"],
    closeOnRun: false,
    trackRecent: false,
    action: () => {
      expandedQueryKey = queryKey(query);
      pendingActiveItemId = firstHidden?.id;
    },
  });
}

async function refresh(query: string) {
  if (!open || mode !== "search") return;
  const version = ++queryVersion;
  const value = manifest;
  const trimmed = query.trim();
  const preferredActiveId = pendingActiveItemId ?? items[activeIndex]?.id;
  const localMatches = trimmed ? rank(staticItems(value), query) : [];
  const truncated = trimmed ? truncateMatches(localMatches, expandedQueryKey === queryKey(query)) : { items: [], summary: null, hidden: undefined };
  resultSummary = truncated.summary;
  const base = trimmed
    ? truncated.items.map((item) => ({ ...item, section: "Matches", context: item.group }))
    : emptyItems(value);
  if (trimmed && truncated.summary && !truncated.summary.expanded) base.push(showAllItem(query, truncated.summary.total, truncated.hidden));
  const smart = trimmed
    ? (await smartItems(query, value)).map((item) => ({ ...item, section: "Quick answer", context: item.group !== "Quick answer" ? item.group : undefined }))
    : [];
  const web = trimmed ? webSearchItems(query).map((item) => ({ ...item, section: "Search the web" })) : [];
  if (version !== queryVersion || !open || mode !== "search") return;
  pendingActiveItemId = undefined;
  items = dedupe([...smart, ...base, ...web]);
  activeIndex = preferredActiveId ? Math.max(0, items.findIndex((item) => item.id === preferredActiveId)) : 0;
  if (activeIndex < 0) activeIndex = 0;
  renderList();
  if (!trimmed) return;
  if (trimmed.length < 2) return;
  const pf = await loadPagefind();
  if (!pf || version !== queryVersion || mode !== "search") return;
  pf.preload?.(query);
  const search = await pf.debouncedSearch(query, {}, 160);
  if (!search || version !== queryVersion || mode !== "search") return;
  const hits = await Promise.all(search.results.slice(0, 8).map(async (result) => {
    const data = await result.data();
    const title = data.meta?.title?.trim()?.replace(/\s·\sAshwin Gopalsamy$/, "") || data.url;
    const isNote = data.url.includes("/blog/") || data.url.includes("/library/notes/");
    return createItem({ id: `search:${data.url}`, kind: isNote ? "content" : "page", group: isNote ? "Notes" : "Search", section: "Site results", label: title, href: data.url, excerptHtml: data.excerpt ? sanitizeExcerpt(data.excerpt) : undefined, external: /^https?:\/\//.test(data.url), icon: paletteRouteIcon(data.url), keywords: ["search", isNote ? "note" : "page"], actions: linkActions(`search:${data.url}`, title, data.url, /^https?:\/\//.test(data.url)) });
  }));
  if (version !== queryVersion || !open || mode !== "search") return;
  const seen = new Set(hits.map((hit) => hit.href));
  items = dedupe([...smart, ...base.filter((item) => !item.href || !seen.has(item.href)), ...hits, ...web]);
  activeIndex = preferredActiveId ? Math.max(0, items.findIndex((item) => item.id === preferredActiveId)) : 0;
  if (activeIndex < 0) activeIndex = 0;
  renderList();
}

function setMode(next: PaletteMode, label: string) {
  mode = next;
  currentContextTitle = label;
  const { root, back, input, list, queryShell, contextShell, contextTitle, mobileTitle, mobileSearchLaunch, mobileClose } = els();
  const nested = next !== "search" && next !== "directory";
  const directory = next === "directory";
  const mobile = isMobilePalette();
  const hasHistory = viewStack.length > 0;
  if (root) root.dataset.paletteMode = next;
  if (back) {
    back.hidden = mobile ? (!nested && !hasHistory) : !nested;
    back.setAttribute("aria-label", hasHistory || nested ? "Back" : "Close");
  }
  if (queryShell) queryShell.hidden = nested && !mobile;
  if (contextShell) contextShell.hidden = !nested || directory;
  if (contextTitle) contextTitle.textContent = label;
  if (mobileTitle) {
    mobileTitle.textContent = label || "Commands";
    mobileTitle.hidden = nested && !directory;
  }
  if (mobileSearchLaunch) {
    const launcherVisible = mobile && next !== "search";
    mobileSearchLaunch.tabIndex = launcherVisible ? 0 : -1;
    mobileSearchLaunch.setAttribute("aria-hidden", launcherVisible ? "false" : "true");
  }
  if (mobileClose) {
    mobileClose.tabIndex = mobile ? 0 : -1;
  }
  if (input) {
    input.readOnly = nested;
    input.tabIndex = nested ? -1 : 0;
    input.toggleAttribute("aria-hidden", nested);
    input.placeholder = mobile ? "Search site and commands" : "Search or run a command";
    if (nested) input.removeAttribute("aria-activedescendant");
  }
  if (list) {
    list.tabIndex = nested ? 0 : -1;
    list.setAttribute("aria-label", directory ? "Commands" : next === "help" ? "Keyboard shortcuts" : next === "actions" ? label : next === "browse" ? label : "Results");
    if (!nested) list.removeAttribute("aria-activedescendant");
  }
  setFooter(next);
}

function setFooter(currentMode: PaletteMode) {
  const { footerHints, count } = els();
  if (!footerHints) return;
  const resultNoun = currentMode === "help" ? "shortcut" : currentMode === "actions" ? "action" : currentMode === "browse" ? "item" : currentMode === "directory" ? "command" : "result";
  if (count) count.textContent = resultSummary && currentMode === "search" ? `${resultSummary.shown} of ${resultSummary.total} matches` : items.length ? `${items.length} ${resultNoun}${items.length === 1 ? "" : "s"}` : "No results";
  if (currentMode === "directory") {
    footerHints.innerHTML = '<span><kbd>↑↓</kbd> Navigate</span><span><kbd>↵</kbd> Open</span><span><kbd>Esc</kbd> Close</span>';
    return;
  }
  if (currentMode === "help") {
    footerHints.innerHTML = '<span><kbd>↑↓</kbd> Navigate</span><span><kbd>↵</kbd> Open</span><span><kbd>Esc</kbd> Back</span>';
    return;
  }
  if (currentMode === "actions" || currentMode === "browse") {
    footerHints.innerHTML = `<span><kbd>↑↓</kbd> Navigate</span><span><kbd>↵</kbd> ${currentMode === "actions" ? "Run" : "Open"}</span><span><kbd>Esc</kbd> Back</span>`;
    return;
  }
  const actions = items[activeIndex]?.actions?.length || items[activeIndex]?.href;
  footerHints.innerHTML = `<span><kbd>↑↓</kbd> Navigate</span><span><kbd>↵</kbd> Open</span>${actions ? '<span><kbd>⌘K</kbd> Actions</span>' : ""}`;
}

function focusNestedList() {
  els().list?.focus({ preventScroll: true });
}

function focusDirectoryHeading() {
  const { mobileTitle, panel } = els();
  if (isMobilePalette()) mobileTitle?.focus({ preventScroll: true });
  else panel?.focus({ preventScroll: true });
}

function showDirectory() {
  if (!open) return;
  viewStack = [];
  resultSummary = null;
  expandedQueryKey = "";
  pendingActiveItemId = undefined;
  const { input } = els();
  if (input) input.value = "";
  setMode("directory", "Commands");
  items = mobileDirectoryItems();
  activeIndex = -1;
  renderList();
  focusDirectoryHeading();
}

function showMobileSearch() {
  if (!open || mode === "search") return;
  pushView();
  resultSummary = null;
  expandedQueryKey = "";
  pendingActiveItemId = undefined;
  setMode("search", "Search");
  items = [];
  activeIndex = 0;
  const { input } = els();
  if (input) {
    input.value = "";
    input.readOnly = false;
    input.focus({ preventScroll: true });
  }
  renderList();
  void refresh("");
}

function showHelp() {
  if (!open) return;
  if (mode === "help") return;
  pushView();
  setMode("help", "Keyboard shortcuts");
  resultSummary = null;
  items = helpItems();
  activeIndex = 0;
  renderList();
  focusNestedList();
}

function showActions() {
  const target = items[activeIndex];
  if (!target || target.disabled) return;
  const actions = target.actions ?? (target.href ? linkActions(target.id, target.label, target.href, Boolean(target.external)) : []);
  if (!actions.length) return;
  pushView();
  setMode("actions", `Actions for ${target.label}`);
  resultSummary = null;
  items = actions.map((action) => createItem({ id: action.id, kind: "action", group: "Actions", label: action.label, hint: action.hint, icon: action.icon, action: action.action, closeOnRun: action.closeOnRun }));
  activeIndex = 0;
  renderList();
  focusNestedList();
}

function goBack() {
  const snapshot = viewStack.pop();
  if (!snapshot) {
    closePalette(true);
    return;
  }
  setMode(snapshot.mode, snapshot.title);
  items = snapshot.items;
  activeIndex = Math.min(snapshot.activeIndex, Math.max(items.length - 1, 0));
  resultSummary = snapshot.resultSummary;
  const { input, list } = els();
  if (input) input.value = snapshot.query;
  renderList();
  requestAnimationFrame(() => {
    if (list) list.scrollTop = snapshot.scrollTop;
  });
  if (snapshot.mode === "search") {
    input?.focus({ preventScroll: true });
    if (!snapshot.items.length) void refresh(snapshot.query);
  } else if (snapshot.mode === "directory") focusDirectoryHeading();
  else focusNestedList();
}

function confirmClearHistory() {
  const answer = window.confirm("Clear pinned and recent commands from this browser?");
  if (answer) clearHistory();
}

async function activate() {
  const item = items[activeIndex];
  if (!item || item.disabled) return;
  if (item.trackRecent !== false) bumpRecent(item.id);
  const shouldClose = item.closeOnRun !== false;
  if (shouldClose) closePalette();
  if (item.action) await item.action();
  else if (item.href) item.external ? openExternal(item.href) : navigate(item.href);
  if (!shouldClose && open && mode === "search") {
    const { input } = els();
    void refresh(input?.value ?? "");
  }
}

function trapFocus(event: KeyboardEvent) {
  if (event.key !== "Tab") return;
  const { root } = els();
  if (!root) return;
  const focusable = Array.from(root.querySelectorAll<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])')).filter((element) => !element.hasAttribute("disabled") && element.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus({ preventScroll: true });
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus({ preventScroll: true });
  }
}

function onKey(event: KeyboardEvent) {
  if (!open) return;
  if (event.key === "Escape") {
    event.preventDefault();
    goBack();
    return;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    const nextIndex = activeIndex < 0 ? 0 : (activeIndex + 1) % Math.max(items.length, 1);
    if (nextIndex !== activeIndex) {
      activeIndex = nextIndex;
      playAccent("select");
      syncActive();
    }
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    const nextIndex = activeIndex < 0 ? Math.max(items.length - 1, 0) : (activeIndex - 1 + items.length) % Math.max(items.length, 1);
    if (nextIndex !== activeIndex) {
      activeIndex = nextIndex;
      playAccent("select");
      syncActive();
    }
    return;
  }
  if (event.key === "Home") {
    event.preventDefault();
    if (activeIndex !== 0 && items.length > 0) {
      activeIndex = 0;
      playAccent("select");
      syncActive();
    }
    return;
  }
  if (event.key === "End") {
    event.preventDefault();
    const lastIndex = Math.max(items.length - 1, 0);
    if (activeIndex !== lastIndex && items.length > 0) {
      activeIndex = lastIndex;
      playAccent("select");
      syncActive();
    }
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    void activate();
    return;
  }
  trapFocus(event);
}

export function openPalette(nextMode: PaletteOpenMode = "search", instant = false) {
  const { root, input } = els();
  if (!root || !input) return;
  const requestedMode: PaletteOpenMode = nextMode === "directory" && !isMobilePalette() ? "search" : nextMode;
  if (open) {
    if (requestedMode === "help") showHelp();
    else if (requestedMode === "directory") showDirectory();
    else if (mode !== "search") showMobileSearch();
    return;
  }
  wirePaletteViewport();
  window.clearTimeout(closeTimer);
  closeTimer = undefined;
  open = true;
  trackPalette(requestedMode);
  mode = "search";
  viewStack = [];
  resultSummary = null;
  expandedQueryKey = "";
  pendingActiveItemId = undefined;
  prevFocus = document.activeElement as HTMLElement | null;
  root.hidden = false;
  root.setAttribute("aria-hidden", "false");
  document.documentElement.dataset.palette = "open";
  lockPageForPalette(root);
  syncPaletteViewport();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || instant) root.classList.add("is-instant"); else root.classList.remove("is-instant");
  requestAnimationFrame(() => root.classList.add("is-open"));
  startTicker();
  playAccent("pop");
  document.addEventListener("keydown", onKey);
  if (requestedMode === "directory") {
    showDirectory();
  } else if (requestedMode === "help") {
    setMode("search", "");
    items = [];
    renderList();
    showHelp();
  } else {
    setMode("search", "");
    input.value = "";
    input.focus({ preventScroll: true });
    void refresh("");
  }
  if (requestedMode !== "search") return;
  void loadManifest().then(() => {
    if (!open) return;
    if (mode === "search" && !input.value) void refresh(input.value);
    if (mode === "directory") showDirectory();
  });
}

export function closePalette(fromUser = false) {
  const { root, input } = els();
  if (!open) return;
  if (fromUser) playAccent("dismiss");
  open = false;
  mode = "search";
  viewStack = [];
  resultSummary = null;
  expandedQueryKey = "";
  pendingActiveItemId = undefined;
  queryVersion += 1;
  stopTicker();
  document.documentElement.removeAttribute("data-palette");
  document.removeEventListener("keydown", onKey);
  clearPaletteViewport();
  const closeLocation = location.href;
  if (!root) {
    unlockPageForPalette(location.href === closeLocation);
    prevFocus = null;
    return;
  }
  root.classList.remove("is-open");
  const finish = () => {
    if (open) return;
    root.hidden = true;
    root.setAttribute("aria-hidden", "true");
    root.removeAttribute("data-palette-mode");
    if (input) {
      input.value = "";
      input.readOnly = false;
    }
    syncQuerySlot();
    unlockPageForPalette();
    prevFocus?.focus?.({ preventScroll: true });
    prevFocus = null;
  };
  if (root.classList.contains("is-instant")) finish();
  else closeTimer = window.setTimeout(finish, PALETTE_EXIT_MS);
}

function wireDialog() {
  const { root, input, back, mobileSearchLaunch, mobileClose } = els();
  if (!root || !input || root.dataset.wired === "true") return;
  root.dataset.wired = "true";
  wirePaletteViewport();
  root.querySelector(".palette-backdrop")?.addEventListener("click", () => closePalette(true));
  root.querySelector(".palette-close")?.addEventListener("click", () => closePalette(true));
  back?.addEventListener("click", () => goBack());
  mobileSearchLaunch?.addEventListener("click", () => showMobileSearch());
  mobileClose?.addEventListener("click", () => {
    if (mode === "search" && input && input.value.length > 0) {
      input.value = "";
      void refresh("");
      input.focus({ preventScroll: true });
    } else {
      closePalette(true);
    }
  });
  input.addEventListener("input", () => {
    if (mode !== "search") return;
    window.clearTimeout(searchTimer);
    const query = input.value;
    searchTimer = window.setTimeout(() => void refresh(query), 40);
  });
}

function globalKeys(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  const paletteInput = target?.id === "palette-input";
  const typing = !(!open && paletteInput) && (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT" || target?.isContentEditable);
  const isK = (event.key === "k" || event.key === "K" || event.code === "KeyK") && (event.metaKey || event.ctrlKey);
  const isSlash = (event.key === "/" || (!event.shiftKey && event.code === "Slash")) && !typing && !event.metaKey && !event.ctrlKey && !event.altKey;
  const isHelp = (event.key === "?" || (event.shiftKey && event.code === "Slash")) && !typing && !event.metaKey && !event.ctrlKey && !event.altKey;

  if (isK) {
    event.preventDefault();
    event.stopPropagation();
    if (open) {
      if (mode === "search") showActions();
      else goBack();
    } else openPalette("search", true);
    return;
  }
  if (isSlash) {
    event.preventDefault();
    event.stopPropagation();
    openPalette("search", true);
    return;
  }
  if (isHelp) {
    event.preventDefault();
    event.stopPropagation();
    if (open) showHelp(); else openPalette("help", true);
  }
}

function init() {
  const { root } = els();
  if (root) hydratePaletteIcons(root);
  wirePaletteViewport();
  wireDialog();
  window.__openPalette = openPalette;
}

document.addEventListener(
  "click",
  (event) => {
    const trigger = (event.target as HTMLElement | null)?.closest<HTMLElement>(
      ".palette-trigger, .header-palette-trigger, [data-palette-entry]",
    );
    if (!trigger) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const requestedMode =
      (trigger as HTMLElement).dataset?.paletteEntry === "directory" && isMobilePalette()
        ? "directory"
        : "search";
    openPalette(requestedMode);
  },
  { capture: true },
);

document.addEventListener("keydown", globalKeys);
init();
document.addEventListener("astro:page-load", init);
document.addEventListener("astro:before-swap", () => { if (open) closePalette(); });
