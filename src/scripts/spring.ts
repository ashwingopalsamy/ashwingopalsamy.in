/**
 * spring - damped harmonic oscillators sampled into CSS linear() easings,
 * so Web Animations can play a real spring on the compositor.
 *
 * Parameters follow the phone's own vocabulary: `response` is the period of
 * the undamped oscillation in seconds, `damping` the damping ratio (1 is
 * critically damped, below 1 overshoots). `velocity` hands a gesture over:
 * the release speed as a fraction of the remaining distance per second, so
 * a flick continues at the speed the finger left it instead of restarting.
 *
 * The duration is where the spring settles within 0.15% of the distance,
 * so a curve that visually lands at 300ms may report 500ms. Results are
 * cached by parameters; velocity is rounded to two decimals for the key.
 */

export interface SpringOptions {
  response: number;
  damping: number;
  velocity?: number;
}

export interface Spring {
  easing: string;
  duration: number;
}

const supportsLinear = typeof CSS !== "undefined" && CSS.supports?.("animation-timing-function", "linear(0, 1)");
const cache = new Map<string, Spring>();
const SETTLE = 0.0015;
const STEP = 1 / 240;

export function spring({ response, damping, velocity = 0 }: SpringOptions): Spring {
  const v = Math.max(-60, Math.min(60, velocity));
  const key = `${response}|${damping}|${v.toFixed(2)}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const w0 = (2 * Math.PI) / response;
  const zeta = Math.min(damping, 1);
  // displacement from the target: d(0) = 1, d'(0) = -v
  const displacement = (t: number) => {
    if (zeta < 1) {
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      return Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0 - v) / wd) * Math.sin(wd * t));
    }
    return Math.exp(-w0 * t) * (1 + (w0 - v) * t);
  };

  let settled = 0;
  for (let t = 0; t < 4; t += STEP) {
    if (Math.abs(displacement(t)) > SETTLE) settled = t;
  }
  const seconds = Math.max(settled + STEP, 0.08);
  const samples = Math.min(96, Math.max(24, Math.round(seconds * 72)));
  const points: string[] = [];
  for (let index = 0; index <= samples; index += 1) {
    const progress = index === samples ? 1 : 1 - displacement((index / samples) * seconds);
    points.push(String(Math.round(progress * 10000) / 10000));
  }

  const result: Spring = {
    easing: supportsLinear ? `linear(${points.join(", ")})` : "cubic-bezier(0.2, 0.9, 0.1, 1)",
    duration: Math.round(seconds * 1000),
  };
  cache.set(key, result);
  return result;
}

/** The phone's springs, named by what they move. */
export const springs = {
  /** a thumbnail opening to full screen: quick, the faintest settle */
  open: { response: 0.42, damping: 0.86 },
  /** back into the grid, a touch quicker than it left */
  close: { response: 0.38, damping: 0.9 },
  /** one page to the next: no bounce, a page never overshoots */
  page: { response: 0.34, damping: 1 },
  /** a drag let go short of its threshold */
  settle: { response: 0.3, damping: 0.82 },
  /** zoom in and out, and a pan clamped back to its bounds */
  zoom: { response: 0.36, damping: 0.88 },
  /** the info sheet */
  sheet: { response: 0.4, damping: 0.9 },
} as const satisfies Record<string, SpringOptions>;
