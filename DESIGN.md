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
  # controls: CSS names at their light values; global.css restates each for dark and the no-JS mirror
  glass-fill: "color-mix(in oklch, var(--ink) 2.5%, var(--canvas))"
  glass-fill-hover: "color-mix(in oklch, var(--ink) 4%, var(--canvas))"
  glass-fill-press: "color-mix(in oklch, var(--ink) 7%, var(--canvas))"
  ink-fill: "linear-gradient(180deg, oklch(0.33 0.004 240), oklch(0.2 0.003 240))"
  ink-fill-press: "linear-gradient(180deg, oklch(0.27 0.004 240), oklch(0.16 0.003 240))"
  wash: "color-mix(in oklch, var(--ink) 4.5%, transparent)"
  wash-press: "color-mix(in oklch, var(--ink) 8%, transparent)"
  edge-soft: "color-mix(in oklch, var(--ink) 8%, transparent)"
  edge: "color-mix(in oklch, var(--ink) 11%, transparent)"
  edge-strong: "color-mix(in oklch, var(--ink) 20%, transparent)"
  spot: "color-mix(in oklch, var(--color-1) 95%, transparent)"
  ok-ink: "oklch(0.47 0.12 155)"
  ok-wash: "color-mix(in oklch, var(--acc-green) 13%, transparent)"
  ok-edge: "color-mix(in oklch, var(--acc-green) 42%, transparent)"
  err-ink: "oklch(0.5 0.18 25)"
  err-wash: "color-mix(in oklch, var(--acc-red) 11%, transparent)"
  err-edge: "color-mix(in oklch, var(--acc-red) 38%, transparent)"
  toast-bg: "color-mix(in oklch, var(--color-9) 90%, transparent)"
  toast-ink: "oklch(1 0 0)"
  link-wash: "color-mix(in oklch, var(--ink) 9%, transparent)"
  link-wash-press: "color-mix(in oklch, var(--ink) 14%, transparent)"
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
typeScale:
  text-2xs: 0.625rem
  text-ui: 0.9375rem
  text-ui-sm: 0.8125rem
  text-xs: "clamp(0.68rem, 0.66rem + 0.1vw, 0.75rem)"
  text-sm: "clamp(0.8rem, 0.78rem + 0.12vw, 0.875rem)"
  text-base: "clamp(1rem, 0.97rem + 0.18vw, 1.0625rem)"
  text-md: "clamp(1.05rem, 1.02rem + 0.2vw, 1.15rem)"
  text-lg: "clamp(1.12rem, 1.05rem + 0.35vw, 1.28rem)"
  text-xl: "clamp(1.25rem, 1.15rem + 0.5vw, 1.4rem)"
  text-display: "clamp(1.7rem, 1.45rem + 1.2vw, 1.95rem)"
rounded:
  r-1: 2px
  r-2: 4px
  r-3: 8px
  r-4: 12px
  r-5: 16px
  r-6: 20px
  r-pill: 999px
  r-diamond: 0.75px
  tile-r: 16px
  code-r: 20px
  nestingRule: "--r-inner = max(--r-1, --r-outer - --r-gap)"
spacing:
  step: 4px
  step-1: 4px
  step-2: 8px
  step-3: 12px
  step-4: 16px
  step-5: 24px
  step-6: 32px
  step-7: 48px
  step-8: 64px
  step-9: 96px
  cap-48: 48px
  cap-40: 40px
  cap-32: 32px
  cap-28: 28px
  cap-20: 20px
  cap-px-48: 20px
  cap-px-40: 16px
  cap-px-32: 12px
  cap-px-28: 12px
  cap-px-20: 8px
  cap-icon-trim: 4px
  cap-gap-lg: 8px
  cap-gap-sm: 4px
  hit: 44px
  track-inset: 4px
  row-min: 48px
  row-pad: 12px
  row-bleed: 12px
  rhythm: "1rem * 1.68 — one body line box; editorial gaps are multiples of it"
breakpoints:
  compact: "max-width: 38rem — phone layout, five-track bottom navigation"
  regular: "min-width: 42.5rem"
  toc: "min-width: 72rem — floating table of contents"
