# reclaim

**Reclaim your hardware.** One safe, emulator-first CLI that de-bloats, de-clouds and
unlocks devices you already own — starting with **Android TV**.

> The idea: the "IDE" is the easy part. The real product is an **engine + a growing
> library of recipes**. The engine never changes; the recipe library grows forever,
> so reclaim can eventually do this for *any* device the community adds.

---

## Why it's safe by design

Every risky hardware tweak is normally a wall of forum commands you paste and pray over.
reclaim turns each one into a one-command action with guardrails:

- **Emulator-first** — test everything on a free *virtual* Android TV before touching real hardware.
- **Dry-run mode** — `--dry-run` shows exactly what a recipe would do and changes **nothing**.
- **Reversible** — every change records its own undo. `reclaim undo <id>` puts things back.
- **Device passport** — a log of everything reclaim has done, so you can always roll back.
- **Legal lane only** — recipes de-bloat, de-track and customize hardware you *own*. No DRM
  circumvention, no piracy, no installing proprietary OSes on unlicensed hardware.

---

## Quick start (no device, no risk)

```bash
# 1. See what it can do
node bin/reclaim.js help

# 2. Preview a real recipe — changes nothing
node bin/reclaim.js run androidtv/debloat --dry-run

# 3. List every recipe
node bin/reclaim.js list
```

Once published you'd run it as `npx reclaim <command>` or install it globally.

## Try it for real on a virtual TV (still no hardware)

```bash
node bin/reclaim.js emulator help      # how to create an Android TV emulator (free, via Android Studio)
node bin/reclaim.js emulator start     # boot the virtual TV
node bin/reclaim.js detect             # reclaim sees the virtual TV
node bin/reclaim.js recommend          # safe recipes for it
node bin/reclaim.js run androidtv/privacy --dry-run
node bin/reclaim.js run androidtv/privacy --yes     # apply for real (on the emulator)
node bin/reclaim.js undo androidtv/privacy          # revert
```

Requires the Android SDK platform-tools (`adb`) and `emulator` on your `PATH` — the
`emulator help` command walks you through it.

---

## Commands

| Command | What it does |
|---|---|
| `emulator [status\|start\|help]` | Set up / boot a virtual Android TV to test on |
| `detect` | Find connected or virtual devices and identify them |
| `recommend` | Show recipes that are safe for the detected device |
| `list` | List every available recipe |
| `run <id> --dry-run` | Preview a recipe (no changes) |
| `run <id> --yes` | Apply a recipe (real changes) |
| `undo <id>` | Roll a recipe back |
| `history` | Show the device passport (everything reclaim has done) |

### Live control & utilities (drive a real TV from your computer)

| Command | What it does |
|---|---|
| `doctor` | Health dashboard: specs, storage/RAM, and everything reclaim has changed |
| `remote` | Show every control key |
| `key <name> [n]` | Send a remote key — `up/down/left/right/ok/back/home/play/volup…` |
| `type "text"` | Type into the focused field — **the fix for typing passwords/search on a TV** |
| `screenshot [file]` | Save a PNG of the TV screen |
| `apps [--all]` | List installed apps (enabled/disabled) |
| `app disable\|enable <id>` | Disable/enable **any** app, not just the ones in recipes (reversible) |
| `wifi` | Enable adb over Wi-Fi so you can control the box with no cable |
| `reboot` | Reboot the TV |
| `backup [file]` | Snapshot this TV's config (settings + disabled apps) to a file |
| `restore <file> --yes` | Re-apply a saved config — **clone a setup onto a new box, or recover after a reset** |

```bash
reclaim doctor                     # one-glance status of the box
reclaim type "my wifi password"    # type into the focused TV field from your keyboard
reclaim key down; reclaim key ok   # navigate it like a remote
reclaim wifi                       # cut the cable, control it across the room
```

---

## Included Android TV recipes

| Recipe | Risk | What it does |
|---|---|---|
| `androidtv/debloat` | reversible | Disables (never deletes) sponsored rows and junk apps |
| `androidtv/privacy` | safe | Turns off ad personalization, telemetry and usage reporting |
| `androidtv/adblock-dns` | safe | Blocks ads/trackers network-wide via Private DNS (`--dns <host>`) |
| `androidtv/snappy` | safe | Halves UI animation times so old boxes feel faster (`--scale 0`) |
| `androidtv/no-captive-check` | safe | Stops the repeated Google connectivity pings |
| `androidtv/storage` | safe | Clears app caches to free space (data untouched) |
| `androidtv/flauncher` | reversible | Sideloads the open-source, ad-free FLauncher home screen |
| `androidtv/sideload` | reversible | Installs any APK you provide (`--apk`, `--package`) |

