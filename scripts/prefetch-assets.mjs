#!/usr/bin/env node
// Mode A: prefetch manifest assets into assets/.  Also honours assets/user
// overrides and COMMERCIAL_BUILD=true filtering.  Partial failures are
// reported but never abort the whole set; the runtime has fallbacks.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST = path.join(ROOT, 'assets.manifest.json');
const USER = path.join(ROOT, 'assets/user');
const commercial = process.env.COMMERCIAL_BUILD === 'true' || process.env.COMMERCIAL_BUILD === '1';
const force = process.argv.includes('--force');
const quiet = process.argv.includes('--quiet');
const report = { acquired: [], cached: [], override: [], skipped: [], excluded: [], failed: [] };

function log(...args) { if (!quiet) console.log(...args); }
function extOf(local) { return path.extname(local); }
function overrideCandidates(id, local) {
  return [path.join(USER, id), path.join(USER, id + extOf(local))].filter((v, i, a) => a.indexOf(v) === i);
}
function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }

async function readOverride(id, local) {
  for (const p of overrideCandidates(id, local)) {
    try {
      const data = await fsp.readFile(p);
      return { data, path: p };
    } catch { /* try next */ }
  }
  return null;
}

async function fetchPinned(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'honshitsu-prefetch/1.0' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return Buffer.from(await res.arrayBuffer());
}

async function main() {
  const manifest = JSON.parse(await fsp.readFile(MANIFEST, 'utf8'));
  log(`[prefetch] ${manifest.assets.length} entries; COMMERCIAL_BUILD=${commercial}; force=${force}`);
  for (const a of manifest.assets) {
    if (commercial && a.noncommercial_only) {
      report.excluded.push(a.id);
      log(`[exclude] ${a.id} (noncommercial_only; runtime fallback)`);
      continue;
    }
    const dst = path.join(ROOT, a.local_path);
    const override = await readOverride(a.id, a.local_path);
    if (override) {
      await fsp.mkdir(path.dirname(dst), { recursive: true });
      await fsp.writeFile(dst, override.data);
      report.override.push(a.id);
      log(`[override] ${a.id} <- ${path.relative(ROOT, override.path)}`);
      continue;
    }
    if (!force && fs.existsSync(dst)) {
      const data = await fsp.readFile(dst);
      if (!a.sha256 || sha256(data) === a.sha256) {
        report.cached.push(a.id);
        log(`[cached]  ${a.id}`);
        continue;
      }
      log(`[verify]  ${a.id} checksum changed; refreshing`);
    }
    if (!a.url) {
      if (a.generator) {
        report.skipped.push(a.id);
        log(`[generated] ${a.id} (rebuild with ${a.generator})`);
      } else {
        report.failed.push({ id: a.id, error: 'no url and no generator' });
        log(`[FAIL]    ${a.id}: no url and no generator`);
      }
      continue;
    }
    try {
      const data = await fetchPinned(a.url);
      if (a.size && data.length !== a.size) log(`[warn]    ${a.id} size ${data.length} != manifest ${a.size}`);
      if (a.sha256 && sha256(data) !== a.sha256) log(`[warn]    ${a.id} upstream checksum differs (pinned manifest copy retained)`);
      await fsp.mkdir(path.dirname(dst), { recursive: true });
      await fsp.writeFile(dst, data);
      report.acquired.push(a.id);
      log(`[fetch]   ${a.id} <- ${a.url}`);
    } catch (e) {
      report.failed.push({ id: a.id, error: String(e.message || e) });
      log(`[FAIL]    ${a.id}: ${e.message || e} (runtime fallback will be used)`);
    }
  }
  log('[prefetch] summary', JSON.stringify({
    acquired: report.acquired.length,
    cached: report.cached.length,
    override: report.override.length,
    skipped: report.skipped.length,
    excluded: report.excluded.length,
    failed: report.failed.length,
  }));
  if (report.failed.length) log('[prefetch] failures:', report.failed.map((f) => f.id).join(', '));
  // Deliberately do not fail the process: partial asset failure must not stop gameplay.
}

main().catch((e) => { console.error(e); process.exit(1); });
