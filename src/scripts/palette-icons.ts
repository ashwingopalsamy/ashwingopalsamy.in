import { iconMarkup as sharedIconMarkup, type IconName } from "../lib/ui-icons";
import { profileIconPaths } from "../lib/profile-icons";

export type PaletteIconKey =
  | "search" | "back" | "close" | "home" | "work" | "library" | "book"
  | "watch" | "tags" | "links" | "ai" | "more" | "info" | "photos"
  | "coffee" | "people" | "note" | "craft" | "article" | "tag" | "theme"
  | "sound-on" | "sound-off" | "link" | "share" | "rss" | "keyboard"
  | "trash" | "random" | "copy" | "mail" | "call" | "location" | "contact"
  | "download" | "handle" | "resume" | "file-down" | "file-text" | "file-json"
  | "source" | "source-page" | "calculator" | "convert" | "compare" | "text"
  | "hash" | "password" | "time" | "coin" | "dice" | "quote" | "surprise"
  | "egg" | "command" | "navigate" | "actions" | "open" | "external" | "pin"
  | "pin-off" | "repeat" | "alert" | `brand:${string}`;

export const palettePageIcons = {
  "/": "home",
  "/work/": "work",
  "/craft/": "work",
  "/library/": "library",
  "/library/books/": "book",
  "/library/watch/": "watch",
  "/library/tags/": "tags",
  "/links/": "links",
  "/ai/": "ai",
  "/design/": "info",
  "/more/": "more",
  "/colophon/": "info",
  "/more/photos/": "photos",
  "/more/cafe/": "coffee",
  "/more/people/": "people",
} as const satisfies Record<string, PaletteIconKey>;

const normalizePath = (href: string) => {
  try {
    const url = new URL(href, "https://ashwingopalsamy.in");
    return url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
  } catch {
    return href;
  }
};

export function palettePageIcon(href: string): PaletteIconKey {
  return palettePageIcons[normalizePath(href) as keyof typeof palettePageIcons] ?? "file-text";
}

export function paletteContentIcon(kind: string): PaletteIconKey {
  if (kind === "note") return "note";
  if (kind === "craft") return "craft";
  if (kind === "book") return "book";
  if (kind === "watch") return "watch";
  if (kind === "article") return "article";
  if (kind === "tag") return "tag";
  return "file-text";
}

export function paletteRouteIcon(href: string): PaletteIconKey {
  const path = href.toLocaleLowerCase();
  if (path.includes("/blog/") || path.includes("/library/notes/")) return "note";
  if (path.includes("/library/books/")) return "book";
  if (path.includes("/library/watch/")) return "watch";
  if (path.includes("/craft/")) return "craft";
  if (path.includes("/library/tags/")) return "tag";
  if (path.includes("/library/articles/")) return "article";
  return "file-text";
}

export function paletteAiIcon(id: string): PaletteIconKey {
  if (id.includes("json")) return "file-json";
  if (id.includes("txt")) return "file-text";
  return "ai";
}

export function paletteFallbackIcon(kind: string): PaletteIconKey {
  if (kind === "page") return "file-text";
  if (kind === "content") return "note";
  if (kind === "ai") return "ai";
  if (kind === "time") return "time";
  if (kind === "utility") return "calculator";
  if (kind === "fun") return "surprise";
  return "open";
}

export const paletteLucideNames: Record<Exclude<PaletteIconKey, `brand:${string}`>, IconName> = {
  search: "search", back: "arrow-left", close: "close", home: "home", work: "nav-work",
  library: "library", book: "book", watch: "watch", tags: "tags", links: "nav-links",
  ai: "nav-ai", more: "nav-more", info: "info", photos: "photos", coffee: "coffee",
  people: "people", note: "note", craft: "craft", article: "article", tag: "tag",
  theme: "theme", "sound-on": "sound-on", "sound-off": "sound-off", link: "link",
  share: "share", rss: "rss", keyboard: "keyboard", trash: "trash", random: "random",
  copy: "copy", mail: "mail", call: "calendar", location: "location", contact: "contact",
  download: "download", handle: "at-sign", resume: "resume", "file-down": "file-down",
  "file-text": "file-text", "file-json": "file-json", source: "code",
  "source-page": "code-xml", calculator: "calculator", convert: "arrow-right-left",
  compare: "arrow-right-left", text: "type", hash: "hash", password: "key",
  time: "clock", coin: "coins", dice: "dice", quote: "quote", surprise: "sparkle",
  egg: "egg", command: "command", navigate: "arrow-up-down", actions: "list",
  open: "arrow-right", external: "external", pin: "pin", "pin-off": "pin-off",
  repeat: "repeat", alert: "alert",
};

const profileIconIds = new Set(Object.keys(profileIconPaths).filter((id) => id !== "email"));

export function profileIconKey(id: string): PaletteIconKey {
  if (id === "email") return "mail";
  return profileIconIds.has(id) ? `brand:${id}` : "contact";
}

export function iconMarkup(key: PaletteIconKey): string {
  if (key.startsWith("brand:")) {
    const path = profileIconPaths[key.slice(6)];
    if (path) return `<svg class="palette-brand-icon" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="${path}"></path></svg>`;
  }
  const name = paletteLucideNames[key as Exclude<PaletteIconKey, `brand:${string}`>] ?? "alert";
  return sharedIconMarkup(name, { size: 17, strokeWidth: 1.8, className: "palette-svg" });
}

export function hydratePaletteIcons(_root: Element): void {}
