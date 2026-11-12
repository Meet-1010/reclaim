// control.js — drive the TV live from your computer.
// Solves the real-life pains: typing on a TV, and controlling a box whose
// remote is lost/terrible — all from your keyboard.
import * as adb from './adb.js';
import * as ui from './ui.js';

// Friendly names → Android key codes.
const KEYMAP = {
  up: 'DPAD_UP', down: 'DPAD_DOWN', left: 'DPAD_LEFT', right: 'DPAD_RIGHT',
  ok: 'DPAD_CENTER', select: 'DPAD_CENTER', enter: 'DPAD_CENTER',
  back: 'BACK', home: 'HOME', menu: 'MENU',
  play: 'MEDIA_PLAY', pause: 'MEDIA_PAUSE', playpause: 'MEDIA_PLAY_PAUSE',
  stop: 'MEDIA_STOP', next: 'MEDIA_NEXT', prev: 'MEDIA_PREVIOUS',
  rewind: 'MEDIA_REWIND', forward: 'MEDIA_FAST_FORWARD',
  volup: 'VOLUME_UP', voldown: 'VOLUME_DOWN', mute: 'VOLUME_MUTE',
  power: 'POWER', wake: 'WAKEUP', sleep: 'SLEEP',
  search: 'SEARCH', del: 'DEL', delete: 'DEL',
};

export function keyNames() {
  return Object.keys(KEYMAP);
}

export async function sendKey(serial, name, repeat = 1) {
  const key = String(name || '').toLowerCase();
  const code = KEYMAP[key];
  if (!code) {
    ui.fail(`Unknown key "${name}".`);
    ui.info('Valid keys: ' + ui.c.dim(keyNames().join(', ')));
    return false;
  }
  for (let i = 0; i < repeat; i++) {
    await adb.shell(serial, `input keyevent KEYCODE_${code}`);
  }
  ui.ok(`Sent ${ui.c.bold(key)}${repeat > 1 ? ' ×' + repeat : ''} → TV`);
  return true;
}

// Type text into whatever field is focused on the TV. Spaces become %s,
// which Android's `input text` requires.
export async function typeText(serial, text) {
  if (!text) {
    ui.fail('Nothing to type. e.g. ' + ui.c.bold('reclaim type "my wifi password"'));
    return false;
  }
  const encoded = text.replace(/ /g, '%s');
  await adb.shell(serial, `input text '${encoded}'`);
  ui.ok(`Typed ${text.length} char(s) into the focused field on the TV.`);
  ui.info('If nothing appeared, click a text box on the TV first, then retry.');
  return true;
}

export async function screenshot(serial, outPath) {
  await adb.screencap(serial, outPath);
  return outPath;
}

export async function reboot(serial) {
  ui.info('Rebooting the TV…');
  await adb.raw(serial, ['reboot']);
  ui.ok('Reboot sent. It will drop offline for a bit, then come back.');
}
