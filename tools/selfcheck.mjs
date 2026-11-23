#!/usr/bin/env node
// ---------------------------------------------------------------------------
//  tools/selfcheck.mjs — the rules that are easy to break by accident.
//
//  Run before shipping: `node tools/selfcheck.mjs`
//    * every id referenced in src/ exists in the manifest
//    * no asset URL is hardcoded in src/
//    * every manifest entry has the required licence fields
//    * LICENSES.md covers every source in the manifest
//    * no web-page layout vocabulary in index.html
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const manifest = JSON.parse(read('assets.manifest.json'));
const ids = new Set(manifest.assets.map((a) => a.id));

let fail = 0;
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const bad = (m) => { fail++; console.log(`  \x1b[31m✗\x1b[0m ${m}`); };

// ---------------------------------------------------------------- 1. unknown ids
const srcFiles = [];
(function walk(dir) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) walk(rel);
    else if (e.name.endsWith('.js')) srcFiles.push(rel);
  }
})('src');

const ID_RE = /(?:textures\.get|framesById\??\.|resolve|info|play|loadTexture|loadAudio|gridFrames|preload)\(\s*['"]([a-z0-9_]+)['"]/gi;
const missing = new Map();
for (const f of srcFiles) {
  const src = read(f);
  for (const m of src.matchAll(ID_RE)) {
    const id = m[1];
    if (id.length < 4) continue;
    if (!ids.has(id)) missing.set(id, f);
  }
}
if (missing.size === 0) ok(`all asset ids referenced in src/ exist in the manifest (${ids.size} known)`);
else for (const [id, f] of missing) bad(`unknown asset id "${id}" referenced in ${f}`);

// ---------------------------------------------------------------- 2. hardcoded URLs
const URL_RE = /['"`](?:https?:)?\/\/[^'"`\s]+\.(?:png|jpe?g|webp|gif|ogg|mp3|wav|woff2?|ttf)['"`]/i;
const urlHits = srcFiles.filter((f) => URL_RE.test(read(f)));
if (urlHits.length === 0) ok('no hardcoded asset URLs in src/');
else for (const f of urlHits) bad(`hardcoded asset URL in ${f}`);

// ---------------------------------------------------------------- 3. manifest fields
const REQUIRED = ['id', 'type', 'author', 'source_page', 'license', 'attribution_required', 'noncommercial_only'];
const fieldMiss = [];
for (const a of manifest.assets) {
  for (const k of REQUIRED) if (a[k] === undefined || a[k] === null || a[k] === '') fieldMiss.push(`${a.id}.${k}`);
  if (a.available && !a.local_path) fieldMiss.push(`${a.id}.local_path`);
}
if (fieldMiss.length === 0) ok(`every manifest entry carries id/type/author/source/license/flags (${manifest.assets.length} entries)`);
else fieldMiss.slice(0, 12).forEach((m) => bad(`manifest field missing: ${m}`));

// ---------------------------------------------------------------- 4. licences
const NONFREE = /unknown|tbd|n\/a|proprietary/i;
const badLic = manifest.assets.filter((a) => NONFREE.test(a.license || ''));
if (badLic.length === 0) ok('no entry has an unknown licence');
else badLic.forEach((a) => bad(`${a.id} has licence "${a.license}"`));

const lic = read('LICENSES.md');
const sources = new Set(manifest.assets.map((a) => a.source_page).filter(Boolean));
const uncovered = [...sources].filter((s) => !lic.includes(s));
if (uncovered.length === 0) ok(`LICENSES.md references all ${sources.size} source pages`);
else uncovered.forEach((s) => bad(`LICENSES.md does not mention ${s}`));

const noncom = manifest.assets.filter((a) => a.noncommercial_only);
if (noncom.every((a) => lic.includes(a.author) || lic.includes('non-commercial') || lic.includes('NON-COMMERCIAL'))) {
  ok(`${noncom.length} non-commercial-only assets are called out in LICENSES.md`);
} else bad('some noncommercial_only assets are not called out in LICENSES.md');

// ---------------------------------------------------------------- 5. not a web page
const html = read('index.html');
const forbidden = [/<nav\b/i, /<header\b/i, /<footer\b/i, /<aside\b/i, /<section\b/i, /<article\b/i, /<ul\b/i, /overflow\s*:\s*(scroll|auto)/i];
const found = forbidden.filter((r) => r.test(html));
if (found.length === 0) ok('index.html has no page-layout elements');
else found.forEach((r) => bad(`index.html contains ${r}`));

// ---------------------------------------------------------------- 6. summary
const avail = manifest.assets.filter((a) => a.available).length;
console.log(`\n  ${avail}/${manifest.assets.length} assets available · ${noncom.length} non-commercial-only · build ${manifest.commercial_build ? 'COMMERCIAL' : 'PERSONAL'}`);
if (fail) { console.log(`\n\x1b[31m${fail} problem(s)\x1b[0m\n`); process.exit(1); }
console.log('\n\x1b[32mAll checks passed.\x1b[0m\n');
