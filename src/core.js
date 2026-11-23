// core.js — utilities / asset manager / audio buses / input / save
// 素材は必ず assets.manifest.json の id 経由で参照する。
// assets/user/<id>.<ext> が存在すれば取得素材より優先される。
// 取得失敗素材は合成音(Web Audio)/プロシージャル描画にフォールバックする。

// ---------------------------------------------------------------- math
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutQuad = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOutBack = (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
export const easeOutElastic = (t) => {
  const c4 = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};

// ---------------------------------------------------------------- save
const SAVE_KEY = "honshitsu_save_v1";
export class Save {
  constructor() {
    this.data = {
      options: { bgm: 0.8, se: 0.9, voice: 1.0, fullscreen: false },
      highscores: [], // [{score, wave, kills, date}]
      checkpoint: null, // {wave, score, level, hp} — CONTINUE 用
    };
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) Object.assign(this.data, JSON.parse(raw));
    } catch (e) { /* private mode etc. */ }
  }
  write() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.data)); } catch (e) { /* ignore */ }
  }
  addHighscore(entry) {
    this.data.highscores.push(entry);
    this.data.highscores.sort((a, b) => b.score - a.score);
    this.data.highscores = this.data.highscores.slice(0, 8);
    this.write();
    return this.data.highscores[0] === entry;
  }
  setCheckpoint(cp) { this.data.checkpoint = cp; this.write(); }
  clearCheckpoint() { this.data.checkpoint = null; this.write(); }
}

// ---------------------------------------------------------------- assets
export class AssetManager {
  /**
   * manifest: assets.manifest.json のオブジェクト。
   * COMMERCIAL_BUILD=true のとき noncommercial_only 素材は読み込まずフォールバック。
   */
  constructor(manifest) {
    this.manifest = manifest;
    this.commercial = !!manifest.commercial_build;
    this.byId = new Map();
    for (const a of manifest.assets) this.byId.set(a.id, a);
    this.images = new Map();   // id -> HTMLImageElement | procedural canvas
    this.sounds = new Map();   // id -> AudioBuffer | null (synth fallback)
    this.fonts = new Map();    // id -> family name
    this.failed = new Set();
    this.logs = [];
  }

  log(msg) {
    const line = `[assets] ${msg}`;
    this.logs.push(line);
    if (this.logs.length > 200) this.logs.shift();
    console.log(line);
  }

  entry(id) { return this.byId.get(id); }

  usable(id) {
    const e = this.byId.get(id);
    if (!e) return false;
    if (this.commercial && e.noncommercial_only) return false;
    return true;
  }

  userPath(id, localPath) {
    const ext = (localPath || "").split(".").pop();
    return `assets/user/${id}${ext ? "." + ext : ""}`;
  }

