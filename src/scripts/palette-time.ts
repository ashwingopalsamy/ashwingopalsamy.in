import { DateTime } from "luxon";

export interface TimeZoneChoice {
  id: string;
  label: string;
  zone: string;
  keywords: string[];
}

export interface TimeConversion {
  sourceZone: string;
  sourceLabel: string;
  targetZone: string;
  targetLabel: string;
  source: DateTime;
  target: DateTime;
  nextDay?: boolean;
}

export const FAVORITE_ZONES: TimeZoneChoice[] = [
  { id: "pollachi", label: "Pollachi", zone: "Asia/Kolkata", keywords: ["ashwin", "tamil nadu", "pollachi", "kolkata", "ist"] },
  { id: "visitor", label: "Your local time", zone: "local", keywords: ["local", "me", "mine"] },
  { id: "utc", label: "UTC", zone: "UTC", keywords: ["universal", "gmt"] },
  { id: "london", label: "London", zone: "Europe/London", keywords: ["uk", "britain", "bristol"] },
  { id: "sao-paulo", label: "São Paulo", zone: "America/Sao_Paulo", keywords: ["brazil", "pismo"] },
  { id: "austin", label: "Austin", zone: "America/Chicago", keywords: ["texas", "central", "pismo"] },
  { id: "singapore", label: "Singapore", zone: "Asia/Singapore", keywords: ["sg", "pismo"] },
  { id: "dubai", label: "Dubai", zone: "Asia/Dubai", keywords: ["uae"] },
  { id: "tokyo", label: "Tokyo", zone: "Asia/Tokyo", keywords: ["japan"] },
  { id: "new-york", label: "New York", zone: "America/New_York", keywords: ["nyc", "eastern"] },
  { id: "san-francisco", label: "San Francisco", zone: "America/Los_Angeles", keywords: ["sf", "pacific"] },
  { id: "sydney", label: "Sydney", zone: "Australia/Sydney", keywords: ["australia"] },
];

const aliases = new Map<string, TimeZoneChoice>(
  FAVORITE_ZONES.flatMap((choice) => [
    [choice.label.toLowerCase(), choice] as const,
    [choice.label.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, ""), choice] as const,
    [choice.id, choice] as const,
    ...choice.keywords.map((keyword) => [keyword, choice] as const),
  ]),
);

function resolvedZone(zone: string, visitorZone: string): string {
  return zone === "local" ? visitorZone : zone;
}

export function zoneChoice(input: string | undefined, visitorZone: string): TimeZoneChoice | null {
  if (!input) return null;
  const normalized = input.trim().toLowerCase().replace(/\s+/g, " ");
  const alias = aliases.get(normalized);
  if (alias) return alias.zone === "local" ? { ...alias, zone: visitorZone } : alias;
  const candidate = input.trim();
  const probe = DateTime.now().setZone(candidate);
  if (!probe.isValid) return null;
  return { id: candidate.toLowerCase(), label: candidate.replace(/_/g, " "), zone: candidate, keywords: [] };
}

