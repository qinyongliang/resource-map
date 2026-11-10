/**
 * Lazy 3D star-map renderer for the resource graph.
 *
 * This module is loaded on demand the first time a user switches the graph to the
 * 3D view, so the default 2D view never pays for it. It has no dependencies and
 * renders on a plain 2D canvas with a small perspective camera, which keeps the
 * package dependency-free while still giving real depth, orbit and zoom.
 *
 * `createStarMap(canvas, options)` returns a handle whose `dispose()` releases
 * every listener, observer and animation frame it created, so collapsing or
 * unmounting the view reclaims it completely.
 */

const TAU = Math.PI * 2
const CLUSTER_RADIUS = 520
const FOV = 900

function fibonacciSphere(count, radius) {
  const points = []
  if (count <= 0) return points
  if (count === 1) return [{ x: 0, y: 0, z: radius }]
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let index = 0; index < count; index += 1) {
    const y = 1 - (index / (count - 1)) * 2
    const ring = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * index
    points.push({ x: Math.cos(theta) * ring * radius, y: y * radius, z: Math.sin(theta) * ring * radius })
  }
  return points
}

function buildScene(nodes, edges, colors) {
  const groups = new Map()
  for (const node of nodes) {
    const list = groups.get(node.kind) || []
    list.push(node)
    groups.set(node.kind, list)
  }
  const kinds = [...groups.keys()].sort((a, b) => groups.get(b).length - groups.get(a).length)
  const anchors = new Map()
  fibonacciSphere(kinds.length, CLUSTER_RADIUS).forEach((point, index) => anchors.set(kinds[index], point))

  const positions = new Map()
  const degree = new Map(nodes.map((node) => [node.id, 0]))
  for (const edge of edges) {
    degree.set(edge.source, (degree.get(edge.source) || 0) + 1)
    degree.set(edge.target, (degree.get(edge.target) || 0) + 1)
  }

  for (const kind of kinds) {
    const group = groups.get(kind)
    const anchor = anchors.get(kind)
    const span = 40 + Math.sqrt(group.length) * 26
    group.forEach((node, index) => {
      if (index === 0) {
        positions.set(node.id, { x: anchor.x, y: anchor.y, z: anchor.z, kind, radius: nodeRadius(node, degree) })
        return
      }
      const spread = fibonacciSphere(group.length - 1, span)[index - 1]
      positions.set(node.id, {
        x: anchor.x + spread.x,
        y: anchor.y + spread.y,
        z: anchor.z + spread.z,
        kind,
        radius: nodeRadius(node, degree),
      })
    })
  }

  return { kinds, groups, anchors, positions, degree, center: { x: 0, y: 0, z: 0 } }
}

function nodeRadius(node, degree) {
  return Math.min(15, 4.4 + Math.sqrt(degree.get(node.id) || 0) * 2.6)
}

