---
version: alpha
name: Design notes for ashwingopalsamy.in
description: The implementation reference for the site's visual and interaction system.
namingNote: I call these greys Valyrian Steel. I like Game of Thrones, and the name stuck.
colors:
  neutral-01: "oklch(1 0 0)"
  neutral-02: "oklch(0.94 0.002 240)"
  neutral-03: "oklch(0.9 0.003 240)"
  neutral-04: "oklch(0.85 0.004 240)"
  neutral-05: "oklch(0.75 0.005 240)"
  neutral-06: "oklch(0.54 0.006 240)"
  neutral-07: "oklch(0.4 0.005 240)"
  neutral-08: "oklch(0.3 0.004 240)"
  neutral-09: "oklch(0.2 0.003 240)"
  accent-light: "oklch(0.58 0.2 25)"
  accent-dark: "oklch(0.68 0.19 25)"
  warning-light: "oklch(0.76 0.16 65)"
  warning-dark: "oklch(0.78 0.15 65)"
  information-light: "oklch(0.58 0.19 255)"
  information-dark: "oklch(0.66 0.18 255)"
  important-light: "oklch(0.55 0.24 290)"
  important-dark: "oklch(0.64 0.22 290)"
  caution-light: "oklch(0.62 0.22 25)"
  caution-dark: "oklch(0.66 0.2 25)"
  success-light: "oklch(0.68 0.16 155)"
  success-dark: "oklch(0.72 0.15 155)"
typography:
  inter-400:
    fontFamily: Inter Variable, Inter Fallback, system-ui, sans-serif
    fontWeight: 400
    lineHeight: 1.68
    letterSpacing: 0em
    fontFeature: '"cv05", "cv08", "calt", "liga"'
  inter-450:
    fontFamily: Inter Variable, Inter Fallback, system-ui, sans-serif
    fontWeight: 450
    lineHeight: 1
  inter-500:
    fontFamily: Inter Variable, Inter Fallback, system-ui, sans-serif
    fontWeight: 500
    lineHeight: 1.4
  inter-550:
    fontFamily: Inter Variable, Inter Fallback, system-ui, sans-serif
    fontWeight: 550
    lineHeight: 1.3
    letterSpacing: -0.012em
  inter-600:
    fontFamily: Inter Variable, Inter Fallback, system-ui, sans-serif
    fontWeight: 600
    lineHeight: 1.3
  newsreader-italic:
    fontFamily: Newsreader Variable, Iowan Old Style, Georgia, serif
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: -0.005em
  jetbrains-mono-400:
    fontFamily: JetBrains Mono, JetBrains Mono Fallback, ui-monospace, monospace
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0.01em
rounded:
  radius-2: 2px
  radius-4: 4px
  radius-8: 8px
  radius-12: 12px
  radius-16: 16px
  radius-20: 20px
  pill: 999px
  nestingRule: "inner = max(radius-2, outer - padding)"
spacing:
  step: 4px
  space-4: 4px
  space-8: 8px
  space-12: 12px
  space-16: 16px
  space-24: 24px
  space-32: 32px
  space-48: 48px
  space-64: 64px
  space-96: 96px
  rhythm: "1rem * 1.68 — one body line box; editorial gaps are multiples of it"
motion:
  ease-enter: cubic-bezier(0.16, 1, 0.3, 1)
  ease-exit: cubic-bezier(0.55, 0, 1, 0.45)
  ease-travel: cubic-bezier(0.65, 0, 0.35, 1)
  ease-snap: cubic-bezier(0.2, 0, 0, 1)
  ease-spring-snap: "linear() sampled from stiffness 900 / damping 46 — ~247ms, 2.3% overshoot"
  ease-spring-soft: "linear() sampled from stiffness 700 / damping 46 — ~189ms, critically damped"
  ease-spring-pop: "linear() sampled from stiffness 900 / damping 34 — ~313ms, 11.5% overshoot"
  dur-press: 70ms
  dur-tint: 110ms
  dur-nudge: 150ms
  dur-shift: 200ms
  dur-enter: 240ms
  dur-exit: 120ms
  dur-overlay: 280ms
  dur-route-out: 90ms
  dur-route-in: 200ms
