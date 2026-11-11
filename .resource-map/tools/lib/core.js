import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { parseFrontmatter } from './frontmatter.js'
import { KIND_DESIGN_SKILL, MAINTENANCE_SKILL, OKF_MANAGED_FILES, PUBLIC_CORE_SKILLS, PUBLIC_METHOD_REFERENCES, RESOURCE_SKILL_TEMPLATES } from './resource-skill-templates.js'

export const MAP_DIRECTORY = '.resource-map'
export const INDEX_RELATIVE_PATH = '.resource-map/graph.sqlite'
export const CONFIG_RELATIVE_PATH = '.resource-map/config.json'
export const PLUGIN_BIN_DIRECTORY = '.resource-map/tools'
export const PLUGIN_BIN_RELATIVE_PATH = '.resource-map/tools/resource-graph.mjs'
export const PLUGIN_LIB_DIRECTORY = '.resource-map/tools/lib'
export const PLUGIN_USAGE_RELATIVE_PATH = '.resource-map/tools/README.md'
const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const DEFAULT_ENVIRONMENTS = ['prod', 'test', 'staging', 'dev', 'shared', 'unknown']
const DEFAULT_STATUSES = ['draft', 'active', 'deprecated', 'inactive', 'unknown']
const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const RELATION_RE = /^\s*-\s*([a-z][a-z0-9_]*)\s*:\s*\[\[([^\]]+)\]\]\s*$/gm
const WIKILINK_RE = /\[\[([^\]]+)\]\]/g
const BLOCK_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function parseWikilink(value) {
  const [destination, ...aliasParts] = String(value || '').split('|')
  const hash = destination.indexOf('#'); const target = (hash < 0 ? destination : destination.slice(0, hash)).trim(); const rawAnchor = hash < 0 ? '' : destination.slice(hash + 1).trim()
  return { target, anchor: rawAnchor || null, alias: aliasParts.length ? aliasParts.join('|').trim() || null : null }
}

function headingKey(value) { return String(value || '').replace(/[*_`]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase() }

function documentAnchors(body) {
  const headings = new Set(); const blocks = new Set(); const duplicates = []
  for (const line of body.split(/\r?\n/)) {
    const heading = /^#{1,6}\s+(.+?)\s*$/.exec(line); if (heading) { const key = headingKey(heading[1]); if (headings.has(key)) duplicates.push(`#${heading[1]}`); headings.add(key) }
    const block = /(?:^|\s)\^([a-z0-9]+(?:-[a-z0-9]+)*)\s*$/.exec(line); if (block) { if (blocks.has(block[1])) duplicates.push(`#^${block[1]}`); blocks.add(block[1]) }
  }
  return { headings, blocks, duplicates }
}

const normalizePath = (path) => path.split(sep).join('/')
const hash = (text) => createHash('sha256').update(text).digest('hex')

function scalar(value) {
  const text = value.trim()
  if (text === '[]') return []
  if (text === '{}') return {}
  if (text === 'true') return true
  if (text === 'false') return false
  if (text === 'null' || text === '~') return null
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return Number(text)
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) return text.slice(1, -1)
  return text
}

export function parseSimpleYaml(text) {
  const root = {}
  const stack = [{ indent: -1, value: root }]
  const lines = text.split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index]
    if (!raw.trim() || raw.trimStart().startsWith('#')) continue
    const indent = raw.length - raw.trimStart().length
    const line = raw.trim()
    const listLine = line.startsWith('- ')
    while (stack.length > 1 && (indent < stack.at(-1).indent || (indent === stack.at(-1).indent && !(listLine && Array.isArray(stack.at(-1).value))))) stack.pop()
    const parent = stack.at(-1).value
    if (line.startsWith('- ')) {
      if (!Array.isArray(parent)) throw new Error(`list item without list parent: ${line}`)
      const item = line.slice(2).trim()
      const mapping = /^([^:]+):(.*)$/.exec(item)
      if (mapping) { const value = { [mapping[1].trim()]: scalar(mapping[2].trim()) }; parent.push(value); stack.push({ indent, value }) }
      else parent.push(scalar(item))
      continue
    }
    const match = /^([^:]+):(.*)$/.exec(line)
    if (!match) continue
    const key = match[1].trim(); const rest = match[2].trim()
    if (rest) { parent[key] = scalar(rest); continue }
    let next = lines[index + 1]
    for (let lookahead = index + 1; lookahead < lines.length; lookahead += 1) if (lines[lookahead].trim() && !lines[lookahead].trimStart().startsWith('#')) { next = lines[lookahead]; break }
    const value = next && next.trimStart().startsWith('- ') ? [] : {}
    parent[key] = value; stack.push({ indent, value })
  }
  return root
}

