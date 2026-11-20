/**
 * Procedural artwork.
 *
 * Every routine here paints into an OffscreenCanvas / canvas so it can be used
 * as a Pixi texture when a downloaded sprite is unavailable.  The palette
 * mirrors DawnBringer's "DawnLike" ramp so a fallback sprite still sits inside
 * the same colour world as the fetched art.
 */
import { Texture } from 'pixi.js';

export const PAL = {
  ink: '#0b0a10',
  night: '#14121f',
  deep: '#1e1b2e',
  stone: '#2b2740',
  stoneLt: '#3d3856',
  bone: '#cbb994',
  boneDim: '#8f8168',
  gold: '#e8b650',
  goldDim: '#a97c2f',
  blood: '#8e1f2f',
  bloodLt: '#c8414a',
  poison: '#4f8f3a',
  poisonLt: '#7cc35a',
  ghost: '#6fd3d8',
  ghostDim: '#2f7f8c',
  arcane: '#8f6ff0',
  arcaneLt: '#c3aaff',
  ember: '#ff9a3c',
  white: '#f6efdd',
};

function makeCanvas(w, h) {
  if (typeof document !== 'undefined' && document.createElement) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  return new OffscreenCanvas(w, h);
}

export function canvasTexture(w, h, draw) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  draw(ctx, w, h);
  const tex = Texture.from(c);
  tex.source.scaleMode = 'nearest';
  return tex;
}

/* ------------------------------------------------------------------ *
 * deterministic noise so fallbacks look hand-placed, not random mush
 * ------------------------------------------------------------------ */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

const px = (ctx, x, y, w, h, color) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

/* ------------------------------------------------------------------ *
 * generated sprites - all 16x16 to match the DawnLike grid
 * ------------------------------------------------------------------ */
const S = 16;

function humanoid(ctx, { cloth, metal, glow, eye = PAL.white, seed = 7, tall = false }) {
  const r = rng(seed);
  // shadow
  px(ctx, 4, 14, 8, 2, 'rgba(0,0,0,0.45)');
  // legs
  px(ctx, 6, 11, 2, 4, cloth);
  px(ctx, 9, 11, 2, 4, cloth);
  px(ctx, 6, 15, 2, 1, PAL.ink);
  px(ctx, 9, 15, 2, 1, PAL.ink);
  // torso
  px(ctx, 5, 6, 7, 6, cloth);
  px(ctx, 5, 6, 7, 1, metal);
  px(ctx, 5, 10, 7, 2, metal);
  // arms
  px(ctx, 4, 6, 2, 5, cloth);
  px(ctx, 11, 6, 2, 5, cloth);
  // head
  px(ctx, 6, 2, 5, 5, metal);
  px(ctx, 6, 2, 5, 1, PAL.stoneLt);
  px(ctx, 7, 4, 1, 1, eye);
  px(ctx, 9, 4, 1, 1, eye);
  if (tall) px(ctx, 6, 0, 5, 2, metal);
  if (glow) {
    ctx.globalAlpha = 0.5;
    px(ctx, 5, 12, 7, 3, glow);
    ctx.globalAlpha = 1;
  }
  for (let i = 0; i < 6; i++) {
    px(ctx, 5 + Math.floor(r() * 7), 6 + Math.floor(r() * 8), 1, 1, 'rgba(0,0,0,0.18)');
  }
}

export function heroTexture() {
  return canvasTexture(S, S, (ctx) => {
    humanoid(ctx, { cloth: '#5a6c8f', metal: '#8fa8c8', seed: 11, tall: true });
    px(ctx, 12, 4, 1, 8, PAL.gold); // sword blade
    px(ctx, 12, 12, 3, 1, PAL.goldDim); // guard
  });
}

