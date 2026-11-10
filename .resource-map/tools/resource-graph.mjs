#!/usr/bin/env node
import { resolve } from 'node:path'
import { initializeProject, installHooks, readGraph, rebuildIndex, validateResources } from './lib/core.js'

const args = process.argv.slice(2)
// Accept the DSH tool names as subcommands so a runtime without the plugin can
// invoke exactly the capability it would otherwise call as a tool.
const ALIASES = { resource_graph_check: 'check', resource_graph_query: 'query' }
const requested = args.shift() || 'help'
const command = ALIASES[requested] || requested
function option(name, fallback) {
  const index = args.indexOf(name)
  return index < 0 ? fallback : args[index + 1]
}
const root = resolve(option('--root', process.cwd()))
const json = args.includes('--json')

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, json ? 2 : 0)}\n`)
}

try {
  if (command === 'check') {
    const result = args.includes('--write-index') ? rebuildIndex(root) : validateResources(root)
    const output = { ok: result.ok, nodes: result.nodes ?? result.records.length, edges: result.edges, errors: result.errors, warnings: result.warnings, indexPath: result.indexPath }
    print(output)
    process.exitCode = output.ok ? 0 : 1
  } else if (command === 'index') {
    const result = rebuildIndex(root)
    print({ ok: result.ok, nodes: result.nodes, edges: result.edges, errors: result.errors, warnings: result.warnings, indexPath: result.indexPath, digest: result.digest })
    process.exitCode = result.ok ? 0 : 1
  } else if (command === 'query') {
    print(readGraph(root, { query: option('--query', ''), limit: Number(option('--limit', 500)) }))
  } else if (command === 'init') {
    const created = initializeProject(root)
    const indexed = rebuildIndex(root)
    print({ ok: indexed.ok, nodes: indexed.nodes, edges: indexed.edges, errors: indexed.errors, warnings: indexed.warnings, ...created })
    process.exitCode = indexed.ok ? 0 : 1
  } else if (command === 'hook' && args[0] === 'install') {
    print({ ok: true, ...installHooks(root) })
  } else {
    process.stdout.write(`resource-graph <command> [options]\n\nCommands:\n  init                    Create/enable .resource-map and refresh the bundled tools
  check [--write-index]   Validate .resource-map; optionally update SQLite incrementally\n  index                   Incrementally update .resource-map/graph.sqlite\n  query [--query TEXT]    Query the project graph with [[node-id]] references\n  hook install            Install .resource-map-gated post-merge/post-rewrite hooks

Aliases (same names as the DSH tools):
  resource_graph_check    = check        resource_graph_query = query\n\nOptions:\n  --root PATH             Project root (default: cwd)\n  --json                  Pretty JSON output\n`)
  }
} catch (error) {
  process.stderr.write(`resource-graph: ${error.stack || error.message}\n`)
  process.exitCode = 1
}
