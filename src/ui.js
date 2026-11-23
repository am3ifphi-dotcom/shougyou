// ---------------------------------------------------------------------------
//  ui.js — the game's skin. Nine-sliced ornate frames from the CC0 pack,
//  pixel text with hard outline/shadow, a glowing selection cursor, toasts,
//  and a typewriter dialogue window. Everything is anchored to the 1280×720
//  design space; the app scales that to the window and keeps 5% safe margins.
// ---------------------------------------------------------------------------
export const W = 1280;
export const H = 720;
export const SAFE = 36;           // ≈ 5% of the short edge — the safe area
export const FONT_BIG = '"Press Start 2P", "DotGothic16", monospace';
export const FONT_JP = '"DotGothic16", "DotGothic16 JP", monospace';
export const FONT_JP_HEAVY = '"DotGothic16 JP", "DotGothic16", monospace';

export const C = {
  ink: 0x05070a,
  panel: 0x0d1118,
  panelEdge: 0x2a3442,
  gold: 0xd7b169,
  goldDim: 0x8a6c3c,
  blood: 0x8d1f2a,
  bloodBright: 0xd23b3b,
  wraith: 0x6f8fb5,
  essence: 0x59d7c8,
  text: 0xe8e3d6,
  textDim: 0x939aa4,
  shadow: 0x000000,
  ok: 0x8ec96b,
  danger: 0xd8503f,
};

// ---------------------------------------------------------------- text
export function pxText(str, { size = 16, fill = C.text, font = FONT_JP, weight = '400', align = 'left', outline = 3, shadow = true, letterSpacing = 0 } = {}) {
  const t = new PIXI.Text(str, {
    fontFamily: font,
    fontSize: size,
    fontWeight: weight,
    fill,
    align,
    letterSpacing,
    dropShadow: shadow,
    dropShadowColor: 0x000000,
    dropShadowDistance: 2,
    dropShadowAlpha: 0.85,
    stroke: 0x000000,
    strokeThickness: outline || 0,
    lineJoin: 'round',
    padding: size * 0.4,
  });
  t.resolution = 2;                 // crisp when the frame is upscaled to 4K
  t.anchor?.set?.(0, 0);
  return t;
}

export function outlineText(str, opts = {}) {
  return pxText(str, { outline: 3, ...opts });
}

/** Small helper for the "Press [X]" prompts — glyph drawn in a key cap. */
export function keycap(label, { size = 13, tint = C.gold } = {}) {
  const box = new PIXI.Container();
  const txt = pxText(label, { size, fill: 0x0a0e14, outline: 0, shadow: false, font: FONT_BIG });
  const padX = Math.max(6, size * 0.6), padY = Math.max(3, size * 0.35);
  const w = txt.width + padX * 2, h = txt.height + padY * 2;
  const g = new PIXI.Graphics();
  g.beginFill(tint).drawRoundedRect(0, 0, w, h, 3).endFill();
  g.beginFill(0xffffff, 0.18).drawRoundedRect(1, 1, w - 2, h * 0.45, 2).endFill();
  g.lineStyle(1, 0x000000, 0.55).drawRoundedRect(0.5, 0.5, w - 1, h - 1, 3);
  txt.x = padX; txt.y = padY - 1;
  box.addChild(g, txt);
  box._w = w; box._h = h;
  return box;
}

// ---------------------------------------------------------------- frames
/**
 * Nine-sliced panel using a texture from the manifest. Falls back to a drawn
 * bezel if the texture is missing so menus never disappear.
 */
