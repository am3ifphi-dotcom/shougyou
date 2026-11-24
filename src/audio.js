// Three-bus Web Audio engine with OGG buffers, synth fallbacks, crossfades,
// boss layers, SE micro-variation and an approximate -14 LUFS auto-trim.

const BASE_GAIN = { bgm: 0.44, se: 0.58, voice: 0.50 };
const TARGET_RMS = Math.pow(10, -14 / 20); // -14 dBFS, K-weighted approximation

const SYNTH_KIND = {
  bgm_title: 'drone', bgm_game: 'drone', bgm_boss: 'drone', bgm_result: 'drone',
  amb_creepy: 'damage', se_cursor: 'cursor', se_confirm: 'confirm', se_cancel: 'cancel',
  se_error: 'error', se_hit: 'hit', se_damage: 'damage', se_heal: 'heal',
  se_levelup: 'levelup', se_notify: 'notify', se_coin: 'coin', se_whoosh: 'whoosh',
  se_magic: 'magic', se_bell: 'bell', se_gameover: 'gameover', se_victory: 'victory',
};

export class AudioEngine {
  constructor({ onLog = null } = {}) {
    this.onLog = onLog;
    this.ctx = null;
    this.master = null;
    this.buses = {};
    this.buffers = new Map();
    this.userVolume = { bgm: 0.8, se: 0.85, voice: 0.7 };
    this.bgmVoices = [];
    this.layers = new Map();
    this.drone = null;
    this.pendingBGM = null;
    this.unlocked = false;
    this.ducked = false;
    this.disabled = false;
    this.fallbacks = new Set();
    this.decodeFailed = new Set();
    this.meterData = null;
    this.meterDb = -60;
    this.trimValue = 1;
    this.noise = null;
  }

