// ---------------------------------------------------------------------------
//  world.js — the endless corridor.
//
//  Rooms are 520×520 units and stream in as the player crosses them. Floor and
//  wall tiles are the CC0 dungeon set; the wall layout changes every floor so
//  the 偏差値 (deviation score) can never settle.
// ---------------------------------------------------------------------------
import { RUN, WAVES } from './content.js';

export const ROOM = RUN.roomW;          // width in world units
export const ROOM_H = RUN.roomH;
export const TILE = 100;                // one floor tile = 100 units
export const CELL = Math.round(ROOM / TILE);      // columns (11)
export const CELL_H = Math.round(ROOM_H / TILE);  // rows (7)

export class World {
  constructor({ registry, seed = Date.now() }) {
    this.reg = registry;
    this.rooms = new Map();
    this.seed = seed >>> 0;
    this.floor = 0;
    this.rand = mulberry32(this.seed);
  }

  key(tx, ty) { return `${tx},${ty}`; }

  roomAt(tx, ty) {
    const k = this.key(tx, ty);
    if (!this.rooms.has(k)) this.rooms.set(k, this._genRoom(tx, ty));
    return this.rooms.get(k);
  }

  _genRoom(tx, ty) {
    const r = this.rand;
    // Each room picks ONE floor family. Mixing the whole set made a
    // checkerboard, so variation is now a subtle tone shift inside a family.
    const floorFamilies = [
      ['tile_floor_a', 'tile_floor_b'],
      ['tile_floor_c', 'tile_floor_d'],
      ['tile_floor_e', 'tile_floor_f'],
      ['tile_floor_b', 'tile_floor_e'],
    ];
    const wallSet = ['tile_wall_a', 'tile_wall_b', 'tile_wall_c', 'tile_wall_d', 'tile_wall_e'];
    const fam = floorFamilies[Math.floor(r() * floorFamilies.length)];
    const floorId = fam[0];
    const floorAltId = fam[1];
    const wallId = wallSet[Math.floor(r() * wallSet.length)];
    const hasPillars = r() < 0.42;
    const pillarAt = new Set();
    if (hasPillars) {
      const n = 1 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) pillarAt.add(`${1 + Math.floor(r() * (CELL - 2))},${1 + Math.floor(r() * (CELL_H - 2))}`);
    }
    const torches = [];
    for (let i = 0; i < 4; i++) if (r() < 0.7) torches.push({ i });

    return {
      tx, ty, floorId, floorAltId, wallId, pillarAt, torches,
      hazardPatches: Array.from({ length: 2 + Math.floor(r() * 3) }, () => ({
        x: r() * CELL, y: r() * CELL_H, r: 1 + r() * 1.8,
      })),
      cleared: false,
      spawned: false,
      spawnBudget: 0,
      boss: null,
    };
  }

  /** Nearest-direction room step for the "which door did you leave through". */
  static doorOf(prev, next) {
    const dx = next.tx - prev.tx, dy = next.ty - prev.ty;
    if (dx > 0) return 'e'; if (dx < 0) return 'w';
    if (dy > 0) return 's'; return 'n';
  }

  /** Threat budget for a room; grows with distance from origin + floor. */
  threatFor(room, dist) {
    const tierIdx = Math.min(WAVES.tiers.length - 1, this.floor + Math.floor(dist / 3));
    const tier = WAVES.tiers[tierIdx];
    const spread = tier.threats * (0.75 + this.rand() * 0.5);
    return { tier, budget: Math.max(4, Math.round(spread * (1 + dist * 0.12))) };
  }

  bossFor(floor) {
    return floor >= 3 ? floor % 3 : -1;
  }
}

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