export function panel({ w = 400, h = 200, tex = null, alpha = 0.93, tint = 0xffffff, inset = 12, glow = 0 } = {}) {
  const c = new PIXI.Container();
  if (tex && tex.baseTexture) {
    const N = new PIXI.NineSlicePlane(tex, 6, 6, 6, 6);
    N.width = w; N.height = h;
    N.tint = tint; N.alpha = alpha;
    c.addChild(N);
  } else {
    const g = new PIXI.Graphics();
    g.beginFill(C.panel, alpha).drawRoundedRect(0, 0, w, h, 4).endFill();
    g.lineStyle(1, C.panelEdge, 0.9).drawRoundedRect(0.5, 0.5, w - 1, h - 1, 4);
    c.addChild(g);
  }
  if (glow) {
    const g2 = new PIXI.Graphics();
    g2.lineStyle(2, glow, 0.5).drawRoundedRect(-1, -1, w + 2, h + 2, 5);
    c.addChild(g2);
  }
  c._inner = { x: inset, y: inset, w: w - inset * 2, h: h - inset * 2 };
  return c;
}

/** Stone-bezel menu box: the ornate pack frame, dark wash, then contents. */
export function menuFrame(w, h, { tex, strong = false } = {}) {
  const root = new PIXI.Container();
  // The pack tile is a warm rust plate. Two passes make it read as cold stone
  // without losing the chiselled bezel: a cold multiply, then a dark body wash
  // inset by the border width so the frame itself stays visible.
  if (tex?.baseTexture) {
    const N = new PIXI.NineSlicePlane(tex, 10, 10, 10, 10);
    N.width = w; N.height = h;
    N.tint = strong ? 0x7d8c9e : 0x6b7889;
    N.alpha = 1;
    root.addChild(N);
  }
  const body = new PIXI.Graphics();
  const B = 7;
  body.beginFill(strong ? 0x0a1018 : 0x080c12, strong ? 0.88 : 0.82);
  body.drawRect(B, B, w - B * 2, h - B * 2);
  body.endFill();
  root.addChild(body);
  if (!tex?.baseTexture) {
    const g = new PIXI.Graphics();
    g.lineStyle(2, C.goldDim, 0.9).drawRect(0, 0, w, h);
    g.lineStyle(1, 0x000, 0.7).drawRect(3, 3, w - 6, h - 6);
    root.addChild(g);
  }
  // inner gold hairline
  const hair = new PIXI.Graphics();
  hair.lineStyle(1, C.gold, 0.28).drawRect(6, 6, w - 12, h - 12);
  root.addChild(hair);
  return root;
}

// ---------------------------------------------------------------- cursor
/** Animated selection marker: a breathing blade + glow. */
export class SelectionCursor extends PIXI.Container {
  constructor(tint = C.gold) {
    super();
    this.g = new PIXI.Graphics();
    this.g.beginFill(tint).moveTo(0, 0).lineTo(14, 7).lineTo(0, 14).closePath().endFill();
    this.g.beginFill(0x000000, 0.5).moveTo(2, 3).lineTo(10, 7).lineTo(2, 11).closePath().endFill();
    this.halo = new PIXI.Graphics();
    this.halo.beginFill(tint, 0.16).drawCircle(6, 7, 15).endFill();
    this.addChild(this.halo, this.g);
    this.t = 0;
  }
  update(dt) {
    this.t += dt;
    const pulse = 0.5 + Math.sin(this.t * 5.2) * 0.5;
    this.halo.alpha = 0.25 + pulse * 0.5;
    this.halo.scale.set(0.9 + pulse * 0.25);
    this.g.x = Math.sin(this.t * 8) * 1.6;
  }
}

// ---------------------------------------------------------------- menu list
/**
 * Vertical action list with keyboard/pad navigation, hover support,
 * per-step animations and confirm/cancel audio.
 */
export class MenuList extends PIXI.Container {
  constructor({ items, width = 340, itemH = 44, font = 16, audio = null, tint = C.gold, onHighlight = null }) {
    super();
    this.items = items;         // [{id, label, sub, disabled, action}]
    this.index = 0;
    this.itemH = itemH;
    this.width = width;
    this.audio = audio;
    this.tint = tint;
    this.onHighlight = onHighlight;
    this.rows = [];
    this.cursor = new SelectionCursor(tint);
    this.cursor.x = 2;
    this.addChild(this.cursor);
    items.forEach((it, i) => this._makeRow(it, i, font));
    this.select(this.firstEnabled(), { silent: true });
  }

