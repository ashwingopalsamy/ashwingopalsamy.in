/**
 * sound - a tiny Web Audio accent engine.
 *
 * On by default - the footer SoundToggle is the visible mute control, so
 * visitors can mute if desired. It still only ever makes a sound from a real
 * user gesture (browser autoplay policy blocks anything else), and the
 * toggle's own confirm blip is the feedback.
 *
 * No framework, no dependency: the Web Audio API directly.
 */

const STORAGE_KEY = "sound";
const MASTER_GAIN = 0.09;

/** The SSR-rendered default (no stored preference): on for new visitors. */
export const SOUND_DEFAULT = true;

export type Accent =
  | "tap"
  | "tick"
  | "select"
  | "pop"
  | "dismiss"
  | "tab"
  | "flip"
  | "theme"
  | "toggle-on"
  | "toggle-off"
  | "action"
  | "copy"
  | "page"
  | "chime";

type Listener = (enabled: boolean) => void;

interface BlipSpec {
  freq: number;
  endFreq?: number;
  type?: OscillatorType;
  /** seconds */
  dur?: number;
  /** 0..1, scaled by the master gain */
  gain?: number;
  /** seconds, relative to now */
  delay?: number;
  /** attack time in seconds */
  attack?: number;
}

let enabled = readStored();
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const listeners = new Set<Listener>();

let userGestured = false;
let lastSoundTime = 0;
let lastSoundTarget: EventTarget | null = null;

function readStored(): boolean {
  if (typeof localStorage === "undefined") return SOUND_DEFAULT;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === null) return SOUND_DEFAULT;
    return v === "on";
  } catch {
    return SOUND_DEFAULT;
  }
}

