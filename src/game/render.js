// ---------------------------------------------------------------------------
//  render.js — everything that draws the corridor: tile batches, walls with
//  depth shading, torch glows, the 本質 haze particles, the post-process grade
//  (bloom → vignette → colour grade), and the camera.
//
//  Rendering is batched: floors/walls are rebuilt only when the current room
//  changes, so a 4K window costs the GPU the same as a 720p one.
// ---------------------------------------------------------------------------
import { ROOM, ROOM_H, CELL, CELL_H, TILE } from './world.js';


export class Stage {
  constructor({ app, registry, world, reducedMotion = false }) {
    this.app = app;
    this.reg = registry;
    this.world = world;
    this.reducedMotion = reducedMotion;

    this.root = new PIXI.Container();
    this.bgLayer = new PIXI.Container();       // parallax void behind the tiles
    this.tileLayer = new PIXI.Container();     // floor + walls
    this.glowLayer = new PIXI.Container();     // additive light pools
    this.entLayer = new PIXI.Container();      // actors, shots, drops
    this.fxLayer = new PIXI.Container();       // impact bursts / particle fx
    this.fgLayer = new PIXI.Container();       // vignette, scanlines, grade
    this.root.addChild(this.bgLayer, this.tileLayer, this.glowLayer, this.entLayer, this.fxLayer, this.fgLayer);

    this.cam = { x: 0, y: 0, tx: 0, ty: 0, shake: 0, shakeX: 0, shakeY: 0, zoom: 1 };
    this.hitstop = 0;
    this.flash = 0;
    this.currentRoom = null;

    this._buildBackdrop();
    this._buildGrade();
  }

  // ---------------------------------------------------------------- backdrop
  _buildBackdrop() {
    const far = this.reg.textures.get('bg_layer_cave_far');
    const near = this.reg.textures.get('bg_layer_cave');
    this.farSprites = [];
    this.nearSprites = [];
    for (let i = 0; i < 2; i++) {
      if (far) {
        const s = new PIXI.Sprite(far);
        s.width = ROOM * 1.15; s.height = ROOM * 1.15;
        s.tint = 0x1b2a36; s.alpha = 0.55;
        s.x = i * ROOM * 1.15;
        this.farSprites.push(s); this.bgLayer.addChild(s);
      }
      if (near) {
        const s = new PIXI.Sprite(near);
        s.width = ROOM * 1.3; s.height = ROOM * 1.3;
        s.tint = 0x0e1620; s.alpha = 0.75;
        s.x = i * ROOM * 1.3;
        this.nearSprites.push(s); this.bgLayer.addChild(s);
      }
    }
    this.bgBase = new PIXI.Graphics();
    this.bgBase.beginFill(0x070b10).drawRect(-ROOM, -ROOM, ROOM * 3, ROOM * 3).endFill();
    this.bgLayer.addChildAt(this.bgBase, 0);

    // 本質 haze: drifting motes that live behind the action
    this.motes = new PIXI.Graphics();
    this.bgLayer.addChild(this.motes);
    this.moteData = Array.from({ length: 90 }, () => ({
      x: Math.random() * ROOM * 3, y: Math.random() * ROOM * 3,
      vy: -6 - Math.random() * 18, vx: (Math.random() - 0.5) * 8,
      s: Math.random() < 0.2 ? 3 : 2, a: 0.06 + Math.random() * 0.22,
      c: Math.random() < 0.4 ? 0x59d7c8 : 0x8fb6d8,
    }));
  }

  // ---------------------------------------------------------------- grade
  _buildGrade() {
    this.fgLayer.eventMode = 'none';
    // One baked full-screen quad holds the colour wash, vignette and
    // scanlines; three separate full-screen passes in software raster turned
    // out to be the single most expensive thing in the frame.
    this.fgTex = bakeGradeTexture(true);
    this.fgNoScanTex = bakeGradeTexture(false);
    this.grade = new PIXI.Sprite(this.fgTex);
    this.grade.width = 1280; this.grade.height = 720;
    this.fgLayer.addChild(this.grade);

    // danger edge: four thin gradient bars, never a full-screen fill
    this.dangerEdge = new PIXI.Graphics();
    this.fgLayer.addChild(this.dangerEdge);

    // white damage flash (only visible for a few frames after a hit)
    this.flashG = new PIXI.Graphics();
    this.flashG.beginFill(0xffffff).drawRect(0, 0, 1280, 720).endFill();
    this.flashG.alpha = 0;
    this.flashG.visible = false;
    this.fgLayer.addChild(this.flashG);
  }

