import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { initializeProject, MAP_DIRECTORY, readGraph, rebuildIndex } from './core.js'
import { queryProjectGraph } from './query.js'

export const name = 'dsh-resource-map'
export const inject = ['webServer']

function jsonOutput() {
  return { schema: { type: 'object', additionalProperties: true }, render(_args, value) { return [{ type: 'text', text: JSON.stringify(value, null, 2) }] } }
}

function executionRoot(exec) {
  const cwd = exec?.agent?.session?.header?.cwd
  if (!cwd) throw new Error('resource graph requires a current Agent Session cwd')
  if (!existsSync(join(cwd, MAP_DIRECTORY))) throw new Error('resource graph is not enabled for the current Agent project; run resource_map_enable first')
  return cwd
}

function projectContext(ctx, sessionId) {
  if (!sessionId) throw new Error('session_id is required')
  const sessions = ctx.get('sessions')
  if (!sessions) throw new Error('DSH sessions service is unavailable')
  const session = sessions.get(sessionId)
  if (!session) throw new Error(`unknown live DSH session: ${sessionId}`)
  const cwd = session.header.cwd
  if (!cwd) throw new Error(`session ${sessionId} has no project cwd`)
  return { root: cwd, project: { sessionId, path: cwd } }
}

function requestSessionId(request) {
  const url = new URL(request.url || '/api/resource-graph', 'http://dsh.local')
  return url.searchParams.get('sessionId') || ''
}

function send(response, status, value) {
  response.statusCode = status; response.setHeader('content-type', 'application/json; charset=utf-8'); response.setHeader('cache-control', 'no-store'); response.end(JSON.stringify(value))
}

// A model-facing tool parameter set must be a full JSON Schema whose root type
// is object; a bare property map is rejected by some providers.
const queryProperties = {
  mode: { type: 'string', enum: ['quick', 'search', 'get', 'neighbors', 'schema', 'timeline', 'twohop', 'who_uses', 'sql'], description: 'Graph query mode; defaults to quick.' },
  query: { type: 'string', description: 'Fuzzy text for quick/search.' }, limit: { type: 'number', description: 'Result limit.' }, kind: { type: 'string' }, environment: { type: 'string' },
  with_content: { type: 'boolean' }, content_chars: { type: 'number' }, with_relations: { type: 'boolean' }, relation_limit: { type: 'number' }, edge_limit: { type: 'number' },
  relationship: { type: 'string' }, direction: { type: 'string', enum: ['any', 'incoming', 'outgoing'] }, min_degree: { type: 'number' }, max_degree: { type: 'number' }, sort_by: { type: 'string', enum: ['relevance', 'degree'] },
  resource_ids: { type: 'array', items: { type: 'string' }, description: 'Exact ids for get/neighbors.' }, depth: { type: 'number' }, incoming: { type: 'boolean' }, outgoing: { type: 'boolean' },
  match: { type: 'string', description: 'Schema substring filter.' }, timeline_axis: { type: 'string', description: 'Timeline axis for timeline mode.' }, timeline_from: { type: 'number', description: 'Minimum numeric timeline order.' }, timeline_to: { type: 'number', description: 'Maximum numeric timeline order.' }, sql: { type: 'string', description: 'One read-only SELECT/WITH statement for sql mode.' },
  start: { type: 'string' }, middle: { type: 'string' }, first: { type: 'string', description: 'Comma-separated first-hop relations.' }, second: { type: 'string', description: 'Comma-separated second-hop relations.' },
  start_kind: { type: 'string' }, middle_kind: { type: 'string' }, end_kind: { type: 'string' }, first_direction: { type: 'string', enum: ['any', 'incoming', 'outgoing'] }, second_direction: { type: 'string', enum: ['any', 'incoming', 'outgoing'] },
  resource: { type: 'string', description: 'Resource fuzzy query for who_uses.' }, under: { type: 'string', description: 'Hosting server fuzzy query for who_uses.' }, resource_kind: { type: 'string' }, user_kind: { type: 'string' },
}

const querySchema = { type: 'object', properties: queryProperties, additionalProperties: false }

// The graph tools exist only after a project opts in, so the always-available
// enable tool is what bootstraps a fresh project. It is the one tool registered
// for every Agent session regardless of .resource-map state.
function enableDefinition(onEnabled) {
  return {
    name: 'resource_map_enable',
    description: 'Enable the resource map for this Agent project. Creates .resource-map with the OKF contract, templates, public method skills, and the portable CLI, then builds the SQLite index. Idempotent: running it on an already enabled project only refreshes the index.',
    parameters: { type: 'object', properties: { kinds: { type: 'array', items: { type: 'string' }, description: 'Optional resource kinds to pre-declare in config.json.' }, environments: { type: 'array', items: { type: 'string' }, description: 'Optional environment names to pre-declare.' } }, additionalProperties: false },
    output: jsonOutput(),
    execute(args, exec) {
      const cwd = exec?.agent?.session?.header?.cwd
      if (!cwd) return Promise.reject(new Error('resource map enable requires a current Agent Session cwd'))
      const initialized = initializeProject(cwd)
      const indexed = rebuildIndex(cwd)
      // Enabling makes the graph tools meaningful, so register them immediately
      // instead of waiting for a new session.
      if (typeof onEnabled === 'function') onEnabled(exec?.agent)
      return Promise.resolve({ ok: indexed.ok, configured: true, ...initialized, nodes: indexed.nodes, edges: indexed.edges, errors: indexed.errors, warnings: indexed.warnings, schema: 'dsh-resource-map-project-v1' })
    },
    presentCall: () => ({ card: 'generic', title: 'Enable project resource map', kind: 'write' }),
  }
}

