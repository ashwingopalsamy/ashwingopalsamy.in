---
title: "UUIDCheck"
slug: "uuidcheck"
date: 2024-09-05
description: "Zero-dependency Go utility for validating and identifying UUID formats across RFC 4122 and RFC 9562 versions."
tech: ["Go"]
status: "Active"
github: "https://github.com/ashwingopalsamy/uuidcheck"
---

A lightweight Go package for validating UUID strings and identifying their version and variant. Supports all UUID versions from RFC 4122 (v1-v5) through RFC 9562 (v6, v7, v8), with zero external dependencies.

## Motivation

UUID validation in Go typically means a regex or pulling in a full UUID generation library just to check a string. UUIDCheck does one thing well: tell you if a UUID is valid, what version it is, and whether the variant bits are correct. Nothing more.

## Design

Pure standard library. The parser validates structure (8-4-4-4-12 hex format), extracts version from the 13th nibble, checks variant bits in the clock sequence, and returns a typed result. Useful as a validation layer at API boundaries or in data pipeline ingestion.
