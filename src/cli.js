// cli.js — argument parsing + command dispatch. The "front desk" of reclaim.
import * as ui from './ui.js';
import { resolve } from 'node:path';
import * as recipesMod from './recipes.js';
import * as profilesMod from './profiles.js';
import * as device from './device.js';
import * as adb from './adb.js';
import * as store from './store.js';
import * as emulator from './emulator.js';
import * as control from './control.js';
import * as doctor from './doctor.js';
import * as wifi from './wifi.js';
import * as apps from './apps.js';
import * as backup from './backup.js';
import * as catalog from './catalog.js';
import * as validate from './validate.js';
import * as safety from './safety.js';

export async function run(argv) {
  const { cmd, args, flags } = parse(argv);

  switch (cmd) {
    case undefined:
    case 'help':
    case '--help':
    case '-h':
      return showHelp();
    case 'version':
    case '--version':
    case '-v':
      return ui.log('reclaim 0.1.0');
    case 'detect':
      return cmdDetect();
    case 'list':
      return cmdList();
    case 'catalog':
      return cmdCatalog(args[0], flags);
    case 'browse':
      return cmdBrowse(args[0]);
    case 'search':
      return cmdSearch(args.join(' '));
    case 'validate':
      return cmdValidate();
    case 'protected':
      return cmdProtected();
    case 'new-device':
      return catalog.newDevice(flags);
    case 'new-recipe':
      return catalog.newRecipe(flags);
    case 'profiles':
      return cmdProfiles();
    case 'profile':
      return cmdProfile(args[0], flags);
    case 'recommend':
      return cmdRecommend();
    case 'run':
      return cmdRun(args[0], flags);
    case 'undo':
      return cmdUndo(args[0], flags);
    case 'history':
      return cmdHistory();
    case 'doctor':
      return cmdDoctor();
    case 'remote':
      return cmdRemote();
    case 'key':
      return cmdKey(args[0], args[1]);
    case 'type':
      return cmdType(args.join(' '));
    case 'screenshot':
    case 'shot':
      return cmdScreenshot(args[0]);
    case 'apps':
      return cmdApps(flags);
    case 'app':
      return cmdApp(args[0], args[1]);
    case 'wifi':
      return cmdWifi();
    case 'reboot':
      return cmdReboot();
    case 'backup':
      return cmdBackup(args[0]);
    case 'restore':
      return cmdRestore(args[0], flags);
    case 'emulator':
    case 'emu':
      return cmdEmulator(args[0], args[1]);
    default:
      ui.fail(`Unknown command: ${cmd}`);
      ui.info('Run ' + ui.c.bold('reclaim help') + ' to see what reclaim can do.');
      process.exitCode = 1;
  }
}

// --- parsing ------------------------------------------------------------

function parse(argv) {
  const args = [];
  const flags = {};
  let cmd;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else if (cmd === undefined) {
      cmd = a;
    } else {
      args.push(a);
    }
  }
  return { cmd, args, flags };
}

// --- helpers ------------------------------------------------------------

// Resolve which device serial to act on. Returns null (and prints) if none.
async function requireDevice() {
  if (!(await adb.hasAdb())) {
    ui.fail('adb (Android platform tools) is not installed or not on your PATH.');
    ui.info('Install it, or run ' + ui.c.bold('reclaim emulator help') + ' to set up a virtual TV.');
    return null;
  }
  const { profiles, unauthorized } = await device.detectAll();
  if (unauthorized.length) {
    ui.warn('A device is connected but not authorized — accept the debugging prompt on the TV.');
  }
  if (!profiles.length) {
    ui.fail('No online device found.');
    ui.info('Start a virtual TV with ' + ui.c.bold('reclaim emulator start') + ', or connect a real one.');
    return null;
  }
  return profiles[0];
}

// --- commands -----------------------------------------------------------

async function cmdDetect() {
  if (!(await adb.hasAdb())) {
    ui.heading('Detect devices');
    ui.fail('adb is not installed.');
    ui.info('No problem — you can still preview any recipe with ' + ui.c.bold('--dry-run') + '.');
    ui.info('To test for real, run ' + ui.c.bold('reclaim emulator help') + '.');
    return;
  }
  ui.heading('Detect devices');
  const { profiles, unauthorized } = await device.detectAll();
  if (unauthorized.length) ui.warn(`${unauthorized.length} device(s) waiting for debugging approval on-screen.`);
  if (!profiles.length) {
    ui.fail('Nothing connected.');
    ui.info('Boot a virtual TV with ' + ui.c.bold('reclaim emulator start') + '.');
    return;
  }
  for (const p of profiles) {
    ui.nl();
    ui.ok(`${ui.c.bold(p.brand + ' ' + p.model)}${p.isEmulator ? ui.c.dim('  (emulator)') : ''}`);
    ui.kv('serial', p.serial);
    ui.kv('family', p.family === 'androidtv' ? ui.c.green('Android TV ✓') : ui.c.yellow(p.family));
    ui.kv('android', p.androidVersion);
  }
  ui.nl();
  ui.info('Next: ' + ui.c.bold('reclaim recommend') + ' to see what you can safely do.');
}