export function createStarMap(canvas, options = {}) {
  const context = canvas.getContext('2d', { alpha: true })
  if (!context) throw new Error('the 3D star map requires a 2D canvas context')

  const colors = options.colors || {}
  const defaultColor = colors.default || '#718096'
  const state = {
    nodes: [], edges: [], scene: buildScene([], [], colors),
    yaw: 0.55, pitch: -0.32, zoom: 1, selected: null, hover: null,
    drag: null, auto: true, frame: 0, disposed: false, hoverId: null, labelBudget: 14,
  }

  const pointer = { x: 0, y: 0, inside: false }

  function resize() {
    const ratio = Math.min(2, window.devicePixelRatio || 1)
    const rect = canvas.getBoundingClientRect()
    const width = Math.max(1, Math.round(rect.width))
    const height = Math.max(1, Math.round(rect.height))
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
    state.viewport = { width, height }
  }

  function project(point) {
    const cosYaw = Math.cos(state.yaw); const sinYaw = Math.sin(state.yaw)
    const cosPitch = Math.cos(state.pitch); const sinPitch = Math.sin(state.pitch)
    const x1 = point.x * cosYaw - point.z * sinYaw
    const z1 = point.x * sinYaw + point.z * cosYaw
    const y2 = point.y * cosPitch - z1 * sinPitch
    const z2 = point.y * sinPitch + z1 * cosPitch
    const depth = FOV / Math.max(120, FOV + z2)
    const viewport = state.viewport || { width: 1, height: 1 }
    return {
      x: viewport.width / 2 + x1 * depth * state.zoom,
      y: viewport.height / 2 + y2 * depth * state.zoom,
      depth,
      z: z2,
    }
  }

  function paint() {
    if (state.disposed) return
    const viewport = state.viewport || { width: canvas.width, height: canvas.height }
    context.clearRect(0, 0, viewport.width, viewport.height)

    const selected = state.selected
    const neighbours = new Set()
    if (selected) for (const edge of state.edges) {
      if (edge.source === selected) neighbours.add(edge.target)
      if (edge.target === selected) neighbours.add(edge.source)
    }

    const projected = new Map()
    for (const node of state.nodes) {
      const point = state.scene.positions.get(node.id)
      if (point) projected.set(node.id, project(point))
    }

    // Links first, far-to-near, so nearer stars sit on top of the lines behind them.
    const links = []
    for (const edge of state.edges) {
      const a = projected.get(edge.source); const b = projected.get(edge.target)
      if (!a || !b) continue
      const active = selected && (edge.source === selected || edge.target === selected)
      links.push({ a, b, active, depth: (a.z + b.z) / 2 })
    }
    links.sort((left, right) => right.depth - left.depth)
    for (const link of links) {
      const alpha = link.active ? 0.85 : Math.max(0.04, Math.min(0.22, 0.16 * ((link.a.depth + link.b.depth) / 2)))
      context.strokeStyle = link.active ? (colors.default || defaultColor) : `rgba(148,163,184,${alpha})`
      context.globalAlpha = 1
      context.lineWidth = link.active ? 1.6 : 0.9
      context.beginPath(); context.moveTo(link.a.x, link.a.y); context.lineTo(link.b.x, link.b.y); context.stroke()
    }

    const ordered = [...projected.entries()].sort((left, right) => right[1].z - left[1].z)
    const labelCandidates = []
    for (const [id, point] of ordered) {
      const node = state.nodes.find((item) => item.id === id)
      if (!node) continue
      const colour = colors[node.kind] || defaultColor
      const dim = selected && id !== selected && !neighbours.has(id)
      const radius = Math.max(1.6, (state.scene.positions.get(id)?.radius || 5) * point.depth * state.zoom * 0.9)
      context.globalAlpha = dim ? 0.22 : Math.min(1, 0.45 + point.depth * 0.75)

      // Glow: a soft outer halo makes each node read as a star rather than a dot.
      const halo = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 3.4)
      halo.addColorStop(0, colour)
      halo.addColorStop(0.45, `${colour}66`)
      halo.addColorStop(1, 'rgba(0,0,0,0)')
      context.fillStyle = halo
      context.beginPath(); context.arc(point.x, point.y, radius * 3.4, 0, TAU); context.fill()

      context.fillStyle = colour
      context.beginPath(); context.arc(point.x, point.y, radius, 0, TAU); context.fill()

      if (id === selected || id === state.hoverId) {
        context.strokeStyle = '#ffffff'; context.lineWidth = 1.6; context.globalAlpha = 0.95
        context.beginPath(); context.arc(point.x, point.y, radius + 4.5, 0, TAU); context.stroke()
      }
      if (!dim) labelCandidates.push({ id, node, point, radius, score: (id === selected || id === state.hoverId ? 1e6 : 0) + (state.scene.degree.get(id) || 0) * 100 + point.depth * 40 })
    }
    context.globalAlpha = 1

    labelCandidates.sort((left, right) => right.score - left.score)
    context.font = '600 11px system-ui, -apple-system, "Segoe UI", sans-serif'
    context.textAlign = 'center'
    for (const candidate of labelCandidates.slice(0, state.labelBudget)) {
      const title = candidate.node.title || candidate.node.id
      const text = title.length > 18 ? `${title.slice(0, 17)}…` : title
      context.globalAlpha = candidate.id === selected || candidate.id === state.hoverId ? 1 : 0.72
      context.lineWidth = 3
      context.strokeStyle = 'rgba(2,6,23,.85)'
      context.strokeText(text, candidate.point.x, candidate.point.y - candidate.radius - 7)
      context.fillStyle = '#e8eefc'
      context.fillText(text, candidate.point.x, candidate.point.y - candidate.radius - 7)
    }
    context.globalAlpha = 1
  }

  function tick() {
    if (state.disposed) return
    if (state.auto && !state.drag) state.yaw += 0.0018
    paint()
    state.frame = requestAnimationFrame(tick)
  }

  function handlePointerDown(event) {
    if (event.button !== 0) return
    state.drag = { x: event.clientX, y: event.clientY, yaw: state.yaw, pitch: state.pitch, moved: false }
    canvas.setPointerCapture?.(event.pointerId)
  }

  function handlePointerMove(event) {
    const rect = canvas.getBoundingClientRect()
    pointer.x = event.clientX - rect.left; pointer.y = event.clientY - rect.top; pointer.inside = true
    if (state.drag) {
      const dx = event.clientX - state.drag.x; const dy = event.clientY - state.drag.y
      if (Math.abs(dx) + Math.abs(dy) > 3) state.drag.moved = true
      state.yaw = state.drag.yaw + dx * 0.006
      state.pitch = Math.max(-1.35, Math.min(1.35, state.drag.pitch + dy * 0.005))
      return
    }
    const hit = pick(pointer.x, pointer.y)
    const id = hit?.id || null
    if (id !== state.hoverId) { state.hoverId = id; canvas.style.cursor = id ? 'pointer' : 'grab' }
  }

  function handlePointerUp(event) {
    const wasDrag = state.drag?.moved
    state.drag = null
    canvas.releasePointerCapture?.(event?.pointerId)
    if (wasDrag) return
    const rect = canvas.getBoundingClientRect()
    const hit = pick(event ? event.clientX - rect.left : pointer.x, event ? event.clientY - rect.top : pointer.y)
    state.selected = hit?.id || null
    options.onSelect?.(state.selected)
    paint()
  }

  function handleWheel(event) {
    event.preventDefault()
    state.zoom = Math.max(0.35, Math.min(3.4, state.zoom * Math.exp(-event.deltaY * 0.0012)))
    paint()
  }

  function handleKeyDown(event) { if (event.key === 'Escape' && state.selected) { state.selected = null; options.onSelect?.(null); paint() } }
  function handleVisibility() { state.auto = !document.hidden; if (!document.hidden) paint() }

  function pick(x, y) {
    let best = null
    for (const node of state.nodes) {
      const point = state.scene.positions.get(node.id)
      if (!point) continue
      const screen = project(point)
      const radius = Math.max(6, (point.radius || 5) * screen.depth * state.zoom * 0.9) + 6
      const distance = Math.hypot(screen.x - x, screen.y - y)
      if (distance > radius) continue
      if (!best || screen.z < best.z) best = { id: node.id, z: screen.z }
    }
    return best
  }

  let observer = null
  if (typeof ResizeObserver !== 'undefined') { observer = new ResizeObserver(() => { resize(); paint() }); observer.observe(canvas) }
  canvas.addEventListener('pointerdown', handlePointerDown)
  canvas.addEventListener('pointermove', handlePointerMove)
  canvas.addEventListener('pointerup', handlePointerUp)
  canvas.addEventListener('pointerleave', handlePointerUp)
  canvas.addEventListener('pointercancel', handlePointerUp)
  canvas.addEventListener('wheel', handleWheel, { passive: false })
  window.addEventListener('keydown', handleKeyDown)
  document.addEventListener('visibilitychange', handleVisibility)
  canvas.style.cursor = 'grab'
  canvas.__rg2Dispose = () => dispose()

  resize()
  paint()
  state.frame = requestAnimationFrame(tick)

  /** Replace the rendered graph; positions are rebuilt only for a new node set. */
  function setGraph(nodes, edges) {
    const sameNodes = nodes.length === state.nodes.length && nodes.every((node, index) => state.nodes[index]?.id === node.id)
    state.nodes = nodes; state.edges = edges
    if (!sameNodes) state.scene = buildScene(nodes, edges, colors)
    if (state.selected && !nodes.some((node) => node.id === state.selected)) state.selected = null
    paint()
  }

  function setSelected(id) { state.selected = id || null; paint() }
  function focus(id) {
    const point = state.scene.positions.get(id)
    if (!point) return
    state.yaw = Math.atan2(point.x, point.z)
    state.pitch = Math.max(-1.35, Math.min(1.35, -Math.atan2(point.y, Math.hypot(point.x, point.z))))
    state.selected = id
    paint()
  }

  /** Release every listener, observer and animation frame created above. */
  function dispose() {
    if (state.disposed) return
    state.disposed = true
    cancelAnimationFrame(state.frame)
    observer?.disconnect()
    canvas.removeEventListener('pointerdown', handlePointerDown)
    canvas.removeEventListener('pointermove', handlePointerMove)
    canvas.removeEventListener('pointerup', handlePointerUp)
    canvas.removeEventListener('pointerleave', handlePointerUp)
    canvas.removeEventListener('pointercancel', handlePointerUp)
    canvas.removeEventListener('wheel', handleWheel)
    window.removeEventListener('keydown', handleKeyDown)
    document.removeEventListener('visibilitychange', handleVisibility)
    delete canvas.__rg2Dispose
    try { context.clearRect(0, 0, canvas.width, canvas.height) } catch {}
    state.nodes = []; state.edges = []
  }

  return { setGraph, setSelected, focus, dispose, resize, get disposed() { return state.disposed } }
}
