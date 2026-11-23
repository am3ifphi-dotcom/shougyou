// ---------------------------------------------------------------------------
//  オプション — volume buses, display toggles, and a live control legend that
//  switches glyphs the moment the player touches a gamepad. No sliders that
//  look like a browser widget: bars are drawn like the HUD's own meters and
//  adjusted with ←/→.
// ---------------------------------------------------------------------------
import * as UI from '../ui.js';

const ROWS = [
  { id: 'bgm', kind: 'slider', label: 'BGM', jp: '音楽' },
  { id: 'se', kind: 'slider', label: 'SE', jp: '効果音' },
  { id: 'voice', kind: 'slider', label: 'VOICE', jp: '音声' },
  { id: 'scanlines', kind: 'toggle', label: 'SCANLINES', jp: '走査線' },
  { id: 'shake', kind: 'toggle', label: 'SCREEN SHAKE', jp: '画面揺れ' },
  { id: 'hints', kind: 'toggle', label: 'HINTS', jp: '操作ヒント' },
  { id: 'fullscreen', kind: 'toggle', label: 'FULLSCREEN', jp: '全画面' },
  { id: 'controls', kind: 'action', label: 'CONTROLS', jp: '操作一覧' },
  { id: 'back', kind: 'action', label: 'BACK', jp: '戻る' },
];

export class OptionsState {
  constructor(ctx) { Object.assign(this, ctx); }

  enter(data = {}) {
    data = data || {};
    this.backTo = data.back || 'title';
    this.play = data.play || null;
    this.t = 0;
    this.index = 0;
    this.showingControls = false;

    const root = this.root = new PIXI.Container();
    this.ui.addChild(root);

    const back = new PIXI.Sprite(this.registry.textures.get('bg_layer_cave') || PIXI.Texture.WHITE);
    back.width = UI.W; back.height = UI.H;
    back.tint = 0x22303e; back.alpha = 0.9;
    root.addChild(back);
    const wash = new PIXI.Graphics();
    wash.beginFill(0x05080c, 0.86).drawRect(0, 0, UI.W, UI.H).endFill();
    root.addChild(wash);

    const title = UI.pxText('設 定', { size: 34, font: UI.FONT_JP_HEAVY, fill: 0xf0e4c8, outline: 6 });
    title.anchor.set(0.5, 0);
    title.x = UI.W / 2; title.y = 52;
    root.addChild(title);
    const sub = UI.pxText('O P T I O N S', { size: 10, font: UI.FONT_BIG, fill: 0x7d8794, outline: 2 });
    sub.anchor.set(0.5, 0);
    sub.x = UI.W / 2; sub.y = 98;
    root.addChild(sub);

    const PW = 720, PH = 520;
    const frame = UI.menuFrame(PW, PH, { tex: this.registry.textures.get('ui_box_medium'), strong: true });
    frame.x = UI.W / 2 - PW / 2; frame.y = 128;
    root.addChild(frame);

    // rows
    this.rowNodes = ROWS.map((row, i) => {
      const y = 128 + 34 + i * 50;
      const c = new PIXI.Container();
      c.x = UI.W / 2 - PW / 2 + 22; c.y = y;
      const label = UI.pxText(row.label, { size: 12, font: UI.FONT_BIG, fill: 0xcfc6b4, outline: 2 });
      label.x = 30; label.y = 6;
      const jp = UI.pxText(row.jp, { size: 11, fill: 0x6f7883, outline: 2 });
      jp.x = 30 + 210; jp.y = 7;
      const value = new PIXI.Container();
      value.x = PW - 56;
      const barBg = new PIXI.Graphics();
      const bar = new PIXI.Graphics();
      const onOff = UI.pxText('ON', { size: 11, font: UI.FONT_BIG, fill: 0xe8dcc0, outline: 2 });
      onOff.anchor.set(1, 0);
      c.addChild(label, jp, value);
      const cursor = UI.pxText('▶', { size: 11, fill: UI.C.gold, outline: 2 });
      cursor.x = 4; cursor.y = 6; cursor.alpha = 0;
      c.addChild(cursor);
      root.addChild(c);
      return { row, c, label, jp, value, barBg, bar, onOff, cursor, y };
    });

    // ---- controls legend panel (hidden until asked for)
    this.controlsPanel = new PIXI.Container();
    this.controlsPanel.visible = false;
    root.addChild(this.controlsPanel);

    // ---- input
    this._offs = [
      this.input.on('up', () => this._move(-1)),
      this.input.on('down', () => this._move(1)),
      this.input.on('left', () => this._adjust(-1)),
      this.input.on('right', () => this._adjust(1)),
      this.input.on('confirm', () => this._activate()),
      this.input.onCancel(() => this._close()),
      this.input.on('devicechange', () => this._paint()),
    ];

    try { this._paint(); } catch (e) { console.warn('options paint', e); }
    this.audio.cue('ok', { volume: 0.4 });
  }

