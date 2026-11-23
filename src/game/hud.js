// ---------------------------------------------------------------------------
//  hud.js — in-game HUD, anchored to the four corners + bottom edge.
//
//    top-left      HP / MP with a lagging after-image bar and numeric readout
//    top-right     偏差値 (deviation) score, floor, combo, timer
//    top-centre    boss name + health when one is alive
//    bottom-centre skill / item slots with input-device glyphs
//    bottom-left   minimap of the corridor
//    right edge    objective prompt (one short line, never a paragraph)
// ---------------------------------------------------------------------------
import * as UI from '../ui.js';

const { C } = UI;

export class Hud {
  constructor({ registry, audio, input, settings }) {
    this.reg = registry;
    this.audio = audio;
    this.input = input;
    this.settings = settings;
    this.root = new PIXI.Container();
    this.root.eventMode = 'none';

    this.hp = 100; this.hpLag = 100; this.hpMax = 100;
    this.mp = 100; this.mpMax = 100;
    this.scoreShown = 0; this.score = 0;
    this.best = 0;

    this._buildVitals();
    this._buildScore();
    this._buildSlots();
    this._buildMinimap();
    this._buildObjective();
    this._buildBossBar();
    this._buildFloaters();
    this._buildHitVignette();
    this.t = 0;
    this.hidden = false;
  }

  // ------------------------------------------------------------ top-left
  _buildVitals() {
    const g = this.vitals = new PIXI.Container();
    g.x = UI.SAFE; g.y = UI.SAFE;
    this.root.addChild(g);

    const W = 342, H = 96;
    const frame = UI.menuFrame(W, H, { tex: this.reg.textures.get('ui_box_medium') });
    frame.alpha = 0.95;
    g.addChild(frame);

    // ---- portrait plate: the Drive illustration, cropped to a square
    const P = 78;
    const plate = new PIXI.Graphics();
    plate.beginFill(0x0a0e14, 0.95).drawRect(8, 9, P, P).endFill();
    plate.lineStyle(1, C.goldDim, 0.95).drawRect(8.5, 9.5, P - 1, P - 1);
    g.addChild(plate);

    this.portrait = new PIXI.Sprite(PIXI.Texture.EMPTY);
    this.portrait.width = P; this.portrait.height = P;
    this.portrait.x = 8; this.portrait.y = 9;
    this.portrait.visible = false;
    g.addChild(this.portrait);

    // the 本 seal sits over the portrait's corner
    const seal = UI.pxText('本', { size: 13, font: UI.FONT_JP_HEAVY, fill: 0x141a22, outline: 0, shadow: false });
    const sealBg = new PIXI.Graphics();
    sealBg.beginFill(C.gold, 0.92).drawRect(0, 0, 20, 20).endFill();
    sealBg.x = 66; sealBg.y = 67;
    seal.x = 68; seal.y = 68;
    g.addChild(sealBg, seal);

    this.nameText = UI.pxText('両馬 二郎', { size: 13, font: UI.FONT_JP_HEAVY, fill: 0xf0e6cf, outline: 2 });
    this.nameText.x = 96; this.nameText.y = 10;
    g.addChild(this.nameText);
    this.subText = UI.pxText('', { size: 8, font: UI.FONT_JP, fill: 0x7d8794, outline: 2 });
    this.subText.x = 96; this.subText.y = 28;
    g.addChild(this.subText);

    // ---- HP: dark track, lagging after-image, filled bar, tick marks
    this.hpBarX = 96; this.hpBarY = 44; this.hpBarW = 232; this.hpBarH = 13;
    const mkBar = (color, a) => {
      const gg = new PIXI.Graphics();
      gg.beginFill(color, a).drawRect(0, 0, this.hpBarW, this.hpBarH).endFill();
      gg.x = this.hpBarX; gg.y = this.hpBarY;
      g.addChild(gg); return gg;
    };
    this.hpBack = mkBar(0x05070a, 0.98);
    this.hpBack.lineStyle(1, 0x4a4038, 1).drawRect(0.5, 0.5, this.hpBarW - 1, this.hpBarH - 1);
    this.hpLagG = new PIXI.Graphics(); this.hpLagG.x = this.hpBarX; this.hpLagG.y = this.hpBarY; g.addChild(this.hpLagG);
    this.hpFillG = new PIXI.Graphics(); this.hpFillG.x = this.hpBarX; this.hpFillG.y = this.hpBarY; g.addChild(this.hpFillG);
    this.hpShine = new PIXI.Graphics(); this.hpShine.x = this.hpBarX; this.hpShine.y = this.hpBarY; g.addChild(this.hpShine);
    this.hpTicks = new PIXI.Graphics(); this.hpTicks.x = this.hpBarX; this.hpTicks.y = this.hpBarY; g.addChild(this.hpTicks);
    for (let i = 1; i < 4; i++) this.hpTicks.beginFill(0x000000, 0.5).drawRect(this.hpBarW * i / 4, 0, 1, this.hpBarH).endFill();

    // ---- MP
    this.mpBarY = 64; this.mpBarW = 232; this.mpBarH = 7;
    this.mpBack = new PIXI.Graphics();
    this.mpBack.beginFill(0x05070a, 0.98).drawRect(0, 0, this.mpBarW, this.mpBarH).endFill();
    this.mpBack.lineStyle(1, 0x24404a, 1).drawRect(0.5, 0.5, this.mpBarW - 1, this.mpBarH - 1);
    this.mpBack.x = this.hpBarX; this.mpBack.y = this.mpBarY;
    g.addChild(this.mpBack);
    this.mpFillG = new PIXI.Graphics(); this.mpFillG.x = this.hpBarX; this.mpFillG.y = this.mpBarY; g.addChild(this.mpFillG);

    // numeric readout: HP on the right of the bar, MP tucked under it
    this.hpText = UI.pxText('100 / 100', { size: 9, font: UI.FONT_BIG, fill: 0xf2e8d2, outline: 2 });
    this.hpText.anchor.set(1, 0);
    this.hpText.x = this.hpBarX + this.hpBarW; this.hpText.y = this.hpBarY + this.hpBarH + 2;
    g.addChild(this.hpText);
    this.mpText = UI.pxText('MP 100', { size: 9, font: UI.FONT_JP, fill: 0x7fc4d8, outline: 2 });
    this.mpText.x = this.hpBarX; this.mpText.y = this.hpBarY + this.mpBarH + 3;
    g.addChild(this.mpText);

    this.lowPulse = 0;
  }

