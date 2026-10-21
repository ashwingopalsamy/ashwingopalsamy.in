/**
 * keyspace - finds one of the eight eMudhra keys in the reader's browser, on its own.
 *
 * The search is real: p384.recoverKey walks d*G in affine BigInt arithmetic against the OV TLS G3C
 * certificate's published x and y. Once it has the answer, a marker walks the grid cells for
 * d = 1, 2, 3, 4 and rests on the key, then one status line says how long the search took. It
 * only ever recovers d for an already-public, revoked key; nothing here signs anything. Any
 * failure leaves the static figure as it was. boot.ts sends fig:replay when the reader replays it.
 */

import { hexToBigInt, recoverKey } from "../../lib/incident/p384";
import { intermediates, onVisible, prefersReducedMotion } from "./data";

const MARK = "ov-tls-g3c";

interface Row {
  markId?: string;
  key?: { x?: string; y?: string };
}

export function mount(fig: HTMLElement, { signal }: { signal: AbortSignal }): void {
  const art = fig.querySelector(".fig__art");
  const row = (intermediates as unknown as Row[]).find((r) => r.markId === MARK && r.key?.x && r.key?.y);
  if (!art || !row?.key?.x || !row.key.y || fig.querySelector(".fig__result")) return;
  let x: bigint;
  let y: bigint;
  try {
    x = hexToBigInt(row.key.x);
    y = hexToBigInt(row.key.y);
  } catch {
    return;
  }

  const result = document.createElement("p");
  result.className = "fig__result";
  result.setAttribute("role", "status");
  art.after(result);

  let timer = 0;
  let run = 0;
  let outcome: { d: number; ms: number } | null = null;

  const cells = (d: number) => fig.querySelectorAll<SVGElement>(`[data-d="${d}"]`);
  const paint = (d: number, top: number) => cells(d).forEach((c) => c.setAttribute("data-state", d === top ? "match" : "tried"));
  const clear = () => fig.querySelectorAll("[data-state]").forEach((c) => c.removeAttribute("data-state"));
  const gap = () => {
    const ms = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--dur-enter"));
    return Number.isFinite(ms) ? ms : 240;
  };

  /** One cell per beat, 1 up to d; the beat is the entrance time, so the walk ends as the key lands. */
  const walk = (d: number, token: number) =>
    new Promise<boolean>((resolve) => {
      const beat = gap();
      let n = 0;
      const tick = () => {
        if (signal.aborted || token !== run) return resolve(false);
        paint(++n, d);
        if (n >= d) return resolve(true);
        timer = window.setTimeout(tick, beat);
      };
      timer = window.setTimeout(tick, beat);
    });

  async function play() {
    const token = ++run;
    window.clearTimeout(timer);
    clear();
    if (!outcome) {
      const t0 = performance.now();
      let hit: Awaited<ReturnType<typeof recoverKey>> = null;
      try {
        hit = await recoverKey(x, y, { max: 255, yieldEvery: 32 });
      } catch {
        hit = null;
      }
      if (signal.aborted || token !== run) return;
      if (!hit) {
        result.remove();
        return;
      }
      outcome = { d: hit.d, ms: performance.now() - t0 };
    }
    const { d, ms } = outcome;
    if (prefersReducedMotion()) {
      for (let i = 1; i <= d; i++) paint(i, d);
    } else if (!(await walk(d, token))) {
      return;
    }
    const took = ms < 10 ? ms.toFixed(1) : String(Math.round(ms));
    result.textContent = `Found d = ${d} in ${d} ${d === 1 ? "guess" : "guesses"}, ${took} ms, on your device.`;
  }

  onVisible(fig, () => void play(), signal);
  fig.addEventListener("fig:replay", () => void play(), { signal });
  signal.addEventListener(
    "abort",
    () => {
      window.clearTimeout(timer);
      clear();
    },
    { once: true },
  );
}
