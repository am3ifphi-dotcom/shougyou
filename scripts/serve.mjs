#!/usr/bin/env node
// Dependency-free static preview server.  Binds 0.0.0.0 for Arena live preview.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 4173);
const HOST = '0.0.0.0';
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ogg': 'audio/ogg',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

function safePath(url) {
  let p;
  try { p = decodeURIComponent(new URL(url, 'http://localhost').pathname); } catch { return null; }
  if (p === '/' || p === '') p = '/index.html';
  const full = path.resolve(ROOT, '.' + p);
  if (!full.startsWith(ROOT + path.sep) && full !== path.join(ROOT, 'index.html')) return null;
  return full;
}

const server = http.createServer((req, res) => {
  const full = safePath(req.url || '/');
  if (!full) { res.writeHead(400); res.end('Bad request'); return; }
  fs.stat(full, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('404'); return; }
    const mime = MIME[path.extname(full).toLowerCase()] || 'application/octet-stream';
    const headers = {
      'Content-Type': mime,
      'Content-Length': st.size,
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Timing-Allow-Origin': '*',
    };
    res.writeHead(200, headers);
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(full).pipe(res);
  });
});
server.listen(PORT, HOST, () => console.log(`[serve] http://${HOST}:${PORT}  root=${ROOT}`));
