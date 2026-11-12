// profiles.js — a profile is a named bundle of recipes you run in one command.
// e.g. "privacy" = debloat + privacy + adblock-dns + no-captive-check.
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as recipesMod from './recipes.js';
import * as ui from './ui.js';

const PROFILES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'profiles');

export async function loadAll() {
  let files;
  try {
    files = (await readdir(PROFILES_DIR)).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  const out = [];
  for (const f of files) {
    try {
      out.push(JSON.parse(await readFile(join(PROFILES_DIR, f), 'utf8')));
    } catch (err) {
      ui.warn(`Skipping bad profile ${f}: ${err.message}`);
    }
  }
  return out;
}

export async function findById(id) {
  return (await loadAll()).find((p) => p.id === id) || null;
}

// Run every recipe in the bundle, in order. mode: 'dry' | 'apply'.
export async function run(profile, { serial, mode, flags = {} }) {
  const results = [];
  for (const rid of profile.recipes) {
    const recipe = await recipesMod.findById(rid);
    if (!recipe) {
      ui.warn(`Recipe not found, skipping: ${rid}`);
      continue;
    }
    ui.nl();
    ui.log('  ' + ui.badge(recipe.risk) + '  ' + ui.c.bold(recipe.name));
    const resolved = recipesMod.resolveVars(recipe, flags);
    const r = await recipesMod.execute(resolved, { serial, mode });
    results.push({ id: rid, ...r });
    if (!r.ok && mode === 'apply') {
      ui.warn(`"${rid}" failed — stopping the profile here. Earlier recipes stay applied.`);
      break;
    }
  }
  return results;
}