  log(id, status, detail = '') {
    this.onLog?.(id, status, detail);
    if (status === 'fallback') this.fallbacks.add(id);
  }

  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (window.Howler && window.Howler.ctx) {
        this.ctx = window.Howler.ctx;
        this.master = window.Howler.masterGain || this.ctx.createGain();
      } else {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
      }
      this.master.gain.value = 1;
      try { this.master.disconnect(); } catch { /* not connected yet */ }
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 4;
      comp.attack.value = 0.004; comp.release.value = 0.18;
      const shelf = this.ctx.createBiquadFilter();
      shelf.type = 'highshelf'; shelf.frequency.value = 1681; shelf.gain.value = 4;
      const hp = this.ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 38; hp.Q.value = 0.5;
      this.trim = this.ctx.createGain(); this.trim.gain.value = 1;
      this.analyser = this.ctx.createAnalyser(); this.analyser.fftSize = 2048; this.analyser.smoothingTimeConstant = 0.75;
      this.master.connect(comp); comp.connect(shelf); shelf.connect(hp); hp.connect(this.trim); this.trim.connect(this.analyser); this.analyser.connect(this.ctx.destination);
      for (const name of Object.keys(BASE_GAIN)) {
        const g = this.ctx.createGain();
        g.gain.value = BASE_GAIN[name] * this.userVolume[name];
        g.connect(this.master);
        this.buses[name] = g;
      }
      this.meterData = new Float32Array(this.analyser.fftSize);
      this.makeNoise();
      this.meterTimer = setInterval(() => this.meter(), 100);
    } catch (e) {
      this.disabled = true;
      console.warn('[audio] disabled:', e);
    }
  }

  makeNoise() {
    const len = this.ctx.sampleRate * 0.5;
    const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = b;
  }

  async decode(e, arrayBuffer) {
    if (!this.ctx || this.disabled) { this.init(); if (!this.ctx || this.disabled) return; }
    try {
      const buf = await this.ctx.decodeAudioData(arrayBuffer.slice(0));
      this.buffers.set(e.id, buf);
      this.log(e.id, 'decoded', `${buf.duration.toFixed(1)}s`);
      if (this.pendingBGM && this.pendingBGM.id === e.id && this.unlocked) {
        const p = this.pendingBGM; this.pendingBGM = null; this.playBGM(p.id, p.fade);
      }
    } catch (err) {
      this.decodeFailed.add(e.id);
      this.log(e.id, 'fallback', `decode failed: ${err.message || err}`);
    }
  }

  async unlock() {
    if (this.disabled) return;
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    try {
      await this.ctx.resume();
      if (window.Howler && window.Howler.ctx && window.Howler.ctx !== this.ctx) await window.Howler.ctx.resume();
      this.unlocked = true;
      if (this.pendingBGM) { const p = this.pendingBGM; this.pendingBGM = null; this.playBGM(p.id, p.fade); }
    } catch (e) { console.warn('[audio] unlock failed', e); }
  }

  setVolume(bus, v) {
    this.userVolume[bus] = Math.max(0, Math.min(1, v));
    if (!this.ctx || !this.buses[bus]) return;
    const duck = this.ducked && bus === 'bgm' ? 0.55 : 1;
    this.buses[bus].gain.setTargetAtTime(BASE_GAIN[bus] * this.userVolume[bus] * duck, this.ctx.currentTime, 0.05);
  }
  duck(on) {
    this.ducked = on;
    this.setVolume('bgm', this.userVolume.bgm);
  }

  meter() {
    if (!this.analyser || this.ctx.state !== 'running') return;
    this.analyser.getFloatTimeDomainData(this.meterData);
    let sum = 0;
    for (let i = 0; i < this.meterData.length; i++) sum += this.meterData[i] * this.meterData[i];
    const rms = Math.sqrt(sum / this.meterData.length);
    this.meterDb = 20 * Math.log10(rms + 1e-6);
    if (rms < 0.0015) return; // silence: do not pump noise
    const wanted = Math.max(0.55, Math.min(1.55, TARGET_RMS / Math.max(0.0001, rms)));
    this.trimValue += (wanted - this.trimValue) * 0.08;
    this.trim.gain.setTargetAtTime(this.trimValue, this.ctx.currentTime, 0.25);
  }

  makeVoice(buffer, { bus = 'se', volume = 1, rate = 1, loop = false, fade = 0 } = {}) {
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer; src.loop = loop; src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(loop ? 0 : volume, now);
    src.connect(g); g.connect(this.buses[bus] || this.buses.se);
    src.start(now);
    if (loop && fade > 0) g.gain.linearRampToValueAtTime(volume, now + fade);
    return { source: src, gain: g, bus };
  }

  stopVoice(v, fade = 0.6) {
    if (!v || !this.ctx) return;
    const now = this.ctx.currentTime;
    try {
      v.gain.gain.cancelScheduledValues(now);
      v.gain.gain.setValueAtTime(v.gain.gain.value, now);
      v.gain.gain.linearRampToValueAtTime(0, now + fade);
      v.source.stop(now + fade + 0.05);
    } catch { /* already stopped */ }
  }

  playBGM(id, fade = 1.1) {
    if (this.disabled) return;
    if (!this.ctx) this.init();
    if (!this.ctx) return;
    if (!this.unlocked) { this.pendingBGM = { id, fade }; return; }
    const buf = this.buffers.get(id);
    if (!buf) {
      if (!this.decodeFailed.has(id)) this.pendingBGM = { id, fade };
      this.startDrone();
      return;
    }
    this.pendingBGM = null;
    this.stopDrone(fade);
    const now = this.ctx.currentTime;
    const old = this.bgmVoices.slice();
    const v = this.makeVoice(buf, { bus: 'bgm', volume: 0.9, loop: true, fade });
    for (const o of old) this.stopVoice(o, fade);
    this.bgmVoices = [v];
  }

  playLayer(id, volume = 0.25, fade = 1.4) {
    if (!this.ctx || !this.unlocked) return;
    if (this.layers.has(id)) return;
    const buf = this.buffers.get(id);
    if (!buf) { this.log(id, 'fallback', 'boss layer synth'); return; }
    const v = this.makeVoice(buf, { bus: 'bgm', volume, loop: true, fade });
    this.layers.set(id, v);
  }
  stopLayer(id, fade = 1.0) {
    const v = this.layers.get(id);
    if (v) { this.stopVoice(v, fade); this.layers.delete(id); }
  }
  stopAllBGM(fade = 0.8) {
    this.pendingBGM = null;
    for (const v of this.bgmVoices) this.stopVoice(v, fade);
    this.bgmVoices = [];
    for (const [id, v] of this.layers) { this.stopVoice(v, fade); this.layers.delete(id); }
    this.stopDrone(fade);
  }

  startDrone(fade = 0.8) {
    if (this.drone || !this.ctx || !this.unlocked) return;
    const now = this.ctx.currentTime;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0, now); g.connect(this.buses.bgm);
    const filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 420; filter.Q.value = 0.7; filter.connect(g);
    const o1 = this.ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 55; o1.detune.value = -8;
    const o2 = this.ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = 82.41; o2.detune.value = 6;
    const o1g = this.ctx.createGain(); o1g.gain.value = 0.055; o1.connect(o1g); o1g.connect(filter);
    const o2g = this.ctx.createGain(); o2g.gain.value = 0.04; o2.connect(o2g); o2g.connect(filter);
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.08;
    const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 90; lfo.connect(lfoGain); lfoGain.connect(filter.frequency);
    o1.start(now); o2.start(now); lfo.start(now);
    g.gain.linearRampToValueAtTime(0.7, now + fade);
    this.drone = { gain: g, nodes: [o1, o2, lfo] };
  }
  stopDrone(fade = 0.6) {
    if (!this.drone || !this.ctx) return;
    const now = this.ctx.currentTime;
    const d = this.drone; this.drone = null;
    try {
      d.gain.gain.cancelScheduledValues(now);
      d.gain.gain.setValueAtTime(d.gain.gain.value, now);
      d.gain.gain.linearRampToValueAtTime(0, now + fade);
      for (const n of d.nodes) n.stop(now + fade + 0.05);
    } catch { /* noop */ }
  }

  se(id, o = {}) {
    if (this.disabled || !this.ctx || !this.unlocked) return;
    const { bus = 'se', volume = 1, rate = 1 } = o;
    const jitter = 0.97 + Math.random() * 0.06;
    const vol = volume * (0.9 + Math.random() * 0.2);
    const buf = this.buffers.get(id);
    if (buf) {
      const v = this.makeVoice(buf, { bus, volume: vol, rate: rate * jitter });
      v.source.onended = () => { try { v.source.disconnect(); v.gain.disconnect(); } catch {} };
    } else {
      this.synth(SYNTH_KIND[id] || 'cursor', this.buses[bus] || this.buses.se, { volume: vol, rate: rate * jitter });
      this.log(id, 'fallback', 'synth SE');
    }
  }

  voiceBlip() {
    if (!this.ctx || !this.unlocked) return;
    this.synth('voice', this.buses.voice, { volume: 0.35 + Math.random() * 0.15, rate: 0.95 + Math.random() * 0.12 });
  }

  synth(kind, bus, { volume = 1, rate = 1 } = {}) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const out = this.ctx.createGain();
    out.gain.setValueAtTime(0.0001, now);
    out.connect(bus || this.buses.se);
    const stopAt = (t) => { try { out.disconnect(); } catch {} };
    const tone = (freq, type, start, dur, amp) => {
      const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, now + start);
      const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, now + start);
      g.gain.linearRampToValueAtTime(amp, now + start + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      o.connect(g); g.connect(out); o.start(now + start); o.stop(now + start + dur + 0.02);
    };
    const noise = (start, dur, amp, filterFreq = 1200) => {
      const s = this.ctx.createBufferSource(); s.buffer = this.noise;
      const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = filterFreq; f.Q.value = 0.8;
      const g = this.ctx.createGain(); g.gain.setValueAtTime(amp, now + start); g.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      s.connect(f); f.connect(g); g.connect(out); s.start(now + start); s.stop(now + start + dur + 0.02);
    };
    let dur = 0.22;
    switch (kind) {
      case 'cursor': out.gain.linearRampToValueAtTime(0.28 * volume, now + 0.006); tone(660 * rate, 'square', 0, 0.055, 0.22); dur = 0.08; break;
      case 'confirm': out.gain.linearRampToValueAtTime(0.5 * volume, now + 0.008); tone(520 * rate, 'triangle', 0, 0.08, 0.35); tone(880 * rate, 'triangle', 0.055, 0.13, 0.32); dur = 0.2; break;
      case 'cancel': out.gain.linearRampToValueAtTime(0.42 * volume, now + 0.008); tone(420 * rate, 'triangle', 0, 0.08, 0.3); tone(260 * rate, 'triangle', 0.055, 0.14, 0.28); dur = 0.2; break;
      case 'error': out.gain.linearRampToValueAtTime(0.5 * volume, now + 0.005); tone(150 * rate, 'square', 0, 0.19, 0.3); noise(0, 0.1, 0.12, 500); dur = 0.22; break;
      case 'hit': out.gain.linearRampToValueAtTime(0.55 * volume, now + 0.004); tone(180 * rate, 'triangle', 0, 0.12, 0.4); noise(0, 0.09, 0.32, 2400); dur = 0.16; break;
      case 'damage': out.gain.linearRampToValueAtTime(0.55 * volume, now + 0.004); tone(90 * rate, 'sawtooth', 0, 0.24, 0.38); noise(0, 0.22, 0.28, 700); dur = 0.27; break;
      case 'heal': out.gain.linearRampToValueAtTime(0.42 * volume, now + 0.01); tone(523 * rate, 'sine', 0, 0.13, 0.22); tone(659 * rate, 'sine', 0.07, 0.14, 0.22); tone(784 * rate, 'sine', 0.14, 0.18, 0.22); dur = 0.34; break;
      case 'levelup': out.gain.linearRampToValueAtTime(0.48 * volume, now + 0.01); [392, 523, 659, 880].forEach((f, i) => tone(f * rate, 'triangle', i * 0.075, 0.2, 0.22)); dur = 0.52; break;
      case 'notify': out.gain.linearRampToValueAtTime(0.32 * volume, now + 0.006); tone(1180 * rate, 'sine', 0, 0.16, 0.22); dur = 0.18; break;
      case 'coin': out.gain.linearRampToValueAtTime(0.38 * volume, now + 0.005); tone(880 * rate, 'square', 0, 0.06, 0.22); tone(1320 * rate, 'square', 0.055, 0.1, 0.2); dur = 0.16; break;
      case 'whoosh': out.gain.linearRampToValueAtTime(0.35 * volume, now + 0.02); noise(0, 0.28, 0.35, 900); dur = 0.3; break;
      case 'magic': out.gain.linearRampToValueAtTime(0.42 * volume, now + 0.01); tone(740 * rate, 'sine', 0, 0.28, 0.18); tone(1110 * rate, 'sine', 0.06, 0.28, 0.14); tone(1480 * rate, 'sine', 0.12, 0.28, 0.12); dur = 0.42; break;
      case 'bell': out.gain.linearRampToValueAtTime(0.42 * volume, now + 0.006); tone(880 * rate, 'sine', 0, 0.35, 0.24); tone(1320 * rate, 'sine', 0.01, 0.3, 0.16); dur = 0.38; break;
      case 'gameover': out.gain.linearRampToValueAtTime(0.5 * volume, now + 0.01); [330, 262, 196, 147].forEach((f, i) => tone(f * rate, 'triangle', i * 0.16, 0.22, 0.25)); dur = 0.85; break;
      case 'victory': out.gain.linearRampToValueAtTime(0.5 * volume, now + 0.01); [392, 494, 587, 784].forEach((f, i) => tone(f * rate, 'triangle', i * 0.12, 0.24, 0.25)); dur = 0.65; break;
      case 'voice': out.gain.linearRampToValueAtTime(0.3 * volume, now + 0.01); tone(240 * rate, 'sawtooth', 0, 0.07, 0.2); tone(480 * rate, 'triangle', 0.02, 0.06, 0.12); dur = 0.1; break;
      default: out.gain.linearRampToValueAtTime(0.3 * volume, now + 0.006); tone(440 * rate, 'sine', 0, 0.1, 0.2); dur = 0.12;
    }
    out.gain.setValueAtTime(out.gain.value, now + dur * 0.7);
    out.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    setTimeout(() => stopAt(), (dur + 0.1) * 1000);
  }
}