function toolDefinitions() {
  return [{
    name: 'resource_graph_query', description: 'Query this Agent project .resource-map using quick/search/get/neighbors/schema/timeline/twohop/who-uses/read-only-sql modes. Project identity is automatic.',
    parameters: querySchema, output: jsonOutput(),
    execute(args, exec) { return Promise.resolve(queryProjectGraph(executionRoot(exec), args)) },
    presentCall: (args) => ({ card: 'generic', title: `Resource graph ${args.mode || 'quick'}`, kind: 'read', rawInput: args.query || args.resource || args.mode || 'quick' }),
  }, {
    name: 'resource_graph_check', description: 'Validate and incrementally ensure this Agent project .resource-map SQLite graph. Takes no parameters.',
    parameters: { type: 'object', properties: {}, additionalProperties: false }, output: jsonOutput(),
    execute(_args, exec) {
      const result = rebuildIndex(executionRoot(exec))
      return Promise.resolve({ ok: result.ok, configured: result.configured, errors: result.errors, warnings: result.warnings, nodes: result.nodes, edges: result.edges, changed: result.changed, removed: result.removed })
    },
    presentCall: () => ({ card: 'generic', title: 'Check current project resource graph', kind: 'read' }),
  }]
}

const PROMPT = `# Project Resource Graph

This project has an enabled .resource-map managed by the DSH resource graph plugin. Use resource_graph_query before broad file searches when locating project resources or relationships, and resource_graph_check after maintaining resource records. If either tool reports validation errors, do not bypass the graph or merely repeat the error: read each reported index.md, repair it to the strict resource mapping shown in the diagnostic, rerun resource_graph_check, and continue the original user task once it succeeds. Indexed facts live only in .resource-map/resources/**/index.md with strict resource frontmatter; never write graph.sqlite directly or invoke Python graph builders. Before creating any resource, read .resource-map/runbooks/okf-resource-contract.md and copy the structure from .resource-map/examples/minimal-resource/index.md; never invent YAML shape or use directory paths as Wikilink targets. Keep each resource as a context unit with scripts/.env, concrete resource-local skill/references/scripts, discoveries, references, and oplog as appropriate. Before handling a kind, read its plugin-managed template under .resource-map/templates/resource-skills/<kind>/ and instantiate/evolve the concrete resource skill. For any unknown domain/kind or unclear node boundary, first follow .resource-map/skills/resource-kind-design/SKILL.md to design a professional method and quality-gated trial. Templates may update automatically; concrete resource skills are practice-owned. Use the public core methods in .resource-map/skills/resource-investigation, source-analysis, metadata-safety, and resource-evolution when applicable; they contain methodology only and must never be populated with real cross-project business facts.

After discovery, source analysis, chapter reading, database analysis, or a failed extraction, perform the evolution closeout in .resource-map/skills/resource-map-maintenance/SKILL.md: replace misleading concrete instructions, record reusable workflow in the resource skill, uncertainty in discoveries, and operations in oplog. For narrative work, read complete chapters in a small quality-gated batch, preserve chapter text once, use stable Obsidian block IDs as evidence, and admit only justified novel/volume/chapter/entity/event/action/timeline nodes. Never create chapter-resource copies, generic binding nodes, one node per keyword, or co-occurrence-only edges. Run resource_graph_check and inspect isolation, kind explosion and semantic connectivity before scaling. The tools and the bundled CLI are one implementation over one graph.sqlite cache; they must never diverge. When the DSH tools are unavailable (a runtime without this plugin, a plain shell, or CI), run the identical bundled CLI at .resource-map/tools/resource-graph.mjs with the check, index, query, or hook install subcommand; check maps to resource_graph_check and query maps to resource_graph_query, and both surfaces share one graph.sqlite cache, so they must never diverge. Prefer the tool whenever it is present.`

const LIB_DIRECTORY = dirname(fileURLToPath(import.meta.url))
const GRAPH3D_PATH = '/api/resource-graph/graph3d.js'

