---
title: "UUIDv8"
slug: "uuidv8"
date: 2024-06-10
note: "Open-source Go library for RFC 9562-compliant identifiers"
description: "Open-source Go library for generating RFC 9562-compliant UUIDv8 identifiers with custom timestamp and node encoding."
tech: ["Go"]
status: "Active"
github: "https://github.com/ash3in/uuidv8"
---

A Go library for generating UUIDv8 identifiers per RFC 9562. UUIDv8 is the newest UUID version, designed for applications that need custom timestamp encoding, database-friendly sorting, and domain-specific node bits -- all within the standard 128-bit UUID format.

## Why UUIDv8

UUIDv4 is random. UUIDv7 is time-ordered but opinionated about its timestamp layout. UUIDv8 gives you full control over the custom bits while remaining RFC-compliant. This matters when you need deterministic ordering, embedded metadata, or compatibility with systems that validate UUID structure.

## Design

Zero external dependencies. The library handles timestamp encoding, clock sequence management, and node ID generation while enforcing the RFC 9562 variant and version bits. The API is deliberately minimal -- one function to generate, one to parse.
