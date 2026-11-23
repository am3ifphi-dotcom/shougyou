// ---------------------------------------------------------------------------
//  assets.js — the runtime asset registry.
//
//  Rules this file enforces:
//    * the game never names a URL. It asks for an asset by id.
//    * every entry comes from assets.manifest.json (written by tools/fetch-assets.mjs)
//    * assets/user/<id>.<ext> is checked first, so a hand-made drop-in wins
//    * anything missing falls back to a procedurally generated texture / tone,
//      and the fallback is recorded in the in-game loading log.
// ---------------------------------------------------------------------------

export const AudioBus = { BGM: 'bgm', SE: 'se', VOICE: 'voice' };

export class AssetRegistry {
  constructor(manifest) {
    this.manifest = manifest;
    this.byId = new Map(manifest.assets.map((a) => [a.id, a]));
    this.entries = manifest.assets;
    this.log = [];                 // { id, status, detail }
    this.textures = new Map();     // id -> PIXI.Texture
    this.frames = new Map();       // id -> PIXI.Texture[]
    this.audioBuffers = new Map(); // id -> ArrayBuffer
    this.fallbacks = new Set();
    this.commercial = !!manifest.commercial_build;
    this.userDir = 'assets/user/';
    this.onLog = null;
  }

  info(id) { return this.byId.get(id); }

  /**
   * Resolve the best path to load for an id, honouring:
   *   commercial build → drop noncommercial-only material
   *   assets/user/<id>.<ext> override
   */
  resolve(id) {
    const e = this.byId.get(id);
    if (!e) return { id, error: 'unknown asset id' };
    if (this.commercial && e.noncommercial_only) {
      return { id, entry: e, error: 'excluded in commercial build', excluded: true };
    }
    if (e.meta?.frames?.length) return { id, entry: e, path: e.meta.frames[0], frames: e.meta.frames };
    if (e.available && e.local_path) return { id, entry: e, path: e.local_path };
    return { id, entry: e, error: e.error || 'not available' };
  }

  record(id, status, detail = '') {
    const row = { id, status, detail, t: performance.now() };
    this.log.push(row);
    this.onLog?.(row);
    const e = this.byId.get(id);
    if (status === 'fallback' && e) this.fallbacks.add(id);
    return row;
  }

  // ---------------------------------------------------------------- textures
  async loadTexture(id, { PIXI, nearest = true } = {}) {
    if (this.textures.has(id)) return this.textures.get(id);
    const r = this.resolve(id);
    const userPath = await this._findUserOverride(id);
    const path = userPath || r.path;
    let tex = null;
    if (path) {
      try {
        const src = await PIXI.Assets.load(path).catch(async () => {
          // PIXI's loader is picky about some 16px assets — fall back to Image
          const img = await loadImage(path);
          return PIXI.BaseTexture.from(img, { scaleMode: nearest ? PIXI.SCALE_MODES.NEAREST : PIXI.SCALE_MODES.LINEAR });
        });
        tex = src instanceof PIXI.BaseTexture ? new PIXI.Texture(src) : src.texture || src;
        tex.baseTexture.scaleMode = nearest ? PIXI.SCALE_MODES.NEAREST : PIXI.SCALE_MODES.LINEAR;
        if (r.frames) {
          const list = await Promise.all(r.frames.map((f) => this._loadSingle(f, PIXI)));
          this.frames.set(id, list);
        }
      } catch (e) {
        tex = null;
      }
    }
    if (!tex) {
      tex = PIXI.Texture.from(procedural(id, this.byId.get(id)));
      tex.baseTexture.scaleMode = nearest ? PIXI.SCALE_MODES.NEAREST : PIXI.SCALE_MODES.LINEAR;
      this.record(id, 'fallback', userPath ? 'user file unreadable' : (r.error || 'download failed'));
    } else {
      this.record(id, userPath ? 'user' : 'ok', userPath ? this.userDir : (r.entry?.license || ''));
    }
    this.textures.set(id, tex);
    return tex;
  }

  async _loadSingle(path, PIXI) {
    try {
      const res = await PIXI.Assets.load(path);
      return res.texture || res;
    } catch {
      const img = await loadImage(path);
      return new PIXI.Texture(PIXI.BaseTexture.from(img, { scaleMode: PIXI.SCALE_MODES.NEAREST }));
    }
  }

