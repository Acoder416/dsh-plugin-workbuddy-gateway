# dsh-plugin-workbuddy-gateway

Use a **WorkBuddy** ([workbuddy.ai](https://www.workbuddy.ai) global / codebuddy.cn
China) subscription as a model provider in **DSH**, managed from the settings page.

English | [中文](README.md)

---

## Read this first

**This is not an official integration.** WorkBuddy sells model access as a
subscription rather than an API key, so reaching that quota means running a
translation gateway against the subscription's own internal endpoints. Check that
this is acceptable where you are before using it. Not affiliated with WorkBuddy or
Tencent in any way.

| Requirement | Detail |
|---|---|
| **DSH** with a `web` profile | Developed and verified against `@deepseek-ai/dsh-*` `0.1.5-rc.2` |
| **Node** ≥ 20.19 | The host half imports Node builtins only |
| **Python** ≥ 3.9 | The gateway is Python; standard library only (verified on 3.13) |
| **A WorkBuddy account** | Global or China subscription; sign in through the browser, or import the credential the desktop app already stored |

### Platform support

| | Windows | macOS | Linux |
|---|---|---|---|
| Gateway boot and proxying | ✅ Verified | ✅ Adapted, **not tested on hardware** | ✅ Adapted, **not tested on hardware** |
| **Import the desktop credential** | ✅ | ❌ **Unavailable** | ❌ **Unavailable** |
| Browser OAuth sign-in | ✅ | ✅ Should work | ✅ Should work |
| Process supervision (start/stop/readiness/log) | ✅ | ✅ Adapted | ✅ Adapted |

**"Import the desktop credential" does not work on macOS or Linux**, because the
gateway looks for the official desktop app's stored credential at a Windows path
(`%LOCALAPPDATA%\CodeBuddyExtension\Data\Public\auth\*.info`). That is the bundled
upstream code's behaviour, not this plugin's. On those platforms use **"Sign in via
browser"** in the settings page instead — that path does not involve the desktop app.

**Interpreter naming.** The plugin does not hardcode `python`; it probes by
platform and takes the first one that runs:

| Platform | Tried in order |
|---|---|
| Windows | `python` → `python3` |
| macOS / Linux | `python3` → `python` |

So macOS needs no manual `python3` configuration (Apple has shipped no `python`
name since macOS 12.3). The resolved interpreter appears in the settings page's
gateway card, and can be pinned through its `pythonPath` field.

**It depends on DSH internals that are not a stable public API** —
`settings.installSection`, `settings.mutate`, `webServer.register`, `credentials.*`,
and the client's `settings.section` slot. A harness change to any of those can
break this plugin with no change here. See
[`CONTRIBUTING.md`](CONTRIBUTING.md#harness-coupling).

---

## What it does

WorkBuddy has no official OpenAI-compatible API, so a local reverse proxy has to
translate its subscription protocol into the OpenAI wire format. Before this
plugin that meant a `.bat` file you had to remember to launch, on a port you had
to remember, with errors visible only in a console window.

This makes that gateway a managed part of DSH:

- **Supervises the gateway process** — start, stop, restart, readiness detection,
  a log ring, and shutdown with the harness.
- **Manages accounts** — scan the desktop app's credentials and import them,
  browser OAuth, remove.
- **Maintains the `llm-pi-ai` provider route** — writes the models the gateway
  actually serves, so they appear in the model picker.
- **Configurable** — port, Python interpreter, gateway directory, autostart,
  automatic route maintenance, and realm (global / China).

It does not modify DSH core, and it never touches your other model providers.

## Install

**Check it works here first** (proves spawn and piped stdio work, no DSH needed):

```bash
npm run preflight
```

Then add it to a DSH web profile. The bundle layer resolves at startup, so this
needs a **dsh restart**:

```jsonc
// $DSH_HOME/profiles/web/package.json
"dependencies": {
  "dsh-plugin-workbuddy-gateway": "link:/absolute/path/to/dsh-plugin-workbuddy-gateway"
},
"dsh": {
  "profile": {
    "bundles": [
      // …
      "dsh-plugin-workbuddy-gateway"
    ]
  }
}
```

```bash
pnpm --dir "$DSH_HOME/profiles/web" install
```

Or install straight from git:

```bash
pnpm --dir "$DSH_HOME/profiles/web" add github:Acoder416/dsh-plugin-workbuddy-gateway
```

Then add the package name to `dsh.profile.bundles` and restart dsh.

### "Bundle" is not a plugin-market feature

Worth clearing up, because the names invite the mistake. A **bundle is simply
DSH's unit of profile composition**: any package whose manifest declares

```jsonc
"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }
```

is a bundle, and its package name can go in the profile's `dsh.profile.bundles`
array. At startup DSH applies each bundle's patch list, in array order, over an
empty entry tree.

`dshmarket` — the market UI plugin — **is itself just one entry in that array**,
a sibling of this plugin rather than a parent of it:

```jsonc
"bundles": [
  "@deepseek-ai/dsh-base",
  "@deepseek-ai/dsh-web-app",
  "dshmarket",                      // the market, itself a bundle
  "dsh-plugin-workbuddy-gateway"    // this plugin, same level
]
```

Resolution is ordinary Node package resolution (the dsh installation first, then
the profile directory) — **no registry and no market involved**. And
`dsh plugin --profile web add <pkg>` is not a market command either; it forwards
its arguments verbatim to pnpm in the profile directory:

```
dsh plugin --profile tui add <package>     install a plugin into the tui profile
[args...]  pnpm arguments, forwarded verbatim (add <pkg>, remove <pkg>, why <pkg>, ...)
```

In short: the market is one way to *install*; a bundle is the mechanism that
*loads*. Writing the package name into `bundles` by hand uses the same mechanism.

### The alternative: a manual patch entry

Instead of `bundles`, insert the plugin from the profile's own patch file:

```yaml
# $DSH_HOME/profiles/web/cordis.patch.yml
- insert:
    - id: workbuddy-gateway
      name: dsh-plugin-workbuddy-gateway
```

A custom profile's `patchReload` defaults to `live`, so this entry mounts
**without a restart** (a client-half change still needs a page refresh).

> **Pick one method, never both.** Inserting the same loader id twice is fatal:
> `duplicate loader entry id: workbuddy-gateway`. If the name is in `bundles`, do
> not also `insert` it, and vice versa.

## Using it

**Settings → WorkBuddy**:

| Section | What it holds |
|---|---|
| Status bar | State, endpoint, start / stop / restart / refresh |
| Gateway | Endpoint, PID, uptime, launch script, account and usage directories; port, start-with-dsh, keep-route-in-sync |
| API key | Generate / clear. Stored in DSH's credential store under `WORKBUDDY_API_KEY`, never in `settings.yaml` |
| Accounts | Usable count for the current realm, **realm switch (global / China)**, scan desktop credentials, import, remove, browser sign-in |
| Provider route | Whether the route is written, which routes exist, write / remove |
| Models | Context window, max output, reasoning tiers, image support |
| Gateway log | The last 120 lines, errors highlighted |

Click **Write provider route** once after the gateway is running, and the models
appear in the picker.

### Where runtime state lives

The gateway is a third-party Python program whose mutable state must not land in
a `link:`-installed checkout:

| Content | Location | Set by |
|---|---|---|
| Account credentials | `$DSH_HOME/workbuddy/accounts/` | `ACCOUNTS_DIR` |
| Usage records | `$DSH_HOME/workbuddy/usage/` | `WB_PROXY_USAGE_DIR` |
| Gateway code | `vendor/workbuddy-gateway/` in this package | bundled |

## Design notes

These are the decisions that are not obvious from reading the code, each of which
was a bug once.

**Why port 18088 and not upstream's 8788.** Windows reserves TCP 8703–9302 for
Hyper-V and WSL dynamic port exclusions, and a bind inside that range fails with
`WinError 10013`. 18088 is outside every reserved range.

**Why readiness is read from a log line, not a sleep.** The gateway prints
`listening : http://…` exactly when it starts serving. A fixed sleep reports
"running" during a slow boot and wastes time during a fast one; that line is the
only honest signal.

**Why provider routes go through `settings.mutate`.** `llm-pi-ai.providers`
belongs to the pi-ai adapter's namespace. A whole-section write replaces the
entire `providers` map — that is, it deletes the user's other providers. A
path-level `mutate` on `providers.<id>` adds or removes exactly one key and goes
through DSH's own writer and file lock. A side effect worth having: this plugin
parses no YAML anywhere.

**Why a late exit is guarded.** A restart kills the old process and starts a new
one, and the old process's `exit` event can arrive *after* the new child is
installed. Clearing the bookkeeping unconditionally would erase the live child's
PID, so exit handling is bound to the child it belongs to.

**Why it waits for the credential service.** At mount time `ctx.get('credentials')`
can still be empty — the service activates later. The first implementation read
that as "no key configured" and started the gateway with **no authentication**,
serving the user's paid quota to anything on the machine that could reach the
port. There is now a bounded wait, and a refusal to start when no token can be
obtained.

**Why `running` is a real getter on `Gateway`.** It once existed only as a field
on the returned snapshot object, so `gateway.running` was `undefined` — and the
HTTP read path uses it to decide whether the gateway can be called. Accounts and
models silently read as empty while the status badge said "running". The tests had
asserted `snapshot().running` rather than the getter. There is now a test that
asserts the getter across every state.

**Why failures are written to the plugin's own log.** "Not started" has three
completely different causes (autostart off, no credential, start failed). Written
only to the DSH console, the settings page shows a quiet red dot; the log ring
records which one it was.

**Why accounts are per-realm, and why the usable count is computed here.** The
gateway isolates account pools by realm: `/accounts` **filters the list** by realm
but its `usable` field is `count_ready()` counted **across all realms**. Putting
both numbers on one page produced the self-contradictory reading "2 usable of 1"
— exactly what a machine with one account per realm looks like. Both numbers now
come from the same list, and the request carries the realm explicitly. That is
also why the realm selector sits in the accounts card: it is the filter for that
list, and the other realm's account is invisible until it changes.

**Why some models have no reasoning menu.** The picker offers exactly the tiers a
model declares, and the gateway's declarations differ per model:

| What the gateway reports | Meaning | What the plugin writes |
|---|---|---|
| `reasoning_efforts` with ≥ 2 tiers | The caller may choose | Those tiers → **menu** |
| `reasoning_efforts` with 1 tier | One tier; choosing does nothing | Nothing → no menu |
| `reasoning_fixed_effort` | Tier is fixed; the caller may not choose | Nothing → no menu |
| Neither field | The gateway exposes no thinking control | Nothing → no menu |

Self-check against a running gateway: `npm run report:reasoning`.

## Tests

```bash
npm test                          # 67 offline tests: no DSH, no Python, no network
npm run preflight                 # spawn + piped stdio work on this machine
node scripts/check-package.mjs    # pre-publish check
npm run report:reasoning          # per-model reasoning verdict from a live gateway
```

Two integration scripts check this plugin against a **real DSH settings service**.
Run them from a DSH checkout; they use throwaway files and never touch a real
`$DSH_HOME`:

```bash
node --import tsx/esm /path/to/dsh-plugin-workbuddy-gateway/scripts/verify-settings-section.mjs
node --import tsx/esm /path/to/dsh-plugin-workbuddy-gateway/scripts/verify-provider-route.mjs
```

## Troubleshooting

```bash
# Plugin self-check (DSH running)
curl http://127.0.0.1:3080/dsh-workbuddy-gateway/api/v1/health

# The gateway itself
curl http://127.0.0.1:18088/health
```

| Symptom | Cause / fix |
|---|---|
| No WorkBuddy page in settings | The host half imports once at mount: **restart dsh**. A client-half change only needs a page refresh. |
| Start fails, log shows `argparse` | Wrong `gatewayDir`, or the bundled `vendor/` was removed. The page shows the script path actually used. |
| Start fails, log shows `WinError 10013` | The port is inside a reserved range. Change it (18088 is safe). |
| Provider sync says the namespace is not registered | The pi-ai adapter has not finished loading. Refresh and retry; the state is re-read on every poll. |
| No models in the picker | Click "Write provider route", then refresh. The route is delivered with the page. |

## Uninstall

1. Click **Remove provider route** in the settings page.
2. Drop the package name from `dsh.profile.bundles` and `pnpm remove dsh-plugin-workbuddy-gateway`.
3. Restart dsh.
4. Optionally delete `$DSH_HOME/workbuddy/` and the `WORKBUDDY_API_KEY` credential.

## Risk

The gateway talks to the subscription's internal endpoints, **not an official
API**. That carries a real risk of account action and is likely outside WorkBuddy's
terms of service — your call to make. This plugin only hosts a known community
approach; it does not change its nature.

## Credits

The gateway implementation is
[`ardeyouxipianyi/workbuddy2api-intl`](https://github.com/ardeyouxipianyi/workbuddy2api-intl)
(MIT), bundled unmodified under `vendor/workbuddy-gateway/` with its license. Full
third-party details are in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

Two other DSH community plugins informed the integration patterns (no code is
included from them): `dsh-plugin-archived-sessions` for the `settings.section`
mount, and `dsh-plugin-codex-monitor` for the host-route + client-page shape and
the same-origin guard convention.

## License

MIT for this plugin — see [`LICENSE`](LICENSE). The bundled gateway is separate
MIT code — see [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md).
