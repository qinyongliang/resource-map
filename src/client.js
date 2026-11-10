import React, { useEffect, useMemo, useRef, useState } from 'react'

export const inject = ['slots']
const PACKAGE_NAME = '__PACKAGE_NAME__'
const API = '/api/resource-graph'
const COLORS = {
  server: '#ef6a5b', project: '#27a89a', service: '#77a83f', database: '#8668d4',
  database_namespace: '#9b7be5', database_table: '#aa8bea', website: '#348dcc', system: '#e2a53e',
  message_queue: '#c66eb7', mq_channel: '#d989c9', ops_document: '#8a7562', cloud_provider: '#5f7bd8',
  cloud_provider_account: '#7890df', novel: '#9b59b6', volume: '#7d6bb3', chapter: '#3d8fd1', entity: '#27a89a', event: '#e07a3f', action: '#d4a72c', timeline: '#596780', default: '#718096',
}
const LABELS = {
  server: '服务器', project: '项目', service: '服务', database: '数据库', database_namespace: '逻辑库',
  database_table: '数据表', website: '网站', system: '系统', message_queue: '消息队列', mq_channel: '队列通道',
  ops_document: '运维文档', cloud_provider: '云平台', cloud_provider_account: '云账号', novel: '小说', volume: '卷', chapter: '章节', entity: '实体', event: '事件', action: '动作', timeline: '时间轴',
}

const VIEW_MODE_KEY = 'resource-map:view-mode'
const VIEW_2D = '2d'
const VIEW_3D = '3d'
const GRAPH3D_URL = '/api/resource-graph/graph3d.js'

/** The view mode is remembered in the browser, so the next open reuses it. */
function readViewMode() {
  try { return window.localStorage.getItem(VIEW_MODE_KEY) === VIEW_3D ? VIEW_3D : VIEW_2D } catch { return VIEW_2D }
}

function writeViewMode(mode) {
  try { window.localStorage.setItem(VIEW_MODE_KEY, mode) } catch { /* storage unavailable; the session keeps the in-memory choice */ }
}

// The 3D renderer is fetched on first use only, so the default 2D view never pays
// for it. A failed load is not cached, so a later attempt can retry.
let graph3dModulePromise = null
function loadGraph3d() {
  if (!graph3dModulePromise) {
    graph3dModulePromise = import(/* @vite-ignore */ GRAPH3D_URL).catch((error) => { graph3dModulePromise = null; throw error })
  }
  return graph3dModulePromise
}

function StarMapView({ nodes, edges, selected, onSelect }) {
  const canvasRef = useRef(null)
  const instanceRef = useRef(null)
  const selectRef = useRef(onSelect)
  const [error, setError] = useState(null)
  useEffect(() => { selectRef.current = onSelect })
  useEffect(() => {
    let cancelled = false
    let instance = null
    // Lazy load, then hand over the canvas. The cleanup below always runs, so
    // collapsing the panel or switching back to 2D reclaims the renderer.
    loadGraph3d().then((module) => {
      if (cancelled || !canvasRef.current) return
      instance = module.createStarMap(canvasRef.current, { colors: COLORS, onSelect: (id) => selectRef.current?.(id) })
      instanceRef.current = instance
      instance.setGraph(nodes, edges)
      setError(null)
    }).catch((reason) => { if (!cancelled) setError(reason?.message || '3D 星图加载失败') })
    return () => {
      cancelled = true
      instanceRef.current = null
      instance?.dispose()
    }
  }, [])
  useEffect(() => { instanceRef.current?.setGraph(nodes, edges) }, [nodes, edges])
  useEffect(() => { instanceRef.current?.setSelected(selected) }, [selected])
  return React.createElement(React.Fragment, null,
    React.createElement('canvas', { ref: canvasRef, className: 'rg2-star', 'aria-label': '资源关系 3D 星图' }),
    error && React.createElement('div', { className: 'rg2-star-error' }, error))
}

function useGraph(sessionId) {
  const [state, setState] = useState({ loading: true, graph: null, error: null })
  const load = async (method = 'GET') => {
    if (!sessionId) { setState({ loading: false, graph: null, error: '当前页面没有活动会话' }); return null }
    setState((value) => ({ ...value, loading: true, error: null }))
    try {
      const response = await fetch(`${API}?sessionId=${encodeURIComponent(sessionId)}`, { method, cache: 'no-store' })
      const contentType = response.headers.get('content-type') || ''
      const graph = contentType.includes('application/json') ? await response.json() : { error: response.status === 404 ? '资源图 Host 尚未加载。请在维护窗口重载 DSH 后重试。' : `HTTP ${response.status}` }
      if (!response.ok) throw new Error(graph.error || `HTTP ${response.status}`)
      if (graph.schema !== 'dsh-resource-map-project-v1') throw new Error('资源图 Host 尚未切换到项目隔离模式。为避免读取旧目录，本面板已停止渲染。')
      if (method === 'POST') return load('GET')
      setState({ loading: false, graph, error: null }); return graph
    } catch (error) { setState({ loading: false, graph: null, error: error.message }); return null }
  }
  useEffect(() => { load() }, [sessionId])
  return { ...state, initialize: () => load('POST'), reload: () => load('GET') }
}

function timelineProjection(nodes, edges) {
  const timelines = new Set(nodes.filter((node) => node.kind === 'timeline').map((node) => node.id)); const placements = new Map()
  for (const edge of edges) if (timelines.has(edge.target) && edge.attributes && (edge.attributes.start != null || edge.attributes.end != null)) placements.set(edge.source, { axis: edge.target, start: Number(edge.attributes.start ?? edge.attributes.end), end: Number(edge.attributes.end ?? edge.attributes.start) })
  const eligible = new Set(['chapter', 'event', 'action', 'entity'])
  for (const node of nodes) {
    if (placements.has(node.id) || !eligible.has(node.kind)) continue
    const related = edges.flatMap((edge) => edge.source === node.id && placements.has(edge.target) ? [placements.get(edge.target)] : edge.target === node.id && placements.has(edge.source) ? [placements.get(edge.source)] : [])
    if (!related.length) continue
    const sameAxis = related.filter((item) => item.axis === related[0].axis); placements.set(node.id, { axis: sameAxis[0].axis, start: sameAxis.reduce((sum, item) => sum + item.start, 0) / sameAxis.length, end: sameAxis.reduce((sum, item) => sum + item.end, 0) / sameAxis.length, derived: true })
  }
  return placements
}