async function cmdList() {
  ui.heading('All recipes');
  const all = await recipesMod.loadAll();
  if (!all.length) return ui.warn('No recipes found.');
  const byFamily = {};
  for (const r of all) (byFamily[r.device] ??= []).push(r);
  for (const [family, list] of Object.entries(byFamily)) {
    ui.nl();
    ui.log('  ' + ui.c.bold(ui.c.blue(family)));
    for (const r of list) {
      ui.log('    ' + ui.badge(r.risk) + '  ' + ui.c.bold(r.id));
      ui.log('      ' + ui.c.dim(r.summary || r.name));
    }
  }
  ui.nl();
  ui.info('Preview any of them safely: ' + ui.c.bold('reclaim run <id> --dry-run'));
}

async function cmdCatalog(sub, flags) {
  if (sub === 'areas') return catalog.listAreas();
  if (sub === 'devices') return catalog.listDevices({ family: flags.family });
  if (sub === 'features') return catalog.listFeatures({ area: flags.area, family: flags.family, status: flags.status });
  return catalog.overview();
}

async function cmdBrowse(term) {
  if (!term) {
    ui.fail('Browse what? e.g. ' + ui.c.bold('reclaim browse privacy') + ' or ' + ui.c.bold('reclaim browse "Fire TV"'));
    return;
  }
  await catalog.browse(term);
}

async function cmdSearch(term) {
  if (!term) {
    ui.fail('Search for what? e.g. ' + ui.c.bold('reclaim search jellyfin'));
    return;
  }
  await catalog.search(term);
}

async function cmdValidate() {
  const code = await validate.run();
  if (code) process.exitCode = code;
}

function cmdProtected() {
  const { ids, prefixes } = safety.list();
  ui.heading('Protected system apps (brick-guard)');
  ui.log('  ' + ui.c.dim('reclaim will never disable or uninstall these — doing so can brick the device.'));
  ui.nl();
  ui.log('  ' + ui.c.bold('Exact packages (' + ids.length + ')'));
  ids.forEach((p) => ui.log('    ' + ui.c.gray('•') + ' ' + p));
  ui.nl();
  ui.log('  ' + ui.c.bold('Protected prefixes (' + prefixes.length + ')'));
  prefixes.forEach((p) => ui.log('    ' + ui.c.gray('•') + ' ' + p + ui.c.dim('*')));
}

async function cmdProfiles() {
  ui.heading('Profiles — one command, many recipes');
  const all = await profilesMod.loadAll();
  if (!all.length) return ui.warn('No profiles found.');
  for (const p of all) {
    ui.nl();
    ui.log('    ' + ui.c.bold(ui.c.magenta(p.id)) + ui.c.dim('  — ' + p.name));
    ui.log('      ' + (p.summary || ''));
    ui.log('      ' + ui.c.dim('includes: ' + p.recipes.join(', ')));
  }
  ui.nl();
  ui.info('Preview a whole profile safely: ' + ui.c.bold('reclaim profile <id> --dry-run'));
}

