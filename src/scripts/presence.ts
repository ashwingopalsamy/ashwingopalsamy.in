/**
 * presence - the single source of truth for "is Ashwin around right now".
 *
 * One clock (Asia/Kolkata) drives a three-tier state: available (08-20),
 * winding-down (20-24 and 06-08), asleep (00-06). Everything on the page
 * that shows presence - the footer dot, the map pin, the CTA line, the tab
 * favicon - subscribes to the "presence:change" document event instead of
 * recomputing the hour itself, so there is exactly one place this logic can
 * go wrong.
 *
 * Two entry points:
 *   - getPresence(now)  - pure. Turns a Date into a Presence. Used for the
 *     build-time / no-JS baseline and by tickPresence below.
 *   - tickPresence(now) - stateful. Call it as often as you like (the
 *     footer clock already ticks every second); it only recomputes and
 *     dispatches "presence:change" when the *state* actually changes, so a
 *     tooltip label or a hover morph never gets rewritten mid-display.
 *     Any consumer can call it once at init for an immediate value, then
 *     listen for the event for the rest - module-level state means whoever
 *     calls it first "primes" the broadcast, so there's no load-order
 *     dependency between components.
 *
 * No framework, no dependency: Intl.DateTimeFormat directly.
 */

export type PresenceState = "available" | "winding-down" | "asleep";

export interface Presence {
  state: PresenceState;
  /** a CSS value - a var() reference to the state's colour token */
  token: string;
  /** a short, worded status - varies between state changes, not fixed */
  label: string;
  /** hour in Asia/Kolkata, 0-23 */
  hour: number;
}

export const PRESENCE_EVENT = "presence:change";

const ASHWIN_TZ = "Asia/Kolkata";

const hourFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "numeric",
  hour12: false,
  timeZone: ASHWIN_TZ,
});

const TOKENS: Record<PresenceState, string> = {
  available: "var(--acc-green)",
  "winding-down": "var(--acc-amber)",
  asleep: "var(--vermilion)",
};

const LABELS: Record<PresenceState, string[]> = {
  available: [
    "Around right now.",
    "Awake and around in Pollachi.",
    "At my desk in Pollachi.",
    "Online and reachable.",
  ],
  "winding-down": [
    "Winding down in Pollachi.",
    "Late evening in Pollachi.",
    "Wrapping up for the day.",
    "Evening here, slowing down.",
  ],
  asleep: [
    "Asleep in Pollachi. I'll see it in the morning.",
    "Offline for the night in Pollachi.",
    "Asleep in Pollachi. Morning me will reply.",
  ],
};

function hourInKolkata(now: Date): number {
  // hour12:false + hour:"numeric" renders midnight as "24" in some engines
  // instead of "0" - normalise with a modulo.
  return Number(hourFormatter.format(now)) % 24;
}

function stateForHour(hour: number): PresenceState {
  if (hour >= 8 && hour < 20) return "available";
  if (hour < 6) return "asleep";
  return "winding-down"; // 06-08 or 20-24
}

function pickLabel(state: PresenceState): string {
  const pool = LABELS[state];
  return pool[Math.floor(Math.random() * pool.length)];
}

export function getPresence(now: Date): Presence {
  const hour = hourInKolkata(now);
  const state = stateForHour(hour);
  return { state, token: TOKENS[state], label: pickLabel(state), hour };
}

let last: Presence | undefined;

export function tickPresence(now: Date = new Date()): Presence {
  const hour = hourInKolkata(now);
  const state = stateForHour(hour);

  if (!last || last.state !== state) {
    last = { state, token: TOKENS[state], label: pickLabel(state), hour };
    if (typeof document !== "undefined") {
      document.dispatchEvent(new CustomEvent(PRESENCE_EVENT, { detail: last }));
    }
    return last;
  }

  // same state - keep the cached label (stable while a tooltip/status line
  // might be showing it) but keep the hour current for callers that care.
  last = { ...last, hour };
  return last;
}