function layoutClusters(nodes, edges) {
  const groups = new Map()
  for (const node of nodes) {
    const group = groups.get(node.kind) || []
    group.push(node); groups.set(node.kind, group)
  }
  const kinds = [...groups.keys()].sort((a, b) => groups.get(b).length - groups.get(a).length)
  const width = 1500
  const height = 980
  const center = { x: width / 2, y: height / 2 }
  const centers = new Map()
  const positions = new Map()
  const clusters = []
  kinds.forEach((kind, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(kinds.length, 1) - Math.PI / 2
    const ring = index % 2 === 0 ? 360 : 445
    const cx = center.x + Math.cos(angle) * ring
    const cy = center.y + Math.sin(angle) * ring * 0.72
    const group = groups.get(kind)
    const radius = 76 + Math.sqrt(group.length) * 22
    centers.set(kind, { x: cx, y: cy })
    clusters.push({ kind, x: cx, y: cy, radius, count: group.length })
    group.forEach((node, nodeIndex) => {
      if (nodeIndex === 0) {
        positions.set(node.id, { x: cx, y: cy, kind })
        return
      }
      const orbit = 46 + Math.floor((nodeIndex - 1) / 7) * 52
      const slot = (nodeIndex - 1) % 7
      const nodeAngle = angle + (Math.PI * 2 * slot) / Math.min(7, Math.max(1, group.length - 1))
      positions.set(node.id, { x: cx + Math.cos(nodeAngle) * orbit, y: cy + Math.sin(nodeAngle) * orbit, kind })
    })
  })
  const placements = timelineProjection(nodes, edges); const values = [...placements.values()].filter((item) => Number.isFinite(item.start) && Number.isFinite(item.end)); if (values.length) { const min = Math.min(...values.map((item) => item.start)); const max = Math.max(...values.map((item) => item.end)); const span = Math.max(max - min, 1); const laneByKind = new Map(); for (const node of nodes) { const time = placements.get(node.id); if (!time || !Number.isFinite(time.start)) continue; const lane = laneByKind.has(node.kind) ? laneByKind.get(node.kind) : laneByKind.size; laneByKind.set(node.kind, lane); const prior = positions.get(node.id); positions.set(node.id, { ...prior, x: 130 + ((time.start + time.end) / 2 - min) / span * (width - 260), y: 115 + lane * 105, time }) } }
  const degree = new Map(nodes.map((node) => [node.id, 0])); for (const edge of edges) { degree.set(edge.source, (degree.get(edge.source) || 0) + 1); degree.set(edge.target, (degree.get(edge.target) || 0) + 1) }
  const radius = new Map(nodes.map((node) => [node.id, Math.min(24, 6 + Math.sqrt(degree.get(node.id) || 0) * 4.2)]))
  for (let pass = 0; pass < 18; pass++) { const list = [...positions.entries()]; for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) { const [idA, a] = list[i]; const [idB, b] = list[j]; let dx = b.x - a.x; let dy = b.y - a.y; if (!dx && !dy) { dx = (i % 3) - 1 || 1; dy = (j % 3) - 1 || -1 } const distance = Math.hypot(dx, dy); const minimum = (radius.get(idA) || 8) + (radius.get(idB) || 8) + 28; if (distance >= minimum) continue; const push = (minimum - distance) * .52; const ux = dx / distance; const uy = dy / distance; a.x -= ux * push; a.y -= uy * push; b.x += ux * push; b.y += uy * push } }
  return { groups, kinds, centers, positions, clusters, width, height, placements, degree, radius }
}

