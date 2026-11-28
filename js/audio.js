/* ============================================================
   audio.js — WebAudio 生成 BGM / SE / ボイス
   外部ファイル不要・全てリアルタイム合成
   ============================================================ */
const AudioSys = (() => {
  let ctx = null, master, bgmGain, seGain, noiseBuf;
  let bgmTimer = null, bgmMood = null, bgmStep = 0, nextNoteTime = 0;
  let wavesNode = null, rainNode = null;
  const cfg = { bgm: 0.7, se: 0.8, voice: true, voiceRate: 1.0 };

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    bgmGain = ctx.createGain(); bgmGain.gain.value = cfg.bgm; bgmGain.connect(master);
    seGain = ctx.createGain(); seGain.gain.value = cfg.se; seGain.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  /* ---------- 音階ユーティリティ ---------- */
  const NOTE = { C:0, 'C#':1, D:2, 'D#':3, E:4, F:5, 'F#':6, G:7, 'G#':8, A:9, 'A#':10, B:11 };
  function freq(name, oct = 4) {
    const m = name.match(/^([A-G]#?)(\d)$/);
    const semi = NOTE[m[1]] + (parseInt(m[2]) + 1) * 12;
    return 440 * Math.pow(2, (semi - 69) / 12);
  }

  /* ---------- ピアノ風トーン ---------- */
  function piano(f, t, dur, vol = 0.22, dest = bgmGain) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200; lp.Q.value = 0.4;
    const o1 = ctx.createOscillator(); o1.type = 'triangle'; o1.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2;
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(dest);
    o1.start(t); o2.start(t); o1.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
  }
  function pad(f, t, dur, vol = 0.05) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.35);
    g.gain.linearRampToValueAtTime(0, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    [0, 4].forEach(det => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      o.connect(lp); o.start(t); o.stop(t + dur + 0.1);
    });
    lp.connect(g); g.connect(bgmGain);
  }
  function bass(f, t, dur, vol = 0.14) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(bgmGain); o.start(t); o.stop(t + dur + 0.1);
  }

  /* ---------- BGM ムード定義 ---------- */
  const MOODS = {
    title:  { bpm: 68, chords: [['C3','E3','G3','B3'], ['A2','C3','E3','G3'], ['F2','A2','C3','E3'], ['G2','B2','D3','F3']],
              melody: ['E4','G4','A4','G4','E4','D4','C4','D4','E4','G4','A4','C5','A4','G4','E4','D4'], melEvery: 2, padVol: 0.05 },
    daily:  { bpm: 84, chords: [['F2','A2','C3','E3'], ['G2','B2','D3','F3'], ['A2','C3','E3','G3'], ['C3','E3','G3','B3']],
              melody: ['A4','C5','D5','C5','A4','G4','A4','C5','D5','E5','D5','C5','A4','G4','E4','G4'], melEvery: 1, padVol: 0.035 },
    sad:    { bpm: 62, chords: [['A2','C3','E3'], ['E2','G2','B2'], ['F2','A2','C3'], ['G2','B2','D3']],
              melody: ['E4','D4','C4','D4','E4','G4','E4','D4','C4','A3','C4','D4'], melEvery: 2, padVol: 0.055 },
    piano:  { bpm: 76, chords: [['C3','E3','G3'], ['F2','A2','C3'], ['G2','B2','D3'], ['C3','E3','G3']],
              melody: ['C4','E4','G4','E4','A4','G4','E4','D4','E4','G4','A4','C5','B4','G4','E4','D4','C4'], melEvery: 1, padVol: 0.03 },
    climax: { bpm: 92, chords: [['A2','C3','E3','G3'], ['F2','A2','C3','E3'], ['C3','E3','G3','B3'], ['G2','B2','D3','F3']],
              melody: ['A4','C5','E5','D5','C5','A4','G4','A4','C5','D5','E5','G5','E5','D5','C5','D5'], melEvery: 1, padVol: 0.06 },
    ending: { bpm: 70, chords: [['C3','E3','G3','B3'], ['F2','A2','C3','E3'], ['C3','E3','G3'], ['G2','B2','D3']],
              melody: ['E4','G4','C5','B4','A4','G4','E4','D4','C4'], melEvery: 2, padVol: 0.05 },
  };
  let melIdx = 0;

  function scheduleStep() {
    const m = MOODS[bgmMood]; if (!m) return;
    const spb = 60 / m.bpm / 2; // 8分音符
    while (nextNoteTime < ctx.currentTime + 0.25) {
      const bar = Math.floor(bgmStep / 8) % m.chords.length;
      const chord = m.chords[bar];
      const inBar = bgmStep % 8;
      if (inBar === 0) {
        chord.forEach(n => pad(freq(n), nextNoteTime, spb * 8, m.padVol));
        bass(freq(chord[0].replace(/\d$/, x => +x - 1)), nextNoteTime, spb * 6, 0.13);
      }
      if (inBar === 4) bass(freq(chord[0].replace(/\d$/, x => +x - 1)), nextNoteTime, spb * 3, 0.09);
      if (bgmStep % m.melEvery === 0) {
        const note = m.melody[melIdx % m.melody.length]; melIdx++;
        piano(freq(note), nextNoteTime, spb * 2.2, 0.16);
        if (Math.random() < 0.35) piano(freq(note) * 2, nextNoteTime + spb * 0.5, spb * 1.4, 0.05);
      }
      // アルペジオ
      if (inBar % 2 === 0) piano(freq(chord[(inBar / 2) % chord.length]), nextNoteTime, spb * 1.6, 0.07);
      nextNoteTime += spb; bgmStep++;
    }
  }

  function playBGM(mood) {
    init();
    // シーン移動時に環境音を一度リセットし、波音・雨音が重なり続けないようにする。
    stopLoop('waves'); stopLoop('rain');
    if (bgmMood === mood) return;
    bgmMood = mood; bgmStep = 0; melIdx = 0;
    nextNoteTime = ctx.currentTime + 0.08;
    if (bgmTimer) clearInterval(bgmTimer);
    bgmTimer = setInterval(scheduleStep, 90);
  }
  function stopBGM() { bgmMood = null; if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; } stopLoop('waves'); stopLoop('rain'); }

  /* ---------- SE ---------- */
  function blip(vol = 0.05) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 880 + Math.random() * 120;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.05);
    o.connect(g); g.connect(seGain); o.start(t); o.stop(t + 0.06);
  }
  function click() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 1400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.04);
    o.connect(g); g.connect(seGain); o.start(t); o.stop(t + 0.05);
  }
  function bell() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [1318, 1975, 2637].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.12 / (i + 1), t); g.gain.exponentialRampToValueAtTime(0.0008, t + 2.2);
      o.connect(g); g.connect(seGain); o.start(t); o.stop(t + 2.3);
    });
  }
  function heartbeat() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [0, 0.28].forEach(off => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(58, t + off);
      o.frequency.exponentialRampToValueAtTime(38, t + off + 0.16);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5, t + off); g.gain.exponentialRampToValueAtTime(0.0008, t + off + 0.2);
      o.connect(g); g.connect(seGain); o.start(t + off); o.stop(t + off + 0.25);
    });
  }
  function flashSE() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3000; bp.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.5);
    src.connect(bp); bp.connect(g); g.connect(seGain); src.start(t); src.stop(t + 0.55);
  }
  function pageSE() {
    if (!ctx) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.setValueAtTime(600, t);
    bp.frequency.exponentialRampToValueAtTime(2400, t + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0008, t + 0.22);
    src.connect(bp); bp.connect(g); g.connect(seGain); src.start(t); src.stop(t + 0.25);
  }
  function loopNoise(type) {
    init();
    stopLoop(type);
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    if (type === 'waves') {
      f.type = 'lowpass'; f.frequency.value = 500; g.gain.value = 0.10;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.14;
      const lg = ctx.createGain(); lg.gain.value = 0.05;
      lfo.connect(lg); lg.connect(g.gain); lfo.start();
      src._lfo = lfo;
    } else { // rain
      f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.4; g.gain.value = 0.07;
    }
    src.connect(f); f.connect(g); g.connect(seGain); src.start();
    if (type === 'waves') wavesNode = src; else rainNode = src;
  }
  function stopLoop(type) {
    const n = type === 'waves' ? wavesNode : rainNode;
    if (n) { try { n.stop(); if (n._lfo) n._lfo.stop(); } catch(e){} }
    if (type === 'waves') wavesNode = null; else rainNode = null;
  }

  /* ---------- ボイス (speechSynthesis) ---------- */
  const VOICE_PITCH = { yukino: 1.35, mio: 1.1, yuma: 0.85 };
  let jaVoice = null;
  function pickVoice() {
    const vs = speechSynthesis.getVoices();
    jaVoice = vs.find(v => v.lang && v.lang.toLowerCase().startsWith('ja')) || null;
  }
  if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function speak(text, charaId) {
    if (!cfg.voice || !('speechSynthesis' in window) || !text) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (jaVoice) u.voice = jaVoice;
      u.lang = 'ja-JP';
      u.pitch = VOICE_PITCH[charaId] || 1.0;
      u.rate = 1.02 * (cfg.voiceRate || 1);
      u.volume = 0.9;
      speechSynthesis.speak(u);
    } catch(e) {}
  }
  function stopVoice() { try { speechSynthesis.cancel(); } catch(e){} }

  function setVolumes() {
    if (!ctx) return;
    bgmGain.gain.value = cfg.bgm; seGain.gain.value = cfg.se;
  }

  return { init, playBGM, stopBGM, blip, click, bell, heartbeat, flashSE, pageSE,
           loopNoise, stopLoop, speak, stopVoice, setVolumes, cfg };
})();
