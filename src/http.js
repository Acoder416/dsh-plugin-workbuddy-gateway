/**
 * Minimal HTTP helpers for this plugin's routes: JSON serialization, a
 * same-origin guard for mutating endpoints, and a size-capped body reader.
 * Mirrors the conventions the other community plugins on this host use.
 *
 * @module dsh-plugin-workbuddy-gateway/http
 */

/** Write one JSON payload with no-store caching. */
export function sendJson(response, status, payload) {
  response.writeHead(status, {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  })
  response.end(JSON.stringify(payload))
}

/**
 * True when the request's Origin matches its Host. Required on every route that
 * changes host state, so a cross-site page cannot reach it.
 */
export function sameOrigin(request) {
  const origin = request.headers.origin
  const host = request.headers.host
  if (origin === undefined || host === undefined) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

/** Read and parse a JSON request body, rejecting anything over the cap. */
export async function readJsonBody(request, maxBytes = 65536) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > maxBytes) throw new Error('request body too large')
    chunks.push(buffer)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (text.trim() === '') return {}
  return JSON.parse(text)
}

/** Answer a route that was called with the wrong verb. */
export function methodNotAllowed(response, allow) {
  response.writeHead(405, { allow, 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify({ ok: false, error: { code: 'method-not-allowed', message: `use ${allow}` } }))
}

/** Answer a mutating route reached from another origin. */
export function refuseOrigin(response) {
  sendJson(response, 403, {
    ok: false,
    error: { code: 'cross-origin', message: 'this route only accepts same-origin requests' },
  })
}

/** Turn any thrown value into a message that is safe to serialize. */
export function messageOf(error) {
  if (error instanceof Error) return error.message
  return String(error)
}
