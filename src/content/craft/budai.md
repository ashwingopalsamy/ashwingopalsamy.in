---
title: "Bud.ai"
slug: "budai"
date: 2022-03-03
description: "Conversational academic assistant for Microsoft Teams. Azure Bot Service, LUIS, QnA Maker, CosmosDB. Built during the Microsoft Future Ready Talent program."
tech: ["Azure", "Teams"]
status: "Archive"
github: "https://github.com/ashwingopalsamy/opnsrc-microsoft-internship-bud.ai-project"
---

A Microsoft Teams bot that gives students a single place for academic information: schedules, attendance, subjects, faculty contacts. Built as part of the Microsoft Future Ready Talent program during COVID remote learning.

## Motivation

Remote learning during COVID pushed students across multiple platforms for different tasks. Class on Zoom, assignments on one portal, schedules on another, faculty contacts somewhere else. The fragmentation hit junior students hardest.

## Design

Azure Bot Framework handles conversation flow. LUIS provides intent recognition so students can ask naturally instead of navigating menus. QnA Maker handles FAQ-style queries. CosmosDB stores academic data. The bot runs as an Azure App Service and integrates directly into Microsoft Teams, where students already spend their day.
