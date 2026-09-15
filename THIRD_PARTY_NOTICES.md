# Third-party notices

This package redistributes third-party code. The terms below apply to it, and the
MIT license in the repository root applies to everything else.

---

## `vendor/workbuddy-gateway/`

**What it is.** A vendored copy of the WorkBuddy → OpenAI-compatible reverse
proxy. Python standard library only; no build step and no dependencies.

**Upstream.** [`ardeyouxipianyi/workbuddy2api-intl`](https://github.com/ardeyouxipianyi/workbuddy2api-intl)
(also published there as `ardeyouxipianyi/workbuddy2api`), version 1.1.2 as
vendored. The Python sources and `dashboard.html` are copied verbatim; the only
additions in this package are at the repository root, outside this directory.

**License.** MIT. The upstream `LICENSE` file is preserved unmodified at
`vendor/workbuddy-gateway/LICENSE`. Its copyright line reads
`Copyright (c) 2026` with no name attached, and it is reproduced here exactly as
received rather than attributed to a name its own text does not state.

**Modifications.** None. The plugin runs this copy from its own directory and
redirects the mutable state it produces — account credentials and usage records —
out of the checkout and into `$DSH_HOME/workbuddy/`, by environment variable. That
keeps a `link:`-installed plugin from writing into its own source tree.

**What it does that this project does not control.** The gateway authenticates
against WorkBuddy's own service using credentials the official desktop app
already stored on the machine, and translates the subscription protocol into the
OpenAI wire format. It is not an official WorkBuddy or Tencent API client, and
neither this plugin nor its author has any relationship with WorkBuddy or
Tencent.

### MIT license text, as received

```
MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Referenced, not redistributed

The plugin's design borrows from two community DSH plugins. No code from them is
included here; they were read for their integration patterns only.

- `dsh-plugin-archived-sessions` — the `settings.section` slot registration.
- `dsh-plugin-codex-monitor` — host route + client page shape, and the
  same-origin guard convention for mutating routes.

## Not covered by this repository's license

- **WorkBuddy / CodeBuddy / Tencent** names, marks, and service. Using this
  software does not grant any right to them.
- **DSH** (`@deepseek-ai/*`) — the harness this plugin plugs into. It is a
  separate project under its own license, and it is a runtime dependency rather
  than a redistributed artifact.
