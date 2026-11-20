/**
 * Asset registry.
 *
 * The game never hard-codes an asset URL: everything is looked up by manifest
 * id through this module.  Three tiers resolve in order:
 *
 *   1. assets/user/<file>      - your own purchases / hand-drawn replacements
 *   2. assets/<local_path>     - what tools/fetch_assets.py downloaded
 *   3. runtime synthesis       - procedural texture / WebAudio tone
 *
 * A missing tier never throws; callers get a texture or a sound either way.
 */
import { CREDIT_ROLL } from '../generated/credits.js';

const BASE = './';

export const State = {
  READY: 'ready',
  CACHED: 'cached',
  USER: 'user',
  FALLBACK: 'fallback',
  MISSING: 'missing',
};

/** @type {Record<string, object>} */
let records = {};
let remoteManifest = null;
let localManifest = null;

export const bootLog = [];

function note(line) {
  bootLog.push(line);
  if (bootLog.length > 400) bootLog.shift();
}

export async function loadManifests() {
  remoteManifest = await fetch(`${BASE}assets.manifest.json`).then((r) => r.json());
  try {
    const res = await fetch(`${BASE}assets/manifest.local.json`, { cache: 'no-store' });
    localManifest = res.ok ? await res.json() : null;
  } catch {
    localManifest = null;
  }
  for (const a of remoteManifest.assets) records[a.id] = { ...a, status: State.MISSING };
  if (localManifest) {
    for (const r of localManifest.assets) {
      if (records[r.id]) Object.assign(records[r.id], r);
    }
  }
  note(`[assets] manifest ${remoteManifest.assets.length} entries, local index ${localManifest ? 'loaded' : 'absent'}`);
  return remoteManifest;
}

export function manifest() {
  return remoteManifest;
}

export function entry(id) {
  return records[id];
}

/** Basenames present in assets/user/, published by the fetch tool. */
let userIndex = new Set();

export async function loadUserIndex() {
  try {
    const res = await fetch('./assets/user/index.json', { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    userIndex = new Set(data.files || []);
    if (userIndex.size) note(`[assets] ${userIndex.size} user override(s) detected`);
  } catch {
    userIndex = new Set();
  }
}

export function userOverrides(file) {
  return userIndex.has(file);
}

export function urlFor(id) {
  const e = records[id];
  if (!e) return null;
  if (e.status === State.FALLBACK || e.status === State.MISSING) return null;
  // user overrides win: same basename inside assets/user/
  const base = e.local_path.split('/').pop();
  return `${BASE}assets/user/${base}`;
}

export function localUrlFor(id) {
  const e = records[id];
  if (!e) return null;
  return `${BASE}${e.local_path}`;
}

export function markStatus(id, status, extra = {}) {
  const e = records[id];
  if (!e) return;
  e.status = status;
  Object.assign(e, extra);
  if (status === State.FALLBACK) note(`[assets] ${id} -> fallback (${extra.reason || 'load error'})`);
}

export function allRecords() {
  return Object.values(records);
}

export function statusCounts() {
  const c = { ready: 0, fallback: 0, missing: 0 };
  for (const r of Object.values(records)) {
    if (r.status === State.READY || r.status === State.CACHED || r.status === State.USER) c.ready++;
    else if (r.status === State.FALLBACK) c.fallback++;
    else c.missing++;
  }
  return c;
}

export function creditRoll() {
  return CREDIT_ROLL;
}

export const COMMERCIAL_BUILD = CREDIT_ROLL.commercialBuild;
