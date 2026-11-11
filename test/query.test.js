import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtempSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import test from 'node:test'
import { queryProjectGraph } from '../src/query.js'

function resource(root, kind, id, relation = '') {
  const dir = join(root, '.resource-map', 'resources', `${kind}s`, 'test', id); mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.md'), `---\ntitle: ${id}\nresource:\n  id: ${id}\n  kind: ${kind}\n  name: ${id}\n  environment: test\n  status: active\n  description: ${id} description\n---\n# ${id}\n\n${id} body\n\n## 图引用\n\n${relation}\n`)
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'resource-query-'))
  resource(root, 'server', 'server-a', '- hosts_service: [[redis-service]]')
  resource(root, 'service', 'redis-service', '- used_by_project: [[project-a]]')
  resource(root, 'project', 'project-a')
  resource(root, 'timeline', 'narrative')
  const path = join(root, '.resource-map', 'resources', 'services', 'test', 'redis-service', 'index.md')
  writeFileSync(path, readFileSync(path, 'utf8').replace('  description: redis-service description\n', '  description: redis-service description\n  relationships:\n    - relation: occurs_on\n      target: narrative\n      attributes:\n        start: 2\n        end: 2\n        label: Redis appears\n        precision: sequence\n        certainty: verified\n'))
  return root
}

test('query modes align with Python graph CLI vocabulary', () => {
  const root = fixture()
  const quick = queryProjectGraph(root, { mode: 'quick', query: 'redis' }); assert.equal(quick.results[0].id, 'redis-service'); assert.equal(quick.graph.nodes.length, 4); assert.equal(quick.graph.edges.length, 3)
  assert.equal(queryProjectGraph(root, { mode: 'search', query: 'project', kind: 'project', with_relations: true }).results[0].relations.incoming.length, 1)
  assert.equal(queryProjectGraph(root, { mode: 'get', resource_ids: ['server-a'] }).results[0].id, 'server-a')
  assert.equal(queryProjectGraph(root, { mode: 'neighbors', resource_ids: ['server-a'], depth: 2 }).nodes.length, 4)
  assert.equal(queryProjectGraph(root, { mode: 'schema', match: 'service' }).kinds[0].kind, 'service')
  const timeline = queryProjectGraph(root, { mode: 'timeline', timeline_axis: 'narrative', timeline_from: 1, timeline_to: 3 }); assert.equal(timeline.entries[0].source, 'redis-service'); assert.equal(timeline.entries[0].attributes.start, 2); assert.equal(timeline.graph.nodes.some((node) => node.id === 'redis-service'), true)
  assert.equal(queryProjectGraph(root, { mode: 'twohop', start: 'server-a', middle: 'redis', first: 'hosts_service', second: 'used_by_project' }).paths[0].end.id, 'project-a')
  assert.equal(queryProjectGraph(root, { mode: 'who_uses', under: 'server-a', resource: 'redis' }).paths[0].end.id, 'project-a')
  assert.equal(queryProjectGraph(root, { mode: 'sql', sql: 'SELECT id FROM nodes ORDER BY id', limit: 2 }).rows.length, 2)
})

test('invalid resources return actionable query diagnostics', () => {
  const root = fixture(); const path = join(root, '.resource-map', 'resources', 'projects', 'test', 'project-a', 'index.md'); writeFileSync(path, '---\nresource: project\nid: project-a\n---\n# Broken\n')
  const result = queryProjectGraph(root, { mode: 'quick', query: 'project' }); assert.equal(result.ok, false); assert.match(result.errors[0], /resource:\n  kind: novel/); assert.match(result.remediation, /resource_graph_check/); assert.deepEqual(result.graph, { nodes: [], edges: [] })
})

test('sql mode accepts only one read-only SELECT or WITH', () => {
  const root = fixture()
  assert.throws(() => queryProjectGraph(root, { mode: 'sql', sql: 'DELETE FROM nodes' }), /read-only/)
  assert.throws(() => queryProjectGraph(root, { mode: 'sql', sql: 'SELECT * FROM nodes; DROP TABLE nodes' }), /read-only|single statement/)
})

// Regression guards for the FTS/inverted search layer.
// node_fts was previously created and populated on every rebuild but never read,
// so every query fell back to a full-table JS scan.
function cjkFixture() {
  const root = mkdtempSync(join(tmpdir(), 'resource-cjk-'))
  const docs = {
    'cn-prod-db': ['生产环境数据库主从', '生产环境数据库主从集群，承载订单数据。'],
    'cn-cache': ['缓存服务', 'redis 缓存服务，用于会话存储。'],
    'cn-api': ['订单接口', '订单接口服务，依赖生产环境数据库。'],
  }
  for (const [id, [name, description]] of Object.entries(docs)) {
    const dir = join(root, '.resource-map', 'resources', 'datastores', 'prod', id)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'index.md'), `---\nresource:\n  id: ${id}\n  kind: datastore\n  name: ${name}\n  environment: prod\n  status: active\n  description: ${description}\n---\n# ${name}\n\n${description}\n`)
  }
  return root
}

test('node_fts is built with the trigram tokenizer', () => {
  const root = cjkFixture()
  queryProjectGraph(root, { mode: 'quick', query: 'x', limit: 1 })
  const db = new DatabaseSync(join(root, '.resource-map', 'graph.sqlite'), { readOnly: true })
  try {
    const sql = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'node_fts'").get()?.sql || ''
    // unicode61 cannot match CJK substrings at all; trigram is the minimum viable choice.
    assert.match(sql, /trigram/)
    assert.ok(db.prepare('SELECT COUNT(*) c FROM node_fts').get().c > 0, 'node_fts should be populated')
  } finally { db.close() }
})

test('chinese quick search matches the expected nodes', () => {
  const root = cjkFixture()
  const cases = { '数据库': 'cn-prod-db', '缓存': 'cn-cache', '订单': 'cn-api' }
  for (const [query, expected] of Object.entries(cases)) {
    const result = queryProjectGraph(root, { mode: 'quick', query, limit: 5 })
    const ids = (result.results || []).map((item) => item.id)
    assert.ok(ids.includes(expected), `${JSON.stringify(query)} should match ${expected}, got ${ids}`)
  }
})

test('two-character CJK queries fall back to the JS scorer instead of returning nothing', () => {
  // trigram requires three characters, so FTS returns zero rows for these and
  // the candidate filter must not prune the result set to empty.
  const root = cjkFixture()
  for (const query of ['生产', '服务']) {
    const result = queryProjectGraph(root, { mode: 'quick', query, limit: 5 })
    assert.ok((result.results || []).length > 0, `${JSON.stringify(query)} should still match via the JS scorer`)
  }
})

test('repeated chinese search is stable', () => {
  const root = cjkFixture()
  const first = queryProjectGraph(root, { mode: 'quick', query: '数据库', limit: 5 }).results.map((item) => item.id)
  const second = queryProjectGraph(root, { mode: 'quick', query: '数据库', limit: 5 }).results.map((item) => item.id)
  assert.deepEqual(first, second)
})
