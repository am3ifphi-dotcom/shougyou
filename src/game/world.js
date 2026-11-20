/**
 * The world view during play.
 *
 * Renders the tilemap (only the visible window is drawn), the props, the
 * lighting pass, every actor, and owns the fixed-step simulation.  Gameplay
 * state that must survive a pause lives here.
 */
import { Container, Graphics, Sprite, RenderTexture, BlurFilter, ColorMatrixFilter } from 'pixi.js';
import { get } from '../core/textures.js';
import { TILE, WALL, generateDungeon, isSolid, roomAt, lineOfSight, findPath } from './dungeon.js';
import { createEnemy, moveActor, ENEMY_TYPES, rosterForRoom, Actor } from './entities.js';
import { Particles, FloatingText, Decals } from './effects.js';
import { Camera } from './camera.js';
import { VIEW_W, VIEW_H, worldLayer } from '../core/app.js';
import { playSfx } from '../core/audio.js';
import { COLORS, text } from '../ui/type.js';
import { glowTexture } from '../core/procedural.js';

export const PLAYER_FRAMES = {
  s: ['hero_warrior_s', 'hero_warrior_s_walk', 'hero_warrior_s_walk2', 'hero_warrior_s_walk3'],
  e: ['hero_warrior_e', 'hero_warrior_e_walk', 'hero_warrior_e_walk2', 'hero_warrior_e_walk3'],
  n: ['hero_warrior_n', 'hero_warrior_n_walk'],
  w: ['hero_warrior_w', 'hero_warrior_w_walk', 'hero_warrior_w_walk2', 'hero_warrior_w_walk3'],
};

export class GameWorld {
  constructor({ seed, onEvent }) {
    this.seed = seed;
    this.onEvent = onEvent || (() => {});
    this.root = new Container();
    this.root.sortableChildren = true;
    this.dungeon = generateDungeon(seed);
    // The buffer is 480x270 but the camera works in "world view" units at 2x,
    // so a room reads at a comfortable console-RPG scale (15 x 8 tiles).
    this.camera = new Camera(VIEW_W / 2, VIEW_H / 2);
    this.camera.setBounds(this.dungeon.worldW, this.dungeon.worldH);

    this.floorLayer = new Container();
    this.wallLayer = new Container();
    this.decalLayer = new Container();
    this.propLayer = new Container();
    this.actorLayer = new Container();
    this.lightLayer = new Container();
    this.fxLayer = new Container();
    this.fxLayer.sortableChildren = true;
    this.root.addChild(this.floorLayer, this.decalLayer, this.wallLayer, this.propLayer, this.actorLayer, this.fxLayer, this.lightLayer);

    this.decals = new Decals();
    this.decalLayer.addChild(this.decals);
    this.particles = new Particles();
    this.floating = new FloatingText();
    this.fxLayer.addChild(this.particles, this.floating);

    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.time = 0;
    this.elapsed = 0;
    this.paused = false;

    this._buildTiles();
    this._buildProps();
    this._spawnPlayer();
    this._spawnEnemies();
    this._lights();

    const sp = this.dungeon.spawn;
    this.camera.snapTo(this.player.x, this.player.y);
    this.objective = 'FIND THE SHATTERED WARDEN';
  }

  /* ---------------------------------------------------------------- */
  /* construction                                                      */
  /* ---------------------------------------------------------------- */
  _buildTiles() {
    const d = this.dungeon;
    // One cool stone family across the whole crypt: mixing warm brick floors
    // with the blue-grey walls read as two different games.
    const floorTex = [get('tile_floor_stone'), get('tile_floor_dirt')];
    const wallTex = get('tile_wall_brick');
    const wallFlat = get('tile_wall_flat');
    // Floor is one static graphic per room area: cheap and pixel-aligned.
    const g = new Graphics();
    let i = 0;
    for (let y = 0; y < d.rows; y++) {
      for (let x = 0; x < d.cols; x++) {
        if (d.tileAt(x, y) !== WALL) {
          i++;
        }
      }
    }
    // draw floor tiles as individual sprites batched through a RenderTexture-free
    // tiling approach: a Graphics per texture kind is fastest here.
    const floorSprites = new Container();
    for (let y = 0; y < d.rows; y++) {
      for (let x = 0; x < d.cols; x++) {
        if (d.tileAt(x, y) === WALL) continue;
        const room = roomAt(d, x * TILE, y * TILE);
        // rooms alternate between the two stone cuts; corridors (room -1) use
        // the darker one so the paths read as separate from the halls
        const alt = room >= 0 && room % 2 === 1;
        const tex = floorTex[room < 0 ? 1 : alt ? 1 : 0];
        const s = new Sprite(tex);
        s.x = x * TILE;
        s.y = y * TILE;
        s.width = TILE;
        s.height = TILE;
        s.tint = room < 0 ? 0xc8c8d8 : 0xffffff;
        floorSprites.addChild(s);
      }
    }
    this.floorLayer.addChild(floorSprites);

    const walls = new Graphics();
    for (let y = 0; y < d.rows; y++) {
      for (let x = 0; x < d.cols; x++) {
        if (d.tileAt(x, y) !== WALL) continue;
        // only draw walls that touch a floor tile - keeps the sprite count sane
        const nearFloor =
          d.tileAt(x + 1, y) !== WALL || d.tileAt(x - 1, y) !== WALL || d.tileAt(x, y + 1) !== WALL || d.tileAt(x, y - 1) !== WALL;
        if (!nearFloor) continue;
        const tex = d.tileAt(x, y + 1) !== WALL ? wallFlat : wallTex;
        const s = new Sprite(tex);
        s.x = x * TILE;
        s.y = y * TILE;
        s.width = TILE;
        s.height = TILE;
        this.wallLayer.addChild(s);
      }
    }
    this.wallLayer.addChild(walls);
  }

