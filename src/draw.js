// Fixed-resolution dark-fantasy pixel rendering helpers.
// All on-screen graphics are drawn here; the HTML contains no web UI widgets.

export const W = 960;
export const H = 540;
export const SAFE = 48;

export const C = {
  void: '#09070e',
  ink: '#140f1e',
  night: '#221630',
  bruise: '#322242',
  violet: '#4a3058',
  slate: '#28263a',
  uniform: '#42405c',
  cool: '#605e7e',
  blood: '#5c1a2e',
  crimson: '#862038',
  ember: '#b83448',
  bronze: '#78583a',
  gold: '#b28a4e',
  parchment: '#e2c68e',
  bone: '#f4e8d0',
  skinDark: '#a87c68',
  skin: '#d6aa8e',
  skinLight: '#f0ceb2',
  hairDark: '#3a2c28',
  hair: '#60423a',
  auburn: '#8e604a',
  mossDark: '#2c3e3e',
  moss: '#5e7a68',
  shirtShadow: '#928ea4',
  shirt: '#bebacA',
  shirtLight: '#dedae6',
  warm: '#704e34',
  white: '#ffffff',
  black: '#000000',
};

export const PALETTE = [
  '#09070e', '#140f1e', '#221630', '#322242', '#4a3058',
  '#28263a', '#42405c', '#605e7e', '#5c1a2e', '#862038',
  '#b83448', '#78583a', '#b28a4e', '#e2c68e', '#f4e8d0',
  '#a87c68', '#d6aa8e', '#f0ceb2', '#3a2c28', '#60423a',
  '#8e604a', '#2c3e3e', '#5e7a68', '#928ea4', '#bebaca',
  '#dedae6', '#704e34',
];

export const FONT = {
  display: '"Press Start 2P", "DotGothic16", monospace',
  jp: '"DotGothic16", monospace',
  mono: 'ui-monospace, monospace',
};

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutBack = (t) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
export const rnd = (a = 1, b = 0) => b + Math.random() * (a - b);
export function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967295;
}
export function fmt(n, pad = 0) { return String(Math.max(0, Math.floor(n))).padStart(pad, '0'); }

function rgba(hex, alpha) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
export function roundRect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function drawText(ctx, str, x, y, o = {}) {
  const {
    size = 14, font = FONT.display, color = C.bone, align = 'left', baseline = 'alphabetic',
    outline = C.void, outlineWidth = 3, shadow = null, alpha = 1, maxWidth,
  } = o;
  // The bundled pixel fonts cover † but not ✝ / ✚; without this the browser
  // draws a tofu box. Data strings keep the novel's exact ✝本質✝ spelling.
  str = String(str).replace(/[✝✚]/g, '†');
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  if (shadow) {
    ctx.shadowColor = shadow.color || C.black;
    ctx.shadowBlur = shadow.blur || 8;
    ctx.shadowOffsetX = shadow.x || 0;
    ctx.shadowOffsetY = shadow.y || 0;
  }
  if (outline && outlineWidth > 0) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = outlineWidth;
    ctx.strokeText(str, x, y, maxWidth);
  }
  ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  ctx.fillStyle = color;
  ctx.fillText(str, x, y, maxWidth);
  ctx.restore();
}

function iw(img) { return img.naturalWidth || img.width || 64; }
function ih(img) { return img.naturalHeight || img.height || 64; }

export function drawNineSlice(ctx, img, x, y, w, h, slice) {
  if (!img || w <= 0 || h <= 0) return;
  const sw = iw(img), sh = ih(img);
  const s = Math.max(2, Math.min(slice ?? Math.floor(Math.min(sw, sh) / 3), Math.floor(w / 2), Math.floor(h / 2)));
  const sx2 = Math.max(1, sw - s * 2), sy2 = Math.max(1, sh - s * 2);
  const dx2 = Math.max(1, w - s * 2), dy2 = Math.max(1, h - s * 2);
  const parts = [
    [0, 0, s, s, x, y, s, s],
    [s, 0, sx2, s, x + s, y, dx2, s],
    [sw - s, 0, s, s, x + w - s, y, s, s],
    [0, s, s, sy2, x, y + s, s, dy2],
    [s, s, sx2, sy2, x + s, y + s, dx2, dy2],
    [sw - s, s, s, sy2, x + w - s, y + s, s, dy2],
    [0, sh - s, s, s, x, y + h - s, s, s],
    [s, sh - s, sx2, s, x + s, y + h - s, dx2, s],
    [sw - s, sh - s, s, s, x + w - s, y + h - s, s, s],
  ];
  for (const p of parts) ctx.drawImage(img, p[0], p[1], p[2], p[3], Math.round(p[4]), Math.round(p[5]), Math.round(p[6]), Math.round(p[7]));
}

