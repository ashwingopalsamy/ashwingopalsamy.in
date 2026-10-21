// NIST P-384 (secp384r1) public-key lookup for the eMudhra incident page.
//
// The only operation here is a bounded search: given a public point, test whether it equals d*G for some
// d in 1..255 by repeatedly adding G (affine coordinates). That is what the eight compromised eMudhra
// intermediates allow, because their private scalars were below 256. There is no signing, no ECDSA and no
// general discrete-log search; the loop cannot run past 255 steps. Pure BigInt, no imports, no DOM, so
// it runs under Node type stripping and in the browser.

export const p = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffeffffffff0000000000000000ffffffffn;
export const a = -3n;
export const b = 0xb3312fa7e23ee7e4988e056be3f82d19181d9c6efe8141120314088f5013875ac656398d8a2ed19d2a85c8edd3ec2aefn;
export const Gx = 0xaa87ca22be8b05378eb1c71ef320ad746e1d3b628ba79b9859f741e082542a385502f25dbf55296c3a545e3872760ab7n;
export const Gy = 0x3617de4a96262c6f5d9e98bf9292dc29f8f41dbd289a147ce9da3113b5f0b8c00a60b1ce1d7e819d7a431d7c90ea0e5fn;
export const n = 0xffffffffffffffffffffffffffffffffffffffffffffffffc7634d81f4372ddf581a0db248b0a77aecec196accc52973n;

/** Hard ceiling for the search. The compromised scalars are all below 256. */
export const MAX_GUESSES = 255;

export interface RecoverOptions {
  /** Highest d to try, 1..255 (default 255). Values above 255 are clamped. */
  max?: number;
  /** Await a macrotask every this many steps (default 16). */
  yieldEvery?: number;
  /** Called after each candidate is tested: d and the x coordinate of d*G. */
  onStep?: (d: number, qx: bigint) => void;
}

export interface RecoverResult {
  d: number;
  guesses: number;
  ms: number;
}

const mod = (v: bigint): bigint => {
  const r = v % p;
  return r < 0n ? r + p : r;
};

// Modular inverse of v mod p by extended Euclid. Callers never pass 0 mod p.
function inv(v: bigint): bigint {
  let r0 = p;
  let r1 = mod(v);
  let t0 = 0n;
  let t1 = 1n;
  while (r1 !== 0n) {
    const q = r0 / r1;
    [r0, r1] = [r1, r0 - q * r1];
    [t0, t1] = [t1, t0 - q * t1];
  }
  return mod(t0);
}

type Point = readonly [bigint, bigint];

// Affine Q + G. Q == G takes the doubling formula; Q == -G (infinity) cannot occur for d < n.
function addG(q: Point): Point | null {
  const [qx, qy] = q;
  let lambda: bigint;
  if (qx === Gx) {
    if (qy !== Gy) return null;
    lambda = mod((3n * Gx * Gx + a) * inv(2n * Gy));
  } else {
    lambda = mod((Gy - qy) * inv(Gx - qx));
  }
  const x3 = mod(lambda * lambda - qx - Gx);
  return [x3, mod(lambda * (qx - x3) - qy)];
}

function onCurve(x: bigint, y: bigint): boolean {
  return x >= 0n && x < p && y >= 0n && y < p && mod(y * y) === mod(x * x * x + a * x + b);
}

function yieldToEventLoop(): Promise<void> {
  const scheduler = (globalThis as unknown as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (scheduler && typeof scheduler.yield === 'function') return scheduler.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Looks for d in 1..max (at most 255) with d*G == (x, y). Resolves null when the point is not on the
 * curve or no such d exists in range.
 */
export async function recoverKey(x: bigint, y: bigint, opts: RecoverOptions = {}): Promise<RecoverResult | null> {
  const max = Math.min(MAX_GUESSES, Math.max(1, Math.floor(opts.max ?? MAX_GUESSES)));
  const yieldEvery = Math.max(1, Math.floor(opts.yieldEvery ?? 16));
  if (!onCurve(x, y)) return null;

  const start = performance.now();
  let q: Point | null = [Gx, Gy];
  for (let d = 1; d <= max && q !== null; d++) {
    opts.onStep?.(d, q[0]);
    if (q[0] === x && q[1] === y) return { d, guesses: d, ms: performance.now() - start };
    q = addG(q);
    if (d % yieldEvery === 0) await yieldToEventLoop();
  }
  return null;
}

/** Parses a hex string (optional 0x prefix) into a BigInt. Throws on anything that is not hex. */
export function hexToBigInt(hex: string): bigint {
  const s = hex.trim().replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{1,128}$/.test(s)) throw new Error('hexToBigInt: not a hex string');
  return BigInt(`0x${s}`);
}

/** Lowercase, zero-padded hex (48 bytes by default, the P-384 coordinate size). */
export function bigIntToHex(v: bigint, bytes = 48): string {
  if (v < 0n) throw new Error('bigIntToHex: negative value');
  return v.toString(16).padStart(bytes * 2, '0');
}

function base64UrlToBigInt(s: string): bigint {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(s)) throw new Error('jwkToXY: bad base64url coordinate');
  const padded = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
  const bin = atob(padded);
  let hex = '';
  for (let i = 0; i < bin.length; i++) hex += bin.charCodeAt(i).toString(16).padStart(2, '0');
  return BigInt(`0x${hex || '0'}`);
}

/** Extracts the public point from an EC P-384 JWK (as produced by `KeyObject.export({ format: 'jwk' })`). */
export function jwkToXY(jwk: { kty?: string; crv?: string; x?: string; y?: string }): { x: bigint; y: bigint } {
  if (jwk.kty !== undefined && jwk.kty !== 'EC') throw new Error('jwkToXY: not an EC key');
  if (jwk.crv !== undefined && jwk.crv !== 'P-384') throw new Error('jwkToXY: not a P-384 key');
  if (typeof jwk.x !== 'string' || typeof jwk.y !== 'string') throw new Error('jwkToXY: missing x or y');
  return { x: base64UrlToBigInt(jwk.x), y: base64UrlToBigInt(jwk.y) };
}
