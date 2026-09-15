# Contributing

Thanks for looking. This plugin sits on top of two things it does not own — the
DSH harness and a vendored third-party gateway — so most of the guidance below is
about respecting those boundaries.

## Getting set up

You need:

- **Node 20.19+** — the plugin's only runtime requirement.
- **Python 3.9+** on `PATH` — only if you want the gateway to actually run. The
  unit tests do not need it.
- **A DSH checkout** — only for the integration scripts. Everything else works
  without one.

```bash
npm test                 # 67 offline tests, no DSH, no Python, no network
npm run preflight        # proves spawn + piped stdio work on your machine
node scripts/check-package.mjs   # pre-publish check
```

The integration scripts need the harness:

```bash
cd /path/to/deepseek-harness
node --import tsx/esm /path/to/dsh-plugin-workbuddy-gateway/scripts/verify-settings-section.mjs
node --import tsx/esm /path/to/dsh-plugin-workbuddy-gateway/scripts/verify-provider-route.mjs
```

Both run against throwaway files in the OS temp directory. Neither touches a real
`$DSH_HOME`.

## What a change needs

**A test that fails without it.** The tests here are not decoration: nearly every
real defect this plugin has had was invisible to the code reading well and was
caught by an assertion instead. Two examples worth knowing about, because they
are the shape of bug this codebase is prone to:

- A getter that existed only as a field on a returned object, so the read path
  checked `undefined` and silently skipped every account and model load. The
  tests had asserted the *snapshot field* rather than the getter.
- A settings schema registered as a bare function. The service serializes every
  schema with `toJSON()` to describe it, so the provider catalog broke the whole
  models settings page. Nothing had asserted that the registration was
  describable.

Both fixes came with the assertion that would have caught them.

**A reason in the comment.** This code explains *why* far more than *what*. Keep
that: the non-obvious decisions here (why readiness is read from a log line, why
provider routes are written through `settings.mutate`, why `running` is a real
getter) are each a bug that was fixed once and would quietly return without the
rationale attached.

**No new runtime dependencies.** The host half imports only Node builtins, and
the client bundle requires only `react`. This is deliberate: the plugin is
installed by `link:` into a DSH profile, where a dependency the profile does not
also have is a resolution failure waiting to happen.

## Boundaries

**Do not edit `vendor/`.** It is a verbatim copy of upstream
([`ardeyouxipianyi/workbuddy2api-intl`](https://github.com/ardeyouxipianyi/workbuddy2api-intl),
MIT). Local edits make the next upstream sync a manual merge and hide the fact
that you are running something other than upstream. If upstream needs a change,
send it there; if this plugin needs different behavior, put it at the plugin
root and reach it through configuration or environment.

**Do not weaken the account guards.** Every mutating HTTP route is behind a
same-origin check, and the plugin refuses to autostart the gateway when it cannot
obtain a bearer token for it. A gateway started without that token serves the
user's paid quota to anything on the machine that can reach the port.

**Do not add unverifiable claims to the README.** The test counts and the
reasoning-tier table in it are reproducible (`npm test`, `node
scripts/reasoning-report.mjs`), and that is the point.

## Harness coupling

This plugin uses DSH internals that are not a stable public contract:

| Used | For |
|---|---|
| `settings.installSection` | register this plugin's own settings section |
| `settings.describe({ redactSecrets })` | must be able to serialize the section's schema |
| `settings.mutate` on the `llm-pi-ai` namespace | add/remove exactly one provider route |
| `webServer.register` | the plugin's HTTP surface |
| `credentials.resolve` / `set` / `unset` | hold the gateway's bearer token |
| the `settings.section` client slot | render the settings page |

A harness change to any of these can break this plugin without any change here.
That is what the `integration` CI job exists to detect, and why its DSH revision
is pinned in `.github/workflows/ci.yml` — bump `DSH_REF` deliberately, after
running the integration scripts against the newer harness.

## Reporting a bug

Include:

- the DSH version, and whether the harness is a checkout or an installed package
- what `GET /dsh-workbuddy-gateway/api/v1/health` returns (it carries the plugin
  version, the gateway state, and the gateway's recent log)
- for a model-behavior question, `node scripts/reasoning-report.mjs` output

That endpoint and script answer most "why does it look like this" questions
without a round trip.

## Licensing

Contributions are accepted under the repository's MIT license. By opening a pull
request you confirm you have the right to submit the work under it. See
`THIRD_PARTY_NOTICES.md` for the vendored code's separate terms.
