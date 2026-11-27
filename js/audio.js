/* ============================================================
   AudioEngine ― WebAudio による生成BGM / SE / ボイス風ビープ
   外部音源ファイル不要。すべてリアルタイム合成。
   ============================================================ */
(function (global) {
  'use strict';

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // コード進行（MIDI音高の配列）とスケール
  const TRACKS = {
    title: {
      tempo: 66, chordLen: 16,
      chords: [[48,55,59,64],[45,52,55,60],[41,48,53,57],[43,50,55,59]],
      scale: [60,62,64,67,69,72,74,76], melodyProb: 0.34, bass: 36, padGain: 0.05, melGain: 0.10
    },
    calm: {
      tempo: 72, chordLen: 16,
      chords: [[48,55,59,64],[45,52,55,60],[41,48,53,57],[43,50,55,59]],
      scale: [60,62,64,67,69,72,74,76], melodyProb: 0.40, bass: 36, padGain: 0.055, melGain: 0.11
    },
    sad: {
      tempo: 62, chordLen: 16,
      chords: [[45,52,57,60],[41,48,53,57],[48,55,60,64],[43,50,55,59]],
      scale: [57,60,62,64,67,69,72], melodyProb: 0.30, bass: 33, padGain: 0.05, melGain: 0.10
    },
    tense: {
      tempo: 96, chordLen: 8,
      chords: [[45,52,57],[45,52,57],[41,48,53],[40,47,52]],
      scale: [57,60,62,64,65,67], melodyProb: 0.22, bass: 33, padGain: 0.045, melGain: 0.07
    },
    hopeful: {
      tempo: 84, chordLen: 16,
      chords: [[48,55,60,64],[43,50,55,59],[45,52,57,60],[41,48,53,57]],
      scale: [60,62,64,67,69,72,74,76,79], melodyProb: 0.46, bass: 36, padGain: 0.06, melGain: 0.12
    }
  };

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.track = null;
      this.step = 0;
      this.melIdx = 3;
      this.timer = null;
      this.nextTime = 0;
      this.rainNodes = null;
      this.windNodes = null;
      this.heartbeatTimer = null;
      this.vol = { bgm: 0.7, se: 0.8, voice: 0.6 };
    }

    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
      const AC = global.AudioContext || global.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      const c = this.ctx;
      this.master = c.createGain(); this.master.gain.value = 0.9;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -18; comp.ratio.value = 6;
      this.master.connect(comp); comp.connect(c.destination);
      this.bgmBus = c.createGain(); this.bgmBus.gain.value = this.vol.bgm; this.bgmBus.connect(this.master);
      this.seBus = c.createGain(); this.seBus.gain.value = this.vol.se; this.seBus.connect(this.master);
      this.voiceBus = c.createGain(); this.voiceBus.gain.value = this.vol.voice; this.voiceBus.connect(this.master);
      // リバーブ（生成インパルス）
      this.verb = c.createConvolver();
      this.verb.buffer = this.makeImpulse(2.8, 2.2);
      this.verbGain = c.createGain(); this.verbGain.gain.value = 0.5;
      this.verb.connect(this.verbGain); this.verbGain.connect(this.bgmBus);
      // ノイズバッファ
      const len = c.sampleRate * 2;
      this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }

    makeImpulse(dur, decay) {
      const c = this.ctx, rate = c.sampleRate, len = rate * dur;
      const buf = c.createBuffer(2, len, rate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
      return buf;
    }

    setVolumes(v) {
      this.vol = Object.assign(this.vol, v);
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.bgmBus.gain.setTargetAtTime(this.vol.bgm, t, 0.05);
      this.seBus.gain.setTargetAtTime(this.vol.se, t, 0.05);
      this.voiceBus.gain.setTargetAtTime(this.vol.voice, t, 0.05);
    }

    /* ---------------- BGM ---------------- */
    playBGM(id) {
      if (!this.ctx) return;
      if (this.track === id) return;
      this.stopBGM(true);
      if (!id || !TRACKS[id]) return;
      this.track = id;
      this.step = 0;
      this.nextTime = this.ctx.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), 90);
    }

    stopBGM(fast) {
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
      this.track = null;
    }

    schedule() {
      const c = this.ctx, tr = TRACKS[this.track];
      if (!tr) return;
      const stepDur = 60 / tr.tempo / 2; // 8分音符
      while (this.nextTime < c.currentTime + 0.35) {
        this.playStep(tr, this.step, this.nextTime, stepDur);
        this.nextTime += stepDur;
        this.step++;
      }
    }

    playStep(tr, step, t, stepDur) {
      const chordIdx = Math.floor(step / tr.chordLen) % tr.chords.length;
      const chord = tr.chords[chordIdx];
      const posInChord = step % tr.chordLen;
      // パッド
      if (posInChord === 0) {
        chord.forEach((m) => this.padNote(m, t, stepDur * tr.chordLen, tr.padGain));
        this.bassNote(tr.bass + (chord[0] - 48), t, stepDur * tr.chordLen * 0.9);
      }
      // メロディ（ランダムウォーク）
      if (Math.random() < tr.melodyProb) {
        const dir = Math.random() < 0.5 ? -1 : 1;
        this.melIdx = Math.max(0, Math.min(tr.scale.length - 1, this.melIdx + dir * (Math.random() < 0.25 ? 2 : 1)));
        this.melodyNote(tr.scale[this.melIdx], t, stepDur * 1.8, tr.melGain);
      }
      // ベース（4分音符ごと）
      if (posInChord % 4 === 2) this.bassNote(tr.bass + (chord[0] - 48) + 7, t, stepDur * 2);
    }

    padNote(m, t, dur, gain) {
      const c = this.ctx;
      [0, 4].forEach((det) => {
        const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = mtof(m); o.detune.value = det;
        const g = c.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(gain, t + dur * 0.35);
        g.gain.setValueAtTime(gain, t + dur * 0.7);
        g.gain.linearRampToValueAtTime(0, t + dur);
        const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400;
        o.connect(f); f.connect(g); g.connect(this.bgmBus); g.connect(this.verb);
        o.start(t); o.stop(t + dur + 0.1);
      });
    }

    melodyNote(m, t, dur, gain) {
      const c = this.ctx;
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(m);
      const o2 = c.createOscillator(); o2.type = 'triangle'; o2.frequency.value = mtof(m) * 2;
      const g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      const g2 = c.createGain(); g2.gain.value = 0.25;
      o.connect(g); o2.connect(g2); g2.connect(g);
      g.connect(this.bgmBus); g.connect(this.verb);
      o.start(t); o.stop(t + dur + 0.1); o2.start(t); o2.stop(t + dur + 0.1);
    }

    bassNote(m, t, dur) {
      const c = this.ctx;
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(m);
      const g = c.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.14, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(this.bgmBus);
      o.start(t); o.stop(t + dur + 0.1);
    }

    /* ---------------- SE ---------------- */
    playSE(id) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime;
      switch (id) {
        case 'click': {
          const o = c.createOscillator(); o.type = 'square'; o.frequency.value = 1400;
          const g = c.createGain();
          g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
          o.connect(g); g.connect(this.seBus); o.start(t); o.stop(t + 0.06);
          break;
        }
        case 'page': {
          const s = c.createBufferSource(); s.buffer = this.noiseBuf;
          const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
          f.frequency.setValueAtTime(700, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.22);
          const g = c.createGain();
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.08);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
          s.connect(f); f.connect(g); g.connect(this.seBus); s.start(t); s.stop(t + 0.3);
          break;
        }
        case 'chime': {
          [880, 1318].forEach((fr, i) => {
            const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = fr;
            const g = c.createGain(); const st = t + i * 0.12;
            g.gain.setValueAtTime(0.0001, st); g.gain.exponentialRampToValueAtTime(0.16, st + 0.02);
            g.gain.exponentialRampToValueAtTime(0.0001, st + 1.1);
            o.connect(g); g.connect(this.seBus); g.connect(this.verb);
            o.start(st); o.stop(st + 1.2);
          });
          break;
        }
        case 'bell': {
          [660, 990, 1320, 1760].forEach((fr, i) => {
            const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = fr;
            const g = c.createGain();
            g.gain.setValueAtTime(0.14 / (i + 1), t);
            g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
            o.connect(g); g.connect(this.seBus); g.connect(this.verb);
            o.start(t); o.stop(t + 2.3);
          });
          break;
        }
        case 'thunder': {
          const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
          const f = c.createBiquadFilter(); f.type = 'lowpass';
          f.frequency.setValueAtTime(320, t); f.frequency.exponentialRampToValueAtTime(60, t + 1.6);
          const g = c.createGain();
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 0.12);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
          s.connect(f); f.connect(g); g.connect(this.seBus); s.start(t); s.stop(t + 1.9);
          break;
        }
        case 'heartbeatOnce': this.thump(t); this.thump(t + 0.28); break;
      }
    }

    thump(t) {
      const c = this.ctx;
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.16);
      const g = c.createGain();
      g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g); g.connect(this.seBus); o.start(t); o.stop(t + 0.25);
    }

    startHeartbeat() {
      if (!this.ctx || this.heartbeatTimer) return;
      const beat = () => this.playSE('heartbeatOnce');
      beat();
      this.heartbeatTimer = setInterval(beat, 1100);
    }
    stopHeartbeat() {
      if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
    }

    startRain() {
      if (!this.ctx || this.rainNodes) return;
      const c = this.ctx;
      const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1600;
      const g = c.createGain(); g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(0.14, c.currentTime + 1.2);
      s.connect(f); f.connect(g); g.connect(this.seBus); s.start();
      this.rainNodes = { s, g };
    }
    stopRain() {
      if (!this.rainNodes) return;
      const { s, g } = this.rainNodes, c = this.ctx;
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.8);
      setTimeout(() => { try { s.stop(); } catch (e) {} }, 900);
      this.rainNodes = null;
    }

    startWind() {
      if (!this.ctx || this.windNodes) return;
      const c = this.ctx;
      const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 420; f.Q.value = 0.6;
      const g = c.createGain(); g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(0.07, c.currentTime + 1.5);
      const lfo = c.createOscillator(); lfo.frequency.value = 0.13;
      const lg = c.createGain(); lg.gain.value = 0.035;
      lfo.connect(lg); lg.connect(g.gain);
      s.connect(f); f.connect(g); g.connect(this.seBus); s.start(); lfo.start();
      this.windNodes = { s, g, lfo };
    }
    stopWind() {
      if (!this.windNodes) return;
      const { s, g, lfo } = this.windNodes, c = this.ctx;
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 1.0);
      setTimeout(() => { try { s.stop(); lfo.stop(); } catch (e) {} }, 1100);
      this.windNodes = null;
    }

    /* ---------------- ボイス風ビープ ---------------- */
    voiceBlip(pitch) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime;
      const o = c.createOscillator(); o.type = 'triangle';
      o.frequency.value = pitch * (0.97 + Math.random() * 0.06);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.11, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      o.connect(g); g.connect(this.voiceBus);
      o.start(t); o.stop(t + 0.09);
    }
  }

  global.AudioEngine = AudioEngine;
})(window);
