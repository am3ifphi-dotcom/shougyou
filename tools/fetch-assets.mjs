#!/usr/bin/env node
// ---------------------------------------------------------------------------
//  fetch-assets.mjs — pull every remote asset named in tools/assets.config.mjs
//  into assets/, then emit:
//      assets.manifest.json   (what the game reads — ids, paths, licenses)
//      LICENSES.md            (auto-generated credits)
//
//  usage:
//      node tools/fetch-assets.mjs              # everything, cached
//      node tools/fetch-assets.mjs --force      # re-download
//      node tools/fetch-assets.mjs --only=audio
//      node tools/fetch-assets.mjs --commercial  # drop noncommercial_only assets
//
//  Notes
//   * This is the only file that knows where bytes live. The game resolves
//     everything through the manifest by asset id.
//   * One failing download never aborts the run: the entry is marked
//     available:false and the game swaps in a procedural fallback.
//   * assets/user/<id>.<ext> always overrides a downloaded file at load time.
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SOURCES, FILES, LOCAL_ASSETS, DRIVE_IDS } from './assets.config.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d = null) => { const a = argv.find((x) => x.startsWith(`--${n}=`)); return a ? a.split('=').slice(1).join('=') : d; };
const ONLY = opt('only') ? opt('only').split(',') : null;
const FORCE = flag('force');
const COMMERCIAL = flag('commercial');
const QUIET = flag('quiet');
const CLONE_DIR = path.join(ROOT, '.cache/repos');

const counts = { ok: 0, cached: 0, fail: 0, skip: 0 };
function report(id, status, detail = '') {
  if (status === 'ok') counts.ok++; else if (status === 'cached') counts.cached++;
  else if (status === 'fail') counts.fail++; else counts.skip++;
  if (QUIET) return;
  const tag = { ok: '\x1b[32m✓\x1b[0m', cached: '\x1b[90m·\x1b[0m', fail: '\x1b[33m!\x1b[0m', skip: '\x1b[90m-\x1b[0m' }[status];
  console.log(`${tag} ${id.padEnd(26)} ${detail}`);
}

// ---------------------------------------------------------------- http
async function httpGet(url, { retries = 2, timeout = 60000 } = {}) {
  let last;
  for (let i = 0; i <= retries; i++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeout);
    try {
      const res = await fetch(url, { signal: ac.signal, redirect: 'follow', headers: { 'user-agent': 'honshitsu-asset-fetcher/1.0' } });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url.slice(0, 80)}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) { last = e; if (i < retries) await new Promise((r) => setTimeout(r, 800 * (i + 1))); }
    finally { clearTimeout(t); }
  }
  throw last;
}

const gdrive = (id) => `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;

// ---------------------------------------------------------------- clone cache
//  raw.githubusercontent.com is not reachable from every environment, so the
//  primary path is a shallow, blob-filtered, sparse git clone (codeload).
//  A local clone is also much faster when pulling 100+ files from one pack.
//  A blobless clone contains every tree but no file bodies, so a single path
//  can be materialised on demand with `git show HEAD:<path>` — no sparse
//  checkout state to get stuck, and any file in the repo is reachable.
const clones = new Map();
async function clone(repo, branch) {
  const key = `${repo}@${branch}`;
  if (clones.has(key)) return clones.get(key);
  const dir = path.join(CLONE_DIR, repo.replace('/', '__'));
  if (!fs.existsSync(path.join(dir, '.git'))) {
    await fsp.mkdir(CLONE_DIR, { recursive: true });
    const r = spawnSync('git', ['clone', '--depth', '1', '--filter=blob:none', '--no-checkout', '--branch', branch, `https://github.com/${repo}`, dir], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`clone failed: ${repo}: ${(r.stderr || '').split('\n').slice(-2).join(' ')}`);
  }
  clones.set(key, dir);
  return dir;
}

async function fromRepo(src, remote) {
  const s = SOURCES[src];
  const dir = await clone(s.repo, s.branch);
  const out = spawnSync('git', ['-C', dir, 'show', `HEAD:${remote}`], { maxBuffer: 64 * 1024 * 1024 });
  if (out.status !== 0 || !out.stdout?.length) throw new Error(`missing in repo: ${remote.split('/').pop()}`);
  return Buffer.from(out.stdout);
}

