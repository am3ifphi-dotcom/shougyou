/**
 * Message window: name plate + typewriter body, anchored to the bottom edge.
 * Used for the intro and the boss encounter line.
 */
import { Container, Graphics } from 'pixi.js';
import { VIEW_W, VIEW_H } from '../core/app.js';
import { panel } from './widgets.js';
import { COLORS, text } from './type.js';
import { playSfx } from '../core/audio.js';

export class DialogueBox extends Container {
  constructor() {
    super();
    this.visible = false;
    this.w = 380;
    this.h = 58;
    this.x = (VIEW_W - this.w) / 2;
    this.y = VIEW_H - this.h - 16;

    const fill = new Graphics();
    fill.roundRect(0, 0, this.w, this.h, 4).fill({ color: 0x120e14, alpha: 0.96 });
    this.addChild(fill);
    this.bg = panel(this.w, this.h, { id: 'ui_panel', alpha: 0.4 });
    this.addChild(this.bg);
    this.inner = panel(this.w - 8, this.h - 8, { id: 'ui_panel_inset', inset: true, alpha: 0.5 });
    this.inner.x = 4;
    this.inner.y = 4;
    this.addChild(this.inner);

    this.namePlate = panel(96, 17, { id: 'ui_panel_inset', inset: true, alpha: 0.95 });
    this.namePlate.x = 10;
    this.namePlate.y = -8;
    this.addChild(this.namePlate);

    this.nameTxt = text('', { size: 10, font: 'pixel', fill: COLORS.gold });
    this.nameTxt.x = 16;
    this.nameTxt.y = -4;
    this.addChild(this.nameTxt);

    this.body = text('', { size: 12, font: 'body', fill: COLORS.bone, wordWrap: true, wrapWidth: this.w - 28, lineHeight: 16 });
    this.body.x = 14;
    this.body.y = 16;
    this.addChild(this.body);

    this.arrow = text('▼', { size: 9, font: 'pixel', fill: COLORS.gold, anchor: 0.5 });
    this.arrow.x = this.w - 14;
    this.arrow.y = this.h - 12;
    this.addChild(this.arrow);

    this.full = '';
    this.shownChars = 0;
    this.speed = 46; // chars / second
    this.animT = 0;
  }

  say(name, body, { autoHide = 0 } = {}) {
    this.visible = true;
    this.nameTxt.text = name;
    this.full = body;
    this.shownChars = 0;
    this.body.text = '';
    this.autoHide = autoHide;
    this.animT = 0;
    this.y = VIEW_H - this.h - 8;
    this.targetY = VIEW_H - this.h - 16;
  }

  get finished() {
    return this.shownChars >= this.full.length;
  }

  update(dtMs) {
    if (!this.visible || this.destroyed) return;
    this.animT += dtMs;
    this.y += (this.targetY - this.y) * Math.min(1, dtMs * 0.012);
    if (!this.finished) {
      const before = this.shownChars;
      this.shownChars = Math.min(this.full.length, this.shownChars + (this.speed * dtMs) / 1000);
      if (Math.floor(this.shownChars) !== Math.floor(before)) {
        const ch = this.full[Math.floor(this.shownChars)];
        if (ch && ch !== ' ' && Math.random() < 0.55) playSfx('se_step', { volume: 0.08, pitchJitter: 0.05 });
      }
      this.body.text = this.full.slice(0, Math.floor(this.shownChars));
    }
    this.arrow.alpha = 0.4 + Math.abs(Math.sin(this.animT * 0.005)) * 0.6;
    if (this.autoHide && this.finished && this.animT > this.autoHide) this.hide();
  }

  skip() {
    if (!this.finished) {
      this.shownChars = this.full.length;
      this.body.text = this.full;
      return false;
    }
    return true;
  }

  hide() {
    this.visible = false;
  }
}

export class Banner extends Container {
  constructor() {
    super();
    this.visible = false;
    // sits clear of the vitals block and the objective line above it
    this.x = VIEW_W / 2;
    this.y = 74;
    this.band = new Graphics();
    this.addChild(this.band);
    this.title = text('', { size: 20, font: 'title', fill: COLORS.gold, anchor: 0.5, letterSpacing: 3, stroke: 0x0b0810, strokeWidth: 3 });
    this.addChild(this.title);
    this.sub = text('', { size: 8, font: 'pixel', fill: COLORS.boneDim, anchor: 0.5, letterSpacing: 2 });
    this.sub.y = 16;
    this.addChild(this.sub);
    this.t = 0;
  }

  show(title, sub = '', ms = 2200) {
    this.visible = true;
    this.title.text = title;
    this.sub.text = sub;
    this.t = 0;
    this.duration = ms;
    this.band.clear();
    const w = Math.max(180, title.width + 80);
    this.band.rect(-w / 2, -18, w, 44).fill({ color: 0x05040a, alpha: 0.62 });
    this.band.rect(-w / 2, -18, w, 1).fill({ color: 0xe8b650, alpha: 0.6 });
    this.band.rect(-w / 2, 25, w, 1).fill({ color: 0xe8b650, alpha: 0.6 });
  }

  update(dtMs) {
    if (!this.visible || this.destroyed) return;
    this.t += dtMs;
    const k = this.t / this.duration;
    this.alpha = k < 0.12 ? k / 0.12 : k > 0.82 ? (1 - k) / 0.18 : 1;
    this.title.y = Math.sin(this.t * 0.003) * 1.2;
    if (k >= 1) this.visible = false;
  }
}
