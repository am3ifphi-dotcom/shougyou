/**
 * Audio.
 *
 * Three independent buses (music / sfx / voice) behind Howler.js, with
 * per-bus volume, crossfading music, and a WebAudio synthesiser that takes
 * over whenever an .ogg could not be downloaded.  Nothing here ever throws on
 * a missing file - the game keeps its soundscape either way.
 */
import { Howl, Howler } from 'howler';
import { entry, markStatus, State, bootLog, userOverrides } from './assets.js';

const REGISTRY = new Map(); // id -> { howl, status }
let ctx = null;
let synthAvailable = false;

export const settings = {
  music: 0.62,
  sfx: 0.8,
  voice: 0.7,
  muted: false,
};

export const buses = {
  music: [],
  sfx: [],
  voice: [],
};

let current = null; // { id, howl, gainFadeId }

/* ------------------------------------------------------------------ *
 * boot
 * ------------------------------------------------------------------ */
export function initAudio() {
  ctx = Howler.ctx || new (window.AudioContext || window.webkitAudioContext)();
  synthAvailable = !!ctx;
  applyVolumes();
}

export function unlockAudio() {
  if (!ctx) initAudio();
  if (ctx && ctx.state === 'suspended') ctx.resume();
  if (Howler.ctx && Howler.ctx.state === 'suspended') Howler.ctx.resume();
}

function applyVolumes() {
  Howler.volume(settings.muted ? 0 : 1);
  for (const [bus, vol] of [
    ['music', settings.music],
    ['sfx', settings.sfx],
    ['voice', settings.voice],
  ]) {
    for (const howl of buses[bus]) howl.volume(settings.muted ? 0 : vol);
  }
  if (current?.howl) current.howl.volume(settings.muted ? 0 : settings.music * current.howl.__baseVolume);
}

export function setBusVolume(bus, value) {
  settings[bus] = Math.max(0, Math.min(1, value));
  applyVolumes();
}

export function setMuted(m) {
  settings.muted = m;
  applyVolumes();
}

/* ------------------------------------------------------------------ *
 * sound effects
 * ------------------------------------------------------------------ */
const lastPlayed = new Map();

/**
 * Play a one-shot. Pitch/volume are jittered so repeated swings never sound
 * identical, which is the main thing that makes raw SFX feel cheap.
 */
export function playSfx(id, { rate = 1, pitchJitter = 0.07, gainJitter = 0.12, volume = 1 } = {}) {
  const rec = REGISTRY.get(id);
  const now = performance.now();
  const last = lastPlayed.get(id) || 0;
  if (now - last < 28) return; // de-dupe frame-identical triggers
  lastPlayed.set(id, now);

  if (!rec || !rec.howl || rec.status === State.FALLBACK) {
    synthSfx(id);
    return;
  }
  const howl = rec.howl;
  const jitter = 1 + (Math.random() * 2 - 1) * pitchJitter;
  const vol = Math.max(0.02, Math.min(1, volume * (1 + (Math.random() * 2 - 1) * gainJitter))) * settings.sfx;
  try {
    const h = howl.play();
    howl.rate(rate * jitter, h);
    howl.volume(settings.muted ? 0 : vol, h);
  } catch {
    synthSfx(id);
  }
}

async function loadHowl(url, opts = {}, timeout = 12000) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    try {
      const h = new Howl({
        src: [url],
        preload: true,
        ...opts,
        onload: () => done(h),
        onloaderror: () => done(null),
      });
      setTimeout(() => done(h.state() === 'loaded' ? h : null), timeout);
    } catch {
      done(null);
    }
  });
}

export async function preloadSfx(ids, onProgress) {
  let done = 0;
  await Promise.all(
    ids.map(async (id) => {
      const rec = entry(id);
      if (!rec || rec.status === State.FALLBACK || rec.status === State.MISSING) {
        markStatus(id, State.FALLBACK, { reason: 'no audio file' });
        bootLog.push(`[audio] ${id} -> synth fallback`);
        done++;
        onProgress?.(done, ids.length);
        return;
      }
      const base = rec.local_path.split('/').pop();
      const urls = [...(userOverrides(base) ? [`./assets/user/${base}`] : []), `./${rec.local_path}`];
      for (const url of urls) {
        const howl = await loadHowl(url, { volume: settings.sfx });
        if (howl) {
          howl.__baseVolume = 1;
          REGISTRY.set(id, { howl, status: State.CACHED });
          buses.sfx.push(howl);
          done++;
          onProgress?.(done, ids.length);
          return;
        }
      }
      markStatus(id, State.FALLBACK, { reason: 'sound failed to decode' });
      bootLog.push(`[audio] ${id} -> synth fallback`);
      done++;
      onProgress?.(done, ids.length);
    })
  );
}

