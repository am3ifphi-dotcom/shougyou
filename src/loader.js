// Manifest-driven asset acquisition.  Game code references ids only.
// Sources: user override -> local_path -> pinned upstream URL (Cache API).
// Every failure is logged and downgraded to a procedural/synth fallback.

const MANIFEST_PATH = 'assets.manifest.json';
const USER_ROOT = 'assets/user/';
const USER_INDEX = USER_ROOT + 'index.json';
const CACHE_NAME = 'honshitsu-assets-v1';

function ext(local) {
  const m = String(local || '').match(/(\.[a-z0-9]+)$/i);
  return m ? m[1] : '';
}
function short(s, n = 72) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }

async function pool(items, limit, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
}

export class AssetLoader {
  constructor({ commercial = false, onProgress = null, onAsset = null, onLibraries = null, onReady = null } = {}) {
    this.commercial = commercial;
    this.onProgress = onProgress;
    this.onAsset = onAsset;
    this.onLibraries = onLibraries;
    this.onReady = onReady;
    const q = new URLSearchParams(location.search);
    this.fail = new Set((q.get('fail') || '').split(',').map((s) => s.trim()).filter(Boolean));
    this.offline = q.get('offline') === '1' || q.get('nocdn') === '1';
    this.nocache = q.get('nocache') === '1';
    this.manifest = null;
    this.entries = new Map();
    this.activeEntries = [];
    this.images = new Map();
    this.buffers = new Map();
    this.urls = new Map();
    this.fontFamilies = new Map();
    this.statuses = new Map();
    this.fallbacks = new Set();
    this.log = [];
    this.loaded = 0;
    this.total = 0;
    this.done = false;
    this.startedAt = performance.now();
    this.cache = null;
    this.userOverrides = new Set();
    window.__HONSHITSU_ASSET_LOG__ = this.log;
  }

  addLog(id, status, source = '', detail = '') {
    const e = { t: +(performance.now() / 1000).toFixed(2), id, status, source, detail: short(detail) };
    this.log.push(e);
    this.statuses.set(id, status);
    if (status === 'fallback' || status === 'failed') this.fallbacks.add(id);
    // Keep the browser console quiet but complete for debugging.
    if (this.log.length < 4 || status !== 'acquired') console.info(`[asset:${status}] ${id}`, source, detail);
  }

  async manifestFetch() {
    const res = await fetch(MANIFEST_PATH, { cache: 'no-store' });
    if (!res.ok) throw new Error(`manifest HTTP ${res.status}`);
    return res.json();
  }

  async loadManifest() {
    try {
      this.manifest = await this.manifestFetch();
    } catch (err) {
      // Even a total manifest failure must not stop gameplay: every id falls
      // back to procedural graphics / synth audio / system fonts.
      this.manifest = {
        schema: 1, game: 'HONSHITSU ARCHIVE', build: this.commercial ? 'commercial' : 'personal / noncommercial',
        commercial_build: this.commercial, assets: [], credits_roles: ['OFFLINE / PROCEDURAL FALLBACK BUILD'],
        license_policy: 'No external assets available; runtime fallbacks only.',
      };
      this.addLog('assets.manifest.json', 'fallback', 'runtime', String(err.message || err));
    }
    for (const e of this.manifest.assets) this.entries.set(e.id, e);
    // One tiny index avoids a storm of deliberate 404 probes for every id.
    // Override files themselves remain local-only and out of Git.
    try {
      const res = await fetch(USER_INDEX, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const ids = Array.isArray(data) ? data : (data.overrides || Object.keys(data));
        for (const id of ids) if (typeof id === 'string') this.userOverrides.add(id);
      }
    } catch { /* no user overrides */ }
    this.activeEntries = this.manifest.assets.filter((e) => !(this.commercial && e.noncommercial_only));
    this.total = this.activeEntries.length;
    for (const e of this.manifest.assets) {
      if (this.commercial && e.noncommercial_only) {
        this.addLog(e.id, 'excluded', 'COMMERCIAL_BUILD', 'noncommercial_only; procedural fallback');
        this.statuses.set(e.id, 'excluded');
      }
    }
    if (this.commercial) this.manifest.commercial_build = true;
    return this.manifest;
  }

  async initCache() {
    if (this.nocache || !('caches' in window)) return;
    try { this.cache = await caches.open(CACHE_NAME); } catch { this.cache = null; }
  }

  async fetchBytes(e) {
    if (this.commercial && e.noncommercial_only) throw new Error('excluded by COMMERCIAL_BUILD');
    if (this.fail.has(e.id)) throw new Error('simulated failure (?fail)');
    const sources = [];
    const e2 = ext(e.local_path);
    if (this.userOverrides.has(e.id)) {
      sources.push({ label: 'override', url: USER_ROOT + e.id });
      if (e2) sources.push({ label: 'override-ext', url: USER_ROOT + e.id + e2 });
    }
    sources.push({ label: 'local', url: e.local_path });
    if (e.url && !this.offline) sources.push({ label: 'pinned', url: e.url });
    let lastErr = null;
    for (const s of sources) {
      try {
        const req = new Request(s.url, { mode: 'cors', cache: this.nocache ? 'no-store' : 'default' });
        let res = null;
        if (this.cache && s.label !== 'override') {
          const hit = await this.cache.match(req);
          if (hit) res = hit;
        }
        if (!res) {
          res = await fetch(req);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          if (this.cache && s.label !== 'override') {
            try { await this.cache.put(req, res.clone()); } catch { /* quota/CORS */ }
          }
        }
        const buf = await res.arrayBuffer();
        if (!buf.byteLength) throw new Error('empty body');
        return { buf, source: s.label, url: s.url };
      } catch (err) { lastErr = err; }
    }
    throw lastErr || new Error('no source');
  }