  /** Cut a grid sheet (fx_torch_anim, fx_burst_a, …) into frames. */
  gridFrames(id, cols, rows, PIXI) {
    const base = this.textures.get(id);
    if (!base || !base.baseTexture) return [];
    const bw = base.baseTexture.width, bh = base.baseTexture.height;
    const fw = Math.floor(bw / cols), fh = Math.floor(bh / rows);
    const out = [];
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      out.push(new PIXI.Texture(base.baseTexture, new PIXI.Rectangle(x * fw, y * fh, fw, fh)));
    }
    return out;
  }

  async _findUserOverride(id) {
    // Cheap probe: a drop-in file placed by the player. Cached per session.
    this._userCache ||= new Map();
    if (this._userCache.has(id)) return this._userCache.get(id);
    // Prefer a manifest-declared override (fetch script already found one)
    const e = this.byId.get(id);
    let p = null;
    if (e?.user_override && e.local_path) p = e.local_path;
    this._userCache.set(id, p);
    return p;
  }

  async loadAudio(id) {
    if (this.audioBuffers.has(id)) return this.audioBuffers.get(id);
    const r = this.resolve(id);
    if (!r.path) { this.record(id, 'fallback', r.error || 'missing'); this.audioBuffers.set(id, null); return null; }
    try {
      const res = await fetch(r.path);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      this.audioBuffers.set(id, buf);
      this.record(id, 'ok', `${(buf.byteLength / 1024) | 0} kB`);
      return buf;
    } catch (e) {
      this.record(id, 'fallback', e.message);
      this.audioBuffers.set(id, null);
      return null;
    }
  }
}

// ---------------------------------------------------------------- helpers
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image failed: ' + src));
    img.src = src;
  });
}

/**
 * Procedural stand-in. Deliberately *not* pretty: if you see it on screen it
 * means a download failed, and the loading log says which one.
 * Keeps the game rendering instead of crashing.
 */
export function procedural(id, entry) {
  const c = document.createElement('canvas');
  const S = 32;
  c.width = c.height = S;
  const g = c.getContext('2d');
  const hue = hash(id) % 360;
  const kind = (id || '').split('_')[0];
  if (kind === 'tile') {
    g.fillStyle = `hsl(${hue} 12% 14%)`;
    g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(255,255,255,.16)';
    g.strokeRect(0.5, 0.5, S - 1, S - 1);
    g.fillStyle = 'rgba(0,0,0,.28)';
    for (let i = 0; i < 12; i++) g.fillRect((hash(id + i) % S) | 0, (hash(id + i + 'y') % S) | 0, 2, 2);
  } else if (kind === 'mon' || kind === 'wr') {
    g.fillStyle = 'rgba(0,0,0,0)';
    g.clearRect(0, 0, S, S);
    g.fillStyle = `hsl(${hue} 55% 55% / .9)`;
    g.beginPath();
    g.moveTo(S / 2, 3); g.lineTo(S - 4, S - 5); g.lineTo(4, S - 5); g.closePath(); g.fill();
    g.fillStyle = '#fff';
    g.fillRect(11, 15, 3, 3); g.fillRect(18, 15, 3, 3);
  } else if (kind === 'fx') {
    const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    grd.addColorStop(0, `hsla(${hue} 100% 80% / 1)`);
    grd.addColorStop(1, `hsla(${hue} 100% 50% / 0)`);
    g.fillStyle = grd;
    g.fillRect(0, 0, S, S);
  } else if (kind === 'ui' || kind === 'hud') {
    g.fillStyle = 'rgba(20,26,34,.92)';
    g.fillRect(0, 0, S, S);
    g.strokeStyle = `hsla(${hue} 40% 60% / .7)`;
    g.strokeRect(1.5, 1.5, S - 3, S - 3);
  } else if (kind === 'art') {
    g.fillStyle = '#10151c'; g.fillRect(0, 0, S, S);
    g.fillStyle = `hsl(${hue} 30% 30%)`;
    g.beginPath(); g.arc(S / 2, S / 2, S / 3, 0, Math.PI * 2); g.fill();
  } else {
    g.fillStyle = `hsl(${hue} 45% 45%)`;
    g.fillRect(6, 6, S - 12, S - 12);
    g.strokeStyle = '#000'; g.strokeRect(6.5, 6.5, S - 13, S - 13);
  }
  const tex = PIXI.Texture.from(c);
  tex._procedural = true;
  tex._id = id;
  return tex;
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < (s || '').length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}
