import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync } from 'node:fs'
import { INDEX_RELATIVE_PATH, discoverResources, initializeProject, installHooks, parseSimpleYaml, readGraph, rebuildIndex, validateResources } from '../src/core.js'

function fixture(target, id, relation) {
  const directory = join(target, '.resource-map', 'resources', 'projects', 'test', id)
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(directory, 'index.md'), `---\nokf_version: '0.1'\ntype: Project\ntitle: ${id}\nresource:\n  id: ${id}\n  kind: project\n  name: ${id}\n  environment: test\n  status: active\n  owners:\n    - platform\ntags:\n  - demo\n---\n# ${id}\n\nA demo node.\n\n## 图引用\n\n${relation || ''}\n`)
}

test('simple YAML parser handles nested lists', () => {
  const value = parseSimpleYaml('resource:\n  id: demo-a\n  owners:\n    - team-a\ntags: []\n')
  assert.equal(value.resource.id, 'demo-a')
  assert.deepEqual(value.resource.owners, ['team-a'])
})

test('unconfigured project is empty and does not read external project content', () => {
  const root = mkdtempSync(join(tmpdir(), 'resource-graph-'))
  const legacy = join(root, 'resources', 'projects', 'demo-a')
  mkdirSync(legacy, { recursive: true }); writeFileSync(join(legacy, 'index.md'), 'legacy content')
  const result = rebuildIndex(root)
  assert.equal(result.ok, true); assert.equal(result.configured, false); assert.equal(result.nodes, 0)
  assert.equal(existsSync(join(root, INDEX_RELATIVE_PATH)), false)
  assert.equal(readGraph(root).configured, false)
})

test('validator only reports references inside .resource-map', () => {
  const root = mkdtempSync(join(tmpdir(), 'resource-graph-'))
  fixture(root, 'demo-a', '- uses_service: [[missing-node]]')
  const result = validateResources(root)
  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /unknown resource missing-node/)
})

test('incremental index processes changed and removed files only', () => {
  const root = mkdtempSync(join(tmpdir(), 'resource-graph-'))
  fixture(root, 'demo-a', '- uses_service: [[demo-b]]'); fixture(root, 'demo-b')
  const first = rebuildIndex(root)
  assert.equal(first.ok, true); assert.equal(first.changed, 2); assert.equal(first.nodes, 2); assert.equal(first.edges, 1)
  assert.equal(existsSync(join(root, INDEX_RELATIVE_PATH)), true); assert.equal(existsSync(join(root, '.resource-map', 'state.json')), false)
  const second = rebuildIndex(root)
  assert.equal(second.changed, 0); assert.equal(second.removed, 0); assert.equal(second.nodes, 2)
  fixture(root, 'demo-b', '- relates_to: [[demo-a]]')
  const third = rebuildIndex(root)
  assert.equal(third.changed, 1); assert.equal(third.edges, 2)
  rmSync(join(root, '.resource-map', 'resources', 'projects', 'test', 'demo-b'), { recursive: true })
  fixture(root, 'demo-a')
  const fourth = rebuildIndex(root)
  assert.equal(fourth.changed, 1); assert.equal(fourth.removed, 1); assert.equal(fourth.nodes, 1)
  const graph = readGraph(root, { query: 'demo-a' })
  assert.equal(graph.nodes[0].reference, '[[demo-a]]')
})

