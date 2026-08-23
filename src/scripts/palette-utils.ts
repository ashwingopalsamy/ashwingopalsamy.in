export interface ConversionResult {
  value: number;
  from: string;
  to: string;
  label: string;
}

type Unit = { category: string; canonical: string; factor?: number };

const UNITS: Record<string, Unit> = {
  mm: { category: "length", canonical: "mm", factor: 0.001 },
  millimeter: { category: "length", canonical: "mm", factor: 0.001 },
  millimeters: { category: "length", canonical: "mm", factor: 0.001 },
  cm: { category: "length", canonical: "cm", factor: 0.01 },
  centimeter: { category: "length", canonical: "cm", factor: 0.01 },
  centimeters: { category: "length", canonical: "cm", factor: 0.01 },
  m: { category: "length", canonical: "m", factor: 1 },
  meter: { category: "length", canonical: "m", factor: 1 },
  meters: { category: "length", canonical: "m", factor: 1 },
  km: { category: "length", canonical: "km", factor: 1000 },
  kilometer: { category: "length", canonical: "km", factor: 1000 },
  kilometers: { category: "length", canonical: "km", factor: 1000 },
  in: { category: "length", canonical: "in", factor: 0.0254 },
  inch: { category: "length", canonical: "in", factor: 0.0254 },
  inches: { category: "length", canonical: "in", factor: 0.0254 },
  ft: { category: "length", canonical: "ft", factor: 0.3048 },
  foot: { category: "length", canonical: "ft", factor: 0.3048 },
  feet: { category: "length", canonical: "ft", factor: 0.3048 },
  mi: { category: "length", canonical: "mi", factor: 1609.344 },
  mile: { category: "length", canonical: "mi", factor: 1609.344 },
  miles: { category: "length", canonical: "mi", factor: 1609.344 },
  mg: { category: "mass", canonical: "mg", factor: 0.000001 },
  g: { category: "mass", canonical: "g", factor: 0.001 },
  gram: { category: "mass", canonical: "g", factor: 0.001 },
  grams: { category: "mass", canonical: "g", factor: 0.001 },
  kg: { category: "mass", canonical: "kg", factor: 1 },
  kilogram: { category: "mass", canonical: "kg", factor: 1 },
  kilograms: { category: "mass", canonical: "kg", factor: 1 },
  oz: { category: "mass", canonical: "oz", factor: 0.028349523125 },
  ounce: { category: "mass", canonical: "oz", factor: 0.028349523125 },
  ounces: { category: "mass", canonical: "oz", factor: 0.028349523125 },
  lb: { category: "mass", canonical: "lb", factor: 0.45359237 },
  pound: { category: "mass", canonical: "lb", factor: 0.45359237 },
  pounds: { category: "mass", canonical: "lb", factor: 0.45359237 },
  ms: { category: "time", canonical: "ms", factor: 0.001 },
  millisecond: { category: "time", canonical: "ms", factor: 0.001 },
  milliseconds: { category: "time", canonical: "ms", factor: 0.001 },
  s: { category: "time", canonical: "s", factor: 1 },
  sec: { category: "time", canonical: "s", factor: 1 },
  second: { category: "time", canonical: "s", factor: 1 },
  seconds: { category: "time", canonical: "s", factor: 1 },
  min: { category: "time", canonical: "min", factor: 60 },
  minute: { category: "time", canonical: "min", factor: 60 },
  minutes: { category: "time", canonical: "min", factor: 60 },
  h: { category: "time", canonical: "h", factor: 3600 },
  hr: { category: "time", canonical: "h", factor: 3600 },
  hour: { category: "time", canonical: "h", factor: 3600 },
  hours: { category: "time", canonical: "h", factor: 3600 },
  d: { category: "time", canonical: "day", factor: 86400 },
  day: { category: "time", canonical: "day", factor: 86400 },
  days: { category: "time", canonical: "day", factor: 86400 },
  week: { category: "time", canonical: "week", factor: 604800 },
  weeks: { category: "time", canonical: "week", factor: 604800 },
  b: { category: "data", canonical: "B", factor: 1 },
  byte: { category: "data", canonical: "B", factor: 1 },
  bytes: { category: "data", canonical: "B", factor: 1 },
  kb: { category: "data", canonical: "kB", factor: 1000 },
  mb: { category: "data", canonical: "MB", factor: 1000000 },
  gb: { category: "data", canonical: "GB", factor: 1000000000 },
  tb: { category: "data", canonical: "TB", factor: 1000000000000 },
  kib: { category: "data", canonical: "KiB", factor: 1024 },
  mib: { category: "data", canonical: "MiB", factor: 1048576 },
  gib: { category: "data", canonical: "GiB", factor: 1073741824 },
  tib: { category: "data", canonical: "TiB", factor: 1099511627776 },
};

function number(value: string): number {
  return Number(value.replace(/,/g, ""));
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "not a finite value";
  return new Intl.NumberFormat("en", { maximumSignificantDigits: 10 }).format(value);
}

function temperature(value: number, unit: string): number | null {
  const normalized = unit.toLowerCase();
  if (["c", "°c", "celsius"].includes(normalized)) return value;
  if (["f", "°f", "fahrenheit"].includes(normalized)) return (value - 32) * (5 / 9);
  if (["k", "°k", "kelvin"].includes(normalized)) return value - 273.15;
  return null;
}

function fromCelsius(value: number, unit: string): number | null {
  const normalized = unit.toLowerCase();
  if (["c", "°c", "celsius"].includes(normalized)) return value;
  if (["f", "°f", "fahrenheit"].includes(normalized)) return value * (9 / 5) + 32;
  if (["k", "°k", "kelvin"].includes(normalized)) return value + 273.15;
  return null;
}

