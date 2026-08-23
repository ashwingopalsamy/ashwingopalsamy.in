---
title: "Claude Code Launcher"
slug: "claude-code-launcher"
date: 2026-02-02
note: "One-command enterprise launcher with JWT auth"
description: "One-command Claude Code launcher for enterprise users with JWT authentication. Secure token storage, expiry tracking, interactive installer."
tech: ["Terminal"]
status: "Active"
github: "https://github.com/ash3in/claude-code-launcher"
---

A shell utility that reduces enterprise Claude Code setup to one command. Type `cc` and you're in.

## Motivation

Enterprise users accessing Claude Code through corporate endpoints deal with refreshable JWT tokens, multi-step environment variable setup, and token management across sessions. Tokens end up in shell history, visible in process lists. Every new terminal session means pasting a long JWT again.

## Design

A single shell function handles token storage (file permissions 600, never in history or `ps` output), JWT format validation, expiry tracking with days-remaining display, and endpoint configuration. An interactive installer detects your shell, sets up the alias, and optionally adds a prompt indicator. Daily use is one command: `cc`.
