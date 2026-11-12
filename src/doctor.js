// doctor.js — a one-glance health & status dashboard for the TV.
// Answers "what is this box, and what has reclaim already done to it?"
import * as adb from './adb.js';
import * as ui from './ui.js';

async function sh(serial, cmd) {
  try {
    const { stdout } = await adb.shell(serial, cmd);
    return stdout.trim();
  } catch {
    return '';
  }
}

export async function report(serial, profile) {
  ui.heading('Device health — ' + profile.brand + ' ' + profile.model);

  // --- identity ---
  const [patch, uptime] = await Promise.all([
    sh(serial, 'getprop ro.build.version.security_patch'),
    sh(serial, 'cat /proc/uptime'),
  ]);
  ui.log('  ' + ui.c.bold(ui.c.cyan('System')));
  ui.kv('android', profile.androidVersion);
  ui.kv('security patch', patch || 'unknown');
  ui.kv('serial', profile.serial);
  if (uptime) ui.kv('uptime', Math.round(parseFloat(uptime) / 60) + ' min');

  // --- storage & memory ---
  const df = await sh(serial, 'df -h /data | tail -1');
  const memTotal = await sh(serial, "cat /proc/meminfo | grep MemTotal | awk '{print $2}'");
  const memAvail = await sh(serial, "cat /proc/meminfo | grep MemAvailable | awk '{print $2}'");
  ui.nl();
  ui.log('  ' + ui.c.bold(ui.c.cyan('Resources')));
  if (df) {
    const cols = df.split(/\s+/);
    ui.kv('storage /data', `${cols[2] || '?'} used / ${cols[1] || '?'} (${cols[4] || '?'} full)`);
  }
  if (memTotal) {
    const t = (parseInt(memTotal, 10) / 1024 / 1024).toFixed(1);
    const a = memAvail ? (parseInt(memAvail, 10) / 1024 / 1024).toFixed(1) : '?';
    ui.kv('memory', `${a} GB free / ${t} GB`);
  }

  // --- what reclaim changed ---
  const [dnsMode, dnsHost, limitAds, animW, disabled, tcpPort] = await Promise.all([
    sh(serial, 'settings get global private_dns_mode'),
    sh(serial, 'settings get global private_dns_specifier'),
    sh(serial, 'settings get secure limit_ad_tracking'),
    sh(serial, 'settings get global window_animation_scale'),
    sh(serial, 'cmd package list packages -d'),
    sh(serial, 'getprop service.adb.tcp.port'),
  ]);
  const disabledCount = disabled ? disabled.split('\n').filter(Boolean).length : 0;
  const yes = (b) => (b ? ui.c.green('on') : ui.c.gray('off'));

  ui.nl();
  ui.log('  ' + ui.c.bold(ui.c.cyan('reclaim status')));
  ui.kv('ad-block DNS', dnsMode === 'hostname' && dnsHost && dnsHost !== 'null'
    ? ui.c.green(dnsHost) : ui.c.gray('not set'));
  ui.kv('ad tracking', limitAds === '1' ? ui.c.green('limited ✓') : ui.c.gray('default'));
  ui.kv('UI speed', animW && animW !== 'null' && parseFloat(animW) < 1
    ? ui.c.green(animW + '× (snappy)') : ui.c.gray('default (1.0×)'));
  ui.kv('disabled apps', disabledCount ? ui.c.green(disabledCount + ' disabled') : ui.c.gray('none'));
  ui.kv('wireless adb', yes(tcpPort && tcpPort !== ''));

  ui.nl();
  ui.info('Tune it up: ' + ui.c.bold('reclaim profile recommended --yes'));
}