  _buildProps() {
    for (const p of this.dungeon.props) {
      const frames = p.id === 'prop_candle' ? ['prop_candle', 'prop_candle_b'] : [p.id];
      const s = new Sprite(get(frames[0]));
      s.x = p.x * TILE + TILE / 2;
      s.y = p.y * TILE + TILE / 2;
      s.anchor.set(0.5);
      s.width = TILE;
      s.height = TILE;
      s.zIndex = s.y;
      if (frames.length > 1) s.flicker = frames;
      this.propLayer.addChild(s);
    }
    for (const dcl of this.dungeon.decals) {
      if (dcl.id === 'tile_blood') {
        this.decals.stamp(dcl.x * TILE + TILE / 2, dcl.y * TILE + TILE / 2, 'fx_blood', { alpha: 0.5, tint: 0xc8414a, scale: 1.6 });
      } else {
        const s = new Sprite(get(dcl.id));
        s.x = dcl.x * TILE;
        s.y = dcl.y * TILE;
        s.width = TILE;
        s.height = TILE;
        s.alpha = 0.5;
        this.decalLayer.addChild(s);
      }
    }
    for (const c of this.dungeon.chests) {
      c.sprite = new Sprite(get('prop_chest_closed'));
      c.sprite.anchor.set(0.5);
      c.sprite.x = c.x;
      c.sprite.y = c.y;
      c.sprite.zIndex = c.y;
      this.propLayer.addChild(c.sprite);
    }
  }

  _lights() {
    // additive glow sprites; the darkening pass lives in the HUD so the UI
    // never gets dimmed by its own lighting.
    this.lightLayer.blendMode = 'add';
    for (const l of this.dungeon.lights) {
      // small, cool-biased pools: big warm globes were bleaching the floor
      const g = new Sprite(glowTexture(72, '255,186,120'));
      g.anchor.set(0.5);
      g.x = l.x;
      g.y = l.y;
      g.scale.set(0.95 * l.power);
      g.alpha = 0.3;
      g.phase = l.phase;
      g.baseAlpha = 0.5;
      this.lightLayer.addChild(g);
    }
    this.playerLight = new Sprite(glowTexture(120, '170,180,230'));
    this.playerLight.anchor.set(0.5);
    this.playerLight.scale.set(1.25);
    this.playerLight.alpha = 0.22;
    this.lightLayer.addChild(this.playerLight);
  }

  _spawnPlayer() {
    const sp = this.dungeon.spawn;
    this.player = new Actor({
      x: sp.cx * TILE + TILE / 2,
      y: sp.cy * TILE + TILE / 2,
      frames: PLAYER_FRAMES.s,
      radius: 5,
    });
    this.player.maxHp = 100;
    this.player.hp = 100;
    this.player.maxMp = 60;
    this.player.mp = 60;
    this.player.level = 1;
    this.player.xp = 0;
    this.player.xpNext = 20;
    this.player.souls = 0;
    this.player.potions = 2;
    this.player.attackT = 0;
    this.player.attackCd = 0;
    this.player.dashCd = 0;
    this.player.castCd = 0;
    this.player.invuln = 0;
    this.player.dirName = 's';
    this.player.facing = { x: 0, y: 1 };
    this.player.dashDir = { x: 0, y: 1 };
    this.player.dashing = 0;
    this.player.hurtT = 0;
    this.actorLayer.addChild(this.player.container);
    this.root.scale.set(2);
    this.root.pivot.set(0, 0);
  }

