// backup.js — snapshot a TV's reclaim-relevant config to a file, and restore it.
// Real-life win: set one box up perfectly, then clone that setup onto a new box
// (or recover after a factory reset) in one command.
import { homedir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as adb from './adb.js';
import * as ui from './ui.js';

const BACKUP_DIR = join(homedir(), '.reclaim', 'backups');

// The settings reclaim understands, as [namespace, key] pairs.
const SETTINGS = [
  ['global', 'private_dns_mode'],
  ['global', 'private_dns_specifier'],
  ['global', 'window_animation_scale'],
  ['global', 'transition_animation_scale'],
  ['global', 'animator_duration_scale'],
  ['global', 'captive_portal_mode'],
  ['global', 'captive_portal_detection_enabled'],
  ['global', 'multi_cpu_stats_collection'],
  ['secure', 'limit_ad_tracking'],
  ['secure', 'send_action_app_error'],
  ['system', 'screen_off_timeout'],
];

async function sget(serial, ns, key) {
  try {
    const { stdout } = await adb.shell(serial, `settings get ${ns} ${key}`);
    const v = stdout.trim();
    return v === 'null' ? null : v;
  } catch {
    return null;
  }
}

async function listDisabled(serial) {
  try {
    const { stdout } = await adb.shell(serial, 'cmd package list packages -d');
    return stdout.split('\n').map((l) => l.replace('package:', '').trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export async function create(serial, profile, outArg) {
  ui.heading('Backup device config');
  const settings = {};
  for (const [ns, key] of SETTINGS) settings[`${ns}.${key}`] = await sget(serial, ns, key);
  const disabledApps = await listDisabled(serial);

  const snapshot = {
    tool: 'reclaim',
    version: '0.1.0',
    createdAt: new Date().toISOString(),
    device: {
      brand: profile.brand,
      model: profile.model,
      android: profile.androidVersion,
      serial: profile.serial,
    },
    settings,
    disabledApps,
  };

  const path = outArg ? resolve(outArg) : join(BACKUP_DIR, `reclaim-backup-${Date.now()}.json`);
  await mkdir(dirname(path), { recursive: true }).catch(() => {});
  await writeFile(path, JSON.stringify(snapshot, null, 2));

  const setCount = Object.values(settings).filter((v) => v !== null).length;
  ui.ok(`Saved ${setCount} setting(s) and ${disabledApps.length} disabled app(s).`);
  ui.log('  ' + ui.c.dim(path));
  ui.info('Restore it (here or on another TV): ' + ui.c.bold(`reclaim restore "${path}" --yes`));
  return path;
}

export async function restore(serial, inPath, { apply }) {
  ui.heading('Restore device config');
  let snap;
  try {
    snap = JSON.parse(await readFile(resolve(inPath), 'utf8'));
  } catch (err) {
    ui.fail('Could not read backup file: ' + err.message);
    return;
  }

  const settingEntries = Object.entries(snap.settings || {}).filter(([, v]) => v !== null && v !== '');
  const appList = snap.disabledApps || [];

  ui.log('  From backup made ' + ui.c.dim(snap.createdAt || '?') +
    ' on ' + ui.c.dim(`${snap.device?.brand || ''} ${snap.device?.model || ''}`.trim()));
  ui.kv('settings', settingEntries.length + ' to apply');
  ui.kv('disabled apps', appList.length + ' to re-disable');

  if (!apply) {
    ui.nl();
    ui.warn('Preview only — nothing changed.');
    ui.info('Re-run with ' + ui.c.bold('--yes') + ' to apply this config to the device.');
    return;
  }

  ui.nl();
  for (const [k, v] of settingEntries) {
    const [ns, key] = k.split('.');
    const sp = ui.spinner(`${ns}.${key} = ${v}`);
    try {
      await adb.shell(serial, `settings put ${ns} ${key} ${v}`);
      sp.stop(ui.c.green('✔'), `${key} → ${v}`);
    } catch (err) {
      sp.stop(ui.c.red('✘'), `${key} — ${err.message}`);
    }
  }
  for (const pkg of appList) {
    const sp = ui.spinner('disable ' + pkg);
    try {
      await adb.shell(serial, `pm disable-user --user 0 ${pkg}`);
      sp.stop(ui.c.green('✔'), 'disabled ' + pkg);
    } catch (err) {
      sp.stop(ui.c.red('✘'), pkg + ' — ' + err.message);
    }
  }
  ui.nl();
  ui.ok('Restore complete — this device now matches the backup.');
}
