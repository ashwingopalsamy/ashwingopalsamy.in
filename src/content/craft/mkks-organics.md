---
title: "MKKS Organics"
slug: "mkks-organics"
date: 2026-03-01
description: "Storefront for a family organic mango business. Static React site with WhatsApp-based reservation flow. Zero backend."
tech: ["JavaScript", "React", "Vite"]
status: "Active"
github: "https://github.com/ashwingopalsamy/host-mkks-organics"
---

Storefront for MKKS Organics, a family mango orchard business. Customers browse varieties, select quantities, and send a structured reservation request via WhatsApp.

## Motivation

The business needed an online presence but not a full e-commerce stack. No payment gateway, no user accounts, no database. Orders are seasonal, volume is manageable over WhatsApp, and the overhead of maintaining a backend would outweigh its value.

## Design

Static React site on Vercel. Product data and pricing live in a single content file. The reservation sheet collects quantities by variety and pack size, calculates totals, and constructs a pre-formatted WhatsApp message with the order details and delivery info. Optimized images in WebP with responsive srcSet. Framer Motion for page transitions.