zIndex:
  z-base: 0
  z-veil: 5
  z-raised: 10
  z-sticky: 20
  z-progress: 30
  z-toast: 40
  z-overlay: 60
  z-frame: 70
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
  dur-route-delay: 40ms
  ease-overshoot: "cubic-bezier(0, 0, 0, 1.25)"
  ease-morph: "cubic-bezier(0, 0, 0.5, 1)"
  ease-pulse: "cubic-bezier(0.4, 0, 0.6, 1)"
  ease-sway: "cubic-bezier(0.42, 0, 0.58, 1)"
  dur-hero: 620ms
  dur-spin: 800ms
  dur-pulse: 3.6s
  press-scale: 0.96
  press-scale-inline: 0.99
  dur-spring-snap: 247ms
  dur-spring-soft: 189ms
  dur-spring-pop: 313ms
  dur-afterglow: 220ms
  dur-dwell: 400ms
  dur-hold: 1.6s
  dur-toast: 4s
  magnet-max: 3px
  magnet-label: 1.5px
  spot-size: 200px
components:
  desktop-navigation:
    backgroundColor: "{colors.neutral-01}"
    textColor: "{colors.neutral-09}"
    typography: "{typography.inter-400}"
    rounded: "{rounded.r-pill}"
    padding: 4px
    height: 46px
  desktop-navigation-active:
    backgroundColor: "{colors.neutral-09}"
    textColor: "{colors.neutral-01}"
    typography: "{typography.inter-450}"
    rounded: "{rounded.r-pill}"
    padding: 8px
  mobile-navigation:
    backgroundColor: "{colors.neutral-01}"
    textColor: "{colors.neutral-09}"
    typography: "{typography.inter-400}"
    rounded: "{rounded.r-pill}"
    padding: 4px
    height: 52px
    width: 100%
  toast:
    backgroundColor: "{colors.neutral-09}"
    textColor: "{colors.neutral-01}"
    typography: "{typography.inter-500}"
    rounded: "{rounded.r-pill}"
    padding: 8px
    height: 48px
  capsule-ink:
    backgroundColor: "{colors.neutral-09}"
    textColor: "{colors.neutral-01}"
    typography: "{typography.inter-500}"
    rounded: "{rounded.r-pill}"
    padding: 20px
    height: 48px
  capsule-glass:
    backgroundColor: "{colors.neutral-01}"
    textColor: "{colors.neutral-09}"
    typography: "{typography.inter-500}"
    rounded: "{rounded.r-pill}"
    padding: 20px
    height: 48px
  capsule-quiet:
    textColor: "{colors.neutral-06}"
    typography: "{typography.inter-500}"
    rounded: "{rounded.r-pill}"
    padding: 16px
    height: 40px
  capsule-action:
    backgroundColor: "{colors.neutral-01}"
    textColor: "{colors.neutral-09}"
    typography: "{typography.inter-500}"
    rounded: "{rounded.r-pill}"
    padding: 12px
    height: 32px
  chip:
    backgroundColor: "{colors.neutral-02}"
    textColor: "{colors.neutral-08}"
    typography: "{typography.inter-450}"
    rounded: "{rounded.r-pill}"
    padding: 12px
    height: 28px
  chip-selected:
    backgroundColor: "{colors.neutral-09}"
    textColor: "{colors.neutral-01}"
    typography: "{typography.inter-450}"
    rounded: "{rounded.r-pill}"
    padding: 12px
    height: 28px
  badge:
    backgroundColor: "{colors.neutral-02}"
    textColor: "{colors.neutral-08}"
    typography: "{typography.inter-500}"
    rounded: "{rounded.r-pill}"
    padding: 8px
    height: 20px
  row:
    textColor: "{colors.neutral-09}"
    typography: "{typography.inter-500}"
    rounded: "{rounded.r-4}"
    padding: 12px
    height: 48px
  segmented:
    backgroundColor: "{colors.neutral-01}"
    textColor: "{colors.neutral-08}"
    typography: "{typography.inter-500}"
    rounded: "{rounded.r-pill}"
    padding: 4px
    height: 48px
  segmented-active:
    backgroundColor: "{colors.neutral-09}"
    textColor: "{colors.neutral-01}"
    typography: "{typography.inter-500}"
    rounded: "{rounded.r-pill}"
    padding: 16px
    height: 40px
  tooltip:
    backgroundColor: "{colors.neutral-01}"
    textColor: "{colors.neutral-09}"
    typography: "{typography.inter-500}"
    rounded: "{rounded.r-pill}"
    padding: 12px
    height: 28px
  progress-bar:
    backgroundColor: "{colors.neutral-09}"
    textColor: "#ffffff"
    rounded: "{rounded.r-1}"
    height: 2px
    width: 100px
  utility-input:
    backgroundColor: "{colors.neutral-01}"
    textColor: "{colors.neutral-09}"
    typography: "{typography.jetbrains-mono-400}"
    rounded: "{rounded.r-2}"
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

