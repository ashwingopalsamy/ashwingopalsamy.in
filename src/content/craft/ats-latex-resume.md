---
title: "ATS LaTeX Resume"
slug: "ats-latex-resume"
date: 2024-10-27
description: "LaTeX resume template engineered for ATS parsing. Unicode mapping, ATS-safe fonts, and tested text extraction from generated PDFs."
tech: ["LaTeX"]
status: "Active"
github: "https://github.com/ashwingopalsamy/ats-latex-resume"
---

A LaTeX resume template built for machine readability. ATS systems parse the generated PDF correctly, and it still looks clean for human reviewers.

## Motivation

Most LaTeX resume templates optimize for aesthetics. The PDF looks great but ATS software fails to extract the text, misreads special characters, or chokes on custom fonts. Your resume gets filtered out before a human sees it.

## Design

Package choices that target specific ATS failure modes. `pdfgentounicode` and `glyphtounicode` provide Unicode mapping so PDF text extraction works correctly. `lmodern` and `charter` are ATS-safe fonts that don't break parsing. `inputenc` with UTF-8 prevents character encoding failures. Tested against ATS parsers including Jobscan and Resumeworded.