test('generic resource units require strict resource frontmatter and support wikilink edges', () => {
  const root = mkdtempSync(join(tmpdir(), 'resource-graph-docs-'))
  const notes = join(root, '.resource-map', 'resources', 'mindmaps', 'shared', 'idea-card'); const diary = join(root, '.resource-map', 'resources', 'diaries', 'shared', 'daily-2026-08-26')
  mkdirSync(notes, { recursive: true }); mkdirSync(diary, { recursive: true })
  writeFileSync(join(notes, 'index.md'), '---\ntitle: Idea card\nresource:\n  id: idea-card\n  kind: mindmap\n  name: Idea card\n  environment: shared\n  status: active\n---\n# Idea card\n\nConnect to [[daily-2026-08-26]].\n')
  writeFileSync(join(diary, 'index.md'), '# Daily note\n\nToday links back to [[idea-card]].\n')
  const invalid = rebuildIndex(root); assert.equal(invalid.ok, false); assert.match(invalid.errors.join('\n'), /YAML frontmatter is required/)
  writeFileSync(join(diary, 'index.md'), '---\ntitle: Daily note\nresource:\n  id: daily-2026-08-26\n  kind: diary\n  name: Daily note\n  environment: shared\n  status: active\n---\n# Daily note\n\nToday links back to [[idea-card]].\n')
  const indexed = rebuildIndex(root)
  assert.equal(indexed.ok, true); assert.equal(indexed.nodes, 2); assert.equal(indexed.edges, 2)
  const graph = readGraph(root)
  const idea = graph.nodes.find((node) => node.id === 'idea-card'); const daily = graph.nodes.find((node) => node.id === 'daily-2026-08-26')
  assert.equal(idea.kind, 'mindmap'); assert.match(idea.markdown, /^# Idea card/); assert.doesNotMatch(idea.markdown, /title: Idea card/)
  assert.equal(daily.kind, 'diary'); assert.equal(graph.edges.every((edge) => edge.relation === 'links_to'), true)
})

test('Obsidian-compatible heading, block and alias links keep node edges and validate anchors', () => {
  const root = mkdtempSync(join(tmpdir(), 'resource-graph-anchor-'))
  const target = join(root, '.resource-map', 'resources', 'notes', 'shared', 'target'); const source = join(root, '.resource-map', 'resources', 'notes', 'shared', 'source'); mkdirSync(target, { recursive: true }); mkdirSync(source, { recursive: true })
  const front = (id, name) => `---\nresource:\n  id: ${id}\n  kind: note\n  name: ${name}\n  environment: shared\n  status: active\n---\n`
  writeFileSync(join(target, 'index.md'), `${front('target', 'Target')}# Target\n\n[[#Important Evidence|jump locally]]\n\n## Important Evidence\n\nStable evidence. ^evidence-1\n\n[[#^evidence-1|local block]]\n`)
  writeFileSync(join(source, 'index.md'), `${front('source', 'Source')}# Source\n\n[[target#Important Evidence|heading alias]]\n\n## 图引用\n- supports: [[target#^evidence-1|block alias]]\n`)
  const valid = validateResources(root); assert.equal(valid.ok, true); const record = valid.records.find((item) => item.id === 'source'); assert.equal(record.relations.every((edge) => edge.target === 'target'), true); assert.equal(record.relations.some((edge) => edge.anchor === '^evidence-1' && edge.alias === 'block alias'), true)
  rebuildIndex(root); const cachedEdge = readGraph(root).edges.find((edge) => edge.source === 'source' && edge.relation === 'supports'); assert.equal(cachedEdge.attributes.evidence_anchor, '^evidence-1'); assert.equal(cachedEdge.attributes.evidence_alias, 'block alias')
  writeFileSync(join(source, 'index.md'), `${front('source', 'Source')}# Source\n\n[[target#Missing Heading]]\n`); const invalid = validateResources(root); assert.equal(invalid.ok, false); assert.match(invalid.errors.join('\n'), /unknown heading/)
})

test('malformed graph-section bullets fail instead of silently producing zero edges', () => {
  const root = mkdtempSync(join(tmpdir(), 'resource-graph-bad-edge-')); fixture(root, 'event-a', '- event-b')
  const result = rebuildIndex(root); assert.equal(result.ok, false); assert.match(result.errors.join('\n'), /expected - relation: \[\[target-id#anchor\|alias\]\]/)
})

test('timeline is an ordinary kind and attributed edges retain generic intervals', () => {
  const root = mkdtempSync(join(tmpdir(), 'resource-graph-time-')); fixture(root, 'event-a'); fixture(root, 'story-axis')
  const axisPath = join(root, '.resource-map', 'resources', 'projects', 'test', 'story-axis', 'index.md'); writeFileSync(axisPath, readFileSync(axisPath, 'utf8').replace('kind: project', 'kind: timeline'))
  const path = join(root, '.resource-map', 'resources', 'projects', 'test', 'event-a', 'index.md')
  let text = readFileSync(path, 'utf8').replace('  status: active\n', '  status: active\n  relationships:\n    - relation: occurs_on\n      target: story-axis\n      attributes:\n        start: 8\n        end: 12\n        label: Long event\n        precision: sequence\n        certainty: verified\n')
  writeFileSync(path, text); const indexed = rebuildIndex(root); assert.equal(indexed.ok, true)
  const graph = readGraph(root); const edge = graph.edges.find((item) => item.source === 'event-a' && item.target === 'story-axis'); assert.deepEqual(edge.attributes, { start: 8, end: 12, label: 'Long event', precision: 'sequence', certainty: 'verified' }); assert.equal(graph.nodes.find((node) => node.id === 'story-axis').kind, 'timeline')
  writeFileSync(path, text.replace('  relationships:\n', '  timelines: []\n  relationships:\n')); const invalid = rebuildIndex(root); assert.equal(invalid.ok, false); assert.match(invalid.errors.join('\n'), /resource.timelines is not supported/)
  fixture(root, 'axis-two'); const axis2 = join(root, '.resource-map', 'resources', 'projects', 'test', 'axis-two', 'index.md'); writeFileSync(axis2, readFileSync(axis2, 'utf8').replace('kind: project', 'kind: timeline').replace('  status: active\n', '  status: active\n  relationships:\n    - relation: aligned_with\n      target: story-axis\n      attributes:\n        certainty: provisional\n')); const missingMapping = validateResources(root); assert.equal(missingMapping.ok, false); assert.match(missingMapping.errors.join('\n'), /requires attributes.source_start/)
})

test('explicit UI initialization creates only project map structure and ignored SQLite', () => {
  const root = mkdtempSync(join(tmpdir(), 'resource-graph-enable-'))
  initializeProject(root)
  const indexed = rebuildIndex(root)
  assert.equal(indexed.ok, true); assert.equal(indexed.nodes, 0)
  assert.equal(existsSync(join(root, '.resource-map', 'config.json')), true)
  assert.equal(existsSync(join(root, '.resource-map', 'resources')), true)
  assert.equal(existsSync(join(root, '.resource-map', 'skills')), true)
  assert.equal(existsSync(join(root, '.resource-map', 'runbooks')), true)
  assert.equal(existsSync(join(root, '.resource-map', 'skills', 'resource-map-maintenance', 'SKILL.md')), true)
  const contract = readFileSync(join(root, '.resource-map', 'runbooks', 'okf-resource-contract.md'), 'utf8'); assert.match(contract, /resource:\n  kind: service/); assert.match(contract, /never a relative path/)
  // Operation logs are classified by date with a mandatory YYYY-MM-DD prefix.
  assert.match(contract, /## Operation logs/); assert.match(contract, /oplog\/YYYY-MM-DD-<topic>\.md/); assert.match(contract, /prefix is the local date the operation happened and is\s+mandatory/)
  const demoA = join(root, '.resource-map', 'examples', 'minimal-resource', 'index.md'); const demoB = join(root, '.resource-map', 'examples', 'minimal-related', 'index.md'); assert.equal(existsSync(demoA), true); assert.equal(existsSync(demoB), true)
  const kindDesign = readFileSync(join(root, '.resource-map', 'skills', 'resource-kind-design', 'SKILL.md'), 'utf8'); assert.match(kindDesign, /Node admission test/); assert.match(kindDesign, /Quality-gated trial/); assert.match(kindDesign, /Evolve from practice/)
  for (const reference of ['intake-and-scope.md', 'evidence-and-uncertainty.md', 'safe-metadata-discovery.md', 'source-and-deployment-analysis.md', 'investigation-and-root-cause.md', 'evolution-closeout.md', 'public-release-gate.md', 'portable-script-contract.md']) assert.equal(existsSync(join(root, '.resource-map', 'skills', 'resource-map-maintenance', 'references', reference)), true)
  for (const core of ['resource-investigation', 'source-analysis', 'metadata-safety', 'resource-evolution']) assert.equal(existsSync(join(root, '.resource-map', 'skills', core, 'SKILL.md')), true)
  for (const kind of ['server', 'service', 'system', 'ops_document', 'cloud_provider', 'cloud_provider_account', 'cloud_resource', 'project', 'docker', 'redis', 'mq', 'message_queue', 'mq_channel', 'mq_route', 'registry', 'kubernetes', 'database', 'database_namespace', 'database_table', 'novel', 'volume', 'chapter', 'entity', 'event', 'action', 'timeline', 'website']) {
    assert.equal(existsSync(join(root, '.resource-map', 'templates', 'resource-skills', kind, 'SKILL.md')), true)
    assert.equal(existsSync(join(root, '.resource-map', 'templates', 'resource-skills', kind, 'references', 'read-only-discovery.md')), true)
  }
  const novelTemplate = readFileSync(join(root, '.resource-map', 'templates', 'resource-skills', 'novel', 'SKILL.md'), 'utf8'); assert.match(novelTemplate, /must create at least one chapter-order/)
  const novelReference = readFileSync(join(root, '.resource-map', 'templates', 'resource-skills', 'novel', 'references', 'read-only-discovery.md'), 'utf8'); assert.match(novelReference, /not a universal `resource_graph_check` validator rule/)
  assert.equal(discoverResources(root).length, 0); assert.equal(existsSync(join(root, '.resource-map', 'documents')), false)
  assert.equal(existsSync(join(root, '.resource-map', 'state.json')), false)
  const ignored = readFileSync(join(root, '.resource-map', '.gitignore'), 'utf8')
  assert.match(ignored, /^\/graph\.sqlite$/m); assert.match(ignored, /^\/graph\.sqlite-wal$/m); assert.match(ignored, /^\/graph\.sqlite-shm$/m)
  const db = new DatabaseSync(join(root, INDEX_RELATIVE_PATH), { readOnly: false })
  try { assert.equal(db.prepare('SELECT COUNT(*) count FROM source_state').get().count, 0); db.prepare("INSERT INTO nodes(id, kind, environment, status, title, path, description, text, owners, tags) VALUES ('ghost-binding', 'binding', 'unknown', 'active', 'ghost', 'python/generated', '', '', '[]', '[]')").run() } finally { db.close() }
  rebuildIndex(root); const owned = new DatabaseSync(join(root, INDEX_RELATIVE_PATH), { readOnly: true }); try { assert.equal(owned.prepare("SELECT COUNT(*) count FROM nodes WHERE id='ghost-binding'").get().count, 0) } finally { owned.close() }
  writeFileSync(join(root, '.resource-map', 'templates', 'resource-skills', 'chapter', 'SKILL.md'), 'stale template'); rebuildIndex(root); assert.match(readFileSync(join(root, '.resource-map', 'templates', 'resource-skills', 'chapter', 'SKILL.md'), 'utf8'), /complete chapter Markdown body/)
  fixture(root, 'bad-binding'); const bad = join(root, '.resource-map', 'resources', 'projects', 'test', 'bad-binding', 'index.md'); writeFileSync(bad, readFileSync(bad, 'utf8').replace('kind: project', 'kind: binding')); assert.match(validateResources(root).errors.join('\n'), /kind binding is forbidden/)
  const envDir = join(root, '.resource-map', 'resources', 'projects', 'test', 'env-check', 'scripts'); fixture(root, 'env-check'); mkdirSync(envDir, { recursive: true }); writeFileSync(join(envDir, '.env'), 'RESOURCE_ID=wrong\nRESOURCE_KIND=project\nENVIRONMENT=test\nAPI_URL=http://127.0.0.1:9999\n'); const unsafe = validateResources(root).errors.join('\n'); assert.match(unsafe, /RESOURCE_ID must equal env-check/); assert.match(unsafe, /forbidden local-machine entrypoint/)
})

test('initialization ships the same CLI under .resource-map/tools for runtimes without the plugin', () => {
  const root = mkdtempSync(join(tmpdir(), 'resource-graph-tools-'))
  initializeProject(root)
  const cli = join(root, '.resource-map', 'tools', 'resource-graph.mjs')
  assert.equal(existsSync(cli), true)
  assert.equal(existsSync(join(root, '.resource-map', 'tools', 'README.md')), true)
  for (const file of ['frontmatter.js', 'core.js', 'query.js', 'resource-skill-templates.js']) assert.equal(existsSync(join(root, '.resource-map', 'tools', 'lib', file)), true)
  const source = readFileSync(cli, 'utf8')
  assert.match(source, /from '\.\/lib\/core\.js'/)
  assert.doesNotMatch(source, /from '\.\.\/src\/core\.js'/)
  const usage = readFileSync(join(root, '.resource-map', 'tools', 'README.md'), 'utf8')
  assert.match(usage, /resource_graph_check/); assert.match(usage, /resource_graph_query/)
  // The project copy must run with no node_modules and answer the DSH tool names.
  const checked = JSON.parse(execFileSync(process.execPath, [cli, 'resource_graph_check', '--root', root, '--json'], { encoding: 'utf8', cwd: tmpdir() }))
  assert.equal(checked.ok, true); assert.equal(checked.nodes, 0)
  fixture(root, 'tool-check')
  const indexed = JSON.parse(execFileSync(process.execPath, [cli, 'resource_graph_query', '--root', root, '--query', 'tool-check', '--json'], { encoding: 'utf8', cwd: tmpdir() }))
  assert.equal(indexed.configured, true)
  assert.equal(indexed.nodes.some((node) => node.id === 'tool-check'), true)
  rmSync(root, { recursive: true, force: true })
})

test('hook installer preserves existing hooks and gates on .resource-map changes', () => {
  const root = mkdtempSync(join(tmpdir(), 'resource-graph-git-'))
  execFileSync('git', ['init', '-q'], { cwd: root })
  const hook = join(root, '.git', 'hooks', 'post-merge')
  writeFileSync(hook, '#!/bin/sh\necho existing\n')
  installHooks(root); installHooks(root)
  const content = readFileSync(hook, 'utf8')
  assert.match(content, /echo existing/)
  assert.equal(content.match(/# >>> dsh-resource-map >>>/g).length, 1)
  assert.match(content, /grep -q "\^\\\.resource-map\//)
  assert.match(content, /resource-graph\.mjs index/)
  // The hook runs the project's own bundled CLI, not a path inside the plugin repo.
  assert.match(content, /node \.resource-map\/tools\/resource-graph\.mjs index --root \./)
  // An upgrade replaces the previous release's block instead of stacking a second one.
  writeFileSync(hook, '#!/bin/sh\necho existing\n# >>> dsh-resource-graph >>>\nnode old.mjs index\n# <<< dsh-resource-graph <<<\n')
  installHooks(root)
  const migrated = readFileSync(hook, 'utf8')
  assert.equal(migrated.includes('dsh-resource-graph'), false)
  assert.equal(migrated.match(/# >>> dsh-resource-map >>>/g).length, 1)
  assert.match(migrated, /echo existing/)
})

test('built client bundle uses DSH ModuleLoader protocol', () => {
  const path = join(import.meta.dirname, '..', 'lib', 'client.js')
  if (!existsSync(path)) return
  const text = readFileSync(path, 'utf8')
  assert.match(text, /window\.__ModuleLoader__\.load/)
  assert.doesNotMatch(text, /^import /m)
})