Controls draw on a derived layer in `global.css`: `--glass-*` for in-flow glass, `--ink-fill` for the one primary per view, `--wash` and `--wash-press` behind hovered and pressed rows, `--edge-soft`, `--edge` and `--edge-strong` for borders, `--ok-*` and `--err-*` for outcomes, and an inverted `--toast-*` pair. Each is written in all three theme blocks (light, dark, and the no-JS dark mirror); nothing else mixes a raw ink tint. State is never colour alone: a labelled copy capsule says Copy, Copied or Retry in words and never pairs a word with a symbol (an icon-only circle swaps its glyph for a check), soon shows a dot and a word, and selection moves the ink.

## Typography

Inter carries navigation and prose on desktop; compact viewports (38rem and below) set the same roles in Geist, each preloading only its own face. Newsreader Italic is used sparingly for literary interruptions. JetBrains Mono is limited to code, tokens, times, hashes, and measurements.

Body copy uses a readable 65 to 75 character measure. Headings are balanced, tracking never goes below `-0.04em`, and long editorial paragraphs may use deliberate justification. The one-pixel mono offset is an optical correction, not layout spacing.

Capsule labels are 15px (`--text-ui`) at 500 on 48 and 40, and 13px (`--text-ui-sm`) on 32 and 28. Weight is static: a link is ink at `--link-weight` (560 in light, where body grey sits close to ink; 500 in dark) at rest and on hover alike, so nothing reflows.

## The invisible grid

Nothing in the interface is positioned by eye. Four systems decide every measurement, and they live in `src/styles/geometry.css`.

A **4px step** is the spacing lattice. Every gap, padding value and control dimension is an integer multiple of it. A number that is not on the lattice is a bug, not a preference.

A **rhythm** of one body line box (`1rem × 1.68`) governs vertical space between blocks of text. Editorial spacing is expressed in multiples of that line box rather than in pixels, so the ruling holds as fluid type resizes instead of drifting out of phase at the clamp boundaries.

**Radius nests.** An inner corner is the outer corner less the padding between the two edges, clamped so it can never invert. Concentric rounded boxes only look concentric if this rule is followed; set `--r-outer` and `--r-gap` on a container and read `--r-inner` on the child.

**Hairlines are real hairlines.** On displays that can draw one, a rule is 0.5px rather than a two-device-pixel slab. The site's fine-line character depends on this.

A **twelve column rail** measured across the content box, not the rail box. Widths that need to agree across pages resolve through `--rail-col` rather than through per-page percentages.

Hold `G` on any page to see all of it. `?grid` pins the overlay on. If a rule, card edge or heading does not land on a line, the layout is wrong.

`npm run tokens` reports every raw value that bypasses these systems (spacing off the lattice, raw durations, easings, radii, colours, font sizes, z-indices, unlisted breakpoints) and any drift between this file's frontmatter and the CSS. Radius, spacing, z-index and motion keys in the frontmatter are the CSS custom property names; colours keep their semantic names (`neutral-01` is `--color-1`, `success-light` is `--acc-green`), except the control colours, which are CSS names recorded at their light values.

Optical corrections are named (`--mono-optical-shift`, `--optical-icon-inset`, `--optical-pill-lift`) so they read as deliberate compensation for how a glyph or icon sits, rather than as magic numbers someone nudged until it looked level.

## Layout

Header, main content, and footer share the same centered rail. Space above a section heading is larger than the space below it. The Library groups its newest entries into four shelves and keeps author, platform, source, date, and tags in one readable supporting line.