function zoneFromText(text: string, visitorZone: string): { zone: TimeZoneChoice; rest: string } | null {
  const normalized = text.trim();
  const candidates = [...aliases.keys()].sort((a, b) => b.length - a.length);
  for (const alias of candidates) {
    const match = normalized.match(new RegExp(`(?:^|\\s)${escapeRegExp(alias)}$`, "i"));
    if (match) {
      const zone = zoneChoice(alias, visitorZone);
      if (zone) return { zone, rest: normalized.slice(0, match.index).trim() };
    }
  }
  const parts = normalized.split(/\s+/);
  if (parts.length > 1) {
    const tail = parts.slice(-1)[0];
    const zone = zoneChoice(tail, visitorZone);
    if (zone) return { zone, rest: parts.slice(0, -1).join(" ") };
  }
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseClock(input: string, zone: string, dayOffset = 0): DateTime | null {
  const match = input.trim().match(/^(today\s+|tomorrow\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;
  let hour = Number(match[2]);
  const minute = Number(match[3] ?? "0");
  const meridiem = match[4]?.toLowerCase();
  if (minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === "pm" && hour !== 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
  } else if (hour > 23) {
    return null;
  }
  const now = DateTime.now().setZone(zone).plus({ days: dayOffset });
  const value = DateTime.fromObject(
    { year: now.year, month: now.month, day: now.day, hour, minute, second: 0, millisecond: 0 },
    { zone },
  );
  return value.isValid ? value : null;
}

export function currentTimeRows(siteZone: string, visitorZone: string): TimeConversion[] {
  const now = DateTime.now();
  const source = now.setZone(siteZone);
  return FAVORITE_ZONES.map((choice) => {
    const targetZone = resolvedZone(choice.zone, visitorZone);
    return {
      sourceZone: siteZone,
      sourceLabel: "Now",
      targetZone,
      targetLabel: choice.label,
      source,
      target: now.setZone(targetZone),
    };
  });
}

export function formatTime(value: DateTime, includeSeconds = true): string {
  return value.toFormat(includeSeconds ? "ccc, dd LLL · HH:mm:ss" : "ccc, dd LLL · HH:mm");
}

export function formatClock(value: DateTime): string {
  return value.toFormat("h:mm a");
}

export function isClockQuery(query: string): boolean {
  return /^(?:today|tomorrow)?\s*\d{1,2}(?::\d{2})?\s*(?:am|pm)?$/i.test(query.trim());
}

export function timeConversionRows(query: string, siteZone: string, visitorZone: string): TimeConversion[] {
  if (!isClockQuery(query)) return [];
  const dayOffset = /^tomorrow\b/i.test(query.trim()) ? 1 : 0;
  const source = parseClock(query, siteZone, dayOffset);
  if (!source) return [];
  return FAVORITE_ZONES.map((choice) => {
    const targetZone = resolvedZone(choice.zone, visitorZone);
    return {
      sourceZone: siteZone,
      sourceLabel: "Pollachi",
      targetZone,
      targetLabel: choice.label,
      source,
      target: source.setZone(targetZone),
      nextDay: dayOffset === 1,
    };
  });
}

export function parseTimeQuery(query: string, siteZone: string, visitorZone: string): TimeConversion | { zone: TimeZoneChoice } | null {
  const trimmed = query.trim();
  const current = trimmed.match(/^(?:now|time|clock)(?:\s+(?:in|at|for)\s+(.+))?$/i);
  if (current) {
    const zone = zoneChoice(current[1], visitorZone);
    return zone ? { zone } : current[1] ? null : { zone: { id: "pollachi", label: "Pollachi", zone: siteZone, keywords: [] } };
  }

  const conversion = trimmed.match(/^(?:convert\s+)?(?:(today|tomorrow)\s+)?(.+?)\s+(?:to|in)\s+(.+)$/i);
  if (!conversion) return null;
  const dayOffset = conversion[1]?.toLowerCase() === "tomorrow" ? 1 : 0;
  const left = `${conversion[1] && conversion[1].toLowerCase() !== "today" ? `${conversion[1]} ` : ""}${conversion[2]}`.trim();
  const sourceInfo = zoneFromText(left, visitorZone);
  const sourceZone = sourceInfo?.zone ?? { id: "pollachi", label: "Pollachi", zone: siteZone, keywords: [] };
  const clockText = sourceInfo?.rest ?? left;
  const targetZone = zoneChoice(conversion[3], visitorZone);
  if (!targetZone) return null;
  const source = parseClock(clockText, resolvedZone(sourceZone.zone, visitorZone), dayOffset);
  if (!source) return null;
  const target = source.setZone(resolvedZone(targetZone.zone, visitorZone));
  return {
    sourceZone: resolvedZone(sourceZone.zone, visitorZone),
    sourceLabel: sourceZone.label,
    targetZone: resolvedZone(targetZone.zone, visitorZone),
    targetLabel: targetZone.label,
    source,
    target,
    nextDay: dayOffset === 1,
  };
}

export function conversionLabel(conversion: TimeConversion): string {
  const targetDay = conversion.target.toISODate() !== conversion.source.toISODate();
  const day = conversion.nextDay ? "tomorrow" : targetDay ? "next day" : "today";
  return `${formatClock(conversion.source)} in ${conversion.sourceLabel} is ${formatClock(conversion.target)} in ${conversion.targetLabel} · ${day}`;
}

export function offsetLabel(source: DateTime, target: DateTime): string {
  const minutes = target.offset - source.offset;
  if (minutes === 0) return "same offset";
  const absolute = Math.abs(minutes);
  const hours = Math.floor(absolute / 60);
  const remainder = absolute % 60;
  const value = remainder ? `${hours}h ${remainder}m` : `${hours}h`;
  return `${value} ${minutes > 0 ? "ahead" : "behind"}`;
}
