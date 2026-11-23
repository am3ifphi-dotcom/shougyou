// ローディング — progress bar + rotating hints + a background that keeps
// moving, and a live log of what downloaded, what fell back, and why.
import * as UI from '../ui.js';

const HINTS = [
  '本質は、元からあった。あなたが名前をつけただけだ。',
  '偏差値60の教室には、コーンスープが三ヶ月前から補充されていない。',
  '残像バーは、遅れて減る。痛みが遅れて届くように。',
  '[SHIFT] で回避。無敵時間はごく短い。',
  '[E] で本質を撃つ。MPは時間で戻る。',
  'コンボは三秒で途切れる。途切れさせないこと。',
  '敵は壁をすり抜ける。壁を信じるな。',
  '本質を集めると、教室がまた一つ作り直される。',
  'WASD / 矢印キー / ゲームパッド、すべて同じように動く。',
  'ポーズは [ESC]。音量もそこで変えられる。',
];

export class LoadingState {
  constructor(ctx) { Object.assign(this, ctx); }

  enter() {
    const root = this.root = new PIXI.Container();
    this.ui.addChild(root);

    // moving backdrop: two parallax strips scrolling at different speeds
    this.bg = new PIXI.Container();
    root.addChild(this.bg);
    this.strip = new PIXI.Container();
    for (let i = 0; i < 3; i++) {
      const t = this.registry.textures.get('bg_layer_cave');
      if (t) {
        const s = new PIXI.Sprite(t);
        s.width = 1040; s.height = 680;
        s.x = i * 1030;
        s.tint = 0x2a3a44;
        s.alpha = 0.55;
        this.strip.addChild(s);
      }
    }
    if (!this.strip.children.length) {
      const g = new PIXI.Graphics();
      g.beginFill(0x0a1620).drawRect(0, 0, UI.W, UI.H).endFill();
      this.strip.addChild(g);
    }
    this.bg.addChild(this.strip);
    this.embers = new PIXI.Graphics();
    root.addChild(this.embers);
    this.emberData = Array.from({ length: 70 }, () => ({
      x: Math.random() * UI.W, y: Math.random() * UI.H,
      vy: -8 - Math.random() * 26, vx: (Math.random() - 0.5) * 10,
      s: Math.random() < 0.15 ? 3 : 2, a: 0.15 + Math.random() * 0.5,
      hue: Math.random() < 0.5 ? 0xd7b169 : 0x59d7c8,
    }));

    const vign = new PIXI.Graphics();
    vign.beginFill(0x000000, 0.55).drawRect(0, 0, UI.W, 120).endFill();
    vign.beginFill(0x000000, 0.55).drawRect(0, UI.H - 120, UI.W, 120).endFill();
    root.addChild(vign);

    // ---- title / status
    const title = UI.pxText('HONSHITSU', { size: 26, font: UI.FONT_BIG, fill: 0xe9e2d2, outline: 4 });
    title.x = UI.SAFE + 8; title.y = UI.SAFE + 4;
    root.addChild(title);
    const sub = UI.pxText('本質 / 偏差値60の教室', { size: 14, fill: 0xc8a86a, outline: 3 });
    sub.x = UI.SAFE + 10; sub.y = UI.SAFE + 44;
    root.addChild(sub);

    // ---- progress bar (bottom-left, anchored)
    const barW = 520, barH = 14;
    const bx = UI.SAFE + 8, by = UI.H - UI.SAFE - 46;
    const barFrame = new PIXI.Graphics();
    barFrame.beginFill(0x05070a, 0.9).drawRect(0, 0, barW, barH).endFill();
    barFrame.lineStyle(1, UI.C.goldDim, 0.9).drawRect(0.5, 0.5, barW - 1, barH - 1);
    barFrame.x = bx; barFrame.y = by;
    root.addChild(barFrame);
    this.fillG = new PIXI.Graphics();
    this.fillG.x = bx; this.fillG.y = by;
    root.addChild(this.fillG);
    this.barW = barW; this.barH = barH;

    this.pct = UI.pxText('0%', { size: 10, font: UI.FONT_BIG, fill: 0x9aa2ac, outline: 2 });
    this.pct.x = bx + barW + 12; this.pct.y = by;
    root.addChild(this.pct);

    this.status = UI.pxText('READING MANIFEST', { size: 10, fill: 0x8d949e, outline: 2, font: UI.FONT_JP });
    this.status.x = bx + 2; this.status.y = by - 24;
    root.addChild(this.status);

    // ---- hint (bottom-right, above the log)
    this.hintBox = new PIXI.Container();
    this.hintBox.x = UI.W - UI.SAFE - 8; this.hintBox.y = UI.H - UI.SAFE - 52;
    const hint = this.hint = UI.pxText('', { size: 12, fill: 0xbfb7a6, outline: 3, align: 'right' });
    hint.anchor.set(1, 1);
    this.hintBox.addChild(hint);
    const hk = UI.pxText('HINT', { size: 8, font: UI.FONT_BIG, fill: 0x6b7480, outline: 2 });
    hk.anchor.set(1, 0);
    hk.y = -hint.height - 10;
    this.hintBox.addChild(hk);
    root.addChild(this.hintBox);
    this.hintIdx = Math.floor(Math.random() * HINTS.length);
    this.hint = hint;

    // ---- asset log (right column, small, live)
    this.logLines = [];
    this.logBox = new PIXI.Container();
    this.logBox.x = UI.W - UI.SAFE - 8; this.logBox.y = UI.SAFE + 30;
    root.addChild(this.logBox);
    const logTitle = UI.pxText('ASSET LOG', { size: 8, font: UI.FONT_BIG, fill: 0x6b7480, outline: 2 });
    logTitle.anchor.set(1, 0);
    this.logBox.addChild(logTitle);

    // ---- scanline / noise overlay for the "CRT/console" feel
    const scan = new PIXI.Graphics();
    scan.beginFill(0x000000, 0.16);
    for (let y = 0; y < UI.H; y += 3) scan.drawRect(0, y, UI.W, 1);
    scan.endFill();
    scan.alpha = this.settings.scanlines ? 0.6 : 0;
    root.addChild(scan);

    // ---- begin the load
    this.t = 0;
    this.started = false;
    this.progress = 0;
    this.target = 0;
    this.registry.onLog = (row) => this._log(row);
    this._off = this.input.on('confirm', () => this._trySkip());
    this._off2 = this.input.on('back', () => this._trySkip());
    this.loadAll();
  }

