import fallbackJson from "../data/github-contributions.json";

export const GITHUB_CONTRIBUTIONS_USERNAME = "ashwingopalsamy";
export const GITHUB_CONTRIBUTIONS_URL = `https://github-contributions-api.jogruber.de/v4/${GITHUB_CONTRIBUTIONS_USERNAME}?y=last`;

export type ContributionLevel = 0 | 1 | 2 | 3 | 4;

export interface ContributionSnapshot {
  total: number;
  start: string;
  levels: string;
  counts: number[];
  refreshedAt: string;
}

export interface ContributionDay {
  date: string;
  count: number;
  level: ContributionLevel;
}

export type ContributionWeek = Array<ContributionDay | undefined>;

export interface ContributionLoadOptions {
  fetcher?: typeof fetch;
  timeoutMs?: number;
  fallback?: ContributionSnapshot;
}

const DEFAULT_TIMEOUT_MS = 3_000;
let cachedContributions: Promise<ContributionSnapshot> | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function isLevel(value: unknown): value is ContributionLevel {
  return Number.isInteger(value) && typeof value === "number" && value >= 0 && value <= 4;
}

function isCount(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === "number" && value >= 0;
}

function normaliseCounts(value: unknown): number[] | null {
  if (Array.isArray(value)) return value.every(isCount) ? [...value] : null;
  if (typeof value !== "string") return null;
  try {
    const decoded = JSON.parse(globalThis.atob(value));
    return Array.isArray(decoded) && decoded.every(isCount) ? decoded : null;
  } catch {
    return null;
  }
}

function cloneSnapshot(snapshot: ContributionSnapshot): ContributionSnapshot {
  return { ...snapshot, counts: [...snapshot.counts] };
}

export function normaliseContributionSnapshot(value: unknown): ContributionSnapshot | null {
  if (!isRecord(value)) return null;
  const { total, start, levels, counts, refreshedAt } = value;
  if (!Number.isInteger(total) || typeof total !== "number" || total < 0) return null;
  const normalisedCounts = normaliseCounts(counts);
  if (!isIsoDate(start) || typeof levels !== "string" || !normalisedCounts) return null;
  if (levels.length === 0 || levels.length !== normalisedCounts.length) return null;
  if (![...levels].every((level) => /[0-4]/.test(level)) || !normalisedCounts.every(isCount)) return null;
  if (typeof refreshedAt !== "string" || Number.isNaN(new Date(refreshedAt).valueOf())) return null;
  return { total, start, levels, counts: normalisedCounts, refreshedAt };
}

export function parseContributionPayload(value: unknown, refreshedAt = new Date().toISOString()): ContributionSnapshot | null {
  if (!isRecord(value) || !isRecord(value.total) || !Array.isArray(value.contributions)) return null;
  const total = value.total.lastYear;
  if (!Number.isInteger(total) || typeof total !== "number" || total < 0 || value.contributions.length === 0) return null;

  const days: ContributionDay[] = [];
  for (const entry of value.contributions) {
    if (!isRecord(entry) || !isIsoDate(entry.date) || !isCount(entry.count) || !isLevel(entry.level)) return null;
    days.push({ date: entry.date, count: entry.count, level: entry.level });
  }

  return {
    total,
    start: days[0]!.date,
    levels: days.map((day) => day.level).join(""),
    counts: days.map((day) => day.count),
    refreshedAt,
  };
}

const fallback = normaliseContributionSnapshot(fallbackJson);

if (!fallback) {
  throw new Error("Invalid GitHub contribution fallback snapshot");
}

export const fallbackGithubContributions = cloneSnapshot(fallback);

export async function loadGithubContributions({
  fetcher = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fallback: suppliedFallback = fallbackGithubContributions,
}: ContributionLoadOptions = {}): Promise<ContributionSnapshot> {
  const fallbackSnapshot = normaliseContributionSnapshot(suppliedFallback) ?? fallbackGithubContributions;
  if (typeof fetcher !== "function") return cloneSnapshot(fallbackSnapshot);

  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetcher(GITHUB_CONTRIBUTIONS_URL, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return cloneSnapshot(fallbackSnapshot);
    const snapshot = parseContributionPayload(await response.json());
    return snapshot ?? cloneSnapshot(fallbackSnapshot);
  } catch {
    return cloneSnapshot(fallbackSnapshot);
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

export function getGithubContributions(options?: ContributionLoadOptions): Promise<ContributionSnapshot> {
  if (options) return loadGithubContributions(options);
  cachedContributions ??= loadGithubContributions();
  return cachedContributions;
}

export function toContributionWeeks(snapshot: ContributionSnapshot): ContributionWeek[] {
  const start = new Date(`${snapshot.start}T00:00:00.000Z`);
  const weeks: ContributionWeek[] = [];
  let week: ContributionWeek = Array.from({ length: start.getUTCDay() });

  for (const [index, count] of snapshot.counts.entries()) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    week.push({
      date: date.toISOString().slice(0, 10),
      count,
      level: Number(snapshot.levels[index] ?? 0) as ContributionLevel,
    });
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }

  if (week.length > 0) {
    weeks.push([...week, ...Array.from<undefined>({ length: 7 - week.length })]);
  }

  return weeks;
}

export function formatContributionTotal(total: number, locale = "en"): string {
  const label = total === 1 ? "contribution" : "contributions";
  return `${new Intl.NumberFormat(locale).format(total)} ${label} in the last year`;
}

export function formatContributionDate(date: string, locale = "en"): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00.000Z`));
}
