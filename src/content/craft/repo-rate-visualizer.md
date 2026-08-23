---
title: "Repo Rate Visualizer"
slug: "repo-rate-visualizer"
date: 2026-02-10
note: "D3.js interactive history of India's RBI repo rate"
description: "Interactive visualization of India's RBI repo rate history. D3.js timeline charts, cycle comparisons, and data export with URL state sync."
tech: ["JavaScript", "React"]
status: "Active"
github: "https://github.com/ashwingopalsamy/repo-rate-visualizer"
---

Interactive data visualization of India's Reserve Bank of India repo rate decisions over time. Timeline charts, rate change analysis, monetary policy cycle comparisons, and CSV export.

## Motivation

RBI repo rate data is public but scattered across press releases and PDF tables. No single tool lets you see the full timeline, compare easing and tightening cycles, or share a specific date range with a URL.

## Design

D3.js renders the charts from bundled historical data. Multiple views: timeline, rate change bars, cycle comparison, and event annotations. A filter bar supports date range presets (10Y, 5Y, custom) and a URL state hook encodes the current view and range into the address bar for shareable links. Separate mobile layout components handle smaller viewports.
