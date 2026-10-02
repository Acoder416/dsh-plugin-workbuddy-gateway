import assert from 'node:assert/strict'
import { test } from 'node:test'

import { sameOrigin } from '../src/http.js'

test('Desktop requests without Origin are accepted from dsh-app://app', () => {
  assert.equal(sameOrigin({
    headers: {
      host: '127.0.0.1:3080',
      referer: 'dsh-app://app/index.html',
    },
  }), true)
})

test('missing Origin without the Desktop app referer is rejected', () => {
  assert.equal(sameOrigin({ headers: { host: '127.0.0.1:3080' } }), false)
})

test('only the exact Desktop app referer is accepted as the fallback', () => {
  for (const referer of ['http://app/index.html', 'dsh-app://other/index.html', 'not a URL']) {
    assert.equal(sameOrigin({
      headers: { host: '127.0.0.1:3080', referer },
    }), false, referer)
  }
})

test('a request without Host is rejected even with the Desktop app referer', () => {
  assert.equal(sameOrigin({
    headers: { referer: 'dsh-app://app/index.html' },
  }), false)
})

test('an explicit cross-origin Origin remains rejected', () => {
  assert.equal(sameOrigin({
    headers: {
      host: '127.0.0.1:3080',
      origin: 'http://evil.example',
      referer: 'dsh-app://app/index.html',
    },
  }), false)
})