components:
  desktop-navigation:
    backgroundColor: "{colors.neutral-01}"
    textColor: "{colors.neutral-09}"
    typography: "{typography.inter-400}"
    rounded: "{rounded.pill}"
    padding: 4px
    height: 46px
  desktop-navigation-active:
    backgroundColor: "{colors.neutral-09}"
    textColor: "{colors.neutral-01}"
    typography: "{typography.inter-450}"
    rounded: "{rounded.pill}"
    padding: 8px
  mobile-navigation:
    backgroundColor: "{colors.neutral-01}"
    textColor: "{colors.neutral-09}"
    typography: "{typography.inter-400}"
    rounded: "{rounded.pill}"
    padding: 4px
    height: 52px
    width: 100%
  toast:
    backgroundColor: "{colors.neutral-09}"
    textColor: "{colors.neutral-01}"
    typography: "{typography.inter-400}"
    rounded: "{rounded.radius-10}"
    padding: 12px
  progress-bar:
    backgroundColor: "{colors.neutral-09}"
    textColor: "#ffffff"
    rounded: "{rounded.radius-2}"
    height: 2px
    width: 100px
  utility-input:
    backgroundColor: "{colors.neutral-01}"
    textColor: "{colors.neutral-09}"
    typography: "{typography.jetbrains-mono-400}"
    rounded: "{rounded.radius-4}"
    padding: 12px
---

# Design notes for ashwingopalsamy.in

## Overview

Use this file when changing the site. It records the values and behavior shared across routes, then leaves room for pages to carry their own voice.

The visual structure stays deliberately narrow: one centered rail, a nine-step neutral ramp, fine rules, and typography that gives the writing room. Behavior matters as much as appearance. A link must say where it goes, a press must answer, and a route change must not expose a blank canvas.

## Colors

`neutral-01` through `neutral-09` form a cold OKLCH ramp at hue 240. Light mode uses the first value as canvas and the ninth as ink. Dark mode reverses those roles while retaining the same hierarchy.

The five semantic colors are Green (available, success), Amber (warning, winding down), Blue (information, links), Violet (important, highlight), and Red (caution, error, asleep). Color is always paired with copy, position, shape, or an icon.

Light and dark themes receive equal attention. A mechanical inversion is not enough if secondary text, chrome, shadows, or focus become weaker.

## Typography

Inter carries navigation and prose. Newsreader Italic is used sparingly for literary interruptions. JetBrains Mono is limited to code, tokens, times, hashes, and measurements.

Body copy uses a readable 65 to 75 character measure. Headings are balanced, tracking never goes below `-0.04em`, and long editorial paragraphs may use deliberate justification. The one-pixel mono offset is an optical correction, not layout spacing.

## The invisible grid

Nothing in the interface is positioned by eye. Four systems decide every measurement, and they live in `src/styles/geometry.css`.

A **4px step** is the spacing lattice. Every gap, padding value and control dimension is an integer multiple of it. A number that is not on the lattice is a bug, not a preference.

A **rhythm** of one body line box (`1rem × 1.68`) governs vertical space between blocks of text. Editorial spacing is expressed in multiples of that line box rather than in pixels, so the ruling holds as fluid type resizes instead of drifting out of phase at the clamp boundaries.

**Radius nests.** An inner corner is the outer corner less the padding between the two edges, clamped so it can never invert. Concentric rounded boxes only look concentric if this rule is followed; set `--r-outer` and `--r-gap` on a container and read `--r-inner` on the child.

**Hairlines are real hairlines.** On displays that can draw one, a rule is 0.5px rather than a two-device-pixel slab. The site's fine-line character depends on this.

A **twelve column rail** measured across the content box, not the rail box. Widths that need to agree across pages resolve through `--rail-col` rather than through per-page percentages.

Hold `G` on any page to see all of it. `?grid` pins the overlay on. If a rule, card edge or heading does not land on a line, the layout is wrong.

Optical corrections are named (`--mono-optical-shift`, `--optical-icon-inset`, `--optical-pill-lift`) so they read as deliberate compensation for how a glyph or icon sits, rather than as magic numbers someone nudged until it looked level.

## Layout

Header, main content, and footer share the same centered rail. Space above a section heading is larger than the space below it. The Library groups its newest entries into four shelves and keeps author, platform, source, date, and tags in one readable supporting line.

Mobile has its own physical constraints. Home, Work, AI, More, and Links stay in five fixed tracks above the safe area, while desktop keeps the quieter Home, Work, and More set. Content reserves space beneath the mobile bar, and horizontal tab lists contain their own overscroll.

## Elevation & Depth

Depth is used to separate persistent chrome, overlays, and feedback. A surface gets either a border or a shadow strong enough to explain its elevation. Blur is reserved for stationary desktop chrome and overlays; the mobile navigation uses an opaque surface so scrolling remains cheap.

