---
title: "Intelligent Traffic Management System"
slug: "itms"
date: 2021-03-13
description: "YOLO-based vehicle detection for dynamic traffic signal switching. Trained on Indian Driving Dataset with fallback to static timing."
tech: ["Python"]
status: "Archive"
github: "https://github.com/ashwingopalsamy/opnsrc-machinelearning-itms-ug-graduation-project"
---

Final year project. A machine learning system that detects vehicles per lane and adjusts traffic signal timing based on real-time density instead of fixed timers.

## Motivation

Fixed-timer traffic signals ignore actual traffic conditions. A lane with three cars gets the same green time as a lane with thirty. The result is unnecessary congestion on busy lanes and wasted green time on empty ones.

## Design

YOLO model trained on the Indian Driving Dataset for vehicle detection. The pipeline runs non-max suppression, counts vehicles per lane, and feeds the count into a signal timing function that allocates green time proportionally. When conditions fall outside normal parameters, the system falls back to static timing.
