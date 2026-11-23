// ---------------------------------------------------------------------------
//  ゲームプレイ — the score-attack proper.
//
//  Actor pipeline per frame:  input → player → enemies → shots → pickups →
//  collisions → effects → camera → HUD.  The loop is delta-time driven with a
//  hard clamp, so speed is identical on a 30 Hz laptop and a 144 Hz monitor.
// ---------------------------------------------------------------------------
import * as UI from '../ui.js';
import { BESTIARY, BOSSES, WAVES, RUN, DIALOGUE, DIFFICULTY } from '../game/content.js';
import { World, ROOM, ROOM_H } from '../game/world.js';
import { Stage, makeGlow, mixColor, shade } from '../game/render.js';
import { Hud } from '../game/hud.js';

// A soft round essence orb, baked once. Cleaner than the 32px icon sprites
// when scaled down to projectile size.
function makeOrbTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 48;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(24, 24, 1, 24, 24, 23);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.75)');
  grd.addColorStop(0.8, 'rgba(255,255,255,0.22)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 48, 48);
  const t = PIXI.Texture.from(c);
  return t;
}

const DIR8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.707, 0.707], [-0.707, 0.707], [0.707, -0.707], [-0.707, -0.707]];

export class PlayState {
  constructor(ctx) { Object.assign(this, ctx); }

  // ============================================================== enter
  enter(data = {}) {
    this.mode = 'play';
    this.t = 0;
    this.paused = false;
    this.over = false;
    this.floor = data.floor ?? 1;
    this.diff = DIFFICULTY[data.difficulty] || DIFFICULTY.mid;
    this.visited = new Set();
    this.roomsCleared = new Set();
    this.score = 0;
    this.kills = 0;
    this.combo = 0; this.comboMult = 1; this.comboTimer = 0;
    this.bestCombo = 0;
    this.shake = this.settings.shake;
    this.runTime = 0;
    this.floorTimer = RUN.floorTime;
    this.introBeat = data.intro !== false;
    this.pendingBoss = null;
    this.playerLevel = 1;
    this.essence = 0;
    this.hudAlpha = 1;
    this.idleTime = 0;

    // ---- world + stage
    this.map = new World({ registry: this.registry, seed: (data.seed ?? Date.now()) >>> 0 });
    this.map.floor = Math.max(0, this.floor - 1);
    this.view = new Stage({ app: this.app, registry: this.registry, world: this.map, reducedMotion: this.reducedMotion });
    this.world.removeChildren();
    this.world.addChild(this.view.root);

    this.hud = new Hud({ registry: this.registry, audio: this.audio, input: this.input, settings: this.settings });
    this.ui.addChild(this.hud.root);
    this._offDevice = this.input.on('devicechange', () => this.hud.setDeviceLabels());

    // ---- entity pools
    this.enemies = [];
    this.shots = [];
    this.eShots = [];
    this.drops = [];
    this.fx = [];
    this.pickups = [];

    this._buildPlayer();
    this._bindInputs();
    this._enterRoom(0, 0, { instant: true });

    // ---- boot the audio scene
    this.audio.playMusic('bgm_game', { fade: 1200 });
    this.audio.playAmbient('amb_dungeon', 0.22);
    this.audio.duckMusic(0.7, 400);

    // ---- opening beat: the novel's three-layer monologue, one line at a time
    if (this.introBeat && !this.save.seenIntro) {
      this._showIntro();
    } else {
      this.hud.setObjective('教室の本質をすべて回収しろ。');
      this.hud.showPrompt('移動 — WASD / 矢印 / 左スティック', { hold: 4.2 });
    }

    this.cam = { offX: 0, offY: 0 };
    this.fadeInT = 0;
  }

  _showIntro() {
    let i = 0;
    // The message window replaces the HUD rather than stacking on it: HUD
    // fades to 20% while a character is talking, which also keeps the bottom
    // band free for the skill slots.
    this.dialogue?.destroy({ children: true });
    this.dialogue = new UI.DialogueWindow({ width: 1000, audio: this.audio, tex: this.registry.textures.get('ui_box_medium') });
    this.dialogue.x = (UI.W - 1000) / 2;
    this.dialogue.y = UI.H - 186;
    this.hudFade = 0.2;
    this.ui.addChild(this.dialogue);
    this.mode = 'dialogue';
    const next = () => {
      if (i >= DIALOGUE.intro.length) {
        const dlg = this.dialogue;
        dlg.hide();
        setTimeout(() => { dlg._destroyed = true; dlg.destroy({ children: true }); }, 240);
        this.dialogue = null;
        this.mode = 'play';
        this.save.seenIntro = true;
        this.hud.setObjective('教室の本質をすべて回収しろ。');
        this.hud.showPrompt('移動 — WASD / 矢印 / 左スティック', { hold: 4.2 });
        return;
      }
      const line = DIALOGUE.intro[i++];
      const tex = this.registry.textures.get(line.portrait);
      this.dialogue.show({
        name: line.name,
        text: line.text,
        portrait: tex && !tex._procedural ? tex : null,
        tintName: line.name === '倉石' ? 0xb9c8ff : UI.C.gold,
      });
    };
    next();
    this._introNext = () => {
      if (!this.dialogue) return;
      if (this.dialogue.advance()) next();
    };
  }

  // ============================================================== player
  _buildPlayer() {
    const p = this.player = {
      x: ROOM / 2, y: ROOM_H * 0.62, vx: 0, vy: 0,
      hp: Math.round(RUN.player.hp * (this.diff.player || 1)),
      hpMax: Math.round(RUN.player.hp * (this.diff.player || 1)),
      mp: RUN.player.mp, mpMax: RUN.player.mp,
      r: RUN.player.radius,
      aimX: 1, aimY: 0,
      iframe: 0, dashT: 0, dashCd: 0,
      shotCd: 0, skillCd: 0, hurtCd: 0,
      facing: 1, step: 0, alive: true,
    };
    // The hero on the floor is the pixel doll; the Drive illustration is used
    // where its detail actually reads (HUD plate, dialogue, credits).
    const root = this.playerNode = new PIXI.Container();
    this.playerShadow = new PIXI.Graphics();
    this.playerShadow.beginFill(0x000000, 0.45).drawEllipse(0, 0, 26, 10).endFill();
    root.addChild(this.playerShadow);

    const halo = this.playerHalo = makeGlow(0x59d7c8, 132);
    halo.alpha = 0.5;
    halo.blendMode = PIXI.BLEND_MODES.ADD;
    root.addChild(halo);

    // ---- body: the DCSS player doll, layered exactly as DCSS layers it:
    // base → coat → cloak → hood. Every layer is the same 32px grid as the
    // monsters, so 両馬 reads as part of the world instead of pasted on it.
    const doll = this.playerDoll = new PIXI.Container();
    const layer = (id, tint, scale = 1, dy = 0) => {
      const tex = this.registry.textures.get(id);
      if (!tex || tex._procedural) return null;
      const sp = new PIXI.Sprite(tex);
      sp.anchor.set(0.5, 0.94);
      sp.width = sp.height = 96 * scale;
      sp.tint = tint;
      sp.y = dy;
      doll.addChild(sp);
      return sp;
    };
    // pc_base already carries head and face; the body layer is the coat
    layer('pc_base', 0xe8d2b8);          // skin
    layer('pc_body', 0x9fb4d2);          // slate school coat
    this.playerHead = layer('pc_hair', 0x1d232b);   // one dark layer reads as hair + collar
    root.addChild(doll);

    // an essence mote orbiting him — the 本質 he carries with him
    const mote = new PIXI.Sprite(this.registry.textures.get('fx_magic_orb') || PIXI.Texture.WHITE);
    mote.anchor.set(0.5);
    mote.width = mote.height = 22;
    mote.tint = 0x9fffdc;
    this.playerMote = mote;
    root.addChild(mote);

    // aiming reticle / muzzle point
    this.aimNode = new PIXI.Container();
    const ret = new PIXI.Graphics();
    ret.lineStyle(1, 0xd7b169, 0.55).drawCircle(0, 0, 12);
    ret.lineStyle(1, 0xd7b169, 0.9);
    ret.moveTo(-18, 0).lineTo(-12, 0); ret.moveTo(12, 0).lineTo(18, 0);
    ret.moveTo(0, -18).lineTo(0, -12); ret.moveTo(0, 12).lineTo(0, 18);
    this.aimNode.addChild(ret);
    root.addChild(this.aimNode);

    this.view.entLayer.addChild(root);
    this.hud.setVitals(p.hp, p.hpMax, p.mp, p.mpMax, { snap: true });
    this.hud.best = this.save.best;
    this.hud.setPortrait(this.registry.textures.get('art_ryoma_01_tsuujou'));
    this.hud.setNameLine('両馬 二郎', 'RYOMA JIRO · 2年B組');
  }

