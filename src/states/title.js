// タイトル — logo, drifting parallax, embers, "PRESS ANY KEY".
import * as UI from '../ui.js';

export class TitleState {
  constructor(ctx) { Object.assign(this, ctx); }

  enter() {
    const root = this.root = new PIXI.Container();
    this.ui.addChild(root);
    this.t = 0;
    this.ready = false;

    // ---- parallax: three layers of the CC0 background drifting at different
    // speeds, plus a slow camera pan
    this.layers = [];
    const mk = (id, tint, alpha, scale, speed) => {
      const tex = this.registry.textures.get(id);
      if (!tex) return;
      const cont = new PIXI.Container();
      for (let i = 0; i < 2; i++) {
        const s = new PIXI.Sprite(tex);
        s.width = UI.W * scale; s.height = UI.H * scale;
        s.y = (UI.H - s.height) / 2;
        s.x = i * s.width;
        s.tint = tint; s.alpha = alpha;
        cont.addChild(s);
      }
      cont._speed = speed;
      root.addChild(cont);
      this.layers.push(cont);
    };
    mk('bg_layer_cave_far', 0x27384a, 0.85, 1.6, 9);
    mk('bg_layer_cave', 0x111d28, 0.95, 1.35, 22);
    mk('bg_layer_forest', 0x0a1219, 0.55, 1.25, 42);

    const sky = this.registry.textures.get('bg_sky_night');
    if (sky) {
      const s = new PIXI.Sprite(sky);
      s.width = UI.W; s.height = UI.H;
      s.tint = 0x2c3c50; s.alpha = 0.4;
      root.addChildAt(s, 0);
    }

    // dark wash + light shaft
    const wash = new PIXI.Graphics();
    wash.beginFill(0x04070a, 0.56).drawRect(0, 0, UI.W, UI.H).endFill();
    root.addChild(wash);
    const shaft = new PIXI.Graphics();
    shaft.beginFill(0x8fb6d8, 0.05).drawPolygon([420, 0, 700, 0, 980, UI.H, 520, UI.H]).endFill();
    root.addChild(shaft);
    this.shaft = shaft;

    // embers
    this.embers = new PIXI.Graphics();
    root.addChild(this.embers);
    this.emberData = Array.from({ length: 110 }, () => ({
      x: Math.random() * UI.W, y: Math.random() * UI.H,
      vy: -10 - Math.random() * 34, vx: (Math.random() - 0.5) * 14,
      s: Math.random() < 0.12 ? 3 : 2, a: 0.12 + Math.random() * 0.5,
      c: Math.random() < 0.45 ? 0xd7b169 : (Math.random() < 0.5 ? 0x59d7c8 : 0x9fc8e8),
    }));

    // ---- logo: stacked letterpress type with a glowing 本 seal
    const logo = this.logo = new PIXI.Container();
    logo.x = UI.SAFE + 64; logo.y = 172;
    const seal = new PIXI.Graphics();
    seal.beginFill(0x000000, 0.001).drawRect(0, 0, 1, 1).endFill();
    logo.addChild(seal);

    const halo = UI.makeGlowCanvas ? null : null;
    const bigGlow = new PIXI.Sprite(makeGlowTex(0xd7b169));
    bigGlow.anchor.set(0.5);
    bigGlow.width = bigGlow.height = 420;
    bigGlow.x = 46; bigGlow.y = 40;
    bigGlow.alpha = 0.32;
    bigGlow.blendMode = PIXI.BLEND_MODES.ADD;
    logo.addChild(bigGlow);
    this.logoGlow = bigGlow;

    const jp = UI.pxText('本 質', { size: 58, font: UI.FONT_JP_HEAVY, fill: 0xe9dcc0, outline: 6 });
    jp.x = 0; jp.y = 0;
    logo.addChild(jp);
    this.jp = jp;

    const main = UI.pxText('HONSHITSU', { size: 42, font: UI.FONT_BIG, fill: 0xf4ecda, outline: 6 });
    main.x = 2; main.y = 78;
    logo.addChild(main);
    this.main = main;

    const rule = new PIXI.Graphics();
    rule.beginFill(0xd7b169, 0.75).drawRect(4, 138, 424, 2).endFill();
    rule.beginFill(0xd7b169, 0.35).drawRect(4, 143, 240, 1).endFill();
    logo.addChild(rule);

    const sub = UI.pxText('偏差値60の教室から、本質が漏れ出している件について', { size: 13, fill: 0xc8b691, outline: 3 });
    sub.x = 4; sub.y = 154;
    logo.addChild(sub);

    const sub2 = UI.pxText('THE CLASSROOM WITH A DEVIATION OF 60 IS LEAKING ITS ESSENCE', { size: 8, font: UI.FONT_BIG, fill: 0x7d8794, outline: 2 });
    sub2.x = 5; sub2.y = 180;
    logo.addChild(sub2);
    root.addChild(logo);

    // ---- menu column (right of the logo)
    this.menuWrap = new PIXI.Container();
    this.menuWrap.x = UI.W - UI.SAFE - 330;
    this.menuWrap.y = 300;
    root.addChild(this.menuWrap);
    const hasSave = (this.save.best || 0) > 0;
    this.menu = new UI.MenuList({
      items: [
        { id: 'new', label: 'NEW GAME', jp: false, sub: '教室に降りる', action: () => this._start() },
        { id: 'continue', label: 'CONTINUE', jp: false, sub: hasSave ? `BEST ${String(this.save.best).padStart(6, '0')}` : '記録なし', disabled: !hasSave, action: () => { this.audio.cue('ok'); this.game.goto('play', { data: { intro: false, seed: Date.now() } }); } },
        { id: 'options', label: 'OPTIONS', jp: false, sub: '音量 / 画面', action: () => this.game.goto('options', { data: { back: 'title' } }) },
        { id: 'credits', label: 'CREDITS', jp: false, sub: '素材とライセンス', action: () => this.game.goto('credits') },
        { id: 'quit', label: 'QUIT', jp: false, sub: '終了', action: () => this._quit() },
      ],
      width: 310, itemH: 46, font: 17, audio: this.audio,
    });
    this.menuWrap.addChild(this.menu);

    // ---- "PRESS ANY KEY", bottom centre
    this.press = UI.pxText('PRESS ANY KEY', { size: 12, font: UI.FONT_BIG, fill: 0xe8dcc0, outline: 3 });
    this.press.anchor.set(0.5);
    this.press.x = UI.W / 2; this.press.y = UI.H - UI.SAFE - 34;
    root.addChild(this.press);

    // ---- corner chrome: version + copyright
    const ver = UI.pxText(`v${this.game.version}  ·  BUILD 2026.11  ·  ${this.registry.manifest.commercial_build ? 'COMMERCIAL' : 'PERSONAL / NON-COMMERCIAL'}`, { size: 8, fill: 0x59616b, outline: 2, font: UI.FONT_BIG });
    ver.x = UI.SAFE; ver.y = UI.H - UI.SAFE - 12;
    root.addChild(ver);
    const cr = UI.pxText('© 2026 ARENA WORKS  ·  assets: CC0 / OFL  ·  see CREDITS', { size: 8, fill: 0x59616b, outline: 2 });
    cr.anchor.set(1, 0);
    cr.x = UI.W - UI.SAFE; cr.y = UI.H - UI.SAFE - 12;
    root.addChild(cr);

    // vignette on top so the corners stay dark and readable
    const vig = new PIXI.Sprite(makeVignette());
    vig.width = UI.W; vig.height = UI.H;
    root.addChild(vig);

    // ---- input
    this._offs = [];
    const anyHandler = () => {
      if (!this.ready) return;
      if (!this.menuWrap.visible) {
        this.menuWrap.visible = true;
        this.menuWrap.alpha = 0;
        const t0 = performance.now();
        const fade = () => {
          const p = Math.min(1, (performance.now() - t0) / 300);
          this.menuWrap.alpha = p;
          this.menuWrap.x = UI.W - UI.SAFE - 330 + (1 - UI.easeOutCubic(p)) * 30;
          if (p < 1) requestAnimationFrame(fade);
        };
        fade();
        this.audio.cue('ok', { volume: 0.7 });
        this.press.text = '';
        return;
      }
      if (this._delegatingAny) return;
    };
    const keyHandler = (e) => {
      anyHandler(e);
      if (this.ready && this.menuWrap.visible) this.menu.handle(e.code.includes('ArrowUp') ? 'up' : '');
    };
    // action-level bindings (keyboard + pad both arrive here)
    const firstTouch = () => {
      if (this.hasInput) return;
      this.hasInput = true;
      this.press.visible = false;
    };
    this._offs.push(this.input.on('up', () => { firstTouch(); this.menu.handle('up'); }));
    this._offs.push(this.input.on('down', () => { firstTouch(); this.menu.handle('down'); }));
    this._offs.push(this.input.on('confirm', () => { firstTouch(); this.menu.handle('confirm'); }));
    this._offs.push(this.input.onCancel(() => { if (this.menuWrap.visible) this.audio.cue('back'); }));
    this._offs.push(this.input.on('devicechange', () => {}));
    this._setPressKey();

    this.menuWrap.visible = true;
    this.menuWrap.alpha = 0;
    this._fadeMenuIn();
    this.hasInput = false;

    this.audio.playMusic('bgm_title', { fade: 1600 });
    this.audio.playAmbient('amb_dungeon', 0.16);
  }

