// The three read-only eMudhra incident tools, shared by WebMCP (src/scripts/webmcp.ts) and the /mcp endpoint
// (functions/mcp/index.ts). No DOM, no Vite-only imports: both runtimes bundle it. Inputs are re-validated
// against the same zod schemas the tools are registered with. Nothing here signs, exports a private key, or
// leaves the process; the only key material touched is the eight revoked intermediates' public points, and
// recover_key re-checks the stored scalar with one small scalar multiplication rather than searching.

import data from "../../data/emudhra-incident.json";
import { CANONICAL_KNOWLEDGE } from "../../data/canonical-knowledge";
import {
  checkGoVersionZodSchema,
  getEmudhraIncidentZodSchema,
  recoverKeyZodSchema,
} from "../canonical-capabilities";
import { DEFAULT_GO_RULES, GO_STATUS_WORD, classify, fixedReleases, goAction, parseGoVersion } from "./go-version";
import type { GoRules } from "./go-version";
import { Gx, Gy, hexToBigInt, p } from "./p384";

interface IncidentRow {
  name: string;
  markId?: string;
  usage: string;
  operator: string;
  issuedBy: string;
  issuerOperator: string;
  spkiSha256: string;
  notBefore: string;
  notAfter: string;
  revocation: { status: string; date: string; reason: string };
  key: { curve: string; x: string; y: string };
  d: number | null;
}

interface IncidentData {
  asOf: string;
  syncedAt: string;
  sourceSha: string;
  sourceUrl: string;
  counts: { total: number; patched: number; pending: number };
  patched: { name: string; key: string; versions: string[]; url: string; status: "patched" | "pending" }[];
  intermediates: IncidentRow[];
  events: { id: string; lane: string; label: string }[];
  go: Partial<GoRules> & { fixed?: string[]; cve?: string; blockedSpkiSha256: string[] };
}

const incident = data as unknown as IncidentData;
const ARTICLE = `${CANONICAL_KNOWLEDGE.origin}/blog/emudhra-ca-key-compromise-go-developers/`;
const CVE = incident.go.cve ?? "CVE-2026-111943";
const rules: GoRules = {
  fixedPatch: incident.go.fixedPatch ?? DEFAULT_GO_RULES.fixedPatch,
  firstFixedMinor: incident.go.firstFixedMinor ?? DEFAULT_GO_RULES.firstFixedMinor,
  fixCommit: incident.go.fixCommit ?? DEFAULT_GO_RULES.fixCommit,
};

/** `EM OV TLS CA - G3C` -> `ov-tls-g3c`, unless the data file already carries the id. */
function markId(row: IncidentRow): string {
  const m = /^EM (DV|OV|EV) (TLS|CS) CA - (G3[BC])$/.exec(row.name);
  return row.markId ?? (m ? m.slice(1).join("-").toLowerCase() : row.name.toLowerCase());
}

/** The eight eMudhra-issued intermediates; the Sectigo cross-signs carry the same keys. */
const eight = () => incident.intermediates.filter((row) => row.issuerOperator === "eMudhra");

const matcher = (filter?: string) => {
  const needle = filter?.trim().toLowerCase();
  return (...fields: (string | undefined)[]) => !needle || fields.some((f) => f?.toLowerCase().includes(needle));
};

function provenance() {
  return { article: ARTICLE, upstream: incident.sourceUrl, sourceSha: incident.sourceSha, asOf: incident.asOf };
}

export function getEmudhraIncident(input: unknown) {
  const { section, filter } = getEmudhraIncidentZodSchema.parse(input);
  const match = matcher(filter);

  if (section === "timeline") {
    return { section, ...provenance(), events: incident.events.filter((e) => match(e.lane, e.label)) };
  }

  if (section === "tracker") {
    const want = filter?.trim().toLowerCase();
    const rows = incident.patched
      .filter((row) => (want === "pending" || want === "patched" ? row.status === want : match(row.name)))
      .map(({ name, versions, status, url }) => ({ name, versions, status, url }));
    return { section, ...provenance(), counts: incident.counts, syncedAt: incident.syncedAt, rows };
  }

  if (section === "intermediates") {
    const rows = incident.intermediates
      .filter((row) => match(row.name, markId(row), row.usage, row.operator))
      .map((row) => ({
        name: row.name,
        markId: markId(row),
        usage: row.usage,
        operator: row.operator,
        issuedBy: row.issuedBy,
        issuerOperator: row.issuerOperator,
        spkiSha256: row.spkiSha256,
        notBefore: row.notBefore,
        notAfter: row.notAfter,
        revoked: row.revocation,
        d: row.d,
        bits: row.d === null ? null : row.d.toString(2).length,
      }));
    return { section, ...provenance(), rows };
  }

  if (section === "go") {
    return {
      section,
      ...provenance(),
      cve: CVE,
      fixedIn: fixedReleases(rules),
      firstFixedMinor: rules.firstFixedMinor,
      fixCommit: rules.fixCommit,
      blockedSpkiSha256: incident.go.blockedSpkiSha256,
    };
  }

  const ds = eight().flatMap((row) => (row.d === null ? [] : [row.d]));
  return {
    section,
    ...provenance(),
    cve: CVE,
    counts: incident.counts,
    pending: incident.patched.filter((row) => row.status === "pending").map((row) => row.name),
    goFixedIn: fixedReleases(rules),
    intermediates: {
      count: eight().length,
      revoked: eight().every((row) => row.revocation.status === "revoked"),
      dMin: Math.min(...ds),
      dMax: Math.max(...ds),
    },
  };
}