> The APK recipes (`flauncher`, `sideload`) never bundle or download anything. You point
> them at a file you obtained yourself, e.g.
> `run androidtv/sideload --apk /path/to.apk --package com.example.app --yes`.

---

## Catalog — built to scale to 100s

reclaim ships a registry of **103 features across 109 devices (18 families) and 30 areas**, and
it's designed to grow without ever faking anything:

- **`ready`** features are real, runnable recipes (14 today, all Android TV, all tested).
- **`template`** features are *real capabilities that aren't scripted yet* — each carries an
  honest one-line plan, and running one tells you so instead of executing a fake command.
- **Generators** let you (or the community) add entries in seconds, so the catalog grows by
  contribution, not fabrication.

```bash
reclaim catalog                 # overview: features / devices / families / areas
reclaim catalog devices         # every device, grouped by family, with support status
reclaim catalog features        # every feature, ready + template
reclaim browse privacy          # features in an area
reclaim browse "Fire TV"        # features for a device family
reclaim search jellyfin         # search features + devices
reclaim new-device  --id shield-2025 --name "..." --family "Android TV"
reclaim new-recipe  --id androidtv/foo --name "..." --area privacy --device androidtv
reclaim validate                # check every recipe & catalog entry is valid
```

`reclaim validate` enforces the schema **and** the honesty rule (templates may never
carry executable steps). It runs in CI (GitHub Actions) on every push, so the catalog
can't drift as it grows.

Device support is honest: `supported` (works now), `planned` (real, on the roadmap),
`community` (doable via community methods). No device claims a feature it can't do.

## Profiles — one command, many recipes

A profile bundles several recipes so a whole clean-up is a single command. All three
below use only no-input, reversible recipes.

| Profile | What it runs | Does |
|---|---|---|
| `privacy` | debloat + privacy + adblock-dns + no-captive-check | Strips tracking, ads and junk off the whole TV |
| `revive` | storage + snappy | Frees space and speeds up a slow old box |
| `recommended` | all six safe recipes | The full safe tune-up, nothing needed from you |

```bash
node bin/reclaim.js profiles                      # list bundles
node bin/reclaim.js profile privacy --dry-run     # preview the whole bundle
node bin/reclaim.js profile privacy --yes         # apply it (on a device)
```

Each recipe still records its own undo, so you can roll back the whole thing one recipe
at a time with `reclaim undo <recipe-id>` (see `reclaim history`).

## How a recipe works

A recipe is just a JSON file under `recipes/<device>/`. That's the whole extensibility story —
adding support for a new mod (or a whole new device) means adding a file, not changing code.

```json
{
  "id": "androidtv/privacy",
  "name": "Lock down tracking & telemetry",
  "device": "androidtv",
  "risk": "safe",
  "reversible": true,
  "steps": [
    {
      "type": "adb-shell",
      "label": "Disable ad personalization",
      "cmd": "settings put secure limit_ad_tracking 1",
      "undo": "settings put secure limit_ad_tracking 0"
    }
  ]
}
```

- `type` — `adb-shell`, `adb-install`, or `note`.
- `cmd` / `apk` — what to run.
- `undo` — the reverse command. This is what makes everything roll-backable.
- `risk` — `safe` · `reversible` · `advanced` · `expert` (shown as a color badge).

---

## Project layout

```
reclaim/
├── bin/reclaim.js        # tiny entry point
├── src/
│   ├── cli.js            # command parsing + dispatch + help
│   ├── ui.js             # zero-dependency colors, badges, banner, spinner
│   ├── adb.js            # the ONE place that talks to a device
│   ├── device.js         # detect & identify what's plugged in
│   ├── recipes.js        # the engine: load, dry-run, apply, undo
│   ├── store.js          # device passport & restore points (~/.reclaim)
│   └── emulator.js       # "try it without your TV" helper
└── recipes/androidtv/    # the growing recipe library
```

## Roadmap

- More Android TV recipes (custom DNS ad-blocking, app sideloading, DRM-safe tweaks)
- `profiles` — bundles like *Privacy mode* / *Media center mode* / *Kids mode*
- More device families: Fire TV, Fire tablets, routers (OpenWRT), smart-home (ESPHome), Raspberry Pi
- Community recipe store with ratings and an automatic legality/safety check

## License

MIT. Recipes only ever cover legal customization of hardware you own.
