import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const builtAt = new Date().toISOString();

function getGitCommit(): { short: string | null; full: string | null } {
  const envSha = process.env.CF_PAGES_COMMIT_SHA || process.env.GITHUB_SHA;
  if (envSha) {
    return {
      full: envSha,
      short: envSha.slice(0, 7),
    };
  }

  try {
    const full = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim() || null;
    const short = full ? full.slice(0, 7) : null;
    return { full, short };
  } catch {
    return { full: null, short: null };
  }
}

function getLockfileSha256(): string | null {
  try {
    const lockPath = resolve("package-lock.json");
    const content = readFileSync(lockPath);
    return createHash("sha256").update(content).digest("hex");
  } catch {
    return null;
  }
}

function getAstroVersion(): string {
  try {
    const manifest = JSON.parse(readFileSync(resolve("node_modules/astro/package.json"), "utf8"));
    return typeof manifest.version === "string" ? manifest.version : "unknown";
  } catch {
    return "unknown";
  }
}

const { full: fullCommit, short: commit } = getGitCommit();
const lockfileSha256 = getLockfileSha256();

export interface BuildManifest {
  schemaVersion: number;
  builtAt: string;
  gitCommit: string | null;
  gitCommitShort: string | null;
  lockfileSha256: string | null;
  nodeVersion: string;
  astroVersion: string;
}

export const buildManifest: BuildManifest = Object.freeze({
  schemaVersion: 1,
  builtAt,
  gitCommit: fullCommit,
  gitCommitShort: commit,
  lockfileSha256,
  nodeVersion: process.version,
  astroVersion: getAstroVersion(),
});

// Identifies one deploy: the client page store and the version-skew guard
// compare it with the id baked into each page. builtAt is the fallback so a
// build without a commit still gets an id that is stable within that build.
export const buildId = commit ?? builtAt;

export const buildMeta = Object.freeze({
  buildId,
  builtAt,
  commit,
  fullCommit,
  manifest: buildManifest,
});