async function cmdProfile(id, flags) {
  if (!id) {
    ui.fail('Which profile? e.g. ' + ui.c.bold('reclaim profile privacy --dry-run'));
    ui.info('See all: ' + ui.c.bold('reclaim profiles'));
    return;
  }
  const profile = await profilesMod.findById(id);
  if (!profile) {
    ui.fail(`No profile with id "${id}".`);
    ui.info('See all: ' + ui.c.bold('reclaim profiles'));
    return;
  }

  const dry = Boolean(flags['dry-run'] || flags.dry);

  ui.heading('Profile: ' + profile.name);
  ui.log('    ' + (profile.summary || ''));
  ui.log('    ' + ui.c.dim('Runs ' + profile.recipes.length + ' recipes: ' + profile.recipes.join('  →  ')));

  if (dry) {
    ui.nl();
    ui.box([ui.c.bold('DRY RUN') + ' — nothing changes across any recipe below.'], ui.c.magenta);
    await profilesMod.run(profile, { serial: null, mode: 'dry', flags });
    ui.nl();
    ui.ok('Dry run complete. Re-run without ' + ui.c.bold('--dry-run') + ' to apply (on a device).');
    return;
  }

  const prof = await requireDevice();
  if (!prof) return;
  if (prof.family !== profile.device) {
    ui.fail(`This profile is for "${profile.device}" but the connected device is "${prof.family}".`);
    return;
  }
  const recs = await Promise.all(profile.recipes.map((id) => recipesMod.findById(id)));
  const risky = recs.filter((r) => r && (r.risk === 'advanced' || r.risk === 'expert'));
  if (risky.length && !flags.force) {
    ui.warn(`This profile includes ${risky.length} higher-risk recipe(s): ` + risky.map((r) => r.id).join(', '));
    ui.info('Re-run with ' + ui.c.bold('--yes --force') + ' to proceed.');
    return;
  }
  if (!flags.yes) {
    ui.nl();
    ui.warn('About to apply ' + ui.c.bold(profile.recipes.length + ' recipes') + ' to ' + ui.c.bold(prof.brand + ' ' + prof.model) + '.');
    ui.info('Re-run with ' + ui.c.bold('--yes') + ' to confirm, or add ' + ui.c.bold('--dry-run') + ' to preview first.');
    return;
  }

  const results = await profilesMod.run(profile, { serial: prof.serial, mode: 'apply', flags });
  const okCount = results.filter((r) => r.ok).length;
  ui.nl();
  ui.ok(`Profile done — ${okCount}/${results.length} recipe(s) applied.`);
  ui.info('Undo any one with ' + ui.c.bold('reclaim undo <recipe-id>') + ' (see ' + ui.c.bold('reclaim history') + ').');
}

async function cmdRecommend() {
  ui.heading('Recommended for your device');
  const profile = await requireDevice();
  const all = await recipesMod.loadAll();
  if (!profile) {
    ui.nl();
    ui.info('Showing Android TV recipes anyway (preview mode):');
    const tv = all.filter((r) => r.device === 'androidtv');
    for (const r of tv) ui.log('    ' + ui.badge(r.risk) + '  ' + ui.c.bold(r.id) + ' — ' + ui.c.dim(r.name));
    return;
  }
  const matches = all.filter((r) => r.device === profile.family);
  ui.nl();
  ui.ok(`Found ${matches.length} recipe(s) for ${ui.c.bold(profile.brand + ' ' + profile.model)}:`);
  for (const r of matches) {
    ui.nl();
    ui.log('    ' + ui.badge(r.risk) + '  ' + ui.c.bold(r.id));
    ui.log('      ' + (r.summary || r.name));
    ui.log('      ' + ui.c.dim('Preview:  reclaim run ' + r.id + ' --dry-run'));
  }
}

async function cmdRun(id, flags) {
  if (!id) {
    ui.fail('Which recipe? e.g. ' + ui.c.bold('reclaim run androidtv/debloat --dry-run'));
    return;
  }
  const recipe = await recipesMod.findById(id);
  if (!recipe) {
    const feat = (await catalog.loadFeatures()).find((f) => f.id === id);
    if (feat && feat.status === 'template') {
      ui.fail(`"${id}" is a catalog template — a real capability that isn't scripted yet.`);
      if (feat.plan) ui.info(feat.plan);
      ui.info('Help build it: ' + ui.c.bold('reclaim new-recipe') + ', then add a recipe file.');
      return;
    }
    ui.fail(`No recipe with id "${id}".`);
    ui.info('See all: ' + ui.c.bold('reclaim list') + '  ·  browse the catalog: ' + ui.c.bold('reclaim catalog'));
    return;
  }

  const dry = Boolean(flags['dry-run'] || flags.dry);

  // Recipe header card.
  ui.heading(recipe.name);
  ui.log('    ' + ui.badge(recipe.risk) +
    (recipe.reversible !== false ? '  ' + ui.c.green('↺ reversible') : '  ' + ui.c.yellow('⚠ not auto-reversible')) +
    (recipe.warranty ? '  ' + ui.c.yellow('may void warranty') : ''));
  ui.nl();
  ui.log('    ' + (recipe.summary || ''));
  if (recipe.notes?.length) {
    ui.nl();
    recipe.notes.forEach((n) => ui.step(ui.c.dim(n)));
  }
  ui.nl();

  // Substitute ${apk} etc. from flags into steps.
  const resolved = recipesMod.resolveVars(recipe, flags);

  if (dry) {
    ui.box([ui.c.bold('DRY RUN') + ' — nothing will be changed. This is exactly what would happen:'], ui.c.magenta);
    ui.nl();
    await recipesMod.execute(resolved, { serial: null, mode: 'dry' });
    ui.nl();
    ui.ok('Dry run complete. Re-run without ' + ui.c.bold('--dry-run') + ' to apply (on a device).');
    return;
  }

  // Real apply — needs a device and (unless --yes) a confirmation.
  const profile = await requireDevice();
  if (!profile) return;
  if (profile.family !== recipe.device) {
    ui.fail(`This recipe is for "${recipe.device}" but the connected device is "${profile.family}".`);
    return;
  }
  if ((recipe.risk === 'advanced' || recipe.risk === 'expert') && !flags.force) {
    ui.warn('This recipe is rated ' + ui.badge(recipe.risk) + ' — higher risk.');
    ui.info('Read the summary above, then re-run with ' + ui.c.bold('--yes --force') + ' to proceed.');
    return;
  }
  if (!flags.yes) {
    ui.warn('About to make real changes to ' + ui.c.bold(profile.brand + ' ' + profile.model) + '.');
    ui.info('Re-run with ' + ui.c.bold('--yes') + ' to confirm, or add ' + ui.c.bold('--dry-run') + ' to preview first.');
    return;
  }

  ui.nl();
  const result = await recipesMod.execute(resolved, { serial: profile.serial, mode: 'apply' });
  ui.nl();
  if (result.ok) {
    ui.ok(`Done — ${result.doneCount} step(s) applied.`);
    if (recipe.reversible !== false) ui.info('Undo anytime: ' + ui.c.bold('reclaim undo ' + recipe.id));
  } else {
    ui.fail(`Stopped at "${result.failedAt}". Changes were rolled back.`);
  }
}

