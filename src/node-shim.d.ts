/**
 * Minimal ambient type for the one Node built-in this project touches
 * (a build-time git SHA lookup in SiteFooter.astro). @types/node isn't
 * installed - the Visa artifactory registry this environment resolves
 * against can't reach the public npm registry to fetch it - so this
 * hand-written shim covers just the one function actually used instead.
 */
declare module "node:child_process" {
  export function execSync(command: string): { toString(): string };
}