---
title: "Lets talk about Abliterated LLMs"
seoTitle: "Lets talk about Abliterated LLMs"
date: 2026-11-01
tags: ["ai", "ethics"]
description: "An abliterated model is an open-weight AI model with its trained refusals removed. Notes from a class discussion on why that is hard to control, and where safety could go instead."
image: /blog/abliterated/og-hero.png
imageAlt: "A circle of thin dark lines radiating from a centre, with one line in violet and dashed."
---

Most AI models are trained to refuse certain requests. An abliterated model is an open-weight model, one anyone can download and run, with that training removed. You can get one today, for free.

I first raised this on the forum for my Ethics in AI course, part of my MSAI at UT Austin. A classmate's reply changed my thinking, so here is that conversation, expanded.

## How it works

In 2024, [researchers showed](https://arxiv.org/abs/2406.11717) that refusal in 13 open chat models came down to a single direction inside the model. Erase that direction and the model stops saying no.

![Two bursts of lines. In the trained model one line is solid violet and the model says no. In the abliterated model that line is dashed and the model stops saying no.](/blog/abliterated/one-direction.svg)

_A sketch. Real models have thousands of dimensions._

Maxime Labonne then [wrote up](https://huggingface.co/blog/mlabonne/abliteration) how to burn this into the weights without retraining. [Heretic](https://github.com/p-e-w/heretic) now automates it.

Safety work turns out to be one of the cheapest parts of a model to remove.

## How many are out there

I counted model names on [Hugging Face](https://huggingface.co/models?search=abliterated) through its public API on 1 November 2026. A name can match more than one row, and "uncensored" also covers models made other ways.

![Abliterated: 8,909 models, 25.4 million downloads in the last 30 days. Uncensored: 8,061 models, 36.0 million. Heretic: 7,147 models, 13.1 million. Obliterated: 472 models, 2.0 million.](/blog/abliterated/names.svg)

The first "abliterated" upload is from May 2024. More than half have come in 2026.

![Monthly bars rising from about 200 in May 2024 to 715 in October 2026. 2024 had 1,275 models, 2025 had 2,718 and 2026 has 4,916 so far.](/blog/abliterated/uploads.svg)

Just over half of the "abliterated" models (4,722) are GGUF, a format for running models on your own machine, and many are probably conversions of the same model.

Downloads count file requests, so scripts and repeat pulls inflate them. These numbers show supply and interest. They say nothing about what anyone did with a model.

## Why people use them

Refusals are blunt. Models [turn down safe questions](https://arxiv.org/abs/2308.01263) that only sound risky, which gets in the way of security researchers, doctors and novelists. Abliteration fixes that for them.

It fixes it for everyone else too.

## What goes on download

Hosted models have more than refusals. Anthropic [wraps Claude Opus 4](https://www.anthropic.com/news/activating-asl3-protections) in classifiers that watch inputs and outputs, plus wider monitoring.

A downloaded model has no provider watching, so all of that is gone before anyone edits a weight. The refusal is the last safeguard left, and abliteration takes it.

![Three sets of rings around a dot. A hosted model has monitoring, classifiers and refusal. A downloaded model has refusal only. An abliterated model has none of them, and its refusal ring is dashed.](/blog/abliterated/safeguards.svg)

## Can this be controlled, safely and responsibly?

That was my first question. Something this capable is free to download. Shouldn't it have safeguards?

My classmate's answer was hard to argue with. Files don't stay contained. Pirated software carries legal penalties and still circulates over BitTorrent. Controlling weights would take internet monitoring most of us wouldn't accept. Rules can also end up favouring large incumbents over new entrants.

I agree. Weights are a file, and a file can't be recalled. The US government's [2024 review](https://www.ntia.gov/programs-and-initiatives/artificial-intelligence/open-model-weights-report/policy-approaches-recommendations) landed close to this: monitor for now, keep restriction as an option.

But containment and friction are different things. Piracy survives, yet you won't find it in an app store. Hugging Face [can already](https://huggingface.co/content-policy) gate, unrank or remove content. A label and a click-through won't stop anyone determined. They do slow down someone curious, who has the least skill and the least patience.

Laws can also target the use. Fraud is fraud, whichever model wrote the email.

## What I keep thinking about

I want open weights to exist. I'm less sure about how easily the refusals come off.

Most misuse before AI took some skill. Dario Amodei [argues](https://www.darioamodei.com/essay/the-adolescence-of-technology) AI could make that skill far less scarce.

It's easy to overstate this. Removing a refusal adds no knowledge, and knowing is far from doing. [Some researchers](https://arxiv.org/abs/2412.01946) see no immediate risk in domains like biology. [Others found](https://arxiv.org/abs/2504.16137) that o3 outscored 94% of expert virologists on a written test. A test isn't a lab, so both can hold for now.

The models will keep improving, though, and the refusals will stay this easy to remove.

## So where does safety go?

Whoever holds the weights can edit them, so safety has to sit somewhere harder to edit.

One place is what the model never learned. The [Deep Ignorance](https://arxiv.org/abs/2508.06601) paper filtered hazardous topics from training data, and those models resisted up to 10,000 steps of fine-tuning on that material. A model can still use such information if you hand it over, so this only goes so far.

Another is testing before release. OpenAI [fine-tuned gpt-oss](https://arxiv.org/abs/2508.03153) to push its risky capabilities as far as it could, and used the results to decide on release. A lab marking its own homework is a weak check. It still beats testing only the polite version, because the other version is the one that will circulate.

Where I land: keep open weights, filter the riskiest training data, test every release with its refusals gone, and have hosts label what they host.

None of that is airtight. It only has to raise the bar, and today the bar is a free download.
