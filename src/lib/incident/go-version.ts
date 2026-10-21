// Is this Go toolchain on the eMudhra distrust list? Pure string logic, no imports, no DOM.
//
// Fixed releases: Go 1.27.3 and 1.26.10 (CVE-2026-111943, golang/go#82345). The fix is on master (commit
// 7f86f95, milestone Go1.28), so any final 1.28 or later has it. Older lines get no backport. The numbers
// below are the defaults; callers pass `data.go` from src/data/emudhra-incident.json to override them.

export interface GoVersion {
  /** The matched version token, e.g. "go1.27.3" or "go1.28rc1" (never the vendor suffix). */
  raw: string;
  major: number;
  minor: number;
  /** 0 when the input has no patch: "go1.27" is 1.27.0. */
  patch: number;
  pre?: 'rc' | 'beta';
  preN?: number;
  devel: boolean;
  /** Text glued to the version that is not part of it: "-microsoft", "-1", " X:boringcrypto". */
  vendor?: string;
  /** Path before "path: go1.x" in `go version -m` / `go version ./bin/*` output. */
  binary?: string;
}

export type GoClass = 'fixed' | 'vulnerable' | 'unsupported' | 'prerelease';

export interface GoRules {
  /** Minor line to first fixed patch, e.g. { "1.27": 3, "1.26": 10 }. */
  fixedPatch: Record<string, number>;
  /** First minor whose final release carries the fix by construction (28). */
  firstFixedMinor: number;
  /** Master commit that carries the block; the answer for pre-release and devel builds. */
  fixCommit: string;
}

export const DEFAULT_GO_RULES: GoRules = {
  fixedPatch: { '1.27': 3, '1.26': 10 },
  firstFixedMinor: 28,
  fixCommit: '7f86f95',
};

export const GO_STATUS_WORD: Record<GoClass, string> = {
  fixed: 'Fixed',
  vulnerable: 'Vulnerable',
  unsupported: 'Unsupported',
  prerelease: 'Check',
};

// go1.27.2, go1.27, go1.27rc1, go1.28beta1, go1.28-abcdef. Not glued to other word characters.
const GO_TOKEN = /(?<![\w.-])go(\d{1,4})\.(\d{1,4})(?:\.(\d{1,4}))?(?:(rc|beta)(\d{1,4}))?(?![\w.])/;
// "./bin/api: go1.26.4": everything before the first ": " that is followed by a version or "devel".
const BINARY_PREFIX = /^\s*(.+?):\s+(?=(?:devel\s+)?go\d|devel\b)/;
// What may follow the version and still belong to it: "-microsoft", "+build", " X:boringcrypto,foo".
const VENDOR = /^(?:[-+]\S*)?(?:\s+X:\S+)*/;

function parseLine(line: string): GoVersion | null | undefined {
  let binary: string | undefined;
  let text = line;
  const bin = BINARY_PREFIX.exec(line);
  if (bin) {
    binary = bin[1];
    text = line.slice(bin[0].length);
  }
  const m = GO_TOKEN.exec(text);
  if (!m) {
    // Older dev builds print "go version devel +abc123 ..." with no go1.N token.
    return /^\s*(?:go version\s+)?devel\b/.test(text) ? { raw: 'devel', major: 1, minor: 0, patch: 0, devel: true, ...(binary ? { binary } : {}) } : undefined;
  }
  if (Number(m[1]) !== 1) return null;
  const devel = /\bdevel\s*$/.test(text.slice(0, m.index));
  const vendor = VENDOR.exec(text.slice(m.index + m[0].length))?.[0] ?? '';
  const v: GoVersion = {
    raw: m[0],
    major: 1,
    minor: Number(m[2]),
    patch: m[3] === undefined ? 0 : Number(m[3]),
    devel,
  };
  if (m[4] === 'rc' || m[4] === 'beta') {
    v.pre = m[4];
    v.preN = Number(m[5]);
  }
  if (vendor) v.vendor = vendor;
  if (binary) v.binary = binary;
  return v;
}

/**
 * Finds the first `go1.N[.P][rcN|betaN]` (or `devel`) in the text. Accepts a bare `go1.27.2`, the full
 * `go version go1.27.2 linux/amd64` line, `./bin/api: go1.26.4`, and multi-line `go version -m` output
 * (the first line that has a version wins). Returns null when nothing matches or the major is not 1.
 */
export function parseGoVersion(line: string): GoVersion | null {
  if (typeof line !== 'string') return null;
  for (const one of line.slice(0, 16384).split('\n')) {
    const found = parseLine(one);
    if (found !== undefined) return found;
  }
  return null;
}

/** devel/rc/beta: prerelease. Then the minor decides: >= firstFixedMinor fixed, a listed line by patch, else unsupported. */
export function classify(v: GoVersion, rules: GoRules = DEFAULT_GO_RULES): GoClass {
  if (v.devel || v.pre) return 'prerelease';
  if (v.minor >= rules.firstFixedMinor) return 'fixed';
  const first = rules.fixedPatch[`${v.major}.${v.minor}`];
  if (first === undefined) return 'unsupported';
  return v.patch >= first ? 'fixed' : 'vulnerable';
}

/** Fixed releases, ascending by minor: ["1.26.10", "1.27.3"]. */
export function fixedReleases(rules: GoRules = DEFAULT_GO_RULES): string[] {
  return Object.entries(rules.fixedPatch)
    .sort((a, b) => Number(a[0].split('.')[1]) - Number(b[0].split('.')[1]))
    .map(([line, patch]) => `${line}.${patch}`);
}

/** The one-line next step shown by the Go version checker (experience-spec 2.9). */
export function goAction(v: GoVersion, rules: GoRules = DEFAULT_GO_RULES): string {
  const cls = classify(v, rules);
  let action: string;
  if (cls === 'fixed') action = 'Confirm each deployed binary with `go version -m`.';
  else if (cls === 'vulnerable') action = `Rebuild with ${v.major}.${v.minor}.${rules.fixedPatch[`${v.major}.${v.minor}`]} and redeploy.`;
  else if (cls === 'unsupported') action = `No fix. Move to ${fixedReleases(rules).join(' or ')}, then rebuild.`;
  else action = `Fixed only if the build includes commit ${rules.fixCommit}.`;
  return v.vendor ? `${action} Vendor build: check the vendor's release notes too.` : action;
}