export function heroWalkTexture(step) {
  return canvasTexture(S, S, (ctx) => {
    humanoid(ctx, { cloth: '#5a6c8f', metal: '#8fa8c8', seed: 11, tall: true });
    px(ctx, 12, 3, 1, 8, PAL.gold);
    px(ctx, 12, 11, 3, 1, PAL.goldDim);
    // shift legs for the stride
    px(ctx, 6, 11, 2, 4, 'rgba(0,0,0,0)');
    px(ctx, 9, 11, 2, 4, 'rgba(0,0,0,0)');
    if (step % 2 === 0) {
      px(ctx, 5, 11, 2, 5, '#5a6c8f');
      px(ctx, 9, 12, 2, 4, '#5a6c8f');
    } else {
      px(ctx, 6, 12, 2, 4, '#5a6c8f');
      px(ctx, 10, 11, 2, 5, '#5a6c8f');
    }
  });
}

export function skeletonTexture(frame = 0) {
  return canvasTexture(S, S, (ctx) => {
    px(ctx, 4, 14, 8, 2, 'rgba(0,0,0,0.45)');
    px(ctx, 6, 2, 5, 4, PAL.bone);
    px(ctx, 7, 3, 1, 1, PAL.ink);
    px(ctx, 9, 3, 1, 1, PAL.ink);
    px(ctx, 6, 6, 5, 5, PAL.boneDim);
    px(ctx, 7, 7, 1, 3, PAL.bone);
    px(ctx, 9, 7, 1, 3, PAL.bone);
    px(ctx, 5, 6, 1, 4, PAL.boneDim);
    px(ctx, 11, 6, 1, 4, PAL.boneDim);
    if (frame % 2 === 0) {
      px(ctx, 6, 11, 2, 4, PAL.boneDim);
      px(ctx, 9, 12, 2, 3, PAL.boneDim);
    } else {
      px(ctx, 6, 12, 2, 3, PAL.boneDim);
      px(ctx, 9, 11, 2, 4, PAL.boneDim);
    }
  });
}

export function impTexture(frame = 0) {
  return canvasTexture(S, S, (ctx) => {
    px(ctx, 4, 14, 8, 2, 'rgba(0,0,0,0.45)');
    px(ctx, 5, 5, 6, 7, PAL.blood);
    px(ctx, 6, 2, 4, 4, PAL.bloodLt);
    px(ctx, 6, 3, 1, 1, PAL.gold);
    px(ctx, 9, 3, 1, 1, PAL.gold);
    px(ctx, 5, 1, 1, 2, PAL.bloodLt);
    px(ctx, 10, 1, 1, 2, PAL.bloodLt);
    px(ctx, 4, 6, 1, 3, PAL.blood);
    px(ctx, 11, 6, 1, 3, PAL.blood);
    if (frame % 2 === 0) px(ctx, 3, 3, 3, 2, PAL.bloodLt);
    else px(ctx, 11, 3, 3, 2, PAL.bloodLt);
  });
}

export function batTexture(frame = 0) {
  return canvasTexture(S, S, (ctx) => {
    px(ctx, 6, 6, 4, 4, PAL.deep);
    px(ctx, 7, 7, 1, 1, PAL.bloodLt);
    px(ctx, 8, 7, 1, 1, PAL.bloodLt);
    const w = frame % 2 === 0 ? 3 : 5;
    px(ctx, 6 - w, 5, w, 3, PAL.stone);
    px(ctx, 10, 5, w, 3, PAL.stone);
    px(ctx, 6 - w, 8, w - 1, 1, PAL.deep);
    px(ctx, 11, 8, w - 1, 1, PAL.deep);
  });
}

export function wraithTexture(frame = 0) {
  return canvasTexture(S, S, (ctx) => {
    ctx.globalAlpha = 0.9;
    const off = frame % 2;
    px(ctx, 5, 2, 6, 6 + off, PAL.ghostDim);
    px(ctx, 6, 1, 4, 3, PAL.ghost);
    px(ctx, 6, 4, 1, 2, PAL.ink);
    px(ctx, 9, 4, 1, 2, PAL.ink);
    px(ctx, 5, 9 + off, 6, 2, PAL.ghostDim);
    px(ctx, 4, 11 + off, 3, 2, 'rgba(111,211,216,0.5)');
    px(ctx, 9, 11 + off, 3, 2, 'rgba(111,211,216,0.5)');
    ctx.globalAlpha = 1;
  });
}

