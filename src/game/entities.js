/**
 * Entity model.
 *
 * Characters are plain objects with an AnimatedSprite-free sprite wrapper so
 * animation is a couple of texture swaps keyed off a timer.  That keeps the
 * whole cast cheap enough to run dozens of actors at 60fps in a 480x270 buffer.
 */
import { Sprite, Container } from 'pixi.js';
import { get } from '../core/textures.js';
import { TILE, isSolid } from './dungeon.js';

export const ENEMY_TYPES = {
  rat: {
    name: 'Giant Rat',
    frames: ['foe_rat', 'foe_rat_b'],
    hp: 14,
    speed: 34,
    damage: 4,
    souls: 3,
    radius: 5,
    aggro: 90,
    behavior: 'chase',
    tint: 0xd8c8b0,
  },
  bat: {
    name: 'Cave Bat',
    frames: ['foe_bat', 'foe_bat_b'],
    hp: 10,
    speed: 46,
    damage: 3,
    souls: 3,
    radius: 5,
    aggro: 120,
    behavior: 'flutter',
    flying: true,
    tint: 0xc8c0e0,
  },
  slime: {
    name: 'Rot Slime',
    frames: ['foe_slime', 'foe_slime_b'],
    hp: 22,
    speed: 20,
    damage: 5,
    souls: 5,
    radius: 6,
    aggro: 80,
    behavior: 'hop',
    tint: 0xb8e0a0,
  },
  skeleton: {
    name: 'Bone Sentry',
    frames: ['foe_skeleton', 'foe_skeleton_b'],
    hp: 30,
    speed: 30,
    damage: 7,
    souls: 8,
    radius: 6,
    aggro: 130,
    behavior: 'chase',
    tint: 0xffffff,
  },
  goblin: {
    name: 'Grave Goblin',
    frames: ['foe_goblin', 'foe_goblin_b'],
    hp: 26,
    speed: 38,
    damage: 6,
    souls: 7,
    radius: 6,
    aggro: 140,
    behavior: 'chase',
    tint: 0xffffff,
  },
  spider: {
    name: 'Crypt Spider',
    frames: ['foe_spider', 'foe_spider_b'],
    hp: 20,
    speed: 44,
    damage: 6,
    souls: 6,
    radius: 5,
    aggro: 110,
    behavior: 'skitter',
    tint: 0xe0d0ff,
  },
  imp: {
    name: 'Cinder Imp',
    frames: ['foe_imp', 'foe_imp_b'],
    hp: 24,
    speed: 26,
    damage: 6,
    souls: 9,
    radius: 6,
    aggro: 150,
    behavior: 'caster',
    projectile: 'ember',
    tint: 0xffb0a0,
  },
  wraith: {
    name: 'Wraith',
    frames: ['foe_wraith', 'foe_wraith_b'],
    hp: 18,
    speed: 34,
    damage: 8,
    souls: 10,
    radius: 5,
    aggro: 160,
    behavior: 'phase',
    flying: true,
    tint: 0x9fe8f0,
  },
  lich: {
    name: 'Lich Adept',
    frames: ['foe_lich', 'foe_lich_b'],
    hp: 40,
    speed: 22,
    damage: 10,
    souls: 16,
    radius: 6,
    aggro: 190,
    behavior: 'caster',
    projectile: 'soulbolt',
    tint: 0xc0b0ff,
  },
};

export class Actor {
  constructor({ x, y, frames, radius = 6, flying = false }) {
    this.container = new Container();
    this.sprite = new Sprite(get(frames[0]));
    this.sprite.anchor.set(0.5, 0.85);
    this.sprite.width = TILE;
    this.sprite.height = TILE;
    this.container.addChild(this.sprite);
    this.container.x = x;
    this.container.y = y;
    this.frames = frames;
    this.radius = radius;
    this.flying = flying;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.dir = { x: 0, y: 1 };
    this.animT = 0;
    this.frame = 0;
    this.flash = 0;
    this.alpha = 1;
    this.dead = false;
  }

  setFrames(frames) {
    this.frames = frames;
  }

  animate(dtMs, speedScale = 1) {
    this.animT += dtMs * speedScale;
    const step = 170;
    const next = Math.floor(this.animT / step) % this.frames.length;
    if (next !== this.frame) {
      this.frame = next;
      this.sprite.texture = get(this.frames[next]);
    }
  }

  sync() {
    this.container.x = this.x;
    this.container.y = this.y;
    if (this.flash > 0) {
      this.sprite.tint = 0xffffff;
    } else {
      this.sprite.tint = this.tint || 0xffffff;
    }
    this.sprite.alpha = this.alpha;
  }
}

/** Axis-separated movement with wall sliding, used by every walker. */
export function moveActor(actor, dx, dy, dungeon, radius = actor.radius) {
  let nx = actor.x + dx;
  if (!collides(dungeon, nx, actor.y, radius)) actor.x = nx;
  let ny = actor.y + dy;
  if (actor.flying || !collides(dungeon, actor.x, ny, radius)) actor.y = ny;
}

function collides(dungeon, x, y, radius) {
  return (
    isSolid(dungeon, x - radius, y - radius * 0.4) ||
    isSolid(dungeon, x + radius, y - radius * 0.4) ||
    isSolid(dungeon, x - radius, y + 2) ||
    isSolid(dungeon, x + radius, y + 2)
  );
}

export function createEnemy(type, x, y) {
  const def = ENEMY_TYPES[type];
  const actor = new Actor({ x, y, frames: def.frames, radius: def.radius, flying: def.flying });
  actor.type = type;
  actor.def = def;
  actor.hp = def.hp;
  actor.maxHp = def.hp;
  actor.speed = def.speed;
  actor.damage = def.damage;
  actor.tint = def.tint;
  actor.state = 'idle';
  actor.cooldown = 400 + Math.random() * 900;
  actor.bob = Math.random() * Math.PI * 2;
  actor.homeX = x;
  actor.homeY = y;
  actor.hitFlash = 0;
  return actor;
}

/** Enemy roster per depth: shallow rooms get vermin, deep rooms get casters. */
export function rosterForRoom(index, total, depth) {
  const pool = [];
  if (index <= total * 0.3) pool.push('rat', 'rat', 'bat', 'slime');
  else if (index <= total * 0.65) pool.push('skeleton', 'goblin', 'bat', 'slime', 'spider');
  else pool.push('skeleton', 'wraith', 'imp', 'spider', 'lich');
  return pool;
}