function parseWikiTarget(value) { const [destination, ...aliasParts] = String(value || '').split('|'); const hash = destination.indexOf('#'); return { target: (hash < 0 ? destination : destination.slice(0, hash)).trim(), anchor: hash < 0 ? null : destination.slice(hash + 1).trim() || null, alias: aliasParts.length ? aliasParts.join('|').trim() || null : null } }
function headingAnchor(value) { return String(value || '').replace(/[*_`]/g, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase() }

export function wikilinkDisplay(value, titleById, currentId) {
  const link = parseWikiTarget(value); const id = link.target || currentId
  return link.alias || (id ? titleById?.get(id) : null) || link.target || value
}

function inlineMarkdown(text, key, onWikilink, titleById, currentId) {
  const parts = String(text).split(/(`[^`]+`|\*\*[^*]+\*\*|\[\[[^\]]+\]\]|\[[^\]]+\]\([^)]+\))/g)
  return parts.filter(Boolean).map((part, index) => {
    if (/^`[^`]+`$/.test(part)) return React.createElement('code', { key: `${key}-${index}` }, part.slice(1, -1))
    if (/^\*\*[^*]+\*\*$/.test(part)) return React.createElement('strong', { key: `${key}-${index}` }, part.slice(2, -2))
    const wiki = /^\[\[([^\]]+)\]\]$/.exec(part)
    if (wiki) { const link = parseWikiTarget(wiki[1]); return React.createElement('button', { key: `${key}-${index}`, type: 'button', className: 'rg2-wikilink', onClick: () => onWikilink?.(link), title: `打开 ${link.target || '当前节点'}${link.anchor ? ` · ${link.anchor}` : ''}` }, wikilinkDisplay(wiki[1], titleById, currentId)) }
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
    if (link && /^(https?:|mailto:)/.test(link[2])) return React.createElement('a', { key: `${key}-${index}`, href: link[2], target: '_blank', rel: 'noreferrer' }, link[1])
    return part
  })
}

function MarkdownBody({ source, onWikilink, focusAnchor, titleById, currentId }) {
  const rootRef = useRef(null)
  useEffect(() => { if (!focusAnchor || !rootRef.current) return; const attribute = focusAnchor.startsWith('^') ? 'data-block-id' : 'data-heading-anchor'; const value = focusAnchor.startsWith('^') ? focusAnchor.slice(1) : headingAnchor(focusAnchor); const target = [...rootRef.current.querySelectorAll(`[${attribute}]`)].find((element) => element.getAttribute(attribute) === value); if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); target.classList.add('rg2-anchor-focus') } }, [focusAnchor, source])
  const lines = String(source || '').split(/\r?\n/); const blocks = []; let code = []; let inCode = false; let list = []
  const flushList = () => { if (list.length) { blocks.push(React.createElement('ul', { key: `list-${blocks.length}` }, ...list.map((item, index) => React.createElement('li', { key: index, ...(item.block ? { 'data-block-id': item.block } : {}) }, ...inlineMarkdown(item.text, `li-${blocks.length}-${index}`, onWikilink, titleById, currentId))))); list = [] } }
  lines.forEach((originalLine) => {
    const blockMatch = /(?:^|\s)\^([a-z0-9]+(?:-[a-z0-9]+)*)\s*$/.exec(originalLine); const blockId = blockMatch?.[1] || null; const line = blockMatch ? originalLine.slice(0, blockMatch.index).trimEnd() : originalLine
    if (/^```/.test(line)) { if (inCode) { blocks.push(React.createElement('pre', { key: `code-${blocks.length}` }, React.createElement('code', null, code.join('\n')))); code = []; inCode = false } else { flushList(); inCode = true }; return }
    if (inCode) { code.push(line); return }
    const heading = /^(#{1,4})\s+(.+)$/.exec(line)
    if (heading) { flushList(); blocks.push(React.createElement(`h${heading[1].length}`, { key: `h-${blocks.length}`, 'data-heading-anchor': headingAnchor(heading[2]), ...(blockId ? { 'data-block-id': blockId } : {}) }, ...inlineMarkdown(heading[2], `h-${blocks.length}`, onWikilink, titleById, currentId))); return }
    const item = /^\s*[-*]\s+(.+)$/.exec(line)
    if (item) { list.push({ text: item[1], block: blockId }); return }
    flushList()
    const anchorProps = blockId ? { 'data-block-id': blockId } : {}
    if (/^>\s?/.test(line)) blocks.push(React.createElement('blockquote', { key: `q-${blocks.length}`, ...anchorProps }, ...inlineMarkdown(line.replace(/^>\s?/, ''), `q-${blocks.length}`, onWikilink, titleById, currentId)))
    else if (/^---+$/.test(line.trim())) blocks.push(React.createElement('hr', { key: `hr-${blocks.length}`, ...anchorProps }))
    else if (line.trim()) blocks.push(React.createElement('p', { key: `p-${blocks.length}`, ...anchorProps }, ...inlineMarkdown(line, `p-${blocks.length}`, onWikilink, titleById, currentId)))
  })
  flushList(); if (code.length) blocks.push(React.createElement('pre', { key: `code-${blocks.length}` }, React.createElement('code', null, code.join('\n'))))
  return React.createElement('div', { ref: rootRef, className: 'rg2-markdown' }, ...blocks)
}

const GANTT_COLORS = ['#e76f51', '#2a9d8f', '#457b9d', '#e9a23b', '#8e6ccf', '#d65c9e', '#5f9f45', '#d9772f']
function ganttColor(id) { let hash = 2166136261; for (const char of String(id || '')) { hash ^= char.codePointAt(0); hash = Math.imul(hash, 16777619) } return GANTT_COLORS[Math.abs(hash) % GANTT_COLORS.length] }

function TimelineView({ nodes, edges, selected, onSelect, scrollLeft, onScroll }) {
  const axes = useMemo(() => {
    const byId = new Map(nodes.map((node) => [node.id, node])); const result = []
    for (const axis of nodes.filter((node) => node.kind === 'timeline')) {
      const raw = edges.filter((edge) => edge.target === axis.id && edge.attributes && (edge.attributes.start != null || edge.attributes.end != null)).map((edge) => ({ edge, node: byId.get(edge.source), start: Number(edge.attributes.start ?? edge.attributes.end), end: Number(edge.attributes.end ?? edge.attributes.start) })).filter((entry) => entry.node && Number.isFinite(entry.start) && Number.isFinite(entry.end))
      if (!raw.length) continue
      const min = Math.min(...raw.map((entry) => entry.start)); const max = Math.max(...raw.map((entry) => entry.end)); const span = Math.max(max - min + 1, 1); const laneEnds = []
      raw.sort((a, b) => (a.end - a.start) - (b.end - b.start) || a.start - b.start).forEach((entry) => { let lane = laneEnds.findIndex((end) => end < entry.start); if (lane < 0) lane = laneEnds.length; laneEnds[lane] = entry.end; entry.lane = lane; entry.left = ((entry.start - min) / span) * 100; entry.width = Math.max(((entry.end - entry.start + 1) / span) * 100, 4) })
      result.push({ axis, entries: raw, lanes: laneEnds.length, min, max })
    }
    return result
  }, [nodes, edges])
  if (!axes.length) return null
  const rows = axes.map(({ axis, entries, lanes, min, max }) => React.createElement('div', { className: 'rg2-time-row', key: axis.id },
    React.createElement('strong', null, axis.title, React.createElement('small', null, `${min} – ${max}`)),
    React.createElement('div', { className: 'rg2-time-track', style: { height: `${Math.max(lanes, 1) * 34}px` } },
      ...entries.map((entry) => React.createElement('button', { key: `${axis.id}:${entry.node.id}:${entry.edge.relation}`, style: { left: `${entry.left}%`, width: `${entry.width}%`, top: `${entry.lane * 34}px`, '--rg2-gantt-color': ganttColor(entry.node.id) }, className: selected === entry.node.id ? 'is-active' : '', onClick: (event) => { event.stopPropagation(); onSelect(entry.node.id) }, title: `${entry.node.title} · ${entry.edge.attributes.certainty || 'unknown'}` },
        React.createElement('span', null, entry.edge.attributes.label || entry.node.title),
        React.createElement('small', null, entry.start === entry.end ? `${entry.start}` : `${entry.start} – ${entry.end}`))))))
  return React.createElement('section', { className: 'rg2-timeline', onPointerDown: (event) => event.stopPropagation(), onWheel: (event) => event.stopPropagation() },
    React.createElement('div', { className: 'rg2-gantt-scroll', ref: (element) => { if (element && Math.abs(element.scrollLeft - scrollLeft) > 1) element.scrollLeft = scrollLeft }, onScroll: (event) => onScroll(event.currentTarget.scrollLeft) },
      React.createElement('div', { className: 'rg2-gantt-body' }, ...rows)))
}