// ---------------------------------------------------------------- png codec
function readPng(buf) {
  if (buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('not a png');
  let off = 8, w = 0, h = 0, bitDepth = 0, colorType = 0, interlace = 0, plte = null, trns = null;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.subarray(off + 4, off + 8).toString('ascii');
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; interlace = data[12]; }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'PLTE') plte = Buffer.from(data);
    else if (type === 'tRNS') trns = Buffer.from(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (interlace) throw new Error('interlaced png unsupported');
  if (bitDepth !== 8) throw new Error(`bitdepth ${bitDepth} unsupported`);
  const ch = { 2: 3, 3: 1, 6: 4 }[colorType];
  if (!ch) throw new Error(`colortype ${colorType} unsupported`);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const dst = px.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? px.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? dst[x - ch] : 0, b = prev ? prev[x] : 0, c = prev && x >= ch ? prev[x - ch] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      dst[x] = v & 255;
    }
  }
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    if (colorType === 2) { rgba[i * 4] = px[i * 3]; rgba[i * 4 + 1] = px[i * 3 + 1]; rgba[i * 4 + 2] = px[i * 3 + 2]; rgba[i * 4 + 3] = 255; }
    else if (colorType === 6) px.copy(rgba, i * 4, i * 4, i * 4 + 4);
    else { const idx = px[i]; rgba[i * 4] = plte[idx * 3]; rgba[i * 4 + 1] = plte[idx * 3 + 1]; rgba[i * 4 + 2] = plte[idx * 3 + 2]; rgba[i * 4 + 3] = trns && idx < trns.length ? trns[idx] : 255; }
  }
  return { w, h, data: rgba };
}

const CRC_T = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
const crc32 = (b) => { let c = -1; for (const x of b) c = CRC_T[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function writePng({ w, h, data }) {
  const chunk = (type, body) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
    const tb = Buffer.concat([Buffer.from(type, 'ascii'), body]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc32(tb));
    return Buffer.concat([len, tb, c]);
  };
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) data.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

function inkBox({ w, h, data }) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return x1 < 0 ? { x0: 0, y0: 0, x1: w - 1, y1: h - 1 } : { x0, y0, x1, y1 };
}

// The Drive illustrations are tall full-body character sheets on white.  We
// cut a square bust portrait (what the dialogue frame needs) and a whole-body
// version for the gallery, both with the white page knocked out to alpha.
function knockOutWhite(img, tol = 12) {
  const out = Buffer.from(img.data);
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i], g = out[i + 1], b = out[i + 2];
    if (r > 255 - tol && g > 255 - tol && b > 255 - tol) out[i + 3] = 0;
  }
  return out;
}

function cropResize(img, sx, sy, sw, sh, outW, outH) {
  const out = Buffer.alloc(outW * outH * 4);
  const scaleX = sw / outW, scaleY = sh / outH;
  for (let y = 0; y < outH; y++) {
    const fy = sy + y * scaleY;
    const y0 = Math.max(0, Math.min(img.h - 1, Math.floor(fy)));
    const y1 = Math.max(0, Math.min(img.h - 1, y0 + 1));
    const ty = fy - Math.floor(fy);
    for (let x = 0; x < outW; x++) {
      const fx = sx + x * scaleX;
      const x0 = Math.max(0, Math.min(img.w - 1, Math.floor(fx)));
      const x1 = Math.max(0, Math.min(img.w - 1, x0 + 1));
      const tx = fx - Math.floor(fx);
      const o = (y * outW + x) * 4;
      const p = (xx, yy) => { const i = (yy * img.w + xx) * 4; return [img.data[i], img.data[i + 1], img.data[i + 2], img.data[i + 3]]; };
      const a = p(x0, y0), b = p(x1, y0), c = p(x0, y1), d = p(x1, y1);
      for (let k = 0; k < 4; k++) {
        const top = a[k] * (1 - tx) + b[k] * tx, bot = c[k] * (1 - tx) + d[k] * tx;
        out[o + k] = Math.round(top * (1 - ty) + bot * ty);
      }
    }
  }
  return { w: outW, h: outH, data: out };
}

function portrait(img) {
  img = { ...img, data: knockOutWhite(img) };
  const b = inkBox(img);
  const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1;
  const side = Math.round(Math.min(bw, bh * 0.46));
  const cx = (b.x0 + b.x1) / 2;
  const sx = Math.max(b.x0, Math.min(b.x1 - side + 1, Math.round(cx - side / 2)));
  return cropResize(img, sx, b.y0, side, side, 480, 480);
}
function fullBody(img) {
  img = { ...img, data: knockOutWhite(img) };
  const b = inkBox(img);
  const bh = b.y1 - b.y0 + 1, bw = b.x1 - b.x0 + 1;
  const outH = 900, outW = Math.round((bw / bh) * outH);
  return cropResize(img, b.x0, b.y0, bw, bh, outW, outH);
}