  _bindInputs() {
    this._offs = [];
    const on = (a, fn) => this._offs.push(this.input.on(a, fn));
    on('pause', () => {
      if (this.mode === 'dialogue') { this._introNext?.(); return; }
      if (this.paused) { this.game.states.pause.resumeFromOverlay(); return; }
      this._openPause();
    });
    on('confirm', () => {
      if (this.mode === 'dialogue') { this._introNext?.(); return; }
    });
    on('skill', () => this._skill());
    on('dash', () => this._dash());
  }

  // ============================================================== rooms
  _enterRoom(tx, ty, { instant = false } = {}) {
    const room = this.map.roomAt(tx, ty);
    const dist = Math.abs(tx) + Math.abs(ty);
    this.currentRoom = room;
    this.visited.add(this.map.key(tx, ty));
    this.view.rebuildRoom(room, dist);
    // Enemies are cleared per room, never accumulated: whatever followed you
    // into the doorway is dropped with the room it belonged to.
    for (const e of this.enemies) { e.dead = true; e.node.destroy({ children: true }); }
    this.enemies = [];
    for (const b of this.eShots) b.node.destroy({ children: true });
    this.eShots = [];
    this.floorTimer = RUN.floorTime + (this.floor - 1) * 2;

    // place player at the door they came in through
    const prev = this.lastRoom;
    if (prev && !instant) {
      const door = World.doorOf(prev, room);
      const inset = 190;
      if (door === 'e') { this.player.x = inset; this.player.y = ROOM_H / 2; }
      else if (door === 'w') { this.player.x = ROOM - inset; this.player.y = ROOM_H / 2; }
      else if (door === 's') { this.player.x = ROOM / 2; this.player.y = ROOM_H - inset; }
      else { this.player.x = ROOM / 2; this.player.y = inset; }
      this.player.vx = this.player.vy = 0;
    }
    this.lastRoom = room;
    this.roomGrace = 0.7;

    // spawn the welcome party — unless the room was already cleared
    if (!this.roomsCleared.has(this.map.key(tx, ty))) {
      this._spawnWave(room, dist);
      this.hud.setObjective(dist === 0 ? 'この教室の本質を回収しろ。' : '廊下が組み替わった。本質を追え。');
    } else {
      this.tierPool = [];
      this.spawnTimer = Infinity;
      this.hud.setObjective('戻ってきた教室。静かだ。');
    }
    // boss rooms: every third floor root
    const bossIdx = this.map.bossFor(this.floor);
    if (dist === 0 && bossIdx >= 0 && !this.pendingBoss && this.floor % 3 === 0) {
      this.pendingBoss = BOSSES[bossIdx % BOSSES.length];
    }
    this.hud.drawMinimap(this.map, room, this.visited);
    this._roomEnterFlash();
  }

  _roomEnterFlash() {
    this.view.shake(6);
  }

  _spawnWave(room, dist) {
    const { tier, budget } = this.map.threatFor(room, dist);
    let left = Math.round(budget * (this.diff.enemy || 1) * 0.7);
    const picked = [];
    let guard = 0;
    while (left > 0 && guard++ < 80) {
      const id = tier.pool[Math.floor(Math.random() * tier.pool.length)];
      const cost = WAVES.threatOf[id] || 2;
      if (cost > left + 1) break;
      left -= cost;
      picked.push(id);
    }
    const cfg = tier;
    for (const id of picked) {
      const def = BESTIARY[id];
      if (!def) continue;
      this._spawnEnemy(def);
    }
    this.spawnCadence = cfg.cadence;
    this.spawnTimer = cfg.cadence;
    this.tierPool = cfg.pool;
    this.tierBudget = 0;
  }

  _spawnEnemy(def, at = null, extra = {}) {
    const tex = this.regTex(def.sprite);
    const node = new PIXI.Container();
    const shadow = new PIXI.Graphics();
    shadow.beginFill(0x000000, 0.4).drawEllipse(0, 0, def.r * 0.9, def.r * 0.32).endFill();
    shadow.y = 6;
    node.addChild(shadow);

    let sprite;
    const frames = this.registry.framesById?.[def.sprite];
    if (frames?.length) {
      sprite = new PIXI.AnimatedSprite(frames);
      sprite.animationSpeed = 0.12 + Math.random() * 0.05;
      sprite.play();
      sprite.loop = true;
    } else {
      sprite = new PIXI.Sprite(tex || PIXI.Texture.WHITE);
    }
    sprite.anchor.set(0.5, 0.86);
    const scale = def.r / 15;
    sprite.width = sprite.height = 64 * scale;
    sprite.tint = def.tint || 0xffffff;
    node.addChild(sprite);

    const glow = makeGlow(def.dash ? 0xbcd6ff : 0x88a8c8, 120 * scale);
    glow.blendMode = PIXI.BLEND_MODES.ADD;
    glow.alpha = def.behaviour === 'phantom' ? 0.35 : 0.2;
    node.addChildAt(glow, 0);

    let x = at?.x, y = at?.y;
    if (x == null) {
      // spawn away from the player, inside the room
      for (let i = 0; i < 24; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = (def.behaviour === 'turret' ? 240 : 180) + Math.random() * 210;
        x = this.player.x + Math.cos(a) * d;
        y = this.player.y + Math.sin(a) * d;
        if (x > 120 && x < ROOM - 120 && y > 160 && y < ROOM_H - 90) break;
      }
      x = UI.clamp(x, 110, ROOM - 110);
      y = UI.clamp(y, 160, ROOM_H - 70);
    }

    const e = {
      def, node, sprite, glow, shadow,
      x, y, vx: 0, vy: 0,
      hp: Math.round(def.hp * (this.diff.enemy || 1)),
      maxHp: Math.round(def.hp * (this.diff.enemy || 1)),
      r: def.r,
      hitT: 0, phase: Math.random() * 6.28,
      fireCd: (def.shoot?.cd || 2) * (0.4 + Math.random() * 0.8),
      chargeCd: def.charge?.cd || 3,
      chargeT: 0, windupT: 0,
      elite: !!extra.elite || def.hp > 100,
      born: 0,
      ...extra,
    };
    node.x = x; node.y = y;
    this.view.entLayer.addChild(node);
    this.enemies.push(e);
    // spawn-in burst
    this._burst(x, y, def.dash ? 0xbcd6ff : 0x88a8c8, 10, 0.6);
    return e;
  }

