// validate.js — integrity check for recipes, profiles and the catalog.
// Keeps the growing catalog honest: enforces the schema AND the project's
// core rule — template features must never carry executable steps.
import * as recipesMod from './recipes.js';
import * as profilesMod from './profiles.js';
import * as catalog from './catalog.js';
import * as lists from './lists.js';
import * as ui from './ui.js';
import * as safety from './safety.js';

const LIST_LEVELS = new Set(['recommended', 'advanced', 'expert']);

const RISK = new Set(['safe', 'reversible', 'advanced', 'expert']);
const FEAT_STATUS = new Set(['ready', 'template']);
const DEV_STATUS = new Set(['supported', 'planned', 'community']);
const ACCESS = new Set(['adb', 'ssh', 'flash', 'web', 'usb', 'local']);
const STEP_TYPES = new Set(['adb-shell', 'adb-install', 'note']);

export async function run() {
  const errors = [];
  const warnings = [];
  const E = (m) => errors.push(m);
  const W = (m) => warnings.push(m);

  // --- recipes ---
  const recipes = await recipesMod.loadAll();
  const recipeIds = new Set(recipes.map((r) => r.id));
  for (const r of recipes) {
    if (!RISK.has(r.risk)) E(`recipe ${r.id}: invalid risk "${r.risk}"`);
    for (const s of r.steps || []) {
      if (!STEP_TYPES.has(s.type)) E(`recipe ${r.id}: invalid step type "${s.type}"`);
      if (s.type === 'adb-shell' && !s.cmd) E(`recipe ${r.id}: adb-shell step missing "cmd"`);
      if (s.type === 'adb-install' && !s.apk) E(`recipe ${r.id}: adb-install step missing "apk"`);
      if (s.type === 'adb-shell' && r.reversible !== false && !s.undo) {
        W(`recipe ${r.id}: step "${s.label || s.cmd}" has no undo`);
      }
      if (s.type === 'adb-shell') {
        const bad = safety.protectedTargets(s.cmd);
        if (bad.length) E(`recipe ${r.id}: step "${s.label}" targets PROTECTED app(s) ${bad.join(', ')} — would risk bricking`);
      }
    }
  }

  // --- profiles ---
  const profiles = await profilesMod.loadAll();
  for (const p of profiles) {
    for (const rid of p.recipes || []) {
      if (!recipeIds.has(rid)) E(`profile ${p.id}: references missing recipe "${rid}"`);
    }
  }

  // --- areas ---
  const areas = await catalog.loadAreas();
  const areaIds = new Set();
  for (const a of areas) {
    if (areaIds.has(a.id)) E(`area "${a.id}": duplicate id`);
    areaIds.add(a.id);
  }

  // --- devices ---
  const devices = await catalog.loadDevices();
  const devIds = new Set();
  for (const d of devices) {
    if (devIds.has(d.id)) E(`device "${d.id}": duplicate id`);
    devIds.add(d.id);
    if (!d.name || !d.family) E(`device ${d.id}: missing name/family`);
    if (!DEV_STATUS.has(d.status)) E(`device ${d.id}: invalid status "${d.status}"`);
    if (!ACCESS.has(d.access)) E(`device ${d.id}: invalid access "${d.access}"`);
  }

  // --- features ---
  const features = await catalog.loadFeatures();
  const featIds = new Set();
  for (const f of features) {
    if (featIds.has(f.id)) E(`feature "${f.id}": duplicate id`);
    featIds.add(f.id);
    if (!FEAT_STATUS.has(f.status)) E(`feature ${f.id}: invalid status "${f.status}"`);
    if (!RISK.has(f.risk)) E(`feature ${f.id}: invalid risk "${f.risk}"`);
    if (!areaIds.has(f.area)) E(`feature ${f.id}: unknown area "${f.area}"`);
    if (f.status === 'ready' && !recipeIds.has(f.id)) E(`feature ${f.id}: marked "ready" but no recipe file exists`);
    if (f.status === 'template' && f.steps) E(`feature ${f.id}: template must NOT contain steps (honest-scaffold rule)`);
    if (f.status === 'template' && !f.plan) W(`feature ${f.id}: template has no "plan" description`);
  }

  // every runnable recipe should be listed as a ready feature
  const readyIds = new Set(features.filter((f) => f.status === 'ready').map((f) => f.id));
  for (const id of recipeIds) {
    if (!readyIds.has(id)) W(`recipe ${id}: no matching "ready" catalog feature`);
  }

  // --- package lists ---
  const listDevices = await lists.available();
  let listPkgCount = 0;
  for (const d of listDevices) {
    const l = await lists.loadBundled(d);
    if (!l || !Array.isArray(l.packages)) {
      E(`list ${d}: missing "packages" array`);
      continue;
    }
    const seenPkg = new Set();
    for (const p of l.packages) {
      listPkgCount++;
      if (!p.package || !p.label) E(`list ${d}: entry missing package/label`);
      if (!LIST_LEVELS.has(p.level)) E(`list ${d}: "${p.package}" invalid level "${p.level}"`);
      if (seenPkg.has(p.package)) E(`list ${d}: duplicate package "${p.package}"`);
      seenPkg.add(p.package);
      if (safety.isProtected(p.package)) E(`list ${d}: "${p.package}" is a PROTECTED app — must not be in a bloat list`);
    }
  }

  // --- report ---
  ui.heading('Validate');
  ui.kv('recipes', String(recipes.length));
  ui.kv('lists', `${listDevices.length} (${listPkgCount} packages)`);
  ui.kv('profiles', String(profiles.length));
  ui.kv('areas', String(areas.length));
  ui.kv('devices', String(devices.length));
  ui.kv('features', String(features.length));
  ui.nl();

  if (warnings.length) {
    ui.log('  ' + ui.c.yellow(ui.c.bold(`Warnings (${warnings.length})`)));
    warnings.forEach(W2 => ui.warn(W2));
    ui.nl();
  }
  if (errors.length) {
    ui.log('  ' + ui.c.red(ui.c.bold(`Errors (${errors.length})`)));
    errors.forEach((e) => ui.fail(e));
    ui.nl();
    ui.fail('Validation FAILED.');
    return 1;
  }
  ui.ok('All good — every recipe, profile and catalog entry is valid.');
  return 0;
}