function mapRoot(projectRoot) { return join(resolve(projectRoot), MAP_DIRECTORY) }
function resourcesRoot(projectRoot) { return join(mapRoot(projectRoot), 'resources') }

function syncManagedSkills(projectRoot) {
  const map = mapRoot(projectRoot); mkdirSync(join(map, 'skills', 'resource-map-maintenance'), { recursive: true }); writeFileSync(join(map, 'skills', 'resource-map-maintenance', 'SKILL.md'), MAINTENANCE_SKILL)
  mkdirSync(join(map, 'skills', 'resource-kind-design'), { recursive: true }); writeFileSync(join(map, 'skills', 'resource-kind-design', 'SKILL.md'), KIND_DESIGN_SKILL)
  for (const [id, content] of Object.entries(PUBLIC_CORE_SKILLS)) { mkdirSync(join(map, 'skills', id), { recursive: true }); writeFileSync(join(map, 'skills', id, 'SKILL.md'), content) }
  for (const [name, content] of Object.entries(PUBLIC_METHOD_REFERENCES)) { const target = join(map, 'skills', 'resource-map-maintenance', 'references', name); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, content) }
  for (const [relativePath, content] of Object.entries(RESOURCE_SKILL_TEMPLATES)) { const target = join(map, relativePath); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, content) }
  for (const [relativePath, content] of Object.entries(OKF_MANAGED_FILES)) { const target = join(map, relativePath); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, content) }
}

export function readConfig(projectRoot) {
  const path = join(resolve(projectRoot), CONFIG_RELATIVE_PATH)
  if (!existsSync(path)) return { version: 1, environments: DEFAULT_ENVIRONMENTS, statuses: DEFAULT_STATUSES, kinds: [] }
  const value = JSON.parse(readFileSync(path, 'utf8'))
  return {
    version: value.version || 1,
    environments: Array.isArray(value.environments) ? value.environments : DEFAULT_ENVIRONMENTS,
    statuses: Array.isArray(value.statuses) ? value.statuses : DEFAULT_STATUSES,
    kinds: Array.isArray(value.kinds) ? value.kinds : [],
  }
}

export function parseOkf(path, projectRoot) {
  const text = readFileSync(path, 'utf8')
  if (!text.startsWith('---\n')) throw new Error('YAML frontmatter is required')
  const end = text.indexOf('\n---\n', 4)
  if (end < 0) throw new Error('unterminated YAML frontmatter')
  const frontmatter = parseFrontmatter(text.slice(4, end)); const body = text.slice(end + 5)
  const data = frontmatter.resource
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error("frontmatter.resource must be a YAML mapping; replace flat fields such as 'resource: novel' and top-level 'id:' with:\nresource:\n  kind: novel\n  id: example-id\n  name: Human-readable name\n  environment: unknown\n  status: active\n  owners: []\nKeep top-level title and tags outside resource, then run resource_graph_check again")
  const id = data.id; const kind = data.kind
  if ('timelines' in data) throw new Error('resource.timelines is not supported; create a kind: timeline resource and use attributed relationship edges')
  const graphSection = /(?:^|\n)##\s+图引用\s*\n([\s\S]*?)(?=\n##\s|$)/.exec(body)?.[1] || ''
  const malformedRelations = graphSection.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.startsWith('- ') && !/^-[ ]+[a-z][a-z0-9_]*\s*:\s*\[\[[^\]]+\]\]\s*$/.test(line))
  const anchors = documentAnchors(body)
  const explicit = []
  for (const match of body.matchAll(RELATION_RE)) { const link = parseWikilink(match[2]); explicit.push({ relation: match[1], target: link.target, anchor: link.anchor, alias: link.alias }) }
  if (Array.isArray(data.relationships)) for (const edge of data.relationships) if (edge && typeof edge === 'object') explicit.push({ relation: edge.relation, target: edge.target, anchor: edge.anchor || null, alias: edge.alias || null, attributes: edge.attributes && typeof edge.attributes === 'object' && !Array.isArray(edge.attributes) ? edge.attributes : {} })
  const explicitTargets = new Set(explicit.map((edge) => edge.target))
  const links = [...body.matchAll(WIKILINK_RE)].map((match) => { const link = parseWikilink(match[1]); return { ...link, target: link.target || id } })
  const relations = [...explicit, ...links.filter((link) => link.target !== id && !explicitTargets.has(link.target)).map((link) => ({ relation: 'links_to', target: link.target, anchor: link.anchor, alias: link.alias }))]
  return {
    id, kind, environment: data.environment || 'unknown', status: data.status || 'active',
    name: data.name, title: frontmatter.title || data.name, description: data.description || firstParagraph(body),
    owners: Array.isArray(data.owners) ? data.owners : [], tags: Array.isArray(frontmatter.tags) ? frontmatter.tags : [],
    path: normalizePath(relative(resolve(projectRoot), path)), body, resource: data, anchors, malformedRelations, relations, links,
  }
}