function GraphBoard({ graph, query, onReference }) {
  const [zoom, setZoom] = useState(0.62)
  const [pan, setPan] = useState({ x: -30, y: -40 })
  const [drag, setDrag] = useState(null)
  const [selected, setSelected] = useState(null)
  const [menu, setMenu] = useState(null)
  const [focusAnchor, setFocusAnchor] = useState(null)
  const [timelineScroll, setTimelineScroll] = useState(0)
  const [nodePositions, setNodePositions] = useState(new Map())
  const [fullscreen, setFullscreen] = useState(false)
  const [viewMode, setViewMode] = useState(() => readViewMode())
  const boardRef = useRef(null)
  const viewRef = useRef({ zoom: 0.62, pan: { x: -30, y: -40 } })
  const normalized = query.trim().toLowerCase()
  const nodes = useMemo(() => {
    const source = graph.nodes.filter((node) => !normalized || `${node.id} ${node.title} ${node.kind} ${node.environment} ${node.description}`.toLowerCase().includes(normalized))
    if (normalized) return source.slice(0, 240)
    const count = new Map()
    return source.filter((node) => { const next = (count.get(node.kind) || 0) + 1; count.set(node.kind, next); return next <= 18 }).slice(0, 260)
  }, [graph, normalized])
  const allVisibleEdges = useMemo(() => { const ids = new Set(nodes.map((node) => node.id)); return graph.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)) }, [graph, nodes])
  const layout = useMemo(() => { const value = layoutClusters(nodes, allVisibleEdges); for (const [id, point] of nodePositions) if (value.positions.has(id)) value.positions.set(id, { ...value.positions.get(id), ...point }); return value }, [nodes, allVisibleEdges, nodePositions])
  const visible = useMemo(() => new Set(nodes.map((node) => node.id)), [nodes])
  const edges = useMemo(() => graph.edges.filter((edge) => visible.has(edge.source) && visible.has(edge.target)), [graph, visible])
  const connected = useMemo(() => new Set(edges.filter((edge) => edge.source === selected || edge.target === selected).flatMap((edge) => [edge.source, edge.target])), [edges, selected])
  const selectedNode = nodes.find((node) => node.id === selected)
  const titleById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node.title || node.name || node.id])), [graph])
  const zoomAt = (nextZoom, clientX, clientY) => {
    const rect = boardRef.current?.getBoundingClientRect(); if (!rect) return
    const current = viewRef.current; const x = clientX - rect.left; const y = clientY - rect.top
    const bounded = Math.min(2.2, Math.max(0.35, nextZoom)); const ratio = bounded / current.zoom
    const nextPan = { x: x - (x - current.pan.x) * ratio, y: y - (y - current.pan.y) * ratio }
    viewRef.current = { zoom: bounded, pan: nextPan }; setZoom(bounded); setPan(nextPan)
  }
  const wheel = (event) => { if (viewMode === VIEW_3D) return; if (event.target.closest('.rg2-detail,.rg2-timeline')) return; event.preventDefault(); const factor = Math.exp(-event.deltaY * 0.0015); zoomAt(viewRef.current.zoom * factor, event.clientX, event.clientY) }
  useEffect(() => { viewRef.current = { zoom, pan } }, [zoom, pan])
  const pointerDown = (event) => { if (event.button !== 0) return; const nodeElement = event.target.closest('.rg2-node'); if (nodeElement) { event.stopPropagation(); const id = nodeElement.getAttribute('data-node-id'); const point = layout.positions.get(id); if (point) setDrag({ kind: 'node', id, x: event.clientX, y: event.clientY, origin: { x: point.x, y: point.y }, moved: false }) } else setDrag({ kind: 'pan', x: event.clientX, y: event.clientY, origin: pan }) }
  const pointerMove = (event) => { if (!drag) return; if (drag.kind === 'pan') setPan({ x: drag.origin.x + event.clientX - drag.x, y: drag.origin.y + event.clientY - drag.y }); else { const scale = viewRef.current.zoom || 1; const point = { x: drag.origin.x + (event.clientX - drag.x) / scale, y: drag.origin.y + (event.clientY - drag.y) / scale }; drag.moved = true; setNodePositions((prior) => new Map(prior).set(drag.id, point)) } }
  const pointerUp = () => setDrag(null)
  const toggleFullscreen = () => { const element = boardRef.current; if (!element) return; if (element.requestFullscreen && typeof document !== 'undefined') { if (document.fullscreenElement === element) document.exitFullscreen(); else element.requestFullscreen() } else setFullscreen((value) => !value) }
  useEffect(() => { if (typeof document === 'undefined') return; const listener = () => setFullscreen(document.fullscreenElement === boardRef.current); document.addEventListener('fullscreenchange', listener); return () => document.removeEventListener('fullscreenchange', listener) }, [])
  const openWikilink = (link) => { const target = link.target || selected; if (visible.has(target)) { setSelected(target); setFocusAnchor(link.anchor || null); setMenu(null) } }
  return React.createElement('div', { ref: boardRef, className: `rg2-board ${fullscreen ? 'is-fullscreen' : ''} ${viewMode === VIEW_3D ? 'is-3d' : ''}`, onWheel: wheel, onPointerDown: pointerDown, onPointerMove: pointerMove, onPointerUp: pointerUp, onPointerLeave: pointerUp, onClick: () => setMenu(null) },
    React.createElement('div', { className: 'rg2-zoom' },
      React.createElement('button', { className: `rg2-mode ${viewMode === VIEW_2D ? 'is-active' : ''}`, title: '二维拓扑视图（默认）', onClick: (event) => { event.stopPropagation(); setViewMode(VIEW_2D); writeViewMode(VIEW_2D) } }, '2D'),
      React.createElement('button', { className: `rg2-mode ${viewMode === VIEW_3D ? 'is-active' : ''}`, title: '三维星图视图（首次切换时按需加载）', onClick: (event) => { event.stopPropagation(); setViewMode(VIEW_3D); writeViewMode(VIEW_3D) } }, '3D星图'),
      React.createElement('span', { className: 'rg2-zoom-sep' }),
      React.createElement('button', { onClick: (event) => { event.stopPropagation(); const rect = boardRef.current?.getBoundingClientRect(); if (rect) zoomAt(viewRef.current.zoom * 1.2, rect.left + rect.width / 2, rect.top + rect.height / 2) }, title: '放大' }, '+'),
      React.createElement('button', { onClick: (event) => { event.stopPropagation(); const rect = boardRef.current?.getBoundingClientRect(); if (rect) zoomAt(viewRef.current.zoom / 1.2, rect.left + rect.width / 2, rect.top + rect.height / 2) }, title: '缩小' }, '−'),
      React.createElement('button', { onClick: (event) => { event.stopPropagation(); setZoom(0.62); setPan({ x: -30, y: -40 }); setNodePositions(new Map()) }, title: '适配视图并重置节点位置' }, '⌂'),
      React.createElement('button', { onClick: (event) => { event.stopPropagation(); toggleFullscreen() }, title: fullscreen ? '退出全屏' : '全屏显示' }, fullscreen ? '⤡' : '⛶'),
      React.createElement('span', { className: 'rg2-zoom-value' }, `${Math.round(zoom * 100)}%`)),
    viewMode === VIEW_3D
      ? React.createElement(StarMapView, { nodes, edges, selected, onSelect: (id) => { setSelected(id); setFocusAnchor(null); setMenu(null) } })
      : React.createElement('svg', { width: '100%', height: '100%', role: 'img', 'aria-label': '按资源类型聚类的关系拓扑图' },
      React.createElement('defs', null,
        React.createElement('marker', { id: 'rg2-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto' }, React.createElement('path', { d: 'M0 0L10 5L0 10z' })),
        ...layout.kinds.map((kind) => React.createElement('radialGradient', { key: `gradient-${kind}`, id: `rg2-cluster-${kind.replaceAll('_', '-')}` }, React.createElement('stop', { offset: '0%', stopColor: COLORS[kind] || COLORS.default, stopOpacity: '.16' }), React.createElement('stop', { offset: '100%', stopColor: COLORS[kind] || COLORS.default, stopOpacity: '.025' })))),
      React.createElement('g', { transform: `translate(${pan.x - timelineScroll} ${pan.y}) scale(${zoom})` },
        ...layout.clusters.map((cluster) => React.createElement('g', { key: `cluster-${cluster.kind}`, className: 'rg2-cluster' },
          React.createElement('circle', { cx: cluster.x, cy: cluster.y, r: cluster.radius, fill: `url(#rg2-cluster-${cluster.kind.replaceAll('_', '-')})`, stroke: COLORS[cluster.kind] || COLORS.default }),
          React.createElement('circle', { cx: cluster.x - cluster.radius + 13, cy: cluster.y - cluster.radius + 16, r: 6, fill: COLORS[cluster.kind] || COLORS.default }),
          React.createElement('text', { className: 'rg2-cluster-title', x: cluster.x - cluster.radius + 25, y: cluster.y - cluster.radius + 20 }, `${LABELS[cluster.kind] || cluster.kind} · ${cluster.count}`))),
        ...edges.map((edge) => {
          const a = layout.positions.get(edge.source); const b = layout.positions.get(edge.target)
          const active = selected && (edge.source === selected || edge.target === selected)
          const sameKind = a.kind === b.kind
          const bend = sameKind ? 20 : 48
          const mx = (a.x + b.x) / 2; const my = (a.y + b.y) / 2 - bend
          return React.createElement('path', { key: `${edge.source}:${edge.relation}:${edge.target}`, className: `rg2-edge ${active ? 'is-active' : ''}`, d: `M${a.x} ${a.y} Q${mx} ${my} ${b.x} ${b.y}`, markerEnd: 'url(#rg2-arrow)' })
        }),
        ...nodes.map((node) => {
          const p = layout.positions.get(node.id); const dim = selected && node.id !== selected && !connected.has(node.id); const important = selected === node.id || connected.has(node.id); const radius = important ? Math.max(15, layout.radius.get(node.id) || 8) : layout.radius.get(node.id) || 8; const quiet = !important && (layout.degree.get(node.id) || 0) <= 1 && zoom < 1
          return React.createElement('g', { key: node.id, 'data-node-id': node.id, className: `rg2-node ${selected === node.id ? 'is-selected' : ''} ${dim ? 'is-dim' : ''} ${quiet ? 'is-quiet' : ''}`, transform: `translate(${p.x} ${p.y})`, onClick: (event) => { event.stopPropagation(); setSelected(node.id); setFocusAnchor(null); setMenu(null) }, onContextMenu: (event) => { event.preventDefault(); event.stopPropagation(); setSelected(node.id); setMenu({ x: event.clientX, y: event.clientY, node }) } },
            React.createElement('circle', { r: radius, fill: COLORS[node.kind] || COLORS.default }),
            React.createElement('circle', { className: 'rg2-node-ring', r: radius + 3 }),
            React.createElement('text', { x: 0, y: radius + 16 },  node.title.length > 16 ? `${node.title.slice(0, 15)}…` : node.title),
            React.createElement('title', null, `${node.title}\n${node.kind} · ${node.environment}\n右键引用到对话`))
        }))),
    React.createElement(TimelineView, { nodes, edges, selected, scrollLeft: timelineScroll, onScroll: setTimelineScroll, onSelect: (id) => { setSelected(id); setMenu(null) } }),
    selectedNode && React.createElement('section', { className: 'rg2-detail', onWheel: (event) => event.stopPropagation(), onPointerDown: (event) => event.stopPropagation(), onClick: (event) => event.stopPropagation() },
      React.createElement('header', null, React.createElement('div', null, React.createElement('strong', null, selectedNode.title), React.createElement('span', null, `${LABELS[selectedNode.kind] || selectedNode.kind} · ${selectedNode.reference}`)), React.createElement('button', { onClick: () => setSelected(null), title: '关闭正文' }, '×')),
      React.createElement(MarkdownBody, { source: selectedNode.markdown, onWikilink: openWikilink, focusAnchor, titleById, currentId: selectedNode.id })),
    menu && React.createElement('div', { className: 'rg2-menu', style: { left: menu.x, top: menu.y }, onClick: (event) => event.stopPropagation() },
      React.createElement('div', { className: 'rg2-menu-title' }, menu.node.title),
      React.createElement('button', { onClick: () => { onReference(menu.node); setMenu(null) } }, '↳ 引用到当前对话'),
      React.createElement('code', null, menu.node.reference)))
}

