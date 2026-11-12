// catalog.js — the registry that lets reclaim scale: areas, devices, features.
// Real recipes are "ready"; real-but-unscripted capabilities are "template"
// (honest scaffolds, never fake commands). Generators add new entries fast.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as ui from './ui.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATALOG = join(ROOT, 'catalog');

async function readJson(name) {
  try {
    return JSON.parse(await readFile(join(CATALOG, name), 'utf8'));
  } catch {
    return [];
  }
}

export const loadAreas = () => readJson('areas.json');
export const loadDevices = () => readJson('devices.json');
export const loadFeatures = () => readJson('features.json');

function statusBadge(s) {
  if (s === 'ready') return ui.c.bold(ui.c.bgGreen(ui.c.white(' READY ')));
  if (s === 'supported') return ui.c.green('supported');
  if (s === 'template') return ui.c.yellow('template');
  if (s === 'planned') return ui.c.cyan('planned');
  if (s === 'community') return ui.c.magenta('community');
  return ui.c.dim(s || '');
}

// --- overview -----------------------------------------------------------

export async function overview() {
  const [areas, devices, features] = await Promise.all([loadAreas(), loadDevices(), loadFeatures()]);
  const ready = features.filter((f) => f.status === 'ready').length;
  const families = new Set(devices.map((d) => d.family));
  const byStatus = devices.reduce((m, d) => ((m[d.status] = (m[d.status] || 0) + 1), m), {});

  ui.heading('reclaim catalog');
  ui.log('  ' + ui.c.bold(ui.c.cyan(String(features.length))) + ' features    ' +
    ui.c.bold(ui.c.cyan(String(devices.length))) + ' devices    ' +
    ui.c.bold(ui.c.cyan(String(families.size))) + ' families    ' +
    ui.c.bold(ui.c.cyan(String(areas.length))) + ' areas');
  ui.nl();
  ui.kv('features', `${ui.c.green(ready + ' ready (runnable now)')}, ${ui.c.yellow((features.length - ready) + ' templates')}`);
  ui.kv('devices', Object.entries(byStatus).map(([k, v]) => `${v} ${k}`).join(', '));
  ui.nl();
  ui.info('Browse: ' + ui.c.bold('reclaim catalog areas|devices|features'));
  ui.info('Filter: ' + ui.c.bold('reclaim browse <area|family>') + '  e.g. ' + ui.c.dim('reclaim browse privacy'));
  ui.info('Add:    ' + ui.c.bold('reclaim new-recipe') + ' / ' + ui.c.bold('reclaim new-device'));
}

export async function listAreas() {
  const [areas, features] = await Promise.all([loadAreas(), loadFeatures()]);
  ui.heading(`Areas (${areas.length})`);
  for (const a of areas) {
    const n = features.filter((f) => f.area === a.id).length;
    ui.log('  ' + ui.c.bold(a.id.padEnd(18)) + ui.c.dim((n + ' features').padEnd(14)) + a.about);
  }
}

export async function listDevices(filter = {}) {
  const devices = await loadDevices();
  const rows = devices.filter((d) =>
    (!filter.family || d.family.toLowerCase().includes(filter.family.toLowerCase())));
  ui.heading(`Devices (${rows.length})`);
  let current = '';
  for (const d of rows) {
    if (d.family !== current) {
      current = d.family;
      ui.nl();
      ui.log('  ' + ui.c.bold(ui.c.blue(current)));
    }
    ui.log('    ' + statusBadge(d.status).padEnd(22) + ' ' + d.name + ui.c.dim('  [' + d.access + ']'));
  }
}

export async function listFeatures(filter = {}) {
  const features = await loadFeatures();
  const rows = features.filter((f) =>
    (!filter.area || f.area === filter.area) &&
    (!filter.family || f.family.toLowerCase().includes(filter.family.toLowerCase())) &&
    (!filter.status || f.status === filter.status));
  ui.heading(`Features (${rows.length}${filter.area ? ' · ' + filter.area : ''}${filter.family ? ' · ' + filter.family : ''})`);
  for (const f of rows) {
    ui.log('    ' + statusBadge(f.status).padEnd(22) + ' ' + ui.c.bold(f.id));
    ui.log('      ' + ui.c.dim(`${f.family} · ${f.area} · ${f.risk}`) + (f.name ? '  ' + f.name : ''));
  }
  ui.nl();
  ui.info('Ready ones run now: ' + ui.c.bold('reclaim run <id> --dry-run'));
}