  firstEnabled() { return Math.max(0, this.items.findIndex((i) => !i.disabled)); }
  last() { return this.items.length - 1; }

  _makeRow(it, i, font) {
    const row = new PIXI.Container();
    row.y = i * this.itemH;
    const label = pxText(it.label, {
      size: font, font: it.jp ? FONT_JP : FONT_BIG, fill: it.disabled ? 0x4a5158 : C.text,
      outline: 3,
    });
    label.x = 26;
    label.y = (this.itemH - label.height) / 2 + 2;
    const sub = it.sub ? pxText(it.sub, { size: 11, fill: C.textDim, font: FONT_JP, outline: 2 }) : null;
    if (sub) { sub.x = label.x + label.width + 14; sub.y = (this.itemH - sub.height) / 2 + 4; }
    const bar = new PIXI.Graphics();
    bar.beginFill(this.tint, 0.1).drawRect(0, this.itemH * 0.62, this.width, this.itemH * 0.34).endFill();
    bar.alpha = 0;
    row.addChild(bar, label);
    if (sub) row.addChild(sub);
    row.hitArea = new PIXI.Rectangle(0, 0, this.width, this.itemH);
    row.eventMode = 'static';
    row.cursor = 'pointer';
    row.on('pointerover', () => { this.select(i, { hover: true }); });
    row.on('pointerdown', () => { this.select(i, { hover: true }); this.activate(); });
    row._bar = bar;
    row._label = label;
    row._sub = sub;
    this.rows.push(row);
    this.addChild(row);
  }

  select(i, { silent = false, hover = false } = {}) {
    if (i < 0 || i >= this.items.length) return;
    if (i === this.index && !silent) return;
    // skip disabled entries, stepping the way the cursor is travelling
    const step = Math.sign(i - this.index) || 1;
    let guard = 0;
    while (this.items[i]?.disabled && guard++ <= this.items.length) {
      i = (i + step + this.items.length) % this.items.length;
    }
    if (this.items[i]?.disabled) return;
    const prev = this.index;
    this.index = i;
    const dir = Math.sign(i - prev) || 1;
    for (const [k, row] of this.rows.entries()) {
      const on = k === i;
      row._bar.alpha = on ? 1 : 0;
      row._label.tint = on ? 0xffffff : (this.items[k].disabled ? 0x555 : 0xdad4c6);
      row._label.scale.set(on ? 1.004 : 1);
      if (on) {
        row.alpha = 0.6;
        // slide-in ease
        const t0 = performance.now();
        const from = -dir * 10;
        const tick = () => {
          const p = Math.min(1, (performance.now() - t0) / 120);
          row.x = from * (1 - easeOutCubic(p));
          if (p < 1) requestAnimationFrame(tick); else row.x = 0;
        };
        tick();
      }
    }
    this.cursor.y = i * this.itemH + this.itemH / 2 - 7;
    if (!silent && this.audio) this.audio.cue(hover ? 'moveB' : 'move', { volume: 0.5, variation: 0.1 });
    this.onHighlight?.(this.items[i], i);
    return this.items[i];
  }

  move(delta) {
    let i = this.index;
    for (let n = 0; n < this.items.length; n++) {
      i = (i + delta + this.items.length) % this.items.length;
      if (!this.items[i].disabled) break;
    }
    this.select(i);
  }

  activate() {
    const it = this.items[this.index];
    if (!it || it.disabled) { this.audio?.cue('error', { volume: 0.6 }); return; }
    this.audio?.cue('ok', { volume: 0.8 });
    it.action?.(it);
    this.pulse();
  }