  _setPressKey() {
    const k = this.input.device === 'pad' ? 'PRESS START' : 'PRESS ANY KEY';
    if (this.press._last !== k) { this.press._last = k; this.press.text = k; }
  }

  _fadeMenuIn() {
    const t0 = performance.now();
    const from = UI.W - UI.SAFE - 296;
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / 480);
      this.menuWrap.alpha = UI.easeOutCubic(p);
      this.menuWrap.x = from + (1 - UI.easeOutCubic(p)) * 26;
      if (p < 1) requestAnimationFrame(tick);
    };
    tick();
  }

  _wake() { return true; }

  _start() {
    this.audio.cue('ok', { volume: 0.9 });
    this.game.goto('menu');
  }

  _quit() {
    // Browsers can't close a tab that wasn't opened by script; show the
    // standard "you may close this window" curtain instead of pretending.
    this.press.visible = true;
    this.press.text = 'このウィンドウを閉じてください';
    this.press.style.fill = 0x8d949e;
  }

  update(dt) {
    this.t += dt;
    this.ready = this.t > 0.6;
    // parallax scroll
    for (const l of this.layers) {
      l.x -= l._speed * dt;
      if (l.x <= -l.children[0].width) l.x += l.children[0].width;
    }
    // slow camera breathing
    this.logo.y = 172 + Math.sin(this.t * 0.6) * 4;
    this.logoGlow.alpha = 0.26 + Math.sin(this.t * 1.7) * 0.07;
    // embers
    this.embers.clear();
    for (const e of this.emberData) {
      e.y += e.vy * dt; e.x += e.vx * dt + Math.sin(this.t + e.y * 0.01) * 0.2;
      if (e.y < -4) { e.y = UI.H + 4; e.x = Math.random() * UI.W; }
      this.embers.beginFill(e.c, e.a);
      this.embers.drawRect(e.x | 0, e.y | 0, e.s, e.s);
      this.embers.endFill();
    }
    if (this.press.visible) this.press.alpha = 0.42 + Math.abs(Math.sin(this.t * 2.6)) * 0.5;
    if (this.menuWrap.visible) this.menu.update(dt);
    this._setPressKey();
  }

  exit() { this._offs?.forEach((o) => o()); this.root?.destroy({ children: true }); }
}

// ---------------------------------------------------------------- local helpers
function makeGlowTex(color) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  const r = (color >> 16) & 255, gg = (color >> 8) & 255, b = color & 255;
  grd.addColorStop(0, `rgba(${r},${gg},${b},0.85)`);
  grd.addColorStop(0.4, `rgba(${r},${gg},${b},0.22)`);
  grd.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  return PIXI.Texture.from(c);
}

function makeVignette() {
  const c = document.createElement('canvas');
  c.width = 320; c.height = 180;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(160, 96, 30, 160, 96, 200);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(0.6, 'rgba(0,0,0,0.25)');
  grd.addColorStop(1, 'rgba(0,0,0,0.9)');
  g.fillStyle = grd; g.fillRect(0, 0, 320, 180);
  return PIXI.Texture.from(c);
}