function firstParagraph(markdown) {
  const lines = []
  for (const line of markdown.split(/\r?\n/)) { const value = line.trim(); if (!value && lines.length) break; if (value && !value.startsWith('#') && !value.startsWith('- ')) lines.push(value) }
  return lines.join(' ')
}

function walk(directory, output) {
  if (!existsSync(directory)) return
  for (const entry of readdirSync(directory, { withFileTypes: true })) { const path = join(directory, entry.name); if (entry.isDirectory()) walk(path, output); else if (entry.name === 'index.md') output.push(path) }
}

function sourceFiles(projectRoot) { const out = []; walk(resourcesRoot(projectRoot), out); return out.sort() }
export function discoverResources(projectRoot) { return sourceFiles(projectRoot).map((path) => ({ path, record: parseOkf(path, projectRoot) })) }

function envFileValues(text) { return Object.fromEntries(String(text).split(/\r?\n/).map((line) => /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim())).filter(Boolean).map((match) => [match[1], match[2].replace(/^['"]|['"]$/g, '')])) }

function validateRecord(record, config, seen, errors, warnings, projectRoot) {
  if (!record.id || !ID_RE.test(record.id)) errors.push(`${record.path}: node id must be lowercase kebab-case`)
  else if (seen.has(record.id)) errors.push(`${record.path}: duplicate resource.id ${record.id} (first: ${seen.get(record.id)})`)
  else seen.set(record.id, record.path)
  if (!record.kind || !ID_RE.test(record.kind)) errors.push(`${record.path}: node.kind must be lowercase kebab-case`)
  if (['binding', 'chapter-resource'].includes(record.kind)) errors.push(`${record.path}: kind ${record.kind} is forbidden; keep chapter text once and attach evidence-backed semantic edges directly`)
  if (!record.title || typeof record.title !== 'string') errors.push(`${record.path}: resource.name or top-level title is required`)
  for (const line of record.malformedRelations) errors.push(`${record.path}: malformed graph relation ${line}; expected - relation: [[target-id#anchor|alias]]`)
  for (const anchor of record.anchors.duplicates) errors.push(`${record.path}: duplicate document anchor ${anchor}`)
  for (const [index, edge] of record.relations.entries()) {
    if (!edge.relation || !/^[a-z][a-z0-9_]*$/.test(edge.relation)) errors.push(`${record.path}: relationship[${index}].relation must be lowercase snake_case`)
    if (!edge.target || !ID_RE.test(edge.target)) errors.push(`${record.path}: relationship[${index}].target must be lowercase kebab-case`)
    if (edge.attributes && JSON.stringify(edge.attributes).length > 8000) errors.push(`${record.path}: relationship[${index}].attributes is too large`)
  }
  if (config.kinds.length && !config.kinds.includes(record.kind)) errors.push(`${record.path}: node kind ${record.kind} is not allowed by .resource-map/config.json`)
  if (!config.environments.includes(record.environment)) errors.push(`${record.path}: invalid environment ${record.environment}`)
  if (!config.statuses.includes(record.status)) warnings.push(`${record.path}: uncommon status ${record.status}`)
  const unitRoot = dirname(join(resolve(projectRoot), record.path)); const envPath = join(unitRoot, 'scripts', '.env'); const envExample = join(unitRoot, 'scripts', '.env.example')
  if (existsSync(envExample)) errors.push(`${record.path}: .env.example is forbidden; use the resource scripts/.env entry`)
  if (existsSync(envPath)) {
    const values = envFileValues(readFileSync(envPath, 'utf8')); for (const [key, expected] of Object.entries({ RESOURCE_ID: record.id, RESOURCE_KIND: record.kind, ENVIRONMENT: record.environment })) if (values[key] !== expected) errors.push(`${record.path}: scripts/.env ${key} must equal ${expected}`)
    const entryText = Object.entries(values).filter(([key]) => !['RESOURCE_ID', 'RESOURCE_KIND', 'ENVIRONMENT'].includes(key)).map(([, value]) => value).join('\n'); if (/(?:localhost|127\.0\.0\.1|::1|0\.0\.0\.0|host\.docker\.internal|docker\.sock|npipe:)/i.test(entryText)) errors.push(`${record.path}: scripts/.env contains a forbidden local-machine entrypoint`)
  }
}

export function validateResources(projectRoot) {
  const errors = []; const warnings = []; const records = []; const seen = new Map(); const config = readConfig(projectRoot)
  for (const path of sourceFiles(projectRoot)) {
    try { const record = parseOkf(path, projectRoot); records.push(record); validateRecord(record, config, seen, errors, warnings, projectRoot) }
    catch (error) { errors.push(`${normalizePath(relative(resolve(projectRoot), path))}: ${error.message}`) }
  }
  const byId = new Map(records.map((record) => [record.id, record])); const ids = new Set(byId.keys())
  const validateAnchor = (record, relation, link) => { if (!link.anchor) return; const target = byId.get(link.target); if (!target) return; if (link.anchor.startsWith('^')) { const block = link.anchor.slice(1); if (!BLOCK_ID_RE.test(block) || !target.anchors.blocks.has(block)) errors.push(`${record.path}: ${relation} references unknown block [[${link.target}#${link.anchor}]]`) } else if (!target.anchors.headings.has(headingKey(link.anchor))) errors.push(`${record.path}: ${relation} references unknown heading [[${link.target}#${link.anchor}]]`) }
  for (const record of records) {
    for (const link of record.links.filter((link) => link.target === record.id)) validateAnchor(record, 'links_to', link)
    for (const edge of record.relations) {
    if (!ids.has(edge.target)) { errors.push(`${record.path}: ${edge.relation} references unknown resource ${edge.target}`); continue }
    validateAnchor(record, edge.relation, edge)
    const targetRecord = byId.get(edge.target); const attrs = edge.attributes || {}
    if (['entity', 'event', 'action'].includes(record.kind) && ['evidenced_by', 'occurs_in'].includes(edge.relation) && !edge.anchor) warnings.push(`${record.path}: ${record.kind} edge ${edge.relation} -> ${edge.target} has no stable evidence anchor`)
    if (targetRecord?.kind === 'timeline' && record.kind !== 'timeline' && (attrs.start != null || attrs.end != null)) {
      if (attrs.start == null || attrs.end == null) errors.push(`${record.path}: timeline membership edge ${edge.relation} -> ${edge.target} requires both attributes.start and attributes.end`)
      if (!attrs.label) errors.push(`${record.path}: timeline membership edge ${edge.relation} -> ${edge.target} requires attributes.label`)
      if (!attrs.precision) errors.push(`${record.path}: timeline membership edge ${edge.relation} -> ${edge.target} requires attributes.precision`)
      if (!attrs.certainty) errors.push(`${record.path}: timeline membership edge ${edge.relation} -> ${edge.target} requires attributes.certainty`)
    }
    if (record.kind === 'timeline' && targetRecord?.kind === 'timeline' && edge.relation === 'aligned_with') {
      for (const field of ['source_start', 'source_end', 'target_start', 'target_end', 'certainty']) if (attrs[field] == null) errors.push(`${record.path}: aligned_with -> ${edge.target} requires attributes.${field}`)
    }
    }
  }
  return { ok: errors.length === 0, configured: existsSync(mapRoot(projectRoot)), records, errors, warnings }
}

function createSchema(db) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS source_state (path TEXT PRIMARY KEY, digest TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS nodes (id TEXT PRIMARY KEY, kind TEXT NOT NULL, environment TEXT NOT NULL, status TEXT NOT NULL, title TEXT NOT NULL, path TEXT NOT NULL UNIQUE, description TEXT NOT NULL, text TEXT NOT NULL, owners TEXT NOT NULL DEFAULT '[]', tags TEXT NOT NULL DEFAULT '[]');
    CREATE TABLE IF NOT EXISTS edges (source TEXT NOT NULL, relation TEXT NOT NULL, target TEXT NOT NULL, attributes TEXT NOT NULL DEFAULT '{}', PRIMARY KEY (source, relation, target));
    CREATE VIRTUAL TABLE IF NOT EXISTS node_fts USING fts5(id UNINDEXED, title, description, text, tokenize = 'trigram');
    CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source); CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target); CREATE INDEX IF NOT EXISTS idx_nodes_kind_env ON nodes(kind, environment);
  `)
  // CREATE VIRTUAL TABLE IF NOT EXISTS is a no-op for an existing table, so a
  // database built with the old unicode61 tokenizer would keep it forever.
  // unicode61 treats a whole Chinese sentence as one token, which makes every
  // CJK substring query miss; drop the stale table so it is rebuilt as trigram.
  const ftsSql = db.prepare("SELECT sql FROM sqlite_master WHERE name = 'node_fts'").get()?.sql || ''
  if (ftsSql && !/tokenize\s*=\s*['"]trigram['"]/.test(ftsSql)) {
    db.exec('DROP TABLE IF EXISTS node_fts')
    db.exec("CREATE VIRTUAL TABLE node_fts USING fts5(id UNINDEXED, title, description, text, tokenize = 'trigram')")
  }
  const edgeColumns = db.prepare('PRAGMA table_info(edges)').all().map((column) => column.name)
  if (!edgeColumns.includes('attributes')) { db.exec('ALTER TABLE edges ADD COLUMN attributes TEXT NOT NULL DEFAULT \'{}\'') }
  db.exec('DROP TABLE IF EXISTS timeline_entries')
}

function readIndexState(indexPath) {
  if (!existsSync(indexPath)) return { files: {}, configDigest: '', schemaCurrent: false }
  const db = new DatabaseSync(indexPath, { readOnly: true })
  try {
    const files = Object.fromEntries(db.prepare('SELECT path, digest FROM source_state').all().map((row) => [row.path, row.digest]))
    const config = db.prepare("SELECT value FROM meta WHERE key = 'config_digest'").get()
    const edgeColumns = db.prepare('PRAGMA table_info(edges)').all().map((column) => column.name)
    return { files, configDigest: config?.value || '', schemaCurrent: edgeColumns.includes('attributes') }
  } catch { return { files: {}, configDigest: '', schemaCurrent: false } } finally { db.close() }
}

export function rebuildIndex(projectRoot, indexPath = join(resolve(projectRoot), INDEX_RELATIVE_PATH)) {
  const root = resolve(projectRoot); const map = mapRoot(root)
  if (!existsSync(map)) return { ok: true, configured: false, records: [], errors: [], warnings: [], nodes: 0, edges: 0, changed: 0, removed: 0, indexPath: INDEX_RELATIVE_PATH }
  mkdirSync(map, { recursive: true }); syncManagedSkills(root)
  const files = sourceFiles(root)
  const hashes = Object.fromEntries(files.map((path) => [normalizePath(relative(root, path)), hash(readFileSync(path))]))
  const prior = readIndexState(indexPath)
  const configPath = join(root, CONFIG_RELATIVE_PATH)
  const configDigest = hash(`${existsSync(configPath) ? readFileSync(configPath, 'utf8') : 'default-config-v1'}\nresource-context-units-v1\nattributed-edges-v2-evidence`)
  const changedPaths = files.filter((path) => prior.files[normalizePath(relative(root, path))] !== hashes[normalizePath(relative(root, path))])
  const removedPaths = Object.keys(prior.files).filter((path) => !(path in hashes))
  const fresh = !existsSync(indexPath)
  const rulesChanged = prior.configDigest !== configDigest || !prior.schemaCurrent
  const pathsToParse = fresh || rulesChanged ? files : changedPaths
  const validation = validateResources(root); const changedRecords = []; const errors = [...validation.errors]; const warnings = [...validation.warnings]
  if (!errors.length) for (const path of pathsToParse) {
    try { changedRecords.push(parseOkf(path, root)) }
    catch (error) { errors.push(`${normalizePath(relative(root, path))}: ${error.message}`) }
  }
  if (errors.length) return { ok: false, configured: true, records: changedRecords, errors, warnings, nodes: 0, edges: 0, changed: pathsToParse.length, removed: removedPaths.length, indexPath: INDEX_RELATIVE_PATH }
  mkdirSync(dirname(indexPath), { recursive: true })
  const db = new DatabaseSync(indexPath)
  try {
    createSchema(db); db.exec('BEGIN')
    if (fresh || rulesChanged) db.exec('DELETE FROM edges; DELETE FROM node_fts; DELETE FROM nodes; DELETE FROM meta; DELETE FROM source_state;')
    const deleteByPath = db.prepare('DELETE FROM nodes WHERE path = ?')
    const deleteEdges = db.prepare('DELETE FROM edges WHERE source = ? OR target = ?')
    const deleteFts = db.prepare('DELETE FROM node_fts WHERE id = ?')
    for (const path of removedPaths) {
      const row = db.prepare('SELECT id FROM nodes WHERE path = ?').get(path)
      if (row) { deleteEdges.run(row.id, row.id); deleteFts.run(row.id) }
      deleteByPath.run(path)
    }
    for (const record of changedRecords) {
      const row = db.prepare('SELECT id FROM nodes WHERE path = ?').get(record.path)
      if (row) {
        db.prepare('DELETE FROM edges WHERE source = ?').run(row.id)
        if (row.id !== record.id) db.prepare('DELETE FROM edges WHERE target = ?').run(row.id)
        deleteFts.run(row.id)
      }
      deleteByPath.run(record.path)
    }
    const ownedPaths = new Set(Object.keys(hashes)); const unownedRows = db.prepare('SELECT id, path FROM nodes').all().filter((row) => !ownedPaths.has(row.path))
    for (const row of unownedRows) { deleteEdges.run(row.id, row.id); deleteFts.run(row.id); deleteByPath.run(row.path) }
    const insertNode = db.prepare('INSERT INTO nodes(id, kind, environment, status, title, path, description, text, owners, tags) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    const insertEdge = db.prepare('INSERT OR REPLACE INTO edges(source, relation, target, attributes) VALUES (?, ?, ?, ?)')
    const insertFts = db.prepare('INSERT INTO node_fts(id, title, description, text) VALUES (?, ?, ?, ?)')
    for (const record of changedRecords) {
      const searchText = [record.id, record.title, record.kind, record.environment, record.description, record.body].join('\n')
      insertNode.run(record.id, record.kind, record.environment, record.status, record.title, record.path, record.description, record.body, JSON.stringify(record.owners), JSON.stringify(record.tags))
      insertFts.run(record.id, record.title, record.description, searchText)
      for (const edge of record.relations) insertEdge.run(record.id, edge.relation, edge.target, JSON.stringify({ ...(edge.attributes || {}), ...(edge.anchor ? { evidence_anchor: edge.anchor } : {}), ...(edge.alias ? { evidence_alias: edge.alias } : {}) }))
    }
    const duplicates = db.prepare('SELECT id, COUNT(*) count FROM nodes GROUP BY id HAVING count > 1').all()
    const unknown = db.prepare('SELECT e.source, e.relation, e.target FROM edges e LEFT JOIN nodes n ON n.id=e.target WHERE n.id IS NULL').all()
    if (duplicates.length || unknown.length) throw new Error([...duplicates.map((row) => `duplicate resource.id ${row.id}`), ...unknown.map((edge) => `${edge.source}: ${edge.relation} references unknown resource ${edge.target}`)].join('\n'))
    const nodes = Number(db.prepare('SELECT COUNT(*) count FROM nodes').get().count)
    const edges = Number(db.prepare('SELECT COUNT(*) count FROM edges').get().count)
    db.prepare('INSERT OR REPLACE INTO meta VALUES (?, ?)').run('schema', 'dsh-resource-map-project-v1')
    db.prepare('INSERT OR REPLACE INTO meta VALUES (?, ?)').run('source_digest', hash(JSON.stringify(hashes)))
    db.prepare('INSERT OR REPLACE INTO meta VALUES (?, ?)').run('config_digest', configDigest)
    db.exec('DELETE FROM source_state')
    const setSourceState = db.prepare('INSERT INTO source_state(path, digest) VALUES (?, ?)')
    for (const [path, digest] of Object.entries(hashes)) setSourceState.run(path, digest)
    db.exec('COMMIT')
    return { ok: true, configured: true, records: changedRecords, errors, warnings, nodes, edges, changed: pathsToParse.length, removed: removedPaths.length, indexPath: INDEX_RELATIVE_PATH, digest: hash(JSON.stringify(hashes)) }
  } catch (error) {
    try { db.exec('ROLLBACK') } catch {}
    return { ok: false, configured: true, records: changedRecords, errors: [error.message], warnings, nodes: 0, edges: 0, changed: pathsToParse.length, removed: removedPaths.length, indexPath: INDEX_RELATIVE_PATH }
  } finally { db.close() }
}

export function readGraph(projectRoot, options = {}) {
  const root = resolve(projectRoot)
  if (!existsSync(mapRoot(root))) return { schema: 'dsh-resource-map-project-v1', configured: false, nodes: [], edges: [], stats: { nodes: 0, edges: 0 }, generatedFrom: INDEX_RELATIVE_PATH }
  const sync = rebuildIndex(root)
  if (!sync.ok) throw new Error(sync.errors.join('\n'))
  const indexPath = join(root, INDEX_RELATIVE_PATH)
  const db = new DatabaseSync(indexPath, { readOnly: true })
  try {
    const limit = Math.min(Math.max(Number(options.limit) || 500, 1), 2000); const query = String(options.query || '').trim().toLowerCase(); const pattern = `%${query}%`
    const sql = query ? 'SELECT id, kind, environment, status, title, path, description, text, owners, tags FROM nodes WHERE lower(id || char(10) || title || char(10) || kind || char(10) || environment || char(10) || description || char(10) || text) LIKE ? ORDER BY id LIMIT ?' : 'SELECT id, kind, environment, status, title, path, description, text, owners, tags FROM nodes ORDER BY id LIMIT ?'
    const rows = query ? db.prepare(sql).all(pattern, limit) : db.prepare(sql).all(limit)
    const nodes = rows.map((row) => { const { text, ...fields } = row; return { ...fields, markdown: text, owners: JSON.parse(row.owners || '[]'), tags: JSON.parse(row.tags || '[]'), reference: `[[${row.id}]]` } })
    const ids = new Set(nodes.map((node) => node.id)); const edges = db.prepare('SELECT source, relation, target, attributes FROM edges ORDER BY source, relation, target').all().filter((edge) => ids.has(edge.source) && ids.has(edge.target)).map((edge) => ({ ...edge, attributes: JSON.parse(edge.attributes || '{}') }))
    return { schema: 'dsh-resource-map-project-v1', configured: true, nodes, edges, stats: { nodes: nodes.length, edges: edges.length }, generatedFrom: INDEX_RELATIVE_PATH, incremental: { changed: sync.changed, removed: sync.removed } }
  } finally { db.close() }
}

/**
 * Copy the plugin's Node CLI into `.resource-map/plugin/` so the project keeps a
 * working graph tool even outside DSH (plain agent runtimes, CI, plain Node).
 * This is the same implementation the `resource_graph_query` and
 * `resource_graph_check` tools call, so both surfaces stay behaviourally equal.
 */
// The CLI sits beside the package's scripts directory in the published layout and
// beside lib/ when a skill ships the same implementation; accept both.
function cliCandidates() {
  return [join(PACKAGE_ROOT, 'scripts', 'resource-graph.mjs'), join(PACKAGE_ROOT, 'resource-graph.mjs')]
}

// Likewise the implementation sits at the package root in the plugin layout and
// may be beside the CLI when a skill ships the same source tree. Published
// packages prefer the built lib, sources are the fallback.
function implementationCandidates(cliSource) {
  const cliDirectory = dirname(cliSource)
  return [
    join(cliDirectory, 'lib'), join(cliDirectory, 'src'),
    join(dirname(cliDirectory), 'lib'), join(dirname(cliDirectory), 'src'),
    join(PACKAGE_ROOT, 'lib'), join(PACKAGE_ROOT, 'src'),
  ]
}

export function installProjectCli(projectRoot) {
  const root = resolve(projectRoot)
  const target = join(root, PLUGIN_BIN_DIRECTORY)
  mkdirSync(join(target, 'lib'), { recursive: true })
  const cliSource = cliCandidates().find((candidate) => existsSync(candidate))
  if (!cliSource) throw new Error('the bundled resource-graph CLI is missing from this installation')
  const libDirectory = implementationCandidates(cliSource).find((candidate) => existsSync(candidate))
  if (!libDirectory) throw new Error('the bundled resource-graph library is missing from this installation')
  for (const file of ['frontmatter.js', 'core.js', 'query.js', 'resource-skill-templates.js']) {
    const source = join(libDirectory, file)
    if (!existsSync(source)) continue
    copyFileSync(source, join(target, 'lib', file))
  }
  let cli = readFileSync(cliSource, 'utf8')
  cli = cli.replace(/from '\.\.\/src\/core\.js'/, "from './lib/core.js'")
  writeFileSync(join(target, 'resource-graph.mjs'), cli)
  writeFileSync(join(target, 'README.md'), PLUGIN_CLI_USAGE)
  return { cli: PLUGIN_BIN_RELATIVE_PATH, lib: PLUGIN_LIB_DIRECTORY }
}

const PLUGIN_CLI_USAGE = `# Project graph tool

This directory holds a self-contained copy of the resource-graph CLI for this
project. It is the same Node implementation the DSH plugin exposes as the
\`resource_graph_query\` and \`resource_graph_check\` tools, so the project keeps
identical graph behaviour when it is opened outside DSH (another agent runtime,
CI, or a plain terminal). It has no dependencies and never invokes Python.

## Which entrypoint to use

Pick the first entrypoint that is available in your runtime:

| Runtime | Use |
| --- | --- |
| DSH with the \`dsh-resource-map\` plugin enabled | The \`resource_graph_check\` and \`resource_graph_query\` tools. Prefer the tools; they resolve the project and cache for you. |
| Any other agent, editor, CI, or plain shell | This directory's \`resource-graph.mjs\`. |

The tools and this CLI are the same implementation over the same
\`.resource-map/graph.sqlite\` cache, so either one produces identical results.
Never write that SQLite file by hand, and never add a Python graph builder.

## Invocation

Run from the project root, or pass \`--root\`:

\`\`\`bash
node .resource-map/tools/resource-graph.mjs init --root .
node .resource-map/tools/resource-graph.mjs check --root .
node .resource-map/tools/resource-graph.mjs index --root .
node .resource-map/tools/resource-graph.mjs query --root . --query "checkout"
node .resource-map/tools/resource-graph.mjs hook install --root .
\`\`\`

Requires Node.js 22.5 or newer (it uses \`node:sqlite\`).

## Command and tool mapping

| CLI command | DSH tool | Behaviour |
| --- | --- | --- |
| \`init\` | none (UI **启用资源图**) | Create \`.resource-map\`, its contract, templates, and this tools directory. |
| \`check [--write-index]\` | \`resource_graph_check\` | Validate every record; with \`--write-index\` also refresh the cache incrementally. |
| \`index\` | \`resource_graph_check\` | Incrementally rebuild \`.resource-map/graph.sqlite\`. |
| \`query --query TEXT\` | \`resource_graph_query\` | Return matching nodes with their connected edges. |
| \`hook install\` | none | Install Git hooks gated on \`.resource-map/\` changes. |

Run \`check\` (or \`resource_graph_check\`) after editing any
\`.resource-map/resources/**/index.md\`.

## Refresh

Re-running project initialization refreshes this directory to match the
installed plugin version. Local edits here are overwritten.
`

export function initializeProject(projectRoot) {
  const root = resolve(projectRoot); const map = mapRoot(root)
  mkdirSync(join(map, 'resources'), { recursive: true })
  mkdirSync(join(map, 'skills'), { recursive: true })
  mkdirSync(join(map, 'runbooks'), { recursive: true })
  syncManagedSkills(root)
  const cli = installProjectCli(root)
  const configPath = join(root, CONFIG_RELATIVE_PATH)
  if (!existsSync(configPath)) writeFileSync(configPath, `${JSON.stringify({ version: 1, kinds: [], environments: DEFAULT_ENVIRONMENTS, statuses: DEFAULT_STATUSES }, null, 2)}\n`)
  const ignorePath = join(map, '.gitignore')
  const required = ['/graph.sqlite', '/graph.sqlite-wal', '/graph.sqlite-shm']
  const existing = existsSync(ignorePath) ? readFileSync(ignorePath, 'utf8').split(/\r?\n/).filter(Boolean) : []
  const lines = [...existing, ...required.filter((line) => !existing.includes(line))]
  writeFileSync(ignorePath, `${lines.join('\n')}\n`)
  return { map: MAP_DIRECTORY, config: CONFIG_RELATIVE_PATH, gitignore: `${MAP_DIRECTORY}/.gitignore`, cli: cli.cli, cliUsage: PLUGIN_USAGE_RELATIVE_PATH }
}

export function installHooks(root) {
  let gitDir
  try { gitDir = resolve(root, execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: root, encoding: 'utf8' }).trim()) } catch { throw new Error('hook install requires a Git repository') }
  const hooks = join(gitDir, 'hooks'); mkdirSync(hooks, { recursive: true })
  const command = 'if git diff-tree --no-commit-id --name-only -r ORIG_HEAD HEAD 2>/dev/null | grep -q "^\\.resource-map/"; then node .resource-map/tools/resource-graph.mjs index --root .; fi'
  const markerStart = '# >>> dsh-resource-map >>>'; const markerEnd = '# <<< dsh-resource-map <<<'
  // The previous release wrote its own markers; strip that block too so an upgrade
  // replaces it instead of leaving a second, stale hook behind.
  const legacyMarkers = [['# >>> dsh-resource-graph >>>', '# <<< dsh-resource-graph <<<']]
  for (const name of ['post-merge', 'post-rewrite']) {
    const path = join(hooks, name)
    const before = existsSync(path) ? readFileSync(path, 'utf8') : '#!/bin/sh\n'
    let stripped = before
    for (const [start, end] of [[markerStart, markerEnd], ...legacyMarkers]) stripped = stripped.replace(new RegExp(`${start}[\\s\\S]*?${end}\\n?`, 'g'), '')
    writeFileSync(path, `${stripped.trimEnd()}\n${markerStart}\n${command}\n${markerEnd}\n`, { mode: 0o755 })
  }
  return { hooks: ['post-merge', 'post-rewrite'], command }
}
