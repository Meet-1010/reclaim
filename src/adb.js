// adb.js — thin, safe wrapper around the Android Debug Bridge.
// Every device-touching action in reclaim goes through here, so there is
// exactly one place that talks to real hardware.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);

// Find a usable adb binary so reclaim works even when adb isn't on PATH.
// Prefers an explicit SDK root, then the OS-default SDK locations, else PATH.
let ADB_BIN = null;
function resolveAdb() {
  if (ADB_BIN) return ADB_BIN;
  const roots = [
    process.env.ANDROID_SDK_ROOT,
    process.env.ANDROID_HOME,
    join(homedir(), 'Library/Android/sdk'), // macOS
    join(homedir(), 'Android/Sdk'), // Linux
    join(homedir(), 'AppData/Local/Android/Sdk'), // Windows
  ].filter(Boolean);
  for (const r of roots) {
    for (const name of ['adb', 'adb.exe']) {
      const p = join(r, 'platform-tools', name);
      if (existsSync(p)) {
        ADB_BIN = p;
        return p;
      }
    }
  }
  ADB_BIN = 'adb'; // fall back to PATH
  return ADB_BIN;
}

export async function hasAdb() {
  try {
    await execFileAsync(resolveAdb(), ['version']);
    return true;
  } catch {
    return false;
  }
}

// Returns [{ serial, state }]. Empty array = nothing connected.
// Honors the standard ANDROID_SERIAL env var: if set, reclaim will ONLY ever
// see that one device. This is the safe way to pin work to a single target
// (e.g. an emulator) when other devices are also plugged in.
export async function listDevices() {
  const { stdout } = await execFileAsync(resolveAdb(), ['devices']);
  const only = process.env.ANDROID_SERIAL;
  return stdout
    .split('\n')
    .slice(1) // drop "List of devices attached"
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [serial, state] = l.split(/\s+/);
      return { serial, state };
    })
    .filter((d) => d.serial)
    .filter((d) => !only || d.serial === only);
}

// Read a system property (e.g. ro.product.model).
export async function getProp(serial, prop) {
  const args = serial ? ['-s', serial, 'shell', 'getprop', prop] : ['shell', 'getprop', prop];
  const { stdout } = await execFileAsync(resolveAdb(), args);
  return stdout.trim();
}

// Run an arbitrary adb shell command. Returns { stdout, stderr }.
export async function shell(serial, command) {
  const base = serial ? ['-s', serial, 'shell'] : ['shell'];
  const { stdout, stderr } = await execFileAsync(resolveAdb(), [...base, command]);
  return { stdout: stdout.trim(), stderr: stderr.trim() };
}

// Install an APK (local path).
export async function install(serial, apkPath) {
  const base = serial ? ['-s', serial] : [];
  const { stdout } = await execFileAsync(resolveAdb(), [...base, 'install', '-r', apkPath]);
  return stdout.trim();
}

// Run an arbitrary adb invocation (args array), e.g. ['tcpip','5555'].
export async function raw(serial, args) {
  const base = serial ? ['-s', serial] : [];
  const { stdout } = await execFileAsync(resolveAdb(), [...base, ...args], {
    maxBuffer: 1024 * 1024 * 16,
  });
  return stdout.trim();
}

// Capture the device screen to a local PNG file.
export async function screencap(serial, outPath) {
  const base = serial ? ['-s', serial] : [];
  const { stdout } = await execFileAsync(resolveAdb(), [...base, 'exec-out', 'screencap', '-p'], {
    encoding: 'buffer',
    maxBuffer: 1024 * 1024 * 64,
  });
  await writeFile(outPath, stdout);
  return outPath;
}
