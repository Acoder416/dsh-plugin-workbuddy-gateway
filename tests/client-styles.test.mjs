/**
 * Settings-page styling regressions.
 *
 * The settings page now renders through the Jet Hub style system — CSS classes
 * plus one injected `<style>`, mirroring `iJetLi/deepseek-harness-codearts`
 * (`plugin-src/client/jet-hub-styles.js`) — instead of a per-element inline
 * `style` object. These assertions pin the three things that made it work:
 *
 *   1. the sheet is injected exactly once, even if the effect is re-entered;
 *   2. `apply()` installs it through `ctx.effect`, so it leaves with the plugin;
 *   3. the rendered tree carries `className` and no inline `style`, because an
 *      inline style object cannot express the theme's `--dsw-alias-*` cascade.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { runInNewContext } from 'node:vm'

const source = readFileSync(new URL('../src/client/index.js', import.meta.url), 'utf8')

/** A `document` stub that really tracks what is attached to `<head>`. */
function makeDocument() {
  const head = { children: [] }
  head.appendChild = (node) => { head.children.push(node) }
  const document = {
    head,
    createElement(tag) {
      const node = { tag, textContent: '' }
      node.remove = () => {
        const index = head.children.indexOf(node)
        if (index >= 0) head.children.splice(index, 1)
      }
      return node
    },
  }
  return { document, head }
}

/** The inert React stand-in the other client tests use. */
function fakeReact(data) {
  let hookIndex = 0
  return {
    createElement: (type, props, ...children) => ({ type, props, children: children.flat(Infinity) }),
    useState: (initial) => [hookIndex++ === 0 ? { phase: 'ready', data } : initial, () => {}],
    useRef: (current) => ({ current }),
    useCallback: (callback) => callback,
    useEffect: () => {},
  }
}

/** Load the factory with a stub host and hand back what `apply()` registered. */
function loadHost({ document, data = runningData(), language = 'en' }) {
  const effects = []
  let section = null
  const context = {
    navigator: { language },
    window: { __ModuleLoader__: { load({ factory }) {
      factory(() => fakeReact(data)).apply({
        effect: (callback) => { effects.push(callback) },
        slots: {
          inject: (_slot, register) => register(),
          register: (_definition, component) => { section = component },
        },
      })
    } } },
  }
  if (document !== undefined) context.document = document
  runInNewContext(source, context)
  return { effects, render: () => section() }
}

function runningData() {
  return {
    gateway: { state: 'running', baseUrl: 'http://127.0.0.1:18088/v1', pid: 4242, uptimeMs: 1000, log: [] },
    settings: { realm: 'intl', port: 18088, keyConfigured: true, autoStart: true, providerSync: true },
    account: { accounts: [{ uid: 'sample', nickname: 'Sample', realm: 'intl', enabled: true }], usable: 1 },
    provider: { present: true, routes: ['workbuddy'] },
    models: [{ id: 'hy3', context_length: 192000, max_output_tokens: 64000 }],
    activeRealm: 'intl',
    modelsRealm: 'intl',
  }
}

/**
 * All virtual elements below a rendered node.
 *
 * Function components are expanded, because this file's host stub never runs
 * them: `StateBadge` and `Field` are ordinary pure functions with no hooks, so
 * calling them here is exactly what React would do.
 */
function elements(node) {
  if (node === null || typeof node !== 'object') return []
  if (typeof node.type === 'function') return elements(node.type(node.props))
  return [node, ...(node.children ?? []).flatMap(elements)]
}

test('the style sheet is injected once and disposed with the plugin', () => {
  const { document, head } = makeDocument()
  const { effects } = loadHost({ document })

  assert.equal(effects.length, 1, 'apply() must install the sheet through ctx.effect')
  const dispose = effects[0]()
  assert.equal(head.children.length, 1)
  assert.equal(head.children[0].tag, 'style')

  const css = head.children[0].textContent
  assert.match(css, /\.dsw-wb-page\b/)
  assert.match(css, /\.dsw-wb-card\b/)
  assert.match(css, /\.dsw-wb-account\b/)
  // The sheet has to ride the theme's alias tokens, not hard-coded light colours.
  assert.match(css, /var\(--dsw-alias-label-primary/)
  assert.match(css, /var\(--dsw-alias-border-l2/)

  // Re-entering the effect must not stack a second sheet.
  effects[0]()
  assert.equal(head.children.length, 1, 're-installing must not stack a second <style>')

  dispose()
  assert.equal(head.children.length, 0, 'disposing must remove the sheet')
})

test('the rendered tree uses className and carries no inline style objects', () => {
  const { render } = loadHost({ document: makeDocument().document })
  const tree = render()
  const all = elements(tree)

  const inline = all.filter((node) => node?.props?.style !== undefined)
  assert.deepEqual(inline.map((node) => node.type), [], 'no element may fall back to an inline style')

  const classes = new Set(all.flatMap((node) => (
    typeof node?.props?.className === 'string' ? node.props.className.split(/\s+/u) : []
  )))
  for (const expected of ['dsw-wb-page', 'dsw-wb-header', 'dsw-wb-badge', 'dsw-wb-card', 'dsw-wb-account', 'dsw-wb-btn']) {
    assert.ok(classes.has(expected), `expected a ${expected} element`)
  }

  // The account card keeps its locating key, which the other client tests rely on.
  assert.ok(all.some((node) => node?.props?.key === 'accountsCard'))
  assert.ok(all.some((node) => node?.props?.key === 'gatewayCard'))
})

test('a missing or unknown gateway state renders as stopped instead of throwing', () => {
  for (const state of [undefined, null, '', 'nonsense']) {
    const data = runningData()
    data.gateway.state = state
    const tree = loadHost({ document: makeDocument().document, data }).render()
    const badge = elements(tree).find((node) => (
      typeof node?.props?.className === 'string' && node.props.className.includes('dsw-wb-badge')
    ))
    assert.ok(badge, `state ${JSON.stringify(state)} still renders a badge`)
    assert.equal(badge.props['data-tone'], 'stopped')
  }
})
