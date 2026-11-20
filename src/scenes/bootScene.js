/**
 * Studio card.  A rune-circle draws itself, the studio name is carved in, then
 * the whole card burns away.  Skips on any input.
 */
import { Container, Graphics, Sprite } from 'pixi.js';
import { VIEW_W, VIEW_H } from '../core/app.js';
import { COLORS, text } from '../ui/type.js';
import { glowTexture } from '../core/procedural.js';
import { Tween } from '../core/transitions.js';

export class BootScene {
  constructor({ onDone }) {
    this.node = new Container();
    this.onDone = onDone;
    this.t = 0;
    this.done = false;

    this.bg = new Graphics();
    this.bg.rect(0, 0, VIEW_W, VIEW_H).fill(0x050409);
    this.node.addChild(this.bg);

    this.glow = new Sprite(glowTexture(256, '120,90,180'));
    this.glow.anchor.set(0.5);
    this.glow.x = VIEW_W / 2;
    this.glow.y = VIEW_H / 2;
    this.glow.alpha = 0;
    this.glow.scale.set(1.6);
    this.node.addChild(this.glow);

    this.rune = new Graphics();
    this.rune.x = VIEW_W / 2;
    this.rune.y = VIEW_H / 2 - 6;
    this.node.addChild(this.rune);

    this.name = text('HOLLOW LANTERN', {
      size: 30,
      font: 'title',
      fill: COLORS.gold,
      align: 'center',
      anchor: 0.5,
      letterSpacing: 5,
      stroke: 0x000000,
      strokeWidth: 3,
    });
    this.name.x = VIEW_W / 2;
    this.name.y = VIEW_H / 2 + 34;
    this.name.alpha = 0;
    this.node.addChild(this.name);

    this.tag = text('studio', {
      size: 10,
      font: 'body',
      fill: COLORS.boneDim,
      align: 'center',
      anchor: 0.5,
      letterSpacing: 6,
    });
    this.tag.x = VIEW_W / 2;
    this.tag.y = VIEW_H / 2 + 52;
    this.tag.alpha = 0;
    this.node.addChild(this.tag);

    this.skip = text('press any key', { size: 8, font: 'pixel', fill: 0x4a4152, anchor: 0.5 });
    this.skip.x = VIEW_W / 2;
    this.skip.y = VIEW_H - 22;
    this.node.addChild(this.skip);
  }

  update(dtMs) {
    this.t += dtMs;
    const k = Math.min(1, this.t / 2200);
    this.rune.clear();
    const R = 34;
    for (let i = 0; i < 3; i++) {
      const r = R - i * 7;
      const sweep = Tween.out(Math.min(1, k * (1.4 + i * 0.4)));
      this.rune
        .arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * sweep)
        .stroke({ width: i === 0 ? 1.4 : 0.8, color: i === 1 ? 0xc3aaff : 0xc9a06a, alpha: 0.35 + 0.55 * (1 - i * 0.3) });
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + this.t * 0.0006;
      const rr = R - 3.5;
      this.rune
        .moveTo(Math.cos(a) * rr, Math.sin(a) * rr)
        .lineTo(Math.cos(a) * (rr + 4), Math.sin(a) * (rr + 4))
        .stroke({ width: 1, color: 0xe8b650, alpha: 0.55 * Math.min(1, k * 2) });
    }
    this.glow.alpha = 0.35 * Math.min(1, k * 1.5) * (0.8 + Math.sin(this.t * 0.004) * 0.2);
    this.name.alpha = Math.max(0, Math.min(1, (this.t - 700) / 700));
    this.tag.alpha = Math.max(0, Math.min(1, (this.t - 1200) / 700));
    this.skip.alpha = 0.25 + Math.sin(this.t * 0.005) * 0.12;

    if (this.t > 3400 && !this.done) this.finish();
  }

  onInput(input) {
    if (input.anyPressed || input.pointer.clicked) this.finish();
  }

  finish() {
    if (this.done) return;
    this.done = true;
    this.onDone?.();
  }
}