export function slimeTexture(frame = 0) {
  return canvasTexture(S, S, (ctx) => {
    const h = frame % 2 === 0 ? 6 : 5;
    px(ctx, 3, S - 2 - h, 10, h + 1, PAL.poison);
    px(ctx, 4, S - 3 - h, 8, 2, PAL.poisonLt);
    px(ctx, 6, S - 5 - h, 1, 2, PAL.ink);
    px(ctx, 9, S - 5 - h, 1, 2, PAL.ink);
    px(ctx, 4, S - 1, 8, 1, 'rgba(0,0,0,0.4)');
  });
}

export function lichTexture(frame = 0) {
  return canvasTexture(S, S, (ctx) => {
    px(ctx, 4, 14, 8, 2, 'rgba(0,0,0,0.45)');
    px(ctx, 4, 5, 8, 9, PAL.arcane);
    px(ctx, 5, 5, 6, 2, PAL.arcaneLt);
    px(ctx, 6, 1, 4, 5, PAL.bone);
    px(ctx, 6, 3, 1, 1, PAL.arcaneLt);
    px(ctx, 9, 3, 1, 1, PAL.arcaneLt);
    px(ctx, 5, 0, 1, 2, PAL.gold);
    px(ctx, 8, 0, 1, 2, PAL.gold);
    px(ctx, 10, 0, 1, 2, PAL.gold);
    const f = frame % 2;
    px(ctx, 2, 4 + f, 2, 6, PAL.arcaneLt);
    px(ctx, 1, 3 + f, 2, 2, PAL.ghost);
  });
}

export function bossTexture(frame = 0) {
  return canvasTexture(24, 24, (ctx) => {
    px(ctx, 6, 22, 12, 2, 'rgba(0,0,0,0.5)');
    px(ctx, 6, 8, 12, 14, PAL.deep);
    px(ctx, 7, 9, 10, 3, PAL.arcane);
    px(ctx, 8, 2, 8, 7, PAL.bone);
    px(ctx, 9, 5, 2, 2, PAL.arcaneLt);
    px(ctx, 13, 5, 2, 2, PAL.arcaneLt);
    px(ctx, 8, 1, 1, 2, PAL.gold);
    px(ctx, 11, 0, 1, 3, PAL.gold);
    px(ctx, 14, 1, 1, 2, PAL.gold);
    px(ctx, 3, 9, 3, 9, PAL.deep);
    px(ctx, 18, 9, 3, 9, PAL.deep);
    const f = frame % 2;
    px(ctx, 2, 12 + f, 2, 6, PAL.arcane);
    px(ctx, 20, 12 - f, 2, 6, PAL.arcane);
    px(ctx, 11, 15, 2, 2, PAL.arcaneLt);
  });
}

export function eyeTexture() {
  return canvasTexture(S, S, (ctx) => {
    px(ctx, 5, 5, 6, 6, PAL.bone);
    px(ctx, 6, 6, 4, 4, PAL.ghost);
    px(ctx, 7, 7, 2, 2, PAL.ink);
    px(ctx, 4, 7, 1, 2, PAL.blood);
    px(ctx, 11, 7, 1, 2, PAL.blood);
  });
}

export function coinTexture() {
  return canvasTexture(S, S, (ctx) => {
    px(ctx, 6, 6, 4, 4, PAL.gold);
    px(ctx, 7, 5, 2, 1, PAL.goldDim);
    px(ctx, 7, 10, 2, 1, PAL.goldDim);
    px(ctx, 7, 7, 1, 2, PAL.white);
  });
}

