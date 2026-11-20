/**
 * Widgets.
 *
 * Deliberately small set built from the fetched Kenney 9-slice panels plus a
 * few procedural pieces (bars, highlights, gauges).  Everything here is
 * keyboard/pointer agnostic: the owning screen moves a `focus` index and the
 * widgets just render it.
 */
import { Container, Graphics, NineSliceSprite, Sprite } from 'pixi.js';
import { get, sliceInfo } from '../core/textures.js';
import { COLORS, text } from './type.js';
import { Tween } from '../core/transitions.js';

/* ------------------------------------------------------------------ */
/* Panel: nine-slice window                                            */
/* ------------------------------------------------------------------ */
export function panel(w, h, { id = 'ui_panel', tint = 0xffffff, inset = false, alpha = 1 } = {}) {
  const { texture, slice } = sliceInfo(id);
  const s = new NineSliceSprite({
    texture,
    leftWidth: slice,
    topHeight: slice,
    rightWidth: slice,
    bottomHeight: slice,
    width: w,
    height: h,
  });
  // keep the original illustration; only nudge the recessed variant darker
  s.tint = inset ? 0xd8c8b4 : tint;
  s.alpha = alpha;
  return s;
}

/**
 * HUD plate: the fetched inset panel is a frame with a transparent centre, so
 * HUD blocks get a drawn backing first and the parchment frame on top for the
 * hand-painted texture.
 */
export function hudPlate(w, h, { fill = 0x140f18, fillAlpha = 0.82, border = 0x8a6a44 } = {}) {
  const c = new Container();
  const g = new Graphics();
  g.roundRect(0, 0, w, h, 3).fill({ color: fill, alpha: fillAlpha });
  g.roundRect(0.5, 0.5, w - 1, h - 1, 3).stroke({ width: 1, color: border, alpha: 0.95 });
  g.roundRect(3.5, 3.5, w - 7, h - 7, 2).stroke({ width: 0.6, color: border, alpha: 0.35 });
  // corner rivets
  for (const [x, y] of [[4, 4], [w - 4, 4], [4, h - 4], [w - 4, h - 4]]) {
    g.circle(x, y, 0.9).fill({ color: 0xe8b650, alpha: 0.55 });
  }
  c.addChild(g);
  return c;
}

/* ------------------------------------------------------------------ */
/* Stat bar with delayed "ghost" damage trail                          */
/* ------------------------------------------------------------------ */
export class StatBar extends Container {
  constructor({ width = 92, height = 10, fillTex = 'ui_bar_red', fillTint = 0xffffff, ghostColor = 0xf0d0a0, label = '' } = {}) {
    super();
    this.w = width;
    this.h = height;
    this.value = 1;
    this.display = 1;
    this.ghost = 1;
    this.ghostDelay = 0;

    // A hand-drawn trough reads better at this size than the nine-slice bar,
    // and it lets the ghost trail sit behind the fill without seams.
    this.track = new Container();
    const trough = new Graphics();
    trough.roundRect(0, 0, width, height, 2).fill({ color: 0x0c0910, alpha: 0.92 });
    trough.roundRect(0.5, 0.5, width - 1, height - 1, 2).stroke({ width: 1, color: 0x6b4a2a, alpha: 0.9 });
    this.track.addChild(trough);
    this.addChild(this.track);

    this.ghostBar = new Sprite(get(fillTex));
    this.ghostBar.tint = ghostColor;
    this.ghostBar.alpha = 0.55;
    this.ghostBar.x = 2;
    this.ghostBar.y = 2;
    this.addChild(this.ghostBar);

    this.fill = new Sprite(get(fillTex));
    this.fill.tint = fillTint;
    this.fill.x = 2;
    this.fill.y = 2;
    this.addChild(this.fill);

    this.shine = new Sprite(get(fillTex));
    this.shine.tint = 0xffffff;
    this.shine.alpha = 0.22;
    this.shine.x = 2;
    this.shine.y = 2;
    this.addChild(this.shine);

    // no built-in readout: the owning HUD places its numbers explicitly so
    // sub-pixel font metrics never shift them around

    this.apply();
  }

  setValue(v, { instant = false } = {}) {
    const next = Math.max(0, Math.min(1, v));
    if (next < this.value) this.ghostDelay = 420;
    this.value = next;
    if (instant) {
      this.display = next;
      this.ghost = next;
    }
    this.apply();
  }


