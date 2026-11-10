# Project graph tool

This directory holds a self-contained copy of the resource-graph CLI for this
project. It is the same Node implementation the DSH plugin exposes as the
`resource_graph_query` and `resource_graph_check` tools, so the project keeps
identical graph behaviour when it is opened outside DSH (another agent runtime,
CI, or a plain terminal). It has no dependencies and never invokes Python.

## Which entrypoint to use

Pick the first entrypoint that is available in your runtime:

| Runtime | Use |
| --- | --- |
| DSH with the `dsh-resource-map` plugin enabled | The `resource_graph_check` and `resource_graph_query` tools. Prefer the tools; they resolve the project and cache for you. |
| Any other agent, editor, CI, or plain shell | This directory's `resource-graph.mjs`. |

The tools and this CLI are the same implementation over the same
`.resource-map/graph.sqlite` cache, so either one produces identical results.
Never write that SQLite file by hand, and never add a Python graph builder.

## Invocation

Run from the project root, or pass `--root`:

```bash
node .resource-map/tools/resource-graph.mjs init --root .
node .resource-map/tools/resource-graph.mjs check --root .
node .resource-map/tools/resource-graph.mjs index --root .
node .resource-map/tools/resource-graph.mjs query --root . --query "checkout"
node .resource-map/tools/resource-graph.mjs hook install --root .
```

Requires Node.js 22.5 or newer (it uses `node:sqlite`).

## Command and tool mapping

| CLI command | DSH tool | Behaviour |
| --- | --- | --- |
| `init` | none (UI **启用资源图**) | Create `.resource-map`, its contract, templates, and this tools directory. |
| `check [--write-index]` | `resource_graph_check` | Validate every record; with `--write-index` also refresh the cache incrementally. |
| `index` | `resource_graph_check` | Incrementally rebuild `.resource-map/graph.sqlite`. |
| `query --query TEXT` | `resource_graph_query` | Return matching nodes with their connected edges. |
| `hook install` | none | Install Git hooks gated on `.resource-map/` changes. |

Run `check` (or `resource_graph_check`) after editing any
`.resource-map/resources/**/index.md`.

## Refresh

Re-running project initialization refreshes this directory to match the
installed plugin version. Local edits here are overwritten.