  _spawnEnemies() {
    const d = this.dungeon;
    const rooms = d.rooms;
    rooms.forEach((room, i) => {
      if (i === 0) return;
      const isBoss = room === d.bossRoom;
      const count = isBoss ? 0 : 1 + Math.floor(((i * 7919) % 100) / 42); // deterministic 1..3
      const pool = rosterForRoom(i, rooms.length, d.seed);
      for (let k = 0; k < count; k++) {
        const type = pool[(i * 3 + k * 5) % pool.length];
        const x = (room.x + 1 + ((i + k * 3) % Math.max(1, room.w - 2))) * TILE + TILE / 2;
        const y = (room.y + 1 + ((i * 2 + k) % Math.max(1, room.h - 2))) * TILE + TILE / 2;
        this._addEnemy(type, x, y);
      }
    });
    this.bossSpawn = { x: d.bossRoom.cx * TILE + TILE / 2, y: d.bossRoom.cy * TILE + TILE / 2, spawned: false, room: d.bossRoom };
    this.bossRoomIndex = rooms.indexOf(d.bossRoom);
  }

  _addEnemy(type, x, y) {
    const e = createEnemy(type, x, y);
    this.enemies.push(e);
    this.actorLayer.addChild(e.container);
    return e;
  }

  spawnBoss() {
    if (this.bossSpawn.spawned) return;
    this.bossSpawn.spawned = true;
    const b = createEnemy('lich', this.bossSpawn.x, this.bossSpawn.y);
    b.setFrames(['foe_lich_king', 'foe_lich_king_b']);
    b.type = 'warden';
    b.isBoss = true;
    b.maxHp = 420;
    b.hp = 420;
    b.damage = 14;
    b.speed = 30;
    b.souls = 120;
    b.radius = 9;
    b.container.scale.set(1.5);
    b.bossPhase = 0;
    b.attackTimer = 1400;
    b.tele = 0;
    this.enemies.push(b);
    this.actorLayer.addChild(b.container);
    this.particles.spawn({ x: b.x, y: b.y, count: 40, texId: 'fx_sparks_b', speed: 120, life: 900, tint: 0xc3aaff, gravity: 0 });
    this.camera.shake(0.9);
    playSfx('se_boss_roar');
    this.onEvent({ type: 'boss-spawn', boss: b });
    this.objective = 'DESTROY THE SHATTERED WARDEN';
    return b;
  }

  /* ---------------------------------------------------------------- */
  /* simulation                                                        */
  /* ---------------------------------------------------------------- */
  update(dtMs, input, { paused = false } = {}) {
    if (paused) return;
    this.time += dtMs;
    this.elapsed += dtMs;

    this._updatePlayer(dtMs, input);
    for (const e of this.enemies) this._updateEnemy(e, dtMs);
    this._updateProjectiles(dtMs);
    this._updatePickups(dtMs);
    for (const c of this.dungeon.chests) {
      if (c.sprite) {
        c.sprite.y = c.y + Math.sin((this.time + c.x) * 0.002) * 0.6;
      }
    }
    // prop candle flicker
    for (const s of this.propLayer.children) {
      if (s.flicker) s.texture = get(s.flicker[Math.floor((this.time + s.x * 3) / 180) % s.flicker.length]);
    }
    for (const l of this.lightLayer.children) {
      if (l.phase !== undefined) l.alpha = l.baseAlpha + Math.sin(this.time * 0.006 + l.phase) * 0.12;
    }
    this.playerLight.x = this.player.x;
    this.playerLight.y = this.player.y - 4;

    this.particles.update(dtMs);
    this.floating.update(dtMs);

    // camera looks toward travel direction
    const moving = Math.abs(this.player.vx) > 4 || Math.abs(this.player.vy) > 4;
    this.camera.focus(this.player.x, this.player.y - 6, moving ? this.player.facing : { x: 0, y: 0 }, moving ? 20 : 0);
    this.camera.update(dtMs);
    this.camera.apply(this.root);

    this._checkBoss();
  }