// The 3D star map is fetched only when a user first switches the view, so the
// default 2D graph never loads it. The module is read once and served from memory.
let graph3dSource = null
function graph3dModule() {
  if (graph3dSource === null) {
    const file = join(LIB_DIRECTORY, 'graph3d.js')
    if (!existsSync(file)) throw new Error('the 3D star map module is missing from this installation')
    graph3dSource = readFileSync(file, 'utf8')
  }
  return graph3dSource
}

export function apply(ctx) {
  const graphAgents = new WeakSet()
  const enableAgents = new WeakSet()
  // Each enabled Agent keeps a withdraw function so the bootstrap tool can be
  // removed the moment the project opts in, whichever path enabled it.
  const enableWithdraw = new WeakMap()

  // Graph tools and the maintenance prompt exist only for an opted-in project.
  const attachGraph = (agent) => {
    if (!agent || graphAgents.has(agent)) return false
    const root = agent.session?.header?.cwd
    if (!root || !existsSync(join(root, MAP_DIRECTORY))) return false
    // Opting in retires the bootstrap tool: the graph tools supersede it.
    const withdraw = enableWithdraw.get(agent)
    if (withdraw) { enableWithdraw.delete(agent); withdraw() }
    // A broken resource map needs the graph check tool most. Tool and prompt
    // availability therefore depends only on project opt-in, never on index
    // validity; query/check report diagnostics through their normal results.
    try { rebuildIndex(root) } catch {}
    graphAgents.add(agent)
    agent.ctx.effect(() => {
      const tools = agent.ctx.get('tools'); const prompt = agent.ctx.get('systemPrompt'); const disposers = []
      if (tools) for (const definition of toolDefinitions()) disposers.push(tools.register(definition))
      if (prompt) disposers.push(prompt.section({ name: 'resource-graph:maintenance', order: 170, text: PROMPT }))
      return () => { graphAgents.delete(agent); for (const dispose of disposers.reverse()) dispose() }
    })
    return true
  }

  // The enable tool is the bootstrap path, so it is offered exactly when the
  // project has not opted in yet. Once .resource-map exists the graph tools
  // take over and this tool is withdrawn.
  const attachEnable = (agent) => {
    if (!agent || enableAgents.has(agent)) return false
    const root = agent.session?.header?.cwd
    if (!root) return false
    if (existsSync(join(root, MAP_DIRECTORY))) return false
    enableAgents.add(agent)
    agent.ctx.effect(() => {
      const tools = agent.ctx.get('tools'); const disposers = []
      const withdraw = () => { for (const dispose of disposers.splice(0).reverse()) dispose() }
      enableWithdraw.set(agent, withdraw)
      if (tools) {
        disposers.push(tools.register(enableDefinition(() => {
          // Enabling swaps the bootstrap tool for the real graph tools in the
          // same session, so the user does not have to start a new one.
          attachGraph(agent)
        })))
      }
      return () => { enableAgents.delete(agent); enableWithdraw.delete(agent); withdraw() }
    })
    return true
  }

  const attachAgent = (agent) => {
    // A project either has the map (graph tools) or does not (enable tool).
    if (attachGraph(agent)) return true
    return attachEnable(agent)
  }

  ctx.webServer.register({
    kind: 'exact', path: '/api/resource-graph',
    handler(request, response) {
      try {
        const sessionId = requestSessionId(request); const project = projectContext(ctx, sessionId)
        if ((request.method || 'GET').toUpperCase() === 'POST') {
          const initialized = initializeProject(project.root); const indexed = rebuildIndex(project.root)
          const agent = ctx.get('agents')?.get(sessionId)
          // Enabling from the UI must also swap the bootstrap tool for the graph
          // tools in the live session, exactly like the enable tool does.
          if (agent) attachGraph(agent)
          return send(response, 200, { ok: true, ...initialized, configured: true, nodes: indexed.nodes, edges: indexed.edges, project: project.project, schema: 'dsh-resource-map-project-v1' })
        }
        if (existsSync(join(project.root, MAP_DIRECTORY))) rebuildIndex(project.root)
        return send(response, 200, { ...readGraph(project.root), project: project.project })
      } catch (error) {
        const status = /required|unknown live DSH session|service is unavailable|has no project cwd/.test(error.message) ? 400 : 500
        return send(response, status, { error: error.message, schema: 'dsh-resource-map-project-v1' })
      }
    },
  })

  ctx.webServer.register({
    kind: 'exact', path: GRAPH3D_PATH,
    handler(_request, response) {
      try {
        const body = graph3dModule()
        response.statusCode = 200
        response.setHeader('content-type', 'text/javascript; charset=utf-8')
        response.setHeader('cache-control', 'no-store')
        response.end(body)
      } catch (error) {
        response.statusCode = 500
        response.setHeader('content-type', 'application/json; charset=utf-8')
        response.end(JSON.stringify({ error: error.message }))
      }
    },
  })

  ctx.on('agent/created', ({ agent }) => attachAgent(agent))
  for (const agent of ctx.get('agents')?.roots() || []) attachAgent(agent)
}