  /** Drop the additive layers when the machine can't keep up. */
  setLowPower(on) {
    if (this._lowPower === on) return;
    this._lowPower = on;
    this.glowLayer.visible = !on;
    this.bgLayer.visible = !on;
    for (const t of this._torches || []) if (t.flame) t.flame.visible = !on;
  }

  setScanlines(on) {
    if (this._scan === on) return;
    this._scan = on;
    this.grade.texture = on ? this.fgTex : this.fgNoScanTex;
  }

  // ---------------------------------------------------------------- rooms
  rebuildRoom(room, dist) {
    this.tileLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.glowLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    this._torches = [];
    const ox = room.tx * ROOM, oy = room.ty * ROOM_H;

    const floorTex = this.reg.textures.get(room.floorId) || this.reg.textures.get('tile_floor_a');
    const depthTint = tintForDist(dist);
    const floor = new PIXI.Container();
    floor.x = ox; floor.y = oy;

    // ---- floor grid: 16×9 tiles of 100 units, value-shifted per tile so the
    // cobbles never read as a repeated stamp
    const altTex = this.reg.textures.get(room.floorAltId) || null;
    if (floorTex) {
      const ts = new PIXI.TilingSprite(floorTex, ROOM, ROOM_H);
      ts.tileScale.set(TILE / floorTex.width);
      ts.tint = depthTint;
      floor.addChild(ts);
      // A second stone, visible but sparse: whole tile rows/columns are left
      // alone so it reads as worn patches instead of a checkerboard.
      if (altTex) {
        for (let y = 0; y < CELL_H; y++) {
          for (let x = 0; x < CELL; x++) {
            const h = ((x * 31 + y * 17 + x * y * 5) % 13);
            if (h > 4) continue;
            const s2 = new PIXI.Sprite(altTex);
            s2.width = s2.height = TILE;
            s2.x = x * TILE; s2.y = y * TILE;
            s2.tint = shade(depthTint, 0.92 + (h % 3) * 0.03);
            s2.alpha = 0.5;
            floor.addChild(s2);
          }
        }
      }
    }
    // grout lines + per-tile value variation, drawn once into one Graphics
    const grid = new PIXI.Graphics();
    for (let y = 0; y < CELL_H; y++) {
      for (let x = 0; x < CELL; x++) {
        const v = ((x * 7 + y * 13) % 7);
        if (v === 0) { grid.beginFill(0xffffff, 0.018).drawRect(x * TILE, y * TILE, TILE, TILE).endFill(); }
        else if (v === 3 || v === 5) { grid.beginFill(0x000000, 0.035).drawRect(x * TILE, y * TILE, TILE, TILE).endFill(); }
      }
    }
    grid.lineStyle(1, 0x000000, 0.10);
    for (let x = 1; x < CELL; x++) { grid.moveTo(x * TILE, 0).lineTo(x * TILE, ROOM_H); }
    for (let y = 1; y < CELL_H; y++) { grid.moveTo(0, y * TILE).lineTo(ROOM, y * TILE); }
    floor.addChild(grid);

    // ---- the north wall: three stacked bands so the room has a "back" to it
    const wallTex = this.reg.textures.get(room.wallId) || this.reg.textures.get('tile_wall_a');
    if (wallTex) {
      const bands = [
        { y: -108, h: 108, tint: 0x4a5460, alpha: 1 },
        { y: -54, h: 62, tint: 0x5c6874, alpha: 1 },
        { y: 0, h: 22, tint: 0x808c98, alpha: 1 },
      ];
      for (const b of bands) {
        const ts = new PIXI.TilingSprite(wallTex, ROOM, b.h);
        ts.x = 0; ts.y = b.y;
        ts.tileScale.set(TILE / wallTex.width);
        ts.tint = b.tint;
        floor.addChild(ts);
      }
      // wall/floor contact shadow: height-limited so it never bands the floor
      const contact = new PIXI.Graphics();
      for (let i = 0; i < 26; i++) {
        contact.beginFill(0x000000, 0.06 * Math.pow(1 - i / 26, 2)).drawRect(0, i * 2, ROOM, 2).endFill();
      }
      floor.addChild(contact);
      // framed doorways on the north wall — where the corridor re-links itself
      for (const dxk of [0.14, 0.5, 0.86]) {
        const door = new PIXI.Sprite(this.reg.textures.get('prop_door_closed') || PIXI.Texture.WHITE);
        door.width = door.height = 96;
        door.x = ROOM * dxk - 48; door.y = -34;
        door.tint = 0x9aa6b2;
        floor.addChild(door);
        const dark = new PIXI.Graphics();
        dark.beginFill(0x05080c, 0.85).drawRect(ROOM * dxk - 44, -30, 88, 40).endFill();
        floor.addChild(dark);
      }
    }
    // side walls: dark columns that frame the edges
    const sideL = new PIXI.Graphics(), sideR = new PIXI.Graphics();
    for (let i = 0; i < 10; i++) {
      const a = 0.62 * (1 - i / 10);
      sideL.beginFill(0x05080c, a).drawRect(-6 + i * 3, 0, 3, ROOM_H).endFill();
      sideR.beginFill(0x05080c, a).drawRect(ROOM - 24 + i * 3, 0, 3, ROOM_H).endFill();
    }
    sideL.beginFill(0x05080c, 0.62).drawRect(-6, 0, 6 + 26, ROOM_H).endFill();
    sideR.beginFill(0x05080c, 0.62).drawRect(ROOM - 6, 0, 6, ROOM_H).endFill();
    floor.addChild(sideL, sideR);

    // ---- pillar clusters: two columns per side, planted against the wall
    for (const key of room.pillarAt) {
      const [px, py] = key.split(',').map(Number);
      const s = new PIXI.Sprite(this.reg.textures.get('prop_column') || PIXI.Texture.WHITE);
      s.anchor.set(0.5, 1);
      s.width = s.height = TILE * 2.1;
      s.x = px * TILE + TILE / 2; s.y = py * TILE + TILE;
      s.tint = 0xaab4c0;
      floor.addChild(s);
      const sh = new PIXI.Graphics();
      sh.beginFill(0x000000, 0.42).drawEllipse(px * TILE + TILE / 2, py * TILE + TILE * 0.98, TILE * 0.92, TILE * 0.2).endFill();
      floor.addChildAt(sh, floor.children.length - 1);
    }

    // ---- blood-slick patches where the old classes used to sit
    for (const p of room.hazardPatches) {
      const tex = this.reg.textures.get('deco_blood');
      if (!tex) continue;
      const s = new PIXI.Sprite(tex);
      s.anchor.set(0.5);
      s.width = s.height = TILE * (1.5 + p.r * 0.5);
      s.x = (p.x / CELL) * ROOM; s.y = (p.y / CELL_H) * ROOM_H;
      s.alpha = 0.22; s.tint = 0x7a5a58;
      floor.addChild(s);
    }
    // ---- scattered bones and candles
    for (let i = 0; i < 8; i++) {
      const id = i % 3 === 0 ? 'deco_bones' : i % 3 === 1 ? 'deco_candle' : 'deco_altar';
      const tex = this.reg.textures.get(id);
      if (!tex) continue;
      const s = new PIXI.Sprite(tex);
      s.anchor.set(0.5);
      s.width = s.height = id === 'deco_altar' ? TILE * 0.9 : TILE * 0.55;
      s.x = 120 + ((i * 197) % (ROOM - 240));
      s.y = 130 + ((i * 131 + 37) % (ROOM_H - 200));
      s.tint = id === 'deco_candle' ? 0xffd8a0 : 0x8e96a0;
      s.alpha = id === 'deco_altar' ? 0.75 : 0.6;
      floor.addChild(s);
      if (id === 'deco_candle') {
        const glow = makeGlow(0xffa850, 130);
        glow.x = s.x; glow.y = s.y;
        glow.alpha = 0.3;
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        this.glowLayer.addChild(glow);
        this._torches.push({ sprite: s, glow, phase: Math.random() * 6.28 });
      }
    }
    this.tileLayer.addChild(floor);

    // ---- wall torches with animated additive flame sheets
    const flameFrames = this.reg.framesById?.fx_torch_anim;
    for (const t of room.torches) {
      // torches live on the back wall, evenly spread, never mid-floor
      this._torchI = (this._torchI || 0) + 1;
      const gx = ox + ROOM * (0.18 + (this._torchI % 4) * 0.21);
      const gy = oy + 44;
      const torch = new PIXI.Sprite(this.reg.textures.get('torch_0') || PIXI.Texture.WHITE);
      torch.anchor.set(0.5, 1);
      torch.width = torch.height = TILE * 0.85;
      torch.x = gx; torch.y = gy;
      torch.tint = 0xffc890;
      this.glowLayer.addChild(torch);
      const glow = makeGlow(0xffb060, 320);
      glow.x = gx; glow.y = gy - 30;
      glow.alpha = 0.30;
      glow.blendMode = PIXI.BLEND_MODES.ADD;
      this.glowLayer.addChild(glow);
      let flame = null;
      if (flameFrames?.length) {
        flame = new PIXI.AnimatedSprite(flameFrames);
        flame.anchor.set(0.5, 1);
        flame.width = flame.height = TILE * 1.5;
        flame.x = gx; flame.y = gy + 8;
        flame.animationSpeed = 0.34;
        flame.blendMode = PIXI.BLEND_MODES.ADD;
        flame.tint = 0xffb070;
        flame.play();
        this.glowLayer.addChild(flame);
      }
      this._torches.push({ sprite: torch, glow, flame, phase: Math.random() * 6.28 });
    }

    this.currentRoom = room;
    this.roomOrigin = { x: ox, y: oy };
  }

