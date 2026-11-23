// ---------------------------------------------------------------------------
//  難易度選択 — an arcade "how hard do you want it" band, not three cards.
//  One name fills the frame; ←/→ tilts through the dials and the stats react
//  immediately so the choice is felt, not read.
// ---------------------------------------------------------------------------
import * as UI from '../ui.js';
import { DIFFICULTY } from '../game/content.js';

const KEYS = Object.keys(DIFFICULTY);

export class MenuState {
  constructor(ctx) { Object.assign(this, ctx); }

  enter() {
    this.t = 0;
    this.index = 1;                        // 常連 by default
    const root = this.root = new PIXI.Container();
    this.ui.addChild(root);

    // ---- backdrop
    this.par = [];
    for (const [id, tint, a, speed] of [['bg_layer_cave_far', 0x2c3f52, 0.75, 7], ['bg_layer_cave', 0x162432, 0.9, 18]]) {
      const tex = this.registry.textures.get(id);
      if (!tex) continue;
      const c = new PIXI.Container();
      for (let i = 0; i < 2; i++) {
        const s = new PIXI.Sprite(tex);
        s.width = UI.W * 1.5; s.height = UI.H * 1.5;
        s.y = (UI.H - s.height) / 2; s.x = i * s.width;
        s.tint = tint; s.alpha = a;
        c.addChild(s);
      }
      c._speed = speed;
      root.addChild(c);
      this.par.push(c);
    }
    const wash = new PIXI.Graphics();
    wash.beginFill(0x05080c, 0.7).drawRect(0, 0, UI.W, UI.H).endFill();
    root.addChild(wash);

    // ---- a horizontal rule and the section label, arcade attract style
    const kicker = UI.pxText('難 易 度', { size: 11, fill: 0x8d96a1, outline: 2 });
    kicker.x = UI.SAFE + 8; kicker.y = 96;
    root.addChild(kicker);
    const rule = new PIXI.Graphics();
    rule.beginFill(0xd7b169, 0.3).drawRect(UI.SAFE + 8, 122, UI.W - UI.SAFE * 2 - 16, 1).endFill();
    root.addChild(rule);

    // ---- the big name, tinted per difficulty and cross-faded on change
    this.nameBig = UI.pxText('', { size: 62, font: UI.FONT_JP_HEAVY, fill: 0xe8d3a8, outline: 8 });
    this.nameBig.anchor.set(0.5, 0);
    this.nameBig.x = UI.W / 2; this.nameBig.y = 146;
    root.addChild(this.nameBig);

    this.nameEn = UI.pxText('', { size: 14, font: UI.FONT_BIG, fill: 0x8d96a1, outline: 3 });
    this.nameEn.anchor.set(0.5, 0);
    this.nameEn.x = UI.W / 2; this.nameEn.y = 228;
    root.addChild(this.nameEn);

    this.tag = UI.pxText('', { size: 12, fill: 0xb9a06a, outline: 3 });
    this.tag.anchor.set(0.5, 0);
    this.tag.x = UI.W / 2; this.tag.y = 256;
    root.addChild(this.tag);

    // ---- description: two short lines in a quiet voice
    this.desc = UI.pxText('', { size: 13, fill: 0xa9a294, outline: 3, align: 'center', shadow: true });
    this.desc.anchor.set(0.5, 0);
    this.desc.x = UI.W / 2; this.desc.y = 300;
    this.desc.style.wordWrap = true;
    this.desc.style.wordWrapWidth = 720;
    this.desc.style.breakWords = true;
    this.desc.style.lineHeight = 26;
    root.addChild(this.desc);

    // ---- stat meters: three horizontal gauges with labels on the left
    this.meters = [];
    const defs = [['敵圧', 'ENEMY PRESSURE'], ['耐久', 'PLAYER MARGIN'], ['報酬', 'SCORE PAYOUT']];
    defs.forEach(([jp, en], i) => {
      const y = 388 + i * 46;
      const c = new PIXI.Container();
      c.x = UI.W / 2 - 300; c.y = y;
      const l = UI.pxText(jp, { size: 11, fill: 0xb8b2a4, outline: 2 });
      l.x = 0; l.y = 0;
      const e = UI.pxText(en, { size: 7, font: UI.FONT_BIG, fill: 0x5b636d, outline: 2 });
      e.x = 52; e.y = 3;
      const bg = new PIXI.Graphics();
      bg.beginFill(0x05070a, 0.95).drawRect(200, 1, 320, 12).endFill();
      bg.lineStyle(1, 0x333d48, 1).drawRect(200.5, 1.5, 319, 11);
      // segment ticks — same language as the HP bar
      for (let k = 1; k < 10; k++) bg.beginFill(0x000000, 0.55).drawRect(200 + 32 * k, 1, 1, 12).endFill();
      const fill = new PIXI.Graphics();
      c.addChild(l, e, bg, fill);
      root.addChild(c);
      this.meters.push({ c, fill });
    });

    // ---- side arrows
    this.arrowL = UI.pxText('◀', { size: 28, fill: 0xd7b169, outline: 4 });
    this.arrowL.anchor.set(0.5); this.arrowL.x = UI.W * 0.16; this.arrowL.y = 200;
    this.arrowR = UI.pxText('▶', { size: 28, fill: 0xd7b169, outline: 4 });
    this.arrowR.anchor.set(0.5); this.arrowR.x = UI.W * 0.84; this.arrowR.y = 200;
    root.addChild(this.arrowL, this.arrowR);

    // ---- progress pips, bottom centre of the band
    this.pips = new PIXI.Graphics();
    root.addChild(this.pips);

    // ---- prompts
    this.prompt = UI.pxText(`[${this.input.label('left')}] [${this.input.label('right')}] 選択    [${this.input.label('confirm')}] 決定    [${this.input.label('back')}] タイトル`,
      { size: 10, fill: 0x8d96a1, outline: 2 });
    this.prompt.anchor.set(0.5, 0);
    this.prompt.x = UI.W / 2; this.prompt.y = UI.H - UI.SAFE - 30;
    root.addChild(this.prompt);

    // ---- a vignette so the text has somewhere to sit
    const vig = new PIXI.Graphics();
    for (let i = 0; i < 40; i++) {
      vig.beginFill(0x04060a, (i / 40) * 0.6).drawRect(0, i * 2, UI.W, 2).endFill();
      vig.beginFill(0x04060a, (i / 40) * 0.6).drawRect(0, UI.H - i * 2 - 2, UI.W, 2).endFill();
    }
    root.addChild(vig);

    this._paint(true);

    this._offs = [
      this.input.on('left', () => this._move(-1)),
      this.input.on('right', () => this._move(1)),
      this.input.on('up', () => this._move(-1)),
      this.input.on('down', () => this._move(1)),
      this.input.on('confirm', () => this._start()),
      this.input.onCancel(() => { this.audio.cue('back'); this.game.goto('title'); }),
      this.input.on('devicechange', () => {
        this.prompt.text = `[${this.input.label('left')}] [${this.input.label('right')}] 選択    [${this.input.label('confirm')}] 決定    [${this.input.label('back')}] タイトル`;
      }),
    ];
  }

