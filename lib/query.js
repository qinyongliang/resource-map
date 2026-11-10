import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { INDEX_RELATIVE_PATH, rebuildIndex } from './core.js'

const clamp = (value, fallback, max = 500) => Math.min(Math.max(Number(value) || fallback, 1), max)
const compact = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '')
const csv = (value) => Array.isArray(value) ? value.map(String) : String(value || '').split(',').map((item) => item.trim()).filter(Boolean)

function node(row, withContent = false, contentChars = 1200) {
  const value = { id: row.id, title: row.title, kind: row.kind, environment: row.environment, status: row.status, path: row.path, description: row.description, reference: `[[${row.id}]]` }
  value.markdown = String(row.text || '')
  if (withContent) value.content = value.markdown.slice(0, clamp(contentChars, 1200, 10000))
  return value
}

function score(row, query) {
  const q = compact(query); if (!q) return 0
  const id = compact(row.id); const title = compact(row.title); const text = compact(`${row.kind} ${row.environment} ${row.description} ${row.text}`)
  let value = 0
  if (id === q) value += 20
  if (id.includes(q)) value += 8
  if (title.includes(q)) value += 6
  if (text.includes(q)) value += 2
  for (const token of String(query).toLowerCase().split(/\s+/).filter(Boolean)) if (`${row.id} ${row.title} ${row.text}`.toLowerCase().includes(token)) value += 1
  return value
}

function allNodes(db) { return db.prepare('SELECT * FROM nodes').all() }
function allEdges(db) { return db.prepare('SELECT source, relation, target, attributes FROM edges').all().map((edge) => ({ ...edge, attributes: JSON.parse(edge.attributes || '{}') })) }
function degreeMap(edges) { const out = new Map(); for (const edge of edges) { out.set(edge.source, (out.get(edge.source) || 0) + 1); out.set(edge.target, (out.get(edge.target) || 0) + 1) } return out }
function matchesDirection(edge, id, direction) { return direction === 'incoming' ? edge.target === id : direction === 'outgoing' ? edge.source === id : edge.source === id || edge.target === id }
function other(edge, id) { return edge.source === id ? edge.target : edge.source }

function searchRows(rows, edges, args) {
  const degrees = degreeMap(edges); const relationship = args.relationship
  const relationIds = relationship ? new Set(edges.filter((edge) => edge.relation === relationship).flatMap((edge) => args.direction === 'incoming' ? [edge.target] : args.direction === 'outgoing' ? [edge.source] : [edge.source, edge.target])) : null
  return rows.map((row) => ({ row, score: score(row, args.query), degree: degrees.get(row.id) || 0 }))
    .filter((item) => (!args.query || item.score > 0) && (!args.kind || item.row.kind === args.kind) && (!args.environment || item.row.environment === args.environment) && (!relationIds || relationIds.has(item.row.id)) && (args.min_degree == null || item.degree >= args.min_degree) && (args.max_degree == null || item.degree <= args.max_degree))
    .sort((a, b) => args.sort_by === 'degree' ? b.degree - a.degree || b.score - a.score : b.score - a.score || b.degree - a.degree)
}

function attachRelations(items, edges, limit, relationship) {
  for (const item of items) {
    const selected = edges.filter((edge) => (!relationship || edge.relation === relationship) && (edge.source === item.id || edge.target === item.id)).slice(0, limit)
    item.relations = { incoming: selected.filter((edge) => edge.target === item.id), outgoing: selected.filter((edge) => edge.source === item.id) }
  }
}

function neighbors(rows, edges, args) {
  const byId = new Map(rows.map((row) => [row.id, row])); const starts = csv(args.resource_ids); const depth = clamp(args.depth, 1, 5)
  const visited = new Set(starts); let frontier = starts
  const selectedEdges = []
  for (let level = 0; level < depth; level += 1) {
    const next = []
    for (const id of frontier) for (const edge of edges) {
      if (args.relationship && edge.relation !== args.relationship) continue
      const incoming = args.incoming === true; const outgoing = args.outgoing === true || !incoming
      if ((!incoming || edge.target !== id) && (!outgoing || edge.source !== id)) continue
      selectedEdges.push(edge); const target = other(edge, id)
      if (!visited.has(target)) { visited.add(target); next.push(target) }
    }
    frontier = next
  }
  return { nodes: [...visited].filter((id) => byId.has(id)).map((id) => node(byId.get(id), args.with_content, args.content_chars)), edges: [...new Map(selectedEdges.map((edge) => [`${edge.source}\0${edge.relation}\0${edge.target}`, edge])).values()] }
}

function twohop(rows, edges, args) {
  const byId = new Map(rows.map((row) => [row.id, row])); const starts = searchRows(rows, edges, { query: args.start, kind: args.start_kind }).slice(0, 20)
  const middleQuery = compact(args.middle); const first = new Set(csv(args.first)); const second = new Set(csv(args.second)); const paths = []
  for (const start of starts) for (const edge1 of edges) {
    if (first.size && !first.has(edge1.relation)) continue
    if (!matchesDirection(edge1, start.row.id, args.first_direction || 'any')) continue
    const middleId = other(edge1, start.row.id); const middle = byId.get(middleId)
    if (!middle || (middleQuery && score(middle, middleQuery) <= 0) || (args.middle_kind && middle.kind !== args.middle_kind)) continue
    for (const edge2 of edges) {
      if (second.size && !second.has(edge2.relation)) continue
      if (!matchesDirection(edge2, middleId, args.second_direction || 'any')) continue
      const end = byId.get(other(edge2, middleId)); if (!end || (args.end_kind && end.kind !== args.end_kind) || (args.environment && end.environment !== args.environment)) continue
      paths.push({ start: node(start.row), first: edge1, middle: node(middle), second: edge2, end: node(end, true, args.content_chars || 500) })
      if (paths.length >= clamp(args.limit, 10, 100)) return paths
    }
  }
  return paths
}

