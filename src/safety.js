// safety.js — the brick-guard. A hard list of system packages reclaim will
// NEVER disable or uninstall, because doing so can leave a device unbootable
// or with no home screen. Enforced in the engine, the app-manager AND in
// `reclaim validate` (so a dangerous recipe can't even be committed).

// Exact package ids that must stay enabled.
const PROTECTED_IDS = new Set([
  'android',
  'com.android.systemui',
  'com.android.settings',
  'com.android.tv.settings',
  'com.android.phone',
  'com.android.bluetooth',
  'com.android.nfc',
  'com.android.provision',
  'com.android.keychain',
  'com.android.networkstack',
  'com.android.wifi.resources',
  'com.android.inputmethod.latin',
  'com.google.android.inputmethod.latin',
  'com.google.android.gms', // Play services
  'com.google.android.gsf', // Google services framework
  'com.google.android.tvlauncher', // Google/Android TV launcher
  'com.google.android.apps.tv.launcherx', // Google TV launcher variant
  'com.google.android.tungsten.setupwraith', // Android TV setup
  'com.google.android.tungsten.overscan',
]);

// Any package starting with one of these is also protected.
const PROTECTED_PREFIXES = [
  'com.android.systemui',
  'com.android.inputmethod',
  'com.google.android.tvlauncher',
  'com.google.android.apps.tv.launcher',
  'com.android.server',
  'com.android.providers.settings',
];

export function isProtected(pkg) {
  if (!pkg) return false;
  if (PROTECTED_IDS.has(pkg)) return true;
  return PROTECTED_PREFIXES.some((p) => pkg.startsWith(p));
}

// Pull package ids out of a `pm disable-user|disable|uninstall ...` command.
// Returns [] for any command that doesn't remove/disable a package.
export function targetsOf(cmd) {
  if (typeof cmd !== 'string') return [];
  if (!/\bpm\s+(disable-user|disable|uninstall)\b/.test(cmd)) return [];
  const matches = cmd.match(/\b[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)+\b/g) || [];
  // keep things that look like package ids (have a dot); drop flags like --user
  return matches.filter((m) => m.includes('.'));
}

// The protected package(s) a command would touch (empty = safe).
export function protectedTargets(cmd) {
  return targetsOf(cmd).filter(isProtected);
}

export function list() {
  return { ids: [...PROTECTED_IDS], prefixes: [...PROTECTED_PREFIXES] };
}