  _trySkip() {
    if (this.progress >= 1 && this.readyToExit) this._finish();
  }

  async loadAll() {
    const { PIXI } = window;
    const ids = this.registry.entries
      .filter((e) => e.type !== 'library')
      .map((e) => e.id);
    // order matters for perceived progress: fonts → sprites → audio
    const order = (id) => {
      const e = this.registry.info(id);
      if (!e) return 9;
      if (e.type === 'font') return 0;
      if (e.type === 'sprite' || e.type === 'image') return 1;
      if (e.type === 'audio') return 2;
      return 3;
    };
    ids.sort((a, b) => order(a) - order(b));

    this.total = ids.length;
    this.done = 0;
    this.started = true;
    this.pendingMusic = [];

    const CONCURRENCY = 8;
    let cursor = 0;

    const worker = async () => {
      while (cursor < ids.length) {
        const id = ids[cursor++];
        const e = this.registry.info(id);
        this.status.text = `LOADING ${String(this.done + 1).padStart(3, '0')}/${this.total}  ${id}`;
        try {
          if (e.type === 'audio') {
            await this.registry.loadAudio(id);
          } else if (e.type === 'font') {
            // the CSS @font-face already points at the file; force a decode
            await this._loadFontFile(id);
          } else {
            await this.registry.loadTexture(id, { PIXI });
          }
        } catch (err) {
          this.registry.record(id, 'fallback', String(err.message || err));
        }
        this.done++;
        this.target = this.done / this.total;
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    // sheet frames & grids are cheap; do them while the bar settles
    this.buildFrames();
    this.target = 1;
    this.status.text = 'AUDIO BUSES READY — PRESS ANY KEY';
    this.readyToExit = true;
    this.autoExitAt = this.t + 1.2;
  }

  _loadFontFile(id) {
    const e = this.registry.info(id);
    if (!e?.available) return Promise.resolve();
    const fam = e.meta?.family || 'DotGothic16';
    const tester = `${fam} ${e.meta?.weight || 400}`;
    return document.fonts.load(`16px "${fam}"`, 'ABC本質偏差値').then(() => document.fonts.ready).catch(() => {});
  }

  buildFrames() {
    const { PIXI } = window;
    this.registry.framesById = {};
    const gridDefs = {
      fx_torch_anim: [8, 8], fx_fireball_big: [8, 8], fx_firewall: [8, 8],
      fx_barrier: [8, 8], fx_firespell: [8, 8],
      fx_burst_a: [8, 8], fx_burst_b: [8, 8], fx_burst_c: [8, 8],
    };
    for (const [id, [c, r]] of Object.entries(gridDefs)) {
      this.registry.framesById[id] = this.registry.gridFrames(id, c, r, PIXI);
    }
  }

  _log(row) {
    const map = {
      ok: { c: 0x7f9b6a, tag: 'OK ' },
      user: { c: 0x7ac8d8, tag: 'USR' },
      fallback: { c: 0xd8a24a, tag: 'FB ' },
      info: { c: 0x6b7480, tag: 'INF' },
      cached: { c: 0x7f9b6a, tag: 'OK ' },
    };
    const m = map[row.status] || map.info;
    const line = UI.pxText(`${m.tag} ${row.id}`, { size: 9, fill: m.c, outline: 0, shadow: false });
    line.anchor.set(1, 0);
    line.y = 14 + this.logLines.length * 12;
    this.logBox.addChild(line);
    this.logLines.push(line);
    if (this.logLines.length > 22) {
      const old = this.logLines.shift();
      old.destroy();
      this.logLines.forEach((l, i) => { l.y = 14 + i * 12; });
    }
  }

  _finish() {
    if (this.finished) return;
    this.finished = true;
    this.registry.onLog = null;
    this._off?.(); this._off2?.();
    this.game.goto('title');
  }

  update(dt) {
    this.t += dt;
    // eased progress
    this.progress += (this.target - this.progress) * Math.min(1, dt * 5.5);
    if (this.target >= 1 && this.progress > 0.995) this.progress = 1;
    const p = this.progress;
    this.fillG.clear();
    this.fillG.beginFill(0xd7b169, 0.95).drawRect(1, 1, (this.barW - 2) * p, this.barH - 2).endFill();
    this.fillG.beginFill(0xffe7b0, 0.7).drawRect(1, 1, (this.barW - 2) * p, 3).endFill();
    this.pct.text = `${Math.round(p * 100)}%`;

    // scrolling parallax
    this.strip.x -= dt * 22;
    if (this.strip.x < -2060) this.strip.x += 2060;

    // embers
    this.embers.clear();
    for (const e of this.emberData) {
      e.y += e.vy * dt; e.x += e.vx * dt;
      if (e.y < -4) { e.y = UI.H + 4; e.x = Math.random() * UI.W; }
      this.embers.beginFill(e.hue, e.a);
      this.embers.drawRect(e.x | 0, e.y | 0, e.s, e.s);
      this.embers.endFill();
    }

    // hint rotation
    if (Math.floor(this.t / 4.2) !== this._hintSlot) {
      this._hintSlot = Math.floor(this.t / 4.2);
      this.hintIdx = (this.hintIdx + 1) % HINTS.length;
      this.hint.text = HINTS[this.hintIdx];
      this.hint.alpha = 0;
    }
    this.hint.alpha = Math.min(1, this.hint.alpha + dt * 2);

    if (this.readyToExit) {
      this.status.alpha = 0.55 + Math.sin(this.t * 5) * 0.45;
      if (this.t > this.autoExitAt) this._finish();
    }
  }

  exit() { this.root?.destroy({ children: true }); }
}