  _adjust(dir) {
    const node = this.rowNodes[this.index];
    if (!node) return;
    const id = node.row.id;
    if (node.row.kind === 'slider') {
      const v = UI.clamp((this.settings[id] ?? 0.7) + dir * 0.1, 0, 1);
      this.settings[id] = Math.round(v * 10) / 10;
      this.audio.setVolume(id, this.settings[id]);
      this.audio.cue('move', { volume: 0.4, variation: 0.1 });
    } else if (node.row.kind === 'toggle') {
      this.settings[id] = !this.settings[id];
      if (id === 'fullscreen') this.game.toggleFullscreen();
      this.settings.fullscreen = !!document.fullscreenElement;
      this.audio.cue('ok', { volume: 0.4 });
    } else return;
    this._paint();
  }

  _move(d) {
    this.index = (this.index + d + ROWS.length) % ROWS.length;
    this.audio.cue('move', { volume: 0.4, variation: 0.1 });
    this._paint();
  }

  _activate() {
    const node = this.rowNodes[this.index];
    if (!node) return;
    const id = node.row.id;
    if (node.row.kind === 'toggle') this._adjust(1);
    else if (node.row.kind === 'slider') this._adjust(1);
    else if (id === 'controls') { this.showingControls = !this.showingControls; this._buildControls(); this.audio.cue('ok'); }
    else if (id === 'back') this._close();
  }

  _close() {
    this.audio.cue('back', { volume: 0.6 });
    this.settings.fullscreen = !!document.fullscreenElement;
    if (this.backTo === 'pause' && this.play) {
      this.game.goto('pause', { data: {} });
    } else {
      this.game.goto('title');
    }
  }

  _buildControls() {
    const cp = this.controlsPanel;
    cp.removeChildren().forEach((c) => c.destroy({ children: true }));
    cp.visible = this.showingControls;
    if (!this.showingControls) return;
    const dim = new PIXI.Graphics();
    dim.beginFill(0x04060a, 0.9).drawRect(0, 0, UI.W, UI.H).endFill();
    cp.addChild(dim);
    const PW = 620, PH = 400;
    const frame = UI.menuFrame(PW, PH, { tex: this.registry.textures.get('ui_box_medium'), strong: true });
    frame.x = (UI.W - PW) / 2; frame.y = (UI.H - PH) / 2;
    cp.addChild(frame);
    const t = UI.pxText('操 作', { size: 22, font: UI.FONT_JP_HEAVY, fill: 0xf0e4c8, outline: 4 });
    t.x = (UI.W - PW) / 2 + 28; t.y = (UI.H - PH) / 2 + 22;
    cp.addChild(t);
    const dev = UI.pxText(`DEVICE: ${this.input.deviceName()}`, { size: 9, font: UI.FONT_BIG, fill: 0x7d8794, outline: 2 });
    dev.x = (UI.W - PW) / 2 + 300; dev.y = (UI.H - PH) / 2 + 32;
    cp.addChild(dev);

    const acts = [
      ['移動', ['up', 'down', 'left', 'right']],
      ['撃つ', ['confirm']],
      ['回避', ['dash']],
      ['技', ['skill']],
      ['中断', ['pause']],
      ['戻る', ['back']],
    ];
    acts.forEach(([jp, keys], i) => {
      const y = (UI.H - PH) / 2 + 78 + i * 38;
      const label = UI.pxText(jp, { size: 12, fill: 0xcfc6b4, outline: 2 });
      label.x = (UI.W - PW) / 2 + 30; label.y = y;
      cp.addChild(label);
      let x = (UI.W - PW) / 2 + 150;
      for (const k of keys) {
        const cap = UI.keycap(this.input.label(k), { size: 9, tint: 0xd7b169 });
        cap.x = x; cap.y = y - 4;
        cp.addChild(cap);
        x += cap._w + 8;
      }
    });
    const close = UI.pxText(`[${this.input.label('back')}] 閉じる`, { size: 10, fill: 0x8d96a1, outline: 2 });
    close.anchor.set(0.5, 0);
    close.x = UI.W / 2; close.y = (UI.H - PH) / 2 + PH - 30;
    cp.addChild(close);
  }

