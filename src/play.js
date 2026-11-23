// play.js — ゲームプレイ状態 (ワールド/カメラ/ウェーブ/HUD/PAUSED)
import { clamp, lerp, rand, randInt, choice, easeOutCubic } from "./core.js";
import {
  drawText, drawPanel, drawBar, drawInputChip, Floater, Toast,
  PALETTE, tintImage,
} from "./ui.js";
import { TUNING, ENEMY_TYPES, wavePlan, TUTORIAL_PROMPTS, INTRO_LINES } from "./data.js";

const W = 640, H = 360;
const FLOOR_TILES = [36, 37, 38, 39, 36, 37];
const WALL_TILES = [57, 58, 59, 41];
const PROP_TILES = [28, 32, 21, 20, 64, 65];

export class PlayState {
  constructor(game, params = {}) {
    this.game = game;
    this.params = params;
    this.paused = false;
    this.pauseIndex = 0;
    this.pauseItems = ["RESUME  さいかい", "OPTIONS  せってい", "TO TITLE  タイトルへ"];
    this.time = 0;
    this.hitStop = 0;
    this.slowmo = 0;
    this.over = false;
    this.overTimer = 0;
    this.won = false;

    const T = TUNING;
    const cp = params.checkpoint;
    this.wave = cp ? cp.wave : 1;
    this.score = cp ? Math.floor(cp.score * 0.5) : 0;
    this.displayScore = this.score;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.maxCombo = 0;
    this.noHit = true;
    this.elapsed = 0;

    const world = T.world;
    this.world = { w: world.w, h: world.h };
    this.player = {
      x: world.w / 2, y: world.h / 2,
      vx: 0, vy: 0,
      hp: cp ? clamp(cp.hp, 30, T.player.hp) : T.player.hp,
      hpGhost: cp ? clamp(cp.hp, 30, T.player.hp) : T.player.hp,
      invuln: 0,
      dashT: 0, dashCd: 0, dashDir: { x: 1, y: 0 },
      fireT: 0,
      face: { x: 0, y: 1 },
      level: cp ? cp.level : 1,
      exp: 0,
      bombs: T.player.bombBase,
      focus: 0,
      flash: 0,
    };
    if (cp) { this.player.exp = cp.exp || 0; }

    this.enemies = [];
    this.pBullets = [];
    this.eBullets = [];
    this.pickups = [];
    this.floaters = [];
    this.toasts = [];
    this.particles = [];
    this.shockwaves = [];

    this.cam = { x: this.player.x, y: this.player.y, shake: 0, shakeT: 0, zoom: 1 };
    this.plan = wavePlan(this.wave);
    this.waveTimer = 0;
    this.spawnTimer = 1.2;
    this.spawnLeft = this.plan.budget;
    this.bossActive = false;
    this.bossRef = null;
    this.waveIntroT = 2.2;
    this.introShown = false;
    this.tutorial = TUTORIAL_PROMPTS.map((t) => ({ ...t, t: 0, started: false, done: false }));
    this.dialogT = 0;
    this.dialogIndex = 0;
    this.dialog = params.checkpoint ? null : INTRO_LINES.slice();
    this.cutinT = 0;
    this.cutinBoss = false;

    // floor noise (seeded)
    this.floorNoise = [];
    let seed = 12345;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 400; i++) this.floorNoise.push(rnd());