Mobile has its own physical constraints. Home, Work, AI, More, and Links stay in five fixed tracks above the safe area, while desktop keeps the quieter Home, Work, and More set. Content reserves space beneath the mobile bar, and horizontal tab lists contain their own overscroll.

## Elevation & Depth

The whole page sits on an inset card above a slightly darker base (the viewport frame): a 6px margin (4px on phones) and a 6px radius, a hairline edge, and a soft lift shadow (`--frame-*` tokens). It is one fixed, static layer held still through route transitions. The root scrollbar is drawn inside the card as a thin scroll-driven thumb, so the native bar never cuts through the frame's right edge; it is draggable with a mouse and a passive indicator on touch.

Depth is used to separate persistent chrome, overlays, and feedback. A surface gets either a border or a shadow strong enough to explain its elevation.

Glass is a recipe; blur is a privilege. In-flow glass (capsules, segmented tracks, docks, tiles, pager cards) is layers only: a sheen, an opaque `--glass-fill`, a gradient rim, a specular top edge and a `--lift-*` shadow. It paints once and composites. The rim is a `border-box` layer under a `padding-box` fill, so it only works when the fill is opaque; a translucent fill (wash, chips, ok, err, disabled) takes a solid `border-color` instead, or the rim bleeds through the whole surface.

`backdrop-filter` is only correct where something non-uniform actually sits behind the element:

| Surface | Backdrop | Why it is cheap |
|---|---|---|
| Header chips and nav, mobile bottom navigation | `blur(20px) saturate(170%)` | fixed and short |
| Veil under the header | `blur(10px)`, masked | one fixed band at a constant radius, hidden at the top of the page |
| Library tabs, only while stuck | `blur(20px) saturate(170%)` | a 48px strip, off when not stuck |
| Tooltip, toast | `blur(16px) saturate(180%)` | small and transient |
| Command palette, location pill over its map | unchanged | an overlay; a map |
| In-flow glass | none | the canvas behind is flat |

Never put a backdrop on anything that scrolls with the page, and never animate its radius: over the flat reading column a backdrop composites to identical pixels while costing a blur on every scroll frame. Chrome glass with positioned children is its own stacking context (`isolation: isolate`).

## Motion

Movement is a system, not a set of durations. Four rules decide everything in `src/styles/motion.css`.

**Only transform, opacity and colour animate on live DOM.** Blur is still used wherever it was used before — route handoffs, the palette, the logo swap, toasts, row choreography — but it now runs against layers whose radius is fixed or against view-transition snapshots. A blur whose radius changes on live content re-rasterises the subtree every frame; a blur whose radius is constant is rasterised once and then alpha-composited. The one exception is the micro-blur budget: an element no larger than 64 × 64 CSS pixels (a copy label, the logo swap) may animate its filter radius, because re-rasterising that much is negligible.

**Arrival and departure are different gestures.** Things leave faster than they arrive (`--dur-exit` is always shorter than the matching `--dur-enter`) and on a different curve. Uniform durations are the single biggest reason an interface reads as cheap.

**Duration scales with how much changes.** A colour swap is 110ms, a 3px nudge is 150ms, a panel is 280ms. Nothing takes 250ms because 250ms is the token.

**Springs are real springs.** `--ease-spring-*` are damped harmonic oscillators sampled into `linear()`, with their physics recorded in the comment so they can be regenerated rather than guessed at. The header's nav pill and the Library's tab indicator share one, deliberately: they are the same control wearing two hats. Every press springs: down in 70ms on `--ease-snap` to `--press-scale` (0.96, controls 48px and under) or `--press-scale-inline` (0.99, rows, tiles, pager cards), then back up on `--ease-spring-pop` for small controls and `--ease-spring-soft` for wide ones, each over its own settle time (`--dur-spring-*`). A `linear()` spring played over another duration is a different spring.

Route handoffs use the View Transitions API. The outgoing document blurs and fades over 90ms while the incoming one resolves from blur over 200ms, overlapping. Back navigation reverses the axis.

