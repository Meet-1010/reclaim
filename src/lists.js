// lists.js — community-maintained package lists (the scaling model the mature
// TV tools use). A device's list can be refreshed from a community source;
// fetched data is treated as UNTRUSTED (validated, and the brick-guard still
// blocks protected packages no matter what a list claims).
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import * as adb from './adb.js';
import * as store from './store.js';
import * as safety from './safety.js';
import * as ui from './ui.js';

const BUNDLED_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'lists');
const CACHE_DIR = join(homedir(), '.reclaim', 'lists');
const LEVEL_RANK = { recommended: 1, advanced: 2, expert: 3 };

const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'));

export async function loadBundled(device) {
  try {
    return await readJson(join(BUNDLED_DIR, `${device}.json`));
  } catch {
    return null;
  }
}

// Community cache (if present) overrides the bundled list.
export async function load(device) {
  try {
    const l = await readJson(join(CACHE_DIR, `${device}.json`));
    l._origin = 'community (updated)';
    return l;
  } catch {
    /* fall through to bundled */
  }
  const b = await loadBundled(device);
  if (b) b._origin = 'bundled';
  return b;
}

export async function available() {
  try {
    return (await readdir(BUNDLED_DIR)).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
  } catch {
    return [];
  }
}

function levelBadge(l) {
  if (l === 'recommended') return ui.c.green('recommended');
  if (l === 'advanced') return ui.c.yellow('advanced  ');
  if (l === 'expert') return ui.c.red('expert    ');
  return ui.c.dim(l || '');
}

export async function overview() {
  const devices = await available();
  ui.heading('Package lists');
  for (const d of devices) {
    const l = await load(d);
    ui.log('  ' + ui.c.bold(d.padEnd(14)) + ui.c.dim((l.packages.length + ' packages').padEnd(14)) + ui.c.dim('(' + l._origin + ')'));
  }
  ui.nl();
  ui.info('Browse: ' + ui.c.bold('reclaim bloat <device>') + '  ·  refresh: ' + ui.c.bold('reclaim lists update <device>'));
}

export async function browse(device) {
  const list = await load(device);
  if (!list) {
    ui.fail(`No package list for "${device}".`);
    return;
  }
  ui.heading(`Bloat list — ${device}  (${list.packages.length} packages · ${list._origin})`);
  const byCat = {};
  for (const p of list.packages) (byCat[p.category] ??= []).push(p);
  for (const [cat, items] of Object.entries(byCat)) {
    ui.nl();
    ui.log('  ' + ui.c.bold(ui.c.blue(cat)));
    for (const p of items) {
      ui.log('    ' + levelBadge(p.level) + '  ' + ui.c.bold(p.label) + ui.c.dim('  ' + p.package));
    }
  }
  ui.nl();
  ui.info('Apply: ' + ui.c.bold('reclaim debloat --level recommended --dry-run'));
}

// Compute what a debloat at a given level would target (structured data).
// candidates = at/below level & not protected; present = installed (if a device).
export async function candidates(device, level = 'recommended', serial = null) {
  const list = await load(device);
  if (!list) return null;
  const rank = LEVEL_RANK[level] || 1;
  const cands = list.packages
    .filter((p) => (LEVEL_RANK[p.level] || 1) <= rank)
    .filter((p) => !safety.isProtected(p.package));

  let present = cands;
  let installChecked = false;
  if (serial) {
    try {
      const { stdout } = await adb.shell(serial, 'pm list packages');
      const installed = new Set(stdout.split('\n').map((l) => l.replace('package:', '').trim()));
      present = cands.filter((p) => installed.has(p.package));
      installChecked = true;
    } catch {
      /* fall back to all candidates */
    }
  }
  return { device, level, origin: list._origin, candidates: cands, present, installChecked };
}

// Disable packages from the list up to the chosen level. mode: 'dry' | 'apply'.
export async function debloat(serial, { device, level = 'recommended', mode }) {
  const data = await candidates(device, level, serial);
  if (!data) {
    ui.fail(`No package list for "${device}".`);
    return;
  }
  const { candidates: cands, present } = data;

  ui.heading(`Debloat ${device} — level: ${level}`);
  ui.log('  ' + ui.c.dim(`${cands.length} candidate(s) at this level · ${present.length} ${serial ? 'installed on this device' : '(install status unknown — no device)'}`));
  ui.nl();
  if (!present.length) {
    ui.warn('Nothing to disable here.');
    return;
  }

  if (mode === 'dry') {
    for (const p of present) ui.dryRun('disable ' + p.label + ui.c.dim('  ' + p.package));
    ui.nl();
    ui.ok('Dry run — nothing changed. Apply with ' + ui.c.bold('--yes') + ' (needs a device).');
    return;
  }

  const undo = [];
  for (const p of present) {
    const sp = ui.spinner('disable ' + p.label);
    try {
      await adb.shell(serial, `pm disable-user --user 0 ${p.package}`);
      undo.push({ label: p.label, cmd: `pm enable ${p.package}` });
      sp.stop(ui.c.green('✔'), 'disabled ' + p.label);
    } catch (err) {
      sp.stop(ui.c.red('✘'), p.label + ' — ' + err.message);
    }
  }
  if (undo.length) {
    await store.recordApply({ recipeId: `debloat/${device}`, name: `Debloat (${level})`, device, undo });
  }
  ui.nl();
  ui.ok(`Disabled ${undo.length} app(s).`);
  ui.info('Undo all: ' + ui.c.bold(`reclaim undo debloat/${device}`));
}

// Refresh a device list from a community source. Treats input as UNTRUSTED.
export async function update(device, { url, file } = {}) {
  ui.heading(`Update "${device}" package list`);
  let raw;
  if (file) {
    ui.info('Source (local file): ' + file);
    try {
      raw = await readFile(file, 'utf8');
    } catch (err) {
      ui.fail('Could not read file: ' + err.message);
      return;
    }
  } else {
    const src = url || `https://raw.githubusercontent.com/Meet-1010/reclaim/main/lists/${device}.json`;
    ui.info('Fetching: ' + src);
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      raw = await res.text();
    } catch (err) {
      ui.fail('Could not fetch the list: ' + err.message);
      ui.info('If the repo is private, make it public or pass ' + ui.c.bold('--file <path>') + '.');
      return;
    }
  }

  // --- validate untrusted input before trusting it ---
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    ui.fail('Downloaded content is not valid JSON — ignored. (' + err.message + ')');
    return;
  }
  if (!data || !Array.isArray(data.packages)) {
    ui.fail('List has no "packages" array — ignored.');
    return;
  }
  const malformed = data.packages.filter((p) => !p || typeof p.package !== 'string');
  if (malformed.length) {
    ui.fail(`${malformed.length} malformed entries — the whole file is ignored for safety.`);
    return;
  }
  const protectedHits = data.packages.map((p) => p.package).filter(safety.isProtected);
  if (protectedHits.length) {
    ui.fail('This list targets protected system packages — refused for safety:');
    protectedHits.forEach((p) => ui.log('    ' + ui.c.red('• ') + p));
    return;
  }

  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(join(CACHE_DIR, `${device}.json`), JSON.stringify(data, null, 2));
  ui.ok(`Updated — ${data.packages.length} packages cached, overriding the bundled list.`);
  ui.info('Browse it: ' + ui.c.bold('reclaim bloat ' + device));
}
