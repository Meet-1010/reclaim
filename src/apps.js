// apps.js — see and manage what's installed, beyond the fixed recipes.
// Real-life win: find and disable whatever junk YOUR specific box shipped,
// not just the names baked into recipes.
import * as adb from './adb.js';
import * as ui from './ui.js';

async function list(serial, flag) {
  try {
    const { stdout } = await adb.shell(serial, `cmd package list packages ${flag}`);
    return stdout
      .split('\n')
      .map((l) => l.replace('package:', '').trim())
      .filter(Boolean)
      .sort();
  } catch {
    return [];
  }
}

export async function listApps(serial, { all = false } = {}) {
  ui.heading(all ? 'All packages' : 'Installed apps (user-facing)');
  const pkgs = await list(serial, all ? '' : '-3'); // -3 = third-party apps
  const disabled = new Set(await list(serial, '-d'));
  if (!pkgs.length) {
    ui.warn('No packages found.');
    return;
  }
  for (const p of pkgs) {
    const mark = disabled.has(p) ? ui.c.gray('✘ disabled') : ui.c.green('● enabled ');
    ui.log('  ' + mark + '  ' + p);
  }
  ui.nl();
  ui.info(`${pkgs.length} package(s). Disable one (reversible): ` + ui.c.bold('reclaim app disable <id>'));
}

export async function setEnabled(serial, pkg, enabled) {
  if (!pkg) {
    ui.fail('Which app? e.g. ' + ui.c.bold('reclaim app disable com.example.bloat'));
    return;
  }
  const action = enabled ? 'enable' : 'disable-user --user 0';
  try {
    await adb.shell(serial, `pm ${action} ${pkg}`);
    ui.ok(`${pkg} is now ${enabled ? ui.c.green('enabled') : ui.c.yellow('disabled')}.`);
    if (!enabled) ui.info('Re-enable anytime: ' + ui.c.bold('reclaim app enable ' + pkg));
  } catch (err) {
    ui.fail(`Could not ${enabled ? 'enable' : 'disable'} ${pkg}: ${err.message}`);
  }
}