The blur belongs to the page, never to the furniture. Every frosted chrome surface is lifted out of the root snapshot by name (`chrome-logo`, `chrome-nav`, `chrome-action`, `chrome-bottom`) and given no animation at all, so the header, its pills and the selection indicator are pixel-stable across a navigation while the content behind them resolves. Those names must sit on the frosted element itself and never on a wrapper: `view-transition-name` makes an element a backdrop root, which severs its descendants from the page behind them and renders any pill inside as flat transparency.

Scroll-linked work is either driven by CSS scroll-driven animations, or by the single shared scheduler in `src/scripts/scroll-scheduler.ts`. No module binds its own scroll listener, and no subscriber reads layout inside one.

## Shapes

Pill or nothing: every single-line control is a capsule (see Components). Multi-line surfaces are rounded rectangles that obey radius nesting: tiles and pager cards at `--tile-r` (16), the code card at `--code-r` (20), other content containers at `--r-4` to `--r-5`. A keycap is a key, not a button, so it takes `--r-2`. List markers are 4 pixel diamonds; nested lists use a hollow diamond. Ordered lists use aligned tabular counters.

## Components

Every single-line control is a capsule at one of five heights: 48 (page CTAs, header chips, the nav track), 40 (segments, footer links, the clock, dock circles), 32 (inline actions such as Copy, All N and the labelled back), 28 (tag chips) and 20 (badges, which are never pressable). Tiers are ink (one primary per view), glass, quiet and chip. Width follows the content and never animates: Copy, Copied and Retry share one grid cell, so the capsule is as wide as the longest word.

The shared icon registry is the only source for interface symbols, and each meaning has one glyph, always rendered: `arrow-right` for internal destinations, `arrow-up-right` for external ones (or a file) and nothing else, `arrow-left` for back and previous, `chevron-down` for disclosure. Chevrons left and right are for carousels only. On hover the glyph leaves along its own vector and a twin arrives behind it; dense lists nudge it 3px instead.

No underlines anywhere: not at rest, not on hover, not on focus. A link is ink and weight; on hover a `--link-wash` sits behind the words and follows them across line wraps.

Navigation and segmented controls use a single transform-only selection indicator in ink, and the labels invert exactly where the ink passes under them: an `aria-hidden` copy of the label row in canvas colour is clipped to the indicator, and the clip rides the indicator's spring. Unselected labels never change colour; only the clip moves. Labels and icon slots have fixed geometry, including the five permanent mobile destinations. Timings come from the motion scale above; press feedback is 70ms, local movement 150 to 200ms, overlays 280ms. Decorative loops are not part of the system.

Every control needs a default, hover, active, focus, disabled, loading, empty, and failure state when those states apply. Hover movement is gated behind a fine pointer. Touch targets are at least 44 pixels; a capsule of 40 or under reaches `--hit` with a transparent `::before`.

## Do's and Don'ts

- Do render complete HTML before enhancement.
- Do make internal, external, backward, and disclosure actions visually distinct.
- Do animate transform and opacity when an element moves.
- Do put every measurement on the step, the rhythm, or the rail. Check with `G`.
- Do keep a blur radius constant and move opacity instead when a blur needs to change, unless the element fits the 64 × 64 micro-blur budget.
- Do route scroll work through the shared scheduler, and read no layout inside it.
- Do not animate width or height on a hover state.
- Do not put `backdrop-filter` on anything that scrolls with the page.
- Do not paint the gradient rim under a translucent fill.
- Do preserve focus, selection, scroll position, and reduced-motion behavior.
- Do keep the command palette local-first and keyboard-first.
- Do not replay page entrances after client navigation.
- Do not rotate directional icons into a new meaning.
- Do not underline anything.
- Do not use text arrows or Unicode interface symbols in place of registry glyphs, or hyphens as bullets.
- Do not hide persistent mobile navigation while the page scrolls.
- Do not add tracking, a backend, or an animation dependency for polish.

## Experience and Machine Contract

The public site is static Astro with progressive enhancement. Theme, sound, maps, embeds, Mermaid, clipboard access, and local storage must all fail without taking the content with them. Reduced motion removes nonessential travel and shows the final state immediately while retaining useful color, focus, and status feedback.

Machine-readable material is documented separately in [`/agent-readiness.md`](https://ashwingopalsamy.in/agent-readiness.md). This file stays focused on the interface contract.
