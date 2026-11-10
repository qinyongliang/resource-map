#!/usr/bin/env node
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const packageName = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).name
const out = resolve(root, 'lib')
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
for (const file of ['frontmatter.js', 'resource-skill-templates.js', 'core.js', 'query.js', 'index.js']) cpSync(resolve(root, 'src', file), resolve(out, file))
// The 3D star map is served as its own ES module and loaded on demand, so it is
// copied verbatim instead of being bundled into the client factory.
cpSync(resolve(root, 'src', 'graph3d.js'), resolve(out, 'graph3d.js'))

let client = readFileSync(resolve(root, 'src/client.js'), 'utf8')
client = client.replaceAll('__PACKAGE_NAME__', packageName)
client = client
  .replace("import React, { useEffect, useMemo, useRef, useState } from 'react'", "const React = require('react')\nconst { useEffect, useMemo, useRef, useState } = React")
  .replace('export const inject =', 'const inject =')
  .replace('export function wikilinkDisplay', 'function wikilinkDisplay')
  .replace('export function apply(ctx)', 'function apply(ctx)')
const bundled = `window.__ModuleLoader__.load({\n  id: '${packageName}',\n  factory: (require) => {\n    const module = { exports: {} }\n    const exports = module.exports\n${client.split('\n').map((line) => line ? `    ${line}` : '').join('\n')}\n    exports.inject = inject\n    exports.apply = apply\n    return module.exports\n  },\n})\n`
writeFileSync(resolve(out, 'client.js'), bundled)
console.log('Built host modules and browser ModuleLoader bundle')