// ---------------------------------------------------------------- audio
//  No ffmpeg in every environment, so we ship WAV as-is (browsers decode it)
//  and use ffmpeg for ogg only when it is available.
const ENCODER = (() => {
  for (const b of ['ffmpeg', 'avconv']) { const r = spawnSync(b, ['-version'], { encoding: 'utf8' }); if (r.status === 0) return b; }
  // optional npm-installed binary (no system ffmpeg needed)
  for (const p of ['@ffmpeg-installer/ffmpeg', 'ffmpeg-static']) {
    try { const m = require0(p); const bin = typeof m === 'string' ? m : m?.path; if (bin && spawnSync(bin, ['-version']).status === 0) return bin; } catch { /* not installed */ }
  }
  return null;
})();
function require0(p) { const m = spawnSync(process.execPath, ['-e', `process.stdout.write(require(${JSON.stringify(p)}).path||'')`], { encoding: 'utf8' }); return m.status === 0 ? m.stdout.trim() : null; }
const TMP = path.join(ROOT, '.cache/tmp');
fsp.mkdir(TMP, { recursive: true });

function maybeTranscode(buf, srcName, wantOgg, id) {
  const ext = path.extname(srcName).toLowerCase();
  if (!wantOgg || ext === '.ogg' || ext === '.mp3') return { buf, ext: ext === '.mp3' ? '.mp3' : '.ogg' };
  if (!ENCODER) return { buf, ext };
  const inP = path.join(TMP, `${id}.in${ext}`);
  const outP = path.join(TMP, `${id}.ogg`);
  fs.writeFileSync(inP, buf);
  const r = spawnSync(ENCODER, ['-y', '-loglevel', 'error', '-i', inP, '-c:a', 'libvorbis', '-q:a', '4', outP], { encoding: 'utf8' });
  const ok = r.status === 0 && fs.existsSync(outP);
  fs.rmSync(inP, { force: true });
  if (!ok) { fs.rmSync(outP, { force: true }); return { buf, ext }; }
  const out = fs.readFileSync(outP);
  fs.rmSync(outP, { force: true });
  return { buf: out, ext: '.ogg' };
}

