// recipes.js — load recipe files and run them (dry-run, apply, undo).
// The whole product is "an engine + a library of recipes": the engine never
// changes, the recipe library grows forever.
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as adb from './adb.js';
import * as store from './store.js';
import * as ui from './ui.js';
import * as safety from './safety.js';

const RECIPES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'recipes');

// --- loading ------------------------------------------------------------

export async function loadAll() {
  const out = [];
  let families;
  try {
    families = await readdir(RECIPES_DIR, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const fam of families) {
    if (!fam.isDirectory()) continue;
    const famDir = join(RECIPES_DIR, fam.name);
    const files = (await readdir(famDir)).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      try {
        const recipe = JSON.parse(await readFile(join(famDir, file), 'utf8'));
        recipe._family = fam.name;
        out.push(validate(recipe, join(fam.name, file)));
      } catch (err) {
        ui.warn(`Skipping bad recipe ${fam.name}/${file}: ${err.message}`);
      }
    }
  }
  return out;
}

export async function findById(id) {
  const all = await loadAll();
  return all.find((r) => r.id === id) || null;
}

function validate(recipe, where) {
  for (const field of ['id', 'name', 'device', 'risk', 'steps']) {
    if (recipe[field] === undefined) {
      throw new Error(`missing "${field}" in ${where}`);
    }
  }
  if (!Array.isArray(recipe.steps) || recipe.steps.length === 0) {
    throw new Error(`"steps" must be a non-empty array in ${where}`);
  }
  return recipe;
}

// --- execution ----------------------------------------------------------

// Render one step as a human-readable action.
function describeStep(stepObj) {
  switch (stepObj.type) {
    case 'adb-shell':
      return `${stepObj.label}  ${ui.c.dim('(' + stepObj.cmd + ')')}`;
    case 'adb-install':
      return `${stepObj.label}  ${ui.c.dim('(install ' + stepObj.apk + ')')}`;
    case 'note':
      return stepObj.label;
    default:
      return `${stepObj.label || stepObj.type}`;
  }
}

// Run a recipe. mode: 'dry' | 'apply'. Returns a result summary.
export async function execute(recipe, { serial, mode }) {
  const undoStack = [];
  let doneCount = 0;

  for (const stepObj of recipe.steps) {
    const desc = describeStep(stepObj);

    // BRICK-GUARD: never disable/uninstall a protected system package.
    if (stepObj.type === 'adb-shell') {
      const bad = safety.protectedTargets(stepObj.cmd);
      if (bad.length) {
        ui.fail(`Blocked "${stepObj.label}" — would touch protected system app(s): ${bad.join(', ')}`);
        ui.info('reclaim refuses this to avoid bricking the device (see ' + ui.c.bold('reclaim protected') + ').');
        if (mode === 'apply' && undoStack.length) {
          ui.warn('Rolling back the steps already applied…');
          await rollback(serial, undoStack);
        }
        return { ok: false, doneCount, failedAt: stepObj.label, undo: undoStack, blocked: true };
      }
    }

    if (mode === 'dry') {
      ui.dryRun(desc);
      if (stepObj.undo) undoStack.push({ label: stepObj.label, cmd: stepObj.undo });
      doneCount++;
      continue;
    }

    // apply
    const sp = ui.spinner(stepObj.label);
    try {
      if (stepObj.type === 'adb-shell') {
        await adb.shell(serial, stepObj.cmd);
      } else if (stepObj.type === 'adb-install') {
        await adb.install(serial, stepObj.apk);
      } else if (stepObj.type === 'note') {
        // informational only
      }
      if (stepObj.undo) undoStack.push({ label: stepObj.label, cmd: stepObj.undo });
      doneCount++;
      sp.stop(ui.c.green('✔'), stepObj.label);
    } catch (err) {
      sp.stop(ui.c.red('✘'), `${stepObj.label} — ${err.message}`);
      // Best-effort rollback of everything done so far.
      ui.warn('Step failed — rolling back changes made so far…');
      await rollback(serial, undoStack);
      return { ok: false, doneCount, failedAt: stepObj.label, undo: undoStack };
    }
  }

  if (mode === 'apply' && recipe.reversible !== false) {
    await store.recordApply({
      recipeId: recipe.id,
      name: recipe.name,
      device: recipe.device,
      undo: undoStack,
    });
  }

  return { ok: true, doneCount, undo: undoStack };
}

async function rollback(serial, undoStack) {
  for (let i = undoStack.length - 1; i >= 0; i--) {
    try {
      await adb.shell(serial, undoStack[i].cmd);
    } catch {
      /* keep going — best effort */
    }
  }
}

// Substitute ${apk} / ${package} / ${dns} / ${scale} from CLI flags into a
// recipe's commands. Shared by both single-recipe runs and profile bundles.
export function resolveVars(recipe, flags = {}) {
  const clone = JSON.parse(JSON.stringify(recipe));
  const sub = (v) =>
    typeof v === 'string'
      ? v
          .replace('${apk}', flags.apk || '<APK_PATH>')
          .replace('${package}', flags.package || '<PACKAGE_NAME>')
          .replace('${dns}', flags.dns || 'dns.adguard-dns.com')
          .replace('${scale}', flags.scale !== undefined ? String(flags.scale) : '0.5')
          .replace('${density}', flags.density !== undefined ? String(flags.density) : '240')
      : v;
  for (const s of clone.steps) {
    if (s.apk) s.apk = sub(s.apk);
    if (s.cmd) s.cmd = sub(s.cmd);
    if (s.undo) s.undo = sub(s.undo);
  }
  return clone;
}

// Undo a previously applied recipe using the stored passport record.
export async function undo(recipeId, { serial }) {
  const record = await store.latestApplied(recipeId);
  if (!record) return { ok: false, reason: 'no applied record found' };
  if (!record.undo || record.undo.length === 0) {
    return { ok: false, reason: 'this recipe recorded no undo steps' };
  }
  for (let i = record.undo.length - 1; i >= 0; i--) {
    const u = record.undo[i];
    const sp = ui.spinner(`Undo: ${u.label}`);
    try {
      await adb.shell(serial, u.cmd);
      sp.stop(ui.c.green('✔'), `Reverted: ${u.label}`);
    } catch (err) {
      sp.stop(ui.c.red('✘'), `${u.label} — ${err.message}`);
    }
  }
  await store.markUndone(recipeId);
  return { ok: true };
}
