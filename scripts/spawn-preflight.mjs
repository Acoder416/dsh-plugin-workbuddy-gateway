/**
 * A spawn pre-flight for the gateway this plugin supervises.
 *
 * The host half spawns Python with piped stdio and reads the readiness line off
 * it. That combination is not guaranteed by Node alone — a confined sandbox can
 * refuse piped child stdio outright — so this proves the whole mechanism works
 * on the machine about to rely on it, before the plugin does.
 *
 * Run: `npm run preflight`
 *
 * Exits non-zero when spawn, streaming, or a clean kill does not work here.
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

/**
 * Find the plugin root by walking up for the vendored gateway.
 *
 * The caller may pass the plugin root or any directory inside it — the host half
 * passes its own `src/` — so the argument is a starting point rather than an
 * exact answer. Resolving this wrongly is how a configured gateway path gets
 * mistaken for a bundled one.
 *
 * @param {string} start - directory to search upward from.
 * @returns {string|null} the plugin root, or null when no vendored gateway is above `start`.
 */
export function pluginRootFrom(start) {
  let dir = resolve(start)
  for (let depth = 0; depth < 6; depth += 1) {
    if (existsSync(join(dir, 'vendor', 'workbuddy-gateway', 'wb_proxy.py'))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

/** The Python the plugin would use; `spawn` resolves a bare name through PATH. */
function pythonCommand() {
  return process.env.WORKBUDDY_PYTHON ?? 'python'
}

const script = `
import sys, time
print("gateway-boot", flush=True)
for i in range(3):
    print("tick %d" % i, file=sys.stderr, flush=True)
    time.sleep(0.2)
print("listening  : http://127.0.0.1:18088/v1", flush=True)
time.sleep(30)
`

let failed = false
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${detail === '' ? '' : ` — ${detail}`}`)
  if (!ok) failed = true
}

/**
 * The pre-flight itself.
 *
 * Runs only when this file is the entry point, so importing `pluginRootFrom`
 * (which tests do) does not spawn a Python interpreter as a side effect.
 *
 * @returns {Promise<number>} the process exit code.
 */
async function preflight() {
  const root = pluginRootFrom(dirname(fileURLToPath(import.meta.url)))
  check(
    'the vendored gateway is present',
    root !== null,
    root === null ? 'no vendor/workbuddy-gateway/wb_proxy.py found upward from here' : root,
  )

  // 1. The interpreter the plugin will spawn must exist and run.
  const probe = spawn(pythonCommand(), ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] })
  const version = await new Promise((resolveVersion) => {
    let text = ''
    probe.stdout.on('data', (chunk) => { text += String(chunk) })
    probe.stderr.on('data', (chunk) => { text += String(chunk) })
    probe.on('error', (error) => resolveVersion(`error: ${error.message}`))
    probe.on('exit', (code) => resolveVersion(`${text.trim()} (exit ${String(code)})`))
  })
  check(`the interpreter runs: ${pythonCommand()}`, !version.startsWith('error:'), version)

  // 2. Piped stdio, line streaming, readiness detection, and a clean kill.
  const child = spawn(pythonCommand(), ['-u', '-c', script], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
    env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' },
  })

  const lines = []
  let spawnError = null
  child.on('error', (error) => { spawnError = error })
  for (const [stream, label] of [[child.stdout, 'stdout'], [child.stderr, 'stderr']]) {
    const reader = createInterface({ input: stream })
    reader.on('line', (line) => { lines.push({ label, line }) })
  }

  const exited = new Promise((resolveExit) => child.on('exit', (code, signal) => resolveExit({ code, signal })))
  await new Promise((resolveWait) => { setTimeout(resolveWait, 1500) })

  check('spawn with piped stdio works', spawnError === null, spawnError?.message ?? '')
  const stdout = lines.filter((entry) => entry.label === 'stdout').map((entry) => entry.line)
  const stderr = lines.filter((entry) => entry.label === 'stderr').map((entry) => entry.line)
  check('stdout streams incrementally', stdout.includes('gateway-boot'))
  check('stderr streams incrementally', stderr.length >= 3, `${String(stderr.length)} line(s)`)
  check(
    'the readiness line is recognizable',
    stdout.some((line) => /listening\s*:\s*(http:\/\/\S+)/.test(line)),
  )

  child.kill()
  const result = await Promise.race([
    exited,
    new Promise((resolveTimeout) => { setTimeout(() => resolveTimeout({ code: 'TIMEOUT', signal: null }), 5000) }),
  ])
  check('the child terminates on kill', result.code !== 'TIMEOUT', JSON.stringify(result))

  console.log(failed ? '\nRESULT: FAILED' : '\nRESULT: OK')
  return failed ? 1 : 0
}

const invokedDirectly = process.argv[1] !== undefined
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) process.exit(await preflight())