export function convertQuery(query: string): ConversionResult | null {
  const match = query.trim().match(
    /^(?:convert\s+)?(-?(?:\d+(?:\.\d+)?|\.\d+))\s*([a-z°]+)\s+(?:to|in)\s+([a-z°]+)$/i,
  );
  if (!match) return null;
  const value = number(match[1]);
  const from = match[2].toLowerCase();
  const to = match[3].toLowerCase();
  const fromTemp = temperature(value, from);
  const toTemp = fromCelsius(0, to);
  if (fromTemp !== null && toTemp !== null) {
    const result = fromCelsius(fromTemp, to);
    if (result === null) return null;
    return { value: result, from, to, label: `${formatNumber(value)} ${from} = ${formatNumber(result)} ${to}` };
  }
  const source = UNITS[from];
  const target = UNITS[to];
  if (!source || !target || source.category !== target.category || source.factor === undefined || target.factor === undefined) {
    return null;
  }
  const result = (value * source.factor) / target.factor;
  return { value: result, from: source.canonical, to: target.canonical, label: `${formatNumber(value)} ${source.canonical} = ${formatNumber(result)} ${target.canonical}` };
}

function tokenize(expression: string): string[] | null {
  const tokens = expression.match(/(?:\d+(?:\.\d+)?|\.\d+|[()+\-*/%^])/g);
  if (!tokens || tokens.join("") !== expression.replace(/\s+/g, "")) return null;
  return tokens;
}

export function calculate(expression: string): number | null {
  const cleaned = expression.trim().replace(/,/g, "").replace(/(\d+(?:\.\d+)?)\s*%\s+of\s+(\d+(?:\.\d+)?)/gi, "($1/100)*$2");
  if (!cleaned || cleaned.length > 120) return null;
  const tokens = tokenize(cleaned);
  if (!tokens) return null;
  let index = 0;
  const peek = () => tokens[index];
  const take = () => tokens[index++];

  const primary = (): number | null => {
    const token = peek();
    if (!token) return null;
    if (token === "(") {
      take();
      const value = addSub();
      if (take() !== ")") return null;
      return value;
    }
    if (token === "+" || token === "-") {
      take();
      const value = primary();
      return value === null ? null : token === "-" ? -value : value;
    }
    take();
    return Number(token);
  };
  const power = (): number | null => {
    const left = primary();
    if (left === null) return null;
    if (peek() !== "^") return left;
    take();
    const right = power();
    if (right === null || Math.abs(right) > 20) return null;
    return left ** right;
  };
  const mulDiv = (): number | null => {
    let value = power();
    while (value !== null && ["*", "/", "%"].includes(peek() ?? "")) {
      const operator = take();
      const right = power();
      if (right === null || (operator === "/" && right === 0) || (operator === "%" && right === 0)) return null;
      value = operator === "*" ? value * right : operator === "/" ? value / right : value % right;
    }
    return value;
  };
  const addSub = (): number | null => {
    let value = mulDiv();
    while (value !== null && ["+", "-"].includes(peek() ?? "")) {
      const operator = take();
      const right = mulDiv();
      if (right === null) return null;
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  };
  const value = addSub();
  if (index !== tokens.length || value === null || !Number.isFinite(value)) return null;
  return value;
}

export function isCalculationQuery(query: string): boolean {
  const trimmed = query.trim();
  if (/^(?:calc|calculate)\s+/i.test(trimmed)) return true;
  if (/^[\d\s().+\-*/%^]+$/.test(trimmed) && /[+\-*/%^]/.test(trimmed)) return true;
  return /^-?(?:\d+(?:\.\d+)?|\.\d+)\s*%\s+of\s+-?(?:\d+(?:\.\d+)?|\.\d+)(?:\s*[+\-*/]\s*-?(?:\d+(?:\.\d+)?|\.\d+))*$/i.test(trimmed);
}

export function formatCalculation(value: number): string {
  return formatNumber(value);
}

export function transformText(command: string): string | null {
  const match = command.trim().match(/^(upper|uppercase|lower|lowercase|title|slug|encode|decode)\s*[: ]\s*(.+)$/is);
  if (!match) return null;
  const value = match[2].trim();
  if (!value) return null;
  switch (match[1].toLowerCase()) {
    case "upper":
    case "uppercase":
      return value.toLocaleUpperCase();
    case "lower":
    case "lowercase":
      return value.toLocaleLowerCase();
    case "title":
      return value.toLocaleLowerCase().replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase());
    case "slug":
      return value.toLocaleLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    case "encode":
      return encodeURIComponent(value);
    case "decode":
      try {
        return decodeURIComponent(value);
      } catch {
        return null;
      }
    default:
      return null;
  }
}

function randomInt(max: number): number {
  if (max <= 0) return 0;
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) return Math.floor(Math.random() * max);
  const values = new Uint32Array(1);
  const limit = Math.floor(0xffffffff / max) * max;
  do cryptoApi.getRandomValues(values); while (values[0] >= limit);
  return values[0] % max;
}

export function roll(max: number): number {
  return randomInt(max) + 1;
}

export function generatePassword(length = 20): string {
  const groups = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#$%^&*_-+="];
  const chars = groups.map((group) => group[randomInt(group.length)]);
  const all = groups.join("");
  while (chars.length < Math.max(4, Math.min(length, 64))) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("").slice(0, Math.max(4, Math.min(length, 64)));
}

export function randomChoice<T>(values: T[]): T | null {
  return values.length ? values[randomInt(values.length)] : null;
}