function toolResultValue(block) {
  if (block?.kind !== 'tool-result' || block.isError) return null
  const text = (block.content || []).filter((item) => item.type === 'text').map((item) => item.text).join('\n')
  try { return JSON.parse(text) } catch { return null }
}

function ResourceGraphCheckToolView() { return null }

function ResourceGraphToolView(props) {
  const [open, setOpen] = useState(true)
  if (props.toolName && props.toolName !== 'resource_graph_query') return null
  const value = toolResultValue(props.block)
  if (props.block?.kind !== 'tool-result') return React.createElement('div', { className: 'rg2-tool-status' }, '正在查询资源地图…')
  if (!value) return React.createElement('div', { className: 'rg2-tool-status is-error' }, '资源地图查询失败或结果不可视化')
  // Empty graph lookups are often an automatic first-turn context probe. Keep
  // them in the transcript data, but do not render a noisy visual card.
  if (!value.graph?.nodes?.length) return null
  return React.createElement('details', { className: 'rg2-tool-card', open: open, onToggle: (event) => setOpen(event.currentTarget.open) },
    React.createElement('summary', null, React.createElement('strong', null, '资源地图查询'), React.createElement('span', null, `${value.mode || 'query'} · ${value.graph.nodes.length} 节点 · ${value.graph.edges.length} 关系`)),
    open && React.createElement('div', { className: 'rg2-tool-graph' }, React.createElement(GraphBoard, { graph: value.graph, query: '', onReference: () => {} })))
}