  setPortrait(tex) {
    if (!tex || tex._procedural) return;
    this.portrait.texture = tex;
    // crop-fill the square plate
    const bb = tex.baseTexture;
    const side = Math.min(bb.width, bb.height);
    this.portrait.texture = new PIXI.Texture(bb, new PIXI.Rectangle((bb.width - side) / 2, 0, side, side));
    this.portrait.visible = true;
  }

  setNameLine(name, sub) {
    this.nameText.text = name;
    if (sub != null) this.subText.text = sub;
  }

  // ------------------------------------------------------------ top-right
  _buildScore() {
    const g = this.scoreBox = new PIXI.Container();
    g.x = UI.W - UI.SAFE; g.y = UI.SAFE;
    this.root.addChild(g);

    const frame = UI.menuFrame(268, 92, { tex: this.reg.textures.get('ui_box_medium') });
    frame.x = -268;
    g.addChild(frame);

    const lab = UI.pxText('偏差値 / DEVIATION', { size: 8, font: UI.FONT_BIG, fill: 0x8d96a1, outline: 2 });
    lab.x = -252; lab.y = 10;
    g.addChild(lab);

    this.scoreText = UI.pxText('0', { size: 26, font: UI.FONT_BIG, fill: 0xf2e6c8, outline: 4 });
    this.scoreText.anchor.set(1, 0);
    this.scoreText.x = -14; this.scoreText.y = 24;
    g.addChild(this.scoreText);

    this.bestText = UI.pxText('BEST 0', { size: 9, font: UI.FONT_BIG, fill: 0x7d8794, outline: 2 });
    this.bestText.anchor.set(1, 0);
    this.bestText.x = -14; this.bestText.y = 60;
    g.addChild(this.bestText);

    this.floorText = UI.pxText('B1F', { size: 11, font: UI.FONT_BIG, fill: 0xc8a86a, outline: 2 });
    this.floorText.x = -252; this.floorText.y = 62;
    g.addChild(this.floorText);

    // combo, bottom-right, only visible while a chain is live
    this.combo = new PIXI.Container();
    this.combo.x = UI.W - UI.SAFE; this.combo.y = UI.SAFE + 100;
    this.root.addChild(this.combo);
    this.comboNum = UI.pxText('0', { size: 30, font: UI.FONT_BIG, fill: C.gold, outline: 4 });
    this.comboNum.anchor.set(1, 0);
    this.combo.addChild(this.comboNum);
    this.comboLabel = UI.pxText('COMBO ×1.0', { size: 9, font: UI.FONT_BIG, fill: 0xb9a06a, outline: 2 });
    this.comboLabel.anchor.set(1, 0);
    this.comboLabel.y = 36;
    this.combo.addChild(this.comboLabel);
    this.comboBar = new PIXI.Graphics();
    this.combo.addChild(this.comboBar);
    this.combo.alpha = 0;
    this.comboPunch = 0;

    // run timer (the corridor collapses on a clock)
    this.timerText = UI.pxText('00:00', { size: 9, font: UI.FONT_BIG, fill: 0x7c8794, outline: 2 });
    this.timerText.anchor.set(1, 0);
    this.timerText.x = UI.W - UI.SAFE; this.timerText.y = UI.SAFE + 150;
    this.root.addChild(this.timerText);
  }