  async tryFetch(url) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (r.ok) return await r.arrayBuffer();
    } catch (e) { /* miss */ }
    return null;
  }

  /** Load everything. onProgress(done,total,label) / onLog(msg) */
  async loadAll(onProgress, onLog) {
    const log = (m) => { this.log(m); if (onLog) onLog(m); };
    const items = this.manifest.assets.filter((a) => {
      if (a.origin === "project-generated") return true; // images at local_path
      if (this.commercial && a.noncommercial_only) {
        log(`skip ${a.id}: noncommercial_only (COMMERCIAL_BUILD) -> fallback`);
        return false;
      }
      return true;
    });
    // fonts first (so text can render during loading)
    const fontItems = items.filter((a) => a.type === "font");
    const otherItems = items.filter((a) => a.type !== "font" && a.type !== "text");
    const total = fontItems.length + otherItems.length;
    let done = 0;
    const tick = (label) => { done++; if (onProgress) onProgress(done, total, label); };

    for (const a of fontItems) {
      try {
        const buf = await this.tryFetch(this.userPath(a.id, a.local_path)) ||
                    await this.tryFetch(a.local_path);
        if (!buf) throw new Error("fetch failed");
        const family = a.id === "font_pressstart2p" ? "PressStart2P" : "DotGothic16";
        const face = new FontFace(family, buf);
        await face.load();
        document.fonts.add(face);
        this.fonts.set(a.id, family);
        log(`font ok: ${a.id} -> ${family}`);
      } catch (e) {
        this.failed.add(a.id);
        this.fonts.set(a.id, "monospace");
        log(`font FAILED: ${a.id} (${e.message}) -> fallback monospace`);
      }
      tick(a.id);
    }

    for (const a of otherItems) {
      if (a.type === "image") await this.loadImage(a, log);
      else if (a.type === "bgm" || a.type === "se") await this.loadSound(a, log);
      else if (a.type === "sprites" || a.type === "ui" || a.type === "icons") await this.loadImagePack(a, log);
      else { log(`skip ${a.id} (type=${a.type})`); }
      tick(a.id);
      // yield so the loading screen can paint
      await new Promise((r) => setTimeout(r, 0));
    }
    log(`load complete: ${done - this.failed.size}/${total} ok, ${this.failed.size} failed`);
  }

  async loadImage(a, log) {
    try {
      const url = (await this.exists(this.userPath(a.id, a.local_path))) ? this.userPath(a.id, a.local_path) : a.local_path;
      const img = await this.loadImageURL(url);
      this.images.set(a.id, img);
      log(`image ok: ${a.id}`);
    } catch (e) {
      this.failed.add(a.id);
      this.images.set(a.id, makeFallbackImage(a.type));
      log(`image FAILED: ${a.id} -> procedural fallback`);
    }
  }

  async loadImagePack(a, log) {
    // pack: local_path はディレクトリ。フォールバックは手描きパネル等。
    try {
      // パックはゲーム側が個別ファイルを参照するため、ここでは存在確認のみ。
      const probe = a.local_path.endsWith("/") ? a.local_path : a.local_path + "/";
      const ok = await this.exists(probe + "tile_0000.png") || await this.exists(probe) || true;
      if (!ok) throw new Error("probe failed");
      log(`pack ok: ${a.id} (${probe})`);
    } catch (e) {
      this.failed.add(a.id);
      log(`pack FAILED: ${a.id} -> procedural fallback`);
    }
  }

  async loadSound(a, log) {
    try {
      const buf = (await this.tryFetch(this.userPath(a.id, a.local_path))) ||
                  await this.tryFetch(a.local_path);
      if (!buf) throw new Error("fetch failed");
      const audioBuf = await AudioSystem.decode(buf);
      this.sounds.set(a.id, audioBuf);
      if (a.variants) {
        const vs = [];
        for (const v of a.variants) {
          const vb = await this.tryFetch(v);
          if (vb) vs.push(await AudioSystem.decode(vb));
        }
        if (vs.length) this.sounds.set(a.id + "__variants", vs);
      }
      log(`sound ok: ${a.id}`);
    } catch (e) {
      this.failed.add(a.id);
      this.sounds.set(a.id, null);
      log(`sound FAILED: ${a.id} -> synth fallback`);
    }
  }

  async exists(url) {
    try {
      const r = await fetch(url, { method: "HEAD", cache: "no-store" });
      return r.ok;
    } catch (e) { return false; }
  }

  loadImageURL(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("img load error " + url));
      img.src = url;
    });
  }

  img(id) {
    if (this.images.has(id)) return this.images.get(id);
    if (!this._fallbacks) this._fallbacks = new Map();
    if (!this._fallbacks.has(id)) this._fallbacks.set(id, makeFallbackImage("image"));
    return this._fallbacks.get(id);
  }
  sound(id) { return this.sounds.get(id); }
  variants(id) { return this.sounds.get(id + "__variants") || null; }
  font(id) { return this.fonts.get(id) || "monospace"; }
}

function makeFallbackImage(type) {
  const c = document.createElement("canvas");
  c.width = 32; c.height = 32;
  const g = c.getContext("2d");
  g.fillStyle = "#2b1b3d"; g.fillRect(0, 0, 32, 32);
  g.fillStyle = "#ffd277"; g.fillRect(2, 2, 28, 28);
  g.fillStyle = "#2b1b3d"; g.fillRect(6, 6, 20, 20);
  return c;
}

// ---------------------------------------------------------------- audio
export class AudioSystem {
  static ctx = null;
  static ensureCtx() {
    if (!AudioSystem.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      AudioSystem.ctx = new AC();
    }
    return AudioSystem.ctx;
  }
  static async decode(arrayBuffer) {
    const ctx = AudioSystem.ensureCtx();
    return await ctx.decodeAudioData(arrayBuffer.slice(0));
  }

  constructor(assets, save) {
    this.assets = assets;
    this.save = save;
    const ctx = AudioSystem.ensureCtx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.buses = {};
    for (const name of ["bgm", "se", "voice"]) {
      const g = ctx.createGain();
      g.connect(this.master);
      this.buses[name] = g;
    }
    this.applyVolumes();
    this.currentBGM = null; // {id, src, gain}
    this.unlocked = false;
  }