  pulse() {
    const row = this.rows[this.index];
    if (!row) return;
    const t0 = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / 180);
      row._label.scale.set(1 + Math.sin(p * Math.PI) * 0.06);
      if (p < 1) requestAnimationFrame(tick); else row._label.scale.set(1);
    };
    tick();
  }

  handle(action) {
    if (action === 'up') { this.move(-1); return true; }
    if (action === 'down') { this.move(1); return true; }
    if (action === 'confirm') { this.activate(); return true; }
    if (action === 'left') { this.onAdjust?.(-1); return true; }
    if (action === 'right') { this.onAdjust?.(1); return true; }
    return false;
  }

  update(dt) { this.cursor.update(dt); }
}

/** Horizontal variant used for the settings sliders / option chips. */
export class OptionRow extends MenuList {
  constructor(opts) {
    super({ ...opts, itemH: opts.itemH || 40 });
  }
}

// ---------------------------------------------------------------- toast
export class ToastStack extends PIXI.Container {
  /**
   * Boxes are laid out with their RIGHT edge on the stack origin, so the stack
   * should be placed at the HUD's right margin. They slide in from off-screen
   * right and stack downward.
   */
  constructor({ audio } = {}) {
    super();
    this.items = [];
    this.audio = audio;
  }
  push(text, { icon = null, tint = C.gold, life = 2.4, sub = '' } = {}) {
    const box = new PIXI.Container();
    const label = outlineText(text, { size: 13, font: FONT_JP, fill: 0xf2ecdd });
    const w = Math.max(150, label.width + (icon ? 44 : 26));
    const bg = new PIXI.Graphics();
    bg.beginFill(0x080b11, 0.88).drawRoundedRect(0, 0, w, 34, 3).endFill();
    bg.lineStyle(1, tint, 0.7).drawRoundedRect(0.5, 0.5, w - 1, 33, 3);
    bg.beginFill(tint, 0.5).drawRect(0, 0, 3, 34).endFill();
    box.addChild(bg);
    let x = 12;
    if (icon) { const s = new PIXI.Sprite(icon); s.width = s.height = 20; s.x = 10; s.y = 7; box.addChild(s); x = 38; }
    label.x = x; label.y = (34 - label.height) / 2 + 1;
    box.addChild(label);
    if (sub) {
      const sb = pxText(sub, { size: 9, font: FONT_JP, fill: 0x8d96a1, outline: 2 });
      sb.x = x; sb.y = 34; box.addChild(sb);
    }
    box.x = -w - 20;
    box._life = life; box._age = 0; box._w = w;
    // start off the right edge, slide in to x = -w
    box.x = w * 0.4 + 40;
    this.addChild(box);
    this.items.push(box);
    this._layout();
    return box;
  }
  _layout() {
    let y = 0;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const b = this.items[i];
      b._targetY = y;
      y += 40;
    }
  }
  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const b = this.items[i];
      b._age += dt;
      const inP = Math.min(1, b._age / 0.28);
      const outP = b._age > b._life ? Math.min(1, (b._age - b._life) / 0.3) : 0;
      const rest = -b._w;
      const tx = rest + (1 - easeOutBack(inP)) * (b._w + 60) + outP * (b._w + 80);
      b.x += (tx - b.x) * Math.min(1, dt * 16);
      b.y += ((b._targetY || 0) - b.y) * Math.min(1, dt * 10);
      b.alpha = 1 - outP;
      if (outP >= 1) {
        this.items.splice(i, 1);
        this.removeChild(b);
        b.destroy({ children: true });
        this._layout();
      }
    }
  }
}

// ---------------------------------------------------------------- dialogue
/**
 * Bottom-of-screen message window with a name plate and typewriter reveal.
 * This is the ONLY place long sentences appear — nothing is dumped on screen.
 */