  _paint() {
    this.rowNodes.forEach((node, i) => {
      const on = i === this.index;
      node.cursor.alpha = on ? 1 : 0;
      node.label.style.fill = on ? 0xffffff : 0xcfc6b4;
      node.label.x = on ? 32 : 30;
      const id = node.row.id;
      node.value.removeChildren().forEach((c) => c.destroy({ children: true }));
      if (node.row.kind === 'slider') {
        const v = this.settings[id] ?? 0.7;
        const bw = 210;
        const bg = new PIXI.Graphics();
        bg.beginFill(0x05070a, 0.95).drawRect(-bw, 0, bw, 10).endFill();
        bg.lineStyle(1, 0x3a4653, 1).drawRect(-bw + 0.5, 0.5, bw - 1, 9);
        const fill = new PIXI.Graphics();
        fill.beginFill(id === 'bgm' ? 0x8a6f3a : id === 'se' ? 0x3a6a8a : 0x6a3a8a, 0.95)
          .drawRect(-bw, 0, bw * v, 10).endFill();
        const knob = new PIXI.Graphics();
        knob.beginFill(0xf2e6c8).drawRect(-bw + bw * v - 1, -2, 2, 14).endFill();
        node.value.addChild(bg, fill, knob);
        const pct = UI.pxText(`${Math.round(v * 100)}`, { size: 10, font: UI.FONT_BIG, fill: 0xc8bfa8, outline: 2 });
        pct.x = 16; pct.y = -1;
        node.value.addChild(pct);
      } else if (node.row.kind === 'toggle') {
        const on2 = !!this.settings[id] || (id === 'fullscreen' && !!document.fullscreenElement);
        const g = new PIXI.Graphics();
        g.beginFill(on2 ? 0x3f6b3a : 0x232a33, 1).drawRect(-104, 0, 104, 22).endFill();
        g.lineStyle(1, on2 ? 0x8ec96b : 0x3a4653, 1).drawRect(-104, 0, 104, 22);
        const txt = UI.pxText(on2 ? 'ON' : 'OFF', { size: 10, font: UI.FONT_BIG, fill: on2 ? 0xdff0c8 : 0x7d8794, outline: 2 });
        txt.anchor.set(0.5, 0);
        txt.x = -52; txt.y = 5;
        node.value.addChild(g, txt);
      } else {
        const txt = UI.pxText(id === 'controls' ? '開く  ▶' : '戻る', { size: 11, fill: on ? 0xe8dcc0 : 0x7d8794, outline: 2 });
        txt.x = -120;
        node.value.addChild(txt);
      }
    });
  }

  update(dt) { this.t += dt; }

  exit() { this._offs?.forEach((o) => o()); this.root?.destroy({ children: true }); }
}