  // ---------------------------------------------------------------- camera
  follow(target, aim, dt) {
    // lead the camera 0.22s in front of travel + a nudge toward the aim vector
    const lead = this.reducedMotion ? 0.06 : 0.22;
    this.cam.tx = target.x + target.vx * lead + aim.x * 26;
    this.cam.ty = target.y + target.vy * lead + aim.y * 26;
    const k = 1 - Math.pow(0.0006, dt);
    this.cam.x += (this.cam.tx - this.cam.x) * k;
    this.cam.y += (this.cam.ty - this.cam.y) * k;
    // keep the viewport inside the room so the void never shows at the edges
    const o = this.roomOrigin || { x: 0, y: 0 };
    this.cam.x = Math.min(o.x + ROOM - 660, Math.max(o.x + 660, this.cam.x));
    this.cam.y = Math.min(o.y + ROOM_H - 380, Math.max(o.y + 380, this.cam.y));
    // shake decay
    this.cam.shake *= Math.pow(0.0025, dt);
    if (this.cam.shake < 0.1) this.cam.shake = 0;
    this.cam.shakeX = (Math.random() * 2 - 1) * this.cam.shake;
    this.cam.shakeY = (Math.random() * 2 - 1) * this.cam.shake;
    this.root.x = 640 - this.cam.x + this.cam.shakeX;
    this.root.y = 360 - this.cam.y + this.cam.shakeY;
    // parallax backdrop drifts at a fraction of the camera
    this.bgLayer.x = -this.cam.x * 0.18 + this.cam.shakeX * 0.3;
    this.bgLayer.y = -this.cam.y * 0.12 + this.cam.shakeY * 0.3;
  }

