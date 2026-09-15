/**
 * End-to-end check of interpreter resolution plus a real gateway boot.
 *
 * Runs the supervisor for real — no fake spawn — with `pythonPath` unnamed, so it
 * exercises exactly what a fresh install on an unverified platform does: probe
 * for an interpreter, spawn the vendored gateway, detect readiness from its log,
 * then shut it down.
 *
 * Usage: node scripts/verify-platform-boot.mjs [port]
 */

import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Gateway, pythonCandidates } from '../src/gateway.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.argv[2] ?? 18095)
const stateDir = mkdtempSync(join(tmpdir(), 'wb-boot-'))

let failed = false
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${detail === '' ? '' : ` — ${detail}`}`)
  if (!ok) failed = true
}

console.log(`platform      : ${process.platform}`)
console.log(`candidates    : ${pythonCandidates(process.platform).join(', ')}`)
console.log(`state dir     : ${stateDir}\n`)

const gateway = new Gateway({
  spawn,
  settings: () => ({
    port,
    autoStart: true,
    providerSync: false,
    gatewayDir: '',
    pythonPath: '',
    realm: null,
  }),
  paths: () => ({
    script: join(root, 'vendor', 'workbuddy-gateway', 'wb_proxy.py'),
    cwd: join(root, 'vendor', 'workbuddy-gateway'),
    accountsDir: join(stateDir, 'accounts'),
    usageDir: join(stateDir, 'usage'),
  }),
})

try {
  const result = await gateway.start()
  const reading = gateway.snapshot()

  check('the gateway started', result.ok, result.error ?? '')
  check('it reported readiness', reading.baseUrl !== null, String(reading.baseUrl))
  // The whole point: the interpreter was chosen, not assumed.
  check('the probe recorded an interpreter', typeof reading.pythonPath === 'string' && reading.pythonPath !== '', reading.pythonPath)
  check('the probe line is in the log', reading.log.some((entry) => entry.text.includes('starting gateway:')))

  if (result.ok && reading.baseUrl !== null) {
    const health = await fetch(`${reading.baseUrl.replace(/\/v1$/, '')}/health`)
    check('the gateway answers /health', health.ok, `HTTP ${String(health.status)}`)
  }

  await gateway.stop()
  check('it stopped cleanly', gateway.state === 'stopped', gateway.state)
  check('the child is gone', gateway.snapshot().pid === null)
} catch (error) {
  check('the run completed without throwing', false, error.message)
} finally {
  rmSync(stateDir, { recursive: true, force: true })
}

console.log(failed ? '\nRESULT: FAILED' : '\nRESULT: OK')
process.exit(failed ? 1 : 0)
