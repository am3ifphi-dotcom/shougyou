#!/usr/bin/env node
// Produce dist/ with COMMERCIAL_BUILD=true and every noncommercial_only asset
// removed from both the manifest and the copied files.  Runtime fallbacks are
// used for the excluded Drive-derived portraits.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { filterAssets, renderLicenses } from './generate-licenses.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const COPY_ROOT_FILES = ['index.html', 'package.json', 'vercel.json', 'README.md', '.gitignore', 'assets/user/index.json'];
const COPY_DIRS = ['src', 'scripts'];

async function rmrf(p) { await fs.rm(p, { recursive: true, force: true }); }
async function copyFile(rel) {
  const src = path.join(ROOT, rel);
  try { await fs.access(src); } catch { return; }
  const dst = path.join(DIST, rel);
  await fs.mkdir(path.dirname(dst), { recursive: true });
  await fs.copyFile(src, dst);
}
async function walk(rel, excluded) {
  const full = path.join(ROOT, rel);
  const entries = await fs.readdir(full, { withFileTypes: true }).catch(() => []);
  for (const e of entries) {
    const childRel = path.join(rel, e.name);
    if (excluded.has(childRel.replace(/\\/g, '/'))) continue;
    if (e.isDirectory()) await walk(childRel, excluded);
    else await copyFile(childRel);
  }
}

async function main() {
  const manifest = JSON.parse(await fs.readFile(path.join(ROOT, 'assets.manifest.json'), 'utf8'));
  const kept = filterAssets(manifest, true);
  const excludedPaths = new Set(manifest.assets.filter((a) => a.noncommercial_only).map((a) => a.local_path.replace(/\\/g, '/')));
  excludedPaths.add('assets/portraits');
  excludedPaths.add('assets/user');
  excludedPaths.add('assets/source/drive');
  excludedPaths.add('google_drive');
  await rmrf(DIST);
  await fs.mkdir(DIST, { recursive: true });
  for (const f of COPY_ROOT_FILES) await copyFile(f);
  for (const d of COPY_DIRS) await walk(d, excludedPaths);
  await walk('assets', excludedPaths);

  const commercialManifest = {
    ...manifest,
    build: 'commercial',
    commercial_build: true,
    generated: manifest.generated,
    commercial_note: 'noncommercial_only entries were removed; procedural fallbacks are used at runtime.',
    assets: kept.map((a) => ({ ...a })),
  };
  await fs.writeFile(path.join(DIST, 'assets.manifest.json'), JSON.stringify(commercialManifest, null, 2) + '\n', 'utf8');
  await fs.writeFile(path.join(DIST, 'LICENSES.md'), renderLicenses(commercialManifest, { commercial: true }), 'utf8');

  const htmlPath = path.join(DIST, 'index.html');
  const html = await fs.readFile(htmlPath, 'utf8');
  await fs.writeFile(htmlPath, html.replace('window.COMMERCIAL_BUILD = false;', 'window.COMMERCIAL_BUILD = true;'), 'utf8');

  console.log(`[commercial] dist/ ready: ${kept.length}/${manifest.assets.length} assets, ${manifest.assets.length - kept.length} excluded`);
}

main().catch((e) => { console.error(e); process.exit(1); });
