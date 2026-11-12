# Changelog

All notable changes to `reclaim-hw`. Dates are UTC. This project follows a
"ready means verified" rule — recipes ship only when their effect is confirmed.

## [0.5.0] - 2026-11-12
### Added
- `--json` now also covers `list`, `history`, `protected` and `lists` — every
  read command is scriptable.
- Deeper Fire lists from sourced data: Fire TV +19, Fire tablet +15 packages.

## [0.4.0] - 2026-11-12
### Added
- **`--json` output** for `catalog`, `bloat`, `doctor` and `debloat` — reclaim is
  now scriptable/pipeable, which the GUI-based alternatives are not.
- **`dashboard` profile** — keep-awake + screensaver-off + snappy, for signage.
### Changed
- Refactored the list and doctor engines to expose structured data.

## [0.3.0] - 2026-11-12
### Added
- Two live-verified Android TV recipes: `screensaver-off` (safe),
  `playprotect-off` (advanced, `--force`-gated).
- Deeper bloat lists: Android TV +13 packages, Fire TV +6 (now 105 across 3 families).

## [0.2.0] - 2026-11-12
### Added
- **Fire TV + Fire tablet debloat** via community lists (package IDs sourced from
  the dumbtv and Fire-Tools projects), with a **Fire OS brick-guard** and
  Amazon-device auto-detection.

## [0.1.1] - 2026-11-12
### Fixed
- Help-row alignment for long command labels.

## [0.1.0] - 2026-11-12
### Added
- First release: Android TV recipes + profiles, dry-run/undo/device-passport,
  live control (doctor/key/type/screenshot/apps/wifi/reboot), backup/restore,
  the 100+ feature catalog, community package lists, the brick-guard + risk
  gating, `validate` + CI, and the emulator-first workflow.