/* ------------------------------------------------------------------ *
 * music with crossfade
 * ------------------------------------------------------------------ */
export function playMusic(id, { fade = 1400, baseVolume = 1 } = {}) {
  const rec = REGISTRY.get(`music:${id}`);
  const howl = rec?.howl;
  if (!howl) {
    if (current?.id !== id) {
      stopMusic(600);
      synthMusic(id);
      current = { id, synth: true };
    }
    return;
  }
  if (current?.synth) stopSynthMusic();
  if (current && current.id === id && !current.synth) return;

  const prev = current?.howl;
  current = { id, howl };
  howl.__baseVolume = baseVolume;
  howl.volume(0);
  if (!howl.playing()) howl.play();
  howl.fade(0, settings.muted ? 0 : settings.music * baseVolume, fade);

  if (prev && prev !== howl) {
    prev.fade(prev.volume(), 0, fade);
    setTimeout(() => {
      if (current?.howl !== prev) prev.stop();
    }, fade + 120);
  }
}

export function stopMusic(fade = 900) {
  if (current?.synth) stopSynthMusic();
  if (current?.howl) {
    const h = current.howl;
    h.fade(h.volume(), 0, fade);
    setTimeout(() => h.stop(), fade + 100);
  }
  current = null;
}

export async function preloadMusic(ids, onProgress) {
  let done = 0;
  await Promise.all(
    ids.map(async (id) => {
      const rec = entry(id);
      if (!rec || rec.status === State.FALLBACK || rec.status === State.MISSING) {
        markStatus(id, State.FALLBACK, { reason: 'no music file' });
        bootLog.push(`[audio] ${id} -> synth music`);
        done++;
        onProgress?.(done, ids.length);
        return;
      }
      const base = rec.local_path.split('/').pop();
      const urls = [...(userOverrides(base) ? [`./assets/user/${base}`] : []), `./${rec.local_path}`];
      for (const url of urls) {
        const howl = await loadHowl(url, { loop: true, volume: settings.music }, 25000);
        if (howl) {
          howl.__baseVolume = 1;
          REGISTRY.set(`music:${id}`, { howl, status: State.CACHED });
          buses.music.push(howl);
          done++;
          onProgress?.(done, ids.length);
          return;
        }
      }
      markStatus(id, State.FALLBACK, { reason: 'track failed to decode' });
      bootLog.push(`[audio] ${id} -> synth music`);
      done++;
      onProgress?.(done, ids.length);
    })
  );
}

/* ------------------------------------------------------------------ *
 * WebAudio synthesiser fallbacks
 * ------------------------------------------------------------------ */
const SYNTH_SFX = {
  se_ui_move: { type: 'square', f: 880, f2: 1180, d: 0.06, g: 0.05 },
  se_ui_confirm: { type: 'square', f: 520, f2: 1040, d: 0.12, g: 0.08 },
  se_ui_cancel: { type: 'square', f: 420, f2: 180, d: 0.12, g: 0.07 },
  se_ui_denied: { type: 'sawtooth', f: 180, f2: 120, d: 0.18, g: 0.06 },
  se_slash: { type: 'triangle', f: 1600, f2: 300, d: 0.16, g: 0.07, noise: true },
  se_slash2: { type: 'triangle', f: 1300, f2: 260, d: 0.14, g: 0.06, noise: true },
  se_hit: { type: 'square', f: 240, f2: 90, d: 0.14, g: 0.1 },
  se_hurt: { type: 'sawtooth', f: 320, f2: 100, d: 0.24, g: 0.09 },
  se_enemy_die: { type: 'triangle', f: 200, f2: 60, d: 0.4, g: 0.08, noise: true },
  se_pickup: { type: 'square', f: 900, f2: 1600, d: 0.1, g: 0.05 },
  se_heal: { type: 'sine', f: 660, f2: 1320, d: 0.3, g: 0.06 },
  se_levelup: { type: 'square', f: 520, f2: 1560, d: 0.5, g: 0.07 },
  se_gameover: { type: 'sine', f: 220, f2: 60, d: 0.9, g: 0.08 },
  se_step: { type: 'triangle', f: 120, f2: 80, d: 0.05, g: 0.04, noise: true },
  se_dash: { type: 'triangle', f: 600, f2: 200, d: 0.18, g: 0.05, noise: true },
  se_fireball: { type: 'sawtooth', f: 900, f2: 300, d: 0.25, g: 0.06 },
  se_explode: { type: 'sawtooth', f: 260, f2: 40, d: 0.45, g: 0.11, noise: true },
  se_boss_roar: { type: 'sawtooth', f: 90, f2: 45, d: 0.8, g: 0.12 },
  se_door: { type: 'triangle', f: 180, f2: 90, d: 0.5, g: 0.07, noise: true },
};

