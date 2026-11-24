#!/usr/bin/env node
// Generate LICENSES.md from assets.manifest.json.  Also importable by the
// commercial build script so dist/LICENSES.md only lists included assets.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function filterAssets(manifest, commercial = false) {
  if (!commercial) return manifest.assets;
  return manifest.assets.filter((a) => !a.noncommercial_only);
}

export function renderLicenses(manifest, { commercial = false } = {}) {
  const assets = filterAssets(manifest, commercial);
  const excluded = commercial ? manifest.assets.filter((a) => a.noncommercial_only) : [];
  const byLicense = new Map();
  for (const a of assets) {
    if (!byLicense.has(a.license)) byLicense.set(a.license, []);
    byLicense.get(a.license).push(a);
  }
  const lines = [];
  lines.push('# LICENSES & ATTRIBUTION');
  lines.push('');
  lines.push(`Generated from \`assets.manifest.json\` for **${commercial ? 'COMMERCIAL_BUILD=true' : 'personal / noncommercial'}** use.`);
  lines.push('');
  lines.push('Every runtime asset is resolved by its manifest `id`; no asset URL is hard-coded in the game code.');
  lines.push('The game CREDITS staff roll shows the same author / source / license data at runtime.');
  lines.push('');
  lines.push('## License policy');
  lines.push('');
  lines.push(manifest.license_policy);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| License | Assets | Attribution | Commercial build |');
  lines.push('|---|---:|---:|---:|');
  for (const [license, list] of [...byLicense.entries()].sort()) {
    const attr = list.some((a) => a.attribution_required) ? 'required / notice' : 'optional (credited)';
    const nc = list.some((a) => a.noncommercial_only) ? 'excluded' : 'allowed';
    lines.push(`| ${license} | ${list.length} | ${attr} | ${nc} |`);
  }
  lines.push('');
  if (excluded.length) {
    lines.push(`## Excluded by COMMERCIAL_BUILD=true (${excluded.length})`);
    lines.push('');
    for (const a of excluded) lines.push(`- \`${a.id}\` — ${a.credit}. Runtime uses a procedural silhouette fallback.`);
    lines.push('');
  }
  lines.push('## Per-asset register');
  lines.push('');
  lines.push('| id | type | author / pack | source page | license | local path | NC only |');
  lines.push('|---|---|---|---|---|---|---:|');
  for (const a of assets) {
    const source = a.source_page ? `[source](${a.source_page})` : 'generated';
    lines.push(`| \`${a.id}\` | ${a.type} | ${a.author} — ${a.pack || ''} | ${source} | ${a.license} | \`${a.local_path}\` | ${a.noncommercial_only ? 'YES' : 'no'} |`);
  }
  lines.push('');
  for (const a of assets) {
    lines.push(`### \`${a.id}\``);
    lines.push('');
    lines.push(`- **Author:** ${a.author}`);
    lines.push(`- **Pack:** ${a.pack || '—'}`);
    lines.push(`- **Source page:** ${a.source_page || '—'}`);
    if (a.origin_page) lines.push(`- **Origin / project page:** ${a.origin_page}`);
    if (a.source_file) lines.push(`- **Upstream file:** \`${a.source_file}\``);
    lines.push(`- **License:** ${a.license}${a.license_url ? ` — ${a.license_url}` : ''}`);
    lines.push(`- **Attribution required:** ${a.attribution_required ? 'yes' : 'no'}`);
    lines.push(`- **Noncommercial only:** ${a.noncommercial_only ? 'yes' : 'no'}`);
    lines.push(`- **Conditions:** ${a.conditions}`);
    lines.push(`- **Modification:** ${a.modification}`);
    if (a.credit) lines.push(`- **Credit:** ${a.credit}`);
    if (a.url) lines.push(`- **Pinned URL:** ${a.url}`);
    lines.push(`- **Local path:** \`${a.local_path}\``);
    if (a.generator) lines.push(`- **Generator:** \`${a.generator}\``);
    lines.push('');
  }
  lines.push('## Required notices');
  lines.push('');
  const seen = new Set();
  for (const a of assets) {
    if (a.credit && !seen.has(a.credit)) {
      seen.add(a.credit);
      lines.push(`> ${a.credit}`);
      lines.push('');
    }
  }
  lines.push('## Bundled license texts');
  lines.push('');
  const files = new Set();
  for (const a of assets) {
    if (a.license_file) files.add(a.license_file);
  }
  files.add('assets/source/meta-attribution.md');
  files.add('assets/source/kenney-license.txt');
  files.add('assets/source/meta-license.txt');
  for (const rel of [...files].sort()) {
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) continue;
    lines.push(`### ${rel}`);
    lines.push('');
    lines.push('```text');
    lines.push(fs.readFileSync(full, 'utf8').trimEnd());
    lines.push('```');
    lines.push('');
  }
  return lines.join('\n') + '\n';
}

function main() {
  const commercial = process.env.COMMERCIAL_BUILD === 'true' || process.env.COMMERCIAL_BUILD === '1';
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets.manifest.json'), 'utf8'));
  const out = process.argv[2] ? path.resolve(ROOT, process.argv[2]) : path.join(ROOT, 'LICENSES.md');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, renderLicenses(manifest, { commercial }), 'utf8');
  console.log(`wrote ${path.relative(ROOT, out)} (${commercial ? 'commercial' : 'personal'} register)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