export function potionTexture(kind = 'hp') {
  return canvasTexture(S, S, (ctx) => {
    const liquid = kind === 'hp' ? PAL.bloodLt : PAL.ghost;
    px(ctx, 7, 3, 2, 2, PAL.boneDim);
    px(ctx, 6, 5, 4, 7, PAL.bone);
    px(ctx, 7, 7, 2, 4, liquid);
    px(ctx, 6, 11, 4, 1, PAL.boneDim);
  });
}

export function soulTexture() {
  return canvasTexture(S, S, (ctx) => {
    px(ctx, 6, 4, 4, 4, PAL.arcaneLt);
    px(ctx, 7, 8, 2, 4, PAL.arcane);
    px(ctx, 5, 6, 1, 2, PAL.ghost);
    px(ctx, 10, 6, 1, 2, PAL.ghost);
    px(ctx, 7, 2, 2, 1, PAL.white);
  });
}

export function graveTexture() {
  return canvasTexture(S, S, (ctx) => {
    px(ctx, 4, 13, 9, 2, 'rgba(0,0,0,0.35)');
    px(ctx, 5, 4, 6, 10, PAL.stone);
    px(ctx, 6, 3, 4, 1, PAL.stoneLt);
    px(ctx, 7, 6, 2, 5, PAL.stoneLt);
    px(ctx, 6, 7, 4, 1, PAL.stoneLt);
  });
}

export function bonesTexture() {
  return canvasTexture(S, S, (ctx) => {
    px(ctx, 4, 11, 8, 2, PAL.boneDim);
    px(ctx, 6, 9, 4, 2, PAL.bone);
    px(ctx, 8, 8, 2, 1, PAL.bone);
    px(ctx, 3, 12, 2, 1, PAL.bone);
  });
}

export function webTexture() {
  return canvasTexture(S, S, (ctx) => {
    ctx.strokeStyle = 'rgba(200,200,210,0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(2, 2 + i * 4);
      ctx.lineTo(14, 6 + i * 2);
      ctx.stroke();
    }
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(2 + i * 4, 2);
      ctx.lineTo(6 + i * 2, 14);
      ctx.stroke();
    }
  });
}

export function chestTexture(open = false) {
  return canvasTexture(S, S, (ctx) => {
    px(ctx, 3, 6, 10, 8, '#6b4526');
    px(ctx, 3, 6, 10, 2, '#8a5c33');
    px(ctx, 3, 11, 10, 1, PAL.goldDim);
    px(ctx, 7, 9, 2, 3, PAL.gold);
    if (open) {
      px(ctx, 4, 3, 8, 3, '#8a5c33');
      px(ctx, 5, 4, 6, 1, PAL.ink);
      px(ctx, 6, 1, 1, 2, PAL.gold);
      px(ctx, 9, 0, 1, 2, PAL.gold);
    } else {
      px(ctx, 3, 4, 10, 2, '#8a5c33');
    }
  });
}

export function candleTexture(frame = 0) {
  return canvasTexture(S, S, (ctx) => {
    px(ctx, 7, 10, 2, 5, PAL.bone);
    px(ctx, 6, 15, 4, 1, PAL.stone);
    const f = frame % 2;
    px(ctx, 7, 7 - f, 2, 3 + f, PAL.ember);
    px(ctx, 7, 6 - f, 1, 1, PAL.white);
  });
}

export function statueTexture() {
  return canvasTexture(S, S, (ctx) => {
    px(ctx, 4, 14, 8, 2, 'rgba(0,0,0,0.35)');
    px(ctx, 5, 12, 6, 2, PAL.stone);
    px(ctx, 6, 3, 4, 9, PAL.stoneLt);
    px(ctx, 7, 1, 2, 2, PAL.stone);
    px(ctx, 7, 5, 1, 1, PAL.ink);
    px(ctx, 8, 5, 1, 1, PAL.ink);
  });
}