async function cmdUndo(id, flags) {
  if (!id) return ui.fail('Which recipe to undo? e.g. ' + ui.c.bold('reclaim undo androidtv/debloat'));
  const profile = await requireDevice();
  if (!profile) return;
  ui.heading('Undo ' + id);
  const res = await recipesMod.undo(id, { serial: profile.serial });
  ui.nl();
  if (res.ok) ui.ok('Reverted. Your device is back to where it was.');
  else ui.fail('Could not undo: ' + res.reason);
}

async function cmdHistory() {
  ui.heading('Device passport');
  const entries = await store.history();
  if (!entries.length) {
    ui.info('Nothing applied yet. Everything you do will be logged here so it can be undone.');
    ui.log('  ' + ui.c.dim('Stored at: ' + store.storePath));
    return;
  }
  for (const e of entries) {
    const mark = e.status === 'undone' ? ui.c.gray('↩ undone ') : ui.c.green('● applied');
    ui.log('  ' + mark + '  ' + ui.c.bold(e.id) + ui.c.dim('  ' + e.appliedAt));
  }
}

async function cmdDoctor() {
  const p = await requireDevice();
  if (!p) return;
  await doctor.report(p.serial, p);
}

function cmdRemote() {
  ui.heading('Live control — drive the TV from your keyboard');
  ui.step('Send a key:   ' + ui.c.bold('reclaim key <name> [count]'));
  ui.step('Type text:    ' + ui.c.bold('reclaim type "your text"') + ui.c.dim('  (passwords, search boxes)'));
  ui.step('Screenshot:   ' + ui.c.bold('reclaim screenshot'));
  ui.nl();
  ui.log('  ' + ui.c.dim('Keys: ') + control.keyNames().join(', '));
}

async function cmdKey(name, repeatArg) {
  if (!name) {
    ui.fail('Which key? e.g. ' + ui.c.bold('reclaim key down'));
    ui.info('See all: ' + ui.c.bold('reclaim remote'));
    return;
  }
  const p = await requireDevice();
  if (!p) return;
  const n = parseInt(repeatArg, 10);
  await control.sendKey(p.serial, name, Number.isFinite(n) && n > 0 ? n : 1);
}

async function cmdType(text) {
  const p = await requireDevice();
  if (!p) return;
  await control.typeText(p.serial, text);
}

async function cmdScreenshot(outArg) {
  const p = await requireDevice();
  if (!p) return;
  const abs = resolve(outArg || `reclaim-tv-${Date.now()}.png`);
  const sp = ui.spinner('Capturing TV screen…');
  try {
    await control.screenshot(p.serial, abs);
    sp.stop(ui.c.green('✔'), 'Saved screenshot');
    ui.log('  ' + ui.c.dim(abs));
  } catch (err) {
    sp.stop(ui.c.red('✘'), 'Screenshot failed — ' + err.message);
  }
}

async function cmdApps(flags) {
  const p = await requireDevice();
  if (!p) return;
  await apps.listApps(p.serial, { all: Boolean(flags.all) });
}