  _spawnBoss(def) {
    const e = this._spawnEnemy({ ...def, behaviour: 'boss' }, { x: ROOM / 2, y: 230 });
    e.isBoss = true;
    e.hp = e.maxHp = def.hp;
    e.sprite.width = e.sprite.height = 230;
    e.node.scale.set(1);
    e.phaseIdx = 0;
    this.boss = e;
    this.audio.playMusic('bgm_boss', { fade: 900 });
    this.audio.cue('monster', { volume: 1 });
    this.hud.showBoss(e);
    this.view.shake(16);
    this.view.whiteFlash(0.5);
    this._say(DIALOGUE.bossEncounter);
    return e;
  }

  // ============================================================== input → player
  _readMove() {
    const i = this.input;
    let mx = 0, my = 0;
    if (i.held('left')) mx -= 1;
    if (i.held('right')) mx += 1;
    if (i.held('up')) my -= 1;
    if (i.held('down')) my += 1;
    mx += i.axis('x'); my += i.axis('y');
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    return { x: mx, y: my, len: Math.min(1, len) };
  }

  _dash() {
    const p = this.player;
    if (this.mode !== 'play' || !p.alive || this.paused) return;
    if (p.dashCd > 0 || p.dashT > 0) return;
    const m = this._readMove();
    let dx = m.x, dy = m.y;
    if (!dx && !dy) { dx = p.aimX; dy = p.aimY; }
    const l = Math.hypot(dx, dy) || 1;
    p.dashX = dx / l; p.dashY = dy / l;
    p.dashT = RUN.player.dashTime;
    p.dashCd = RUN.player.dashCd;
    p.iframe = Math.max(p.iframe, RUN.player.dashTime + 0.08);
    this.audio.cue('dash', { volume: 0.7 });
    this._afterimage(p.x, p.y);
    this.view.shake(3);
  }

  _skill() {
    const p = this.player;
    if (this.mode !== 'play' || !p.alive || this.paused) return;
    if (p.skillCd > 0) { this.audio.cue('error', { volume: 0.4 }); return; }
    if (p.mp < 40) { this.audio.cue('error', { volume: 0.5 }); this.hud.showPrompt('MP が足りない', { hold: 1.2, tint: 0xd8503f }); return; }
    p.mp -= 40;
    p.skillCd = 2.6;
    this.audio.cue('charge', { volume: 0.8 });
    // a ring of 12 essence shards, with a fireball burst at the centre
    const base = Math.atan2(p.aimY, p.aimX);
    for (let i = 0; i < 12; i++) {
      const a = base + (i / 12) * Math.PI * 2;
      this._spawnShot(p.x, p.y, Math.cos(a), Math.sin(a), { damage: 16, speed: 470, big: true, tint: 0xffc070, faint: true });
    }
    this._spawnFx('fx_fireball_big', p.x, p.y - 18, { scale: 1.5, tint: 0xffc070, speed: 0.66 });
    this._spawnFx('fx_burst_b', p.x, p.y - 18, { scale: 1.0, tint: 0xffe4b0, speed: 0.8 });
    this.view.shake(9);
    this.view.hitStop(0.05);
    this.hud.showPrompt('爆ぜる本質', { hold: 1.1, tint: 0xffc070 });
  }

  _spawnShot(x, y, dx, dy, { speed = RUN.player.shotSpeed, damage = RUN.player.shotDamage, big = false, tint = 0x9fe8ff, pierce = false, faint = false } = {}) {
    // The projectile art is a small soft-orb texture generated once: the DCSS
    // magic-ring sprites read as inventory icons when scaled to 14 px, so they
    // are reserved for FX bursts instead.
    this._orbTex ||= makeOrbTexture();
    const node = new PIXI.Container();
    const glow = makeGlow(tint, big ? 64 : 44);
    glow.blendMode = PIXI.BLEND_MODES.ADD;
    glow.alpha = faint ? 0.8 : 1;
    node.addChild(glow);
    const s = new PIXI.Sprite(this._orbTex);
    s.anchor.set(0.5);
    s.width = s.height = faint ? 18 : 26;
    s.tint = tint;
    node.addChild(s);
    node.x = x; node.y = y;
    this.view.entLayer.addChild(node);
    const shot = { node, x, y, vx: dx * speed, vy: dy * speed, damage, r: big ? 12 : 7, life: 1.6, pierce, hit: new Set(), tint, big };
    this.shots.push(shot);
    this.audio.cue('shot', { volume: big ? 0.5 : 0.4, variation: 0.12 });
    return shot;
  }

  _eshot(x, y, dx, dy, { speed = 200, damage = 10, tint = 0xff7a6a, r = 8 } = {}) {
    const node = new PIXI.Container();
    const glow = makeGlow(tint, 54);
    glow.blendMode = PIXI.BLEND_MODES.ADD;
    node.addChild(glow);
    const s = new PIXI.Sprite(this.registry.textures.get('fx_darkness_bolt') || PIXI.Texture.WHITE);
    s.anchor.set(0.5);
    s.width = s.height = 20;
    s.tint = tint;
    node.addChild(s);
    node.x = x; node.y = y;
    this.view.entLayer.addChild(node);
    this.eShots.push({ node, x, y, vx: dx * speed, vy: dy * speed, damage, r, life: 3.2 });
  }