  _move(d) {
    this.index = (this.index + d + KEYS.length) % KEYS.length;
    this.audio.cue('move', { volume: 0.55, variation: 0.12 });
    this._paint();
  }

  _paint(silent = false) {
    const d = DIFFICULTY[KEYS[this.index]];
    this.desc.text = d.desc;
    const apply = () => {
      this.nameBig.text = d.name;
      this.nameBig.style.fill = d.tint;
      this.nameEn.text = d.en;
      this.tag.text = d.tag;
      this.desc.style.fill = 0xa9a294;
      this.desc.alpha = 1;
    };
    if (silent) apply();
    else {
      // cross-fade: duck out, swap, ease back in with a small slide
      const t0 = performance.now();
      const anim = () => {
        const p = Math.min(1, (performance.now() - t0) / 130);
        if (p < 0.5) {
          this.nameBig.alpha = 1 - p * 2; this.nameEn.alpha = 1 - p * 2;
          this.tag.alpha = 1 - p * 2; this.desc.alpha = 1 - p * 2;
        } else {
          if (!this._swapped) { this._swapped = true; apply(); }
          this.nameBig.alpha = (p - 0.5) * 2; this.nameEn.alpha = (p - 0.5) * 2;
          this.tag.alpha = (p - 0.5) * 2; this.desc.alpha = (p - 0.5) * 2;
        }
        if (p < 1) requestAnimationFrame(anim); else this._swapped = false;
      };
      anim();
    }
    // meters: enemy / margin / payout, each 0..1 of a 1.8 ceiling
    const vals = [d.enemy, d.player, d.score];
    this.meters.forEach((m, i) => {
      const v = Math.min(1, vals[i] / 1.8);
      m.fill.clear();
      const col = i === 0 ? (v > 0.6 ? 0xc05050 : 0x8a6a3a) : i === 1 ? 0x6a9a80 : 0xd7b169;
      m.fill.beginFill(col, 0.92).drawRect(202, 3, 316 * v, 8).endFill();
      m.fill.beginFill(0xffffff, 0.18).drawRect(202, 3, 316 * v, 2).endFill();
    });
    // pips
    this.pips.clear();
    const n = KEYS.length;
    const w = 16, gap = 10;
    const total = n * w + (n - 1) * gap;
    for (let i = 0; i < n; i++) {
      const x = UI.W / 2 - total / 2 + i * (w + gap);
      this.pips.beginFill(i === this.index ? d.tint : 0x2b333d, i === this.index ? 1 : 0.9)
        .drawRect(x, 480, w, 4).endFill();
    }
  }

  _start() {
    const k = KEYS[this.index];
    this.audio.cue('ok', { volume: 1 });
    this.game.goto('play', { data: { intro: true, seed: Date.now(), difficulty: k } });
  }

  update(dt) {
    this.t += dt;
    for (const p of this.par) {
      p.x -= p._speed * dt;
      if (p.x <= -p.children[0].width) p.x += p.children[0].width;
    }
    // arrows breathe; the idle one dims out of the way
    this.arrowL.alpha = 0.35 + Math.sin(this.t * 3.4) * 0.25;
    this.arrowR.alpha = 0.35 + Math.sin(this.t * 3.4 + Math.PI) * 0.25;
    this.nameBig.y = 146 + Math.sin(this.t * 1.1) * 2.5;
  }

  exit() { this._offs?.forEach((o) => o()); this.root?.destroy({ children: true }); }
}
