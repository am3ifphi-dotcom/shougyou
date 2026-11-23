// ---------------------------------------------------------------------------
//  HONSHITSU — 本質 / 偏差値60の教室
//  An arcade score-attack in a dark-fantasy corridor that keeps rearranging
//  itself.  Boot → Loading → Title → Menu → Game ⇄ Pause → Result → Retry.
// ---------------------------------------------------------------------------
import { AssetRegistry } from './assets.js';
import { AudioSystem } from './audio.js';
import { InputSystem } from './input.js';
import * as UI from './ui.js';
import { BootState } from './states/boot.js';
import { LoadingState } from './states/loading.js';
import { TitleState } from './states/title.js';
import { MenuState } from './states/menu.js';
import { PlayState } from './states/play.js';
import { PauseState } from './states/pause.js';
import { ResultState } from './states/result.js';
import { CreditsState } from './states/credits.js';
import { OptionsState } from './states/options.js';

const { W, H } = UI;

class Game {
  constructor() {
    this.states = {};
    this.current = null;
    this.currentName = null;
    this.pending = null;
    this.fade = 0;
    this.fadeDir = 0;
    this.fadeSpeed = 3.2;
    this.fadeColor = 0x000000;
    this.onFaded = null;
    this.paused = true;
    this.settings = loadSettings();
    this.save = loadSave();
    this.time = 0;
    this.version = '1.0.0';
    // ?fast=1 forces the low-power path (used for headless capture on
    // software rasterisers, and as an escape hatch on very weak hardware)
    this.forceLowPower = new URLSearchParams(location.search).has('fast');
  }

  async boot() {
    const frame = document.getElementById('frame');
    this.frameEl = frame;

    this.app = new PIXI.Application({
      width: W, height: H,
      antialias: false,
      backgroundColor: 0x05070a,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: false,
      powerPreference: 'high-performance',
    });
    document.getElementById('boot')?.remove();
    frame.appendChild(this.app.view);
    this.app.view.style.imageRendering = 'pixelated';
    this.stage = this.app.stage;
    this.stage.eventMode = 'static';
    this.stage.interactiveChildren = true;

    // ---- letterboxed 16:9 scaling
    this.resize();
    window.addEventListener('resize', () => this.resize());

    // ---- systems
    const res = await fetch('assets.manifest.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('assets.manifest.json missing — run tools/fetch-assets.mjs');
    this.manifest = await res.json();
    this.registry = new AssetRegistry(this.manifest);
    this.audio = new AudioSystem(this.registry);
    this.input = new InputSystem(window);

    // ---- world layer (camera-shaken, post-processed) + UI layer
    this.worldLayer = new PIXI.Container();
    this.uiLayer = new PIXI.Container();
    this.overlayLayer = new PIXI.Container();
    this.stage.addChild(this.worldLayer, this.uiLayer, this.overlayLayer);

    this.fadeGfx = new PIXI.Graphics();
    this.fadeGfx.beginFill(0x000000).drawRect(0, 0, W, H).endFill();
    this.fadeGfx.alpha = 1;
    this.overlayLayer.addChild(this.fadeGfx);
    this.fade = 1; this.fadeDir = -1;

    // ---- global keys
    this.input.on('fullscreen', () => this.toggleFullscreen());
    this.input.on('mute', () => {
      const m = this.audio.toggleMute();
      this.registry.record('system', 'info', m ? 'audio muted' : 'audio unmuted');
    });
    document.addEventListener('fullscreenchange', () => { this.settings.fullscreen = !!document.fullscreenElement; });

    // ---- unlock audio on the first real gesture
    const unlock = () => { this.audio.unlock(); };
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('pointerdown', unlock, { once: true });

    this.registerStates();
    await this.goto('boot', { instant: true });

    this.app.ticker.add(() => this.tick());
    // prefers-reduced-motion still plays, just with less shake
    this.reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    window.addEventListener('beforeunload', () => saveSettings(this.settings, this.save));
  }

  registerStates() {
    const ctx = {
      game: this, app: this.app, stage: this.stage,
      world: this.worldLayer, ui: this.uiLayer, overlay: this.overlayLayer,
      registry: this.registry, audio: this.audio, input: this.input,
      settings: this.settings, save: this.save,
    };
    this.states = {
      boot: new BootState(ctx),
      loading: new LoadingState(ctx),
      title: new TitleState(ctx),
      menu: new MenuState(ctx),
      play: new PlayState(ctx),
      pause: new PauseState(ctx),
      result: new ResultState(ctx),
      credits: new CreditsState(ctx),
      options: new OptionsState(ctx),
    };
  }

  resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const scale = Math.min(vw / W, vh / H);
    const w = W * scale, h = H * scale;
    this.frameEl.style.width = `${W}px`;
    this.frameEl.style.height = `${H}px`;
    this.frameEl.style.transform = `scale(${scale})`;
    this.frameEl.style.position = 'absolute';
    this.frameEl.style.left = `${(vw - w) / 2}px`;
    this.frameEl.style.top = `${(vh - h) / 2}px`;
    this.frameEl.style.transformOrigin = '0 0';
    this.scale = scale;
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.();
  }

