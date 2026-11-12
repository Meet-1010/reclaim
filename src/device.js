// device.js — figure out WHAT is plugged in, so we only ever offer recipes
// that are safe for that exact device.
import * as adb from './adb.js';

// Maps a connected serial to a normalized device profile.
export async function identify(serial) {
  const [model, brand, name, characteristics, sdk, release, manufacturer] = await Promise.all([
    adb.getProp(serial, 'ro.product.model').catch(() => ''),
    adb.getProp(serial, 'ro.product.brand').catch(() => ''),
    adb.getProp(serial, 'ro.product.name').catch(() => ''),
    adb.getProp(serial, 'ro.build.characteristics').catch(() => ''),
    adb.getProp(serial, 'ro.build.version.sdk').catch(() => ''),
    adb.getProp(serial, 'ro.build.version.release').catch(() => ''),
    adb.getProp(serial, 'ro.product.manufacturer').catch(() => ''),
  ]);

  // Android TV reports "tv" in build characteristics; emulators report "emulator".
  const isTv = /\btv\b/i.test(characteristics) || /atv|bravia|shield|sabrina/i.test(name);
  const isEmulator = /emulator/i.test(characteristics) || /sdk|emu|goldfish|ranchu/i.test(name);
  // Amazon Fire devices: manufacturer/brand is Amazon; Fire TV models start AFT.
  const isAmazon = /amazon/i.test(brand) || /amazon/i.test(manufacturer);
  const isFireTv = isAmazon && (isTv || /^AFT/i.test(model));

  let family = 'unknown';
  if (isFireTv) family = 'firetv';
  else if (isAmazon) family = 'firetablet';
  else if (isTv) family = 'androidtv';

  return {
    serial,
    family, // which recipe set applies
    isEmulator,
    model: model || 'Unknown model',
    brand: brand || 'Unknown brand',
    name,
    androidVersion: release ? `Android ${release} (API ${sdk})` : 'Unknown',
  };
}

// Convenience: identify every connected device.
export async function detectAll() {
  const devices = await adb.listDevices();
  const online = devices.filter((d) => d.state === 'device');
  const profiles = [];
  for (const d of online) {
    profiles.push(await identify(d.serial));
  }
  return {
    all: devices,
    profiles,
    unauthorized: devices.filter((d) => d.state === 'unauthorized'),
  };
}