  shake(amount) {
    if (this.reducedMotion) amount *= 0.3;
    this.cam.shake = Math.max(this.cam.shake, amount);
  }

  hitStop(seconds) {
    if (this.reducedMotion) seconds *= 0.4;
    this.hitstop = Math.max(this.hitstop, seconds);
  }

  whiteFlash(a = 0.35) { this.flash = Math.max(this.flash, a); }

  setDanger(level) {
    // 0 = calm, 1 = one hit from death. Four edge bars beat one giant outline.
    const a = level * 0.55;
    if (Math.abs((this._dangerA || 0) - a) < 0.02) return;
    this._dangerA = a;
    const g = this.dangerEdge;
    g.clear();
    if (a <= 0.005) return;
    for (let i = 0; i < 10; i++) {
      const f = 1 - i / 10;
      g.beginFill(0x8d1f2a, a * f * 0.28);
      g.drawRect(0, i * 4, 1280, 4);
      g.drawRect(0, 720 - (i + 1) * 4, 1280, 4);
      g.endFill();
    }
  }

  update(dt) {
    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt * 2.8);
      this.flashG.alpha = this.flash;
      this.flashG.visible = this.flash > 0.01;
    }
    // motes
    this.motes.clear();
    const cx = this.cam.x, cy = this.cam.y;
    for (const m of this.moteData) {
      m.y += m.vy * dt; m.x += m.vx * dt;
      if (m.y < cy - ROOM) { m.y = cy + ROOM * 1.4; m.x = cx + (Math.random() - 0.5) * ROOM * 2.4; }
      // keep the field anchored near the camera so the haze is always on screen
      if (m.x < cx - ROOM * 1.3) m.x += ROOM * 2.6;
      if (m.x > cx + ROOM * 1.3) m.x -= ROOM * 2.6;
      this.motes.beginFill(m.c, m.a);
      this.motes.drawRect(m.x | 0, m.y | 0, m.s, m.s);
      this.motes.endFill();
    }
    // torches flicker
    for (const t of this._torches || []) {
      t.phase += dt * 9;
      const f = 0.34 + Math.sin(t.phase) * 0.06 + Math.sin(t.phase * 2.7) * 0.04 + Math.random() * 0.03;
      t.glow.alpha = f;
      t.sprite.alpha = 0.85 + Math.sin(t.phase * 1.3) * 0.1;
    }
  }
}