function subgraph(rows, edges, ids) {
  const selected = new Set(ids)
  const relatedEdges = edges.filter((edge) => selected.has(edge.source) || selected.has(edge.target))
  for (const edge of relatedEdges) { selected.add(edge.source); selected.add(edge.target) }
  return { nodes: rows.filter((row) => selected.has(row.id)).map((row) => node(row)), edges: relatedEdges }
}

function querySql(db, query, limit) {
  const sql = String(query || '').trim()
  if (!/^(select|with)\b/i.test(sql) || /\b(insert|update|delete|drop|alter|create|replace|attach|detach|pragma|vacuum)\b/i.test(sql)) throw new Error('sql mode allows one read-only SELECT/WITH statement')
  if (sql.includes(';')) throw new Error('sql mode accepts a single statement without semicolons')
  return db.prepare(`SELECT * FROM (${sql}) LIMIT ?`).all(clamp(limit, 100, 1000))
}

export function queryProjectGraph(root, args = {}) {
  const sync = rebuildIndex(root)
  if (!sync.configured) return { mode: args.mode || 'quick', configured: false, project: root, results: [] }
  if (!sync.ok) return { mode: args.mode || 'quick', configured: true, ok: false, errors: sync.errors, warnings: sync.warnings, remediation: 'Fix the reported .resource-map/resources/**/index.md files using strict resource mapping, then call resource_graph_check before querying again.', results: [], graph: { nodes: [], edges: [] } }
  const db = new DatabaseSync(join(root, INDEX_RELATIVE_PATH), { readOnly: true })
  try {
    const mode = args.mode || 'quick'; const rows = allNodes(db); const edges = allEdges(db); const limit = clamp(args.limit, mode === 'quick' ? 5 : 10, 500)
    if (mode === 'schema') {
      const match = compact(args.match); const kinds = db.prepare('SELECT kind, environment, COUNT(*) count FROM nodes GROUP BY kind, environment ORDER BY count DESC').all().filter((row) => !match || compact(`${row.kind} ${row.environment}`).includes(match)).slice(0, limit)
      const relations = db.prepare('SELECT relation, COUNT(*) count FROM edges GROUP BY relation ORDER BY count DESC').all().filter((row) => !match || compact(row.relation).includes(match)).slice(0, limit)
      return { mode, configured: true, kinds, relations, samples: rows.slice(0, limit).map((row) => ({ kind: row.kind, id: row.id, title: row.title })) }
    }
    if (mode === 'sql') return { mode, configured: true, rows: querySql(db, args.sql, limit) }
    if (mode === 'timeline') {
      if (!args.timeline_axis) throw new Error('timeline mode requires timeline_axis resource id')
      const axis = rows.find((row) => row.id === args.timeline_axis && row.kind === 'timeline'); if (!axis) throw new Error(`unknown timeline resource ${args.timeline_axis}`)
      const entries = edges.filter((edge) => edge.target === axis.id && edge.attributes && (edge.attributes.start != null || edge.attributes.end != null)).filter((edge) => (args.timeline_from == null || Number(edge.attributes.end ?? edge.attributes.start) >= args.timeline_from) && (args.timeline_to == null || Number(edge.attributes.start ?? edge.attributes.end) <= args.timeline_to)).sort((a, b) => Number(a.attributes.start ?? 0) - Number(b.attributes.start ?? 0)).slice(0, limit)
      return { mode, configured: true, axis: node(axis), entries, graph: subgraph(rows, edges, [axis.id, ...entries.map((entry) => entry.source)]) }
    }
    if (mode === 'get') {
      const ids = new Set(csv(args.resource_ids)); const results = rows.filter((row) => ids.has(row.id)).map((row) => node(row, args.with_content, args.content_chars))
      if (args.with_relations) attachRelations(results, edges, clamp(args.relation_limit, 20, 200), args.relationship)
      return { mode, configured: true, results, graph: subgraph(rows, edges, results.map((item) => item.id)) }
    }
    if (mode === 'neighbors') { const graph = neighbors(rows, edges, args); return { mode, configured: true, ...graph, graph } }
    if (mode === 'twohop') { const paths = twohop(rows, edges, args); return { mode, configured: true, paths, graph: subgraph(rows, edges, paths.flatMap((path) => [path.start.id, path.middle.id, path.end.id])) } }
    if (mode === 'who_uses') {
      const paths = twohop(rows, edges, { start: args.under, middle: args.resource, first: args.first || 'hosts_service,runs_on_server', second: args.second || 'used_by_project,used_by_service,uses_service', middle_kind: args.resource_kind || 'service', end_kind: args.user_kind, environment: args.environment, limit: args.limit || 50, content_chars: args.content_chars || 500 })
      return { mode, configured: true, paths, graph: subgraph(rows, edges, paths.flatMap((path) => [path.start.id, path.middle.id, path.end.id])) }
    }
    const selected = searchRows(rows, edges, args).slice(0, limit).map((item) => ({ ...node(item.row, args.with_content || mode === 'quick', args.content_chars || (mode === 'quick' ? 700 : 1200)), score: item.score, degree: item.degree }))
    if (args.with_relations || mode === 'quick') attachRelations(selected, edges, clamp(args.relation_limit || args.edge_limit, mode === 'quick' ? 5 : 20, 200), args.relationship)
    return { mode, configured: true, results: selected, graph: subgraph(rows, edges, selected.map((item) => item.id)) }
  } finally { db.close() }
}
