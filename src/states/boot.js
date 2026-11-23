// 起動ロゴ — a studio sting, then it hands over to the loader.
import * as UI from '../ui.js';

export class BootState {
  constructor(ctx) { Object.assign(this, ctx); }

  enter() {
    const root = this.root = new PIXI.Container();
    this.ui.addChild(root);

    const mark = new PIXI.Container();
    const ember = new PIXI.Graphics();
    ember.beginFill(0xd7b169, 0.14).drawCircle(0, 0, 74).endFill();
    ember.beginFill(0xd7b169, 0.25).drawCircle(0, 0, 42).endFill();
    mark.addChild(ember);

    const glyph = UI.outlineText('本', { size: 60, font: UI.FONT_JP_HEAVY, fill: 0x10151c, outline: 0, shadow: false });
    glyph.anchor.set(0.5);
    const halo = UI.outlineText('本', { size: 60, font: UI.FONT_JP_HEAVY, fill: 0xd7b169, outline: 4 });
    halo.anchor.set(0.5);
    mark.addChild(halo, glyph);
    mark.x = UI.W / 2; mark.y = UI.H / 2 - 26;
    root.addChild(mark);
    this.mark = mark;

    const tag = UI.pxText('ARENA  WORKS', { size: 9, font: UI.FONT_BIG, fill: 0x8a919b, outline: 2 });
    tag.anchor.set(0.5);
    tag.x = UI.W / 2; tag.y = UI.H / 2 + 66;
    root.addChild(tag);
    this.tag = tag;

    const note = UI.pxText('a one-person arcade studio', { size: 10, fill: 0x4d545d, outline: 2 });
    note.anchor.set(0.5);
    note.x = UI.W / 2; note.y = UI.H / 2 + 92;
    root.addChild(note);
    this.note = note;

    this.t = 0;
    this.done = false;
    this.root.alpha = 0;
    this.mark.scale.set(0.86);
    this.tag.alpha = 0;
    this.note.alpha = 0;

    // faint drifting dust so the logo frame is never static
    this.dust = [];
    const dustLayer = new PIXI.Graphics();
    dustLayer.beginFill(0xd7b169, 0.5);
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * UI.W, y = Math.random() * UI.H;
      dustLayer.drawRect(x, y, 2, 2);
      this.dust.push({ x, y, v: 6 + Math.random() * 16, a: 0.05 + Math.random() * 0.25 });
    }
    dustLayer.alpha = 0.5;
    this.ui.addChildAt(dustLayer, 0);
    this.dustLayer = dustLayer;
    this.skip = false;
    const off = this.input.on('confirm', () => { this.skip = true; });
    this.input.on('back', () => { this.skip = true; });
    this._off = off;
  }

  update(dt) {
    this.t += dt;
    const t = this.t;
    this.root.alpha = Math.min(1, t / 0.35);
    this.mark.scale.set(0.86 + UI.easeOutBack(Math.min(1, t / 0.9)) * 0.14);
    this.mark.rotation = Math.sin(t * 0.6) * 0.01;
    this.tag.alpha = Math.min(1, Math.max(0, (t - 0.5) / 0.5));
    this.note.alpha = Math.min(1, Math.max(0, (t - 0.9) / 0.5));
    this.dustLayer.y = -((t * 9) % UI.H);
    if ((t > 2.4 || this.skip) && !this.done) {
      this.done = true;
      this.root.alpha = 1;
      const from = 1;
      const t0 = performance.now();
      const fade = () => {
        const p = Math.min(1, (performance.now() - t0) / 420);
        this.root.alpha = from * (1 - p);
        if (p < 1) requestAnimationFrame(fade);
        else this.game.goto('loading');
      };
      fade();
    }
  }

  exit() { this._off?.(); this.root?.destroy({ children: true }); }
}
