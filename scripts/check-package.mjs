/**
 * Pre-publish check for the things that only break after someone installs this.
 *
 * Unit tests cannot catch these: they assert behavior, not packaging. A path
 * listed in `files` that does not exist, an `exports` entry pointing at a moved
 * file, a version that drifted from the host half's own marker, or a
 * machine-specific absolute path left in shipped source — each of them passes
 * every test in this repository and still ruins a fresh install.
 *
 * Run from the package root: `node scripts/check-package.mjs`
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

let failed = false
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${detail === '' ? '' : ` — ${detail}`}`)
  if (!ok) failed = true
}

/** Every file a `files` entry would publish, expanded one level for directories. */
function published(entry) {
  const path = join(root, entry)
  if (!existsSync(path)) return { path: entry, exists: false, files: [] }
  if (!statSync(path).isDirectory()) return { path: entry, exists: true, files: [entry] }
  const files = []
  const walk = (relative) => {
    for (const name of readdirSync(join(root, relative))) {
      if (name === 'node_modules' || name === '__pycache__') continue
      const child = `${relative}/${name}`
      if (statSync(join(root, child)).isDirectory()) walk(child)
      else files.push(child)
    }
  }
  walk(entry)
  return { path: entry, exists: true, files }
}

const entries = pkg.files ?? []
check('package.json declares a files list', entries.length > 0)
for (const entry of entries) {
  const result = published(entry)
  check(`files entry exists: ${entry}`, result.exists)
}

// Everything a consumer or the loader resolves by name must be present.
const required = [
  ['main', pkg.main],
  ['exports["."]', pkg.exports?.['.']],
  ['exports["./client"]', pkg.exports?.['./client']],
  ['exports["./package.json"]', pkg.exports?.['./package.json']],
  ['dsh.bundle.patch', pkg.dsh?.bundle?.patch],
]
for (const [label, relative] of required) {
  check(`declared path resolves: ${label}`, typeof relative === 'string' && existsSync(join(root, relative)), relative ?? '(absent)')
}

// The client bundle has to be inside a published directory, or the browser half
// ships as a 404. Paths are compared without their `./` prefix: `files` entries
// are bare while `exports` values are conventionally prefixed.
const clientPath = pkg.exports?.['./client']
if (typeof clientPath === 'string') {
  const normalized = clientPath.replace(/^\.\//, '')
  const covered = entries.some((entry) => {
    const bare = entry.replace(/^\.\//, '')
    return normalized === bare || normalized.startsWith(`${bare}/`)
  })
  check('the client bundle is covered by files', covered, clientPath)
}

// The host half reports a version the settings page displays; a drift is a lie.
const indexSource = readFileSync(join(root, 'src/index.js'), 'utf8')
const marker = /export const PLUGIN_VERSION = '([^']+)'/.exec(indexSource)
check('the source declares a plugin version', marker !== null)
if (marker !== null) {
  check('package.json and the source agree on the version', marker[1] === pkg.version, `source ${marker[1]} vs package ${pkg.version}`)
}

// A machine-specific absolute path in shipped code is a fresh-install failure.
const suspect = /['"`]([A-Za-z]:[\\/]|\/Users\/|\/home\/)[^'"`]*['"`]/g
const scanned = []
for (const entry of entries) {
  for (const file of published(entry).files) {
    if (!/\.(js|mjs)$/.test(file)) continue
    // Tests and dev scripts may legitimately reference a local checkout.
    if (file.startsWith('tests/') || file.startsWith('scripts/')) continue
    scanned.push(file)
    const text = readFileSync(join(root, file), 'utf8')
    for (const match of text.matchAll(suspect)) {
      check(`no absolute path in shipped source: ${file}`, false, match[0])
    }
  }
}
check(`scanned shipped JS for absolute paths (${String(scanned.length)} file(s))`, true)

// The bundle patch has to name this package, or the profile mounts nothing.
const patch = readFileSync(join(root, pkg.dsh?.bundle?.patch ?? 'cordis.patch.yml'), 'utf8')
check('the bundle patch inserts this package', patch.includes(pkg.name), `expected ${pkg.name}`)

console.log(failed ? '\nRESULT: FAILED' : '\nRESULT: OK')
process.exit(failed ? 1 : 0)