  applyVolumes() {
    const o = this.save.data.options;
    this.buses.bgm.gain.value = o.bgm * o.bgm;
    this.buses.se.gain.value = o.se * o.se;
    this.buses.voice.gain.value = o.voice * o.voice;
  }

  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    if (this.ctx.state === "suspended") this.ctx.resume();
  }

  /** SE 再生。同一音の連続単調さ回避のためピッチ/音量を微ランダム化。 */
  playSE(id, { vol = 1, rate = 1, bus = "se" } = {}) {
    if (!this.unlocked) return;
    const ctx = this.ctx;
    let buffer = this.assets.sound(id);
    const variants = this.assets.variants(id);
    if (variants && variants.length && Math.random() < 0.5) buffer = choice(variants);
    const g = ctx.createGain();
    g.gain.value = vol * rand(0.85, 1.0);
    g.connect(this.buses[bus] || this.buses.se);
    if (buffer) {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.playbackRate.value = rate * rand(0.94, 1.06);
      src.connect(g);
      src.start();
    } else {
      // ---- synth fallback (Web Audio 合成音) ----
      this.synthFallback(id, g);
    }
  }

  synthFallback(id, dest) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const beep = (freq, dur, type = "square", slide = 0, gain = 0.18) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(dest);
      o.start(t); o.stop(t + dur);
    };
    const noise = (dur, gain = 0.2, lp = 2000) => {
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const s = ctx.createBufferSource(); s.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = lp;
      const g = ctx.createGain(); g.gain.value = gain;
      s.connect(f); f.connect(g); g.connect(dest);
      s.start(t);
    };
    if (/shoot/.test(id)) beep(880, 0.08, "square", -500);
    else if (/hit/.test(id)) noise(0.08, 0.22, 2600);
    else if (/die|bomb/.test(id)) { noise(0.3, 0.25, 1200); beep(160, 0.3, "triangle", -80); }
    else if (/hurt/.test(id)) beep(220, 0.18, "sawtooth", -120);
    else if (/coin|essence/.test(id)) beep(1320, 0.07, "triangle", 300);
    else if (/confirm|levelup|powerup/.test(id)) { beep(660, 0.07, "square"); beep(990, 0.1, "square"); }
    else if (/cancel|error/.test(id)) beep(240, 0.12, "square", -60);
    else if (/move/.test(id)) beep(520, 0.04, "square");
    else beep(440, 0.08, "square", -40);
  }

  /** BGM クロスフェード再生 */
  playBGM(id, fade = 1.0) {
    if (!this.unlocked) { this.pendingBGM = id; return; }
    if (this.currentBGM && this.currentBGM.id === id) return;
    const ctx = this.ctx;
    const buffer = this.assets.sound(id);
    const old = this.currentBGM;
    if (old) {
      old.gain.gain.cancelScheduledValues(ctx.currentTime);
      old.gain.gain.setValueAtTime(old.gain.gain.value, ctx.currentTime);
      old.gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + fade);
      try { old.src.stop(ctx.currentTime + fade + 0.05); } catch (e) { /* */ }
    }
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.connect(this.buses.bgm);
    if (buffer) {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.loop = true;
      src.connect(gain);
      src.start();
      gain.gain.linearRampToValueAtTime(1, ctx.currentTime + fade);
      this.currentBGM = { id, src, gain };
    } else {
      // synth fallback: 小さなパッド音をループ
      const o = ctx.createOscillator();
      o.type = "triangle"; o.frequency.value = 110;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.15;
      const lfoG = ctx.createGain(); lfoG.gain.value = 8;
      lfo.connect(lfoG); lfoG.connect(o.frequency);
      o.connect(gain); o.start(); lfo.start();
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + fade);
      this.currentBGM = { id, src: o, gain, synth: true };
    }
    this.currentBGMId = id;
  }

  stopBGM(fade = 1.0) {
    if (!this.currentBGM) return;
    const ctx = this.ctx;
    const old = this.currentBGM;
    old.gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + fade);
    try { old.src.stop(ctx.currentTime + fade + 0.05); } catch (e) { /* */ }
    this.currentBGM = null;
  }

  /** 初回入力で呼ばれる */
  onFirstInput() {
    this.unlock();
    if (this.pendingBGM) {
      const id = this.pendingBGM;
      this.pendingBGM = null;
      this.playBGM(id);
    }
  }
}

