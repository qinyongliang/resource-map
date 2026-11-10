/**
 * Zero-dependency frontmatter reader for `.resource-map` records.
 *
 * The graph only needs the YAML subset that the strict OKF contract allows:
 * nested mappings, block sequences, quoted and plain scalars, inline `[]`/`{}`,
 * booleans, numbers and null. Keeping this parser inside the package is what
 * lets `.resource-map/plugin/` run with no `node_modules` at all, so a project
 * opened outside DSH keeps an identical graph tool.
 */

const TRUTHY = new Set(['true', 'yes', 'on'])
const FALSY = new Set(['false', 'no', 'off'])

function stripComment(value) {
  let quote = null
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (quote) {
      if (char === quote) quote = null
      continue
    }
    if (char === '"' || char === "'") { quote = char; continue }
    if (char === '#' && (index === 0 || /\s/.test(value[index - 1]))) return value.slice(0, index).trimEnd()
  }
  return value
}

function parseScalar(raw) {
  const value = raw.trim()
  if (value === '' || value === '~' || value === 'null' || value === 'Null' || value === 'NULL') return null
  if (value.length >= 2) {
    const first = value[0]; const last = value[value.length - 1]
    if (first === '"' && last === '"') return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\')
    if (first === "'" && last === "'") return value.slice(1, -1).replace(/''/g, "'")
  }
  if (value === '[]') return []
  if (value === '{}') return {}
  if (value.startsWith('[') && value.endsWith(']')) {
    return value.slice(1, -1).split(',').map((part) => part.trim()).filter(Boolean).map(parseScalar)
  }
  if (value.startsWith('{') && value.endsWith('}')) {
    const result = {}
    for (const part of value.slice(1, -1).split(',')) {
      const separator = part.indexOf(':')
      if (separator < 0) continue
      result[parseScalar(part.slice(0, separator))] = parseScalar(part.slice(separator + 1))
    }
    return result
  }
  if (TRUTHY.has(value.toLowerCase())) return true
  if (FALSY.has(value.toLowerCase())) return false
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][-+]?\d+)?$/.test(value)) return Number(value)
  return value
}

function isSequenceLine(line) { return /^\s*-(\s|$)/.test(line) }

/**
 * Parse a block of YAML lines into plain JavaScript values.
 * Only block-style mappings and sequences are supported, which is the shape the
 * strict resource contract accepts; flow collections are handled as scalars.
 */
export function parseFrontmatter(source) {
  const lines = String(source ?? '').split(/\r?\n/)
  let index = 0

  function indentOf(line) { return line.length - line.trimStart().length }

  function skipBlank() {
    while (index < lines.length) {
      const trimmed = lines[index].trim()
      if (trimmed !== '' && !trimmed.startsWith('#')) return
      index += 1
    }
  }

  function parseBlock(indent) {
    skipBlank()
    if (index >= lines.length) return null
    return isSequenceLine(lines[index]) ? parseSequence(indent) : parseMapping(indent)
  }

  function parseSequence(indent) {
    const items = []
    while (index < lines.length) {
      skipBlank()
      if (index >= lines.length) break
      const line = lines[index]
      if (indentOf(line) !== indent || !isSequenceLine(line)) break
      const rest = stripComment(line.trimStart().slice(1)).trim()
      index += 1
      if (rest === '') {
        items.push(parseBlock(nextIndent(indent)))
      } else if (/^[^:]+:\s*$/.test(rest) || /^[^:]+:\s+\S/.test(rest)) {
        // "- key: value" starts a mapping item; reparse the remainder as its first entry.
        const separator = rest.indexOf(':')
        const key = rest.slice(0, separator).trim()
        const value = rest.slice(separator + 1).trim()
        const item = {}
        item[parseKey(key)] = value === '' ? parseBlock(nextIndent(indent)) : parseScalar(value)
        collectMappingContinuation(item, indent + 2)
        items.push(item)
      } else {
        items.push(parseScalar(rest))
      }
    }
    return items
  }

  function collectMappingContinuation(target, indent) {
    while (index < lines.length) {
      skipBlank()
      if (index >= lines.length) break
      const line = lines[index]
      if (indentOf(line) < indent || isSequenceLine(line)) break
      if (indentOf(line) !== indent) break
      const separator = line.indexOf(':')
      if (separator < 0) break
      const key = line.slice(indentOf(line), separator).trim()
      const value = stripComment(line.slice(separator + 1)).trim()
      index += 1
      target[parseKey(key)] = value === '' ? parseBlock(nextIndent(indent)) : parseScalar(value)
    }
  }

  function parseMapping(indent) {
    const result = {}
    while (index < lines.length) {
      skipBlank()
      if (index >= lines.length) break
      const line = lines[index]
      if (isSequenceLine(line) || indentOf(line) < indent) break
      if (indentOf(line) > indent) { index += 1; continue }
      const separator = line.indexOf(':')
      if (separator < 0) { index += 1; continue }
      const key = line.slice(indentOf(line), separator).trim()
      const value = stripComment(line.slice(separator + 1)).trim()
      index += 1
      result[parseKey(key)] = value === '' ? parseBlock(nextIndent(indent)) : parseScalar(value)
    }
    return result
  }

  function nextIndent(current) {
    for (let cursor = index; cursor < lines.length; cursor += 1) {
      const trimmed = lines[cursor].trim()
      if (trimmed === '' || trimmed.startsWith('#')) continue
      return indentOf(lines[cursor])
    }
    return current
  }

  function parseKey(key) {
    const trimmed = key.trim()
    if (trimmed.length >= 2) {
      const first = trimmed[0]; const last = trimmed[trimmed.length - 1]
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) return trimmed.slice(1, -1)
    }
    return trimmed
  }

  const value = parseBlock(0)
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}
