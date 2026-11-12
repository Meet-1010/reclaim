# Contributing to reclaim

reclaim grows by contribution, not fabrication. Everything you add must be **real,
legal, and reversible** — and `reclaim validate` (which runs in CI) enforces the rules
below so nothing unsafe can land.

## The hard rules

1. **Legal lane only.** De-bloat, de-track, customize hardware people own. No DRM
   circumvention, no piracy, no installing proprietary OSes on unlicensed hardware.
2. **Never target a protected app.** The brick-guard (`reclaim protected`) lists the
   system packages that keep a device bootable. Recipes and package lists that touch
   them are rejected by `validate`.
3. **Reversible by default.** Every `adb-shell` step needs an `undo`. Prefer
   `pm disable-user` over `pm uninstall`; prefer `settings put` with a restore value.
4. **Ready means verified.** A feature is `ready` only if it has a real recipe that
   works. If you can't verify it, add it as a `template` with an honest `plan` — never
   ship a fake command. (We've reverted our own recipes for failing this.)

## Add a package to a device's bloat list

Edit `lists/<device>.json` and add an entry:

```json
{ "package": "com.example.bloat", "label": "Example bloat", "category": "ads",
  "level": "recommended", "about": "What it is and why you'd disable it." }
```

- `level`: `recommended` (safe for most), `advanced` (disable if unused), `expert`.
- Never add a protected package — `validate` will fail.

Users pick these up with `reclaim bloat <device>` and `reclaim debloat --level <L>`, and
a maintained copy can be published for `reclaim lists update` to fetch.

## Add a runnable recipe

```bash
reclaim new-recipe --id androidtv/my-recipe --name "..." --area privacy --device androidtv
```

Then create `recipes/androidtv/my-recipe.json` with real `adb-shell` steps (each with an
`undo`), set the catalog entry's status to `ready`, and verify it on a device/emulator.

## Add a device

```bash
reclaim new-device --id my-box --name "My Box" --family "Android TV" --access adb --status planned
```

Status is honest: `supported` (works now), `planned` (real, roadmap), `community`.

## Before you open a PR

```bash
node bin/reclaim.js validate   # must pass — CI runs this on every push
```