let noiseBuffer = null;
function getNoise() {
  if (!ctx) return null;
  if (noiseBuffer) return noiseBuffer;
  const len = ctx.sampleRate * 1.2;
  noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

export function synthSfx(id) {
  if (!ctx || settings.muted) return;
  const spec = SYNTH_SFX[id];
  if (!spec) return;
  const t = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(spec.g * settings.sfx, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + spec.d);

  if (spec.noise) {
    const src = ctx.createBufferSource();
    src.buffer = getNoise();
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(spec.f, t);
    bp.frequency.exponentialRampToValueAtTime(Math.max(40, spec.f2), t + spec.d);
    bp.Q.value = 1.2;
    src.connect(bp).connect(gain);
    src.start(t);
    src.stop(t + spec.d + 0.02);
  }
  const osc = ctx.createOscillator();
  osc.type = spec.type;
  osc.frequency.setValueAtTime(spec.f, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(30, spec.f2), t + spec.d);
  osc.connect(gain);
  osc.start(t);
  osc.stop(t + spec.d + 0.02);
}

/** Long-form generated score: a slow minor progression on a soft pad+bell. */
let musicNodes = null;
const MUSIC_SCALE = { dungeon: [220, 261.6, 293.7, 329.6, 392], boss: [146.8, 174.6, 196, 220, 233], title: [164.8, 196, 220, 246.9, 293.7], gameover: [110, 130.8, 146.8, 164.8] };

export function synthMusic(id) {
  if (!ctx || settings.muted) return;
  const key = id.replace('bgm_', '');
  const notes = MUSIC_SCALE[key] || MUSIC_SCALE.dungeon;
  stopSynthMusic();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  master.gain.linearRampToValueAtTime(settings.music * 0.18, ctx.currentTime + 2.5);

  const pad = ctx.createOscillator();
  pad.type = 'sine';
  pad.frequency.value = notes[0] / 2;
  const padGain = ctx.createGain();
  padGain.gain.value = 0.5;
  pad.connect(padGain).connect(master);
  pad.start();

  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.08;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 6;
  lfo.connect(lfoGain).connect(pad.frequency);
  lfo.start();

  let step = 0;
  const timer = setInterval(() => {
    if (!ctx) return;
    const t = ctx.currentTime;
    const f = notes[step % notes.length] * (step % 8 < 4 ? 1 : 1.5);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.22, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + 2.2);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 2.3);
    step++;
  }, 1600);

  musicNodes = { master, pad, lfo, timer };
}

export function stopSynthMusic() {
  if (!musicNodes) return;
  clearInterval(musicNodes.timer);
  try {
    musicNodes.master.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
    setTimeout(() => {
      try {
        musicNodes?.pad.stop();
        musicNodes?.lfo.stop();
      } catch {
        /* already stopped */
      }
      musicNodes = null;
    }, 1400);
  } catch {
    musicNodes = null;
  }
}

export function isSynthActive() {
  return !!musicNodes;
}

export function audioDiagnostics() {
  const out = { bus: [], synth: synthAvailable };
  for (const [id, r] of REGISTRY) out.bus.push({ id, status: r.status });
  return out;
}