export function checkGoVersion(input: unknown) {
  const { goVersion } = checkGoVersionZodSchema.parse(input);
  const lines = goVersion.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 200);
  return {
    cve: CVE,
    fixedIn: fixedReleases(rules),
    results: lines.map((line) => {
      const v = parseGoVersion(line);
      if (!v) return { status: "Unrecognised", action: "That doesn't look like go version output." };
      const cls = classify(v, rules);
      return {
        ...(v.binary ? { binary: v.binary } : {}),
        version: v.raw,
        class: cls,
        status: GO_STATUS_WORD[cls],
        action: goAction(v, rules),
        ...(v.vendor ? { vendor: v.vendor.trim() } : {}),
      };
    }),
  };
}

const mod = (v: bigint): bigint => {
  const r = v % p;
  return r < 0n ? r + p : r;
};

type Jacobian = readonly [bigint, bigint, bigint];

// Jacobian doubling for a = -3 (P-384): dbl-2001-b.
function double([x, y, z]: Jacobian): Jacobian {
  const delta = mod(z * z);
  const gamma = mod(y * y);
  const beta = mod(x * gamma);
  const alpha = mod(3n * (x - delta) * (x + delta));
  const x3 = mod(alpha * alpha - 8n * beta);
  return [x3, mod(alpha * (4n * beta - x3) - 8n * gamma * gamma), mod((y + z) * (y + z) - gamma - delta)];
}

// Jacobian + affine G: madd-2007-bl. Only reached with Q = kG for 2 <= k < 256, so Q is never +-G and H is never 0.
function addG([x, y, z]: Jacobian): Jacobian {
  const zz = mod(z * z);
  const h = mod(Gx * zz - x);
  const hh = mod(h * h);
  const i = 4n * hh;
  const j = mod(h * i);
  const r = mod(2n * (Gy * z * zz - y));
  const v = mod(x * i);
  const x3 = mod(r * r - j - 2n * v);
  return [x3, mod(r * (v - x3) - 2n * y * j), mod((z + h) * (z + h) - zz - hh)];
}

/** True when d*G equals the affine point (x, y). One double-and-add (d < 256) and no inversion: compared as
 *  X == x*Z^2 and Y == y*Z^3. */
function scalarMatches(d: number, x: bigint, y: bigint): boolean {
  if (!Number.isInteger(d) || d < 1 || d > 255) return false;
  const bits = d.toString(2);
  let q: Jacobian = [Gx, Gy, 1n];
  for (let i = 1; i < bits.length; i++) {
    q = double(q);
    if (bits[i] === "1") q = addG(q);
  }
  const zz = mod(q[2] * q[2]);
  return q[0] === mod(x * zz) && q[1] === mod(y * zz * q[2]);
}

/** The stored d was recovered at build time (src/lib/incident/p384.ts); each call re-verifies d*G against the
 *  certificate's public point instead of searching again. Nothing is signed or exported. */
export function recoverKey(input: unknown) {
  const { intermediate } = recoverKeyZodSchema.parse(input);
  const needle = intermediate.trim().toLowerCase();
  const row = eight().find((r) => [markId(r), r.name.toLowerCase(), r.spkiSha256].includes(needle));
  if (!row) return { error: "unknown_intermediate", available: eight().map(markId) };

  const base = { intermediate: row.name, markId: markId(row), curve: row.key.curve, spkiSha256: row.spkiSha256 };
  if (row.d === null || !scalarMatches(row.d, hexToBigInt(row.key.x), hexToBigInt(row.key.y))) {
    return { ...base, publicKeyMatch: false, error: "stored_scalar_not_verified" };
  }
  return {
    ...base,
    d: row.d,
    guesses: row.d,
    // d*G equals the certificate's public point (x, y), checked on this call.
    publicKeyMatch: true,
    note: "A revoked key whose private scalar is below 256. A properly random P-384 key would need about 2^384 guesses.",
  };
}
