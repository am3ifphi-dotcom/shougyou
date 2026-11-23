// ---------------------------------------------------------------------------
//  audio.js — Howler wrapper with three buses, crossfades, and SE variation.
//  All sounds are addressed by asset id; the registry knows the URL.
// ---------------------------------------------------------------------------
export class AudioSystem {
  constructor(registry) {
    this.reg = registry;
    this.unlocked = false;
    this.volumes = { bgm: 0.55, se: 0.75, voice: 0.8, master: 1 };
    this.muted = false;
    this.sfx = new Map();     // id -> Howl
    this.music = new Map();   // id -> Howl
    this.current = null;      // { id, howl, id_playing }
    this.ambient = null;
    this.recent = [];         // last SE ids, to avoid the same sound twice
    this.lastPlay = new Map();
    this.failed = new Set();
  }

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    if (window.Howler) {
      Howler.volume(this.volumes.master);
      if (Howler.ctx && Howler.ctx.state === 'suspended') Howler.ctx.resume();
    }
  }

  async preload(ids) {
    await Promise.all(ids.map(async (id) => {
      const buf = await this.reg.loadAudio(id);
      if (!buf) { this.failed.add(id); return; }
      const e = this.reg.info(id);
      const url = this.reg.resolve(id).path;
      const isMusic = id.startsWith('bgm') || id.startsWith('amb');
      if (isMusic) {
        if (this.music.has(id)) return;
        this.music.set(id, new Howl({
          src: [url], loop: !!e?.loop, volume: 0, preload: true, format: [guessFormat(url)],
          html5: false,
        }));
      } else {
        if (this.sfx.has(id)) return;
        this.sfx.set(id, new Howl({ src: [url], volume: 1, preload: true, format: [guessFormat(url)] }));
      }
    }));
  }

  setVolume(bus, v) {
    this.volumes[bus] = Math.max(0, Math.min(1, v));
    if (bus === 'master' && window.Howler) Howler.volume(this.muted ? 0 : v);
    if (this.current?.howl) {
      const target = this.musicVolume() * (this.current.howl._baseGain ?? 1);
      this.current.howl.volume(target);
    }
  }
  toggleMute() {
    this.muted = !this.muted;
    if (window.Howler) Howler.volume(this.muted ? 0 : this.volumes.master);
    return this.muted;
  }

  musicVolume() { return this.volumes.bgm; }

  // ---------------------------------------------------------------- music
  playMusic(id, { fade = 1400, gain = null } = {}) {
    if (!this.unlocked) return;
    if (this.current?.id === id && this.current.howl?.playing()) return;
    const howl = this.music.get(id);
    if (!howl) { this.failed.add(id); return; }
    const e = this.reg.info(id);
    const base = gain ?? e?.gain ?? 1;
    howl._baseGain = base;
    const target = this.musicVolume() * base;
    const prev = this.current;
    howl.volume(0);
    if (!howl.playing()) howl.play();
    howl.loop(!!e?.loop);
    // crossfade out the old track
    if (prev?.howl && prev.howl !== howl) {
      const old = prev.howl;
      const oldVol = old.volume();
      old.fade(oldVol, 0, fade);
      setTimeout(() => { try { old.stop(); } catch { /* noop */ } }, fade + 60);
    }
    howl.fade(howl.volume(), target, fade);
    this.current = { id, howl };
  }

  stopMusic(fade = 900) {
    const cur = this.current;
    if (!cur) return;
    cur.howl.fade(cur.howl.volume(), 0, fade);
    setTimeout(() => { try { cur.howl.stop(); } catch { /* noop */ } }, fade + 60);
    this.current = null;
  }

  duckMusic(amount = 0.35, ms = 700) {
    const cur = this.current;
    if (!cur) return;
    const base = this.musicVolume() * (cur.howl._baseGain ?? 1);
    cur.howl.fade(cur.howl.volume(), base * amount, ms);
    setTimeout(() => { if (this.current?.howl === cur.howl) cur.howl.fade(cur.howl.volume(), base, ms * 1.6); }, ms + 400);
  }

  playAmbient(id, gain = 0.2) {
    if (!this.unlocked) return;
    if (this.ambient?.id === id) return;
    this.stopAmbient();
    const howl = this.music.get(id);
    if (!howl) return;
    howl._baseGain = gain;
    howl.volume(0);
    howl.play();
    howl.fade(0, gain * this.musicVolume(), 2000);
    this.ambient = { id, howl };
  }
  stopAmbient(fade = 1200) {
    if (!this.ambient) return;
    const a = this.ambient;
    a.howl.fade(a.howl.volume(), 0, fade);
    setTimeout(() => { try { a.howl.stop(); } catch { /* noop */ } }, fade + 60);
    this.ambient = null;
  }

  // ---------------------------------------------------------------- SE
  /**
   * Play a one-shot. `variation` jitters pitch+gain so repeats never sound
   * stamped from the same mold (and stops fatigue on machine-gun hits).
   */
  play(id, { volume = 1, rate = null, variation = 0.07, pan = 0 } = {}) {
    if (!this.unlocked || this.muted) return;
    const howl = this.sfx.get(id);
    if (!howl) { this.failed.add(id); return; }
    // rate-limit identical cues to 35 ms apart (prevents phase-stacking)
    const now = performance.now();
    if (this.lastPlay.get(id) && now - this.lastPlay.get(id) < 35) return;
    this.lastPlay.set(id, now);

    const jitter = rate ?? 1 + (Math.random() * 2 - 1) * variation;
    const vol = Math.min(1, volume * this.volumes.se * (1 + (Math.random() * 2 - 1) * variation * 0.6));
    const sid = howl.play();
    if (sid == null) return;
    howl.rate(Math.max(0.5, Math.min(2, jitter)), sid);
    howl.volume(vol, sid);
    try { howl.stereo(pan, sid); } catch { /* stereo optional */ }
    return sid;
  }

  /** Convenience map so gameplay code reads like a script, not a mixer. */
  static CUES = {
    move: 'se_move', moveB: 'se_move_b', ok: 'se_ok', back: 'se_back',
    hit: 'se_hit', hitHeavy: 'se_hit_heavy', hurt: 'se_hurt', shot: 'se_shot',
    slash: 'se_slash', explode: 'se_explode', explodeBig: 'se_explode_big',
    coin: 'se_coin', coinDouble: 'se_coin_double', heal: 'se_heal', power: 'se_power',
    levelup: 'se_levelup', win: 'se_win', death: 'se_death', lowhp: 'se_lowhp',
    pauseIn: 'se_pause_in', pauseOut: 'se_pause_out', blip: 'se_blip', blipB: 'se_blip_b',
    error: 'se_error', charge: 'se_charge', dash: 'se_dash', monster: 'se_monster',
    victory: 'se_victory_1', whoosh: 'se_whoosh_1',
  };

  cue(name, opts) {
    const id = AudioSystem.CUES[name] || name;
    return this.play(id, opts);
  }
}

function guessFormat(url) {
  const m = /\.([a-z0-9]+)(?:\?|$)/i.exec(url || '');
  const ext = (m?.[1] || 'ogg').toLowerCase();
  return ext === 'mp3' ? 'mp3' : ext === 'wav' ? 'wav' : ext === 'm4a' ? 'm4a' : 'ogg';
}
