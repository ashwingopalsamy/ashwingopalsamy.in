---
title: "Claude Code Theme"
slug: "claude-code-theme"
date: 2026-02-10
description: "VS Code theme system with 12 variants, programmatic compilation pipeline, and WCAG-validated contrast ratios. Published on the Marketplace."
tech: ["TypeScript"]
status: "Active"
github: "https://github.com/ashwingopalsamy/claude-code-theme"
---

A VS Code theme system built around warm Claude-inspired palettes. 12 variants covering dark, light, brand, high-contrast, and no-bold editions. Published on the VS Code Marketplace.

## Motivation

Most themes are palette swaps. They pick colors and drop them into a JSON file. The result looks fine on one language and breaks on another because nobody tested the interaction between workbench chrome, semantic tokens, and TextMate scopes across languages.

## Design

A programmatic compilation pipeline generates all 12 variants from shared brand tokens. Each variant compiles to 369 workbench colors, 81 TextMate rules, and 37 semantic token rules. CI runs WCAG contrast validation on every build, with editor text hitting 14.92-16.98:1 contrast ratios. TextMate scope packs cover JS/TS, Go, Python, Java, Rust, HTML/CSS, JSON/YAML, Markdown, and SQL.
