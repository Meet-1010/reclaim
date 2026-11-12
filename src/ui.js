// ui.js — zero-dependency terminal styling.
// Respects NO_COLOR and non-TTY output so logs stay clean when piped.

const COLOR_ON =
  process.env.NO_COLOR === undefined &&
  process.env.TERM !== 'dumb' &&
  (process.stdout.isTTY ?? false);

const code = (open, close) => (s) =>
  COLOR_ON ? `\u001b[${open}m${s}\u001b[${close}m` : String(s);

export const c = {
  reset: code(0, 0),
  bold: code(1, 22),
  dim: code(2, 22),
  italic: code(3, 23),
  underline: code(4, 24),
  red: code(31, 39),
  green: code(32, 39),
  yellow: code(33, 39),
  blue: code(34, 39),
  magenta: code(35, 39),
  cyan: code(36, 39),
  gray: code(90, 39),
  white: code(97, 39),
  bgGreen: code(42, 49),
  bgYellow: code(43, 49),
  bgCyan: code(46, 49),
  bgRed: code(41, 49),
  bgBlue: code(44, 49),
};

// --- primitives ---------------------------------------------------------

export const log = (...a) => console.log(...a);
export const nl = () => console.log('');

export function banner() {
  const art = [
    '',
    '   ' + c.cyan('██████╗') + c.blue(' ███████╗') + c.magenta(' ██████╗') + c.cyan(' ██╗      █████╗ ██╗███╗   ███╗'),
    '   ' + c.cyan('██╔══██╗') + c.blue('██╔════╝') + c.magenta('██╔════╝') + c.cyan(' ██║     ██╔══██╗██║████╗ ████║'),
    '   ' + c.cyan('██████╔╝') + c.blue('█████╗  ') + c.magenta('██║     ') + c.cyan(' ██║     ███████║██║██╔████╔██║'),
    '   ' + c.cyan('██╔══██╗') + c.blue('██╔══╝  ') + c.magenta('██║     ') + c.cyan(' ██║     ██╔══██║██║██║╚██╔╝██║'),
    '   ' + c.cyan('██║  ██║') + c.blue('███████╗') + c.magenta('╚██████╗') + c.cyan(' ███████╗██║  ██║██║██║ ╚═╝ ██║'),
    '   ' + c.gray('╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝╚═╝     ╚═╝'),
    '',
    '   ' + c.bold('Reclaim your hardware.') + c.dim('  Safe · reversible · emulator-first.'),
    '',
  ];
  log(art.join('\n'));
}

// Risk badge — color-coded so danger reads at a glance.
export function badge(risk) {
  const r = String(risk || '').toLowerCase();
  if (r === 'safe') return c.bold(c.bgGreen(c.white(' SAFE ')));
  if (r === 'reversible') return c.bold(c.bgCyan(c.white(' REVERSIBLE ')));
  if (r === 'advanced') return c.bold(c.bgYellow(c.white(' ADVANCED ')));
  if (r === 'expert') return c.bold(c.bgRed(c.white(' EXPERT ')));
  return c.bgBlue(c.white(` ${risk} `));
}

export const ok = (m) => log('  ' + c.green('✔ ') + m);
export const fail = (m) => log('  ' + c.red('✘ ') + m);
export const info = (m) => log('  ' + c.cyan('ℹ ') + m);
export const warn = (m) => log('  ' + c.yellow('▲ ') + m);
export const step = (m) => log('  ' + c.gray('• ') + m);
export const dryRun = (m) => log('  ' + c.magenta('◌ dry-run ') + c.dim('would ') + m);

export function heading(title) {
  nl();
  log('  ' + c.bold(c.cyan(title)));
  log('  ' + c.gray('─'.repeat(Math.max(title.length, 24))));
}

export function kv(key, value) {
  log('  ' + c.dim(key.padEnd(14)) + ' ' + value);
}

// A boxed callout for important notices.
export function box(lines, color = c.cyan) {
  const arr = Array.isArray(lines) ? lines : [lines];
  const width = Math.max(...arr.map((l) => stripAnsi(l).length)) + 2;
  log('  ' + color('┌' + '─'.repeat(width) + '┐'));
  for (const line of arr) {
    const pad = width - stripAnsi(line).length - 1;
    log('  ' + color('│ ') + line + ' '.repeat(Math.max(pad, 0)) + color('│'));
  }
  log('  ' + color('└' + '─'.repeat(width) + '┘'));
}

export function stripAnsi(s) {
  // eslint-disable-next-line no-control-regex
  return String(s).replace(/\u001b\[[0-9;]*m/g, '');
}

// Minimal spinner for a running step.
export function spinner(text) {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;
  let timer = null;
  const enabled = COLOR_ON;
  const render = () => {
    process.stdout.write('\r  ' + c.cyan(frames[i = (i + 1) % frames.length]) + ' ' + text);
  };
  if (enabled) timer = setInterval(render, 80);
  else log('  ' + c.cyan('•') + ' ' + text);
  return {
    stop(symbol, finalText) {
      if (timer) clearInterval(timer);
      if (enabled) process.stdout.write('\r' + ' '.repeat(stripAnsi(text).length + 6) + '\r');
      log('  ' + symbol + ' ' + (finalText ?? text));
    },
  };
}
