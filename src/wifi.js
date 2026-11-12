// wifi.js — control the TV with no cable.
// Real-life win: most TV boxes are a pain to reach by USB. Enable adb over
// Wi-Fi once, then reclaim (and you) can manage the box across the room.
import * as adb from './adb.js';
import * as ui from './ui.js';

async function deviceIp(serial) {
  // Try the common interfaces a TV box uses.
  for (const iface of ['wlan0', 'eth0']) {
    try {
      const { stdout } = await adb.shell(serial, `ip -f inet addr show ${iface}`);
      const m = stdout.match(/inet (\d+\.\d+\.\d+\.\d+)/);
      if (m) return m[1];
    } catch {
      /* try next */
    }
  }
  return null;
}

export async function enable(serial, port = 5555) {
  ui.heading('Enable wireless control');
  ui.info('Switching the TV’s adb to Wi-Fi on port ' + port + '…');
  await adb.raw(serial, ['tcpip', String(port)]);

  const ip = await deviceIp(serial);
  ui.nl();
  if (ip) {
    ui.ok('Wireless adb is on.');
    ui.box(
      [
        ui.c.bold('Now control the TV over Wi-Fi — unplug the cable and run:'),
        ui.c.cyan(`adb connect ${ip}:${port}`),
        'then: ' + ui.c.cyan(`ANDROID_SERIAL=${ip}:${port} reclaim doctor`),
      ],
      ui.c.green
    );
  } else {
    ui.ok('Wireless adb is on (port ' + port + ').');
    ui.warn('Could not auto-detect the TV’s IP. Find it in the TV’s network settings,');
    ui.info('then run: ' + ui.c.cyan(`adb connect <tv-ip>:${port}`));
  }
  ui.nl();
  ui.step(ui.c.dim('To go back to USB-only later: ') + ui.c.bold('adb usb'));
}