// browse by either an area id or a device family
export async function browse(term) {
  const [areas, features] = await Promise.all([loadAreas(), loadFeatures()]);
  if (areas.some((a) => a.id === term)) return listFeatures({ area: term });
  const families = new Set(features.map((f) => f.family.toLowerCase()));
  if (families.has(term.toLowerCase())) return listFeatures({ family: term });
  // partial family match
  if ([...families].some((fam) => fam.includes(term.toLowerCase()))) return listFeatures({ family: term });
  ui.fail(`"${term}" is not a known area or family.`);
  ui.info('See areas: ' + ui.c.bold('reclaim catalog areas') + '  ·  devices: ' + ui.c.bold('reclaim catalog devices'));
}

// search across features and devices by free text
export async function search(term) {
  const t = String(term || '').toLowerCase();
  const [features, devices] = await Promise.all([loadFeatures(), loadDevices()]);
  const fm = features.filter((f) =>
    [f.id, f.name, f.area, f.family, f.plan].filter(Boolean).some((x) => x.toLowerCase().includes(t)));
  const dm = devices.filter((d) =>
    [d.id, d.name, d.family].some((x) => x.toLowerCase().includes(t)));

  ui.heading(`Search "${term}"`);
  ui.log('  ' + ui.c.bold(`Features (${fm.length})`));
  for (const f of fm.slice(0, 40)) {
    ui.log('    ' + statusBadge(f.status).padEnd(22) + ' ' + ui.c.bold(f.id) + ui.c.dim('  ' + f.family));
  }
  if (fm.length > 40) ui.log('    ' + ui.c.dim(`…and ${fm.length - 40} more`));
  ui.nl();
  ui.log('  ' + ui.c.bold(`Devices (${dm.length})`));
  for (const d of dm.slice(0, 25)) {
    ui.log('    ' + statusBadge(d.status).padEnd(22) + ' ' + d.name);
  }
  if (!fm.length && !dm.length) ui.warn('No matches.');
}

// --- generators ---------------------------------------------------------

export async function newDevice(flags) {
  const { id, name, family, access = 'adb', status = 'planned' } = flags;
  if (!id || !name || !family) {
    ui.fail('Usage: ' + ui.c.bold('reclaim new-device --id <id> --name "<name>" --family "<family>" [--access adb] [--status planned]'));
    return;
  }
  const devices = await loadDevices();
  if (devices.some((d) => d.id === id)) {
    ui.fail(`Device id "${id}" already exists.`);
    return;
  }
  devices.push({ id, name, family, access, status });
  await writeFile(join(CATALOG, 'devices.json'), JSON.stringify(devices, null, 2) + '\n');
  ui.ok(`Added device ${ui.c.bold(name)} (${family}). Catalog now has ${devices.length} devices.`);
}

export async function newRecipe(flags) {
  const { id, name, area = 'privacy', device = 'androidtv', risk = 'safe' } = flags;
  if (!id || !name) {
    ui.fail('Usage: ' + ui.c.bold('reclaim new-recipe --id <family/slug> --name "<name>" [--area <area>] [--device <family>] [--risk safe]'));
    return;
  }
  const features = await loadFeatures();
  if (features.some((f) => f.id === id)) {
    ui.fail(`Feature id "${id}" already exists.`);
    return;
  }
  features.push({ id, name, area, family: device, risk, status: 'template', plan: 'Describe the steps here, then promote to a real recipe.' });
  await writeFile(join(CATALOG, 'features.json'), JSON.stringify(features, null, 2) + '\n');
  ui.ok(`Added template feature ${ui.c.bold(id)}. Catalog now has ${features.length} features.`);
  ui.info('Make it runnable: add a recipe file at ' + ui.c.bold(`recipes/${device}/<slug>.json`) + ' and set status to "ready".');
}