  update(dtMs) {
    // the white "ghost" lag bar drains behind the real value
    if (this.ghostDelay > 0) this.ghostDelay -= dtMs;
    else if (this.ghost > this.value) this.ghost = Math.max(this.value, this.ghost - dtMs * 0.0011);

    if (this.display !== this.value) {
      const speed = 0.006 * dtMs;
      this.display += (this.value - this.display) * Math.min(1, speed);
      if (Math.abs(this.display - this.value) < 0.002) this.display = this.value;
    }
    this.apply();
  }

  apply() {
    const innerW = this.w - 4;
    const innerH = this.h - 4;
    const fw = Math.max(0, innerW * this.display);
    this.fill.width = fw;
    this.fill.height = innerH;
    this.shine.width = fw;
    this.shine.height = Math.max(1, innerH * 0.4);
    this.shine.visible = fw > 2;
    this.ghostBar.width = Math.max(0, innerW * this.ghost);
    this.ghostBar.height = innerH;
    this.ghostBar.visible = this.ghost > this.display + 0.001;
  }
}

/* ------------------------------------------------------------------ */
/* Menu list with sword cursor + focus animation                       */
/* ------------------------------------------------------------------ */
export class MenuList extends Container {
  constructor(items, { x = 0, y = 0, gap = 26, size = 17, width = 0, align = 0, onMove = null } = {}) {
    super();
    this.items = items; // [{ label, enabled, hint }]
    this.index = 0;
    this.rows = [];
    this.gap = gap;
    this.align = align;
    this.onMove = onMove;

    this.cursor = new Sprite(get('ui_cursor'));
    this.cursor.anchor.set(0.5);
    this.cursor.width = 11;
    this.cursor.height = 11;
    this.cursor.visible = false;
    this.addChild(this.cursor);

    items.forEach((item, i) => {
      const row = new Container();
      row.y = i * gap;
      const label = text(item.label, {
        size,
        font: 'body',
        fill: item.enabled === false ? COLORS.disabled : COLORS.bone,
        letterSpacing: 2,
        anchor: align,
      });
      // align 0.5 means "centre this row on the container origin", so the
      // caller can park one menu at any anchor without extra offsets
      label.x = 0;
      row.addChild(label);
      row.label = label;
      const plate = new NineSliceSprite({
        texture: get('ui_button'),
        leftWidth: 14,
        rightWidth: 14,
        topHeight: 12,
        bottomHeight: 12,
        width: Math.max(120, label.width + 44),
        height: gap - 4,
      });
      plate.tint = 0x8a6a44;
      plate.alpha = 0;
      plate.x = align === 0.5 ? -plate.width / 2 : -22;
      plate.y = -Math.round((gap - 4) / 2) + Math.round(size / 2) - 2;
      row.addChildAt(plate, 0);
      row.plate = plate;
      this.addChild(row);
      this.rows.push(row);
    });
    this.x = x;
    this.y = y;
    this.boxWidth = width; // NB: never assign Container.width, it scales the node
    this.select(0, { silent: true });
  }

  get active() {
    return this.items[this.index];
  }

  select(i, { silent = false } = {}) {
    const n = this.items.length;
    this.index = ((i % n) + n) % n;
    this.rows.forEach((row, idx) => {
      const on = idx === this.index;
      row.label.alpha = on ? 1 : 0.72;
      row.label.style.fill = row.label.style.fill;
      if (!silent) {
        row.plate.alpha = on ? 0.28 : 0;
      } else {
        row.plate.alpha = on ? 0.28 : 0;
      }
      row.scale.set(1);
    });
    this._placeCursor();
    if (!silent) this.onMove?.(this.index, this.active);
  }

  _placeCursor() {
    const row = this.rows[this.index];
    if (!row) return;
    this.cursor.visible = true;
    this.cursor.x = this.align === 0.5 ? -(row.plate.width / 2) - 11 : -28;
    this.cursor.y = row.y + 6;
    this.cursorT = 0;
  }

  move(dir) {
    let next = this.index;
    for (let i = 1; i <= this.items.length; i++) {
      next = (this.index + dir * i + this.items.length * 2) % this.items.length;
      if (this.items[next].enabled !== false) break;
    }
    if (next !== this.index) this.select(next);
    return next !== this.index;
  }

