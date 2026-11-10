---
name: resource-kind-design
description: Design an evidence-backed professional resource-kind template for an unknown domain, test it on a small sample, and evolve it from observed extraction failures.
---
# Professional Resource Kind Design

Use this before creating a new kind or processing an unfamiliar domain. A kind is a reusable responsibility and analysis method, not merely a display category.

## 1. Establish the domain job

Write the questions this kind must answer, its source material, the unit an agent must read completely, and what later agents need to query independently. Separate primary evidence, stable facts, interpretations, derived projections and temporary work products.

## 2. Node admission test

Create a resource node only when at least one condition holds and evidence supports it:

- stable identity across multiple contexts;
- independent lifecycle, state or ownership;
- reused by multiple resources;
- participates in typed relationships that must be queried independently;
- needs a distinct workflow, safety boundary or verification status.

Keep narrative content in its owning Markdown when it is a mention, transient action, scene detail, unresolved interpretation or formatting subdivision. Extraction artifacts such as keyword-hit lists, binding summaries, temporary JSON and copied snippets belong in discoveries or disposable work products, not in the canonical resource body or graph. A virtual node is justified only when the virtual object has stable identity plus independent relationships/state or a specialist workflow. Never create generic binding, match, row, snippet or copy nodes merely to connect evidence.

## 3. Evidence contract

Choose stable evidence anchors before extraction. Markdown evidence uses Obsidian headings or lowercase-kebab block IDs, never physical line numbers. Every inferred fact records certainty; every semantic event/entity/action relation can be traced to an owning resource anchor. Preserve source text once and use links, not copied bodies. Define what evidence upgrades draft/provisional claims and what evidence is forbidden to infer.

## 4. Professional method template

A new kind template must define:

- complete-read/discovery procedure and bounded source scope;
- minimum fields and node admission/rejection examples;
- typed outgoing/incoming relationships and evidence requirements;
- state, chronology, aliases, certainty and conflict handling when relevant;
- what stays in Markdown versus references/discoveries/oplog;
- virtual-node criteria and anti-explosion limits;
- read-only/safety boundary;
- completion criteria and quality checks;
- concrete Skill evolution triggers.

Instantiate the template into each concrete resource Skill and replace generic identity with its resource ID and actual evidence paths. Templates are managed defaults; concrete Skills contain practiced knowledge.

## 5. Quality-gated trial

Before scaling, process the smallest representative sample end-to-end. For narrative text use 3–10 complete chapters; for infrastructure use one bounded target plus its immediate dependencies. Run resource_graph_check and query schema/neighbors. Measure and inspect:

- isolated-node ratio and nodes with no semantic edge;
- kind distribution and sudden kind explosion;
- duplicated bodies or one-to-one wrapper nodes;
- edges based only on co-occurrence or keyword matching;
- missing/invalid evidence anchors;
- unsupported certainty, invented dates or identities;
- whether a human can understand topology and selected Markdown.

Do not scale while these checks fail.

## 6. Evolve from practice

After each batch classify findings as false-positive nodes, false-negative nodes, wrong merge/split, wrong edge semantics, missing evidence, shallow reading, unsafe method, UI projection problem, or schema limitation. If a template instruction caused the failure, replace that instruction in this managed methodology/source template; if the lesson is domain-specific, replace the corresponding kind template; if resource-specific, update its concrete Skill. Do not append contradictory exceptions. Record unresolved conflicts in discoveries.

A template update is required when the same correction would help the next resource of that kind, when an admission rule repeatedly needs human correction, or when quality checks reveal systematic unreadability. No update is needed for pure lookup with no new practice.
