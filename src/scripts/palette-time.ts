export interface TimeZoneChoice {
  id: string;
  label: string;
  zone: string;
  keywords: string[];
}

/** An instant (epoch ms) viewed in a zone: an IANA name, "UTC", or "UTC+h[:mm]". */
export interface ZonedTime {
  ts: number;
  zone: string;
}

export interface TimeConversion {
  sourceZone: string;
  sourceLabel: string;
  targetZone: string;
  targetLabel: string;
  source: ZonedTime;
  target: ZonedTime;
  nextDay?: boolean;
}

type ZoneSpec = number | Intl.DateTimeFormat;

const zoneCache = new Map<string, ZoneSpec | null>();

function signedOffset(hours: string | undefined, minutes: string | undefined): number {
  let h = parseInt(hours ?? "", 10);
  if (Number.isNaN(h)) h = 0;
  const m = parseInt(minutes ?? "", 10) || 0;
  return h * 60 + (h < 0 || Object.is(h, -0) ? -m : m);
}

/** A fixed offset in minutes, a wall-clock formatter for an IANA zone, or null when the zone is unknown. */
function zoneSpec(zone: string): ZoneSpec | null {
  const cached = zoneCache.get(zone);
  if (cached !== undefined) return cached;
  let spec: ZoneSpec | null = null;
  const lowered = zone.toLowerCase();
  const fixed = lowered.match(/^utc(?:([+-]\d{1,2})(?::(\d{2}))?)?$/);
  if (lowered === "gmt") spec = 0;
  else if (fixed) spec = signedOffset(fixed[1], fixed[2]);
  else {
    try {
      spec = new Intl.DateTimeFormat("en-US", {
        timeZone: /^(?:local|system|default)$/.test(lowered) ? undefined : zone,
        hourCycle: "h23",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
      });
    } catch {
      spec = null;
    }
  }
  zoneCache.set(zone, spec);
  return spec;
}

/** Wall-clock [year, month, day, hour, minute, second] of an instant in a zone. */
function wall(zone: string, ts: number): [number, number, number, number, number, number] {
  const spec = zoneSpec(zone);
  if (spec === null) throw new RangeError(`Invalid time zone: ${zone}`);
  if (typeof spec === "number") {
    const d = new Date(ts + spec * 60000);
    return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()];
  }
  const v: Record<string, number> = {};
  for (const part of spec.formatToParts(ts)) if (part.type !== "literal") v[part.type] = Number(part.value);
  return [v.year, v.month, v.day, v.hour % 24, v.minute, v.second];
}

/** UTC offset of a zone at an instant, in minutes. */
function offsetMinutes(zone: string, ts: number): number {
  const spec = zoneSpec(zone);
  if (typeof spec === "number") return spec;
  const [y, mo, d, h, mi, s] = wall(zone, ts);
  return (Date.UTC(y, mo - 1, d, h, mi, s) - Math.floor(ts / 1000) * 1000) / 60000;
}

/** The instant at which a zone's wall clock reads the given time; a skipped (DST gap) time resolves forward. */
function fromWall(zone: string, y: number, mo: number, d: number, h: number, mi: number): ZonedTime {
  const local = Date.UTC(y, mo - 1, d, h, mi);
  const guess = offsetMinutes(zone, Date.now());
  let ts = local - guess * 60000;
  const o2 = offsetMinutes(zone, ts);
  if (o2 !== guess) {
    ts -= (o2 - guess) * 60000;
    const o3 = offsetMinutes(zone, ts);
    if (o3 !== o2) ts = local - Math.min(o2, o3) * 60000;
  }
  return { ts, zone };
}

function inZone(value: ZonedTime, zone: string): ZonedTime {
  return { ts: value.ts, zone };
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function pad(value: number): string {
  return String(value).padStart(2, "0");
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
  if (!zoneSpec(candidate)) return null;
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

export function parseClock(input: string, zone: string, dayOffset = 0): ZonedTime | null {
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
  if (!zoneSpec(zone)) return null;
  const [year, month, day] = wall(zone, Date.now());
  const date = new Date(Date.UTC(year, month - 1, day + dayOffset));
  return fromWall(zone, date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), hour, minute);
}

export function currentTimeRows(siteZone: string, visitorZone: string): TimeConversion[] {
  const now = { ts: Date.now(), zone: siteZone };
  return FAVORITE_ZONES.map((choice) => {
    const targetZone = resolvedZone(choice.zone, visitorZone);
    return {
      sourceZone: siteZone,
      sourceLabel: "Now",
      targetZone,
      targetLabel: choice.label,
      source: now,
      target: inZone(now, targetZone),
    };
  });
}

export function formatTime(value: ZonedTime, includeSeconds = true): string {
  const [year, month, day, hour, minute, second] = wall(value.zone, value.ts);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${weekday}, ${pad(day)} ${MONTHS[month - 1]} · ${pad(hour)}:${pad(minute)}${includeSeconds ? `:${pad(second)}` : ""}`;
}

export function formatClock(value: ZonedTime): string {
  const [, , , hour, minute] = wall(value.zone, value.ts);
  return `${hour % 12 || 12}:${pad(minute)} ${hour < 12 ? "AM" : "PM"}`;
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
      target: inZone(source, targetZone),
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
  const target = inZone(source, resolvedZone(targetZone.zone, visitorZone));
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
  const dayOf = (value: ZonedTime) => wall(value.zone, value.ts).slice(0, 3).join("-");
  const targetDay = dayOf(conversion.target) !== dayOf(conversion.source);
  const day = conversion.nextDay ? "tomorrow" : targetDay ? "next day" : "today";
  return `${formatClock(conversion.source)} in ${conversion.sourceLabel} is ${formatClock(conversion.target)} in ${conversion.targetLabel} · ${day}`;
}

export function offsetLabel(source: ZonedTime, target: ZonedTime): string {
  const minutes = offsetMinutes(target.zone, target.ts) - offsetMinutes(source.zone, source.ts);
  if (minutes === 0) return "same offset";
  const absolute = Math.abs(minutes);
  const hours = Math.floor(absolute / 60);
  const remainder = absolute % 60;
  const value = remainder ? `${hours}h ${remainder}m` : `${hours}h`;
  return `${value} ${minutes > 0 ? "ahead" : "behind"}`;
}
