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

// Gather the device health data as a structured object (used by report + --json).
export async function collect(serial, profile) {
  const [patch, uptime, df, memTotal, memAvail, dnsMode, dnsHost, limitAds, animW, disabled, tcpPort] =
    await Promise.all([
      sh(serial, 'getprop ro.build.version.security_patch'),
      sh(serial, 'cat /proc/uptime'),
      sh(serial, 'df -h /data | tail -1'),
      sh(serial, "cat /proc/meminfo | grep MemTotal | awk '{print $2}'"),
      sh(serial, "cat /proc/meminfo | grep MemAvailable | awk '{print $2}'"),
      sh(serial, 'settings get global private_dns_mode'),
      sh(serial, 'settings get global private_dns_specifier'),
      sh(serial, 'settings get secure limit_ad_tracking'),
      sh(serial, 'settings get global window_animation_scale'),
      sh(serial, 'cmd package list packages -d'),
      sh(serial, 'getprop service.adb.tcp.port'),
    ]);
  const cols = df ? df.split(/\s+/) : [];
  return {
    system: {
      brand: profile.brand,
      model: profile.model,
      serial: profile.serial,
      android: profile.androidVersion,
      securityPatch: patch || null,
      uptimeMin: uptime ? Math.round(parseFloat(uptime) / 60) : null,
    },
    resources: {
      storageUsed: cols[2] || null,
      storageTotal: cols[1] || null,
      storageFullPct: cols[4] || null,
      memTotalGb: memTotal ? +(parseInt(memTotal, 10) / 1024 / 1024).toFixed(1) : null,
      memFreeGb: memAvail ? +(parseInt(memAvail, 10) / 1024 / 1024).toFixed(1) : null,
    },
    reclaim: {
      adblockDns: dnsMode === 'hostname' && dnsHost && dnsHost !== 'null' ? dnsHost : null,
      adTrackingLimited: limitAds === '1',
      uiSpeed: animW && animW !== 'null' ? parseFloat(animW) : null,
      disabledApps: disabled ? disabled.split('\n').filter(Boolean).length : 0,
      wirelessAdb: Boolean(tcpPort && tcpPort !== ''),
    },
  };
}

export async function report(serial, profile) {
  const d = await collect(serial, profile);
  ui.heading('Device health — ' + d.system.brand + ' ' + d.system.model);

  ui.log('  ' + ui.c.bold(ui.c.cyan('System')));
  ui.kv('android', d.system.android);
  ui.kv('security patch', d.system.securityPatch || 'unknown');
  ui.kv('serial', d.system.serial);
  if (d.system.uptimeMin != null) ui.kv('uptime', d.system.uptimeMin + ' min');

  ui.nl();
  ui.log('  ' + ui.c.bold(ui.c.cyan('Resources')));
  if (d.resources.storageTotal) {
    ui.kv('storage /data', `${d.resources.storageUsed} used / ${d.resources.storageTotal} (${d.resources.storageFullPct} full)`);
  }
  if (d.resources.memTotalGb != null) {
    ui.kv('memory', `${d.resources.memFreeGb ?? '?'} GB free / ${d.resources.memTotalGb} GB`);
  }

  ui.nl();
  ui.log('  ' + ui.c.bold(ui.c.cyan('reclaim status')));
  ui.kv('ad-block DNS', d.reclaim.adblockDns ? ui.c.green(d.reclaim.adblockDns) : ui.c.gray('not set'));
  ui.kv('ad tracking', d.reclaim.adTrackingLimited ? ui.c.green('limited ✓') : ui.c.gray('default'));
  ui.kv('UI speed', d.reclaim.uiSpeed != null && d.reclaim.uiSpeed < 1
    ? ui.c.green(d.reclaim.uiSpeed + '× (snappy)') : ui.c.gray('default (1.0×)'));
  ui.kv('disabled apps', d.reclaim.disabledApps ? ui.c.green(d.reclaim.disabledApps + ' disabled') : ui.c.gray('none'));
  ui.kv('wireless adb', d.reclaim.wirelessAdb ? ui.c.green('on') : ui.c.gray('off'));

  ui.nl();
  ui.info('Tune it up: ' + ui.c.bold('reclaim profile recommended --yes'));
}
