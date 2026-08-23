import type { PaletteIconKey } from "./palette-icons";

export type QueryRecipeKind = "time" | "calculate" | "convert" | "text" | "utility" | "fun";

export interface QueryRecipe {
  id: string;
  query: string;
  label: string;
  subtitle: string;
  kind: QueryRecipeKind;
  icon: PaletteIconKey;
  keywords: string[];
}

export interface BrowseCategory {
  id: string;
  label: string;
  icon: PaletteIconKey;
  keywords: string[];
}

export interface ResultSummary {
  total: number;
  shown: number;
  expanded: boolean;
}

export const INITIAL_MATCH_LIMIT = 24;

export const QUERY_RECIPES: QueryRecipe[] = [
  {
    id: "time-pollachi-london",
    query: "9:30pm Pollachi to London",
    label: "9:30pm Pollachi to London",
    subtitle: "Convert a time across two cities",
    kind: "time",
    icon: "time",
    keywords: ["try", "example", "time", "timezone", "convert", "london", "pollachi"],
  },
  {
    id: "time-new-york-pollachi",
    query: "10am New York to Pollachi",
    label: "10am New York to Pollachi",
    subtitle: "Another timezone conversion",
    kind: "time",
    icon: "time",
    keywords: ["example", "time", "timezone", "convert", "new york", "pollachi"],
  },
  {
    id: "calculate-percent",
    query: "15% of 240",
    label: "15% of 240",
    subtitle: "Calculate a percentage",
    kind: "calculate",
    icon: "calculator",
    keywords: ["try", "example", "calculate", "calculator", "math", "percentage"],
  },
  {
    id: "calculate-expression",
    query: "(12 * 8) / 3",
    label: "(12 * 8) / 3",
    subtitle: "Calculate an expression",
    kind: "calculate",
    icon: "calculator",
    keywords: ["example", "calculate", "calculator", "math", "expression"],
  },
  {
    id: "convert-distance",
    query: "10 km to mi",
    label: "10 km to mi",
    subtitle: "Convert a measurement",
    kind: "convert",
    icon: "convert",
    keywords: ["try", "example", "convert", "conversion", "units", "distance"],
  },
  {
    id: "convert-temperature",
    query: "32 F to C",
    label: "32 F to C",
    subtitle: "Convert a temperature",
    kind: "convert",
    icon: "convert",
    keywords: ["example", "convert", "conversion", "temperature"],
  },
  {
    id: "text-slug",
    query: "slug: Hello from Pollachi",
    label: "slug: Hello from Pollachi",
    subtitle: "Turn text into a URL slug",
    kind: "text",
    icon: "text",
    keywords: ["try", "example", "text", "transform", "slug", "url"],
  },
  {
    id: "text-uppercase",
    query: "uppercase: ashwin gopalsamy",
    label: "uppercase: ashwin gopalsamy",
    subtitle: "Transform text to uppercase",
    kind: "text",
    icon: "text",
    keywords: ["example", "text", "transform", "uppercase"],
  },
  {
    id: "text-lowercase",
    query: "lowercase: HELLO POLLACHI",
    label: "lowercase: HELLO POLLACHI",
    subtitle: "Transform text to lowercase",
    kind: "text",
    icon: "text",
    keywords: ["example", "text", "transform", "lowercase"],
  },
  {
    id: "utility-password",
    query: "generate password 24",
    label: "generate password 24",
    subtitle: "Create a local password",
    kind: "utility",
    icon: "password",
    keywords: ["example", "password", "secret", "generate"],
  },
  {
    id: "utility-uuid",
    query: "generate uuid",
    label: "generate uuid",
    subtitle: "Create a local UUID",
    kind: "utility",
    icon: "hash",
    keywords: ["example", "uuid", "id", "generate"],
  },
  {
    id: "fun-dice",
    query: "roll d20",
    label: "roll d20",
    subtitle: "Roll any-sided dice",
    kind: "fun",
    icon: "dice",
    keywords: ["example", "dice", "roll", "random"],
  },
  {
    id: "fun-coin",
    query: "flip a coin",
    label: "flip a coin",
    subtitle: "Get a local random result",
    kind: "fun",
    icon: "coin",
    keywords: ["example", "coin", "random", "fun"],
  },
];

export const ROOT_RECIPE_IDS = [
  "time-pollachi-london",
  "calculate-percent",
  "convert-distance",
  "text-slug",
] as const;

export const BROWSE_CATEGORIES: BrowseCategory[] = [
  { id: "navigate", label: "Navigate the site", icon: "navigate", keywords: ["navigate", "pages", "go", "browse"] },
  { id: "content", label: "Search site content", icon: "search", keywords: ["search", "content", "notes", "library", "work", "articles", "tags"] },
  { id: "contact", label: "Contact & Resume", icon: "contact", keywords: ["contact", "email", "resume", "résumé", "cv", "call"] },
  { id: "time", label: "Time & timezones", icon: "time", keywords: ["time", "clock", "timezone", "convert", "cities"] },
  { id: "calculate", label: "Calculate & transform", icon: "calculator", keywords: ["calculate", "calculator", "math", "convert", "transform", "text"] },
  { id: "controls", label: "Site controls & files", icon: "actions", keywords: ["controls", "theme", "sound", "files", "rss", "source"] },
  { id: "ai", label: "AI resources", icon: "ai", keywords: ["ai", "llm", "agent", "machine", "context"] },
  { id: "fun", label: "Fun & random", icon: "surprise", keywords: ["fun", "random", "dice", "coin", "quote", "surprise"] },
];

export function recipeById(id: string): QueryRecipe | undefined {
  return QUERY_RECIPES.find((recipe) => recipe.id === id);
}

export function shouldTrackRecent(id: string): boolean {
  return !["recipe:", "browse:", "help:", "matches:show-all:"].some((prefix) => id.startsWith(prefix));
}

export function truncateMatches<T>(matches: T[], expanded: boolean, limit = INITIAL_MATCH_LIMIT): { items: T[]; summary: ResultSummary | null; hidden: T | undefined } {
  if (matches.length <= limit || expanded) {
    return { items: matches, summary: matches.length > limit ? { total: matches.length, shown: matches.length, expanded: true } : null, hidden: undefined };
  }
  return {
    items: matches.slice(0, limit),
    summary: { total: matches.length, shown: limit, expanded: false },
    hidden: matches[limit],
  };
}