export function skullTexture() {
  return canvasTexture(S, S, (ctx) => {
    px(ctx, 5, 5, 6, 5, PAL.bone);
    px(ctx, 6, 10, 4, 2, PAL.boneDim);
    px(ctx, 6, 7, 1, 2, PAL.ink);
    px(ctx, 9, 7, 1, 2, PAL.ink);
    px(ctx, 7, 10, 1, 1, PAL.ink);
    px(ctx, 9, 10, 1, 1, PAL.ink);
  });
}

export function sparkTexture(bright = false) {
  return canvasTexture(8, 8, (ctx) => {
    const c = bright ? PAL.white : PAL.ember;
    px(ctx, 4, 0, 1, 8, c);
    px(ctx, 0, 4, 8, 1, c);
    px(ctx, 3, 3, 2, 2, PAL.gold);
  });
}

/** Blood splat: irregular specks, readable at 16px and tileable on floors. */
export function bloodTexture() {
  return canvasTexture(24, 24, (ctx) => {
    const specks = [
      [10, 11, 7, 6], [16, 8, 4, 4], [7, 15, 4, 4],
      [14, 16, 3, 3], [5, 8, 2, 2], [18, 14, 2, 2], [11, 19, 3, 2],
    ];
    for (const [x, y, w, h] of specks) {
      ctx.fillStyle = 'rgba(140,30,44,0.92)';
      ctx.beginPath();
      ctx.ellipse(x, y, w / 2, h / 2, 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(196,58,70,0.55)';
    ctx.beginPath();
    ctx.ellipse(11, 12, 2, 1.4, 0.4, 0, Math.PI * 2);
    ctx.fill();
  });
}

export function smokeTexture() {
  return canvasTexture(16, 16, (ctx) => {
    ctx.fillStyle = 'rgba(190,180,200,0.30)';
    ctx.beginPath();
    ctx.arc(8, 8, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(230,225,235,0.18)';
    ctx.beginPath();
    ctx.arc(6, 6, 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

export function burstTexture() {
  return canvasTexture(24, 24, (ctx) => {
    const g = ctx.createRadialGradient(12, 12, 1, 12, 12, 11);
    g.addColorStop(0, 'rgba(255,246,214,0.95)');
    g.addColorStop(0.45, 'rgba(255,154,60,0.7)');
    g.addColorStop(1, 'rgba(142,31,47,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 24, 24);
  });
}

export function fogTexture() {
  return canvasTexture(64, 32, (ctx) => {
    const g = ctx.createRadialGradient(32, 16, 2, 32, 16, 30);
    g.addColorStop(0, 'rgba(150,170,190,0.20)');
    g.addColorStop(1, 'rgba(150,170,190,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 32);
  });
}

/* ------------------------------------------------------------------ *
 * environment / UI
 * ------------------------------------------------------------------ */
export function floorTileTexture() {
  return canvasTexture(S, S, (ctx) => {
    const r = rng(31);
    px(ctx, 0, 0, S, S, '#221f2d');
    for (let i = 0; i < 26; i++) px(ctx, Math.floor(r() * S), Math.floor(r() * S), 1, 1, '#2b2740');
    px(ctx, 0, 0, S, 1, '#1a1826');
    px(ctx, 0, 0, 1, S, '#1a1826');
    px(ctx, 0, 15, S, 1, '#2f2b44');
    px(ctx, 15, 0, 1, S, '#2f2b44');
  });
}

export function wallTileTexture() {
  return canvasTexture(S, S, (ctx) => {
    px(ctx, 0, 0, S, S, '#3a3550');
    const r = rng(77);
    for (let y = 0; y < S; y += 4) {
      for (let x = (y % 8 === 0 ? 0 : -4); x < S; x += 8) {
        px(ctx, x + 1, y + 1, 6, 2, '#443e60');
        px(ctx, x + 1, y + 3, 6, 1, '#302c46');
      }
    }
    for (let i = 0; i < 14; i++) px(ctx, Math.floor(r() * S), Math.floor(r() * S), 1, 1, '#2a2740');
  });
}

export function vignetteTexture(w = 480, h = 270) {
  return canvasTexture(w, h, (ctx) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.65, 'rgba(0,0,0,0.28)');
    g.addColorStop(1, 'rgba(0,0,0,0.82)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

export function panelTexture(w = 100, h = 100) {
  return canvasTexture(w, h, (ctx) => {
    px(ctx, 0, 0, w, h, '#1a1620');
    ctx.strokeStyle = '#6b4a2a';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);
    ctx.strokeStyle = '#8a5c33';
    ctx.lineWidth = 1;
    ctx.strokeRect(4, 4, w - 8, h - 8);
    px(ctx, 0, 0, w, 2, '#3b2a1c');
  });
}

export function glowTexture(size = 128, color = '255,154,60') {
  return canvasTexture(size, size, (ctx) => {
    const g = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
    g.addColorStop(0, `rgba(${color},0.85)`);
    g.addColorStop(0.4, `rgba(${color},0.35)`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  });
}

export function starField(w, h, seed = 5) {
  return canvasTexture(w, h, (ctx) => {
    px(ctx, 0, 0, w, h, '#07060d');
    const r = rng(seed);
    for (let i = 0; i < w * 0.35; i++) {
      const x = Math.floor(r() * w);
      const y = Math.floor(r() * h * 0.7);
      const a = 0.15 + r() * 0.75;
      ctx.fillStyle = `rgba(${200 + r() * 55},${190 + r() * 40},${230},${a})`;
      ctx.fillRect(x, y, 1, 1);
    }
  });
}

export function moonTexture() {
  return canvasTexture(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 4, 32, 32, 30);
    g.addColorStop(0, 'rgba(238,228,255,0.95)');
    g.addColorStop(0.45, 'rgba(190,180,230,0.5)');
    g.addColorStop(1, 'rgba(120,110,170,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = 'rgba(246,239,221,0.92)';
    ctx.beginPath();
    ctx.arc(32, 32, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(200,192,175,0.5)';
    ctx.beginPath();
    ctx.arc(27, 29, 3, 0, Math.PI * 2);
    ctx.arc(36, 35, 2, 0, Math.PI * 2);
    ctx.fill();
  });
}

export function mountainLayer(w, h, seed, color, peaks = 9) {
  return canvasTexture(w, h, (ctx) => {
    const r = rng(seed);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    let x = 0;
    while (x < w) {
      const step = w / peaks;
      const top = h * (0.25 + r() * 0.5);
      ctx.lineTo(x + step * 0.5, top);
      ctx.lineTo(x + step, h * (0.55 + r() * 0.3));
      x += step;
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  });
}

export function buildingLayer(w, h, seed, color) {
  return canvasTexture(w, h, (ctx) => {
    const r = rng(seed);
    ctx.fillStyle = color;
    let x = 0;
    while (x < w) {
      const bw = 8 + Math.floor(r() * 22);
      const bh = h * (0.25 + r() * 0.6);
      ctx.fillRect(x, h - bh, bw, bh);
      // spire
      if (r() > 0.6) {
        ctx.beginPath();
        ctx.moveTo(x, h - bh);
        ctx.lineTo(x + bw / 2, h - bh - 10 - r() * 14);
        ctx.lineTo(x + bw, h - bh);
        ctx.closePath();
        ctx.fill();
      }
      x += bw + 2 + Math.floor(r() * 6);
    }
  });
}

export function inputIconTexture(kind) {
  return canvasTexture(20, 20, (ctx) => {
    px(ctx, 0, 0, 20, 20, '#1b1620');
    ctx.strokeStyle = '#c9a06a';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 18, 18);
    ctx.fillStyle = '#e8dcc0';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const glyph = { confirm: 'A', cancel: 'B', keyboard: 'KB', pad: 'PAD' }[kind] || '?';
    ctx.fillText(glyph, 10, 11);
  });
}
