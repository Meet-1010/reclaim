// store.js — the "device passport" and restore points.
// Everything reclaim does to a device is logged here so it can always be undone.
import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const ROOT = join(homedir(), '.reclaim');
const PASSPORT = join(ROOT, 'passport.json');

async function load() {
  try {
    return JSON.parse(await readFile(PASSPORT, 'utf8'));
  } catch {
    return { version: 1, applied: [] };
  }
}

async function save(data) {
  await mkdir(ROOT, { recursive: true });
  await writeFile(PASSPORT, JSON.stringify(data, null, 2));
}

// Record that a recipe was applied, with the undo commands captured.
export async function recordApply(entry) {
  const data = await load();
  data.applied.push({
    id: entry.recipeId,
    name: entry.name,
    device: entry.device,
    appliedAt: new Date().toISOString(),
    undo: entry.undo, // array of { label, cmd }
    status: 'applied',
  });
  await save(data);
}

// Mark the most recent application of a recipe as undone.
export async function markUndone(recipeId) {
  const data = await load();
  for (let i = data.applied.length - 1; i >= 0; i--) {
    if (data.applied[i].id === recipeId && data.applied[i].status === 'applied') {
      data.applied[i].status = 'undone';
      data.applied[i].undoneAt = new Date().toISOString();
      await save(data);
      return data.applied[i];
    }
  }
  return null;
}

export async function history() {
  return (await load()).applied;
}

// Find the newest still-applied record for a recipe (what `undo` targets).
export async function latestApplied(recipeId) {
  const data = await load();
  for (let i = data.applied.length - 1; i >= 0; i--) {
    if (data.applied[i].id === recipeId && data.applied[i].status === 'applied') {
      return data.applied[i];
    }
  }
  return null;
}

export const storePath = ROOT;