  // ------------------------------------------------------------ bottom slots
  _buildSlots() {
    const g = this.slots = new PIXI.Container();
    g.x = UI.W / 2; g.y = UI.H - UI.SAFE + 6;
    this.root.addChild(g);
    // each slot: a framed square, an ability icon, a key cap, a short JP label
    this.slotDefs = [
      { key: 'confirm', label: '本質弾', icon: 'fx_magic_orb', tint: 0x9fe8ff },
      { key: 'skill', label: '爆ぜる', icon: 'fx_fireball', tint: 0xffb060 },
      { key: 'dash', label: '回避', icon: 'mon_insubstantial_wisp', tint: 0xbfe6ff },
      { key: 'pause', label: '中断', icon: 'ui_heart_full', tint: 0xd7b169 },
    ];
    this.slotNodes = [];
    const n = this.slotDefs.length;
    const spacing = 78;
    this.slotDefs.forEach((s, i) => {
      const c = new PIXI.Container();
      c.x = (i - (n - 1) / 2) * spacing;
      c.y = 0;
      const S = 56;
      const box = new PIXI.Graphics();
      box.beginFill(0x070a10, 0.86).drawRoundedRect(-S / 2, -S, S, S, 3).endFill();
      box.lineStyle(1, 0x3a4653, 1).drawRoundedRect(-S / 2 + 0.5, -S + 0.5, S - 1, S - 1, 3);
      box.lineStyle(1, 0xd7b169, 0.22).drawRoundedRect(-S / 2 + 4, -S + 4, S - 8, S - 8, 2);
      c.addChild(box);
      const icon = new PIXI.Sprite(this.reg.textures.get(s.icon) || PIXI.Texture.WHITE);
      icon.anchor.set(0.5);
      icon.width = icon.height = 34;
      icon.y = -S / 2;
      icon.tint = s.tint;
      c.addChild(icon);
      const cap = UI.keycap(this.input.label(s.key), { size: 7, tint: 0xd7b169 });
      cap.x = -cap._w / 2; cap.y = -S - cap._h - 4;
      c.addChild(cap);
      const lbl = UI.pxText(s.label, { size: 9, fill: 0x8f99a4, outline: 2 });
      lbl.anchor.set(0.5, 0);
      lbl.y = 3;
      c.addChild(lbl);
      const cd = new PIXI.Graphics();
      c.addChild(cd);
      g.addChild(c);
      this.slotNodes.push({ c, box, icon, cd, cap, lbl, key: s.key, S });
    });
  }

  setDeviceLabels() {
    this.slotDefs.forEach((s, i) => {
      const node = this.slotNodes[i];
      const cap = UI.keycap(this.input.label(s.key), { size: 7, tint: 0xd7b169 });
      node.c.removeChild(node.cap); node.cap.destroy({ children: true });
      cap.x = -cap._w / 2; cap.y = -node.S - cap._h - 4;
      node.c.addChild(cap);
      node.cap = cap;
    });
  }

