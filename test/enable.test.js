import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { apply } from '../lib/index.js'

/** Build a fake Agent whose ctx records tool registrations and prompt sections. */
function agentFixture(id, cwd) {
  const tools = []
  const sections = []
  const agent = {
    id,
    session: { header: { cwd } },
    ctx: {
      effect(fn) { const dispose = fn(); return () => { if (dispose) dispose() } },
      get(name) {
        if (name === 'tools') return { register(definition) { tools.push(definition); return () => { const at = tools.indexOf(definition); if (at >= 0) tools.splice(at, 1) } } }
        if (name === 'systemPrompt') return { section(section) { sections.push(section); return () => { const at = sections.indexOf(section); if (at >= 0) sections.splice(at, 1) } } }
      },
    },
  }
  return { agent, tools, sections }
}

function applyFixture(agents) {
  const routes = new Map()
  const ctx = {
    webServer: { register(definition) { routes.set(definition.path, definition); return () => {} } },
    on() { return () => {} },
    get(name) {
      if (name === 'agents') return { roots() { return agents.map((entry) => entry.agent) }, get(id) { return agents.find((entry) => entry.agent.id === id)?.agent } }
      if (name === 'sessions') return { get(id) { const found = agents.find((entry) => entry.agent.id === id); return found?.agent.session } }
    },
  }
  apply(ctx)
  return { routes, ctx }
}

function projectRoot(withMap) {
  const root = mkdtempSync(join(tmpdir(), 'resource-map-enable-'))
  if (withMap) mkdirSync(join(root, '.resource-map', 'resources'), { recursive: true })
  return root
}

test('a project without .resource-map gets the enable tool only', () => {
  const plain = agentFixture('plain', projectRoot(false))
  applyFixture([plain])
  assert.deepEqual(plain.tools.map((tool) => tool.name), ['resource_map_enable'])
  // Graph tools must not appear before opt-in, and the prompt stays absent.
  assert.equal(plain.sections.length, 0)
})

test('a project with .resource-map gets the graph tools and no enable tool', () => {
  const opted = agentFixture('opted', projectRoot(true))
  applyFixture([opted])
  assert.deepEqual(opted.tools.map((tool) => tool.name).sort(), ['resource_graph_check', 'resource_graph_query'])
  assert.equal(opted.tools.some((tool) => tool.name === 'resource_map_enable'), false)
  assert.equal(opted.sections.length, 1)
  assert.equal(opted.sections[0].name, 'resource-graph:maintenance')
})

test('running the enable tool bootstraps the map and swaps in the graph tools', async () => {
  const root = projectRoot(false)
  const pending = agentFixture('pending', root)
  applyFixture([pending])
  assert.deepEqual(pending.tools.map((tool) => tool.name), ['resource_map_enable'])

  const enable = pending.tools[0]
  const result = await enable.execute({}, { agent: pending.agent })
  assert.equal(result.configured, true)
  assert.equal(result.ok, true)
  assert.equal(existsSync(join(root, '.resource-map')), true)
  assert.equal(existsSync(join(root, '.resource-map', 'resources')), true)
  // The bootstrap CLI is installed so the project works outside DSH too.
  assert.equal(existsSync(join(root, '.resource-map', 'tools', 'resource-graph.mjs')), true)

  // Same session: the enable tool is withdrawn and the graph tools are live.
  assert.deepEqual(pending.tools.map((tool) => tool.name).sort(), ['resource_graph_check', 'resource_graph_query'])
  assert.equal(pending.tools.some((tool) => tool.name === 'resource_map_enable'), false)
  assert.equal(pending.sections.length, 1)

  // The graph tools now work without restarting the session.
  const check = pending.tools.find((tool) => tool.name === 'resource_graph_check')
  const checked = await check.execute({}, { agent: pending.agent })
  assert.equal(checked.ok, true)
})

test('the enable tool is idempotent on an already enabled project', async () => {
  const root = projectRoot(false)
  const entry = agentFixture('twice', root)
  applyFixture([entry])
  await entry.tools[0].execute({}, { agent: entry.agent })
  const graphTool = entry.tools.find((tool) => tool.name === 'resource_graph_check')
  const again = await graphTool.execute({}, { agent: entry.agent })
  assert.equal(again.ok, true)
  assert.equal(existsSync(join(root, '.resource-map', 'resources')), true)
})

test('the graph tools refuse a project that never opted in', async () => {
  const root = projectRoot(true)
  const entry = agentFixture('strict', root)
  applyFixture([entry])
  const query = entry.tools.find((tool) => tool.name === 'resource_graph_query')
  // Simulate a stale registration pointing at a project that lost its map.
  const stale = { agent: { session: { header: { cwd: projectRoot(false) } } } }
  assert.throws(() => query.execute({ mode: 'quick', query: 'x' }, stale), /not enabled|resource_map_enable/)
})

test('every registered tool exposes an object-rooted JSON Schema', () => {
  // Some providers reject a tool whose parameters root is not type object.
  const plain = agentFixture('schema-plain', projectRoot(false))
  const opted = agentFixture('schema-opted', projectRoot(true))
  applyFixture([plain, opted])
  const definitions = [...plain.tools, ...opted.tools]
  assert.ok(definitions.length >= 3)
  for (const definition of definitions) {
    assert.equal(definition.parameters?.type, 'object', `${definition.name} parameters.type`)
    assert.equal(typeof definition.parameters.properties, 'object', `${definition.name} parameters.properties`)
    assert.equal(definition.parameters.additionalProperties, false, `${definition.name} additionalProperties`)
  }
})
