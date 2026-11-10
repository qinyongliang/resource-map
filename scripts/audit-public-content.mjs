import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(process.argv[2] || fileURLToPath(new URL('..', import.meta.url)))
const allowed = new Set(['.js', '.mjs', '.md', '.json', '.yml', '.yaml'])
const rules = [
  ['private IPv4 address', /\b(?:10\.(?:\d{1,3}\.){2}\d{1,3}|192\.168\.(?:\d{1,3}\.)\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.(?:\d{1,3}\.)\d{1,3})\b/g],
  ['loopback address', /\b(?:127\.0\.0\.1|localhost|host\.docker\.internal)\b/gi],
  ['secret assignment', /\b(?:password|passwd|secret|token|access[_-]?key|private[_-]?key)\s*[:=]\s*["']?[^\s"'<>]{6,}/gi],
  ['private key material', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['absolute home path', /\/(?:home|Users)\/[A-Za-z0-9._-]+\//g],
]
const ignore = new Set(['node_modules', '.git', 'lib'])
const files = []
function walk(path) { for (const entry of readdirSync(path, { withFileTypes: true })) { if (ignore.has(entry.name)) continue; const target = join(path, entry.name); if (entry.isDirectory()) walk(target); else if (allowed.has(extname(entry.name))) files.push(target) } }
walk(root)
const failures = []
const selfPath = resolve(fileURLToPath(import.meta.url))
for (const file of files) { if (resolve(file) === selfPath) continue; const text = readFileSync(file, 'utf8'); for (const [label, regex] of rules) { const portablePath = relative(root, file).split(sep).join('/')
    if (label === 'loopback address' && /(?:src\/core\.js|test\/.*\.test\.js)$/.test(portablePath)) continue; regex.lastIndex = 0; for (const match of text.matchAll(regex)) failures.push(`${portablePath}: ${label}: ${match[0].slice(0, 80)}`) } }
if (failures.length) { console.error(failures.join('\n')); process.exit(1) }
console.log(`Public content audit passed: ${files.length} files`)