    this.tileCache = new Map();
    this.promptCache = new Map();
    this.animClock = 0;
    this.flashT = 0;
    this.toastQueue = [];
    this.bossNameT = 0;
    this.resultSaved = false;
  }

  // ---------------------------------------------------------------- assets
  tile(idx) {
    if (this.tileCache.has(idx)) return this.tileCache.get(idx);
    const img = new Image();
    img.src = `assets/sprites/tiny_dungeon/tile_${String(idx).padStart(4, "0")}.png`;
    this.tileCache.set(idx, img);
    return img;
  }
  micro(idx) {
    const key = "m" + idx;
    if (this.tileCache.has(key)) return this.tileCache.get(key);
    const img = new Image();
    img.src = `assets/sprites/micro_roguelike/tile_${String(idx).padStart(4, "0")}.png`;
    this.tileCache.set(key, img);
    return img;
  }
  explosionFrame(i) {
    const key = "e" + i;
    if (this.tileCache.has(key)) return this.tileCache.get(key);
    const img = new Image();
    img.src = `assets/fx/explosion/pixelExplosion${String(i).padStart(2, "0")}.png`;
    this.tileCache.set(key, img);
    return img;
  }
  promptTile(idx) {
    if (this.promptCache.has(idx)) return this.promptCache.get(idx);
    const img = new Image();
    img.src = `assets/ui/input/tile_${String(idx).padStart(4, "0")}.png`;
    this.promptCache.set(idx, img);
    return img;
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    const g = this.game;
    const inp = g.input;
    this.animClock += dt;

    if (this.paused) { this.updatePause(inp); return; }

    // hit stop / slowmo
    if (this.hitStop > 0) { this.hitStop -= dt; return; }
    let step = dt;
    if (this.slowmo > 0) { this.slowmo -= dt; step = dt * 0.35; }
    this.time += step;
    this.elapsed += step;

    if (this.over) {
      this.overTimer += step;
      this.updateParticles(step);
      this.updateFloaters(step);
      if (this.overTimer > 1.6 && !this.resultSaved) {
        this.resultSaved = true;
        g.finishRun({
          score: Math.floor(this.score), wave: this.wave, kills: this.kills,
          maxCombo: this.maxCombo, won: this.won,
        });
      }
      return;
    }

    // dialog (intro message window)
    if (this.dialog) {
      this.dialogT += step;
      if (inp.justPressed("confirm") || inp.justPressed("cancel") || inp.anyPressed()) {
        this.dialogIndex++;
        this.dialogT = 0;
        g.audio.playSE("se_text_blip", { vol: 0.5, rate: 1.2 });
        if (this.dialogIndex >= this.dialog.length) {
          this.dialog = null;
          this.cutinT = 1.4;
          this.cutinBoss = false;
        }
      }
    }

    this.updatePlayer(step);
    this.updateEnemies(step);
    this.updateBullets(step);
    this.updatePickups(step);
    this.updateParticles(step);
    this.updateFloaters(step);
    this.updateWaves(step);

    // combo decay
    if (this.comboTimer > 0) {
      this.comboTimer -= step;
      if (this.comboTimer <= 0 && this.combo > 0) {
        this.combo = Math.max(0, this.combo - TUNING.combo.decay * step * 60);
        if (this.combo < 0.05) this.combo = 0;
      }
    }
    this.displayScore = lerp(this.displayScore, this.score, 1 - Math.pow(0.001, step));

    // hp ghost decay
    const p = this.player;
    if (p.hpGhost > p.hp) p.hpGhost = Math.max(p.hp, p.hpGhost - 26 * step);
    else p.hpGhost = p.hp;
    p.flash = Math.max(0, p.flash - step * 3);

    // tutorial prompts
    for (const t of this.tutorial) {
      if (t.done) continue;
      if (!t.started && this.elapsed > t.at) { t.started = true; t.t = 0; }
      if (t.started) {
        t.t += step;
        if (t.t > t.life) t.done = true;
      }
    }

    // toasts
    this.toasts = this.toasts.filter((t) => t.update(step));

    // camera
    const T = TUNING.camera;
    const lead = { x: p.vx * T.lookahead, y: p.vy * T.lookahead };
    const tx = p.x + lead.x, ty = p.y + lead.y;
    const k = 1 - Math.pow(0.0001, step * (T.smooth / 6.5));
    this.cam.x = lerp(this.cam.x, tx, k);
    this.cam.y = lerp(this.cam.y, ty, k);
    if (this.cam.shakeT > 0) {
      this.cam.shakeT -= step;
      this.cam.shake *= Math.pow(0.02, step);
    }
    this.flashT = Math.max(0, this.flashT - step * 2.4);
    this.cutinT = Math.max(0, this.cutinT - step);
    if (this.bossNameT > 0) this.bossNameT -= step;

    if (inp.justPressed("pause") && !this.dialog) {
      this.paused = true;
      this.pauseIndex = 0;
      g.audio.playSE("se_ui_pause");
    }
  }

  updatePause(inp) {
    const g = this.game;
    if (inp.justPressed("up")) { this.pauseIndex = (this.pauseIndex + this.pauseItems.length - 1) % this.pauseItems.length; g.audio.playSE("se_ui_move"); }
    if (inp.justPressed("down")) { this.pauseIndex = (this.pauseIndex + 1) % this.pauseItems.length; g.audio.playSE("se_ui_move"); }
    if (inp.justPressed("cancel") || inp.justPressed("pause")) {
      this.paused = false;
      g.audio.playSE("se_ui_unpause");
      return;
    }
    if (inp.justPressed("confirm")) {
      g.audio.playSE("se_ui_confirm");
      if (this.pauseIndex === 0) { this.paused = false; g.audio.playSE("se_ui_unpause"); }
      else if (this.pauseIndex === 1) { g.openOptions(() => g.setState(this, true)); }
      else if (this.pauseIndex === 2) {
        this.paused = false;
        g.audio.stopBGM(0.6);
        g.toTitle();
      }
    }
  }

  updatePlayer(dt) {
    const g = this.game;
    const p = this.player;
    const inp = g.input;
    const T = TUNING.player;
    if (this.dialog) {
      // 導入ダイアログ中は停止 (アニメのみ)
      p.vx = 0; p.vy = 0;
      if (p.invuln > 0) p.invuln -= dt;
      return;
    }

    const mv = inp.getMove();
    const moving = Math.hypot(mv.x, mv.y) > 0.1;

    if (p.dashT > 0) {
      p.dashT -= dt;
      p.vx = p.dashDir.x * T.dashSpeed;
      p.vy = p.dashDir.y * T.dashSpeed;
      // dash trail particles
      if (Math.random() < 0.7) {
        this.spawnParticle(p.x, p.y, { color: PALETTE.violet, size: rand(3, 6), life: 0.35, vx: -p.vx * 0.1, vy: -p.vy * 0.1 });
      }
    } else {
      const sp = T.speed * (1 + (p.level - 1) * 0.012);
      p.vx = mv.x * sp;
      p.vy = mv.y * sp;
      if (moving) { p.face.x = mv.x; p.face.y = mv.y; }
      if (inp.justPressed("dash") && p.dashCd <= 0 && moving) {
        p.dashT = T.dashTime;
        p.dashCd = T.dashCooldown;
        p.dashDir = { x: mv.x, y: mv.y };
        p.invuln = Math.max(p.invuln, T.dashTime + 0.08);
        g.audio.playSE("se_dash", { vol: 0.8 });
        for (let i = 0; i < 6; i++) {
          this.spawnParticle(p.x, p.y, { color: PALETTE.cyan, size: rand(2, 5), life: 0.4, vx: rand(-40, 40), vy: rand(-40, 40) });
        }
      }
      p.dashCd = Math.max(0, p.dashCd - dt);
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const margin = 26;
    p.x = clamp(p.x, margin, this.world.w - margin);
    p.y = clamp(p.y, margin, this.world.h - margin);

    // shooting
    p.fireT -= dt;
    const shootHeld = inp.down("shoot") || inp.down("confirm") && !this.dialog;
    if (shootHeld && p.fireT <= 0 && !this.dialog) {
      const rate = Math.max(0.07, T.shootInterval - (p.level - 1) * T.levelFireBonus);
      p.fireT = rate;
      const dmg = T.bulletDamage + (p.level - 1) * T.levelDamageBonus;
      const spread = Math.min(0.24, (p.level - 1) * 0.035);
      const shots = 1 + Math.floor((p.level - 1) / 3);
      for (let i = 0; i < shots; i++) {
        const baseA = Math.atan2(p.face.y, p.face.x);
        const a = baseA + (i - (shots - 1) / 2) * spread;
        this.pBullets.push({
          x: p.x + Math.cos(a) * 12, y: p.y + Math.sin(a) * 12,
          vx: Math.cos(a) * T.bulletSpeed, vy: Math.sin(a) * T.bulletSpeed,
          r: 4, dmg, life: 1.2,
        });
      }
      g.audio.playSE("se_shoot", { vol: 0.32, rate: 1 + Math.min(0.35, (p.level - 1) * 0.03) });
    }

    // bomb
    if (inp.justPressed("bomb") && p.bombs > 0 && !this.dialog) {
      p.bombs--;
      this.doBomb();
    }

    // invulnerability
    if (p.invuln > 0) p.invuln -= dt;

    // exp / level
    const need = 6 + p.level * 3;
    if (p.exp >= need) {
      p.exp -= need;
      p.level++;
      p.hp = Math.min(TUNING.player.hp, p.hp + 14);
      this.floaters.push(new Floater("LEVEL UP!", p.x, p.y - 22, { color: PALETTE.gold, size: 10, life: 1.2, vy: -22 }));
      this.toasts.push(new Toast(`LEVEL ${p.level}`, "火力・連射が上昇した", null));
      g.audio.playSE("se_levelup", { vol: 0.7 });
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        this.spawnParticle(p.x, p.y, { color: PALETTE.gold, size: rand(2, 5), life: 0.7, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90 });
      }
    }
  }

  doBomb() {
    const g = this.game;
    const p = this.player;
    g.audio.playSE("se_bomb", { vol: 0.85 });
    this.shake(12, 0.5);
    this.flashT = 1;
    this.shockwaves.push({ x: p.x, y: p.y, r: 10, max: 300, life: 0.55, t: 0 });
    for (let i = 0; i < 42; i++) {
      const a = rand(0, Math.PI * 2);
      this.spawnParticle(p.x, p.y, {
        color: choice([PALETTE.gold, PALETTE.cyan, PALETTE.white]),
        size: rand(3, 8), life: rand(0.4, 0.9),
        vx: Math.cos(a) * rand(90, 260), vy: Math.sin(a) * rand(90, 260),
      });
    }
    for (const e of this.enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < 300) this.damageEnemy(e, 26 + (300 - d) * 0.08, true);
    }
    this.eBullets.length = 0;
  }

  updateEnemies(dt) {
    const g = this.game;
    const p = this.player;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const T = ENEMY_TYPES[e.type];
      e.flash = Math.max(0, e.flash - dt * 4);
      e.t += dt;

      if (e.type === "eye") {
        // turret: hover & shoot
        e.shootT -= dt;
        if (e.shootT <= 0) {
          e.shootT = rand(1.6, 2.4) / (1 + this.wave * 0.03);
          const a = Math.atan2(p.y - e.y, p.x - e.x);
          this.eBullets.push({
            x: e.x, y: e.y,
            vx: Math.cos(a) * 130, vy: Math.sin(a) * 130,
            r: 5, dmg: T.damage * 0.9, life: 3,
          });
          g.audio.playSE("se_shoot", { vol: 0.18, rate: 0.7 });
        }
      } else if (e.type === "fake") {
        const a = Math.atan2(p.y - e.y, p.x - e.x) + Math.sin(e.t * 4 + e.seed) * 0.9;
        e.x += Math.cos(a) * T.speed * e.speedScale * dt;
        e.y += Math.sin(a) * T.speed * e.speedScale * dt;
      } else if (e.type === "bat") {
        const a = Math.atan2(p.y - e.y, p.x - e.x);
        const perp = a + Math.PI / 2;
        const wob = Math.sin(e.t * 5 + e.seed) * 0.85;
        e.x += (Math.cos(a) + Math.cos(perp) * wob) * T.speed * e.speedScale * dt;
        e.y += (Math.sin(a) + Math.sin(perp) * wob) * T.speed * e.speedScale * dt;
      } else if (T.boss) {
        this.updateBoss(e, dt);
      } else {
        const a = Math.atan2(p.y - e.y, p.x - e.x);
        e.x += Math.cos(a) * T.speed * e.speedScale * dt;
        e.y += Math.sin(a) * T.speed * e.speedScale * dt;
      }
      e.x = clamp(e.x, 20, this.world.w - 20);
      e.y = clamp(e.y, 20, this.world.h - 20);

      // contact damage
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < e.r + 10 && p.invuln <= 0 && !this.over) {
        this.hurtPlayer(T.damage, e);
      }
    }
    this.enemies = this.enemies.filter((e) => !e.dead || e.deadT < 0.45);
    for (const e of this.enemies) if (e.dead) e.deadT += dt;
  }

  updateBoss(e, dt) {
    const p = this.player;
    const phase = e.hp / e.maxHp;
    const T = ENEMY_TYPES.boss;
    // move toward player slowly, keep distance
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    if (d > 160) { e.x += Math.cos(a) * T.speed * dt * 1.6; e.y += Math.sin(a) * T.speed * dt * 1.6; }
    else if (d < 110) { e.x -= Math.cos(a) * T.speed * dt; e.y -= Math.sin(a) * T.speed * dt; }
    else { e.x += Math.cos(a + Math.PI / 2) * T.speed * dt * 1.2; e.y += Math.sin(a + Math.PI / 2) * T.speed * dt * 1.2; }

    e.shootT -= dt;
    const interval = phase > 0.5 ? 1.7 : 1.15;
    if (e.shootT <= 0) {
      e.shootT = interval;
      this.game.audio.playSE("se_shoot", { vol: 0.3, rate: 0.55 });
      const n = phase > 0.5 ? 10 : 16;
      const spin = e.spin || 0;
      e.spin = spin + 0.28;
      for (let i = 0; i < n; i++) {
        const ang = spin + (i / n) * Math.PI * 2;
        const sp = phase > 0.5 ? 105 : 125;
        this.eBullets.push({
          x: e.x, y: e.y,
          vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp,
          r: 5, dmg: 12, life: 5, ring: true,
        });
      }
      // aimed shot
      const aa = Math.atan2(p.y - e.y, p.x - e.x);
      this.eBullets.push({
        x: e.x, y: e.y,
        vx: Math.cos(aa) * 190, vy: Math.sin(aa) * 190,
        r: 6, dmg: 16, life: 3.2,
      });
      // summon
      if (Math.random() < (phase > 0.5 ? 0.22 : 0.4) && this.enemies.length < 14) {
        for (let s = 0; s < 2; s++) {
          this.spawnEnemy(Math.random() < 0.5 ? "fake" : "bat", e.x + rand(-60, 60), e.y + rand(-60, 60));
        }
      }
    }
  }

  updateBullets(dt) {
    const p = this.player;
    for (const b of this.pBullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (Math.random() < 0.25) {
        this.spawnParticle(b.x, b.y, { color: PALETTE.gold, size: 2, life: 0.22, vx: 0, vy: 0 });
      }
      for (const e of this.enemies) {
        if (e.dead) continue;
        const d = Math.hypot(e.x - b.x, e.y - b.y);
        if (d < e.r + b.r) {
          b.life = 0;
          this.damageEnemy(e, b.dmg, false);
          break;
        }
      }
    }
    this.pBullets = this.pBullets.filter((b) => b.life > 0 && b.x > -20 && b.x < this.world.w + 20 && b.y > -20 && b.y < this.world.h + 20);

    for (const b of this.eBullets) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      const d = Math.hypot(p.x - b.x, p.y - b.y);
      if (d < 11 + b.r && p.invuln <= 0 && !this.over) {
        b.life = 0;
        this.hurtPlayer(b.dmg, null);
      }
    }
    this.eBullets = this.eBullets.filter((b) => b.life > 0 && b.x > -30 && b.x < this.world.w + 30 && b.y > -30 && b.y < this.world.h + 30);
  }

  updatePickups(dt) {
    const g = this.game;
    const p = this.player;
    for (const k of this.pickups) {
      k.t += dt;
      const d = Math.hypot(p.x - k.x, p.y - k.y);
      if (d < 70) {
        const a = Math.atan2(p.y - k.y, p.x - k.x);
        const pull = lerp(300, 90, clamp(d / 70, 0, 1));
        k.x += Math.cos(a) * pull * dt;
        k.y += Math.sin(a) * pull * dt;
      }
      if (d < 16) {
        k.dead = true;
        if (k.kind === "orb") {
          this.score += TUNING.score.orb * (1 + this.combo);
          this.player.exp += 1;
          this.player.focus = Math.min(100, this.player.focus + TUNING.player.focusPerOrb);
          this.combo = Math.min(TUNING.combo.max, this.combo + TUNING.combo.perOrb);
          this.comboTimer = TUNING.combo.window;
          g.audio.playSE("se_coin", { vol: 0.35, rate: rand(0.96, 1.12) });
          if (this.player.focus >= 100 && this.player.bombs < 5) {
            this.player.focus = 0;
            this.player.bombs++;
            this.toasts.push(new Toast("BOMB CHARGED", "ボムが補充された", null));
            g.audio.playSE("se_powerup", { vol: 0.55 });
          }
        } else if (k.kind === "heal") {
          this.player.hp = Math.min(TUNING.player.hp, this.player.hp + 22);
          this.floaters.push(new Floater("+22 HP", p.x, p.y - 18, { color: PALETTE.green }));
          g.audio.playSE("se_heal", { vol: 0.6 });
        } else if (k.kind === "bomb") {
          this.player.bombs = Math.min(5, this.player.bombs + 1);
          this.toasts.push(new Toast("BOMB +1", "ボムを獲得", null));
          g.audio.playSE("se_powerup", { vol: 0.6 });
        }
      }
    }
    this.pickups = this.pickups.filter((k) => !k.dead);
  }

  updateParticles(dt) {
    for (const p of this.particles) {
      p.t += dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= Math.pow(0.12, dt); p.vy *= Math.pow(0.12, dt);
    }
    this.particles = this.particles.filter((p) => p.t < p.life);
    for (const s of this.shockwaves) s.t += dt;
    this.shockwaves = this.shockwaves.filter((s) => s.t < s.life);
  }

  updateFloaters(dt) {
    this.floaters = this.floaters.filter((f) => f.update(dt));
  }

  updateWaves(dt) {
    const g = this.game;
    if (this.dialog) return;
    if (this.waveIntroT > 0) {
      this.waveIntroT -= dt;
      return;
    }

    // spawn logic
    if (this.spawnLeft > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = this.plan.spawnInterval * rand(0.7, 1.3);
        const n = this.plan.boss ? 1 : randInt(1, 2);
        for (let i = 0; i < n && this.spawnLeft > 0; i++) {
          const type = choice(this.plan.types);
          this.spawnEnemy(type);
          this.spawnLeft--;
        }
      }
    }

    // boss spawn
    if (this.plan.boss && !this.bossActive && this.spawnLeft <= 0 && this.enemies.length === 0) {
      this.bossActive = true;
      this.cutinT = 1.8;
      this.cutinBoss = true;
      this.bossNameT = 3.2;
      g.audio.playSE("se_boss_warning", { vol: 0.9 });
      this.shake(8, 0.6);
      const final = this.plan.boss.final;
      const boss = this.spawnEnemy("boss", this.world.w / 2, this.world.h / 2 - 120);
      boss.maxHp = ENEMY_TYPES.boss.hp * (1 + this.wave * 0.12) * (final ? 1.35 : 1);
      boss.hp = boss.maxHp;
      this.bossRef = boss;
      g.audio.playBGM(final ? "bgm_finalboss" : "bgm_boss", 1.2);
    }

    // wave clear
    if (!this.plan.boss && this.spawnLeft <= 0 && this.enemies.every((e) => e.dead) && !this.waveCleared) {
      this.waveCleared = true;
      this.onWaveClear();
    }
    if (this.plan.boss && this.bossActive && this.bossRef && this.bossRef.dead && this.bossRef.deadT > 0.3 && !this.won && !this.waveCleared) {
      this.waveCleared = true;
      this.onWaveClear(true);
    }
  }

  onWaveClear(isBoss = false) {
    const g = this.game;
    if (isBoss && this.plan.boss && this.plan.boss.final) this.won = true;
    this.score += TUNING.score.wave * this.wave * (1 + this.combo * 0.5);
    if (isBoss) this.score += TUNING.score.boss * (1 + this.wave * 0.1);
    if (this.noHit) {
      this.score += TUNING.score.noHit;
      this.floaters.push(new Floater("NO DAMAGE BONUS +1000", W / 2, 130, { color: PALETTE.cyan, size: 9, life: 1.6 }));
    }
    this.noHit = true;
    g.audio.playSE("se_jingle_wave", { vol: 0.75 });
    this.toasts.push(new Toast(isBoss ? "BOSS DEFEATED!" : `WAVE ${this.wave} CLEAR`, `SCORE +${Math.floor(TUNING.score.wave * this.wave)}`, null));
    this.wave++;
    if (this.won) {
      this.over = true;
      this.overTimer = 0;
      this.hitStop = 0;
      g.audio.stopBGM(1.2);
      this.shake(16, 1.2);
      for (let i = 0; i < 60; i++) {
        const a = rand(0, Math.PI * 2);
        this.spawnParticle(this.player.x, this.player.y, {
          color: choice([PALETTE.gold, PALETTE.cyan, PALETTE.white, PALETTE.violet]),
          size: rand(3, 8), life: rand(0.6, 1.6),
          vx: Math.cos(a) * rand(60, 300), vy: Math.sin(a) * rand(60, 300),
        });
      }
      return;
    }
    this.plan = wavePlan(this.wave);
    this.spawnLeft = this.plan.budget;
    this.spawnTimer = 1.4;
    this.waveIntroT = 1.6;
    this.waveCleared = false;
    this.bossActive = false;
    this.bossRef = null;
    // BGM change on hard waves
    if (this.wave % 5 === 0) g.audio.playBGM("bgm_rush", 1.5);
    else if (this.wave % 5 === 1) g.audio.playBGM(this.wave > 10 ? "bgm_game_b" : "bgm_game_a", 1.5);
  }

  spawnEnemy(type, x, y) {
    const T = ENEMY_TYPES[type];
    const w = this.world;
    let ex = x, ey = y;
    if (ex === undefined) {
      // spawn at random edge
      const side = randInt(0, 3);
      const m = 30;
      if (side === 0) { ex = rand(m, w.w - m); ey = m; }
      else if (side === 1) { ex = rand(m, w.w - m); ey = w.h - m; }
      else if (side === 2) { ex = m; ey = rand(m, w.h - m); }
      else { ex = w.w - m; ey = rand(m, w.h - m); }
    }
    const e = {
      type, x: ex, y: ey, t: rand(0, 10), seed: rand(0, 10),
      hp: T.hp * this.plan.hpScale, maxHp: T.hp * this.plan.hpScale,
      speedScale: this.plan.speedScale, r: T.r, flash: 0,
      dead: false, deadT: 0, shootT: rand(0.8, 1.8), spin: 0,
    };
    this.enemies.push(e);
    return e;
  }

  damageEnemy(e, dmg, isBomb) {
    const g = this.game;
    if (e.dead) return;
    e.hp -= dmg;
    e.flash = 1;
    this.floaters.push(new Floater(
      String(Math.round(dmg * 10) / 10), e.x + rand(-6, 6), e.y - e.r - 6,
      { color: isBomb ? PALETTE.cyan : PALETTE.white, size: 7, life: 0.55, vy: -34 }
    ));
    for (let i = 0; i < (isBomb ? 6 : 2); i++) {
      this.spawnParticle(e.x, e.y, {
        color: choice([PALETTE.gold, PALETTE.crimson, PALETTE.white]),
        size: rand(2, 4), life: 0.3, vx: rand(-60, 60), vy: rand(-60, 60),
      });
    }
    if (e.hp <= 0) {
      e.dead = true;
      e.deadT = 0;
      const T = ENEMY_TYPES[e.type];
      this.kills++;
      this.combo = Math.min(TUNING.combo.max, this.combo + TUNING.combo.perKill);
      this.comboTimer = TUNING.combo.window;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.score += TUNING.score.kill * (1 + this.combo) * (T.boss ? 8 : 1);
      g.audio.playSE(T.boss ? "se_boss_die" : "se_enemy_die", { vol: T.boss ? 0.9 : 0.4, rate: rand(0.92, 1.1) });
      if (T.boss) {
        this.shake(14, 0.8);
        this.flashT = 1;
        this.hitStop = 0.12;
        this.slowmo = 1.2;
        for (let i = 0; i < 40; i++) {
          const a = rand(0, Math.PI * 2);
          this.spawnParticle(e.x, e.y, {
            color: choice([PALETTE.crimson, PALETTE.gold, PALETTE.white]),
            size: rand(4, 9), life: rand(0.5, 1.1),
            vx: Math.cos(a) * rand(60, 280), vy: Math.sin(a) * rand(60, 280),
          });
        }
      } else {
        this.shake(3, 0.12);
        // drops
        const r = Math.random();
        if (r < 0.75) this.pickups.push({ kind: "orb", x: e.x, y: e.y, t: 0 });
        else if (r < 0.86) this.pickups.push({ kind: "heal", x: e.x, y: e.y, t: 0 });
        else if (r < 0.9) this.pickups.push({ kind: "bomb", x: e.x, y: e.y, t: 0 });
        else this.pickups.push({ kind: "orb", x: e.x, y: e.y, t: 0 });
      }
    } else {
      g.audio.playSE("se_hit", { vol: 0.28, rate: rand(0.95, 1.15) });
    }
  }

  hurtPlayer(dmg, source) {
    const g = this.game;
    const p = this.player;
    if (p.invuln > 0 || this.over) return;
    p.hp -= dmg;
    p.invuln = TUNING.player.invulnAfterHit;
    p.flash = 1;
    this.noHit = false;
    this.combo = Math.max(0, this.combo - 1.2);
    this.flashT = 0.65;
    this.shake(7, 0.35);
    this.hitStop = 0.07;
    g.audio.playSE("se_player_hurt", { vol: 0.7 });
    this.floaters.push(new Floater(`-${Math.round(dmg)}`, p.x, p.y - 24, { color: PALETTE.crimson, size: 10, crit: true }));
    for (let i = 0; i < 12; i++) {
      const a = rand(0, Math.PI * 2);
      this.spawnParticle(p.x, p.y, {
        color: PALETTE.crimson, size: rand(2, 5), life: 0.5,
        vx: Math.cos(a) * rand(40, 150), vy: Math.sin(a) * rand(40, 150),
      });
    }
    if (p.hp <= 0) {
      p.hp = 0;
      this.over = true;
      this.overTimer = 0;
      this.hitStop = 0.25;
      this.slowmo = 1.8;
      g.audio.playSE("se_jingle_gameover", { vol: 0.9 });
      g.audio.stopBGM(1.4);
      this.shake(12, 0.9);
      for (let i = 0; i < 30; i++) {
        const a = rand(0, Math.PI * 2);
        this.spawnParticle(p.x, p.y, {
          color: choice([PALETTE.crimson, PALETTE.violet, PALETTE.white]),
          size: rand(3, 7), life: rand(0.5, 1.2),
          vx: Math.cos(a) * rand(50, 220), vy: Math.sin(a) * rand(50, 220),
        });
      }
    }
  }

  spawnParticle(x, y, opt) {
    this.particles.push({
      x, y, vx: opt.vx || 0, vy: opt.vy || 0,
      size: opt.size || 3, life: opt.life || 0.5, t: 0,
      color: opt.color || PALETTE.white,
    });
    if (this.particles.length > 420) this.particles.shift();
  }

  shake(power, time) {
    this.cam.shake = Math.max(this.cam.shake, power);
    this.cam.shakeT = Math.max(this.cam.shakeT, time);
  }

  // ---------------------------------------------------------------- render
  render(ctx) {
    const g = this.game;
    const shake = this.cam.shakeT > 0 ? this.cam.shake : 0;
    const shX = shake ? rand(-shake, shake) : 0;
    const shY = shake ? rand(-shake, shake) : 0;
    const camX = Math.round(this.cam.x + shX);
    const camY = Math.round(this.cam.y + shY);

    this.renderWorld(ctx, camX, camY);

    // shockwaves
    for (const s of this.shockwaves) {
      const p = s.t / s.life;
      const r = lerp(s.r, s.max, easeOutCubic(p));
      ctx.save();
      ctx.globalAlpha = (1 - p) * 0.8;
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 4 + (1 - p) * 6;
      ctx.beginPath();
      ctx.arc(s.x - camX + W / 2, s.y - camY + H / 2, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // pickups
    for (const k of this.pickups) {
      const sx = Math.round(k.x - camX + W / 2);
      const sy = Math.round(k.y - camY + H / 2 + Math.sin(k.t * 3) * 2);
      ctx.save();
      if (k.kind === "orb") {
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 12);
        glow.addColorStop(0, "rgba(255,210,124,0.55)");
        glow.addColorStop(1, "rgba(255,210,124,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(sx - 12, sy - 12, 24, 24);
        ctx.fillStyle = PALETTE.gold;
        ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = PALETTE.white;
        ctx.beginPath(); ctx.arc(sx - 1, sy - 1, 1.5, 0, Math.PI * 2); ctx.fill();
      } else if (k.kind === "heal") {
        this.drawMicro(ctx, 34 + (Math.floor(k.t * 4) % 2), sx - 8, sy - 8); // potion-ish from micro roguelike fallback
        ctx.fillStyle = "rgba(123,182,97,0.8)";
        ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = PALETTE.white;
        ctx.fillRect(sx - 3, sy - 1, 6, 2); ctx.fillRect(sx - 1, sy - 3, 2, 6);
      } else {
        ctx.fillStyle = PALETTE.cyan;
        ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = PALETTE.ink;
        ctx.font = '7px "PressStart2P",monospace';
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("B", sx, sy + 1);
      }
      ctx.restore();
    }

    // enemies
    for (const e of this.enemies) this.renderEnemy(ctx, e, camX, camY);

    // player bullets
    for (const b of this.pBullets) {
      const sx = Math.round(b.x - camX + W / 2);
      const sy = Math.round(b.y - camY + H / 2);
      ctx.save();
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 9);
      glow.addColorStop(0, "rgba(255,210,124,0.7)");
      glow.addColorStop(1, "rgba(255,210,124,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(sx - 9, sy - 9, 18, 18);
      ctx.fillStyle = PALETTE.gold;
      ctx.fillRect(sx - 2, sy - 2, 4, 4);
      ctx.fillStyle = PALETTE.white;
      ctx.fillRect(sx - 1, sy - 1, 2, 2);
      ctx.restore();
    }

    // enemy bullets
    for (const b of this.eBullets) {
      const sx = Math.round(b.x - camX + W / 2);
      const sy = Math.round(b.y - camY + H / 2);
      ctx.save();
      const c = b.ring ? PALETTE.violet : PALETTE.crimson;
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 10);
      glow.addColorStop(0, b.ring ? "rgba(183,154,224,0.65)" : "rgba(226,86,92,0.65)");
      glow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(sx - 10, sy - 10, 20, 20);
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(sx, sy, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath(); ctx.arc(sx - 1, sy - 1, Math.max(1.5, b.r * 0.4), 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    // player
    this.renderPlayer(ctx, camX, camY);

    // particles (additive)
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of this.particles) {
      const k = 1 - p.t / p.life;
      const sx = Math.round(p.x - camX + W / 2);
      const sy = Math.round(p.y - camY + H / 2);
      ctx.globalAlpha = k * 0.9;
      ctx.fillStyle = p.color;
      const s = Math.max(1, Math.round(p.size * k));
      ctx.fillRect(sx - s / 2, sy - s / 2, s, s);
    }
    ctx.restore();

    // floaters
    for (const f of this.floaters) f.render(ctx);

    // vignette
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.85);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(8,4,16,0.55)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // hit flash overlay
    if (this.flashT > 0) {
      ctx.fillStyle = `rgba(255,80,90,${this.flashT * 0.28})`;
      ctx.fillRect(0, 0, W, H);
    }

    // HUD
    if (!this.dialog) this.renderHUD(ctx);

    // wave intro banner
    if (this.waveIntroT > 0 && !this.dialog) {
      const t = 1 - this.waveIntroT / 2.2;
      const a = clamp(Math.min(t * 3, (1 - t) * 3 + 0.2), 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      const label = this.plan.name;
      drawText(ctx, label, W / 2, 86, {
        size: this.plan.boss ? 16 : 18, font: "jp",
        color: this.plan.boss ? PALETTE.crimson : PALETTE.gold,
        align: "center", glow: "rgba(255,210,124,0.8)",
      });
      ctx.restore();
    }

    // boss name
    if (this.bossNameT > 0 && this.bossRef) {
      const a = clamp(this.bossNameT / 1.2, 0, 1);
      ctx.save();
      ctx.globalAlpha = a * 0.9;
      drawText(ctx, "地図の魔王 — THE MAP DEMON", W / 2, 60, {
        size: 10, font: "jp", color: PALETTE.crimson, align: "center",
      });
      ctx.restore();
    }

    // cutin
    if (this.cutinT > 0) this.renderCutin(ctx);

    // dialog window
    if (this.dialog) this.renderDialog(ctx);

    // toasts
    let ty = 96;
    for (const t of this.toasts.slice(-3)) {
      t.render(ctx, W - 184, ty, this.game.borderImg);
      ty += 40;
    }

    if (this.paused) this.renderPause(ctx);
  }

  renderWorld(ctx, camX, camY) {
    // parallax background art
    const bg = this.game.assets.img("art_bg_game");
    ctx.fillStyle = "#0b0714";
    ctx.fillRect(0, 0, W, H);
    if (bg && bg.width) {
      const par = 0.12;
      const bw = W * 1.35, bh = bw * (bg.height / bg.width);
      const ox = -((camX * par) % bw);
      const oy = -((camY * par) % bh) - (bh - H) / 2;
      ctx.globalAlpha = 0.85;
      for (let i = -1; i <= 1; i++) {
        ctx.drawImage(bg, ox + i * bw, oy, bw, bh);
      }
      ctx.globalAlpha = 1;
    }

    // floor tiles
    const ts = 16;
    const startTX = Math.floor((camX - W / 2) / ts) - 1;
    const startTY = Math.floor((camY - H / 2) / ts) - 1;
    const endTX = Math.ceil((camX + W / 2) / ts) + 1;
    const endTY = Math.ceil((camY + H / 2) / ts) + 1;
    for (let ty = startTY; ty <= endTY; ty++) {
      for (let tx = startTX; tx <= endTX; tx++) {
        const wx = tx * ts, wy = ty * ts;
        const sx = Math.round(wx - camX + W / 2);
        const sy = Math.round(wy - camY + H / 2);
        const outside = wx < 24 || wy < 24 || wx > this.world.w - 40 || wy > this.world.h - 40;
        if (outside) {
          const n = Math.abs((tx * 7 + ty * 13)) % WALL_TILES.length;
          const img = this.tile(WALL_TILES[n]);
          if (img.complete && img.naturalWidth) ctx.drawImage(img, sx, sy, ts, ts);
        } else {
          const n = Math.abs((tx * 31 + ty * 17)) % FLOOR_TILES.length;
          const img = this.tile(FLOOR_TILES[n]);
          if (img.complete && img.naturalWidth) ctx.drawImage(img, sx, sy, ts, ts);
          // occasional prop
          const h = this.floorNoise[Math.abs((tx * 3 + ty * 5)) % this.floorNoise.length];
          if (h > 0.982) {
            const pIdx = PROP_TILES[Math.floor(h * 1000) % PROP_TILES.length];
            const pimg = this.tile(pIdx);
            if (pimg.complete && pimg.naturalWidth) ctx.drawImage(pimg, sx, sy, ts, ts);
          }
        }
      }
    }

    // essence cracks glow (procedural)
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const t = this.animClock;
    for (let i = 0; i < 14; i++) {
      const hx = 120 + ((i * 331) % (this.world.w - 240));
      const hy = 120 + ((i * 217) % (this.world.h - 240));
      const sx = hx - camX + W / 2;
      const sy = hy - camY + H / 2;
      if (sx < -60 || sx > W + 60 || sy < -60 || sy > H + 60) continue;
      const pulse = 0.12 + 0.1 * Math.sin(t * 1.4 + i);
      const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 26);
      glow.addColorStop(0, `rgba(255,210,124,${pulse})`);
      glow.addColorStop(1, "rgba(255,210,124,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(sx - 26, sy - 26, 52, 52);
    }
    ctx.restore();

    // dark tint overlay for mood
    ctx.fillStyle = "rgba(30,16,48,0.32)";
    ctx.fillRect(0, 0, W, H);
  }

  renderPlayer(ctx, camX, camY) {
    const p = this.player;
    const sx = Math.round(p.x - camX + W / 2);
    const sy = Math.round(p.y - camY + H / 2);
    ctx.save();
    if (p.invuln > 0 && Math.floor(this.animClock * 18) % 2 === 0 && p.dashT <= 0) ctx.globalAlpha = 0.45;
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.ellipse(sx, sy + 10, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    // sprite (数理零 = purple mage girl tile 83)
    const img = this.tile(83);
    const bob = Math.sin(this.animClock * 8) * (Math.hypot(p.vx, p.vy) > 10 ? 1 : 0);
    if (img.complete && img.naturalWidth) {
      if (p.flash > 0) {
        ctx.drawImage(tintImage(img, "#ffffff"), sx - 12, sy - 14 + bob, 24, 24);
      } else {
        ctx.drawImage(img, sx - 12, sy - 14 + bob, 24, 24);
      }
    } else {
      ctx.fillStyle = PALETTE.violet;
      ctx.fillRect(sx - 8, sy - 12, 16, 22);
    }
    // dash ring
    if (p.dashT > 0) {
      ctx.strokeStyle = "rgba(143,216,255,0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy, 14 + Math.sin(this.animClock * 20) * 2, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  renderEnemy(ctx, e, camX, camY) {
    const T = ENEMY_TYPES[e.type];
    const sx = Math.round(e.x - camX + W / 2);
    const sy = Math.round(e.y - camY + H / 2);
    if (sx < -60 || sx > W + 60 || sy < -60 || sy > H + 60) return;
    ctx.save();
    if (e.dead) ctx.globalAlpha = clamp(1 - e.deadT / 0.45, 0, 1);
    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.beginPath(); ctx.ellipse(sx, sy + e.r * 0.7, e.r * 0.85, e.r * 0.38, 0, 0, Math.PI * 2); ctx.fill();

    const img = this.tile(T.sprite);
    const size = T.boss ? 64 : 24;
    const bob = Math.sin(e.t * (T.boss ? 2.2 : 5) + e.seed) * (T.boss ? 3 : 1.6);
    if (img.complete && img.naturalWidth) {
      if (e.flash > 0) {
        ctx.drawImage(tintImage(img, "#ffffff"), sx - size / 2, sy - size / 2 - 6 + bob, size, size);
      } else if (T.boss) {
        // boss aura
        const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 60);
        glow.addColorStop(0, "rgba(226,86,92,0.28)");
        glow.addColorStop(1, "rgba(226,86,92,0)");
        ctx.fillStyle = glow;
        ctx.fillRect(sx - 60, sy - 60, 120, 120);
        // contour map rings
        ctx.strokeStyle = "rgba(123,182,97,0.35)";
        for (let i = 0; i < 3; i++) {
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(sx, sy + 6, 26 + i * 12 + Math.sin(e.t * 1.5 + i) * 3, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.drawImage(img, sx - size / 2, sy - size / 2 - 6 + bob, size, size);
      } else {
        ctx.drawImage(img, sx - size / 2, sy - size / 2 - 6 + bob, size, size);
      }
    } else {
      ctx.fillStyle = T.boss ? PALETTE.crimson : PALETTE.bone;
      ctx.beginPath(); ctx.arc(sx, sy, e.r, 0, Math.PI * 2); ctx.fill();
    }

    // enemy hp pip (non-boss, damaged)
    if (!T.boss && e.hp < e.maxHp && !e.dead) {
      const w = 18;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(sx - w / 2, sy - e.r - 14, w, 3);
      ctx.fillStyle = PALETTE.crimson;
      ctx.fillRect(sx - w / 2, sy - e.r - 14, w * clamp(e.hp / e.maxHp, 0, 1), 3);
    }
    ctx.restore();
  }

  renderHUD(ctx) {
    const g = this.game;
    const p = this.player;
    const inp = g.input;
    const device = inp.device;

    // ---- HP / FOCUS (top-left)
    drawPanel(ctx, 10, 10, 190, 52, { img: null, tint: null, alpha: 0.55, fill: "rgba(13,10,20,0.72)" });
    drawText(ctx, "HP", 18, 17, { size: 8, color: PALETTE.crimson });
    drawBar(ctx, 44, 15, 148, 10, p.hp / TUNING.player.hp, p.hpGhost / TUNING.player.hp, {
      fg: PALETTE.crimson, fgLow: PALETTE.crimsonDark,
    });
    drawText(ctx, `${Math.ceil(p.hp)}/${TUNING.player.hp}`, 44, 28, { size: 7, color: PALETTE.boneDim });
    drawText(ctx, "FOCUS", 18, 40, { size: 7, color: PALETTE.cyan });
    drawBar(ctx, 64, 39, 128, 8, p.focus / 100, p.focus / 100, {
      fg: PALETTE.cyan, fgLow: "#2b6d8f", ghostColor: "rgba(0,0,0,0)",
    });

    // ---- SCORE (top-right)
    drawPanel(ctx, W - 214, 10, 204, 62, { img: null, tint: null, alpha: 0.55, fill: "rgba(13,10,20,0.72)" });
    drawText(ctx, "SCORE", W - 206, 17, { size: 7, color: PALETTE.goldDim });
    drawText(ctx, String(Math.floor(this.displayScore)).padStart(8, "0"), W - 18, 15, {
      size: 12, color: PALETTE.gold, align: "right",
    });
    drawText(ctx, `WAVE ${this.wave}`, W - 206, 34, { size: 8, color: PALETTE.bone });
    drawText(ctx, `TIME ${fmtTime(this.elapsed)}`, W - 206, 48, { size: 7, color: PALETTE.boneDim });
    if (this.combo > 0.05) {
      drawText(ctx, `x${(1 + this.combo).toFixed(1)}`, W - 24, 42, {
        size: 12, color: PALETTE.cyan, align: "right",
        glow: this.combo > 4 ? "rgba(143,216,255,0.9)" : null,
      });
    }

    // ---- objective (right edge, small)
    drawText(ctx, this.plan.boss ? "OBJECTIVE: SLAY THE DEMON" : `OBJECTIVE: SURVIVE WAVE ${this.wave}`, W - 14, 82, {
      size: 6, color: PALETTE.boneDim, align: "right",
    });

    // ---- skill slots (bottom-left)
    this.drawSkillSlot(ctx, 16, H - 46, "dash", "DASH", p.dashCd / TUNING.player.dashCooldown, device, inp);
    this.drawSkillSlot(ctx, 78, H - 46, "bomb", `x${p.bombs}`, 0, device, inp, p.bombs > 0);

    // ---- controls hint (bottom-right, fades)
    if (this.elapsed < 12 && !this.dialog) {
      const a = clamp((12 - this.elapsed) / 3, 0, 1) * 0.8;
      ctx.save();
      ctx.globalAlpha = a;
      drawInputChip(ctx, (i) => this.promptTile(i), "z", "SHOOT", W - 210, H - 20, device, { size: 14 });
      drawInputChip(ctx, (i) => this.promptTile(i), "x", "DASH", W - 128, H - 20, device, { size: 14 });
      drawInputChip(ctx, (i) => this.promptTile(i), "c", "BOMB", W - 58, H - 20, device, { size: 14 });
      ctx.restore();
    }

    // ---- tutorial prompts (bottom-center)
    for (const t of this.tutorial) {
      if (!t.started || t.done) continue;
      const a = clamp(Math.min(t.t * 2, (t.life - t.t) * 1.2), 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      drawInputChip(ctx, (i) => this.promptTile(i), t.icon, t.label, W / 2, H - 74, device, {
        size: 16, align: "center", color: PALETTE.gold,
      });
      ctx.restore();
    }
  }

  drawSkillSlot(ctx, x, y, kind, label, cooldown, device, inp, enabled = true) {
    const g = this.game;
    ctx.save();
    ctx.globalAlpha = enabled ? 1 : 0.45;
    drawPanel(ctx, x, y, 54, 38, { img: null, tint: null, alpha: 0.6, fill: "rgba(13,10,20,0.75)" });
    // icon from darkicons
    const icons = g.iconCache;
    const iconKey = kind === "dash" ? "icon_dash" : "icon_bomb";
    const iconImg = icons[iconKey];
    if (iconImg && iconImg.complete && iconImg.naturalWidth) {
      ctx.drawImage(iconImg, x + 17, y + 4, 20, 20);
    } else {
      ctx.fillStyle = kind === "dash" ? PALETTE.violet : PALETTE.cyan;
      ctx.fillRect(x + 18, y + 6, 18, 16);
    }
    drawText(ctx, label, x + 27, y + 28, { size: 6, color: PALETTE.boneDim, align: "center" });
    // cooldown sweep
    if (cooldown > 0) {
      ctx.fillStyle = "rgba(8,4,16,0.72)";
      ctx.fillRect(x + 1, y + 1, 52, 36 * clamp(cooldown, 0, 1));
    }
    ctx.restore();
  }

  renderCutin(ctx) {
    const g = this.game;
    const total = this.cutinBoss ? 1.8 : 1.4;
    const t = 1 - this.cutinT / total;
    const img = g.assets.img(this.cutinBoss ? "art_cutin_boss" : "art_cutin_rei");
    const a = clamp(Math.min(t * 3.2, (1 - t) * 3.2), 0, 1);
    const slide = (1 - easeOutCubic(clamp(t * 2, 0, 1))) * 220;
    ctx.save();
    ctx.globalAlpha = a;
    if (img && img.width) {
      const h = 250, w = h * (img.width / img.height);
      const x = this.cutinBoss ? W - w + slide : -slide;
      ctx.drawImage(img, x, H - h, w, h);
      // gradient blend
      const grad = this.cutinBoss
        ? ctx.createLinearGradient(x, 0, x + w * 0.5, 0)
        : ctx.createLinearGradient(x + w, 0, x + w * 0.5, 0);
      grad.addColorStop(0, "rgba(13,10,20,0.85)");
      grad.addColorStop(1, "rgba(13,10,20,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(x, H - h, w, h);
    }
    // name banner
    const name = this.cutinBoss ? "地図の魔王 『同じ地図を見せる者』" : "数理零 『首席・偏差値85』";
    drawText(ctx, name, this.cutinBoss ? W - 18 : 18, H - 24, {
      size: 10, font: "jp",
      color: this.cutinBoss ? PALETTE.crimson : PALETTE.cyan,
      align: this.cutinBoss ? "right" : "left",
    });
    ctx.restore();
  }

  renderDialog(ctx) {
    const g = this.game;
    const line = this.dialog[this.dialogIndex];
    if (!line) return;
    const border = g.borderImg;
    const x = 40, y = H - 96, w = W - 80, h = 78;
    drawPanel(ctx, x, y, w, h, { img: border, tint: PALETTE.goldDim, alpha: 0.93 });
    // name plate
    drawPanel(ctx, x + 10, y - 14, 130, 24, { img: border, tint: PALETTE.gold, alpha: 0.95, fill: "#241733" });
    drawText(ctx, line.name, x + 22, y - 8, { size: 9, font: "jp", color: PALETTE.gold });
    // typewriter text
    const chars = Math.floor(this.dialogT * 26);
    const shown = line.text.slice(0, chars);
    drawText(ctx, shown, x + 18, y + 18, { size: 11, font: "jp", color: PALETTE.bone });
    if (chars >= line.text.length) {
      const blink = Math.floor(this.animClock * 2.4) % 2 === 0;
      if (blink) drawText(ctx, "▼", x + w - 26, y + h - 22, { size: 9, color: PALETTE.gold });
    }
  }

  renderPause(ctx) {
    const g = this.game;
    ctx.fillStyle = "rgba(8,4,16,0.72)";
    ctx.fillRect(0, 0, W, H);
    drawText(ctx, "PAUSED", W / 2, 74, {
      size: 22, color: PALETTE.gold, align: "center", glow: "rgba(255,210,124,0.6)",
    });
    drawText(ctx, "— 休 憩 中 —", W / 2, 104, { size: 10, font: "jp", color: PALETTE.boneDim, align: "center" });
    for (let i = 0; i < this.pauseItems.length; i++) {
      const y = 148 + i * 36;
      const sel = i === this.pauseIndex;
      if (sel) {
        drawPanel(ctx, W / 2 - 130, y - 14, 260, 30, {
          img: g.borderImg, tint: PALETTE.gold, alpha: 0.9, fill: "rgba(36,23,51,0.92)",
        });
      }
      drawText(ctx, this.pauseItems[i], W / 2, y, {
        size: 11, font: "jp",
        color: sel ? PALETTE.gold : PALETTE.boneDim,
        align: "center",
        glow: sel ? "rgba(255,210,124,0.55)" : null,
      });
    }
    drawInputChip(ctx, (i) => this.promptTile(i), "esc", "BACK", W / 2, H - 30, g.input.device, { size: 14, align: "center" });
  }
}

function fmtTime(t) {
  const m = Math.floor(t / 60), s = Math.floor(t % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
