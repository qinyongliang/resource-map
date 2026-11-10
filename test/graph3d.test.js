import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const ROOT = join(import.meta.dirname, '..')

/** A recording 2D context plus a fake element, enough to exercise the renderer. */
function harness() {
  const calls = { clearRect: 0, arc: 0, stroke: 0, fillText: 0, gradient: 0 }
  const context = new Proxy({
    setTransform() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() { calls.stroke += 1 },
    arc() { calls.arc += 1 }, fill() {}, clearRect() { calls.clearRect += 1 },
    fillText() { calls.fillText += 1 }, strokeText() {}, save() {}, restore() {},
    createRadialGradient() { calls.gradient += 1; return { addColorStop() {} } },
  }, { set() { return true }, get(target, key) { return key in target ? target[key] : undefined } })

  const listeners = new Map()
  const element = {
    width: 0, height: 0, style: {},
    getContext: () => context,
    getBoundingClientRect: () => ({ width: 640, height: 420, left: 0, top: 0 }),
    setPointerCapture() {}, releasePointerCapture() {},
    addEventListener(type, handler) { listeners.set(`${type}:${handler.name || 'anon'}`, handler) },
    removeEventListener(type, handler) { listeners.delete(`${type}:${handler.name || 'anon'}`) },
  }
  return { element, calls, listeners }
}

function withDom(run) {
  const previous = { window: globalThis.window, document: globalThis.document, raf: globalThis.requestAnimationFrame, caf: globalThis.cancelAnimationFrame, ro: globalThis.ResizeObserver }
  const frames = { scheduled: 0, cancelled: 0 }
  const windowListeners = new Map()
  globalThis.requestAnimationFrame = () => { frames.scheduled += 1; return frames.scheduled }
  globalThis.cancelAnimationFrame = () => { frames.cancelled += 1 }
  globalThis.window = {
    devicePixelRatio: 1,
    addEventListener(type, handler) { windowListeners.set(type, handler) },
    removeEventListener(type) { windowListeners.delete(type) },
  }
  globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {} }
  try { return run(frames, windowListeners) } finally {
    globalThis.window = previous.window; globalThis.document = previous.document
    globalThis.requestAnimationFrame = previous.raf; globalThis.cancelAnimationFrame = previous.caf
    globalThis.ResizeObserver = previous.ro
  }
}

test('graph3d is a standalone lazy module that exports the renderer factory', () => {
  const source = readFileSync(join(ROOT, 'lib', 'graph3d.js'), 'utf8')
  assert.match(source, /export function createStarMap/)
  assert.doesNotMatch(source, /^\s*import\s/m)
  assert.match(readFileSync(join(ROOT, 'package.json'), 'utf8'), /"\.\/graph3d": "\.\/lib\/graph3d\.js"/)
})

test('createStarMap renders a scene and dispose releases every resource', async () => {
  const { createStarMap } = await import('../lib/graph3d.js')
  const { element, calls, listeners } = harness()
  await withDom((frames, windowListeners) => {
    const map = createStarMap(element, { colors: { service: '#77a83f', default: '#718096' }, onSelect: () => {} })
    map.setGraph(
      [{ id: 'a', kind: 'service', title: 'Alpha' }, { id: 'b', kind: 'service', title: 'Beta' }],
      [{ source: 'a', relation: 'depends_on', target: 'b' }],
    )
    map.setSelected('a')
    assert.ok(calls.arc > 0, 'nodes must be painted')
    assert.ok(calls.gradient > 0, 'nodes must get a glow')
    assert.ok(frames.scheduled >= 1, 'an animation frame must be scheduled while alive')
    assert.ok(listeners.size > 0, 'pointer listeners must be attached')
    assert.ok(windowListeners.has('keydown'), 'the escape listener must be attached')

    map.dispose()
    assert.equal(map.disposed, true)
    assert.ok(frames.cancelled >= 1, 'the animation frame must be cancelled on dispose')
    assert.equal(listeners.size, 0, 'canvas listeners must be removed on dispose')
    assert.equal(windowListeners.has('keydown'), false, 'window listeners must be removed on dispose')
    map.dispose()
  })
})

test('the built client loads the 3D view on demand and defaults to 2D', () => {
  const source = readFileSync(join(ROOT, 'lib', 'client.js'), 'utf8')
  assert.match(source, /import\(\/\* @vite-ignore \*\/ GRAPH3D_URL\)/)
  assert.match(source, /const GRAPH3D_URL = '\/api\/resource-graph\/graph3d\.js'/)
  assert.match(source, /localStorage\.setItem\(VIEW_MODE_KEY/)
  assert.match(source, /localStorage\.getItem\(VIEW_MODE_KEY\) === VIEW_3D \? VIEW_3D : VIEW_2D/)
  assert.match(source, /instance\?\.dispose\(\)/)
  assert.match(source, /instanceRef\.current = null/)
})
