import { Howl, Howler } from 'howler';

const BASE = import.meta.env.BASE_URL;
const asset = (path) => `${BASE}assets/${path}`;

const VOICE_RATES = {
  akari_01: 1,
  akari_02: 1,
  akari_03: 1,
  akari_04: 1,
  akari_05: 1,
  rei_01: 1,
  rei_02: 1,
  rei_03: 1,
  inaba_01: 0.92,
  katsuya_01: 0.94,
};

export class AudioEngine {
  constructor(settings) {
    this.settings = settings;
    this.volumes = {
      bgm: settings.bgm,
      se: settings.se,
      voice: settings.voice,
      ambient: settings.ambient ?? 0.4,
    };
    this.currentBgm = null;
    this.currentBgmName = null;
    this.currentVoice = null;
    this.ambientNodes = null;
    this.ambientType = null;
    this.musicFadeToken = 0;
    this.onMusicPlay = null;
    this.onVoiceStart = null;
    this.onVoiceEnd = null;

    Howler.autoUnlock = true;
    Howler.volume(1);
  }

  unlock() {
    const ctx = Howler.ctx;
    if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
    if (ctx && this.ambientType && !this.ambientNodes) this.setAmbient(this.ambientType);
  }

  setVolume(kind, value) {
    this.volumes[kind] = value;
    if (this.settings) this.settings[kind] = value;
    if (kind === 'bgm' && this.currentBgm && this.currentBgm.playing()) {
      this.currentBgm.volume(value);
    }
    if (kind === 'voice' && this.currentVoice && this.currentVoice.playing()) {
      this.currentVoice.volume(value);
    }
    if (kind === 'ambient' && this.ambientNodes?.gain) {
      this.ambientNodes.gain.gain.setTargetAtTime(this.ambientBaseGain() * value, Howler.ctx.currentTime, 0.08);
    }
  }

  playBgm(name, fade = 1400) {
    if (!name || name === 'none') {
      this.stopBgm(fade);
      return;
    }
    if (this.currentBgmName === name && this.currentBgm?.playing()) return;

    const token = ++this.musicFadeToken;
    const old = this.currentBgm;
    if (old) {
      old.fade(old.volume(), 0, fade);
      window.setTimeout(() => {
        if (token === this.musicFadeToken) old.stop();
      }, fade + 40);
    }

    const howl = new Howl({
      src: [asset(`bgm/${name}.mp3`)],
      loop: true,
      volume: 0,
      preload: true,
      html5: false,
      onload: () => {
        if (token !== this.musicFadeToken) return;
        howl.play();
        howl.fade(0, this.volumes.bgm, fade);
      },
      onloaderror: () => console.warn('[audio] BGM failed', name),
    });
    this.currentBgm = howl;
    this.currentBgmName = name;
    this.onMusicPlay?.(name);
  }

  stopBgm(fade = 900) {
    ++this.musicFadeToken;
    const old = this.currentBgm;
    this.currentBgm = null;
    this.currentBgmName = null;
    if (!old) return;
    old.fade(old.volume(), 0, fade);
    window.setTimeout(() => old.stop(), fade + 40);
  }

  playSe(name) {
    if (!name) return;
    const names = Array.isArray(name) ? name : [name];
    for (const se of names) {
      const howl = new Howl({
        src: [asset(`se/${se}.wav`)],
        volume: this.volumes.se,
        preload: true,
      });
      howl.once('end', () => howl.unload());
      howl.once('loaderror', () => console.warn('[audio] SE failed', se));
      howl.play();
    }
  }

  playVoice(name) {
    if (!name || !this.settings.voiceEnabled) return;
    this.stopVoice();
    const howl = new Howl({
      src: [asset(`voice/${name}.mp3`)],
      volume: this.volumes.voice,
      rate: VOICE_RATES[name] || 1,
      preload: true,
    });
    howl.once('end', () => {
      if (this.currentVoice === howl) {
        this.currentVoice = null;
        this.unduck();
        this.onVoiceEnd?.();
      }
      howl.unload();
    });
    howl.once('loaderror', () => console.warn('[audio] voice failed', name));
    howl.play();
    this.currentVoice = howl;
    this.onVoiceStart?.();
    this.duck();
  }

  stopVoice() {
    if (!this.currentVoice) return;
    const voice = this.currentVoice;
    this.currentVoice = null;
    voice.stop();
    voice.unload();
    this.unduck();
    this.onVoiceEnd?.();
  }

  duck() {
    if (!this.currentBgm || !this.currentBgm.playing()) return;
    this.currentBgm.fade(this.currentBgm.volume(), this.volumes.bgm * 0.55, 260);
  }

  unduck() {
    if (!this.currentBgm || !this.currentBgm.playing()) return;
    this.currentBgm.fade(this.currentBgm.volume(), this.volumes.bgm, 420);
  }

  ambientBaseGain() {
    switch (this.ambientType) {
      case 'rain': return 0.075;
      case 'stars': return 0.018;
      case 'library': return 0.022;
      case 'dust': return 0.014;
      case 'petals': return 0.012;
      case 'starlight': return 0.02;
      case 'dusk': return 0.012;
      default: return 0;
    }
  }

  setAmbient(type) {
    this.ambientType = type || null;
    if (this.ambientNodes) {
      const { source, gain } = this.ambientNodes;
      try { source.stop(); } catch { /* already stopped */ }
      source.disconnect();
      gain.disconnect();
      this.ambientNodes = null;
    }
    if (!type || !Howler.ctx || Howler.ctx.state !== 'running') return;

    const ctx = Howler.ctx;
    const duration = 2.5;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type === 'rain' ? 'lowpass' : type === 'stars' ? 'highpass' : 'bandpass';
    filter.frequency.value = type === 'rain' ? 2100 : type === 'stars' ? 3600 : 900;
    filter.Q.value = 0.55;
    const gain = ctx.createGain();
    gain.gain.value = this.ambientBaseGain() * this.volumes.ambient;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start();
    this.ambientNodes = { source, filter, gain };
  }
}
