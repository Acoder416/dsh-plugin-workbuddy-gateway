# Changelog

## Unreleased

- Restore realm switching fixes omitted from v0.1.4: confirm the gateway realm before saving, read models for the selected realm, and update automatic provider routes.
- Apply confirmed settings immediately and discard background reads started before a settings write. Display the gateway and model catalog realms separately.

## 0.1.4 — 2026-09-16

- Fix a regression in 0.1.3: HTTP 502/503/504 on multiple accounts applied account cooldowns and made the caller's next retry fail with `no usable account`.
- Keep failover bounded by the request's tried-account set without cooling down accounts for these upstream gateway errors. Preserve cooldowns for authentication failures, rate limiting, and network exceptions.
- Add a regression reproducing three upstream failures followed by a caller retry two seconds later.

## 0.1.3 — 2026-09-16

- Treat upstream HTTP 502/503/504 during model connection setup as account-failover candidates, alongside 401/403/429 and network errors. Previously these gateway errors immediately failed the request without trying another available account.
- With only one account, return the upstream 502/503/504 without cooling down that account, so a caller retry is not blocked.
- Preserve bounded attempts, same-realm selection, and session rebinding. Errors after streaming begins are not replayed; an upstream-wide outage may still fail every account.
- Add offline regression tests for APISIX 502 → 504 → success, exhausted accounts, non-retryable HTTP 400, existing auth/rate-limit failover, and bounded single-account attempts.
- Keep `v0.1.2` and `v0.1.1` available for rollback.

## 0.1.2 — 2026-09-16

- Add credit refresh, CN check-in, growth-task requests, and account enable/disable controls to the settings integration.
- Refresh credits after desktop import and CN check-in; persist confirmed claim state, including upstream HTTP errors carrying code `10001`.
- Detect desktop credential directories by platform and support `WORKBUDDY_DESKTOP_AUTH_DIR`. macOS/Linux discovery has offline tests but no real-device verification.
- Render HTTP 2xx/3xx access logs from stderr as ordinary logs, preserving error highlighting for failed requests.
- Correct account-card control nesting, localized labels, and nested operation failure reporting; give account operations longer than the regular read timeout.
- Align package, plugin, and health versions; add Python account regression tests and release packaging checks.
- Rewrite Chinese and English installation and usage documentation, including fixed-tag upgrades and rollback to `v0.1.1`.

## 0.1.1

Existing release tag retained unchanged. Use it to restore the earlier plugin code; see the README for rollback commands and backup requirements.
