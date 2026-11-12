// emulator.js — the "try it without your real TV" helper.
// Wraps the Android SDK's emulator so you can boot a virtual Android TV,
// test recipes on it, and never risk real hardware.
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import * as ui from './ui.js';

const execFileAsync = promisify(execFile);

const SDK_HINTS = [
  '$ANDROID_HOME/emulator/emulator',
  '$ANDROID_SDK_ROOT/emulator/emulator',
  '~/Library/Android/sdk/emulator/emulator (macOS default)',
];

async function tool(name) {
  try {
    await execFileAsync(name, ['-version']).catch(() => execFileAsync(name, ['--version']));
    return true;
  } catch {
    return false;
  }
}

export async function status() {
  ui.heading('Emulator environment');
  const hasEmu = await tool('emulator');
  const hasAvd = await tool('avdmanager');
  const hasAdb = await tool('adb');

  ui.kv('emulator', hasEmu ? ui.c.green('found') : ui.c.red('not on PATH'));
  ui.kv('avdmanager', hasAvd ? ui.c.green('found') : ui.c.red('not on PATH'));
  ui.kv('adb', hasAdb ? ui.c.green('found') : ui.c.red('not on PATH'));

  if (hasEmu) {
    try {
      const { stdout } = await execFileAsync('emulator', ['-list-avds']);
      const avds = stdout.split('\n').map((s) => s.trim()).filter(Boolean);
      ui.nl();
      if (avds.length) {
        ui.info('Available virtual devices:');
        avds.forEach((a) => ui.step(a));
        ui.nl();
        ui.info(`Start one with:  ${ui.c.bold('reclaim emulator start ' + avds[0])}`);
      } else {
        ui.warn('No AVDs yet. Create an Android TV one (see "reclaim emulator help").');
      }
    } catch {
      /* ignore */
    }
  }

  if (!hasEmu || !hasAdb) {
    ui.nl();
    help();
  }
}

export async function start(name) {
  const hasEmu = await tool('emulator');
  if (!hasEmu) {
    ui.fail('The Android emulator is not on your PATH.');
    help();
    return;
  }
  let target = name;
  if (!target) {
    const { stdout } = await execFileAsync('emulator', ['-list-avds']);
    const avds = stdout.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!avds.length) {
      ui.fail('No virtual devices found. Create an Android TV AVD first.');
      help();
      return;
    }
    target = avds[0];
  }
  ui.info(`Booting virtual Android TV: ${ui.c.bold(target)}`);
  ui.step('A TV window will open. Leave it running, then open a new terminal and run:');
  ui.step(ui.c.bold('reclaim detect'));
  ui.nl();
  // Detach so the emulator keeps running after the command returns.
  const child = spawn('emulator', ['-avd', target], { detached: true, stdio: 'ignore' });
  child.unref();
  ui.ok('Emulator launching in the background.');
}

export function help() {
  ui.heading('Set up a virtual Android TV (free, no hardware)');
  ui.step('1. Install Android Studio  →  https://developer.android.com/studio');
  ui.step('2. In Studio: Device Manager → Create Device → category ' + ui.c.bold('"TV"'));
  ui.step('3. Pick a system image (e.g. ' + ui.c.bold('Android TV, API 34') + ') and finish.');
  ui.step('4. Make sure the SDK tools are on your PATH:');
  SDK_HINTS.forEach((h) => ui.log('       ' + ui.c.dim(h)));
  ui.nl();
  ui.step('Then:  ' + ui.c.bold('reclaim emulator start') + '   →   ' + ui.c.bold('reclaim detect') + '   →   ' + ui.c.bold('reclaim recommend'));
  ui.nl();
  ui.box(
    [
      ui.c.bold('Why emulator-first?'),
      'Test every recipe on a virtual TV you can break and reset freely.',
      'Your real device is never at risk while you learn what works.',
    ],
    ui.c.magenta
  );
}