function ensureContext(): AudioContext | null {
  const globalObj = typeof window !== "undefined" ? window : globalThis;
  const Ctor =
    globalObj.AudioContext ??
    (globalObj as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;

  if (!ctx) {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = MASTER_GAIN;

    // Gentle low-pass filter to soften triangle harmonics and warm the bus
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 3600;
    filter.Q.value = 0.7;

    master.connect(filter);
    filter.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function pitchJitter(freq: number, cents = 6): number {
  const semitoneRatio = 2 ** (cents / 1200);
  const factor = 1 + (Math.random() * 2 - 1) * (semitoneRatio - 1);
  return freq * factor;
}

function durJitter(dur: number, pct = 0.06): number {
  return dur * (1 + (Math.random() * 2 - 1) * pct);
}

function gainJitter(gain: number, pct = 0.03): number {
  return gain * (1 + (Math.random() * 2 - 1) * pct);
}

function blip(ac: AudioContext, out: GainNode, spec: BlipSpec): void {
  const {
    freq,
    endFreq,
    type = "sine",
    dur = 0.12,
    gain = 1,
    delay = 0,
    attack = 0.006,
  } = spec;
  const t0 = ac.currentTime + delay;

  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(20, freq), t0);

  if (endFreq && endFreq > 0) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
  }

  // exponential ramps cannot touch zero - start and end just above it
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(g);
  g.connect(out);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

let lastPlayTime = 0;
let lastPlayAccent: Accent | null = null;

export function playAccent(accent: Accent): void {
  if (!enabled) return;
  if (!userGestured) return;

  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (now - lastPlayTime < 120 && lastPlayAccent === accent) {
    return;
  }
  lastPlayTime = now;
  lastPlayAccent = accent;
  lastSoundTime = now;

  const ac = ensureContext();
  if (!ac || !master) return;
  const out = master;

  switch (accent) {
    case "tap": {
      // soft velvet tactile micro-click with subtle organic variation
      const f = pitchJitter(440, 5);
      blip(ac, out, {
        freq: f,
        endFreq: f * 0.8,
        type: "triangle",
        dur: durJitter(0.036),
        gain: gainJitter(0.55),
        attack: 0.0025,
      });
      blip(ac, out, {
        freq: f * 0.66,
        endFreq: f * 0.5,
        type: "sine",
        dur: durJitter(0.032),
        gain: gainJitter(0.3),
        attack: 0.0025,
      });
      break;
    }

    case "tick":
      // crisp, ultra-light micro-tick
      blip(ac, out, {
        freq: pitchJitter(600, 4),
        type: "triangle",
        dur: durJitter(0.028),
        gain: gainJitter(0.45),
        attack: 0.002,
      });
      break;

    case "select":
      // subtle sine tick for selection movement and radio/menuitem navigation
      blip(ac, out, {
        freq: pitchJitter(415, 4),
        type: "sine",
        dur: durJitter(0.022),
        gain: gainJitter(0.4),
        attack: 0.002,
      });
      break;

    case "pop":
      // upward buoyant bubble pop for opening command palette / modals
      blip(ac, out, {
        freq: pitchJitter(440, 3),
        endFreq: pitchJitter(659.25, 3),
        type: "sine",
        dur: durJitter(0.065),
        gain: gainJitter(0.65),
        attack: 0.004,
      });
      break;

    case "dismiss":
      // gentle settling downward micro-drop for closing modals / palette / back
      blip(ac, out, {
        freq: pitchJitter(659.25, 3),
        endFreq: pitchJitter(440, 3),
        type: "sine",
        dur: durJitter(0.055),
        gain: gainJitter(0.55),
        attack: 0.004,
      });
      break;

    case "tab": {
      // warm dual-tone marimba notch blip for tabs / pills / segmented controls
      const base = pitchJitter(440, 4);
      blip(ac, out, {
        freq: base,
        type: "sine",
        dur: durJitter(0.055),
        gain: gainJitter(0.55),
        attack: 0.004,
      });
      blip(ac, out, {
        freq: base * 2,
        type: "sine",
        dur: durJitter(0.038),
        gain: gainJitter(0.3),
        attack: 0.004,
      });
      break;
    }

    case "flip":
      // crisp tactile latch for disclosures and diagram expansions
      blip(ac, out, {
        freq: pitchJitter(440, 3),
        type: "triangle",
        dur: durJitter(0.075),
        gain: gainJitter(0.5),
        attack: 0.004,
      });
      blip(ac, out, {
        freq: pitchJitter(659.25, 3),
        type: "triangle",
        dur: durJitter(0.085),
        gain: gainJitter(0.45),
        delay: 0.04,
        attack: 0.004,
      });
      break;

    case "theme":
      // radiant celestial shimmer for theme toggle
      blip(ac, out, { freq: 523.25, type: "sine", dur: 0.14, gain: 0.7, attack: 0.005 });
      blip(ac, out, {
        freq: 783.99,
        type: "sine",
        dur: 0.16,
        gain: 0.55,
        delay: 0.045,
        attack: 0.005,
      });
      blip(ac, out, {
        freq: 1046.5,
        type: "sine",
        dur: 0.18,
        gain: 0.35,
        delay: 0.08,
        attack: 0.005,
      });
      break;

    case "toggle-on":
      // ascending melodic fifth
      blip(ac, out, { freq: 587.33, dur: 0.08, gain: 0.75, attack: 0.004 });
      blip(ac, out, { freq: 880, dur: 0.12, gain: 0.75, delay: 0.06, attack: 0.004 });
      break;

    case "toggle-off":
      // descending mirror of toggle-on - the mute confirm
      blip(ac, out, { freq: 880, dur: 0.08, gain: 0.75, attack: 0.004 });
      blip(ac, out, { freq: 587.33, dur: 0.12, gain: 0.75, delay: 0.06, attack: 0.004 });
      break;

    case "action":
      // affirmative harmonic chord for primary CTA buttons / runs
      blip(ac, out, { freq: 523.25, type: "sine", dur: 0.085, gain: 0.65, attack: 0.004 });
      blip(ac, out, {
        freq: 783.99,
        type: "sine",
        dur: 0.11,
        gain: 0.6,
        delay: 0.03,
        attack: 0.004,
      });
      break;

    case "copy":
      // warm harmonic confirmation for clipboard success
      blip(ac, out, {
        freq: 659.25,
        endFreq: 880,
        type: "sine",
        dur: 0.12,
        gain: 0.65,
        attack: 0.004,
      });
      blip(ac, out, {
        freq: 987.77,
        type: "sine",
        dur: 0.13,
        gain: 0.25,
        delay: 0.035,
        attack: 0.004,
      });
      break;

    case "page":
      // soft two-note on view-transition arrival - the browse pulse
      blip(ac, out, { freq: 392, type: "sine", dur: 0.18, gain: 0.35, attack: 0.006 });
      blip(ac, out, {
        freq: 523.25,
        type: "sine",
        dur: 0.22,
        gain: 0.28,
        delay: 0.05,
        attack: 0.006,
      });
      break;

    case "chime":
      // soft, soothing two-note for the welcome toast
      blip(ac, out, { freq: 528, type: "sine", dur: 0.4, gain: 0.4, attack: 0.008 });
      blip(ac, out, {
        freq: 792,
        type: "sine",
        dur: 0.5,
        gain: 0.28,
        delay: 0.09,
        attack: 0.008,
      });
      break;
  }
}

export function classifyElementSound(target: Element): Accent | null {
  const interactive = target.closest<HTMLElement>(
    'button, a[href], summary, select, [role="button"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="menuitem"], [role="option"], input[type="checkbox"], input[type="radio"], input[type="submit"], input[type="button"], [data-sound], .clickable, .tab, .shelf-pill, .lib-tab, .sound-trigger, .cta, .cta-primary, .cta-secondary, .cta-button, .btn-primary, .h-anchor',
  );
  if (!interactive) return null;

  // Disabled controls are completely silent
  if (
    interactive.hasAttribute("disabled") ||
    interactive.getAttribute("aria-disabled") === "true" ||
    ("disabled" in interactive && Boolean((interactive as { disabled?: boolean }).disabled))
  ) {
    return null;
  }

  const explicit = interactive.getAttribute("data-sound");
  if (explicit === "none" || explicit === "false") return null;
  if (explicit && explicit !== "true") {
    return explicit as Accent;
  }

  // Prevent preview buttons in design.astro from auto-playing
  if (interactive.classList.contains("sound-trigger") || interactive.closest("[data-sound-grid]")) {
    return null;
  }

  // Sound toggle handles its own audio via setSoundEnabled
  if (interactive.classList.contains("sound-toggle") || interactive.hasAttribute("data-sound-toggle")) {
    return null;
  }

  // Theme toggle is self-owned in ThemeToggle.astro
  if (interactive.classList.contains("theme-toggle") || interactive.hasAttribute("data-theme-toggle")) {
    return null;
  }

  // Copy buttons are outcome-dependent: self-owned by clipboard success handlers
  if (
    interactive.classList.contains("code-copy") ||
    interactive.classList.contains("quote-copy") ||
    interactive.hasAttribute("data-copy") ||
    interactive.hasAttribute("data-copy-link") ||
    /copy/i.test(interactive.getAttribute("aria-label") ?? "") ||
    /copy/i.test(interactive.getAttribute("title") ?? "")
  ) {
    return null;
  }

  // Command palette triggers and close buttons are self-owned by openPalette / closePalette
  if (
    interactive.classList.contains("palette-close") ||
    interactive.classList.contains("palette-back") ||
    interactive.classList.contains("palette-mobile-close") ||
    interactive.classList.contains("palette-mobile-search-back") ||
    interactive.classList.contains("palette-mobile-search-launch") ||
    interactive.classList.contains("search-trigger") ||
    interactive.hasAttribute("data-search-trigger") ||
    interactive.hasAttribute("data-dismiss")
  ) {
    return null;
  }

  // Go Tour interactive elements are self-owned by go-tour.ts
  if (
    interactive.classList.contains("go-tour-btn") ||
    interactive.classList.contains("go-tour-tab") ||
    interactive.classList.contains("go-spec-pill") ||
    interactive.closest(".go-tour-snippet, .go-spec-pills")
  ) {
    return null;
  }

  // Tabs, pills, filters, segmented controls
  if (
    interactive.getAttribute("role") === "tab" ||
    interactive.classList.contains("lib-tab") ||
    interactive.classList.contains("shelf-pill") ||
    interactive.classList.contains("tab") ||
    interactive.hasAttribute("data-tab") ||
    interactive.hasAttribute("data-filter") ||
    interactive.hasAttribute("data-measure") ||
    interactive.hasAttribute("data-weight") ||
    interactive.hasAttribute("data-nav-index")
  ) {
    // If the tab is already active, ignore (no state change)
    if (
      interactive.getAttribute("aria-selected") === "true" ||
      interactive.getAttribute("aria-pressed") === "true"
    ) {
      return null;
    }
    return "tab";
  }

  // Radio buttons / options / menu items / select dropdowns
  if (
    interactive.getAttribute("role") === "radio" ||
    (interactive.tagName === "INPUT" && interactive.getAttribute("type") === "radio")
  ) {
    const isChecked =
      "checked" in interactive
        ? Boolean((interactive as { checked?: boolean }).checked)
        : interactive.getAttribute("aria-checked") === "true";
    if (isChecked) return null; // already checked, clicking does not change selection
    return "select";
  }

  if (
    interactive.tagName === "SELECT" ||
    interactive.getAttribute("role") === "menuitem" ||
    interactive.getAttribute("role") === "option"
  ) {
    return "select";
  }

  // Checkboxes / switches
  if (
    interactive.getAttribute("role") === "switch" ||
    interactive.getAttribute("role") === "checkbox" ||
    (interactive.tagName === "INPUT" && interactive.getAttribute("type") === "checkbox")
  ) {
    const isChecked =
      "checked" in interactive
        ? Boolean((interactive as { checked?: boolean }).checked)
        : interactive.getAttribute("aria-checked") === "true" ||
          interactive.getAttribute("aria-pressed") === "true";
    return isChecked ? "toggle-on" : "toggle-off";
  }

  // Disclosures, accordions, diagram expand
  if (
    interactive.tagName === "SUMMARY" ||
    interactive.hasAttribute("aria-expanded") ||
    interactive.classList.contains("diagram-expand") ||
    interactive.hasAttribute("data-diagram-expand") ||
    interactive.classList.contains("mono-toggle") ||
    interactive.hasAttribute("data-mono-toggle") ||
    interactive.hasAttribute("data-logo-toggle")
  ) {
    return "flip";
  }

  // Primary CTA / submit / replay
  if (
    interactive.getAttribute("type") === "submit" ||
    interactive.classList.contains("cta-button") ||
    interactive.classList.contains("cta-primary") ||
    interactive.classList.contains("dev-cta-primary") ||
    interactive.classList.contains("btn-primary") ||
    interactive.getAttribute("data-action") === "run" ||
    interactive.hasAttribute("data-replay-route")
  ) {
    return "action";
  }

  // External links
  if (
    interactive.tagName === "A" &&
    (interactive.getAttribute("target") === "_blank" ||
      interactive.getAttribute("rel")?.includes("external") ||
      interactive.classList.contains("ext-link"))
  ) {
    return "tick";
  }

  // Standard buttons, links, clickable items
  return "tap";
}

function handleTapInteraction(event: MouseEvent): void {
  if (!enabled) return;
  if (event.button !== 0 && event.button !== undefined) return;
  if (!(event.target instanceof Element)) return;

  const accent = classifyElementSound(event.target);
  if (!accent) return;

  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (now - lastSoundTime < 120 && event.target === lastSoundTarget) {
    return;
  }

  lastSoundTarget = event.target;
  playAccent(accent);
}

export function initSoundInteractions(): void {
  if (typeof window === "undefined") return;
  const win = window as unknown as { __siteSoundInteractionsReady?: boolean };
  if (win.__siteSoundInteractionsReady) return;
  win.__siteSoundInteractionsReady = true;

  document.addEventListener("click", (e) => {
    handleTapInteraction(e);
  }, { capture: true, passive: true });
}

export function isSoundEnabled(): boolean {
  return enabled;
}

export function setSoundEnabled(next: boolean): void {
  userGestured = true;
  if (next) {
    enabled = true;
    ensureContext();
    playAccent("toggle-on");
  } else {
    playAccent("toggle-off");
    enabled = false;
  }
  try {
    localStorage.setItem(STORAGE_KEY, next ? "on" : "off");
  } catch {
    /* private mode - persistence is a nicety, not a dependency */
  }
  notify();
}

export function onSoundChange(fn: Listener): void {
  listeners.add(fn);
}

function notify(): void {
  for (const fn of listeners) fn(enabled);
}

/** Internal helper for test environments to simulate user gesture activation. */
export function __setUserGesturedForTesting(value: boolean): void {
  userGestured = value;
}

/** Internal helper for test environments to reset audio context and gesture state. */
export function __resetAudioContextForTesting(): void {
  if (ctx) {
    try {
      void ctx.close();
    } catch {
      /* ignore */
    }
  }
  ctx = null;
  master = null;
  userGestured = false;
  lastPlayTime = 0;
  lastPlayAccent = null;
  lastSoundTime = 0;
  lastSoundTarget = null;
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      enabled = e.newValue === "on";
      notify();
    }
  });

  const markGesture = () => {
    if (userGestured) return;
    userGestured = true;
    if (ctx && ctx.state === "suspended") void ctx.resume();
  };
  window.addEventListener("pointerdown", markGesture, { capture: true, once: true });
  window.addEventListener("keydown", markGesture, { capture: true, once: true });
  window.addEventListener("click", markGesture, { capture: true, once: true });

  initSoundInteractions();
}
