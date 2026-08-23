---
title: "Pismo Zones"
slug: "pismozones"
date: 2026-03-20
note: "Timezone tool used daily across Pismo's distributed offices"
description: "AI-engineered timezone tool used daily across Pismo's distributed offices. Production-grade glassmorphism UI with spring-physics animations and ambient time-of-day lighting."
tech: ["JavaScript", "Vite"]
status: "Active"
github: "https://github.com/ashwingopalsamy/pismozones"
---

Timezone tool built for Pismo's engineering team spread across Sao Paulo, Bangalore, Bristol, Austin, and Singapore. AI-engineered from design to deployment. Used daily in production by Pismo engineers to coordinate across five offices.

## Motivation

Distributed teams waste time on timezone math. Every standup, every cross-office sync, someone asks "what time is it there?" Pismo Zones answers that instantly with a visual that updates in real-time.

## Design

Glassmorphism layers, spring-physics card transitions, and a color-interpolated gradient that shifts with time of day. The interface adapts ambient lighting based on the hour. Luxon handles all timezone math to avoid native Date object inconsistencies. Pure CSS variables, no utility frameworks. Client-side only, zero backend.

## Case Study

The design process, color theory, motion physics, and implementation decisions are documented in an interactive case study:

[View Design Case Study](/work/pismozones/design-case-study/)