  _updatePlayer(dtMs, input) {
    const p = this.player;
    p.attackT = Math.max(0, p.attackT - dtMs);
    p.attackCd = Math.max(0, p.attackCd - dtMs);
    p.dashCd = Math.max(0, p.dashCd - dtMs);
    p.castCd = Math.max(0, p.castCd - dtMs);
    p.invuln = Math.max(0, p.invuln - dtMs);
    p.hurtT = Math.max(0, p.hurtT - dtMs);

    const ax = input.axis.x;
    const ay = input.axis.y;
    const len = Math.hypot(ax, ay) || 1;

    if (Math.abs(ax) > 0.2 || Math.abs(ay) > 0.2) {
      p.facing = { x: ax / len, y: ay / len };
      p.dirName = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'e' : 'w') : ay > 0 ? 's' : 'n';
    }
    p.setFrames(PLAYER_FRAMES[p.dirName] || PLAYER_FRAMES.s);
    if (p.dirName === 's' || p.dirName === 'e' || p.dirName === 'w' || p.dirName === 'n') {
      p.sprite.scale.x = 1;
    }

    if (p.dashing > 0) {
      p.dashing -= dtMs;
      const speed = 210;
      moveActor(p, p.dashDir.x * speed * (dtMs / 1000), p.dashDir.y * speed * (dtMs / 1000), this.dungeon, p.radius);
      if (Math.random() < 0.6) {
        this.particles.spawn({ x: p.x, y: p.y - 4, count: 1, texId: 'fx_smoke', speed: 12, life: 260, tint: 0x8899bb, gravity: 0, scale: 0.4 });
      }
    } else {
      const speed = 74 * (p.attackT > 0 ? 0.42 : 1);
      const dx = (ax / len) * speed * (dtMs / 1000);
      const dy = (ay / len) * speed * (dtMs / 1000);
      moveActor(p, dx, dy, this.dungeon, p.radius);
      p.vx = dx * 60;
      p.vy = dy * 60;
      if (Math.abs(dx) + Math.abs(dy) > 0.001) {
        p.animate(dtMs, 1);
        if (!p.stepT || this.time - p.stepT > 330) {
          p.stepT = this.time;
          if (Math.random() < 0.8) playSfx('se_step', { volume: 0.35, pitchJitter: 0.16 });
        }
      } else {
        p.vx = 0;
        p.vy = 0;
      }
    }

    if (input.wasPressed('attack') && p.attackCd <= 0) this._playerAttack();
    if (input.wasPressed('cast') && p.castCd <= 0) this._playerCast();
    if (input.wasPressed('dash') && p.dashCd <= 0) {
      p.dashing = 160;
      p.dashCd = 520;
      p.invuln = Math.max(p.invuln, 180);
      p.dashDir = { ...p.facing };
      playSfx('se_dash', { volume: 0.7 });
      this.particles.spawn({ x: p.x, y: p.y - 4, count: 8, texId: 'fx_smoke', speed: 30, life: 340, tint: 0xcfe0ff, gravity: 0, scale: 0.5 });
    }
    if (input.wasPressed('interact')) this._interact();

    // auto-potion on very low health keeps a run alive without pausing flow
    if (p.hp > 0 && p.hp < p.maxHp * 0.28 && p.potions > 0 && !p.autoPotCd) {
      p.autoPotCd = true;
      this.usePotion();
    }
    if (p.hp > p.maxHp * 0.6) p.autoPotCd = false;

    p.maxMp = 60 + (p.level - 1) * 6;
    if (this.time - (this._lastMpTick || 0) > 900) {
      this._lastMpTick = this.time;
      p.mp = Math.min(p.maxMp, p.mp + 1.2 + p.level * 0.25);
    }