  // ------------------------------------------------------------ minimap
  _buildMinimap() {
    const g = this.minimap = new PIXI.Container();
    g.x = UI.SAFE; g.y = UI.H - UI.SAFE - 118;
    this.root.addChild(g);
    const frame = UI.menuFrame(118, 118, { tex: this.reg.textures.get('ui_box_small') });
    frame.alpha = 0.9;
    g.addChild(frame);
    const lab = UI.pxText('MAP', { size: 7, font: UI.FONT_BIG, fill: 0x6f7883, outline: 2 });
    lab.x = 8; lab.y = 6;
    g.addChild(lab);
    this.mapG = new PIXI.Graphics();
    g.addChild(this.mapG);
    this.mapCells = [];
    this.mapOrigin = null;
  }

  // ------------------------------------------------------------ objective
  _buildObjective() {
    const g = this.objective = new PIXI.Container();
    g.x = UI.W - UI.SAFE; g.y = UI.H - UI.SAFE;
    this.root.addChild(g);
    this.objText = UI.pxText('', { size: 11, fill: 0xc4bca8, outline: 3, align: 'right' });
    this.objText.anchor.set(1, 1);
    g.addChild(this.objText);
    this.objAlpha = 0;

    // tutorial prompt: one short line, sits above the slots
    this.prompt = new PIXI.Container();
    this.prompt.x = UI.W / 2; this.prompt.y = UI.H - UI.SAFE - 118;
    this.root.addChild(this.prompt);
    this.promptText = UI.pxText('', { size: 12, fill: 0xe8e0cc, outline: 3, align: 'center' });
    this.promptText.anchor.set(0.5, 1);
    this.prompt.addChild(this.promptText);
    this.prompt.alpha = 0;
    this.promptCd = 0;
  }

  showPrompt(text, { key = null, hold = 2.6, tint = 0xe8e0cc } = {}) {
    if (!this.settings.hints) return;
    const label = key ? `${text}` : text;
    this.promptText.text = label;
    this.promptText.style.fill = tint;
    this.prompt.alpha = 1;
    this.promptCd = hold;
  }

  setObjective(text) {
    this.objText.text = text;
    this.objAlpha = 1;
  }

  // ------------------------------------------------------------ boss bar
  _buildBossBar() {
    const g = this.bossBar = new PIXI.Container();
    g.x = UI.W / 2; g.y = UI.SAFE + 78;      // below the score plate, never over it
    this.root.addChild(g);
    this.bossName = UI.pxText('', { size: 12, font: UI.FONT_BIG, fill: 0xe8d3a8, outline: 3 });
    this.bossName.anchor.set(0.5, 0);
    this.bossName.y = -2;
    g.addChild(this.bossName);
    this.bossTitle = UI.pxText('', { size: 9, fill: 0xa08a64, outline: 2 });
    this.bossTitle.anchor.set(0.5, 0);
    this.bossTitle.y = 16;
    g.addChild(this.bossTitle);
    const bw = 560, bh = 13;
    const back = new PIXI.Graphics();
    back.beginFill(0x05070a, 0.92).drawRect(-bw / 2, 32, bw, bh).endFill();
    back.lineStyle(1, 0x5a4a34, 1).drawRect(-bw / 2 + 0.5, 32.5, bw - 1, bh - 1);
    g.addChild(back);
    this.bossFill = new PIXI.Graphics();
    g.addChild(this.bossFill);
    this.bossLag = new PIXI.Graphics();
    g.addChild(this.bossLag);
    this.bossW = bw; this.bossH = bh;
    g.visible = false;
    this.bossHp = 1; this.bossHpLag = 1;
  }

  showBoss(boss) {
    this.bossBar.visible = true;
    this.bossName.text = boss.name;
    this.bossTitle.text = boss.title || '';
    this.bossHp = this.bossHpLag = 1;
    this.bossBar.alpha = 0;
    const t0 = performance.now();
    const fade = () => {
      const p = Math.min(1, (performance.now() - t0) / 600);
      this.bossBar.alpha = p;
      if (p < 1) requestAnimationFrame(fade);
    };
    fade();
  }
  hideBoss() { this.bossBar.visible = false; }

