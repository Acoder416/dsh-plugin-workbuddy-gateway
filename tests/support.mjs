/**
 * A fake child process for driving `Gateway` without spawning Python.
 *
 * It models exactly what the supervisor observes: two readable output streams,
 * `pid`, `kill()`, and `exit`/`error` events. Output is emitted on demand so a
 * test can decide when (and whether) the readiness line arrives.
 *
 * @module dsh-plugin-workbuddy-gateway/tests/support
 */

import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'

/** Build one controllable fake child. */
export function fakeChild({ pid = 4242 } = {}) {
  const child = new EventEmitter()
  child.pid = pid
  child.stdout = new PassThrough()
  child.stderr = new PassThrough()
  child.exitCode = null
  child.signalCode = null
  child.killed = false
  child.killRequests = 0

  /** Emit one stdout line, as the real gateway does when it starts serving. */
  child.emitLine = (line) => {
    child.stdout.write(`${line}\n`)
  }

  /** Emit one stderr line. */
  child.emitError = (line) => {
    child.stderr.write(`${line}\n`)
  }

  /** Emit a readiness line for a port, matching the real gateway's phrasing. */
  child.announceReady = (port = 18088) => {
    child.emitLine(`[wb-proxy] 12:00:00 listening  : http://127.0.0.1:${port}/v1  (api key: on)`)
  }

  /** Terminate the child, as `kill()` would. */
  child.finish = (code = 0, signal = null) => {
    child.exitCode = code
    child.signalCode = signal
    child.emit('exit', code, signal)
  }

  child.kill = () => {
    child.killRequests += 1
    child.killed = true
    // A real kill settles asynchronously; mirror that so the supervisor's
    // exit bookkeeping is exercised rather than short-circuited.
    setImmediate(() => child.finish(null, 'SIGTERM'))
    return true
  }

  return child
}

/**
 * A `spawn` stand-in that records every call and hands back one fake child.
 *
 * @returns {{spawn: Function, calls: object[], children: object[], last: () => object}}
 */
export function fakeSpawn() {
  const calls = []
  const children = []
  const spawn = (command, args, options) => {
    const child = fakeChild({ pid: 4000 + children.length })
    calls.push({ command, args, options })
    children.push(child)
    return child
  }
  return { spawn, calls, children, last: () => children[children.length - 1] }
}

/**
 * A fake `webServer` that records registered routes so tests can call them.
 *
 * @returns {{register: Function, routes: Map<string, object>, call: Function}}
 */
export function fakeWebServer() {
  const routes = new Map()
  return {
    routes,
    register(route) {
      routes.set(`${route.kind}:${route.path}`, route)
      return () => routes.delete(`${route.kind}:${route.path}`)
    },
    /** Invoke one registered route with a minimal fake request/response pair. */
    async call(path, { method = 'GET', body, headers = {} } = {}) {
      const route = routes.get(`exact:${path}`) ?? routes.get(`prefix:${path}`)
      if (route === undefined) throw new Error(`no route registered for ${path}`)
      const request = {
        method,
        url: path,
        headers: { host: '127.0.0.1:3080', origin: 'http://127.0.0.1:3080', ...headers },
        async *[Symbol.asyncIterator]() {
          if (body !== undefined) yield Buffer.from(JSON.stringify(body))
        },
      }
      let settled = null
      const response = {
        statusCode: null,
        headers: null,
        payload: null,
        writeHead(status, responseHeaders) {
          this.statusCode = status
          this.headers = responseHeaders
        },
        end(text) {
          this.payload = text === undefined ? null : JSON.parse(text)
          settled = this
        },
      }
      await route.handler(request, response)
      if (settled === null) throw new Error('route never answered')
      return settled
    },
  }
}