  injectLibrary(e, buf) {
    const text = new TextDecoder('utf-8').decode(buf);
    const s = document.createElement('script');
    s.textContent = text + `\n//# sourceURL=${e.id}.js`;
    document.head.appendChild(s);
    s.remove();
    if (e.id === 'library-howler' && !window.Howler) throw new Error('Howler global missing');
    if (e.id === 'library-three' && !window.THREE) throw new Error('THREE global missing');
  }

  async decodeImage(blob) {
    if ('createImageBitmap' in window) {
      try { return await createImageBitmap(blob); } catch { /* continue */ }
    }
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      if (img.decode) await img.decode();
      else await new Promise((ok, no) => { img.onload = ok; img.onerror = () => no(new Error('image decode')); });
      return img;
    } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }

  async loadFont(e, buf) {
    const family = e.font_family || e.id;
    if (!('FontFace' in window) || !document.fonts) throw new Error('FontFace unsupported');
    const face = new FontFace(family, buf, { display: 'swap', weight: '400', style: 'normal' });
    await face.load();
    document.fonts.add(face);
    this.fontFamilies.set(e.id, family);
    return family;
  }

  async loadOne(e) {
    let value = null;
    try {
      const { buf, source } = await this.fetchBytes(e);
      const blob = new Blob([buf], { type: e.mime || 'application/octet-stream' });
      if (e.type === 'library') {
        this.injectLibrary(e, buf);
        value = true;
      } else if (e.type === 'font') {
        value = await this.loadFont(e, buf);
      } else if (e.type === 'image') {
        value = await this.decodeImage(blob);
        this.images.set(e.id, value);
      } else if (e.type === 'audio') {
        this.buffers.set(e.id, buf);
        value = buf;
      } else if (e.type === 'model' || e.type === 'texture') {
        const url = URL.createObjectURL(blob);
        this.urls.set(e.id, url);
        value = url;
      } else {
        this.buffers.set(e.id, buf);
        value = buf;
      }
      this.addLog(e.id, source === 'local' ? 'acquired' : source.startsWith('override') ? 'override' : source === 'pinned' ? 'acquired-cdn' : 'cached', source, `${e.type} ${buf.byteLength}B`);
      if (this.onAsset) {
        try { await this.onAsset(e, value); } catch (err) { this.addLog(e.id, 'fallback', 'decode', String(err.message || err)); }
      }
    } catch (err) {
      this.addLog(e.id, 'fallback', 'runtime', String(err.message || err));
    } finally {
      this.loaded++;
      if (this.onProgress) this.onProgress(this.progress());
    }
  }

  async loadAll() {
    try {
      await this.initCache();
      const libs = this.activeEntries.filter((e) => e.type === 'library');
      // Libraries are sequential because three-bundle expects no module loader.
      for (const e of libs) await this.loadOne(e);
      if (this.onLibraries) {
        try { await this.onLibraries(this); }
        catch (err) { this.addLog('libraries', 'fallback', 'runtime', String(err.message || err)); }
      }
      const rest = this.activeEntries.filter((e) => e.type !== 'library');
      await pool(rest, 8, (e) => this.loadOne(e));
      if (this.onReady) {
        try { await this.onReady(this); }
        catch (err) { this.addLog('ready', 'fallback', 'runtime', String(err.message || err)); }
      }
    } catch (err) {
      this.addLog('loadAll', 'fallback', 'runtime', String(err.message || err));
    } finally {
      this.done = true;
      if (this.onProgress) this.onProgress(this.progress());
    }
    return this;
  }

  progress() {
    return {
      loaded: this.loaded,
      total: this.total,
      ratio: this.total ? this.loaded / this.total : 0,
      done: this.done,
      log: this.log,
      commercial: this.commercial,
      elapsed: (performance.now() - this.startedAt) / 1000,
    };
  }
  entry(id) { return this.activeEntries.find((e) => e.id === id) || null; }
  all() { return this.activeEntries.slice(); }
  img(id) { return this.images.get(id) || null; }
  buffer(id) { return this.buffers.get(id) || null; }
  url(id) { return this.urls.get(id) || null; }
  text(id) {
    const b = this.buffers.get(id);
    return b ? new TextDecoder('utf-8').decode(b) : null;
  }
  family(id) { return this.fontFamilies.get(id) || null; }
  status(id) { return this.statuses.get(id) || 'pending'; }
  isFallback(id) { return this.fallbacks.has(id) || this.status(id) === 'excluded'; }
  credits() {
    return this.all().map((e) => ({ ...e, status: this.status(e.id), fallback: this.isFallback(e.id) }));
  }
}