function ResourceGraphPanel(props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const { loading, graph, error, initialize } = useGraph(props.sessionId)
  const draft = props.useInput ? props.useInput((state) => state.draft) : ''
  const insertReference = (node) => {
    if (!props.inputActions) return
    const separator = draft && !/\s$/.test(draft) ? ' ' : ''
    props.inputActions.setDraft(`${draft}${separator}${node.reference} `)
    const textarea = document.querySelector('textarea')
    if (textarea) textarea.focus()
  }
  return React.createElement(React.Fragment, null,
    React.createElement('button', { className: `rg2-trigger ${open ? 'is-open' : ''}`, type: 'button', title: '打开资源地图', 'aria-expanded': open, onClick: () => setOpen((value) => !value) }, '资源地图'),
    open && React.createElement('aside', { className: 'rg2-panel' },
      React.createElement('header', null,
        React.createElement('div', null, React.createElement('strong', null, '资源地图'), React.createElement('span', null, graph ? `${graph.project?.path || '当前项目'} · ${graph.stats.nodes} 节点 · ${graph.stats.edges} 关系` : '正在解析当前会话项目…')),
        React.createElement('button', { className: 'rg2-close', onClick: () => setOpen(false), title: '关闭' }, '×')),
      React.createElement('div', { className: 'rg2-search-wrap' }, React.createElement('span', null, '⌕'), React.createElement('input', { autoFocus: true, type: 'search', value: query, placeholder: '搜索 ID、名称、类型、环境…', onChange: (event) => setQuery(event.target.value) })),
      React.createElement('div', { className: 'rg2-hint' }, '滚轮缩放 · 拖动画布或节点 · 全屏 · 右键节点引用到对话'),
      error && React.createElement('div', { className: 'rg2-error' }, error),
      loading && React.createElement('div', { className: 'rg2-loading' }, '正在构建资源视图…'),
      graph && !graph.configured && React.createElement('div', { className: 'rg2-empty' }, React.createElement('button', { className: 'rg2-enable', disabled: loading, onClick: initialize }, loading ? '正在启用…' : '启用资源图')),
      graph?.configured && React.createElement(GraphBoard, { graph, query, onReference: insertReference })))
}