// ---------------------------------------------------------------- input
export const ACTIONS = ["up", "down", "left", "right", "confirm", "cancel", "shoot", "dash", "bomb", "pause"];

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.released = new Set();
    this.device = "keyboard"; // 'keyboard' | 'pad'
    this.padIndex = null;
    this.padPrev = {};
    this.anyKeyFlag = false;
    this.firstInputCallback = null;

    window.addEventListener("keydown", (e) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Tab"].includes(e.code)) e.preventDefault();
      if (!e.repeat) {
        this.keys.add(e.code);
        this.pressed.add(e.code);
        this.device = "keyboard";
        this.anyKeyFlag = true;
        if (this.firstInputCallback) { this.firstInputCallback(); this.firstInputCallback = null; }
      }
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
      this.released.add(e.code);
    });
    window.addEventListener("blur", () => this.keys.clear());
    window.addEventListener("gamepadconnected", (e) => {
      this.padIndex = e.gamepad.index;
      this.device = "pad";
    });
    window.addEventListener("gamepaddisconnected", () => { this.padIndex = null; });
    // マウス/タッチも「任意のキー」扱い (オーディオ解除用)
    window.addEventListener("pointerdown", () => {
      this.anyKeyFlag = true;
      if (this.firstInputCallback) { this.firstInputCallback(); this.firstInputCallback = null; }
    });
    window.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  onFirstInput(cb) { this.firstInputCallback = cb; }

  pollGamepad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const prev = this.padPrev[p.index] || { buttons: [] };
      const cur = p.buttons.map((b) => (typeof b === "object" ? b.pressed : b > 0.5));
      for (let i = 0; i < cur.length; i++) {
        const name = "pad" + i;
        if (cur[i] && !prev.buttons[i]) {
          this.pressed.add(name);
          this.device = "pad";
          this.anyKeyFlag = true;
          if (this.firstInputCallback) { this.firstInputCallback(); this.firstInputCallback = null; }
        }
        if (!cur[i] && prev.buttons[i]) this.released.add(name);
      }
      this.padPrev[p.index] = { buttons: cur, axes: p.axes ? [...p.axes] : [] };
      if (cur.some(Boolean) || (p.axes && p.axes.some((a) => Math.abs(a) > 0.25))) this.device = "pad";
    }
  }

  endFrame() {
    this.pressed.clear();
    this.released.clear();
    this.anyKeyFlag = false;
  }

  padAxes() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (p && this.padPrev[p.index]) return this.padPrev[p.index].axes || [];
    }
    return [];
  }

  getMove() {
    let x = 0, y = 0;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) x -= 1;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) x += 1;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) y -= 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) y += 1;
    const axes = this.padAxes();
    if (axes.length >= 2) {
      if (Math.abs(axes[0]) > 0.28) x += axes[0];
      if (Math.abs(axes[1]) > 0.28) y += axes[1];
    }
    // dpad
    const dp = (i) => this.pressed.has("pad" + i) || this.padButton(i);
    if (this.padButton(14)) x -= 1;
    if (this.padButton(15)) x += 1;
    if (this.padButton(12)) y -= 1;
    if (this.padButton(13)) y += 1;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }

  padButton(i) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue;
      const st = this.padPrev[p.index];
      if (st && st.buttons && st.buttons[i]) return true;
    }
    return false;
  }

  /** action の押下(単発) */
  justPressed(action) {
    switch (action) {
      case "up": return this.pressed.has("KeyW") || this.pressed.has("ArrowUp") || this.pressed.has("pad12");
      case "down": return this.pressed.has("KeyS") || this.pressed.has("ArrowDown") || this.pressed.has("pad13");
      case "left": return this.pressed.has("KeyA") || this.pressed.has("ArrowLeft") || this.pressed.has("pad14");
      case "right": return this.pressed.has("KeyD") || this.pressed.has("ArrowRight") || this.pressed.has("pad15");
      case "confirm": return this.pressed.has("Enter") || this.pressed.has("KeyZ") || this.pressed.has("Space") || this.pressed.has("pad0");
      case "cancel": return this.pressed.has("Escape") || this.pressed.has("KeyX") || this.pressed.has("pad1");
      case "shoot": return this.pressed.has("KeyZ") || this.pressed.has("KeyJ") || this.pressed.has("pad7") || this.pressed.has("pad2");
      case "dash": return this.pressed.has("KeyX") || this.pressed.has("KeyK") || this.pressed.has("Space") || this.pressed.has("ShiftLeft") || this.pressed.has("pad0") || this.pressed.has("pad4");
      case "bomb": return this.pressed.has("KeyC") || this.pressed.has("KeyL") || this.pressed.has("pad1") || this.pressed.has("pad5");
      case "pause": return this.pressed.has("Escape") || this.pressed.has("KeyP") || this.pressed.has("pad9");
      default: return false;
    }
  }

  down(action) {
    switch (action) {
      case "shoot": return this.keys.has("KeyZ") || this.keys.has("KeyJ") || this.padButton(7) || this.padButton(2);
      case "dash": return this.keys.has("KeyX") || this.keys.has("KeyK") || this.padButton(0) || this.padButton(4);
      case "confirm": return this.keys.has("Enter") || this.keys.has("KeyZ") || this.padButton(0);
      case "left": return this.keys.has("KeyA") || this.keys.has("ArrowLeft") || this.padButton(14);
      case "right": return this.keys.has("KeyD") || this.keys.has("ArrowRight") || this.padButton(15);
      case "up": return this.keys.has("KeyW") || this.keys.has("ArrowUp") || this.padButton(12);
      case "down": return this.keys.has("KeyS") || this.keys.has("ArrowDown") || this.padButton(13);
      default: return false;
    }
  }

  anyPressed() {
    return this.anyKeyFlag || this.pressed.size > 0;
  }
}
