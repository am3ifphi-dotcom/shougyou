// ---------------------------------------------------------------------------
//  リザルト — the run ends, the number goes up on the board, and the corridor
//  offers you another lap. Everything animates in on a curve, nothing pops.
// ---------------------------------------------------------------------------
import * as UI from '../ui.js';

export class ResultState {
  constructor(ctx) { Object.assign(this, ctx); }

  enter(data = null) {
    this.data = data || { score: 0, kills: 0, floor: 1, bestCombo: 0, time: 0, cleared: false, level: 1 };
    this.t = 0;
    this.phase = 'in';      // in → tally → ready

    const root = this.root = new PIXI.Container();
    this.ui.addChild(root);

    // ---- backdrop: a still of the corridor, heavily darkened
    const back = new PIXI.Sprite(this.registry.textures.get('bg_layer_cave') || PIXI.Texture.WHITE);
    back.width = UI.W; back.height = UI.H;
    back.tint = 0x1b2530;
    root.addChild(back);
    const wash = new PIXI.Graphics();
    wash.beginFill(0x06080c, 0.82).drawRect(0, 0, UI.W, UI.H).endFill();
    root.addChild(wash);

    // rising embers, same language as the title
    this.embers = new PIXI.Graphics();
    root.addChild(this.embers);
    this.emberData = Array.from({ length: 60 }, () => ({
      x: Math.random() * UI.W, y: Math.random() * UI.H,
      vy: -14 - Math.random() * 26, s: 2, a: 0.1 + Math.random() * 0.35,
      c: Math.random() < 0.5 ? 0xd7b169 : 0x59d7c8,
    }));

    // ---- headline
    const isBest = this.data.score >= (this.save.best || 0) && this.data.score > 0;
    const head = UI.pxText(this.data.cleared ? '教室、制圧' : '本質に、届かなかった', {
      size: 34, font: UI.FONT_JP_HEAVY, fill: this.data.cleared ? 0xffe0a0 : 0xd8cfc0, outline: 6,
    });
    head.anchor.set(0.5, 0);
    head.x = UI.W / 2; head.y = 88;
    this.head = head;
    root.addChild(head);

    const subHead = UI.pxText(this.data.cleared ? 'CLASSROOM SUPPRESSED' : 'THE ESSENCE REMAINS', {
      size: 10, font: UI.FONT_BIG, fill: 0x8d96a1, outline: 2,
    });
    subHead.anchor.set(0.5, 0);
    subHead.x = UI.W / 2; subHead.y = 136;
    root.addChild(subHead);

    const rule = new PIXI.Graphics();
    rule.beginFill(0xd7b169, 0.5).drawRect(UI.W / 2 - 240, 160, 480, 1).endFill();
    root.addChild(rule);

    // ---- the score: counts up from zero with a mechanical tick
    this.scoreLabel = UI.pxText('偏差値 / DEVIATION SCORE', { size: 9, font: UI.FONT_BIG, fill: 0x7d8794, outline: 2 });
    this.scoreLabel.anchor.set(0.5, 0);
    this.scoreLabel.x = UI.W / 2; this.scoreLabel.y = 178;
    root.addChild(this.scoreLabel);

    this.scoreText = UI.pxText('000000', { size: 56, font: UI.FONT_BIG, fill: 0xf4ecda, outline: 8 });
    this.scoreText.anchor.set(0.5, 0);
    this.scoreText.x = UI.W / 2; this.scoreText.y = 196;
    root.addChild(this.scoreText);

    this.bestTag = UI.pxText('NEW BEST', { size: 12, font: UI.FONT_BIG, fill: 0xffe08a, outline: 3 });
    this.bestTag.anchor.set(0.5, 0);
    this.bestTag.x = UI.W / 2 + 220; this.bestTag.y = 214;
    this.bestTag.visible = false;
    root.addChild(this.bestTag);
    this.isBest = isBest;

    // ---- tally column: four rows revealed one after another
    this.rows = [];
    const rowDefs = [
      ['撃破', String(this.data.kills), 'KILLS'],
      ['到達', `B${this.data.floor}F`, 'FLOOR'],
      ['最大コンボ', `${this.data.bestCombo}`, 'BEST COMBO'],
      ['記録', `${UI.pad2(this.data.time / 60)}:${UI.pad2(this.data.time % 60)}`, 'TIME'],
    ];
    const colY = 300;
    rowDefs.forEach(([jp, val, en], i) => {
      const c = new PIXI.Container();
      c.x = UI.W / 2 - 300 + (i % 2) * 320;
      c.y = colY + Math.floor(i / 2) * 62;
      c.alpha = 0;
      const k = UI.pxText(jp, { size: 11, fill: 0x8d96a1, outline: 2 });
      k.x = 0; k.y = 0;
      const v = UI.pxText(val, { size: 24, font: UI.FONT_BIG, fill: 0xe8dcc0, outline: 4 });
      v.x = 0; v.y = 20;
      const en2 = UI.pxText(en, { size: 8, font: UI.FONT_BIG, fill: 0x565f69, outline: 2 });
      en2.x = 150; en2.y = 6;
      c.addChild(k, v, en2);
      root.addChild(c);
      this.rows.push(c);
    });

    // ---- the line
    const lines = this.data.cleared
      ? ['廊下が、静かになった。']
      : ['名前をつけたのは、俺の方だった。', '本質は元からあった。倒したのは、俺の側だった。', '偏差値は、まだ決まらない。'];
    this.line = UI.pxText(lines[Math.floor(Math.random() * lines.length)], {
      size: 14, fill: 0xb9b2a4, outline: 3, align: 'center',
    });
    this.line.anchor.set(0.5, 0);
    this.line.x = UI.W / 2; this.line.y = 464;
    root.addChild(this.line);

    // ---- menu
    this.menu = new UI.MenuList({
      items: [
        { id: 'retry', label: 'RETRY', sub: 'もう一度', action: () => this.game.goto('play', { data: { intro: false, seed: Date.now() } }) },
        { id: 'title', label: 'TITLE', sub: 'タイトルへ', action: () => { this.audio.playMusic('bgm_title', { fade: 900 }); this.game.goto('title'); } },
      ],
      width: 300, itemH: 48, font: 18, audio: this.audio,
    });
    this.menu.x = UI.W / 2 - 150;
    this.menu.y = 516;
    root.addChild(this.menu);

    // ---- corner chrome
    const ver = UI.pxText('© 2026 ARENA WORKS · PERSONAL / NON-COMMERCIAL', { size: 8, fill: 0x4d545d, outline: 2 });
    ver.x = UI.SAFE; ver.y = UI.H - UI.SAFE - 10;
    root.addChild(ver);

    this.shown = 0;
    this.countTarget = null;
    this.phase = 'in';
    this.menu.visible = false;
    this._offs = [
      this.input.on('up', () => { if (this.phase === 'ready') this.menu.handle('up'); }),
      this.input.on('down', () => { if (this.phase === 'ready') this.menu.handle('down'); }),
      this.input.on('confirm', () => {
        if (this.phase === 'ready') { this.menu.handle('confirm'); return; }
        this._skipTally();
      }),
      this.input.on('up', () => { if (this.phase === 'ready') this.menu.handle('up'); }),
      this.input.on('down', () => { if (this.phase === 'ready') this.menu.handle('down'); }),
    ];

    this.audio.playMusic('bgm_result', { fade: 900 });
    if (this.data.cleared) this.audio.cue('win', { volume: 0.8 });
  }