  // ------------------------------------------------------------ floaters
  _buildFloaters() {
    this.floaters = new PIXI.Container();
    this.root.addChild(this.floaters);
    this.toasts = new UI.ToastStack({ audio: this.audio });
    this.toasts.x = UI.W - UI.SAFE;
    this.toasts.y = UI.SAFE + 190;
    this.root.addChild(this.toasts);
  }

  floatText(worldX, worldY, text, { color = 0xffffff, size = 14, crit = false, vy = -70, life = 0.9 } = {}) {
    const t = UI.pxText(text, { size: crit ? size + 6 : size, font: crit ? UI.FONT_BIG : UI.FONT_JP, fill: color, outline: 3 });
    t.anchor.set(0.5, 0.5);
    t._vx = (Math.random() - 0.5) * 40; t._vy = vy; t._age = 0; t._life = life;
    t._wx = worldX; t._wy = worldY;
    this.floaters.addChild(t);
    return t;
  }

  // ------------------------------------------------------------ hit vignette
  _buildHitVignette() {
    this.hitVig = new PIXI.Graphics();
    this.hitVig.beginFill(0xb02030, 0.0).drawRect(0, 0, UI.W, UI.H).endFill();
    this.hitVig.alpha = 0;
    this.hitVig.visible = false;
    this.root.addChildAt(this.hitVig, 0);
    this.hitVigLevel = 0;
  }

  hurtFlash() { this.hitVigLevel = 1; this.hitVig.visible = true; }

  /** Only touch Text.text when the string actually changed — every write
   *  re-rasterises the glyph texture, and the HUD updates 60×/second. */
  _setText(node, str, after) {
    if (node._lastStr === str) return;
    node._lastStr = str;
    node.text = str;
    after?.();
  }

  // ------------------------------------------------------------ data plumbing
  setVitals(hp, hpMax, mp, mpMax, { snap = false } = {}) {
    this.hp = hp; this.hpMax = hpMax; this.mp = mp; this.mpMax = mpMax;
    if (snap) this.hpLag = hp;
  }

  setScore(score, best) {
    this.score = score;
    if (best != null) this.best = best;
  }

  setCombo(n, mult, timeLeft, window) {
    this.comboN = n; this.comboMult = mult;
    this.comboTimeLeft = timeLeft; this.comboWindow = window;
  }

