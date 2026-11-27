/* ============================================================
   WebAudio BGM / SE Engine — fully procedural, no audio files
   ============================================================ */
const AudioEngine = (() => {
  let ctx = null, master = null, bgmBus = null, seBus = null, noiseBuf = null;
  let trackName = null, schedTimer = null, nextTime = 0, stepIdx = 0;
  const loops = {};
  const m2f = m => 440 * Math.pow(2, (m - 69) / 12);

  const TRACKS = {
    title: { bpm: 72, style: 'pad', chords: [[57,60,64],[53,57,60],[60,64,67],[55,59,62]], bass: [45,41,48,43],
      melody: [69,0,0,67,0,64,0,0, 65,0,0,64,0,62,0,0, 64,0,0,62,0,60,0,0, 62,0,64,0,67,0,0,0] },
    daily: { bpm: 104, style: 'arp', chords: [[60,64,67],[55,59,62],[57,60,64],[53,57,60]], bass: [48,43,45,41] },
    sad:   { bpm: 60, style: 'sparse', chords: [[57,60,64],[52,55,59],[53,57,60],[52,56,59]], bass: [45,40,41,40],
      melody: [64,0,0,62,0,60,0,0, 59,0,0,60,0,0,0,0, 60,0,0,62,0,64,0,0, 65,0,64,0,62,0,0,0] },
    hope:  { bpm: 88, style: 'arp', chords: [[60,64,67],[55,59,62],[57,60,64],[53,57,60]], bass: [48,43,45,41] },
    tense: { bpm: 52, style: 'drone', chords: [[33,34,40]], bass: [33],
      melody: [45,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0, 46,0,0,0,0,0,0,0, 0,0,0,0,0,0,0,0] },
    ending:{ bpm: 66, style: 'sparse', chords: [[60,64,67],[57,60,64],[53,57,60],[55,59,62]], bass: [48,45,41,43],
      melody: [67,0,64,0,62,0,60,0, 64,0,62,0,60,0,0,0, 65,0,64,0,62,0,60,0, 62,0,0,0,60,0,0,0] }
  };

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    bgmBus = ctx.createGain(); bgmBus.gain.value = 0.7; bgmBus.connect(master);
    seBus = ctx.createGain(); seBus.gain.value = 0.8; seBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  /* ---------- voices ---------- */
  function pianoNote(midi, t, dur = 1.4, vel = 0.4) {
    const f = m2f(midi);
    const o1 = ctx.createOscillator(); o1.type = 'triangle'; o1.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2;
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 2200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o1.connect(fl); o2.connect(fl); fl.connect(g); g.connect(bgmBus);
    o1.start(t); o2.start(t); o1.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  }
  function padChord(notes, t, dur, vel = 0.13) {
    notes.forEach(n => {
      const f = m2f(n);
      [-5, 5].forEach(det => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
        const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 820;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vel, t + dur * 0.35);
        g.gain.linearRampToValueAtTime(0, t + dur);
        o.connect(fl); fl.connect(g); g.connect(bgmBus);
        o.start(t); o.stop(t + dur + 0.1);
      });
    });
  }
  function pluck(midi, t, vel = 0.26) {
    const f = m2f(midi);
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = f;
    const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f * 2; fl.Q.value = 1.1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    o.connect(fl); fl.connect(g); g.connect(bgmBus);
    o.start(t); o.stop(t + 0.45);
  }
  function bassNote(midi, t, dur, vel = 0.34) {
    const f = m2f(midi);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); o2.connect(g); g.connect(bgmBus);
    o.start(t); o2.start(t); o.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  }

  /* ---------- BGM scheduler ---------- */
  function playStep(tr, t, step) {
    const bar = Math.floor(step / 8), s = step % 8;
    const chord = tr.chords[bar % tr.chords.length];
    const root = tr.bass[bar % tr.bass.length];
    const barDur = (60 / tr.bpm) * 4;
    const mel = tr.melody ? tr.melody[step % tr.melody.length] : 0;
    if (tr.style === 'pad') {
      if (s === 0) { padChord(chord, t, barDur); bassNote(root, t, barDur * 0.95, 0.3); }
      if (mel) pianoNote(mel, t, 1.8, 0.34);
    } else if (tr.style === 'arp') {
      const seq = [0, 1, 2, 1, 0, 1, 2, 1];
      pluck(chord[seq[s]] + 12, t, 0.2);
      if (s === 0 || s === 4) bassNote(root, t, barDur * 0.45, 0.32);
    } else if (tr.style === 'sparse') {
      if (s === 0) { padChord(chord, t, barDur, 0.09); bassNote(root, t, barDur * 0.9, 0.28); }
      if (mel) pianoNote(mel, t, 2.2, 0.36);
    } else if (tr.style === 'drone') {
      if (s === 0) { bassNote(root, t, barDur, 0.4); bassNote(root + 1, t, barDur, 0.16); }
      if (s === 4) pianoNote(root + 12, t, 1.2, 0.14);
      if (mel) pianoNote(mel, t, 1.6, 0.2);
      if (bar % 4 === 3 && s === 6) pianoNote(root + 25, t, 1.4, 0.1);
    }
  }
  function scheduler() {
    const tr = TRACKS[trackName];
    if (!tr) return;
    const stepDur = 60 / tr.bpm / 2;
    while (nextTime < ctx.currentTime + 0.18) {
      playStep(tr, nextTime, stepIdx);
      nextTime += stepDur; stepIdx++;
    }
  }
  function playBGM(name) {
    init(); if (!ctx) return;
    if (name === trackName) return;
    if (name === 'none' || !TRACKS[name]) { stopBGM(); return; }
    const now = ctx.currentTime;
    bgmBus.gain.cancelScheduledValues(now);
    bgmBus.gain.setValueAtTime(bgmBus.gain.value, now);
    bgmBus.gain.linearRampToValueAtTime(0.0001, now + 0.6);
    trackName = name; stepIdx = 0;
    nextTime = now + 0.7;
    if (schedTimer) clearInterval(schedTimer);
    schedTimer = setInterval(scheduler, 25);
    bgmBus.gain.setValueAtTime(0.0001, now + 0.65);
    bgmBus.gain.linearRampToValueAtTime(0.7, now + 1.5);
  }
  function stopBGM() {
    if (!ctx) { trackName = null; return; }
    const now = ctx.currentTime;
    bgmBus.gain.cancelScheduledValues(now);
    bgmBus.gain.setValueAtTime(bgmBus.gain.value, now);
    bgmBus.gain.linearRampToValueAtTime(0.0001, now + 0.8);
    trackName = null;
    if (schedTimer) { clearInterval(schedTimer); schedTimer = null; }
  }

  /* ---------- SE ---------- */
  function noiseSrc() { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s; }
  function startLoop(name) {
    if (loops[name] || !ctx) return;
    const t = ctx.currentTime;
    const src = noiseSrc();
    const g = ctx.createGain(); g.gain.value = 0;
    let node = src;
    if (name === 'rain') {
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200;
      src.connect(hp); hp.connect(lp); lp.connect(g);
      g.gain.linearRampToValueAtTime(0.16, t + 1.2);
    } else if (name === 'wave') {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 550;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.12;
      const lg = ctx.createGain(); lg.gain.value = 0.08;
      lfo.connect(lg); lg.connect(g.gain); lfo.start(t);
      src.connect(lp); lp.connect(g);
      g.gain.setValueAtTime(0.1, t);
      loops[name + '_lfo'] = lfo;
    } else if (name === 'train') {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.5;
      const lg = ctx.createGain(); lg.gain.value = 0.05;
      lfo.connect(lg); lg.connect(g.gain); lfo.start(t);
      src.connect(lp); lp.connect(g);
      g.gain.setValueAtTime(0.12, t);
      loops[name + '_lfo'] = lfo;
    }
    g.connect(seBus); src.start(t);
    loops[name] = { src, gain: g };
  }
  function stopLoop(name) {
    const l = loops[name]; if (!l || !ctx) return;
    const t = ctx.currentTime;
    l.gain.gain.cancelScheduledValues(t);
    l.gain.gain.setValueAtTime(l.gain.gain.value, t);
    l.gain.gain.linearRampToValueAtTime(0, t + 0.6);
    setTimeout(() => { try { l.src.stop(); } catch (e) {} }, 700);
    const lfo = loops[name + '_lfo']; if (lfo) { try { lfo.stop(t + 0.7); } catch (e) {} delete loops[name + '_lfo']; }
    delete loops[name];
  }
  function burst(dur, filterType, freq, vol, when = 0, sweepTo = null) {
    const t = ctx.currentTime + when;
    const src = noiseSrc(); src.loop = false;
    const fl = ctx.createBiquadFilter(); fl.type = filterType; fl.frequency.value = freq;
    if (sweepTo) fl.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(fl); fl.connect(g); g.connect(seBus);
    src.start(t); src.stop(t + dur + 0.1);
  }
  function tone(freq, dur, vol, when = 0, type = 'sine', slideTo = null) {
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(seBus);
    o.start(t); o.stop(t + dur + 0.1);
  }
  function playSE(name) {
    init(); if (!ctx) return;
    if (name === 'stop') { Object.keys(loops).forEach(k => { if (!k.endsWith('_lfo')) stopLoop(k); }); return; }
    if (name === 'rain' || name === 'wave' || name === 'train') { startLoop(name); return; }
    switch (name) {
      case 'bell': [1046, 1318, 1568].forEach(f => tone(f, 2.4, 0.22)); break;
      case 'chime': [1568, 2093].forEach((f, i) => tone(f, 1.4, 0.18, i * 0.12)); break;
      case 'sparkle': [1568, 2093, 2637, 3136].forEach((f, i) => tone(f, 0.9, 0.14, i * 0.07)); break;
      case 'thunder': burst(2.4, 'lowpass', 320, 0.7); burst(1.6, 'lowpass', 180, 0.5, 0.25); break;
      case 'crash': burst(0.4, 'highpass', 900, 0.6); tone(180, 0.5, 0.5, 0, 'sine', 45); break;
      case 'page': burst(0.2, 'bandpass', 1900, 0.3); break;
      case 'heartbeat': for (let i = 0; i < 3; i++) { tone(55, 0.16, 0.55, i * 0.38); tone(50, 0.14, 0.4, i * 0.38 + 0.16); } break;
      case 'footsteps': for (let i = 0; i < 4; i++) burst(0.09, 'bandpass', 480, 0.35, i * 0.3); break;
      case 'phone': tone(180, 0.22, 0.3, 0, 'square'); tone(180, 0.22, 0.3, 0.35, 'square'); break;
      case 'door': burst(0.6, 'bandpass', 380, 0.3, 0, 950); break;
      case 'fireworks': for (let i = 0; i < 3; i++) { burst(0.25, 'lowpass', 900, 0.5, i * 0.55); tone(1200 + i * 300, 0.5, 0.08, i * 0.55 + 0.05); } break;
      case 'trainpass': burst(3.2, 'lowpass', 260, 0.5); for (let i = 0; i < 8; i++) burst(0.06, 'bandpass', 1400, 0.2, 0.3 + i * 0.35); break;
      case 'tick': tone(1400, 0.03, 0.05); break;
    }
  }
  function setBGM(v) { if (ctx && bgmBus) bgmBus.gain.setTargetAtTime((v / 100) * 0.9, ctx.currentTime, 0.1); }
  function setSE(v) { if (ctx && seBus) seBus.gain.setTargetAtTime((v / 100), ctx.currentTime, 0.1); }

  return { init, playBGM, stopBGM, playSE, setBGM, setSE };
})();
