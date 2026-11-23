// ---------------------------------------------------------------------------
//  ポーズ — the world keeps rendering underneath, dimmed + blurred, while the
//  menu comes forward. Nothing is torn down, so resuming is instant and the
//  player never loses their spatial bearing.
// ---------------------------------------------------------------------------
import * as UI from '../ui.js';

export class PauseState {
  constructor(ctx) { Object.assign(this, ctx); }

  /** Called by PlayState; the pause overlay draws over the live play state. */
  enterOverlay({ play }) {
    this.play = play;
    this.t = 0;
    this.closing = false;
    const root = this.root = new PIXI.Container();
    root.eventMode = 'static';
    this.ui.addChild(root);
    this.input.restoreAfter = true;

    // ---- dim + blur: a dark wash plus a few offset copies of the world
    // layer's texture is too heavy, so we dim and let the bloom do the work
    this.dim = new PIXI.Graphics();
    this.dim.beginFill(0x04070b, 0.0).drawRect(0, 0, UI.W, UI.H).endFill();
    root.addChild(this.dim);

    // slow horizontal scan band sweeping the screen — "paused" motion cue
    this.band = new PIXI.Graphics();
    this.band.beginFill(0x8fb6d8, 0.05).drawRect(0, 0, UI.W, 90).endFill();
    root.addChild(this.band);

    // ---- panel
    this.panelWrap = new PIXI.Container();
    this.panelWrap.x = UI.W / 2;
    this.panelWrap.y = UI.H / 2;
    root.addChild(this.panelWrap);

    const PW = 460, PH = 420;
    const frame = UI.menuFrame(PW, PH, { tex: this.registry.textures.get('ui_box_medium'), strong: true });
    frame.x = -PW / 2; frame.y = -PH / 2;
    this.panelWrap.addChild(frame);

    const title = UI.pxText('中 断', { size: 30, font: UI.FONT_JP_HEAVY, fill: 0xf0e4c8, outline: 5 });
    title.anchor.set(0.5, 0);
    title.y = -PH / 2 + 22;
    this.panelWrap.addChild(title);
    const sub = UI.pxText('PAUSED', { size: 10, font: UI.FONT_BIG, fill: 0x8d96a1, outline: 2 });
    sub.anchor.set(0.5, 0);
    sub.y = -PH / 2 + 66;
    this.panelWrap.addChild(sub);

    const rule = new PIXI.Graphics();
    rule.beginFill(0xd7b169, 0.45).drawRect(-PW / 2 + 40, -PH / 2 + 92, PW - 80, 1).endFill();
    this.panelWrap.addChild(rule);

    // run stats, small and grey — the score is the headline, everything else
    // is a footnote
    const p = play;
    this.statText = UI.pxText(
      `偏差値 ${String(Math.round(p.score)).padStart(6, '0')}   B${p.floor}F   撃破 ${p.kills}   最大コンボ ${p.bestCombo}`,
      { size: 11, fill: 0x9aa2ac, outline: 2 }
    );
    this.statText.anchor.set(0.5, 0);
    this.statText.y = -PH / 2 + 104;
    this.panelWrap.addChild(this.statText);

    this.menu = new UI.MenuList({
      items: [
        { id: 'resume', label: 'RESUME', sub: '教室に戻る', action: () => this._resume() },
        { id: 'options', label: 'OPTIONS', sub: '音量 / 画面', action: () => this.game.goto('options', { data: { back: 'pause', play } }) },
        { id: 'retry', label: 'RETRY', sub: '最初から', action: () => this._retry() },
        { id: 'title', label: 'TITLE', sub: 'タイトルへ', action: () => this._toTitle() },
      ],
      width: 340, itemH: 50, font: 18, audio: this.audio,
    });
    this.menu.x = -PW / 2 + 56;
    this.menu.y = -PH / 2 + 140;
    this.panelWrap.addChild(this.menu);

    const hint = UI.pxText(`[${this.input.label('back')}] 再開`, { size: 10, fill: 0x6f7883, outline: 2 });
    hint.anchor.set(0.5, 0);
    hint.y = PH / 2 - 34;
    this.panelWrap.addChild(hint);

    // ---- input
    this._offs = [
      this.input.on('up', () => this.menu.handle('up')),
      this.input.on('down', () => this.menu.handle('down')),
      this.input.on('confirm', () => this.menu.handle('confirm')),
      this.input.on('back', () => this._resume()),
    ];

    // ---- entrance: panel scales up from 0.94 with a back-ease
    const t0 = performance.now();
    const enter = () => {
      const p2 = Math.min(1, (performance.now() - t0) / 260);
      const e = UI.easeOutBack(p2);
      this.panelWrap.scale.set(0.94 + 0.06 * e);
      this.panelWrap.alpha = p2;
      this.dim.alpha = p2;
      if (p2 < 1) requestAnimationFrame(enter);
    };
    enter();
    this.menu.scale.set(1);
  }

  update(dt) {
    if (!this.root) return;
    // the play state is frozen; only this overlay animates
    this.t += dt;
    this.band.y = ((this.t * 90) % (UI.H + 120)) - 120;
    this.menu.update(dt);
    this.play?.hud.update(dt, this.play._hudCtx());
  }

  exit() {
    this._offs?.forEach((o) => o());
    this.root?.destroy({ children: true });
    this.root = null;
  }

  /** Public alias so PlayState's Esc toggle can close the overlay. */
  resumeFromOverlay() { this._resume(); }

  _resume() {
    if (this.closing) return;
    this.closing = true;
    const p = this.play;
    if (p) { p.game.states.pause.exit(); p.resumeFromPause(); }
    else this.game.goto('title');
  }

  _retry() {
    this.closing = true;
    this.play?.exit();
    this.root?.destroy({ children: true }); this.root = null;
    this.game.states.pause.play = null;
    this.game.goto('play', { data: { intro: false, seed: Date.now() } });
  }

  _toTitle() {
    this.closing = true;
    this.play?.exit();
    this.root?.destroy({ children: true }); this.root = null;
    this.game.states.pause.play = null;
    this.game.audio.playMusic('bgm_title', { fade: 1000 });
    this.game.goto('title');
  }
}