  // ------------------------------------------------------------ update
  update(dt, ctx) {
    this.t += dt;
    // ---- vitals: the lag bar chases the real value, the real value snaps
    const hpPct = Math.max(0, this.hp / this.hpMax);
    this.hpLag = this.hpLag > this.hp ? this.hp : Math.min(this.hp, this.hpLag + (this.hp - this.hpLag) * Math.min(1, dt * 2.2));
    const lagPct = Math.max(0, this.hpLag / this.hpMax);
    const lagA = Math.min(1, dt * 3 + 0.02);
    this.hpLag = hpPct * this.hpMax + (this.hpLag - hpPct * this.hpMax) * (1 - lagA);

    this.hpLagG.clear();
    if (lagPct > hpPct) {
      this.hpLagG.beginFill(0xf0f0f0, hpPct < 0.3 ? 0.75 : 0.55)
        .drawRect(this.hpBarW * hpPct, 0, this.hpBarW * (lagPct - hpPct), this.hpBarH).endFill();
    }
    const low = hpPct <= 0.3;
    this.lowPulse = low ? 0.5 + Math.sin(this.t * 9) * 0.5 : 0;
    const hpCol = low ? mixColor(0xd8503f, 0xff8a7a, this.lowPulse) : (hpPct > 0.6 ? 0xc23a35 : 0xd8683a);
    this.hpFillG.clear();
    this.hpFillG.beginFill(hpCol, 1).drawRect(0, 0, this.hpBarW * hpPct, this.hpBarH).endFill();
    this.hpFillG.beginFill(0xffffff, 0.22).drawRect(0, 0, this.hpBarW * hpPct, 4).endFill();
    // tick marks every 25%
    for (let i = 1; i < 4; i++) this.hpFillG.beginFill(0x000000, 0.45).drawRect(this.hpBarW * i / 4, 0, 1, this.hpBarH).endFill();

    this.hpShine.clear();
    const hpShineX = ((this.t * 40) % (this.hpBarW + 80)) - 80;
    this.hpShine.beginFill(0xffffff, 0.07).drawRect(hpShineX, 0, 26, this.hpBarH).endFill();
    this.hpShine.mask = null;

    const mpPct = Math.max(0, this.mp / this.mpMax);
    this.mpFillG.clear();
    this.mpFillG.beginFill(0x2f8ea3, 1).drawRect(0, 0, this.mpBarW * mpPct, this.mpBarH).endFill();
    this.mpFillG.beginFill(0x7fe6f0, 0.5).drawRect(0, 0, this.mpBarW * mpPct, 2).endFill();

    this._setText(this.hpText, `${Math.ceil(this.hp)} / ${this.hpMax}`, () => {
      this.hpText.x = this.hpBarX + this.hpBarW - this.hpText.width;
    });
    this._setText(this.mpText, `MP ${Math.round(this.mp)}`);

    // ---- score odometer
    if (Math.abs(this.scoreShown - this.score) > 0.5) {
      this.scoreShown += (this.score - this.scoreShown) * Math.min(1, dt * 9);
    } else this.scoreShown = this.score;
    this._setText(this.scoreText, fixed6(Math.round(this.scoreShown)));
    this._setText(this.bestText, `BEST ${fixed6(this.best)}`);
    if (ctx?.floor != null) this._setText(this.floorText, `B${ctx.floor}F`);

    // ---- combo
    const showCombo = (this.comboN || 0) > 1;
    this.combo.alpha += ((showCombo ? 1 : 0) - this.combo.alpha) * Math.min(1, dt * 8);
    if (this.comboN != null) {
      this._setText(this.comboNum, String(this.comboN));
      this._setText(this.comboLabel, `COMBO ×${(this.comboMult || 1).toFixed(1)}`);
      const frac = Math.max(0, Math.min(1, (this.comboTimeLeft || 0) / (this.comboWindow || 1)));
      this.comboBar.clear();
      this.comboBar.beginFill(0x05070a, 0.8).drawRect(-90, 52, 90, 4).endFill();
      this.comboBar.beginFill(frac < 0.35 ? 0xd8503f : C.gold, 0.95).drawRect(-90, 52, 90 * frac, 4).endFill();
    }
    this.comboPunch = Math.max(0, this.comboPunch - dt * 5);
    const punch = 1 + this.comboPunch * 0.28;
    this.comboNum.scale.set(punch);
    this.comboNum.x = 0;
    this.comboNum.style.fill = (this.comboMult || 1) > 2.6 ? 0xffe08a : C.gold;

    if (ctx?.timer != null) {
      const s = Math.max(0, Math.ceil(ctx.timer));
      this._setText(this.timerText, `${UI.pad2(s / 60)}:${UI.pad2(s % 60)}`);
      this.timerText.style.fill = ctx.timer < 6 ? 0xd8503f : 0x7c8794;
    }

    // ---- boss bar
    if (this.bossBar.visible && ctx?.boss) {
      this.bossHp += (ctx.boss.hp / ctx.boss.maxHp - this.bossHp) * Math.min(1, dt * 14);
      this.bossHpLag += (ctx.boss.hp / ctx.boss.maxHp - this.bossHpLag) * Math.min(1, dt * 3.2);
      const w = this.bossW, h = this.bossH;
      this.bossLag.clear();
      this.bossLag.beginFill(0xf0e0c0, 0.5).drawRect(-w / 2, 32, w * this.bossHpLag, h).endFill();
      this.bossFill.clear();
      const col = this.bossHp < 0.25 ? 0xd8503f : 0xb03040;
      this.bossFill.beginFill(col, 1).drawRect(-w / 2, 32, w * this.bossHp, h).endFill();
      this.bossFill.beginFill(0xffffff, 0.18).drawRect(-w / 2, 32, w * this.bossHp, 3).endFill();
      for (let i = 1; i < 6; i++) this.bossFill.beginFill(0x000000, 0.4).drawRect(-w / 2 + w * i / 6, 32, 1, h).endFill();
    }

    // ---- floaters: they live in world space, so convert from the stage
    const cam = ctx?.cam;
    for (let i = this.floaters.children.length - 1; i >= 0; i--) {
      const f = this.floaters.children[i];
      f._age += dt;
      f._vy += 42 * dt;
      f._wy += f._vy * dt;
      f._wx += f._vx * dt;
      const p = f._age / f._life;
      f.alpha = p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25;
      if (cam) {
        f.x = f._wx + cam.offX;
        f.y = f._wy + cam.offY;
      }
      if (p >= 1) { f.destroy(); this.floaters.removeChild(f); }
    }

    // ---- objective fades back after a few seconds
    if (this.objAlpha > 0) {
      this.objFadeT = (this.objFadeT || 0) + dt;
      if (this.objFadeT > 4) this.objText.alpha = Math.max(0, this.objText.alpha - dt * 1.5);
    } else this.objText.alpha = 0;

    // ---- prompt timer
    if (this.promptCd > 0) {
      this.promptCd -= dt;
      if (this.promptCd <= 0) {
        const t0 = performance.now();
        const a0 = this.prompt.alpha;
        const fade = () => {
          const p = Math.min(1, (performance.now() - t0) / 400);
          this.prompt.alpha = a0 * (1 - p);
          if (p < 1) requestAnimationFrame(fade);
        };
        fade();
      }
    }

    // ---- hit vignette decay
    if (this.hitVigLevel > 0) {
      this.hitVigLevel = Math.max(0, this.hitVigLevel - dt * 2.2);
      this.hitVig.clear();
      this.hitVig.beginFill(0xa01f2a, 0.34 * this.hitVigLevel).drawRect(0, 0, UI.W, UI.H).endFill();
      this.hitVig.visible = this.hitVigLevel > 0.01;
    }

    // ---- slot cooldowns
    if (ctx?.cooldowns) {
      for (const node of this.slotNodes) {
        const cd = ctx.cooldowns[node.key];
        node.cd.clear();
        if (cd && cd.remain > 0) {
          const S = node.S, p = cd.remain / cd.total;
          node.cd.beginFill(0x000000, 0.6).drawRect(-S / 2, -S, S, S * p).endFill();
          node.cd.lineStyle(1, 0xd7b169, 0.5).drawRect(-S / 2 + 1, -S + 1, S - 2, S - 2);
        }
        node.icon.tint = cd && cd.remain > 0 ? 0x6a7078 : 0xf0e6d2;
      }
    }

    this.toasts.update(dt);
    if (ctx?.hudAlpha != null) this.root.alpha = ctx.hudAlpha;
    this.root.visible = !this.hidden;
  }

