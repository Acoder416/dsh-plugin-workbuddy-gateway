/**
 * Report which WorkBuddy models will show a reasoning menu in DSH's picker.
 *
 * Runs the plugin's own derivation against a live gateway listing, so the answer
 * comes from the same code the settings page uses rather than from reading the
 * gateway's fields by eye.
 *
 * Usage:
 *   node scripts/reasoning-report.mjs [gatewayPort] [apiKey]
 *
 * The key defaults to `WORKBUDDY_API_KEY` from the environment, then from
 * `$DSH_HOME/.credentials.yaml`.
 */

import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { buildProviderEntry } from '../src/provider-route.js'

const port = process.argv[2] ?? '18088'

/** Resolve the bearer token the same way the plugin does. */
function apiKey() {
  if (process.env.WORKBUDDY_API_KEY) return process.env.WORKBUDDY_API_KEY
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  try {
    const text = readFileSync(join(home, '.credentials.yaml'), 'utf8')
    const match = /^\s*WORKBUDDY_API_KEY:\s*(\S+)\s*$/m.exec(text)
    return match?.[1]
  } catch {
    return undefined
  }
}

const key = apiKey()
if (key === undefined) {
  console.error('no WORKBUDDY_API_KEY available')
  process.exit(2)
}

const response = await fetch(`http://127.0.0.1:${port}/v1/models`, {
  headers: { authorization: `Bearer ${key}` },
})
if (!response.ok) {
  console.error(`gateway returned HTTP ${String(response.status)} — is it running?`)
  process.exit(1)
}
const listing = await response.json()
const models = Array.isArray(listing.data) ? listing.data : []

const entry = buildProviderEntry({ baseUrl: `http://127.0.0.1:${port}/v1`, apiKeyRef: 'WORKBUDDY_API_KEY', models })

console.log(`${String(entry.models.length)} model(s) as the plugin writes them\n`)
console.log(`${'model'.padEnd(20)} ${'menu'.padEnd(6)} levels`)
console.log('-'.repeat(70))

let menu = 0
for (const model of entry.models) {
  const efforts = model.reasoningEfforts
  const levels = efforts === undefined ? [] : Object.keys(efforts)
  const selectable = levels.filter((level) => level !== 'off')
  const shown = selectable.length > 1 ? 'YES' : 'no'
  if (shown === 'YES') menu += 1
  console.log(`${model.id.padEnd(20)} ${shown.padEnd(6)} ${levels.join(', ') || '—'}`)
}

console.log(`\n${String(menu)} of ${String(entry.models.length)} offer a reasoning menu`)