// ---------------------------------------------------------------- main
async function main() {
  await fsp.mkdir(path.join(ROOT, 'assets/img'), { recursive: true });
  await fsp.mkdir(path.join(ROOT, 'assets/audio'), { recursive: true });
  await fsp.mkdir(path.join(ROOT, 'assets/user'), { recursive: true });

  const entries = [];
  const want = (f) => !ONLY || ONLY.includes(f.type) || ONLY.includes(f.type + 's');

  for (const f of FILES) {
    const src = SOURCES[f.src];
    const entry = {
      id: f.id,
      type: f.type,
      url: src.repo ? `https://github.com/${src.repo}/blob/${src.branch}/${encodeURIComponent(f.remote).replace(/%2F/g, '/')}` : src.source_page,
      local_path: f.local,
      author: src.author,
      source_pack: src.label,
      source_page: src.source_page,
      license: src.license,
      license_url: src.license_url,
      attribution_required: src.attribution_required,
      noncommercial_only: !!src.noncommercial_only,
      source_file: f.remote,
      available: false,
      bytes: 0,
    };

    // 1. user override wins over everything
    const EXT = ['png', 'webp', 'jpg', 'ogg', 'mp3', 'wav', 'woff2'];
    const override = EXT.map((e) => path.join(ROOT, 'assets/user', `${f.id}.${e}`)).find((p) => fs.existsSync(p));
    if (override) {
      entry.local_path = path.relative(ROOT, override);
      entry.available = true;
      entry.bytes = fs.statSync(override).size;
      entry.user_override = true;
      report(f.id, 'ok', `assets/user override (${entry.bytes} B)`);
      entries.push(entry);
      continue;
    }

    // 2. commercial build: exclude non-commercial-only material
    if (COMMERCIAL && entry.noncommercial_only) {
      entry.disabled = true;
      entry.error = 'excluded: noncommercial_only';
      report(f.id, 'skip', 'excluded (noncommercial_only)');
      entries.push(entry);
      continue;
    }
    if (!want(f)) { entries.push(entry); continue; }

    const abs = path.join(ROOT, f.local);
    let cachedPath = abs;
    if (!fs.existsSync(abs)) {
      const alt = abs.replace(/\.[a-z0-9]+$/, '.wav');
      if (fs.existsSync(alt)) cachedPath = alt;
    }
    if (!FORCE && fs.existsSync(cachedPath) && fs.statSync(cachedPath).size > 64) {
      if (cachedPath !== abs) entry.local_path = path.relative(ROOT, cachedPath);
      entry.available = true;
      entry.bytes = fs.statSync(cachedPath).size;
      report(f.id, 'cached', `${(entry.bytes / 1024).toFixed(0)} kB`);
      entries.push(entry);
      continue;
    }

    try {
      let buf;
      if (f.src === 'drive_local') {
        const p = path.join(ROOT, 'assets/source/drive', f.remote);
        if (!fs.existsSync(p)) throw new Error(`not staged: assets/source/drive/${f.remote}`);
        buf = fs.readFileSync(p);
      } else if (f.src === 'drive') {
        buf = await httpGet(gdrive(f.drive_id), { timeout: 120000 });
        if (buf.length < 2048) throw new Error('Drive returned a stub response');
      } else {
        buf = await fromRepo(f.src, f.remote);
      }

      let outBuf = buf;
      let outPath = abs;
      if (f.type === 'audio') {
        const t = maybeTranscode(buf, f.remote, f.transcode === 'ogg', f.id);
        outBuf = t.buf;
        outPath = abs.replace(/\.[a-z0-9]+$/, t.ext);
      } else if (f.crop === 'portrait') {
        const img = readPng(buf);
        outBuf = writePng(portrait(img));
        const gallery = f.local.replace(/\.png$/, '_full.png');
        await fsp.mkdir(path.dirname(path.join(ROOT, gallery)), { recursive: true });
        await fsp.writeFile(path.join(ROOT, gallery), writePng(fullBody(img)));
        entry.meta = { ...(entry.meta || {}), gallery_path: gallery };
      } else if (['sprite', 'image', 'sheet'].includes(f.type)) {
        try {
          const im = readPng(buf);
          entry.meta = { ...(entry.meta || {}), w: im.w, h: im.h };
        } catch { /* keep the original bytes */ }
      }

      // ---- pixel-art post-process: slice strips, then upscale 4x with nearest
      //      neighbour so the browser never has to invent pixels (crisp at 4K).
      if (f.sheetH) {
        try {
          const im = readPng(outBuf);
          const frames = Math.floor(im.w / f.sheetH);
          const out = [];
          for (let i = 0; i < frames; i++) {
            const sub = cropResize(im, i * f.sheetH, 0, f.sheetH, im.h, f.sheetH * 4, im.h * 4);
            const name = `assets/img/${f.id}_${i}.png`;
            await fsp.writeFile(path.join(ROOT, name), writePng(sub));
            out.push(name);
          }
          entry.meta = { ...(entry.meta || {}), frames: out, frameW: f.sheetH * 4, frameH: im.h * 4 };
          entry.available = true;
          entry.bytes = out.reduce((s, p) => s + fs.statSync(path.join(ROOT, p)).size, 0);
          entry.local_path = out[0];
          report(f.id, 'ok', `${frames} frames × ${f.sheetH * 4}px`);
          entries.push(entry);
          continue;
        } catch (e) { entry.sheet_error = String(e.message || e); }
      }
      if (f.scale > 1) {
        try {
          const im = readPng(outBuf);
          outBuf = writePng(cropResize(im, 0, 0, im.w, im.h, im.w * f.scale, im.h * f.scale));
        } catch (e) { entry.scale_error = String(e.message || e); }
      }

      await fsp.mkdir(path.dirname(outPath), { recursive: true });
      await fsp.writeFile(outPath, outBuf);
      entry.local_path = path.relative(ROOT, outPath);
      entry.available = true;
      entry.bytes = outBuf.length;
      if (f.loop) entry.loop = true;
      if (f.gain != null) entry.gain = f.gain;
      if (f.grid) entry.grid = f.grid;
      report(f.id, 'ok', `${(outBuf.length / 1024).toFixed(0)} kB`);
    } catch (e) {
      entry.error = String(e.message || e);
      report(f.id, 'fail', entry.error + (f.optional ? ' (optional → fallback)' : ' → fallback'));
    }
    entries.push(entry);
  }

  // ---- local (already-vendored) assets
  for (const a of LOCAL_ASSETS) {
    const src = SOURCES[a.src];
    const abs = path.join(ROOT, a.local_path);
    const exists = fs.existsSync(abs);
    entries.push({
      id: a.id, type: a.type, url: src.source_page, local_path: a.local_path,
      author: src.author, source_pack: src.label, source_page: src.source_page,
      license: src.license, license_url: src.license_url,
      attribution_required: src.attribution_required, noncommercial_only: !!src.noncommercial_only,
      available: exists, bytes: exists ? fs.statSync(abs).size : 0,
      meta: { family: a.family, weight: a.weight, script: a.script, version: a.version },
      error: exists ? undefined : 'missing — run tools/vendor.mjs',
    });
    report(a.id, exists ? 'cached' : 'fail', exists ? `${(fs.statSync(abs).size / 1024).toFixed(0)} kB` : 'missing');
  }

  const available = entries.filter((e) => e.available);
  const manifest = {
    game: { title: 'HONSHITSU', subtitle: '偏差値60の教室 / 本質', version: '1.0.0' },
    generated_at: new Date().toISOString(),
    commercial_build: COMMERCIAL,
    fetch_mode: 'prefetch (tools/fetch-assets.mjs)',
    audio_encoder: ENCODER || 'none — WAV kept',
    totals: {
      entries: entries.length,
      available: available.length,
      fallback: entries.filter((e) => !e.available).length,
      noncommercial_only: entries.filter((e) => e.noncommercial_only).length,
      bytes: available.reduce((s, e) => s + e.bytes, 0),
    },
    sources: Object.fromEntries(Object.entries(SOURCES).map(([k, v]) => [k, { label: v.label, author: v.author, source_page: v.source_page, license: v.license, license_url: v.license_url, noncommercial_only: !!v.noncommercial_only }])),
    assets: entries,
  };
  await fsp.writeFile(path.join(ROOT, 'assets.manifest.json'), JSON.stringify(manifest, null, 2));

  // ---- LICENSES.md
  const packs = new Map();
  for (const e of entries) {
    const k = `${e.source_pack}`;
    if (!packs.has(k)) packs.set(k, { ...e, count: 0, ok: 0 });
    packs.get(k).count++;
    if (e.available) packs.get(k).ok++;
  }
  const md = [
    '# LICENSES — HONSHITSU',
    '',
    '> Generated automatically by `tools/fetch-assets.mjs` from `assets.manifest.json`.',
    '> Do not edit by hand — edit `tools/assets.config.mjs` and re-run the script.',
    '',
    `**Build mode:** ${COMMERCIAL ? 'COMMERCIAL_BUILD = true (assets flagged `noncommercial_only` were excluded and replaced with procedural fallbacks)' : 'personal / non-commercial (COMMERCIAL_BUILD = false)'}`,
    '',
    `**Assets:** ${manifest.totals.available}/${manifest.totals.entries} available · ${manifest.totals.fallback} procedural fallbacks · ${(manifest.totals.bytes / 1048576).toFixed(1)} MB on disk`,
    '',
    '## Asset packs',
    '',
    '| Pack | Author | License | Source | Used |',
    '| --- | --- | --- | --- | --- |',
    ...[...packs.values()].map((p) => `| ${p.source_pack} | ${p.author} | ${p.license}${p.noncommercial_only ? ' **(NON-COMMERCIAL ONLY)**' : ''} | <${p.source_page}> | ${p.ok}/${p.count} |`),
    '',
    '## License obligations',
    '',
    '- **CC0 1.0** — no attribution required; credit is given here as a courtesy. Modification and redistribution are permitted.',
    '- **OFL 1.1** — font files may be embedded and redistributed with this project but not sold on their own; the reserved font names are not modified here.',
    '- **MIT** — PixiJS and Howler.js are bundled unmodified in `public/vendor/`; copyright notices live in the file headers.',
    '- **First-party illustrations** — the 本質 / character art supplied by the project author is personal-use only and is flagged `noncommercial_only: true` in the manifest. A `COMMERCIAL_BUILD=true` build replaces it with procedural art.',
    '',
    '## Assets collected from packs outside this list',
    '',
    'None. License-unclear material was rejected; nothing was taken from commercial games, anime, or commercial music releases.',
    '',
    '## Per-asset table',
    '',
    '| id | type | license | author | local file | status |',
    '| --- | --- | --- | --- | --- | --- |',
    ...entries.map((e) => `| \`${e.id}\` | ${e.type} | ${e.license}${e.noncommercial_only ? ' (NC)' : ''} | ${e.author.split(',')[0]} | \`${e.local_path}\` | ${e.available ? 'ok' : '**fallback** — ' + (e.error || 'missing')} |`),
    '',
  ].join('\n');
  await fsp.writeFile(path.join(ROOT, 'LICENSES.md'), md);

  console.log(`\n  ✓ ${counts.ok} fetched · ${counts.cached} cached · ${counts.fail} failed (fallback) · ${counts.skip} skipped`);
  console.log(`  → assets.manifest.json (${manifest.totals.available}/${manifest.totals.entries} available, ${(manifest.totals.bytes / 1048576).toFixed(1)} MB)`);
  console.log(`  → LICENSES.md`);
}

main().catch((e) => { console.error(e); process.exit(1); });
