import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'

test('gateway controls mount on their bundle detail page and unregister with the slot', () => {
  const registrations = new Map()
  let client
  let install
  runInNewContext(readFileSync(new URL('../src/client/index.js', import.meta.url), 'utf8'), {
    window: { __ModuleLoader__: { load: ({ factory }) => { client = factory(() => ({})) } } },
  })
  client.apply({ effect: () => {}, slots: {
    inject: (name, callback) => {
      assert.equal(name, 'plugins.bundle.config')
      install = callback
    },
    register: (options, component) => {
      assert.equal(options.name, 'plugins.bundle.config')
      assert.equal(options.key, 'dsh-plugin-workbuddy-gateway')
      registrations.set(options.key, component)
      return () => registrations.delete(options.key)
    },
  } })
  // The host declares the slot before activating its pending registrations.
  assert.equal(registrations.size, 0)
  const dispose = install()
  assert.equal(typeof registrations.get('dsh-plugin-workbuddy-gateway'), 'function')
  assert.equal(registrations.size, 1)
  dispose()
  assert.equal(registrations.size, 0)
})
