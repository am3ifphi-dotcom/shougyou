/**
 * Dungeon generation.
 *
 * Rooms carved into a solid grid, joined by L-shaped corridors, then dressed
 * with props and lights.  The layout is deterministic per seed so a run can be
 * reproduced for testing, and the boss always lands in the room farthest from
 * the entrance.
 */

export const TILE = 16;
export const WALL = 1;
export const FLOOR = 0;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateDungeon(seed = (Math.random() * 1e9) | 0) {
  const rand = mulberry32(seed);
  const cols = 68;
  const rows = 46;
  const grid = new Uint8Array(cols * rows).fill(WALL);
  const at = (x, y) => y * cols + x;
  const inBounds = (x, y) => x > 0 && y > 0 && x < cols - 1 && y < rows - 1;

  const rooms = [];
  const attempts = 220;
  for (let i = 0; i < attempts && rooms.length < 11; i++) {
    const w = 6 + Math.floor(rand() * 6);
    const h = 5 + Math.floor(rand() * 5);
    const x = 2 + Math.floor(rand() * (cols - w - 4));
    const y = 2 + Math.floor(rand() * (rows - h - 4));
    const pad = 2;
    const clash = rooms.some(
      (r) => x < r.x + r.w + pad && x + w + pad > r.x && y < r.y + r.h + pad && y + h + pad > r.y
    );
    if (clash) continue;
    rooms.push({ x, y, w, h, cx: Math.floor(x + w / 2), cy: Math.floor(y + h / 2) });
  }

  // carve
  for (const r of rooms) {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) grid[at(x, y)] = FLOOR;
  }

  // connect each room to the previous one with an L corridor
  for (let i = 1; i < rooms.length; i++) {
    const a = rooms[i - 1];
    const b = rooms[i];
    const hFirst = rand() > 0.5;
    const carveH = (x0, x1, y) => {
      for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) {
        if (inBounds(x, y)) grid[at(x, y)] = FLOOR;
        if (inBounds(x, y + 1)) grid[at(x, y + 1)] = FLOOR;
      }
    };
    const carveV = (y0, y1, x) => {
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) {
        if (inBounds(x, y)) grid[at(x, y)] = FLOOR;
        if (inBounds(x + 1, y)) grid[at(x + 1, y)] = FLOOR;
      }
    };
    if (hFirst) {
      carveH(a.cx, b.cx, a.cy);
      carveV(a.cy, b.cy, b.cx);
    } else {
      carveV(a.cy, b.cy, a.cx);
      carveH(a.cx, b.cx, b.cy);
    }
  }

  const spawn = rooms[0];
  let bossRoom = rooms[0];
  let best = -1;
  for (const r of rooms) {
    const d = Math.hypot(r.cx - spawn.cx, r.cy - spawn.cy);
    if (d > best) {
      best = d;
      bossRoom = r;
    }
  }

  // props & lights, kept off the walkable centre line
  const props = [];
  const lights = [];
  const decals = [];
  const occupied = new Set();
  const freeSpot = (r, margin = 1) => {
    for (let tries = 0; tries < 30; tries++) {
      const x = r.x + margin + Math.floor(rand() * Math.max(1, r.w - margin * 2));
      const y = r.y + margin + Math.floor(rand() * Math.max(1, r.h - margin * 2));
      const key = `${x},${y}`;
      if (occupied.has(key)) continue;
      if (Math.hypot(x - r.cx, y - r.cy) < 2) continue;
      occupied.add(key);
      return { x, y };
    }
    return null;
  };

  for (const [i, r] of rooms.entries()) {
    const propCount = 2 + Math.floor(rand() * 4);
    for (let k = 0; k < propCount; k++) {
      const p = freeSpot(r);
      if (!p) continue;
      const roll = rand();
      let id = 'prop_grave';
      if (roll > 0.78) id = 'prop_statue';
      else if (roll > 0.62) id = 'prop_bones';
      else if (roll > 0.5) id = 'prop_skull';
      else if (roll > 0.36) id = 'prop_coffin';
      props.push({ id, x: p.x, y: p.y, room: i });
    }
    // cobwebs in the corners
    for (const [dx, dy] of [
      [0, 0],
      [r.w - 1, 0],
    ]) {
      decals.push({ id: 'prop_web', x: r.x + dx, y: r.y + dy });
    }
    // candles hugging the walls
    const lightCount = 2 + Math.floor(rand() * 2);
    for (let k = 0; k < lightCount; k++) {
      const p = freeSpot(r, 0);
      if (!p) continue;
      lights.push({ x: p.x * TILE + TILE / 2, y: p.y * TILE + TILE / 2, phase: rand() * Math.PI * 2, power: 0.65 + rand() * 0.5 });
      props.push({ id: 'prop_candle', x: p.x, y: p.y, room: i, light: true });
    }
    if (i === rooms.length - 1) {
      decals.push({ id: 'tile_blood', x: r.cx, y: r.cy });
    }
  }

  // treasure chests
  const chests = [];
  for (let i = 1; i < rooms.length; i++) {
    if (rand() > 0.45) continue;
    const p = freeSpot(rooms[i]);
    if (p) chests.push({ x: p.x * TILE + TILE / 2, y: p.y * TILE + TILE / 2, opened: false, room: i });
  }

  return {
    seed,
    cols,
    rows,
    grid,
    rooms,
    spawn,
    bossRoom,
    props,
    decals,
    lights,
    chests,
    at,
    tileAt: (x, y) => (inBounds(x, y) ? grid[at(x, y)] : WALL),
    worldW: cols * TILE,
    worldH: rows * TILE,
  };
}

export function isSolid(dungeon, px, py) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  return dungeon.tileAt(tx, ty) === WALL;
}

export function roomAt(dungeon, px, py) {
  const tx = Math.floor(px / TILE);
  const ty = Math.floor(py / TILE);
  return dungeon.rooms.findIndex((r) => tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h);
}

export function lineOfSight(dungeon, x0, y0, x1, y1, steps = 24) {
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    if (isSolid(dungeon, x, y)) return false;
  }
  return true;
}

/** Simple BFS over floor tiles used for aggro pathing around corners. */
export function findPath(dungeon, startX, startY, goalX, goalY, maxNodes = 900) {
  const cols = dungeon.cols;
  const sx = Math.floor(startX / TILE);
  const sy = Math.floor(startY / TILE);
  const gx = Math.floor(goalX / TILE);
  const gy = Math.floor(goalY / TILE);
  if (sx === gx && sy === gy) return [];
  const key = (x, y) => y * cols + x;
  const prev = new Map();
  const seen = new Set([key(sx, sy)]);
  const queue = [[sx, sy]];
  let head = 0;
  let found = false;
  while (head < queue.length && seen.size < maxNodes) {
    const [x, y] = queue[head++];
    if (x === gx && y === gy) {
      found = true;
      break;
    }
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (dungeon.tileAt(nx, ny) === WALL) continue;
      const k = key(nx, ny);
      if (seen.has(k)) continue;
      seen.add(k);
      prev.set(k, key(x, y));
      queue.push([nx, ny]);
    }
  }
  if (!found) return [];
  const path = [];
  let cur = key(gx, gy);
  while (cur !== key(sx, sy)) {
    path.push({ x: (cur % cols) * TILE + TILE / 2, y: Math.floor(cur / cols) * TILE + TILE / 2 });
    cur = prev.get(cur);
    if (cur === undefined) return [];
  }
  return path.reverse();
}
