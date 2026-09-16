# Changelog

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
