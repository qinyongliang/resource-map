import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { mkdtempSync } from 'node:fs'
import { apply, inject } from '../src/index.js'

function rootFixture() {
  const root = mkdtempSync(join(tmpdir(), 'resource-graph-plugin-'))
  const directory = join(root, '.resource-map', 'resources', 'projects', 'test', 'demo-node')
  mkdirSync(directory, { recursive: true })
  writeFileSync(join(directory, 'index.md'), `---\ntitle: Demo node\nresource:\n  kind: project\n  id: demo-node\n  name: Demo node\n  environment: test\n  status: active\n  owners: []\ntags: []\n---\n# Demo node\n\nDemo.\n`)
  return root
}

function agentFixture(id, root) {
  const tools = []; const sections = []; const effects = []
  const agent = { id, session: { header: { cwd: root } }, ctx: {
    get(name) {
      if (name === 'tools') return { register(definition) { tools.push(definition); return () => { const at = tools.indexOf(definition); if (at >= 0) tools.splice(at, 1) } } }
      if (name === 'systemPrompt') return { section(value) { sections.push(value); return () => {} } }
    },
    effect(setup) { effects.push(setup); setup() },
  } }
  return { agent, tools, sections, effects }
}

test('package exports mounted DSH bundle and client metadata', () => {
  const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8'))
  assert.equal(pkg.exports['./package.json'], './package.json'); assert.equal(pkg.dsh.client.platform, 'web'); assert.equal(pkg.exports['./client'], './lib/client.js'); assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
  assert.match(readFileSync(join(import.meta.dirname, '..', 'cordis.patch.yml'), 'utf8'), /id: resource-graph/)
})

test('the host serves the 3D module on its own route', () => {
  const source = readFileSync(join(import.meta.dirname, '..', 'lib', 'index.js'), 'utf8')
  assert.match(source, /const GRAPH3D_PATH = '\/api\/resource-graph\/graph3d\.js'/)
  assert.match(source, /join\(LIB_DIRECTORY, 'graph3d\.js'\)/)
  assert.match(source, /'text\/javascript; charset=utf-8'/)
})

test('package ships resolvable display metadata and an original icon', () => {
  const root = join(import.meta.dirname, '..')
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  // Every declared export must resolve to a real file.
  for (const [subpath, target] of Object.entries(pkg.exports)) {
    if (subpath.includes('*')) continue
    assert.equal(existsSync(join(root, target)), true, `export ${subpath} -> ${target} must exist`)
  }
  assert.equal(pkg.exports['./icon'], './icon.svg')
  assert.equal(pkg.exports['./locale/*.json'], './locale/*.json')
  for (const file of ['locale', 'icon.svg', 'cordis.patch.yml', 'scripts']) assert.equal(pkg.files.includes(file), true, `${file} must ship in package files`)
  // Plugin Manager reads these without activating the plugin.
  for (const locale of ['en', 'zh']) {
    const meta = JSON.parse(readFileSync(join(root, 'locale', `${locale}.json`), 'utf8')).meta
    assert.equal(typeof meta.title, 'string'); assert.ok(meta.title.length > 0)
    assert.equal(typeof meta.description, 'string'); assert.ok(meta.description.length > 0)
  }
  // Icons must be a valid image within the 256 KiB limit.
  const icon = readFileSync(join(root, 'icon.svg'))
  assert.ok(icon.length > 0 && icon.length <= 256 * 1024, 'icon must be within the size limit')
  assert.match(icon.toString('utf8'), /^<svg[\s>]/)
})