  // ------------------------------------------------------------ minimap
  drawMinimap(world, current, visited) {
    if (!this.mapG) return;
    const g = this.mapG;
    g.clear();
    const cell = 14;
    const cx = 6 + 53, cy = 6 + 53;
    for (const k of visited) {
      const [tx, ty] = k.split(',').map(Number);
      const dx = (tx - current.tx) * cell, dy = (ty - current.ty) * cell;
      if (Math.abs(dx) > 46 || Math.abs(dy) > 46) continue;
      const isCur = tx === current.tx && ty === current.ty;
      const isBoss = world.rooms.get(k)?.boss;
      g.beginFill(isCur ? 0xd7b169 : isBoss ? 0x9a3a3a : 0x2a3644, isCur ? 1 : 0.85)
        .drawRect(cx + dx - cell / 2 + 1, cy + dy - cell / 2 + 1, cell - 2, cell - 2).endFill();
    }
    // player dot
    g.beginFill(0xfff2c8, 1).drawRect(cx - 2, cy - 2, 4, 4).endFill();
    // compass N
    g.beginFill(0x6f7883, 0.8).drawPolygon([cx, 4, cx - 3, 9, cx + 3, 9]).endFill();
  }
}

/** Zero-padded score with NO leading-zero glyph churn (a fixed 6-wide
 *  template keeps the rasterised glyph set stable). */
function fixed6(n) {
  const s = String(Math.max(0, n | 0));
  return s.length >= 6 ? s.slice(0, 6) : '0'.repeat(6 - s.length) + s;
}

function mixColor(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}