// ---------------------------------------------------------------- helpers
function bakeGradeTexture(scan = true) {
  const c = document.createElement('canvas');
  c.width = 640; c.height = 360;
  const g = c.getContext('2d');
  // cool colour wash
  g.fillStyle = 'rgba(18,30,44,0.20)';
  g.fillRect(0, 0, 640, 360);
  // vignette
  const grd = g.createRadialGradient(320, 180, 60, 320, 180, 380);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(0.6, 'rgba(0,0,0,0.10)');
  grd.addColorStop(1, 'rgba(0,0,0,0.70)');
  g.fillStyle = grd; g.fillRect(0, 0, 640, 360);
  if (scan) {
    g.fillStyle = 'rgba(0,0,0,0.16)';
    for (let y = 0; y < 360; y += 2) g.fillRect(0, y, 640, 0.5);
  }
  const tex = PIXI.Texture.from(c);
  tex.baseTexture.scaleMode = PIXI.SCALE_MODES.LINEAR;
  return tex;
}

export function makeGlow(color, radius) {
  const c = document.createElement('canvas');
  const S = 128;
  c.width = c.height = S;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  const [r, gg, b] = [(color >> 16) & 255, (color >> 8) & 255, color & 255];
  grd.addColorStop(0, `rgba(${r},${gg},${b},1)`);
  grd.addColorStop(0.35, `rgba(${r},${gg},${b},0.42)`);
  grd.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  const s = new PIXI.Sprite(PIXI.Texture.from(c));
  s.anchor.set(0.5);
  s.width = s.height = radius;
  return s;
}

export function tintForDist(dist) {
  // deeper counts get colder and darker — a visual cue that the 偏差値 is rising
  const t = Math.min(1, dist / 14);
  const warm = 0xe6d8c6, cold = 0xa8bccc;
  return mixColor(warm, cold, t);
}

export function mixColor(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

export function shade(c, f) {
  const r = Math.min(255, Math.round(((c >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((c >> 8) & 255) * f));
  const b = Math.min(255, Math.round((c & 255) * f));
  return (r << 16) | (g << 8) | b;
}