  update(dtMs) {
    this.cursorT = (this.cursorT || 0) + dtMs;
    const row = this.rows[this.index];
    if (row) {
      this.cursor.y = row.y + 5 + Math.sin(this.cursorT * 0.006) * 1.4;
      this.cursor.rotation = Math.sin(this.cursorT * 0.004) * 0.06;
      const targetScale = 1.06;
      row.label.scale.x += (targetScale - row.label.scale.x) * Math.min(1, dtMs * 0.02);
      row.label.scale.y = row.label.scale.x;
      row.plate.alpha += ((0.32 + Math.sin(this.cursorT * 0.005) * 0.06) - row.plate.alpha) * Math.min(1, dtMs * 0.01);
    }
  }
}

/* ------------------------------------------------------------------ */
/* Horizontal slider                                                   */
/* ------------------------------------------------------------------ */
/** Small framed control glyph used in the HUD slot row. */
export function glyphCap(label, { w = 0 } = {}) {
  const c = new Container();
  const width = w || Math.max(10, label.length * 4.6 + 5);
  const g = new Graphics();
  g.roundRect(0, 0, width, 9, 1.5).fill({ color: 0x1b1620, alpha: 0.85 }).stroke({ width: 0.8, color: 0x8a6a44, alpha: 0.9 });
  c.addChild(g);
  const t = text(label, { size: 6, font: 'pixel', fill: COLORS.bone });
  t.x = width / 2;
  t.y = 1.5;
  t.anchor.set(0.5, 0);
  c.addChild(t);
  c.capWidth = width;
  return c;
}

/**
 * Volume row: label on the left, a ticked track in the middle, the numeric
 * value on the right. Both the label and the value live inside the same row so
 * a focused slider never collides with its neighbours.
 */
export class Slider extends Container {
  constructor({ width = 150, label = 'VOLUME', value = 0.5, onChange = null } = {}) {
    super();
    this.w = width;
    this.value = value;
    this.onChange = onChange;
    this.focused = false;
    this.t = 0;

    this.title = text(label, { size: 9, font: 'pixel', fill: COLORS.boneDim, letterSpacing: 2 });
    this.title.y = 1;
    this.addChild(this.title);

    this.trackX = 92;
    this.track = new Graphics();
    this.addChild(this.track);

    this.readout = text('', { size: 10, font: 'pixel', fill: COLORS.gold, anchorX: 1 });
    this.readout.x = this.trackX + this.w + 30;
    this.addChild(this.readout);

    this.marker = new Sprite(get('ui_cursor'));
    this.marker.anchor.set(0.5);
    this.marker.width = 10;
    this.marker.height = 10;
    this.marker.y = 12;
    this.marker.visible = false;
    this.addChild(this.marker);

    this.ticks = 11;
    this.trackY = 6;
    this.draw();
  }

  draw() {
    this.track.clear();
    const y = this.trackY;
    const x0 = this.trackX;
    const w = this.w;
    this.track.rect(x0 - 2, y + 4, w + 4, 1).fill({ color: 0x3a2c1e, alpha: 0.9 });
    for (let i = 0; i < this.ticks; i++) {
      const t = i / (this.ticks - 1);
      const x = x0 + t * w;
      const on = t <= this.value + 0.001;
      const edge = i === 0 || i === this.ticks - 1;
      this.track.rect(x - (edge ? 1.5 : 1), y, edge ? 3 : 2, 10).fill(on ? COLORS.gold : 0x3a3245);
    }
    this.readout.text = `${Math.round(this.value * 100)}`;
    this.marker.x = x0 + this.value * w;
    if (this.readoutRight) this.readout.x = x0 + this.readoutRight;
  }

  setValue(v) {
    this.value = Math.max(0, Math.min(1, v));
    this.draw();
    this.onChange?.(this.value);
  }

  nudge(d) {
    this.setValue(Math.round((this.value + d) * 20) / 20);
  }

  setFocused(on) {
    this.focused = on;
    this.marker.visible = on;
    this.title.style.fill = on ? COLORS.gold : COLORS.boneDim;
    this.readout.style.fill = on ? COLORS.bone : COLORS.gold;
  }

  update(dtMs) {
    if (!this.focused) return;
    this.t += dtMs;
    this.marker.y = 12 + Math.sin(this.t * 0.006) * 1.4;
  }
}

/** Hairline rule used to separate menu sections. */
export function divider(width) {
  const g = new Graphics();
  g.rect(0, 0, width, 1).fill(0x4a3a2a);
  g.rect(0, 2, width, 1).fill(0x241c14);
  return g;
}

/** Eased number lerp helper used by HUD counters and camera. */
export function ease(current, target, dtMs, rate = 0.012) {
  return current + (target - current) * Math.min(1, dtMs * rate);
}