test('built client registers beside conversation with workspace props', async () => {
  const registrations = []
  const fakeReact = { createElement() { return null }, useEffect() {}, useMemo(factory) { return factory() }, useRef(value) { return { current: value } }, useState(value) { return [value, () => {}] } }
  const previousWindow = globalThis.window; const previousDocument = globalThis.document
  globalThis.window = { __ModuleLoader__: { load(registration) { registrations.push(registration) } } }
  globalThis.document = { head: { appendChild() {} }, createElement() { return { dataset: {}, remove() {} } } }
  try {
    await import(`../lib/client.js?test=${Date.now()}`)
    assert.equal(registrations[0].id, 'dsh-resource-map')
    const exported = registrations[0].factory((name) => { assert.equal(name, 'react'); return fakeReact })
    const slots = []
    exported.apply({ effect(setup) { setup() }, slots: { inject(_name, setup) { setup() }, register(options, component) { slots.push({ options, component }); return () => {} } } })
    assert.equal(slots[0].options.name, 'conversation.session.header.utilities'); assert.equal(slots[0].options.id, 'resource-graph'); assert.equal(slots[0].options.label, '资源地图')
    assert.equal(slots[1].options.name, 'tool.call.toolview'); assert.equal(slots[1].options.key, 'resource_graph_query')
    assert.equal(slots[2].options.name, 'tool.call.toolview'); assert.equal(slots[2].options.key, 'resource_graph_check'); assert.equal(slots[2].component({ toolName: 'resource_graph_check', block: { kind: 'tool-result', content: [{ type: 'text', text: '{"ok":true}' }] } }), null)
    const emptyResult = { kind: 'tool-result', isError: false, content: [{ type: 'text', text: JSON.stringify({ mode: 'quick', results: [], graph: { nodes: [], edges: [] } }) }] }
    assert.equal(slots[1].component({ toolName: 'resource_graph_query', block: emptyResult }), null); assert.equal(slots[1].component({ toolName: 'resource_graph_check', block: { kind: 'tool-result', content: [] } }), null)
    const clientSource = readFileSync(join(import.meta.dirname, '..', 'src', 'client.js'), 'utf8'); assert.match(clientSource, /titleById\?\.get\(id\)/); assert.match(clientSource, /link\.alias \|\|/); assert.match(clientSource, /GANTT_COLORS/); assert.match(clientSource, /--rg2-gantt-color/); assert.match(clientSource, /color-mix\(in srgb,var\(--rg2-gantt-color\)/); assert.match(clientSource, /requestFullscreen/); assert.match(clientSource, /data-node-id/); assert.match(clientSource, /minimum - distance/); assert.match(clientSource, /layout\.degree/); assert.match(clientSource, /is-quiet/)
  } finally { globalThis.window = previousWindow; globalThis.document = previousDocument }
})

test('tools and maintenance prompt attach only to enabled Agent projects', async () => {
  assert.deepEqual(inject, ['webServer'])
  const enabledRoot = rootFixture(); const disabledRoot = mkdtempSync(join(tmpdir(), 'resource-graph-disabled-')); const brokenRoot = rootFixture()
  writeFileSync(join(brokenRoot, '.resource-map', 'resources', 'projects', 'test', 'demo-node', 'index.md'), '---\nresource: project\nid: demo-node\n---\n# Broken\n')
  const enabled = agentFixture('enabled', enabledRoot); const disabled = agentFixture('disabled', disabledRoot); const broken = agentFixture('broken', brokenRoot)
  let route; let created; const routes = new Map()
  const ctx = {
    webServer: { register(definition) { routes.set(definition.path, definition); route = routes.get('/api/resource-graph'); return () => {} } },
    on(name, listener) { if (name === 'agent/created') created = listener; return () => {} },
    get(name) {
      if (name === 'agents') return { roots() { return [enabled.agent, disabled.agent, broken.agent] }, get(id) { return id === enabled.agent.id ? enabled.agent : id === disabled.agent.id ? disabled.agent : id === broken.agent.id ? broken.agent : undefined } }
      if (name === 'sessions') return { get(id) { const found = id === 'enabled' ? enabled.agent : id === 'disabled' ? disabled.agent : undefined; return found?.session } }
    },
  }
  apply(ctx)
  assert.deepEqual(enabled.tools.map((tool) => tool.name), ['resource_graph_query', 'resource_graph_check']); assert.equal(enabled.sections[0].name, 'resource-graph:maintenance'); assert.match(enabled.sections[0].text, /resource-kind-design\/SKILL\.md/); assert.match(enabled.sections[0].text, /generic binding nodes/); assert.match(enabled.sections[0].text, /okf-resource-contract\.md/); assert.match(enabled.sections[0].text, /minimal-resource\/index\.md/)
  // Without opt-in the project gets only the bootstrap enable tool, never the
  // graph tools or the maintenance prompt.
  assert.deepEqual(disabled.tools.map((tool) => tool.name), ['resource_map_enable']); assert.deepEqual(disabled.sections, []); assert.equal(existsSync(join(disabledRoot, '.resource-map')), false, 'no directory must be created just by attaching')
  assert.deepEqual(broken.tools.map((tool) => tool.name), ['resource_graph_query', 'resource_graph_check']); const brokenCheck = await broken.tools[1].execute({}, { agent: broken.agent }); assert.equal(brokenCheck.ok, false); assert.match(brokenCheck.errors.join('\n'), /frontmatter.resource must be a YAML mapping/); assert.match(brokenCheck.errors.join('\n'), /run resource_graph_check again/)
  const execution = { agent: enabled.agent }
  const value = await enabled.tools[0].execute({ mode: 'quick', query: 'demo' }, execution); assert.equal(value.results[0].reference, '[[demo-node]]')
  assert.throws(() => enabled.tools[0].execute({ mode: 'quick' }, { agent: disabled.agent }), /not enabled/)
  assert.equal(route.path, '/api/resource-graph')
  // The lazy 3D module is served by its own route and is not fetched up front.
  assert.equal(routes.has('/api/resource-graph/graph3d.js'), true)

  const headers = {}; let body = ''; const response = { statusCode: 0, setHeader(key, value) { headers[key] = value }, end(value) { body = value } }
  route.handler({ method: 'POST', url: '/api/resource-graph?sessionId=disabled' }, response)
  assert.equal(response.statusCode, 200); assert.equal(JSON.parse(body).configured, true); assert.equal(existsSync(join(disabledRoot, '.resource-map', 'graph.sqlite')), true)
  assert.deepEqual(disabled.tools.map((tool) => tool.name), ['resource_graph_query', 'resource_graph_check']); assert.equal(disabled.sections.length, 1)

  const laterRoot = rootFixture(); const later = agentFixture('later', laterRoot); created({ agent: later.agent })
  assert.deepEqual(later.tools.map((tool) => tool.name), ['resource_graph_query', 'resource_graph_check'])
})