  // ============================================================== update
  update(dt) {
    if (this.paused) return;
    // hit-stop freezes simulation but keeps UI + camera alive
    let simDt = dt;
    if (this.view.hitstop > 0) {
      this.view.hitstop = Math.max(0, this.view.hitstop - dt);
      simDt = 0;
    }
    this.t += dt;
    if (this.mode === 'dialogue') {
      this.dialogue?.update(dt);
      this.view.update(dt);
      this.hudFade = 0.18;
      this.hud.root.alpha = this.hudFade;
      this.hud.slots.visible = false;
      this.hud.minimap.visible = false;
      // keep the player animated in place so the scene never looks frozen
      const pl = this.player;
      this.playerNode.x = pl.x; this.playerNode.y = pl.y + Math.sin(this.t * 2) * 2;
      this.hud.update(dt, this._hudCtx());
      return;
    }
    if (this.hudFade != null) {
      this.hudFade = Math.min(1, this.hudFade + dt * 2.2);
      this.hud.root.alpha = this.hudFade;
      if (this.hudFade >= 1) { this.hudFade = null; this.hud.slots.visible = true; this.hud.minimap.visible = true; }
    }
    this.runTime += simDt;
    this.idleTime += simDt;

    const p = this.player;
    const m = this._readMove();
    const moving = m.len > 0.05;
    if (moving) this.idleTime = 0;

    // ---- aim: nearest enemy, or the movement direction
    let nearest = null, nd = 1e9;
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < nd) { nd = d; nearest = e; }
    }
    if (nearest && nd < 460) {
      const a = Math.atan2(nearest.y - p.y, nearest.x - p.x);
      p.aimX += (Math.cos(a) - p.aimX) * Math.min(1, dt * 12);
      p.aimY += (Math.sin(a) - p.aimY) * Math.min(1, dt * 12);
    } else if (moving) {
      p.aimX += (m.x - p.aimX) * Math.min(1, dt * 8);
      p.aimY += (m.y - p.aimY) * Math.min(1, dt * 8);
    }
    const al = Math.hypot(p.aimX, p.aimY) || 1;
    p.aimX /= al; p.aimY /= al;

    // ---- movement + dash
    p.dashCd = Math.max(0, p.dashCd - simDt);
    p.shotCd = Math.max(0, p.shotCd - simDt);
    p.skillCd = Math.max(0, p.skillCd - simDt);
    p.iframe = Math.max(0, p.iframe - simDt);
    p.hurtCd = Math.max(0, p.hurtCd - simDt);
    if (p.dashT > 0) {
      p.dashT -= simDt;
      p.vx = p.dashX * RUN.player.dashSpeed;
      p.vy = p.dashY * RUN.player.dashSpeed;
      if (Math.random() < 0.6) this._afterimage(p.x, p.y);
    } else {
      const target = RUN.player.speed * (this.playerLevel > 3 ? 1.06 : 1);
      const accel = 1 - Math.pow(0.0001, simDt);
      p.vx += (m.x * target - p.vx) * accel;
      p.vy += (m.y * target - p.vy) * accel;
      if (!moving) { p.vx *= Math.pow(0.02, simDt); p.vy *= Math.pow(0.02, simDt); }
    }
    p.x += p.vx * simDt;
    p.y += p.vy * simDt;
    p.x = UI.clamp(p.x, p.r + 34, ROOM - p.r - 34);
    p.y = UI.clamp(p.y, 108, ROOM_H - p.r - 40);
    p.facing = p.vx < -8 ? -1 : p.vx > 8 ? 1 : p.facing;
    p.step += Math.hypot(p.vx, p.vy) * simDt * 0.055;

    // ---- firing (hold confirm)
    if (this.input.held('confirm') && p.shotCd <= 0 && p.mp >= RUN.player.shotCost) {
      p.shotCd = RUN.player.shotCd;
      p.mp -= RUN.player.shotCost;
      const spread = this.playerLevel >= 6 ? 2 : 0;
      const baseA = Math.atan2(p.aimY, p.aimX);
      const n = spread ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const a = baseA + (i - (n - 1) / 2) * 0.09;
        this._spawnShot(p.x + Math.cos(a) * 22, p.y - 18 + Math.sin(a) * 22, Math.cos(a), Math.sin(a));
      }
    }
    p.mp = Math.min(p.mpMax, p.mp + RUN.player.mpRegen * simDt);

    // ---- room transitions: leaving through an edge streams the next room in.
    // A short cooldown + an inset spawn stops one key-hold from chaining rooms.
    this.doorCd = Math.max(0, (this.doorCd || 0) - simDt);
    if (this.roomGrace > 0) {
      this.roomGrace = Math.max(0, this.roomGrace - simDt);
      this.player.iframe = Math.max(this.player.iframe, 0.05);
    }
    if (this.doorCd <= 0) {
      const door = this._checkDoor();
      if (door) {
        const [dx, dy] = door;
        this._enterRoom(this.currentRoom.tx + dx, this.currentRoom.ty + dy);
        this.audio.cue('whoosh', { volume: 0.5 });
        this.doorCd = 0.85;
      }
    }

    // ---- floor clock: the corridor only stays open while something is alive
    this.floorTimer -= simDt;
    if (this.floorTimer <= 0) {
      if (this.enemies.filter((e) => !e.dead).length === 0) this._clearRoom();
      else this.floorTimer = 6;          // holding out? the room holds on, barely
    }

    // ---- entity updates
    this._updateEnemies(simDt, dt);
    this._updateShots(simDt);
    this._updateEnemyShots(simDt);
    this._updateDrops(simDt);
    this._updateFx(simDt);
    this._updateCombo(dt);
    this._spawnLogic(dt);

    // ---- player death
    if (p.hp <= 0 && p.alive) this._die();

    // ---- camera + stage
    this.view.follow({ x: p.x, y: p.y, vx: p.vx, vy: p.vy }, { x: p.aimX, y: p.aimY }, dt);
    this.view.update(dt);
    this.cam.offX = 640 - this.view.cam.x;
    this.cam.offY = 360 - this.view.cam.y;

    // ---- player visuals
    const n = this.playerNode;
    n.x = p.x; n.y = p.y;
    const bob = Math.sin(p.step) * 2.2;
    n.y += bob;
    const doll = this.playerDoll;
    doll.scale.x = p.facing;
    doll.scale.y = 1 + Math.sin(p.step * 2) * 0.02;
    if (p.iframe > 0) {
      n.alpha = 0.45 + Math.sin(this.t * 40) * 0.35;
    } else n.alpha = 1;
    this.playerHalo.alpha = 0.4 + Math.sin(this.t * 2.6) * 0.1;
    this.aimNode.x = p.aimX * 40;
    this.aimNode.y = -18 + p.aimY * 40;
    this.playerShadow.visible = p.dashT <= 0;
    this.playerMote.x = Math.cos(this.t * 2.2) * 34;
    this.playerMote.visible = true;
    this.playerMote.y = -44 + Math.sin(this.t * 2.2) * 12;
    this.playerMote.alpha = 0.75 + Math.sin(this.t * 6) * 0.2;

    // ---- HUD
    this.hud.setVitals(p.hp, p.hpMax, p.mp, p.mpMax);
    this.hud.setScore(this.score);
    this.hud.setCombo(this.combo, this.comboMult, this.comboTimer, RUN.comboWindow);
    const lowHp = p.hp / p.hpMax;
    this.view.setDanger(lowHp < 0.35 ? 1 - lowHp / 0.35 : 0);
    if (lowHp < 0.3 && !this._lowHpLoop) {
      this._lowHpLoop = true;
      this.audio.cue('lowhp', { volume: 0.25, rate: 1 });
    } else if (lowHp > 0.4) this._lowHpLoop = false;
    this.view.setScanlines(this.settings.scanlines);
    this.hud.update(dt, this._hudCtx());
  }

  _hudCtx() {
    return {
      floor: this.floor,
      timer: this.floorTimer,
      boss: this.boss && !this.boss.dead ? this.boss : null,
      cam: this.cam,
      cooldowns: {
        confirm: { remain: this.player.shotCd, total: RUN.player.shotCd },
        skill: { remain: this.player.skillCd, total: 2.6 },
        dash: { remain: this.player.dashCd, total: RUN.player.dashCd },
        pause: { remain: 0, total: 1 },
      },
    };
  }

  _checkDoor() {
    const p = this.player, M = 26;
    // the room's walls are outside the 0..ROOM play area, so the door is the
    // moment the player's shoulder touches an edge
    if (p.y <= 112 && this._doorPressed('up')) return [0, -1];
    if (p.y >= ROOM_H - p.r - 42 && this._doorPressed('down')) return [0, 1];
    if (p.x <= p.r + 36 && this._doorPressed('left')) return [-1, 0];
    if (p.x >= ROOM - p.r - 36 && this._doorPressed('right')) return [1, 0];
    return null;
  }

  _doorPressed(dir) {
    const d = this.input.down;
    if (dir === 'up') return d.has('up');
    if (dir === 'down') return d.has('down');
    if (dir === 'left') return d.has('left');
    return d.has('right');
  }

  // ============================================================== enemies
  _updateEnemies(simDt, dt) {
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.born += simDt;
      e.phase += simDt;
      const dx = p.x - e.x, dy = p.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist, ny = dy / dist;
      let vx = 0, vy = 0;
      const b = e.def.behaviour;

      if (b === 'chase' || b === 'hunt') {
        const sp = e.def.speed * (b === 'hunt' ? 1.12 : 1);
        vx = nx * sp; vy = ny * sp;
        if (b === 'hunt') {
          // sidestep so it doesn't line up perfectly with straight-line fire
          vx += -ny * sp * 0.42 * Math.sin(e.phase * 1.7);
          vy += nx * sp * 0.42 * Math.sin(e.phase * 1.7);
        }
      } else if (b === 'drift') {
        vx = nx * e.def.speed * 0.7 + Math.cos(e.phase * 1.4) * 30;
        vy = ny * e.def.speed * 0.7 + Math.sin(e.phase * 1.9) * 30;
      } else if (b === 'phantom') {
        // fades in and out of reach, then lunges
        const pulse = Math.sin(e.phase * 1.1);
        const sp = e.def.speed * (0.5 + Math.max(0, pulse) * 1.5);
        vx = nx * sp; vy = ny * sp;
        e.sprite.alpha = 0.45 + Math.max(0, pulse) * 0.55;
        if (pulse > 0.94) this._afterimage(e.x, e.y, 0x9fc8ff);
      } else if (b === 'orbit') {
        const want = 210;
        const radial = (dist - want) * 1.4;
        vx = nx * radial - ny * e.def.speed;
        vy = ny * radial + nx * e.def.speed;
      } else if (b === 'turret') {
        const want = 300;
        vx = nx * (dist - want) * 0.9;
        vy = ny * (dist - want) * 0.9;
      } else if (b === 'summoner') {
        const want = 330;
        vx = nx * (dist - want) * 0.8 - ny * 40;
        vy = ny * (dist - want) * 0.8 + nx * 40;
        e.summonCd = (e.summonCd ?? 5) - simDt;
        if (e.summonCd <= 0) {
          e.summonCd = 6.5;
          for (let i = 0; i < 2; i++) {
            const a = Math.random() * 6.28;
            this._spawnEnemy(BESTIARY.wisp, { x: e.x + Math.cos(a) * 60, y: e.y + Math.sin(a) * 60 });
          }
          this._burst(e.x, e.y, 0xb9c8ff, 12, 0.5);
          this.audio.cue('monster', { volume: 0.4 });
        }
      } else if (b === 'charger') {
        e.chargeCd -= simDt;
        if (e.chargeT > 0) {
          e.chargeT -= simDt;
          vx = e.chargeX * e.def.charge.speed;
          vy = e.chargeY * e.def.charge.speed;
          if (Math.random() < 0.4) this._afterimage(e.x, e.y, 0xffb0a0);
        } else if (e.windupT > 0) {
          e.windupT -= simDt;
          e.sprite.tint = 0xff8866;
          if (e.windupT <= 0) {
            e.chargeT = 0.42;
            const a = Math.atan2(dy, dx);
            e.chargeX = Math.cos(a); e.chargeY = Math.sin(a);
            this.audio.cue('dash', { volume: 0.5 });
            e.sprite.tint = e.def.tint;
          }
        } else if (e.chargeCd <= 0 && dist < 380) {
          e.chargeCd = e.def.charge.cd;
          e.windupT = e.def.charge.windup;
        } else {
          vx = nx * e.def.speed * 0.6; vy = ny * e.def.speed * 0.6;
        }
      } else if (b === 'boss') {
        const a = Math.atan2(dy, dx);
        const orbitR = 200;
        vx = (nx * (dist - orbitR) * 0.7) - ny * 55;
        vy = (ny * (dist - orbitR) * 0.7) + nx * 55;
        e.shootCd = (e.shootCd ?? 1.2) - simDt;
        const phase = e.hp / e.maxHp < 0.5 ? 1 : 0;
        if (e.shootCd <= 0) {
          e.shootCd = e.def.shoot.cd * (phase ? 0.7 : 1);
          const n = e.def.shoot.spread + (phase ? 3 : 0);
          const base = a;
          for (let i = 0; i < n; i++) {
            const ang = base + (i - (n - 1) / 2) * 0.16;
            this._eshot(e.x, e.y - 20, Math.cos(ang), Math.sin(ang), {
              speed: e.def.shoot.speed, damage: e.def.shoot.damage,
              tint: phase ? 0xff5a4a : 0xff9a6a, r: 10,
            });
          }
          this.audio.cue('shot', { volume: 0.3, variation: 0.2 });
          this.view.shake(4);
        }
        // boss adds
        e.addCd = (e.addCd ?? 8) - simDt;
        if (e.addCd <= 0) {
          e.addCd = 9;
          for (let i = 0; i < 2; i++) {
            const ang = Math.random() * 6.28;
            this._spawnEnemy(BESTIARY.wraith, { x: e.x + Math.cos(ang) * 110, y: e.y + Math.sin(ang) * 110 });
          }
        }
      }

      // shooting archetypes
      if (e.def.shoot && b !== 'turret' && b !== 'boss') {
        e.fireCd -= simDt;
        if (e.fireCd <= 0 && dist < 520) {
          e.fireCd = e.def.shoot.cd * (0.8 + Math.random() * 0.5);
          const base = Math.atan2(dy, dx);
          const n = e.def.shoot.spread || 1;
          for (let i = 0; i < n; i++) {
            const ang = base + (i - (n - 1) / 2) * 0.2;
            this._eshot(e.x, e.y - 14, Math.cos(ang), Math.sin(ang), {
              speed: e.def.shoot.speed, damage: e.def.shoot.damage, tint: e.def.tint || 0xff7a6a,
            });
          }
          this.audio.cue('shot', { volume: 0.18, variation: 0.2 });
        }
      }
      if (b === 'turret') {
        e.fireCd -= simDt;
        if (e.fireCd <= 0) {
          e.fireCd = e.def.shoot.cd;
          const base = Math.atan2(dy, dx);
          for (let i = 0; i < 3; i++) {
            const ang = base + (i - 1) * 0.22;
            this._eshot(e.x, e.y - 14, Math.cos(ang), Math.sin(ang), {
              speed: e.def.shoot.speed, damage: e.def.shoot.damage, tint: e.def.tint || 0xff7a6a,
            });
          }
        }
      }

      // separation so the horde doesn't stack into one blob
      for (const o of this.enemies) {
        if (o === e || o.dead) continue;
        const ox = e.x - o.x, oy = e.y - o.y;
        const od = Math.hypot(ox, oy);
        const min = e.r + o.r;
        if (od > 0 && od < min) {
          const push = (min - od) * 2.4;
          vx += (ox / od) * push; vy += (oy / od) * push;
        }
      }

      e.vx = vx; e.vy = vy;
      const kh = e.def.tank ? 0.55 : 1;
      e.x += vx * simDt * kh;
      e.y += vy * simDt * kh;
      e.x = UI.clamp(e.x, e.r + 30, ROOM - e.r - 30);
      e.y = UI.clamp(e.y, 120, ROOM_H - e.r - 30);

      // visuals
      const node = e.node;
      node.x = e.x; node.y = e.y + Math.sin(e.phase * 3.1) * (e.def.bob || 1.4);
      e.sprite.scale.x = dx < 0 ? -Math.abs(e.sprite.scale.x) : Math.abs(e.sprite.scale.x);
      if (e.hitT > 0) {
        e.hitT -= simDt;
        e.sprite.tint = 0xffffff;
        node.x += (Math.random() - 0.5) * 5;
      } else e.sprite.tint = e.def.tint || 0xffffff;
      e.glow.alpha = 0.14 + Math.sin(e.phase * 2.2) * 0.06 + (e.isBoss ? 0.2 : 0);

      // contact damage
      if (!this.player.alive) continue;
      const pdx = this.player.x - e.x, pdy = this.player.y - e.y;
      const pd = Math.hypot(pdx, pdy);
      if (pd < e.r + this.player.r - 12) {
        // touch damage is a nudge, not a delete: keep it well under the
        // projectile values so dodging stays the answer
        this._hurtPlayer(Math.max(3, Math.round(e.def.damage * 0.45)), nx, ny);
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  // ============================================================== shots
  _updateShots(simDt) {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.life -= simDt;
      s.x += s.vx * simDt; s.y += s.vy * simDt;
      s.node.x = s.x; s.node.y = s.y;
      if (s.life <= 0 || s.x < -30 || s.x > ROOM + 30 || s.y < -30 || s.y > ROOM_H + 30) {
        s.node.destroy({ children: true });
        this.shots.splice(i, 1);
        continue;
      }
      for (const e of this.enemies) {
        if (e.dead || s.hit.has(e)) continue;
        const d = Math.hypot(e.x - s.x, e.y - (s.y + 18));
        if (d < e.r + s.r) {
          s.hit.add(e);
          const crit = Math.random() < RUN.player.critChance;
          const dmg = Math.round(s.damage * (crit ? RUN.player.critMult : 1) * (0.94 + Math.random() * 0.12));
          this._damageEnemy(e, dmg, { crit, x: s.x, y: s.y });
          if (!s.pierce) {
            s.node.destroy({ children: true });
            this.shots.splice(i, 1);
            break;
          }
        }
      }
    }
  }

  _updateEnemyShots(simDt) {
    const p = this.player;
    for (let i = this.eShots.length - 1; i >= 0; i--) {
      const s = this.eShots[i];
      s.life -= simDt;
      s.x += s.vx * simDt; s.y += s.vy * simDt;
      s.node.x = s.x; s.node.y = s.y;
      s.node.rotation += simDt * 6;
      if (s.life <= 0) { s.node.destroy({ children: true }); this.eShots.splice(i, 1); continue; }
      if (!p.alive) continue;
      const d = Math.hypot(p.x - s.x, p.y - 18 - s.y);
      if (d < s.r + p.r) {
        this._hurtPlayer(s.damage, s.vx / 400, s.vy / 400);
        this._burst(s.x, s.y, 0xff8a6a, 8, 0.4);
        s.node.destroy({ children: true });
        this.eShots.splice(i, 1);
      }
    }
  }

  // ============================================================== damage
  _damageEnemy(e, dmg, { crit = false, x = e.x, y = e.y } = {}) {
    if (e.dead) return;
    e.hp -= dmg;
    e.hitT = 0.09;
    this.audio.cue('hit', { volume: crit ? 0.65 : 0.42, variation: 0.14 });
    if (crit) { this.audio.cue('hitHeavy', { volume: 0.4 }); this.view.hitStop(0.03); }
    this.hud.floatText(x, y - 8, crit ? `${dmg}!` : `${dmg}`, {
      color: crit ? 0xffe08a : 0xfff2e0, size: crit ? 15 : 12, crit,
    });
    this._burst(x, y, crit ? 0xffe08a : 0xd8e8ff, crit ? 10 : 5, 0.35);
    this.view.shake(crit ? 5 : 1.6);
    if (e.hp <= 0) this._killEnemy(e);
  }

  _killEnemy(e) {
    e.dead = true;
    this.kills++;
    this.combo++;
    this.comboTimer = RUN.comboWindow;
    this.comboMult = Math.min(RUN.comboMax, 1 + this.combo * RUN.comboStep);
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.hud.comboPunch = 1;
    const gain = Math.round(e.def.score * this.comboMult * (this.diff.score || 1) / 10) * 10;
    this.score += gain;
    this.essence += e.def.essence || 1;
    this.hud.floatText(e.x, e.y - 30, `+${gain}`, { color: 0xffe0a0, size: 13 });
    this._burst(e.x, e.y, e.isBoss ? 0xffd080 : 0xbfe6ff, e.isBoss ? 60 : 14, e.isBoss ? 1.4 : 0.6);
    if (e.isBoss) this._spawnFx('fx_fireball_big', e.x, e.y - 10, { scale: 3.2, tint: 0xffd080, speed: 0.5 });
    else if (e.maxHp > 100) this._spawnFx('fx_burst_b', e.x, e.y - 8, { scale: 0.85, tint: 0xcfe4ff, speed: 0.85 });
    this.audio.cue(e.isBoss ? 'explodeBig' : 'explode', { volume: e.isBoss ? 0.9 : 0.4, variation: 0.14 });
    if (e.isBoss) {
      this.view.hitStop(0.22);
      this.view.whiteFlash(0.85);
      this.view.shake(26);
      this.hud.hideBoss();
      this.boss = null;
      this.save.clears = (this.save.clears || 0) + 1;
    }
    // drops
    const roll = Math.random();
    if (e.isBoss) {
      for (let i = 0; i < 6; i++) this._drop(e.x + (Math.random() - 0.5) * 120, e.y + (Math.random() - 0.5) * 120, 'soup');
      for (let i = 0; i < 4; i++) this._drop(e.x + (Math.random() - 0.5) * 140, e.y + (Math.random() - 0.5) * 140, 'gem');
    } else if (roll < 0.10) this._drop(e.x, e.y, 'soup');
    else if (roll < 0.26) this._drop(e.x, e.y, 'potion');
    else if (roll < 0.40) this._drop(e.x, e.y, 'gem');
    else if (roll < 0.78) this._drop(e.x, e.y, 'essence');
    e.node.destroy({ children: true });
    this._checkLevel();
    this._checkRoomClear();
  }

  _hurtPlayer(dmg, nx, ny) {
    const p = this.player;
    if (p.iframe > 0 || !p.alive) return;
    const scaled = Math.max(1, Math.round(dmg * (0.9 + Math.random() * 0.2)));
    p.hp -= scaled;
    p.iframe = RUN.player.iframes;
    p.hurtCd = 0.4;
    this.combo = 0;
    this.comboMult = 1;
    this.audio.cue('hurt', { volume: 0.8 });
    this.hud.hurtFlash();
    this.hud.floatText(p.x, p.y - 46, `-${scaled}`, { color: 0xff6b5a, size: 16 });
    this.view.shake(9);
    this.view.hitStop(0.06);
    this.view.whiteFlash(0.18);
    // knockback
    p.vx += nx * 240; p.vy += ny * 240;
    this._burst(p.x, p.y - 20, 0xff6b5a, 12, 0.5);
    if (p.hp <= 0) this._die();
  }

  _die() {
    if (this.over) return;
    this.over = true;
    this.finalScore = this.score;
    this.player.alive = false;
    this.view.hitStop(0.3);
    this.view.whiteFlash(0.6);
    this.view.shake(18);
    this.audio.cue('death', { volume: 1 });
    this.audio.stopMusic(600);
    this._burst(this.player.x, this.player.y - 20, 0xff6b5a, 40, 1.2);
    this.playerNode.visible = false;
    this._say(DIALOGUE.gameOver[Math.floor(Math.random() * DIALOGUE.gameOver.length)], 1600);
    setTimeout(() => {
      const result = {
        score: Math.round(this.finalScore ?? this.score), kills: this.kills, floor: this.floor,
        bestCombo: this.bestCombo, time: this.runTime, cleared: false,
        level: this.playerLevel,
      };
      this.game.goto('result', { data: result, color: 0x2a0508 });
    }, 1500);
  }

  _checkLevel() {
    const need = RUN.essenceToLevel[Math.min(RUN.essenceToLevel.length - 1, this.playerLevel)];
    if (this.essence >= need && this.playerLevel < RUN.essenceToLevel.length) {
      this.playerLevel++;
      this.essence = 0;
      const p = this.player;
      p.hpMax += 8; p.hp = Math.min(p.hpMax, p.hp + 18);
      p.mpMax += 6;
      this.audio.cue('levelup', { volume: 0.85 });
      this.hud.toasts.push(`LEVEL ${this.playerLevel}`, { tint: 0xffe08a, sub: '最大HP +8 · MP +6', life: 3 });
      this.hud.floatText(p.x, p.y - 70, `LEVEL UP`, { color: 0xffe08a, size: 15, life: 1.4 });
      this.view.whiteFlash(0.22);
      this._burst(p.x, p.y - 20, 0xffe08a, 26, 1.0);
    }
  }

  _checkRoomClear() {
    if (this.enemies.filter((e) => !e.dead).length > 0) return;
    this._clearRoom();
  }

  _clearRoom() {
    const key = this.map.key(this.currentRoom.tx, this.currentRoom.ty);
    if (this.roomsCleared.has(key)) return;
    this.roomsCleared.add(key);
    this.floorTimer = RUN.floorTime;
    const bonus = 100 + this.floor * 50;
    this.score += bonus;
    this.hud.toasts.push(`教室 制圧`, { tint: 0x8ec96b, sub: `+${bonus} 偏差値`, life: 2.6 });
    this.hud.showPrompt(DIALOGUE.floorClear[Math.floor(Math.random() * DIALOGUE.floorClear.length)], { hold: 3.4, tint: 0xc8d8c0 });
    this.audio.cue('victory_1', { volume: 0.55 });
    // a soup can appears as a reward for clearing a classroom
    this._drop(this.player.x + 60, this.player.y - 20, 'soup');
  }

  // ============================================================== pickups
  _drop(x, y, kind) {
    const ids = { soup: 'drop_soup', potion: 'drop_potion', gem: 'drop_gem', essence: 'fx_magic_orb' };
    const tint = { soup: 0xffe08a, potion: 0x9fe8ff, gem: 0xd8a8ff, essence: 0x9fffdc }[kind];
    const node = new PIXI.Container();
    const glow = makeGlow(tint, kind === 'soup' ? 90 : 54);
    glow.alpha = 0.5;
    glow.blendMode = PIXI.BLEND_MODES.ADD;
    node.addChild(glow);
    const s = new PIXI.Sprite(this.registry.textures.get(ids[kind]) || PIXI.Texture.WHITE);
    s.anchor.set(0.5);
    s.width = s.height = kind === 'soup' ? 40 : 26;
    s.tint = 0xffffff;
    node.addChild(s);
    node.x = x; node.y = y;
    this.view.entLayer.addChild(node);
    const d = { node, x, y, kind, t: 0, life: 14, bob: Math.random() * 6.28 };
    this.drops.push(d);
    return d;
  }

  _updateDrops(simDt) {
    const p = this.player;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.t += simDt;
      d.life -= simDt;
      d.node.y = d.y + Math.sin(d.t * 3 + d.bob) * 4;
      d.node.alpha = d.life < 2 ? Math.max(0, d.life / 2) : 1;
      // magnet toward the player once close
      const dx = p.x - d.x, dy = p.y - 18 - d.node.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 130) {
        d.x += (dx / dist) * 260 * simDt;
        d.y += (dy / dist) * 260 * simDt;
        d.node.x = d.x;
      }
      if (dist < 34 || d.life <= 0) {
        if (dist < 34) this._pickup(d);
        d.node.destroy({ children: true });
        this.drops.splice(i, 1);
      }
    }
  }

  _pickup(d) {
    const p = this.player;
    if (d.kind === 'soup') {
      const heal = RUN.soupHeal;
      p.hp = Math.min(p.hpMax, p.hp + heal);
      this.audio.cue('heal', { volume: 0.8 });
      this.hud.toasts.push('コーンスープ', { tint: 0xffe08a, sub: `HP +${heal} — 三ヶ月ぶりの補充`, life: 2.6 });
      this.hud.floatText(p.x, p.y - 50, `+${heal}`, { color: 0xffe08a, size: 15 });
      this._burst(d.x, d.y, 0xffe08a, 12, 0.5);
    } else if (d.kind === 'potion') {
      p.mp = Math.min(p.mpMax, p.mp + 45);
      this.audio.cue('power', { volume: 0.6 });
      this.hud.toasts.push('MP回復', { tint: 0x9fe8ff, sub: 'MP +45', life: 2 });
    } else if (d.kind === 'gem') {
      const v = 250 * this.comboMult;
      this.score += Math.round(v);
      this.audio.cue('coinDouble', { volume: 0.6 });
      this.hud.toasts.push('偏差値の結晶', { tint: 0xd8a8ff, sub: `+${Math.round(v)} 偏差値`, life: 2 });
    } else {
      this.essence += 1;
      this.audio.cue('coin', { volume: 0.4, variation: 0.2 });
      this._burst(d.x, d.y, 0x9fffdc, 6, 0.3);
      this._checkLevel();
    }
  }

  // ============================================================== fx
  _burst(x, y, color, count = 8, scale = 0.4) {
    const g = new PIXI.Graphics();
    g.x = x; g.y = y;
    this.view.fxLayer.addChild(g);
    const parts = [];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * 6.28, sp = 60 + Math.random() * 220 * scale;
      parts.push({ x: 0, y: 0, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, s: 2 + Math.random() * 3, life: 0.3 + Math.random() * 0.45 });
    }
    this.fx.push({ type: 'particles', node: g, parts, color, t: 0, max: 0.75 });
  }

  _afterimage(x, y, tint = 0x59d7c8) {
    const s = new PIXI.Sprite(this.registry.textures.get('mon_spectral') || PIXI.Texture.WHITE);
    s.anchor.set(0.5, 0.85);
    s.width = s.height = 56;
    s.x = x; s.y = y;
    s.tint = tint;
    s.alpha = 0.4;
    s.blendMode = PIXI.BLEND_MODES.ADD;
    this.view.fxLayer.addChild(s);
    this.fx.push({ type: 'fade', node: s, t: 0, max: 0.3 });
  }

  /**
   * Play an animated effect. Sources, in order of preference:
   *   1. an 8×8 grid sheet registered in `framesById` (torch/fireball/burst)
   *   2. a strip registered in `frames` (spell casts)
   *   3. a single still texture
   * A raw grid sheet must never be drawn whole — that paints all 64 cells at
   * once and looks like a lattice of rings.
   */
  _spawnFx(id, x, y, { scale = 1, tint = 0xffffff, frames = null, blend = true, size = 128, speed = 0.5 } = {}) {
    const grid = frames || this.registry.framesById?.[id];
    const strip = this.registry.frames?.get?.(id) || this.registry.frames?.[id];
    let node;
    let max;
    if (grid?.length) {
      node = new PIXI.AnimatedSprite(grid);
      node.animationSpeed = speed;
      node.loop = false;
      node.gotoAndPlay(0);
      max = (grid.length / (60 * speed)) + 0.05;
    } else if (strip?.length) {
      node = new PIXI.AnimatedSprite(strip);
      node.animationSpeed = speed;
      node.loop = false;
      node.gotoAndPlay(0);
      max = (strip.length / (60 * speed)) + 0.05;
    } else {
      node = new PIXI.Sprite(this.registry.textures.get(id) || PIXI.Texture.WHITE);
      max = 0.3;
    }
    node.anchor.set(0.5);
    node.x = x; node.y = y;
    node.width = node.height = size * scale;
    node.tint = tint;
    if (blend) node.blendMode = PIXI.BLEND_MODES.ADD;
    this.view.fxLayer.addChild(node);
    this.fx.push({ type: 'sprite', node, t: 0, max, scale, baseSize: size, animated: node instanceof PIXI.AnimatedSprite });
    return node;
  }

  _updateFx(simDt) {
    for (let i = this.fx.length - 1; i >= 0; i--) {
      const f = this.fx[i];
      f.t += simDt;
      const p = f.t / f.max;
      if (f.type === 'particles') {
        const g = f.node;
        g.clear();
        for (const part of f.parts) {
          part.x += part.vx * simDt; part.y += part.vy * simDt;
          part.vy += 420 * simDt;
          g.beginFill(f.color, Math.max(0, 1 - p));
          g.drawRect(part.x | 0, part.y | 0, part.s, part.s);
          g.endFill();
        }
      } else if (f.type === 'fade') {
        f.node.alpha = 0.4 * (1 - p);
        f.node.y -= 20 * simDt;
      } else if (f.type === 'sprite') {
        f.node.alpha = p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25;
        if (!f.node.animating) {
          const sc = 0.65 + p * 0.7;
          f.node.width = f.baseSize * f.scale * sc;
          f.node.height = f.baseSize * f.scale * sc;
          f.node.rotation += simDt * 1.6;
        }
      }
      if (f.t >= f.max) { f.node.destroy({ children: true }); this.fx.splice(i, 1); }
    }
  }

  // ============================================================== combo / spawn
  _updateCombo(dt) {
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) { this.combo = 0; this.comboMult = 1; }
    }
  }

  _spawnLogic(dt) {
    // Ambient pressure only tops the room back up; the wave budget is the
    // main event. Cap keeps the screen readable and the frame rate honest.
    const CAP = 18;
    if (!this.tierPool?.length) return;
    if (this.enemies.length >= CAP) { this.spawnTimer = 0.8; return; }
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = this.spawnCadence * (1.2 + Math.random() * 0.8);
    const pool = this.tierPool;
    const id = pool[Math.floor(Math.random() * pool.length)];
    this._spawnEnemy(BESTIARY[id]);
  }

  // ============================================================== dialogue helper
  _say(text, ms = 1500) {
    if (this._sayNode) this._sayNode.destroy({ children: true });
    const c = new PIXI.Container();
    const t = UI.pxText(text, { size: 14, fill: 0xd8cfb8, outline: 3, align: 'center' });
    t.anchor.set(0.5, 0.5);
    const bg = new PIXI.Graphics();
    bg.beginFill(0x05070a, 0.75).drawRoundedRect(-t.width / 2 - 22, -t.height / 2 - 8, t.width + 44, t.height + 16, 3).endFill();
    bg.lineStyle(1, 0x5a4a34, 0.9).drawRoundedRect(-t.width / 2 - 22, -t.height / 2 - 8, t.width + 44, t.height + 16, 3);
    c.addChild(bg, t);
    c.x = UI.W / 2; c.y = 150;
    c.alpha = 0;
    this.ui.addChild(c);
    this._sayNode = c;
    const t0 = performance.now();
    const anim = () => {
      const e = performance.now() - t0;
      c.alpha = Math.min(1, e / 250) * (e > ms ? Math.max(0, 1 - (e - ms) / 400) : 1);
      if (e < ms + 400) requestAnimationFrame(anim);
      else { c.destroy({ children: true }); if (this._sayNode === c) this._sayNode = null; }
    };
    anim();
  }

  // ============================================================== pause
  _openPause() {
    if (this.paused || this.over) return;
    this.paused = true;
    this.audio.cue('pauseIn', { volume: 0.8 });
    this.audio.duckMusic(0.35, 500);
    this.game.states.pause.enterOverlay({ play: this });
    this.mode = 'paused';
  }

  resumeFromPause() {
    this.paused = false;
    this.mode = 'play';
    this.audio.cue('pauseOut', { volume: 0.8 });
    this.audio.duckMusic(1, 400);
  }

  // ============================================================== helpers
  regTex(id) {
    return this.registry.textures.get(id) || PIXI.Texture.WHITE;
  }

  exit() {
    this._offs?.forEach((off) => off());
    this._offDevice?.();
    this.audio.stopAmbient(600);
    this.view?.root.destroy({ children: true });
    this.hud?.root.destroy({ children: true });
    this.world.removeChildren();
    this.ui.removeChildren();
    if (this.save) {
      this.save.best = Math.max(this.save.best || 0, Math.round(this.score || 0));
      this.save.lastScore = Math.round(this.score || 0);
      this.save.runs = (this.save.runs || 0) + 1;
      this.save.essence = (this.save.essence || 0) + (this.essence || 0);
    }
  }
}