`backdrop-filter` is only correct where something non-uniform actually sits behind the element: the fixed header, the command palette, the location pill over its map, and floating tooltips. In the reading column the page is a flat canvas, so a backdrop blur there composites to identical pixels while costing a full-surface blur on every scroll frame. In-flow surfaces use `--surface-inline-bg`, the same colour pre-composited against the canvas.

## Motion

Movement is a system, not a set of durations. Four rules decide everything in `src/styles/motion.css`.

**Only transform, opacity and colour animate on live DOM.** Blur is still used wherever it was used before — route handoffs, the palette, the logo swap, toasts, row choreography — but it now runs against layers whose radius is fixed or against view-transition snapshots. A blur whose radius changes on live content re-rasterises the subtree every frame; a blur whose radius is constant is rasterised once and then alpha-composited.

**Arrival and departure are different gestures.** Things leave faster than they arrive (`--dur-exit` is always shorter than the matching `--dur-enter`) and on a different curve. Uniform durations are the single biggest reason an interface reads as cheap.

**Duration scales with how much changes.** A colour swap is 110ms, a 3px nudge is 150ms, a panel is 280ms. Nothing takes 250ms because 250ms is the token.

**Springs are real springs.** `--ease-spring-*` are damped harmonic oscillators sampled into `linear()`, with their physics recorded in the comment so they can be regenerated rather than guessed at. The header's nav pill and the Library's tab indicator share one, deliberately: they are the same control wearing two hats.

Route handoffs use the View Transitions API. The outgoing document blurs and fades over 90ms while the incoming one resolves from blur over 200ms, overlapping. Back navigation reverses the axis.

The blur belongs to the page, never to the furniture. Every frosted chrome surface is lifted out of the root snapshot by name (`chrome-logo`, `chrome-nav`, `chrome-action`, `chrome-bottom`) and given no animation at all, so the header, its pills and the selection indicator are pixel-stable across a navigation while the content behind them resolves. Those names must sit on the frosted element itself and never on a wrapper: `view-transition-name` makes an element a backdrop root, which severs its descendants from the page behind them and renders any pill inside as flat transparency.

Scroll-linked work is either driven by CSS scroll-driven animations, or by the single shared scheduler in `src/scripts/scroll-scheduler.ts`. No module binds its own scroll listener, and no subscriber reads layout inside one.

## Shapes

Small controls use the shared radius scale. Pills belong to compact navigation and segmented controls. Content containers use 10 to 16 pixel radii. List markers are 4 pixel diamonds; nested lists use a hollow diamond. Ordered lists use aligned tabular counters.

## Components

The shared icon registry is the only source for interface symbols. Internal navigation uses `ArrowRight` or `ChevronRight`. Back and previous actions use matching left arrows. External destinations alone use `ArrowUpRight`. Disclosures use `ChevronDown`.

Navigation and segmented controls use a single transform-only selection indicator. It does not deform, bounce or trail: the indicator is furniture, and furniture that performs is noise. Labels and icon slots have fixed geometry, including the five permanent mobile destinations. Timings come from the motion scale above; press feedback is 70ms, local movement 150 to 200ms, overlays 280ms. Decorative loops are not part of the system.

Every control needs a default, hover, active, focus, disabled, loading, empty, and failure state when those states apply. Hover movement is gated behind a fine pointer. Touch targets are at least 44 pixels.

## Do's and Don'ts

- Do render complete HTML before enhancement.
- Do make internal, external, backward, and disclosure actions visually distinct.
- Do animate transform and opacity when an element moves.
- Do put every measurement on the step, the rhythm, or the rail. Check with `G`.
- Do keep a blur radius constant and move opacity instead when a blur needs to change.
- Do route scroll work through the shared scheduler, and read no layout inside it.
- Do not animate width, height, or `font-variation-settings` on a hover state.
- Do not add `backdrop-filter` to anything in the reading column.
- Do preserve focus, selection, scroll position, and reduced-motion behavior.
- Do keep the command palette local-first and keyboard-first.
- Do not replay page entrances after client navigation.
- Do not rotate directional icons into a new meaning.
- Do not use text arrows, Unicode interface symbols, or hyphens as bullets.
- Do not hide persistent mobile navigation while the page scrolls.
- Do not add tracking, a backend, or an animation dependency for polish.

## Experience and Machine Contract

The public site is static Astro with progressive enhancement. Theme, sound, maps, embeds, Mermaid, clipboard access, and local storage must all fail without taking the content with them. Reduced motion removes nonessential travel and shows the final state immediately while retaining useful color, focus, and status feedback.

Machine-readable material is documented separately in [`docs/agent-readiness.md`](docs/agent-readiness.md). This file stays focused on the interface contract.
