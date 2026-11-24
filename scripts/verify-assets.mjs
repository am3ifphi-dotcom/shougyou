#!/usr/bin/env node
// Verify checked-in manifest assets (or user overrides) by size + SHA-256.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const commercial = process.env.COMMERCIAL_BUILD === 'true' || process.env.COMMERCIAL_BUILD === '1';
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets.manifest.json'), 'utf8'));
const ok = [], skipped = [], missing = [], mismatch = [];
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

for (const a of manifest.assets) {
  if (commercial && a.noncommercial_only) { skipped.push(a.id); continue; }
  const local = path.join(ROOT, a.local_path);
  const overrides = [path.join(ROOT, 'assets/user', a.id), path.join(ROOT, 'assets/user', a.id + path.extname(a.local_path))];
  let buf = null, used = a.local_path;
  if (fs.existsSync(local)) buf = fs.readFileSync(local);
  else {
    for (const p of overrides) if (fs.existsSync(p)) { buf = fs.readFileSync(p); used = path.relative(ROOT, p); break; }
  }
  if (!buf) { missing.push(a.id); continue; }
  if (a.sha256 && sha(buf) !== a.sha256) mismatch.push({ id: a.id, used, expected: a.sha256, got: sha(buf) });
  else if (a.size && buf.length !== a.size) mismatch.push({ id: a.id, used, expectedSize: a.size, gotSize: buf.length });
  else ok.push(a.id);
}
console.log(`[verify] ok=${ok.length} skipped=${skipped.length} missing=${missing.length} mismatch=${mismatch.length}`);
if (missing.length) console.log('[verify] missing:', missing.join(', '));
if (mismatch.length) console.log('[verify] mismatch:', JSON.stringify(mismatch, null, 2));
if (missing.length || mismatch.length) process.exit(1);
