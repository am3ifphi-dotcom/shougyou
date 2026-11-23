// ui.js — 描画ヘルパ (テキスト縁取り / 9スライス枠 / アイコン / HP残像バー / 入力アイコン)
import { clamp } from "./core.js";

export const PALETTE = {
  bg: "#0d0a14",
  panel: "#171022",
  panelLight: "#241733",
  gold: "#ffd277",
  goldDim: "#b98d3f",
  bone: "#e8dcb8",
  boneDim: "#9d917a",
  crimson: "#e2565c",
  crimsonDark: "#7c2b33",
  cyan: "#8fd8ff",
  violet: "#b79ae0",
  green: "#7bb661",
  ink: "#120b1e",
  white: "#ffffff",
};

const tintCache = new Map();

/** 単色マスク化した画像をキャッシュ (発光/着色用) */
export function tintImage(img, color) {
  const key = (img.src || img._id || "x") + "|" + color;
  if (tintCache.has(key)) return tintCache.get(key);
  const c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  tintCache.set(key, c);
  return c;
}

/** ピクセルフォントの縁取りテキスト */
export function drawText(ctx, text, x, y, opt = {}) {
  const {
    size = 8, font = "pix", color = PALETTE.bone,
    align = "left", baseline = "top",
    outline = PALETTE.ink, outlineWidth = 2,
    shadow = true, shadowColor = "rgba(0,0,0,0.6)",
    glow = null, alpha = 1, letter = 0,
  } = opt;
  const family = font === "pix" ? '"PressStart2P","DotGothic16",monospace'
    : font === "jp" ? '"DotGothic16","PressStart2P",monospace'
    : font;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${size}px ${family}`;
  ctx.textBaseline = baseline;
  ctx.textAlign = "left";
  const w = measure(ctx, text, size, family, letter);
  let cx = x;
  if (align === "center") cx = x - w / 2;
  else if (align === "right") cx = x - w;
  const drawPass = (dx, dy, style) => {
    ctx.fillStyle = style;
    if (letter) {
      let px = cx + dx;
      for (const ch of text) {
        ctx.fillText(ch, px, y + dy);
        px += ctx.measureText(ch).width + letter;
      }
    } else {
      ctx.fillText(text, cx + dx, y + dy);
    }
  };
  if (shadow) drawPass(1, 1, shadowColor);
  if (outlineWidth > 0) {
    for (let ox = -outlineWidth; ox <= outlineWidth; ox++) {
      for (let oy = -outlineWidth; oy <= outlineWidth; oy++) {
        if (ox === 0 && oy === 0) continue;
        drawPass(ox, oy, outline);
      }
    }
  }
  if (glow) {
    ctx.save();
    ctx.shadowColor = glow;
    ctx.shadowBlur = size * 0.9;
    drawPass(0, 0, color);
    ctx.restore();
  }
  drawPass(0, 0, color);
  ctx.restore();
  return w;
}

export function measure(ctx, text, size, family, letter = 0) {
  ctx.save();
  ctx.font = `${size}px ${family}`;
  let w = 0;
  if (letter) {
    for (const ch of text) w += ctx.measureText(ch).width + letter;
    w -= letter;
  } else {
    w = ctx.measureText(text).width;
  }
  ctx.restore();
  return w;
}

/**
 * ファンタジー枠の 9 スライスパネル。
 * borderImg: 48x48 の Kenney Fantasy UI Borders (角16px)
 */
export function drawPanel(ctx, x, y, w, h, opt = {}) {
  const { img = null, tint = PALETTE.bone, alpha = 0.94, fill = PALETTE.panel, radiusFake = 0 } = opt;
  ctx.save();
  ctx.globalAlpha = 1;
  // 下地
  ctx.fillStyle = fill;
  ctx.globalAlpha = alpha;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  ctx.globalAlpha = 1;
  if (img && img.width) {
    const src = tint ? tintImage(img, tint) : img;
    const s = 16; // corner size
    const dw = img.width, dh = img.height;
    const X = Math.round(x), Y = Math.round(y), W = Math.round(w), H = Math.round(h);
    // corners
    ctx.drawImage(src, 0, 0, s, s, X, Y, s, s);
    ctx.drawImage(src, dw - s, 0, s, s, X + W - s, Y, s, s);
    ctx.drawImage(src, 0, dh - s, s, s, X, Y + H - s, s, s);
    ctx.drawImage(src, dw - s, dh - s, s, s, X + W - s, Y + H - s, s, s);
    // edges
    ctx.drawImage(src, s, 0, dw - 2 * s, s, X + s, Y, W - 2 * s, s);
    ctx.drawImage(src, s, dh - s, dw - 2 * s, s, X + s, Y + H - s, W - 2 * s, s);
    ctx.drawImage(src, 0, s, s, dh - 2 * s, X, Y + s, s, H - 2 * s);
    ctx.drawImage(src, dw - s, s, s, dh - 2 * s, X + W - s, Y + s, s, H - 2 * s);
    // center
    ctx.drawImage(src, s, s, dw - 2 * s, dh - 2 * s, X + s, Y + s, W - 2 * s, H - 2 * s);
  } else {
    // fallback: 簡易フレーム
    ctx.strokeStyle = tint || PALETTE.goldDim;
    ctx.lineWidth = 2;
    ctx.strokeRect(Math.round(x) + 1, Math.round(y) + 1, Math.round(w) - 2, Math.round(h) - 2);
  }
  ctx.restore();
}

/** HPバー (残像バー付き) */
export function drawBar(ctx, x, y, w, h, value, ghost, opt = {}) {
  const {
    fg = PALETTE.crimson, fgLow = PALETTE.crimsonDark,
    ghostColor = "rgba(255,210,124,0.55)",
    back = "rgba(10,6,16,0.85)", border = PALETTE.ink,
  } = opt;
  const v = clamp(value, 0, 1);
  const g = clamp(ghost, 0, 1);
  ctx.save();
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  if (g > v) {
    ctx.fillStyle = ghostColor;
    ctx.fillRect(x + 1, y + 1, Math.round((w - 2) * g), h - 2);
  }
  ctx.fillStyle = v <= 0.3 ? fgLow : fg;
  ctx.fillRect(x + 1, y + 1, Math.round((w - 2) * v), h - 2);
  // 上ハイライト
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(x + 1, y + 1, Math.round((w - 2) * v), 1);
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.restore();
}

// ------------------------------------------------- input prompt icons
// Kenney Input Prompts Pixel (16x16) タイル番号
const KEY_TILE = {
  esc: 17, enter: 133, space: 101,
  z: 154, x: 155, c: 156, w: 85, a: 120, s: 121, d: 122,
  up: 35, down: 37, left: 36, right: 38,
};
const PAD_TILE = { a: 4, b: 5, x: 6, y: 7, up: 35, down: 37, left: 36, right: 38, start: 12 };

/**
 * 入力プロンプトアイコンを描く。
 * packImg: pack_input_prompts (tile_XXXX.png を集めたシートでなく、個別ファイルを渡す)
 * tileResolver: (index) => HTMLImageElement
 */
export function drawPromptIcon(ctx, tileResolver, name, x, y, size = 16, device = "keyboard") {
  const map = device === "pad" ? PAD_TILE : KEY_TILE;
  const idx = map[name] !== undefined ? map[name] : KEY_TILE[name];
  if (idx === undefined) return;
  const img = tileResolver(idx);
  if (!img) {
    // fallback: 角丸キーキャップ
    ctx.save();
    ctx.fillStyle = "rgba(232,220,184,0.9)";
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
    drawText(ctx, name[0].toUpperCase(), x + size / 2, y + size / 2, { size: 6, align: "center", baseline: "middle" });
    ctx.restore();
    return;
  }
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, x, y, size, size);
}

/** キーボード/パッド対応の「入力チップ」(アイコン+ラベル) */
export function drawInputChip(ctx, tileResolver, icon, label, x, y, device, opt = {}) {
  const { size = 16, color = PALETTE.bone, align = "left" } = opt;
  const labelW = label ? label.length * (opt.fontSize || 7) + 4 : 0;
  const totalW = size + 3 + labelW;
  let ix = x;
  if (align === "center") ix = x - totalW / 2;
  else if (align === "right") ix = x - totalW;
  drawPromptIcon(ctx, tileResolver, icon, ix, y - size / 2, size, device);
  if (label) drawText(ctx, label, ix + size + 3, y, { size: opt.fontSize || 7, color, baseline: "middle" });
  return totalW;
}

/** フローティングテキスト */
export class Floater {
  constructor(text, x, y, opt = {}) {
    this.text = text; this.x = x; this.y = y;
    this.vy = opt.vy ?? -28;
    this.life = opt.life ?? 0.9;
    this.t = 0;
    this.size = opt.size ?? 8;
    this.color = opt.color ?? PALETTE.gold;
    this.font = opt.font ?? "pix";
    this.crit = opt.crit ?? false;
  }
  update(dt) {
    this.t += dt;
    this.y += this.vy * dt;
    this.vy *= Math.pow(0.2, dt);
    return this.t < this.life;
  }
  render(ctx) {
    const p = this.t / this.life;
    const scale = this.crit ? 1 + Math.sin(Math.min(1, p * 4) * Math.PI) * 0.35 : 1;
    drawText(ctx, this.text, this.x, this.y, {
      size: Math.round(this.size * scale),
      color: this.color,
      align: "center",
      alpha: clamp(1 - p * p, 0, 1),
      font: this.font,
    });
  }
}

/** トースト通知 (画面隅) */
export class Toast {
  constructor(title, sub, icon = null) {
    this.title = title; this.sub = sub; this.icon = icon;
    this.life = 2.6; this.t = 0;
  }
  update(dt) { this.t += dt; return this.t < this.life; }
  render(ctx, x, y, borderImg) {
    const inT = clamp(this.t / 0.25, 0, 1);
    const outT = clamp((this.life - this.t) / 0.4, 0, 1);
    const slide = (1 - inT) * -30 + (1 - outT) * -30;
    const w = 168, h = 34;
    ctx.save();
    ctx.globalAlpha = Math.min(inT, outT);
    drawPanel(ctx, x + slide, y, w, h, { img: borderImg, tint: PALETTE.goldDim, alpha: 0.92 });
    drawText(ctx, this.title, x + slide + 12, y + 9, { size: 8, color: PALETTE.gold, font: "jp" });
    if (this.sub) drawText(ctx, this.sub, x + slide + 12, y + 21, { size: 7, color: PALETTE.boneDim, font: "jp" });
    ctx.restore();
  }
}