const css = `
.rg2-board{position:relative;min-height:420px;flex:1;overflow:hidden;touch-action:none;background:var(--dsw-alias-bg-base)}.rg2-tool-graph .rg2-board{height:min(62vh,680px);min-height:360px}.rg2-zoom{position:absolute;z-index:6;left:12px;top:10px;display:flex;align-items:center;gap:4px}.rg2-zoom button{width:30px;height:30px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-l1);color:var(--dsw-alias-label-primary);cursor:pointer}.rg2-zoom span{padding-left:5px;font-size:10px;color:var(--dsw-alias-label-caption)}
.rg2-trigger{height:28px;padding:0 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:12px}.rg2-trigger:hover,.rg2-trigger.is-open{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.rg2-panel{position:fixed;z-index:80;right:14px;top:64px;bottom:14px;width:min(58vw,920px);min-width:560px;display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l1);border-radius:16px;background:var(--dsw-alias-bg-base);box-shadow:0 18px 55px rgba(0,0,0,.24);overflow:hidden;color:var(--dsw-alias-label-primary)}
.rg2-panel>header{height:58px;box-sizing:border-box;padding:11px 14px 9px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--dsw-alias-border-l1)}.rg2-panel>header div{display:flex;flex-direction:column}.rg2-panel>header strong{font-size:15px}.rg2-panel>header span{font-size:11px;color:var(--dsw-alias-label-caption);margin-top:2px}.rg2-close{border:0;background:transparent;color:var(--dsw-alias-label-secondary);font-size:24px;cursor:pointer}
.rg2-search-wrap{display:flex;align-items:center;gap:8px;margin:12px 14px 6px;padding:0 11px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-l1)}.rg2-search-wrap input{width:100%;height:38px;border:0;outline:0;background:transparent;color:var(--dsw-alias-label-primary)}.rg2-hint{padding:0 16px 9px;font-size:11px;color:var(--dsw-alias-label-caption)}
.rg2-timeline{position:absolute;z-index:3;left:12px;right:12px;bottom:12px;max-height:210px;padding:8px 10px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:color-mix(in srgb,var(--dsw-alias-bg-base) 95%,transparent);overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.16)}.rg2-gantt-scroll{overflow-x:auto;overflow-y:auto;max-height:190px;scrollbar-gutter:stable}.rg2-gantt-body{min-width:1200px;padding:0 2px 8px}.rg2-time-row{display:grid;grid-template-columns:110px minmax(0,1fr);align-items:start;gap:8px;margin:8px 0}.rg2-time-row>strong{display:flex;flex-direction:column;font-size:10px;color:var(--dsw-alias-label-caption);overflow:hidden;text-overflow:ellipsis}.rg2-time-row>strong small{font-weight:400}.rg2-time-track{position:relative;min-width:360px;border-left:1px solid var(--dsw-alias-border-l1);border-right:1px solid var(--dsw-alias-border-l1);background:linear-gradient(90deg,transparent 49.8%,var(--dsw-alias-border-l1) 50%,transparent 50.2%)}.rg2-time-track button{position:absolute;display:flex;flex-direction:column;align-items:flex-start;min-width:32px;max-width:none;overflow:hidden;padding:5px 8px;border:1px solid color-mix(in srgb,var(--rg2-gantt-color) 78%,var(--dsw-alias-border-l1));border-left:5px solid var(--rg2-gantt-color);border-radius:7px;background:color-mix(in srgb,var(--rg2-gantt-color) 23%,var(--dsw-alias-bg-l1));color:var(--dsw-alias-label-primary);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--rg2-gantt-color) 16%,transparent);cursor:pointer}.rg2-time-track button:hover{background:color-mix(in srgb,var(--rg2-gantt-color) 34%,var(--dsw-alias-bg-l1))}.rg2-time-track button.is-active{border-color:var(--rg2-gantt-color);background:color-mix(in srgb,var(--rg2-gantt-color) 45%,var(--dsw-alias-bg-l1));box-shadow:0 0 0 2px color-mix(in srgb,var(--rg2-gantt-color) 32%,transparent)}.rg2-time-track span{max-width:145px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:10px}.rg2-time-track small{font-size:9px;color:var(--dsw-alias-label-caption)}.rg2-tool-card{margin:6px 0;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;overflow:hidden;background:var(--dsw-alias-bg-base)}.rg2-tool-card>summary{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;cursor:pointer}.rg2-tool-card>summary span{font-size:11px;color:var(--dsw-alias-label-caption)}.rg2-tool-graph{height:460px;border-top:1px solid var(--dsw-alias-border-l1)}.rg2-tool-graph>.rg2-board{height:100%}.rg2-tool-status{padding:10px 12px;color:var(--dsw-alias-label-secondary)}.rg2-tool-status.is-error{color:var(--dsw-alias-state-error-primary)}.rg2-board{position:relative;flex:1;min-height:0;overflow:hidden;cursor:grab;background:radial-gradient(circle at 1px 1px,var(--dsw-alias-border-l1) 1px,transparent 1px);background-size:20px 20px}.rg2-board:active{cursor:grabbing}.rg2-zoom{position:absolute;z-index:3;right:12px;top:10px;display:flex;align-items:center;gap:3px;padding:4px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-base)}.rg2-zoom button{width:27px;height:27px;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer}.rg2-zoom button:hover{background:var(--dsw-alias-interactive-bg-hover)}.rg2-zoom span{width:42px;text-align:center;font-size:10px;color:var(--dsw-alias-label-caption)}
.rg2-board:fullscreen,.rg2-board.is-fullscreen{position:fixed;inset:0;z-index:220;width:100vw;height:100vh;background:var(--dsw-alias-bg-base);border-radius:0}.rg2-node.is-quiet{opacity:.38}.rg2-node.is-quiet text{opacity:0;transition:opacity .15s}.rg2-node.is-quiet:hover{opacity:1}.rg2-node.is-quiet:hover text,.rg2-node.is-selected text{opacity:1}.rg2-cluster circle:first-child{stroke-width:1;stroke-dasharray:5 7;opacity:.82}.rg2-cluster-title{fill:var(--dsw-alias-label-secondary);font-size:12px;font-weight:600}.rg2-edge{fill:none;stroke:var(--dsw-alias-border-l2);stroke-width:1;opacity:.1;transition:opacity .15s,stroke-width .15s}.rg2-edge.is-active{stroke:var(--dsw-alias-state-business-primary);stroke-width:2.4;opacity:.95}.rg2-node{cursor:context-menu;transition:opacity .15s}.rg2-node.is-dim{opacity:.16}.rg2-node-ring{fill:none;stroke:var(--dsw-alias-bg-base);stroke-width:3;opacity:.9}.rg2-node.is-selected .rg2-node-ring{stroke:var(--dsw-alias-label-primary);stroke-width:4}.rg2-node text{fill:var(--dsw-alias-label-primary);font-size:9px;font-weight:600;text-anchor:middle;paint-order:stroke;stroke:var(--dsw-alias-bg-base);stroke-width:3px;pointer-events:none}
.rg2-detail{position:absolute;z-index:4;right:12px;top:52px;bottom:12px;width:min(42%,390px);display:flex;flex-direction:column;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:color-mix(in srgb,var(--dsw-alias-bg-base) 96%,transparent);box-shadow:0 12px 35px rgba(0,0,0,.22);overflow:hidden;cursor:default}.rg2-detail>header{display:flex;align-items:flex-start;justify-content:space-between;padding:12px 13px;border-bottom:1px solid var(--dsw-alias-border-l1)}.rg2-detail>header div{display:flex;min-width:0;flex-direction:column}.rg2-detail>header strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rg2-detail>header span{margin-top:3px;font-size:10px;color:var(--dsw-alias-label-caption)}.rg2-detail>header button{border:0;background:transparent;color:var(--dsw-alias-label-secondary);font-size:20px;cursor:pointer}.rg2-markdown{padding:14px 16px 28px;overflow:auto;font-size:13px;line-height:1.65;color:var(--dsw-alias-label-primary)}.rg2-anchor-focus{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:4px;border-radius:4px;background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 10%,transparent);transition:background .2s}.rg2-markdown h1,.rg2-markdown h2,.rg2-markdown h3,.rg2-markdown h4{margin:1.1em 0 .45em;line-height:1.3}.rg2-markdown h1{font-size:20px}.rg2-markdown h2{font-size:17px}.rg2-markdown h3{font-size:15px}.rg2-markdown p{margin:.55em 0}.rg2-markdown ul{padding-left:20px}.rg2-markdown blockquote{margin:10px 0;padding:2px 12px;border-left:3px solid var(--dsw-alias-state-business-primary);color:var(--dsw-alias-label-secondary)}.rg2-markdown pre{overflow:auto;padding:11px;border-radius:8px;background:var(--dsw-alias-bg-l1)}.rg2-markdown code{padding:1px 4px;border-radius:4px;background:var(--dsw-alias-bg-l1);font-size:11px}.rg2-markdown a,.rg2-wikilink{color:var(--dsw-alias-state-business-primary)}.rg2-wikilink{display:inline;padding:1px 4px;border:0;border-radius:4px;background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 12%,transparent);font:inherit;cursor:pointer}.rg2-wikilink:hover{text-decoration:underline}.rg2-menu{position:fixed;z-index:100;min-width:190px;padding:7px;border:1px solid var(--dsw-alias-border-l1);border-radius:10px;background:var(--dsw-alias-bg-base);box-shadow:0 12px 35px rgba(0,0,0,.3)}.rg2-menu-title{max-width:250px;padding:6px 8px;font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.rg2-menu button{display:block;width:100%;padding:9px 8px;border:0;border-radius:7px;text-align:left;background:transparent;color:var(--dsw-alias-label-primary);cursor:pointer}.rg2-menu button:hover{background:var(--dsw-alias-interactive-bg-hover)}.rg2-menu code{display:block;padding:5px 8px;color:var(--dsw-alias-label-caption);font-size:10px}.rg2-loading,.rg2-error,.rg2-empty{padding:24px;text-align:center;color:var(--dsw-alias-label-secondary)}.rg2-error{color:var(--dsw-alias-state-error-primary)}.rg2-empty{margin:auto;max-width:420px}.rg2-empty strong{color:var(--dsw-alias-label-primary)}.rg2-empty p{line-height:1.6;font-size:12px}.rg2-enable{margin-top:8px;padding:9px 16px;border:0;border-radius:9px;background:var(--dsw-alias-state-business-primary);color:white;cursor:pointer}.rg2-enable:disabled{opacity:.55;cursor:default}
.rg2-star{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;background:radial-gradient(circle at 50% 42%,#141d36 0%,#080d1a 66%,#04060d 100%)}
.rg2-zoom .rg2-mode{width:auto;min-width:34px;padding:0 7px;font-size:10px;font-weight:600;color:var(--dsw-alias-label-secondary)}
.rg2-zoom .rg2-mode.is-active{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 18%,transparent);color:var(--dsw-alias-label-primary);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--dsw-alias-state-business-primary) 45%,transparent)}
.rg2-zoom-sep{width:1px;height:18px;margin:0 3px;background:var(--dsw-alias-border-l1)}
.rg2-board.is-3d .rg2-zoom button:not(.rg2-mode),.rg2-board.is-3d .rg2-zoom span.rg2-zoom-value{display:none}
.rg2-star-error{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);max-width:60%;padding:9px 13px;border-radius:9px;background:color-mix(in srgb,var(--dsw-alias-bg-base) 94%,transparent);color:var(--dsw-alias-state-error-primary);font-size:12px;text-align:center}
@media(max-width:900px){.rg2-panel{left:10px;right:10px;width:auto;min-width:0}}
`

export function apply(ctx) {
  const style = document.createElement('style')
  style.dataset.plugin = PACKAGE_NAME
  style.textContent = css
  document.head.appendChild(style)
  ctx.effect(() => () => style.remove(), 'resource-graph: styles')
  ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({ name: 'conversation.session.header.utilities', id: 'resource-graph', order: 20, label: '资源地图' }, ResourceGraphPanel))
  ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({ name: 'tool.call.toolview', key: 'resource_graph_query' }, ResourceGraphToolView))
  ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({ name: 'tool.call.toolview', key: 'resource_graph_check' }, ResourceGraphCheckToolView))
}
