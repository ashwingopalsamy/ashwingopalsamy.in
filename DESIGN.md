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
  radius-7: 7px
  radius-10: 10px
  radius-16: 16px
  pill: 999px
spacing:
  space-4: 4px
  space-8: 8px
  space-12: 12px
  space-16: 16px
  space-24: 24px
  space-32: 32px
  space-48: 48px
  space-64: 64px
  space-96: 96px
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
    backgroundColor: "{colors.accent-light}"
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

The visual structure stays deliberately narrow: one centered rail, a nine-step neutral ramp, one scarce interaction accent, fine rules, and typography that gives the writing room. Behavior matters as much as appearance. A link must say where it goes, a press must answer, and a route change must not expose a blank canvas.

## Colors

`neutral-01` through `neutral-09` form a cold OKLCH ramp at hue 240. Light mode uses the first value as canvas and the ninth as ink. Dark mode reverses those roles while retaining the same hierarchy.

The accent is reserved for reading progress, selection, focus, presence, and meaningful state. Amber, blue, violet, red, and green are semantic colors. Color is always paired with copy, position, shape, or an icon.

Light and dark themes receive equal attention. A mechanical inversion is not enough if secondary text, chrome, shadows, or focus become weaker.

## Typography

Inter carries navigation and prose. Newsreader Italic is used sparingly for literary interruptions. JetBrains Mono is limited to code, tokens, times, hashes, and measurements.

Body copy uses a readable 65 to 75 character measure. Headings are balanced, tracking never goes below `-0.04em`, and long editorial paragraphs may use deliberate justification. The one-pixel mono offset is an optical correction, not layout spacing.

## Layout

Header, main content, and footer share the same centered rail. Space above a section heading is larger than the space below it. The Library groups its newest entries into four shelves and keeps author, platform, source, date, and tags in one readable supporting line.

Mobile has its own physical constraints. Home, Work, AI, More, and Links stay in five fixed tracks above the safe area, while desktop keeps the quieter Home, Work, and More set. Content reserves space beneath the mobile bar, and horizontal tab lists contain their own overscroll.

## Elevation & Depth

Depth is used to separate persistent chrome, overlays, and feedback. A surface gets either a border or a shadow strong enough to explain its elevation. Blur is reserved for stationary desktop chrome and overlays; the mobile navigation uses an opaque surface so scrolling remains cheap.

## Shapes

Small controls use the shared radius scale. Pills belong to compact navigation and segmented controls. Content containers use 10 to 16 pixel radii. List markers are 4 pixel diamonds; nested lists use a hollow diamond. Ordered lists use aligned tabular counters.

## Components

The shared icon registry is the only source for interface symbols. Internal navigation uses `ArrowRight` or `ChevronRight`. Back and previous actions use matching left arrows. External destinations alone use `ArrowUpRight`. Disclosures use `ChevronDown`.

Navigation and segmented controls use a single transform-only selection indicator. Labels and icon slots have fixed geometry, including the five permanent mobile destinations. Frequent actions use 90 millisecond press feedback and 150 to 200 millisecond local movement. Route handoffs use a 100 millisecond outgoing layer and a 160 millisecond incoming layer. Overlays may use 300 to 420 milliseconds. Decorative loops are not part of the system.

Every control needs a default, hover, active, focus, disabled, loading, empty, and failure state when those states apply. Hover movement is gated behind a fine pointer. Touch targets are at least 44 pixels.

## Do's and Don'ts

- Do render complete HTML before enhancement.
- Do make internal, external, backward, and disclosure actions visually distinct.
- Do animate transform and opacity when an element moves.
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
