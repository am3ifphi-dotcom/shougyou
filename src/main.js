// main.js — エントリ / ゲームループ (固定タイムステップ) / 状態機械 / レターボックス
import { AssetManager, AudioSystem, Input, Save, clamp } from "./core.js";
import { BootState, LoadingState, TitleState, MenuState, OptionsState, ResultState } from "./states.js";
import { PlayState } from "./play.js";
import { PALETTE } from "./ui.js";

const W = 640, H = 360;

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ctx.imageSmoothingEnabled = false;
    this.input = new Input();
    this.save = new Save();
    this.assets = null;
    this.audio = null;
    this.state = null;
    this.nextState = null;
    this.fade = 1;          // 1 = black
    this.fadeDir = -1;      // fade in
    this.fadeSpeed = 1.6;
    this.accumulator = 0;
    this.lastT = 0;
    this.iconCache = {};
    this.borderImg = null;
    this.cursorImg = null;
    this.running = false;

    this.resize();
    window.addEventListener("resize", () => this.resize());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.state instanceof PlayState && !this.state.paused) {
        this.state.paused = true;
      }
    });
  }

  async boot() {
    const res = await fetch("assets.manifest.json");
    const manifest = await res.json();
    this.assets = new AssetManager(manifest);
    this.audio = new AudioSystem(this.assets, this.save);
    this.input.onFirstInput(() => this.audio.onFirstInput());

    // quick UI images (used everywhere; small)
    this.borderImg = await this.safeImage("assets/ui/borders/panel-border-025.png");
    this.cursorImg = await this.safeImage("assets/ui/cursor/tile_0047.png");
    for (const name of ["icon_dash", "icon_bomb", "icon_hp", "icon_essence", "icon_score", "icon_combo", "icon_boss", "icon_wave", "icon_time", "icon_potion", "icon_atk", "icon_key"]) {
      this.iconCache[name] = await this.safeImage(`assets/ui/darkicons/${name}.png`);
    }

    this.setState(new BootState(this), true);
    this.running = true;
    requestAnimationFrame((t) => this.loop(t));
  }

  async safeImage(url) {
    try {
      return await this.assets.loadImageURL(url);
    } catch (e) {
      return document.createElement("canvas"); // 1x1 fallback
    }
  }

  promptTile(idx) {
    if (!this._promptCache) this._promptCache = new Map();
    if (this._promptCache.has(idx)) return this._promptCache.get(idx);
    const img = new Image();
    img.src = `assets/ui/input/tile_${String(idx).padStart(4, "0")}.png`;
    this._promptCache.set(idx, img);
    return img;
  }

  resize() {
    const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
    this.canvas.style.width = `${Math.floor(W * scale)}px`;
    this.canvas.style.height = `${Math.floor(H * scale)}px`;
  }

  setState(state, instant = false) {
    if (instant) {
      if (this.state && this.state.exit) this.state.exit();
      this.state = state;
      if (state.enter) state.enter();
      this.fade = 0;
      return;
    }
    // fade out -> swap -> fade in
    this.nextState = state;
    this.fadeDir = 1;
    this.fadeSpeed = 2.2;
  }

  setFullscreen(on) {
    if (on && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else if (!on && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }

  startRun(params) {
    this.setState(new PlayState(this, params || {}));
    this.audio.playBGM("bgm_game_a", 1.0);
  }

  finishRun(result) {
    const p = this.state && this.state.player;
    result.time = this.state ? this.state.elapsed : 0;
    // チェックポイント保存 (CONTINUE 用)
    if (!result.won && p) {
      this.save.setCheckpoint({
        wave: Math.max(1, result.wave), score: result.score,
        level: p.level, hp: p.hp, exp: p.exp,
      });
    }
    this.setState(new ResultState(this, result));
  }

  toTitle() {
    this.setState(new TitleState(this));
  }

  openOptions(returnTo) {
    this.setState(new OptionsState(this, returnTo));
  }

  loop(t) {
    if (!this.running) return;
    requestAnimationFrame((tt) => this.loop(tt));
    const dtReal = Math.min(0.05, (t - this.lastT) / 1000 || 0.016);
    this.lastT = t;

    // fixed timestep
    const STEP = 1 / 60;
    this.accumulator += dtReal;
    this.input.pollGamepad();
    while (this.accumulator >= STEP) {
      if (this.state && this.state.update) this.state.update(STEP);
      this.accumulator -= STEP;
      this.input.endFrame(); // 各サブステップで入力一度だけ消費
    }

    // fade transition
    if (this.fadeDir !== 0) {
      this.fade += this.fadeDir * this.fadeSpeed * dtReal;
      if (this.fadeDir === 1 && this.fade >= 1) {
        this.fade = 1;
        if (this.nextState) {
          if (this.state && this.state.exit) this.state.exit();
          this.state = this.nextState;
          this.nextState = null;
          if (this.state.enter) this.state.enter();
        }
        this.fadeDir = -1;
      } else if (this.fadeDir === -1 && this.fade <= 0) {
        this.fade = 0;
        this.fadeDir = 0;
      }
    }

    // render
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    if (this.state && this.state.render) this.state.render(ctx);
    if (this.fade > 0) {
      ctx.fillStyle = `rgba(0,0,0,${clamp(this.fade, 0, 1)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }
}

// ------------------------------------------------------------------ go
const canvas = document.getElementById("game");
const game = new Game(canvas);
game.boot();
window.__game = game; // debug
