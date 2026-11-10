# Strict OKF Resource Contract

Only `.resource-map/resources/**/index.md` files become graph nodes. Before creating one, copy `.resource-map/examples/minimal-resource/index.md` and replace its synthetic identity; never write frontmatter from memory.

## Required shape

`resource` is a YAML mapping, not a scalar. Keep `title` and `tags` at top level. The minimum accepted record is:

```yaml
---
title: Example Service
resource:
  kind: service
  id: example-service
  name: Example Service
  environment: unknown
  status: active
  owners: []
  description: Synthetic service used only to demonstrate the public format.
tags:
  - example
---
```

IDs and kinds are lowercase kebab-case; relationships are lowercase snake_case. Every target is another resource's global `resource.id`, never a relative path, display name, filename or directory-qualified target. Use `[[example-dependency]]`, not `[[services/example-dependency]]`.

## Typed relations

Use either strict Markdown in `## 图引用`:

```markdown
- depends_on: [[example-dependency#^dependency-evidence|dependency evidence]]
```

or attributed frontmatter edges:

```yaml
  relationships:
    - relation: occurs_on
      target: example-timeline
      anchor: ^timeline-evidence
      attributes:
        start: 1
        end: 1
        label: Example point
        precision: sequence
        certainty: synthetic
```

Do not hand-write derived graph/cache fields. Add stable evidence anchors to factual Markdown blocks. Keep instructions and coordinate semantics in Skills/references, not resource facts.

## Operation logs

Operation evidence lives in the resource's `oplog/` directory and is classified by
date. Every entry is exactly one file named `oplog/YYYY-MM-DD-<topic>.md`:

- The `YYYY-MM-DD` prefix is the local date the operation happened and is
  mandatory. A file without that prefix is not a valid operation log entry.
- `<topic>` is a short lowercase kebab-case summary, for example
  `2026-11-10-disk-cleanup.md`.
- One file per operated date and topic. Start a new dated file for a later day
  instead of appending that day's work to an existing entry.
- Record the operation window, resource ID, entrypoint, command summary, result and
  follow-up updates. Never store secrets, full connection strings, raw logs or
  business rows.

## Required workflow

1. Read this contract and the relevant `templates/resource-skills/<kind>/SKILL.md`.
2. Copy the minimal example outside `resources/`, then replace ID/kind/name/environment/status/body and remove synthetic relations that do not apply.
3. Create the concrete resource `skill/SKILL.md` from the kind template.
4. Add only targets whose index already exists or is created in the same batch.
5. Run `resource_graph_check` immediately. On error, read and repair every reported file; do not bypass the graph, write SQLite or continue scaling.