export class DialogueWindow extends PIXI.Container {
  constructor({ width = 980, audio = null, tex = null } = {}) {
    super();
    this.width = width;
    this.height = 150;
    this.audio = audio;
    this.frame = menuFrame(width, this.height, { tex });
    this.frame.x = 0; this.frame.y = 0;
    this.addChild(this.frame);

    this.namePlate = new PIXI.Container();
    const plate = menuFrame(210, 34, { tex, strong: true });
    this.nameText = outlineText('', { size: 13, font: FONT_JP_HEAVY, fill: C.gold });
    this.nameText.x = 14; this.nameText.y = 7;
    this.namePlate.addChild(plate, this.nameText);
    this.namePlate.y = -32;
    this.addChild(this.namePlate);

    this.body = pxText('', { size: 15, font: FONT_JP, fill: 0xeae4d6, outline: 2, shadow: true });
    this.body.x = 26; this.body.y = 26;
    this.body.style.wordWrap = true;
    this.body.style.wordWrapWidth = width - 60;
    this.body.style.lineHeight = 26;
    this.addChild(this.body);

    this.portrait = new PIXI.Sprite(PIXI.Texture.WHITE);
    this.portrait.width = 116; this.portrait.height = 116;
    this.portrait.x = width - 132; this.portrait.y = 17;
    this.portrait.visible = false;
    this.addChild(this.portrait);
    this.portraitFrame = new PIXI.Graphics();
    this.portraitFrame.lineStyle(1, C.gold, 0.55).drawRect(width - 133, 16, 118, 118);
    this.portraitFrame.visible = false;
    this.addChild(this.portraitFrame);

    this.prompt = outlineText('[ENTER]', { size: 9, font: FONT_BIG, fill: C.gold });
    this.prompt.x = width - 150; this.prompt.y = this.height - 26;
    this.prompt.visible = false;
    this.addChild(this.prompt);

    this.full = '';
    this.shown = 0;
    this.cps = 42;
    this.t = 0;
    this.typing = false;
    this.alpha = 0;
    this.visible = false;
  }

  show({ name = '', text = '', portrait = null, tintName = C.gold } = {}) {
    this.visible = true;
    this.namePlate.visible = !!name;
    this.nameText.text = name;
    this.nameText.style.fill = tintName;
    this.full = text;
    this.shown = 0;
    this.t = 0;
    this.typing = true;
    this.prompt.visible = false;
    this.body.text = '';
    if (portrait) {
      this.portrait.texture = portrait;
      this.portrait.visible = true;
      this.portraitFrame.visible = true;
      // tint the portrait frame with the theme
      this.body.style.wordWrapWidth = this.width - 200;
    } else {
      this.portrait.visible = false;
      this.portraitFrame.visible = false;
      this.body.style.wordWrapWidth = this.width - 60;
    }
    this._fadeTo(1);
    return this;
  }

  hide() { this._fadeTo(0, () => { this.visible = false; }); }

  advance() {
    if (!this.visible) return true;
    if (this.typing) { this.shown = this.full.length; this._commit(); return false; }
    return true;   // caller can move to the next line
  }

  _commit() {
    this.body.text = this.full;
    this.typing = false;
    this.prompt.visible = true;
  }

  _fadeTo(v, done) {
    if (this._destroyed) return;
    const t0 = performance.now();
    const from = this.alpha;
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / 180);
      this.alpha = from + (v - from) * p;
      if (p < 1) requestAnimationFrame(tick); else done?.();
    };
    tick();
  }

  update(dt) {
    if (!this.visible) return;
    this.t += dt;
    if (this.typing) {
      const want = Math.floor(this.t * this.cps);
      if (want > this.shown) {
        const prev = this.shown;
        this.shown = Math.min(this.full.length, want);
        this.body.text = this.full.slice(0, this.shown);
        if (Math.floor(this.shown / 3) !== Math.floor(prev / 3)) {
          this.audio?.cue('blip', { volume: 0.12, variation: 0.35 });
        }
        if (this.shown >= this.full.length) this._commit();
      }
    } else {
      this.prompt.alpha = 0.45 + Math.sin(this.t * 6) * 0.45;
    }
  }
}

// ---------------------------------------------------------------- helpers
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t) => t * t * t;
export const easeOutBack = (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
export const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const approach = (cur, target, rate) => cur + (target - cur) * rate;
export const pad2 = (n) => String(Math.floor(n)).padStart(2, '0');