// Procedural, palette-locked substitutes.  Used for missing/failed assets and
// for every noncommercial_only portrait in a COMMERCIAL_BUILD.
export class Fallback {
  constructor() { this.cache = new Map(); }
  image(id) {
    if (this.cache.has(id)) return this.cache.get(id);
    const c = document.createElement('canvas');
    let w = 64, h = 64;
    if (id.startsWith('bg-')) { w = 256; h = 128; }
    if (id.startsWith('portrait-')) { w = 72; h = 108; }
    if (id.startsWith('ui-button-long')) { w = 128; h = 32; }
    if (id.startsWith('ui-bar-')) { w = 18; h = 18; }
    if (id.startsWith('particle-')) { w = 64; h = 64; }
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    this.paint(g, id, w, h);
    this.cache.set(id, c);
    return c;
  }
  paint(g, id, w, h) {
    g.clearRect(0, 0, w, h);
    const px = (x, y, ww, hh, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(ww)), Math.max(1, Math.round(hh))); };
    if (id.startsWith('portrait-')) { this.portrait(g, id, w, h, px); return; }
    if (id.startsWith('bg-')) { this.background(g, id, w, h, px); return; }
    if (id.startsWith('tex-')) {
      px(0, 0, w, h, C.slate);
      for (let y = 0; y < h; y += 8) for (let x = 0; x < w; x += 8) px(x, y, 7, 7, ((x / 8 + y / 8) & 1) ? C.night : C.bruise);
      return;
    }
    if (id.startsWith('tile-')) {
      px(0, 0, w, h, C.void); px(3, 3, w - 6, h - 6, C.mossDark); px(6, 6, w - 12, h - 12, C.moss); return;
    }
    if (id.startsWith('particle-')) {
      const col = id.includes('cloud') ? C.crimson : id.includes('smoke') ? C.violet : C.parchment;
      px(w / 2 - 2, 4, 4, h - 8, col); px(4, h / 2 - 2, w - 8, 4, col);
      px(w / 2 - 6, h / 2 - 6, 12, 12, C.bone); return;
    }
    if (id.startsWith('icon-')) {
      const col = C.bone;
      if (id.includes('cross')) { px(14, 28, 36, 8, col); px(28, 14, 8, 36, col); }
      else if (id.includes('star')) { px(28, 8, 8, 48, col); px(8, 28, 48, 8, col); px(16, 16, 32, 32, col); }
      else if (id.includes('question')) { px(20, 12, 24, 8, col); px(36, 20, 8, 16, col); px(28, 32, 8, 8, col); px(28, 46, 8, 8, col); }
      else if (id.includes('check')) { px(10, 30, 12, 12, col); px(22, 38, 12, 12, col); px(34, 26, 12, 12, col); px(46, 14, 8, 12, col); }
      else { px(16, 10, 32, 44, col); px(20, 14, 24, 36, C.void); px(28, 20, 8, 24, col); }
      return;
    }
    if (id.startsWith('prompt-')) {
      const label = id.includes('esc') ? 'ESC' : id.includes('space') ? 'SPC' : id.includes('enter') ? 'ENT' : id.includes('arrows') ? '←→' : id.includes('pad-a') ? 'A' : id.includes('pad-b') ? 'B' : id.includes('dpad') ? '+' : 'GO';
      px(4, 4, w - 8, h - 8, C.bone); px(8, 8, w - 16, h - 16, C.ink);
      g.fillStyle = C.parchment; g.font = '10px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(label, w / 2, h / 2); return;
    }
    if (id.startsWith('ui-frame')) {
      // Transparent centre, ornate corners: a valid nine-slice frame.
      g.clearRect(0, 0, w, h);
      const col = C.gold;
      px(0, 0, w, 5, col); px(0, h - 5, w, 5, col); px(0, 0, 5, h, col); px(w - 5, 0, 5, h, col);
      for (const [cx, cy] of [[4, 4], [w - 12, 4], [4, h - 12], [w - 12, h - 12]]) px(cx, cy, 8, 8, col);
      return;
    }
    if (id.startsWith('ui-divider')) { px(0, h / 2 - 1, w, 3, C.gold); px(0, h / 2 - 5, 6, 11, C.gold); px(w - 6, h / 2 - 5, 6, 11, C.gold); return; }
    if (id.startsWith('ui-minimap')) {
      g.strokeStyle = C.gold; g.lineWidth = 4; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 6, 0, Math.PI * 2); g.stroke();
      if (id.includes('exclamation')) { px(w / 2 - 3, 14, 6, 24, C.ember); px(w / 2 - 3, 44, 6, 6, C.ember); }
      if (id.includes('star')) { px(w / 2 - 3, 10, 6, 44, C.parchment); px(10, h / 2 - 3, 44, 6, C.parchment); }
      return;
    }
    if (id.startsWith('ui-bar')) { px(0, 0, w, h, id.includes('back') ? C.ink : id.includes('blue') ? C.cool : C.crimson); return; }
    if (id.startsWith('ui-cursor')) { px(4, 8, 24, 8, C.gold); px(20, 12, 8, 20, C.gold); px(28, 28, 16, 8, C.parchment); return; }
    if (id.startsWith('ui-banner')) { px(0, 6, w, h - 12, id.includes('red') ? C.blood : C.parchment); px(0, 0, w, 6, C.gold); px(0, h - 6, w, 6, C.gold); return; }
    // Default panel / button.
    px(0, 0, w, h, C.night); px(3, 3, w - 6, h - 6, C.bruise); px(6, 6, w - 12, h - 12, C.ink);
    px(2, 2, 8, 2, C.gold); px(2, 2, 2, 8, C.gold); px(w - 10, 2, 8, 2, C.gold); px(w - 4, 2, 2, 8, C.gold);
  }
  portrait(g, id, w, h, px) {
    const t = hash(id);
    const hair = t > 0.7 ? C.auburn : t > 0.35 ? C.hair : C.hairDark;
    const tie = id.includes('inaba') ? C.moss : id.includes('katsuya') ? C.gold : C.crimson;
    const suit = t > 0.6 ? C.slate : C.night;
    px(12, 8, 48, 20, hair); px(16, 20, 40, 22, C.skin); px(18, 14, 36, 8, hair);
    px(22, 30, 6, 4, C.void); px(44, 30, 6, 4, C.void);
    px(10, 42, 52, 60, suit); px(28, 42, 16, 30, C.shirt); px(34, 42, 4, 34, tie);
    px(14, 44, 10, 54, C.bruise); px(48, 44, 10, 54, C.bruise);
    px(18, 70, 36, 2, C.gold); px(32, 76, 8, 8, C.gold);
  }
  background(g, id, w, h, px) {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, C.void); grd.addColorStop(1, C.bruise); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 24; i++) { const x = ((i * 37) % w), y = ((i * 19) % (h / 2)); px(x, y, 1, 1, C.parchment); }
    g.fillStyle = C.night;
    g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 16) g.lineTo(x, h - 20 - ((x * 7) % 28)); g.lineTo(w, h); g.closePath(); g.fill();
    if (id.includes('castles')) { g.fillStyle = C.ink; for (let x = 10; x < w; x += 46) { g.fillRect(x, h - 50, 26, 50); g.fillRect(x + 6, h - 62, 6, 12); g.fillRect(x + 18, h - 62, 6, 12); } }
  }
}