    p.flash = Math.max(0, p.flash - dtMs);
    p.sync();
    p.sprite.visible = !(p.invuln > 0 && Math.floor(this.time / 70) % 2 === 0);
  }

  _playerAttack() {
    const p = this.player;
    p.attackT = 190;
    p.attackCd = 330;
    playSfx(Math.random() > 0.5 ? 'se_slash' : 'se_slash2', { volume: 0.75 });
    const reach = 20;
    const cx = p.x + p.facing.x * reach * 0.7;
    const cy = p.y - 4 + p.facing.y * reach * 0.7;
    // arc particles
    this.particles.spawn({
      x: cx,
      y: cy,
      count: 7,
      texId: 'fx_sparks_b',
      speed: 80,
      life: 210,
      tint: 0xffe8b0,
      gravity: 0,
      dir: Math.atan2(p.facing.y, p.facing.x),
      spread: 1.5,
      scale: 0.7,
    });
    let hits = 0;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > reach + e.radius) continue;
      const dot = (dx / (dist || 1)) * p.facing.x + (dy / (dist || 1)) * p.facing.y;
      if (dot < 0.25) continue;
      const crit = Math.random() < 0.14;
      const dmg = Math.round((7 + p.level * 2.2) * (crit ? 2 : 1) * (0.9 + Math.random() * 0.2));
      this._damageEnemy(e, dmg, { crit, from: p.facing });
      hits++;
    }
    if (hits) {
      this.onEvent({ type: 'hitstop', ms: 55 + hits * 12 });
      this.camera.shake(0.18 + hits * 0.05);
    }
  }

  _playerCast() {
    const p = this.player;
    const cost = 8;
    if (p.mp < cost) {
      playSfx('se_ui_denied', { volume: 0.5 });
      return;
    }
    p.mp -= cost;
    p.castCd = 380;
    p.attackT = 150;
    playSfx('se_fireball', { volume: 0.8 });
    const proj = new Actor({
      x: p.x + p.facing.x * 10,
      y: p.y - 4 + p.facing.y * 10,
      frames: ['fx_burst'],
      radius: 4,
      flying: true,
    });
    proj.sprite.width = 14;
    proj.sprite.height = 14;
    proj.tint = 0xffc070;
    proj.vx = p.facing.x * 175;
    proj.vy = p.facing.y * 175;
    proj.life = 1100;
    proj.damage = 16 + p.level * 4;
    proj.fromPlayer = true;
    this.actorLayer.addChild(proj.container);
    this.projectiles.push(proj);
    this.particles.spawn({ x: proj.x, y: proj.y, count: 5, texId: 'fx_sparks_a', speed: 40, life: 240, tint: 0xff9a3c, gravity: 0 });
  }

  usePotion() {
    const p = this.player;
    if (p.potions <= 0) {
      playSfx('se_ui_denied');
      return;
    }
    p.potions--;
    const heal = Math.round(p.maxHp * 0.45);
    p.hp = Math.min(p.maxHp, p.hp + heal);
    playSfx('se_heal', { volume: 0.8 });
    this.floating.spawn(p.x, p.y - 18, `+${heal}`, { color: COLORS.ghost, size: 6, font: 'pixel' });
    this.particles.spawn({ x: p.x, y: p.y - 6, count: 12, texId: 'fx_sparks_a', speed: 46, life: 520, tint: 0x8fffe0, gravity: -20 });
    this.onEvent({ type: 'potion-used', potions: p.potions });
  }

  _interact() {
    const p = this.player;
    for (const c of this.dungeon.chests) {
      if (c.opened) continue;
      if (Math.hypot(c.x - p.x, c.y - p.y) < 22) {
        c.opened = true;
        c.sprite.texture = get('prop_chest_open');
        playSfx('se_pickup');
        const roll = Math.random();
        if (roll < 0.5) {
          p.potions++;
          this.floating.spawn(c.x, c.y - 16, 'FLASK +1', { color: COLORS.ghost, size: 6, font: 'pixel' });
        } else {
          const gained = 12 + Math.floor(Math.random() * 10);
          this.gainSouls(gained);
          this.floating.spawn(c.x, c.y - 16, `SOULS +${gained}`, { color: COLORS.gold, size: 6, font: 'pixel' });
        }
        this.particles.spawn({ x: c.x, y: c.y - 6, count: 14, texId: 'fx_sparks_b', speed: 60, life: 600, tint: COLORS.gold, gravity: -30 });
        this.onEvent({ type: 'chest', potions: p.potions });
        return;
      }
    }
  }

  _updateEnemy(e, dtMs) {
    if (e.dead) return;
    e.hitFlash = Math.max(0, e.hitFlash - dtMs);
    e.cooldown = Math.max(0, e.cooldown - dtMs);
    e.animT += dtMs;
    const p = this.player;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy);
    const nx = dx / (dist || 1);
    const ny = dy / (dist || 1);
    const sees = dist < e.def.aggro && lineOfSight(this.dungeon, e.x, e.y, p.x, p.y);
    e.aggro = sees || e.aggro;

    if (e.isBoss) {
      this._updateBoss(e, dtMs, dist, nx, ny);
    } else if (e.aggro) {
      const speed = e.speed * (dtMs / 1000);
      if (e.def.behavior === 'caster') {
        if (dist > 70) moveActor(e, nx * speed, ny * speed, this.dungeon);
        else if (dist < 46) moveActor(e, -nx * speed * 0.6, -ny * speed * 0.6, this.dungeon);
        if (e.cooldown <= 0 && sees) {
          e.cooldown = 1500 + Math.random() * 900;
          this._enemyShoot(e, nx, ny, e.def.projectile || 'ember');
        }
      } else if (e.def.behavior === 'flutter') {
        e.bob += dtMs * 0.008;
        moveActor(e, nx * speed, ny * speed + Math.sin(e.bob) * speed * 0.8, this.dungeon);
      } else if (e.def.behavior === 'hop') {
        e.bob += dtMs * 0.005;
        const hop = Math.max(0, Math.sin(e.bob));
        e.container.scale.set(1 + hop * 0.06, 1 - hop * 0.08);
        moveActor(e, nx * speed * (0.35 + hop), ny * speed * (0.35 + hop), this.dungeon);
      } else if (e.def.behavior === 'phase') {
        e.alpha = 0.55 + Math.abs(Math.sin(e.bob += dtMs * 0.004)) * 0.45;
        moveActor(e, nx * speed, ny * speed, this.dungeon);
      } else {
        moveActor(e, nx * speed, ny * speed, this.dungeon);
      }

      // melee contact
      if (dist < e.radius + p.radius + 4 && e.cooldown <= 0 && e.def.behavior !== 'caster') {
        e.cooldown = 700;
        this._damagePlayer(e.damage, nx, ny);
      }
    } else {
      // idle drift back toward home
      const bx = e.homeX - e.x;
      const by = e.homeY - e.y;
      const bd = Math.hypot(bx, by);
      if (bd > 10) moveActor(e, (bx / bd) * e.speed * 0.25 * (dtMs / 1000), (by / bd) * e.speed * 0.25 * (dtMs / 1000), this.dungeon);
    }

    const moving = e.aggro && e.def.behavior !== 'caster';
    e.animate(dtMs, moving ? Math.min(2.2, 0.6 + e.speed / 40) : 0.5);
    e.sprite.tint = e.hitFlash > 0 ? 0xffdede : e.tint;
    e.sprite.alpha = e.alpha;
    if (e.def.flying) e.sprite.y = -2 + Math.sin(this.time * 0.006 + e.bob) * 1.5;
    e.sync();
  }

  _updateBoss(b, dtMs, dist, nx, ny) {
    const p = this.player;
    b.aggro = true;
    const speed = b.speed * (dtMs / 1000) * (1 + (1 - b.hp / b.maxHp) * 0.6);
    if (b.tele > 0) {
      b.tele -= dtMs;
      b.sprite.tint = Math.floor(this.time / 80) % 2 ? 0xffb0ff : 0xffffff;
      if (b.tele <= 0) {
        // ring of soul bolts
        const count = 10 + Math.floor((1 - b.hp / b.maxHp) * 8);
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2 + this.time * 0.0004;
          this._spawnProjectile(b.x, b.y - 8, Math.cos(a), Math.sin(a), 'soulbolt', b.damage * 0.8);
        }
        playSfx('se_explode', { volume: 0.9 });
        this.camera.shake(0.5);
        b.sprite.tint = 0xffffff;
      }
      return;
    }

    if (dist > 56) moveActor(b, nx * speed, ny * speed, this.dungeon);
    b.attackTimer -= dtMs;
    if (b.attackTimer <= 0) {
      const roll = Math.random();
      if (roll < 0.42) {
        b.tele = 700;
        b.attackTimer = 2600 + Math.random() * 800;
        playSfx('se_fireball', { volume: 0.7 });
      } else if (roll < 0.78) {
        for (let i = -1; i <= 1; i++) {
          const a = Math.atan2(ny, nx) + i * 0.26;
          this._spawnProjectile(b.x, b.y - 8, Math.cos(a), Math.sin(a), 'soulbolt', b.damage * 0.6);
        }
        b.attackTimer = 1500 + Math.random() * 600;
        playSfx('se_fireball', { volume: 0.8 });
      } else {
        // blink toward the player
        this.particles.spawn({ x: b.x, y: b.y - 8, count: 16, texId: 'fx_smoke', speed: 60, life: 500, tint: 0xb090ff, gravity: 0 });
        const path = findPath(this.dungeon, b.x, b.y, p.x, p.y);
        if (path.length) {
          const step = path[Math.min(path.length - 1, 3)];
          b.x = step.x;
          b.y = step.y;
        }
        b.attackTimer = 1200;
        playSfx('se_boss_roar', { volume: 0.5 });
      }
    }
    if (dist < 20) this._damagePlayer(b.damage * 0.7, nx, ny);
    b.animate(dtMs, 1.2);
    b.sync();
  }

  _enemyShoot(e, nx, ny, kind) {
    playSfx(kind === 'soulbolt' ? 'se_fireball' : 'se_explode', { volume: 0.5, pitchJitter: 0.2 });
    this._spawnProjectile(e.x, e.y - 6, nx, ny, kind, e.damage * 0.8);
  }

  _spawnProjectile(x, y, nx, ny, kind, damage) {
    const proj = new Actor({ x, y, frames: ['fx_burst'], radius: 4, flying: true });
    proj.sprite.width = 12;
    proj.sprite.height = 12;
    proj.tint = kind === 'soulbolt' ? 0xc3aaff : 0xff9a3c;
    proj.vx = nx * 105;
    proj.vy = ny * 105;
    proj.life = 2200;
    proj.damage = damage;
    proj.hostile = true;
    proj.kind = kind;
    this.actorLayer.addChild(proj.container);
    this.projectiles.push(proj);
  }

  _updateProjectiles(dtMs) {
    const dt = dtMs / 1000;
    const p = this.player;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dtMs;
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      if (Math.random() < 0.5) {
        this.particles.spawn({
          x: pr.x,
          y: pr.y,
          count: 1,
          texId: 'fx_sparks_a',
          speed: 8,
          life: 260,
          tint: pr.tint,
          gravity: 0,
          scale: 0.5,
        });
      }
      let done = pr.life <= 0 || isSolid(this.dungeon, pr.x, pr.y);
      if (!done) {
        if (pr.hostile) {
          if (Math.hypot(pr.x - p.x, pr.y - p.y) < p.radius + 6) {
            this._damagePlayer(pr.damage, pr.vx / 100, pr.vy / 100);
            done = true;
          }
        } else {
          for (const e of this.enemies) {
            if (e.dead) continue;
            if (Math.hypot(pr.x - e.x, pr.y - e.y) < e.radius + 7) {
              this._damageEnemy(e, pr.damage, { crit: false, from: { x: pr.vx / 100, y: pr.vy / 100 } });
              done = true;
              break;
            }
          }
        }
      }
      if (done) {
        this.particles.spawn({ x: pr.x, y: pr.y, count: 10, texId: 'fx_sparks_b', speed: 70, life: 300, tint: pr.tint, gravity: 20 });
        pr.container.destroy();
        this.projectiles.splice(i, 1);
        continue;
      }
      pr.sync();
    }
  }

  _updatePickups(dtMs) {
    const p = this.player;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.life -= dtMs;
      const dx = p.x - pk.x;
      const dy = p.y - pk.y;
      const d = Math.hypot(dx, dy);
      if (d < 46) {
        pk.x += (dx / d) * 90 * (dtMs / 1000);
        pk.y += (dy / d) * 90 * (dtMs / 1000);
      }
      pk.sprite.y = pk.y + Math.sin((this.time + pk.seed) * 0.008) * 1.5;
      pk.sprite.x = pk.x;
      if (d < 10 || pk.life <= 0) {
        if (d < 14) {
          if (pk.kind === 'soul') {
            this.gainSouls(pk.value);
            this.floating.spawn(pk.x, pk.y - 10, `+${pk.value}`, { color: COLORS.gold, size: 6, font: 'pixel' });
          } else if (pk.kind === 'potion') {
            p.potions++;
            this.floating.spawn(pk.x, pk.y - 10, 'FLASK', { color: COLORS.ghost, size: 6, font: 'pixel' });
          }
          playSfx('se_pickup', { volume: 0.5 });
        }
        pk.sprite.destroy();
        this.pickups.splice(i, 1);
      }
    }
  }

  dropLoot(x, y, souls) {
    const count = 1 + Math.floor(souls / 6);
    for (let i = 0; i < count; i++) {
      const s = new Sprite(get('item_soul'));
      s.anchor.set(0.5);
      s.width = 10;
      s.height = 10;
      this.actorLayer.addChild(s);
      const a = Math.random() * Math.PI * 2;
      this.pickups.push({
        kind: 'soul',
        value: Math.ceil(souls / count),
        x: x + Math.cos(a) * 6,
        y: y + Math.sin(a) * 6,
        sprite: s,
        life: 12000,
        seed: Math.random() * 1000,
      });
    }
    if (Math.random() < 0.14) {
      const s = new Sprite(get('item_potion_hp'));
      s.anchor.set(0.5);
      s.width = 11;
      s.height = 11;
      this.actorLayer.addChild(s);
      this.pickups.push({ kind: 'potion', x, y: y + 4, sprite: s, life: 14000, seed: Math.random() * 1000 });
    }
  }

  gainSouls(n) {
    const p = this.player;
    p.souls += n;
    p.xp += n;
    if (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level++;
      p.xpNext = Math.round(p.xpNext * 1.55 + 8);
      p.maxHp += 12;
      p.hp = p.maxHp;
      p.mp = p.maxMp;
      playSfx('se_levelup', { volume: 0.85 });
      this.floating.spawn(p.x, p.y - 26, `LEVEL ${p.level}`, { color: COLORS.gold, size: 8, font: 'title', life: 1500 });
      this.particles.spawn({ x: p.x, y: p.y - 6, count: 26, texId: 'fx_sparks_b', speed: 70, life: 900, tint: COLORS.gold, gravity: -40 });
      this.onEvent({ type: 'level-up', level: p.level });
    } else {
      this.onEvent({ type: 'souls', souls: p.souls });
    }
  }

  _damageEnemy(e, dmg, { crit, from } = {}) {
    e.hp -= dmg;
    e.hitFlash = 130;
    e.aggro = true;
    playSfx('se_hit', { volume: 0.65, pitchJitter: 0.14 });
    this.floating.spawn(e.x + (Math.random() * 8 - 4), e.y - 16, `${dmg}`, {
      color: crit ? COLORS.gold : COLORS.white,
      size: crit ? 8 : 6,
      font: 'pixel',
      life: crit ? 950 : 700,
    });
    this.particles.spawn({
      x: e.x,
      y: e.y - 6,
      count: crit ? 16 : 9,
      texId: 'fx_sparks_b',
      speed: crit ? 110 : 70,
      life: 380,
      tint: crit ? 0xffe08a : 0xffd0d0,
      dir: Math.atan2(-(from?.y || 0), -(from?.x || 1)),
      spread: 1.9,
    });
    this.decals.stamp(e.x + (Math.random() * 6 - 3), e.y + 2, 'fx_blood', { alpha: 0.42, tint: 0xa03040, scale: 0.7 });
    if (e.hp <= 0) this._killEnemy(e);
  }

  _killEnemy(e) {
    e.dead = true;
    e.container.destroy();
    playSfx('se_enemy_die', { volume: 0.6, pitchJitter: 0.18 });
    this.particles.spawn({ x: e.x, y: e.y - 6, count: 18, texId: 'fx_smoke', speed: 50, life: 620, tint: 0x8a7f9a, gravity: -20, scale: 0.8 });
    this.particles.spawn({ x: e.x, y: e.y - 6, count: 10, texId: 'fx_sparks_a', speed: 90, life: 420, tint: e.tint, gravity: 30 });
    this.dropLoot(e.x, e.y, e.souls);
    this.onEvent({ type: 'enemy-died', enemy: e });
    if (e.isBoss) {
      this.camera.shake(1);
      this.onEvent({ type: 'boss-died' });
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          this.particles.spawn({ x: e.x + (Math.random() * 40 - 20), y: e.y - 10, count: 20, texId: 'fx_burst', speed: 50, life: 700, tint: 0xc3aaff, gravity: -10, scale: 1.2 });
        }, i * 180);
      }
    }
    const idx = this.enemies.indexOf(e);
    if (idx >= 0) this.enemies.splice(idx, 1);
  }

  _damagePlayer(dmg, nx = 0, ny = 0) {
    const p = this.player;
    if (p.invuln > 0 || p.hp <= 0) return;
    const amount = Math.max(1, Math.round(dmg * (0.9 + Math.random() * 0.2)));
    p.hp -= amount;
    p.invuln = 520;
    p.hurtT = 260;
    p.flash = 120;
    this.camera.shake(0.55);
    this.onEvent({ type: 'player-hit', amount, hp: p.hp, maxHp: p.maxHp });
    playSfx('se_hurt', { volume: 0.9 });
    this.floating.spawn(p.x, p.y - 18, `-${amount}`, { color: COLORS.blood, size: 7, font: 'pixel', life: 800 });
    this.particles.spawn({ x: p.x, y: p.y - 6, count: 12, texId: 'fx_sparks_a', speed: 80, life: 380, tint: 0xff6070, dir: Math.atan2(ny, nx), spread: 1.8 });
    p.x += nx * 9;
    p.y += ny * 9;
    if (p.hp <= 0) {
      p.hp = 0;
      this.onEvent({ type: 'player-died' });
    }
  }

  _checkBoss() {
    const b = this.bossSpawn;
    if (!b || b.spawned) return;
    const room = this.dungeon.bossRoom;
    const tx = Math.floor(this.player.x / TILE);
    const ty = Math.floor(this.player.y / TILE);
    if (tx >= room.x && tx < room.x + room.w && ty >= room.y && ty < room.y + room.h) {
      this.spawnBoss();
    }
  }

  enemyInRoomCount() {
    const r = this.dungeon.bossRoom;
    return this.enemies.filter((e) => {
      const x = Math.floor(e.x / TILE);
      const y = Math.floor(e.y / TILE);
      return x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
    }).length;
  }

  dispose() {
    this.disposed = true;
    if (this.root.parent) this.root.parent.removeChild(this.root);
    this.root.destroy({ children: true });
    this.root = null;
  }
}