async function cmdApp(sub, pkg) {
  const p = await requireDevice();
  if (!p) return;
  if (sub === 'disable') return apps.setEnabled(p.serial, pkg, false);
  if (sub === 'enable') return apps.setEnabled(p.serial, pkg, true);
  ui.fail('Usage: ' + ui.c.bold('reclaim app disable|enable <package-id>'));
}

async function cmdWifi() {
  const p = await requireDevice();
  if (!p) return;
  await wifi.enable(p.serial);
}

async function cmdReboot() {
  const p = await requireDevice();
  if (!p) return;
  await control.reboot(p.serial);
}

async function cmdBackup(outArg) {
  const p = await requireDevice();
  if (!p) return;
  await backup.create(p.serial, p, outArg);
}

async function cmdRestore(file, flags) {
  if (!file) {
    ui.fail('Which backup file? e.g. ' + ui.c.bold('reclaim restore mytv.json --yes'));
    return;
  }
  const p = await requireDevice();
  if (!p) return;
  await backup.restore(p.serial, file, { apply: Boolean(flags.yes) });
}

async function cmdEmulator(sub, name) {
  if (sub === 'start') return emulator.start(name);
  if (sub === 'help') return emulator.help();
  return emulator.status();
}

// --- help ---------------------------------------------------------------

function showHelp() {
  ui.banner();
  ui.log('  ' + ui.c.bold('USAGE'));
  ui.log('    ' + ui.c.cyan('reclaim') + ' <command> [options]');
  ui.nl();
  ui.log('  ' + ui.c.bold('GET STARTED (no hardware needed)'));
  row('emulator', 'Set up / start a virtual Android TV to test on');
  row('detect', 'Find connected (or virtual) devices');
  row('recommend', 'Show safe recipes for your device');
  ui.nl();
  ui.log('  ' + ui.c.bold('CATALOG') + ui.c.dim('  (100+ features across 100+ devices)'));
  row('catalog', 'Overview: features, devices, areas');
  row('catalog areas|devices|features', 'Browse the full catalog');
  row('browse <area|family>', 'Filter features, e.g. browse privacy');
  row('search <text>', 'Search features + devices');
  row('new-recipe / new-device', 'Scaffold a new feature or device');
  row('validate', 'Check every recipe & catalog entry is valid');
  ui.nl();
  ui.log('  ' + ui.c.bold('RECIPES'));
  row('list', 'List runnable recipes');
  row('run <id> --dry-run', 'Preview a recipe without changing anything');
  row('run <id> --yes', 'Apply a recipe (makes real changes)');
  row('undo <id>', 'Roll a recipe back');
  row('history', 'See everything reclaim has done (device passport)');
  ui.nl();
  ui.log('  ' + ui.c.bold('PROFILES') + ui.c.dim('  (bundles of recipes, one command)'));
  row('profiles', 'List the profile bundles');
  row('profile <id> --dry-run', 'Preview a whole bundle');
  row('profile <id> --yes', 'Apply a whole bundle (e.g. profile privacy)');
  ui.nl();
  ui.log('  ' + ui.c.bold('LIVE CONTROL') + ui.c.dim('  (drive the TV from your computer)'));
  row('doctor', 'Device health + what reclaim has changed');
  row('remote', 'Show every control key');
  row('key <name> [n]', 'Send a remote key: up/down/ok/back/home…');
  row('type "text"', 'Type into the focused field (passwords, search)');
  row('screenshot [file]', 'Save a PNG of the TV screen');
  row('apps [--all]', 'List installed apps');
  row('app disable|enable <id>', 'Disable/enable any app (reversible)');
  row('protected', 'List system apps reclaim refuses to disable');
  row('wifi', 'Control the TV over Wi-Fi, no cable');
  row('reboot', 'Reboot the TV');
  ui.nl();
  ui.log('  ' + ui.c.bold('BACKUP') + ui.c.dim('  (clone a setup / recover after a reset)'));
  row('backup [file]', "Save this TV's config to a file");
  row('restore <file> --yes', 'Re-apply a saved config (same or new TV)');
  ui.nl();
  ui.log('  ' + ui.c.bold('GLOBAL FLAGS'));
  row('--dry-run', 'Never touch a device — just show what would happen');
  row('--yes', 'Skip the confirmation prompt');
  ui.nl();
  ui.box(
    [
      ui.c.bold('Try it right now, zero risk:'),
      ui.c.cyan('reclaim run androidtv/debloat --dry-run'),
    ],
    ui.c.green
  );
  ui.nl();
}

function row(cmd, desc) {
  ui.log('    ' + ui.c.cyan(cmd.padEnd(24)) + ui.c.dim(desc));
}