  _skipTally() {
    this.countTarget = this.data.score;
    this.tallyAt = 0;
    this.phase = 'ready';
  }

  update(dt) {
    this.t += dt;
    // score odometer: ~1.6 s, eased, with a soft tick every 20 ms
    const dur = 1.6;
    if (this.countTarget == null) {
      this.countTarget = this.data.score || 0;
      this.tallyAt = this.t;
    }
    const p = Math.min(1, (this.t - this.tallyAt) / dur);
    const val = Math.round(this.countTarget * UI.easeOutCubic(p));
    this._shown ??= -1;
    if (val !== this._shown) {
      this._shown = val;
      this.scoreText.text = String(val).padStart(6, '0');
      if (Math.round(val / 250) !== Math.round((this._shownPrev || 0) / 250)) this.audio.cue('blip', { volume: 0.07, variation: 0.4 });
      this._shownPrev = val;
    }
    // best tag pops when the odometer passes the old record
    if (this.isBest && this._shown > (this.save.best || 0) && !this.bestTag.visible && this._shown > 0) {
      this.bestTag.visible = true;
      this.audio.cue('coinDouble', { volume: 0.6 });
      this.bestTag.scale.set(0.6);
      this._popT = this.t;
    }
    if (this.bestTag.visible) {
      const bp = Math.min(1, (this.t - this._popT) / 0.35);
      this.bestTag.scale.set(0.6 + 0.4 * UI.easeOutBack(bp));
      this.bestTag.alpha = 0.6 + Math.sin(this.t * 5) * 0.4;
    }
    // rows cascade in
    if (p >= 1 && this.phase === 'in') {
      this.phase = 'tally';
      this.rows.forEach((row, i) => {
        const t0 = performance.now();
        const fade = () => {
          const q = Math.min(1, (performance.now() - t0 - i * 110) / 260);
          row.alpha = Math.max(0, q);
          row.x = UI.W / 2 - 300 + (i % 2) * 320 - (1 - UI.easeOutCubic(Math.max(0, q))) * 18;
          if (q < 1 || row.alpha < 1) requestAnimationFrame(fade);
        };
        fade();
      });
      setTimeout(() => { this.phase = 'ready'; this.menu.visible = true; this.menu.alpha = 0;
        const t0 = performance.now();
        const fade2 = () => { const q = Math.min(1, (performance.now() - t0) / 300);
          this.menu.alpha = q; if (q < 1) requestAnimationFrame(fade2); };
        fade2();
      }, this.rows.length * 110 + 320);
    }
    if (this.phase === 'ready') this.menu.update(dt);

    // embers
    this.embers.clear();
    for (const e of this.emberData) {
      e.y += e.vy * dt;
      if (e.y < -4) { e.y = UI.H + 4; e.x = Math.random() * UI.W; }
      this.embers.beginFill(e.c, e.a).drawRect(e.x | 0, e.y | 0, e.s, e.s).endFill();
    }
    this.head.y = 88 + Math.sin(this.t * 0.8) * 2;

    // persist
    if (this.data.score > (this.save.best || 0)) this.save.best = this.data.score;
  }

  exit() {
    this._offs?.forEach((o) => o());
    this.root?.destroy({ children: true });
  }
}