  /** Fade through black, swap states, fade back in. */
  async goto(name, { instant = false, data = null, color = 0x000000 } = {}) {
    if (!this.states[name]) throw new Error('unknown state ' + name);
    if (instant) {
      this._swap(name, data);
      this.fade = 1; this.fadeDir = -1; this.fadeColor = color;
      this.fadeGfx.tint = color;
      return;
    }
    if (this.pending) return;
    this.pending = { name, data };
    this.fadeDir = 1;
    this.fadeColor = color;
    this.fadeGfx.tint = color;
    this.input.enabled = false;
  }

  _swap(name, data) {
    this.current?.exit?.();
    this.current = this.states[name];
    this.currentName = name;
    try {
      this.current.enter?.(data);
    } catch (e) {
      console.error(`state "${name}" failed to enter`, e);
      this.registry.record(`state:${name}`, 'fallback', e.message);
    }
    this.registry.log.push({ id: `state:${name}`, status: 'info', detail: '', t: performance.now() });
  }

  tick() {
    const dtMs = Math.min(50, this.app.ticker.deltaMS || 16.7);
    const dt = dtMs / 1000;
    this.time += dt;
    // rolling fps estimate — used to drop expensive effects on weak hardware
    const inst = 1000 / Math.max(1, dtMs);
    this.avgFps = this.avgFps == null ? inst : this.avgFps + (inst - this.avgFps) * 0.05;
    this.lowPower = this.forceLowPower || this.avgFps < 26;
    this.input.update(dtMs, performance.now());

    // ---- fade state machine
    if (this.fadeDir !== 0) {
      this.fade += this.fadeDir * this.fadeSpeed * dt;
      if (this.fade >= 1 && this.fadeDir > 0) {
        this.fade = 1;
        const p = this.pending; this.pending = null;
        if (p) this._swap(p.name, p.data);
        this.fadeDir = -1;
      } else if (this.fade <= 0 && this.fadeDir < 0) {
        this.fade = 0; this.fadeDir = 0;
        this.input.enabled = true;
      }
      this.fadeGfx.alpha = this.fade;
    }
    this.fadeGfx.visible = this.fade > 0.001;
    this.current?.update?.(dt, dtMs);
  }
}

// ---------------------------------------------------------------- settings
const SETTINGS_KEY = 'honshitsu.settings.v1';
const SAVE_KEY = 'honshitsu.save.v1';

function loadSettings() {
  const base = { bgm: 0.55, se: 0.75, voice: 0.8, fullscreen: false, shake: true, scanlines: true, hints: true, language: 'ja' };
  try { return { ...base, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch { return base; }
}
function saveSettings(s, save) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* private mode */ }
  saveSave(save);
}
export function persistSettings(settings, save) { saveSettings(settings, save); }

function loadSave() {
  const base = { best: 0, bestCombo: 0, runs: 0, clears: 0, lastScore: 0, unlockedCredits: false, seenIntro: false, essence: 0 };
  try { return { ...base, ...JSON.parse(localStorage.getItem(SAVE_KEY) || '{}') }; } catch { return base; }
}
export function saveSave(save) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* ignore */ }
}

// ---------------------------------------------------------------- start
const game = new Game();
window.__game = game;
game.boot().catch((err) => {
  console.error(err);
  const boot = document.getElementById('boot') || document.createElement('div');
  boot.textContent = 'BOOT FAILED — ' + err.message;
  boot.style.color = '#d85';
  document.getElementById('frame')?.appendChild(boot);
});