export class Paint {
  constructor(loader) {
    this.loader = loader;
    this.fallback = new Fallback();
    this.tintCache = new Map();
  }
  img(id) { return this.loader.img(id) || this.fallback.image(id); }
  entry(id) { return this.loader.entry(id); }
  tinted(id, color = C.gold, alpha = 1, mode = 'tint') {
    const key = `${id}|${color}|${alpha}|${mode}`;
    if (this.tintCache.has(key)) return this.tintCache.get(key);
    const src = this.img(id);
    const c = document.createElement('canvas');
    c.width = iw(src); c.height = ih(src);
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = mode === 'shade' ? 'source-atop' : 'source-atop';
    g.fillStyle = rgba(color, mode === 'shade' ? alpha : 1);
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'source-over';
    this.tintCache.set(key, c);
    return c;
  }
  shade(id, color = C.violet, alpha = 0.55) { return this.tinted(id, color, alpha, 'shade'); }
  nine(ctx, id, x, y, w, h, slice, color, alpha = 1) {
    const img = this.tinted(id, color || C.gold, alpha, 'shade');
    drawNineSlice(ctx, img, x, y, w, h, slice);
  }
  panel(ctx, x, y, w, h, o = {}) {
    const { alpha = 1, damaged = false, parchment = false, frame = true, glow = 0 } = o;
    ctx.save(); ctx.globalAlpha *= alpha;
    if (glow) { ctx.shadowColor = C.crimson; ctx.shadowBlur = glow; }
    ctx.fillStyle = rgba(C.black, 0.55); roundRect(ctx, x + 5, y + 6, w, h, 8); ctx.fill();
    ctx.shadowBlur = 0;
    const base = parchment ? 'ui-panel-parchment' : damaged ? 'ui-panel-damaged' : 'ui-panel-dark';
    drawNineSlice(ctx, this.shade(base, C.night, parchment ? 0.28 : 0.62), x, y, w, h, 24);
    ctx.fillStyle = rgba(C.void, parchment ? 0.18 : 0.42); roundRect(ctx, x + 10, y + 10, w - 20, h - 20, 4); ctx.fill();
    if (frame) drawNineSlice(ctx, this.tinted('ui-frame-square', C.gold, 1), x - 4, y - 4, w + 8, h + 8, 16);
    ctx.restore();
  }
  frame(ctx, id, x, y, w, h, color = C.gold, alpha = 1) {
    ctx.save(); ctx.globalAlpha *= alpha;
    drawNineSlice(ctx, this.tinted(id, color, 1), x, y, w, h, 16);
    ctx.restore();
  }
  divider(ctx, x, y, w, color = C.gold, alpha = 0.8) {
    ctx.save(); ctx.globalAlpha *= alpha;
    const img = this.tinted('ui-divider', color, 1);
    ctx.drawImage(img, x, y - Math.max(4, ih(img) / 2), w, Math.max(8, ih(img)));
    ctx.restore();
  }
  icon(ctx, id, x, y, size = 24, color = C.bone, alpha = 1) {
    const img = this.tinted(id, color, 1);
    ctx.save(); ctx.globalAlpha *= alpha; ctx.imageSmoothingEnabled = false;
    const r = iw(img) / ih(img);
    const w = size * r, h = size;
    ctx.drawImage(img, x - w / 2, y - h / 2, w, h);
    ctx.restore();
  }
  portrait(ctx, id, x, y, w, h, alpha = 1) {
    const img = this.img(id);
    ctx.save(); ctx.globalAlpha *= alpha; ctx.imageSmoothingEnabled = false;
    ctx.shadowColor = C.black; ctx.shadowBlur = 6;
    ctx.drawImage(img, x, y, w, h);
    ctx.shadowBlur = 0; ctx.strokeStyle = rgba(C.gold, 0.55); ctx.lineWidth = 2; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.restore();
  }
  hBar(ctx, ids, x, y, w, h, alpha = 1) {
    const [l, m, r] = ids.map((id) => this.shade(id, C.night, 0.35));
    ctx.save(); ctx.globalAlpha *= alpha; ctx.imageSmoothingEnabled = false;
    const sw = Math.min(8, Math.floor(w / 3));
    ctx.drawImage(l, x, y, sw, h);
    ctx.drawImage(m, x + sw, y, w - sw * 2, h);
    ctx.drawImage(r, x + w - sw, y, sw, h);
    ctx.restore();
  }
  bar(ctx, x, y, w, h, ratio, o = {}) {
    const { ghost = 0, color = C.crimson, blue = false, alpha = 1 } = o;
    ctx.save(); ctx.globalAlpha *= alpha;
    ctx.fillStyle = C.void; roundRect(ctx, x - 2, y - 2, w + 4, h + 4, 4); ctx.fill();
    this.hBar(ctx, ['ui-bar-back-left', 'ui-bar-back-mid', 'ui-bar-back-right'], x, y, w, h);
    if (ghost > ratio + 0.002) {
      ctx.fillStyle = rgba(C.ember, 0.45); roundRect(ctx, x + 2, y + 2, Math.max(0, (w - 4) * clamp(ghost, 0, 1)), h - 4, 3); ctx.fill();
    }
    const fill = blue ? ['ui-bar-blue-left', 'ui-bar-blue-mid', 'ui-bar-blue-right'] : ['ui-bar-red-left', 'ui-bar-red-mid', 'ui-bar-red-right'];
    const fw = Math.max(0, (w - 4) * clamp(ratio, 0, 1));
    if (fw > 1) this.hBar(ctx, fill, x + 2, y + 2, fw, h - 4);
    ctx.strokeStyle = rgba(C.gold, 0.5); ctx.lineWidth = 1; roundRect(ctx, x, y, w, h, 3); ctx.stroke();
    ctx.restore();
  }
  button(ctx, x, y, w, h, pressed = false, alpha = 1) {
    ctx.save(); ctx.globalAlpha *= alpha;
    drawNineSlice(ctx, this.shade(pressed ? 'ui-button-long-pressed' : 'ui-button-long', C.bruise, 0.45), x, y, w, h, 12);
    ctx.restore();
  }
  slot(ctx, x, y, w, h, active = false, alpha = 1) {
    ctx.save(); ctx.globalAlpha *= alpha;
    drawNineSlice(ctx, this.shade(active ? 'ui-button-square-pressed' : 'ui-button-square', C.bruise, 0.4), x, y, w, h, 10);
    if (active) { ctx.strokeStyle = C.gold; ctx.lineWidth = 2; roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 5); ctx.stroke(); }
    ctx.restore();
  }
  text(ctx, str, x, y, o = {}) { drawText(ctx, str, x, y, o); }
}
