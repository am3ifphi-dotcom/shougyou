/* ============================================================
   Game Engine — 終電のホームで、君に会った
   ============================================================ */
const $ = id => document.getElementById(id);
const stage = $('stage'), bgEl = $('bg'), charsEl = $('chars');
const dlg = $('dialogue'), namePlate = $('name-plate'), textEl = $('text'), nextInd = $('next-ind');
const choicesEl = $('choices'), fadeEl = $('fade'), flashEl = $('flash');

const BG_LIST = {
  bg_station_dusk: '夕暮れのホーム', bg_classroom: '放課後の教室', bg_park: '桜の公園',
  bg_hospital: '病室', bg_station_night: '終電のホーム', bg_rain: '雨の街',
  bg_festival: '祭りの夜', bg_home: '自室'
};
const CHAR_FILES = {
  mio_normal: 'assets/ch_mio_normal.png', mio_smile: 'assets/ch_mio_smile.png', mio_sad: 'assets/ch_mio_sad.png',
  yuma_normal: 'assets/ch_yuma_normal.png', yuma_sad: 'assets/ch_yuma_sad.png', sensei_normal: 'assets/ch_sensei.png'
};
const POS_X = { left: '24%', center: '50%', right: '76%' };
const NAME_CLASS = { '悠真': 'yuma', '蒼井先生': 'sensei' };
const SAVE_SLOTS = 6;

/* ---------- config / storage ---------- */
const DEFAULT_CFG = { textspeed: 5, autospeed: 5, bgm: 70, se: 80, textsize: 100, opacity: 88, particles: 'on', shake: 'on' };
let config = { ...DEFAULT_CFG };
try { const c = JSON.parse(localStorage.getItem('sakura_config')); if (c) config = { ...DEFAULT_CFG, ...c }; } catch (e) {}
function persistConfig() { try { localStorage.setItem('sakura_config', JSON.stringify(config)); } catch (e) {} }
let gallery = [];
try { gallery = JSON.parse(localStorage.getItem('sakura_gallery') || '[]'); } catch (e) {}
function persistGallery() { try { localStorage.setItem('sakura_gallery', JSON.stringify(gallery)); } catch (e) {} }

/* ---------- state ---------- */
let SPRITES = {};
let idx = 0, flags = {}, backlog = [], chapter = '', lastText = '';
let scene = { bg: null, bgm: null, particles: 'none', letterbox: false };
let chars = { mio: { expr: 'normal', pos: 'center', visible: false }, yuma: { expr: 'normal', pos: 'center', visible: false }, sensei: { expr: 'normal', pos: 'center', visible: false } };
let typing = false, fullText = '', typeTimer = null, autoTimer = null, skipTimer = null;
let autoMode = false, skipMode = false, panelOpen = null, fromTitle = false, currentSayIdx = 0;
const labelMap = {};
SCRIPT.forEach((s, i) => { if (s.label) labelMap[s.label] = i; });

/* ---------- sprite chroma-key ---------- */
function placeholder(key) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 1024;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0, '#ff8fab'); grad.addColorStop(1, '#5b8def');
  g.fillStyle = grad; g.fillRect(0, 0, 512, 1024);
  g.fillStyle = 'rgba(255,255,255,.9)'; g.font = 'bold 200px sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(key.split('_')[0][0].toUpperCase(), 256, 512);
  return c.toDataURL('image/png');
}
function processSprite(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth, h = img.naturalHeight;
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const g = c.getContext('2d'); g.drawImage(img, 0, 0);
        const data = g.getImageData(0, 0, w, h), px = data.data;
        const corner = (x, y) => { const i = (y * w + x) * 4; return [px[i], px[i + 1], px[i + 2]]; };
        const cs = [corner(3, 3), corner(w - 4, 3), corner(3, h - 4), corner(w - 4, h - 4)];
        const bg = [0, 1, 2].map(k => Math.round(cs.reduce((a, c2) => a + c2[k], 0) / 4));
        let minX = w, minY = h, maxX = 0, maxY = 0;
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const dr = px[i] - bg[0], dg = px[i + 1] - bg[1], db = px[i + 2] - bg[2];
          const dist = Math.sqrt(dr * dr + dg * dg + db * db);
          let a;
          if (dist < 28) a = 0; else if (dist > 95) a = 255; else a = (dist - 28) / 67 * 255;
          px[i + 3] = a;
          if (a > 12) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
        }
        g.putImageData(data, 0, 0);
        const pad = 6;
        minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
        maxX = Math.min(w, maxX + pad); maxY = Math.min(h, maxY + pad);
        const out = document.createElement('canvas');
        out.width = Math.max(1, maxX - minX); out.height = Math.max(1, maxY - minY);
        out.getContext('2d').drawImage(c, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
        resolve(out.toDataURL('image/png'));
      } catch (e) { reject(e); }
    };
    img.onerror = reject;
    img.src = src;
  });
}

/* ---------- preload / boot ---------- */
async function preload() {
  const total = Object.keys(BG_LIST).length + Object.keys(CHAR_FILES).length;
  let done = 0;
  const upd = () => { $('boot-fill').style.width = (done / total * 100) + '%'; };
  const jobs = [];
  for (const file of Object.values(BG_LIST)) jobs.push(new Promise(r => {
    const im = new Image(); im.onload = im.onerror = () => { done++; upd(); r(); }; im.src = file;
  }));
  for (const [id, file] of Object.entries(CHAR_FILES)) jobs.push(processSprite(file)
    .then(url => { SPRITES[id] = url; done++; upd(); })
    .catch(() => { SPRITES[id] = placeholder(id); done++; upd(); }));
  await Promise.all(jobs);
}

/* ---------- stage fit ---------- */
function fit() {
  const s = Math.min(window.innerWidth / 16, window.innerHeight / 9);
  stage.style.width = (16 * s) + 'px';
  stage.style.height = (9 * s) + 'px';
  stage.style.setProperty('--u', (16 * s / 100) + 'px');
  sizeParticles();
}
window.addEventListener('resize', fit);

/* ---------- particles ---------- */
const pcv = $('particles'), pctx = pcv.getContext('2d');
let P = { mode: 'none', parts: [] };
function sizeParticles() { pcv.width = stage.clientWidth || 1280; pcv.height = stage.clientHeight || 720; initParts(); }
function initParts() {
  P.parts = [];
  const counts = { sakura: 42, rain: 130, stars: 80, snow: 70, dust: 34 };
  const n = counts[P.mode] || 0;
  for (let i = 0; i < n; i++) P.parts.push({
    x: Math.random() * pcv.width, y: Math.random() * pcv.height,
    s: 0.5 + Math.random(), v: 0.4 + Math.random(), ph: Math.random() * Math.PI * 2, r: Math.random() * Math.PI * 2
  });
}
function setParticles(mode) { P.mode = (config.particles === 'on') ? mode : 'none'; initParts(); }
function particleLoop() {
  pctx.clearRect(0, 0, pcv.width, pcv.height);
  const t = Date.now() / 1000;
  if (P.mode === 'sakura') {
    P.parts.forEach(p => {
      p.y += p.v * 1.1; p.x += Math.sin(t * 1.4 + p.ph) * 0.7 - 0.35; p.r += 0.02;
      if (p.y > pcv.height + 12) { p.y = -12; p.x = Math.random() * pcv.width; }
      pctx.save(); pctx.translate(p.x, p.y); pctx.rotate(p.r);
      pctx.fillStyle = 'rgba(255,183,198,.85)';
      pctx.beginPath(); pctx.ellipse(0, 0, 5 * p.s, 3 * p.s, 0, 0, Math.PI * 2); pctx.fill(); pctx.restore();
    });
  } else if (P.mode === 'rain') {
    pctx.strokeStyle = 'rgba(170,200,255,.5)'; pctx.lineWidth = 1;
    P.parts.forEach(p => {
      p.y += 9 * p.v + 5; p.x -= 1.4;
      if (p.y > pcv.height) { p.y = -14; p.x = Math.random() * (pcv.width + 100); }
      pctx.beginPath(); pctx.moveTo(p.x, p.y); pctx.lineTo(p.x + 2, p.y + 13 * p.s); pctx.stroke();
    });
  } else if (P.mode === 'stars') {
    P.parts.forEach(p => {
      const a = 0.25 + 0.55 * Math.abs(Math.sin(t * p.v + p.ph));
      pctx.fillStyle = `rgba(255,244,214,${a})`;
      pctx.beginPath(); pctx.arc(p.x, p.y, p.s * 1.1, 0, Math.PI * 2); pctx.fill();
    });
  } else if (P.mode === 'snow') {
    P.parts.forEach(p => {
      p.y += p.v * 0.8; p.x += Math.sin(t + p.ph) * 0.4;
      if (p.y > pcv.height) { p.y = -4; p.x = Math.random() * pcv.width; }
      pctx.fillStyle = 'rgba(255,255,255,.85)';
      pctx.beginPath(); pctx.arc(p.x, p.y, p.s * 1.6, 0, Math.PI * 2); pctx.fill();
    });
  } else if (P.mode === 'dust') {
    P.parts.forEach(p => {
      p.x += Math.sin(t * 0.5 + p.ph) * 0.25; p.y += Math.cos(t * 0.4 + p.ph) * 0.2;
      const a = 0.12 + 0.2 * Math.abs(Math.sin(t * p.v + p.ph));
      pctx.fillStyle = `rgba(255,236,190,${a})`;
      pctx.beginPath(); pctx.arc(p.x, p.y, p.s * 1.3, 0, Math.PI * 2); pctx.fill();
    });
  }
  requestAnimationFrame(particleLoop);
}

/* ---------- scene helpers ---------- */
function setBG(id) {
  if (!id || scene.bg === id) return;
  scene.bg = id;
  bgEl.style.opacity = '0';
  setTimeout(() => { bgEl.src = BG_LIST[id] ? 'assets/' + id + '.png' : ''; bgEl.style.opacity = '1'; }, 350);
  if (!gallery.includes(id)) { gallery.push(id); persistGallery(); toast('CGを解放しました ― ' + (BG_LIST[id] || id)); }
}
function doFX(fx) {
  if (fx === 'fadein') { fadeEl.classList.remove('white'); fadeEl.style.opacity = '0'; }
  else if (fx === 'fadeout' || fx === 'blackout') { fadeEl.classList.remove('white'); fadeEl.style.opacity = '1'; }
  else if (fx === 'whiteout') { fadeEl.classList.add('white'); fadeEl.style.opacity = '1'; }
  else if (fx === 'flash') {
    flashEl.style.transition = 'none'; flashEl.style.opacity = '0.85';
    requestAnimationFrame(() => { flashEl.style.transition = 'opacity .6s ease'; flashEl.style.opacity = '0'; });
  } else if (fx === 'shake' && config.shake === 'on') {
    stage.classList.remove('shake'); void stage.offsetWidth; stage.classList.add('shake');
    setTimeout(() => stage.classList.remove('shake'), 500);
  }
}
function renderChars(speaker) {
  charsEl.innerHTML = '';
  for (const who of Object.keys(chars)) {
    const c = chars[who];
    if (!c.visible) continue;
    const img = document.createElement('img');
    img.className = 'char' + (speaker && speaker !== who ? ' dim' : '');
    img.src = SPRITES[who + '_' + c.expr] || SPRITES[who + '_normal'] || placeholder(who);
    img.style.left = POS_X[c.pos] || '50%';
    charsEl.appendChild(img);
  }
}
function applyScene(step) {
  if (step.bg) setBG(step.bg);
  if (step.bgm !== undefined) { scene.bgm = step.bgm; AudioEngine.playBGM(step.bgm); }
  if (step.se) AudioEngine.playSE(step.se);
  if (step.fx) doFX(step.fx);
  if (step.particles !== undefined) { scene.particles = step.particles; setParticles(step.particles); }
  if (step.letterbox !== undefined) { scene.letterbox = step.letterbox; stage.classList.toggle('cinema', !!step.letterbox); }
  if (step.chapter) {
    chapter = step.chapter;
    $('chapter-label').textContent = chapter;
    saveTo(0, true);
    return true;
  }
  return false;
}

/* ---------- dialogue ---------- */
function showSay(say, atIdx) {
  currentSayIdx = atIdx;
  if (say.who && chars[say.who]) {
    chars[say.who].visible = true;
    if (say.expr) chars[say.who].expr = say.expr;
    if (say.pos) chars[say.who].pos = say.pos;
  }
  renderChars(say.who || null);
  const name = say.name || '';
  namePlate.textContent = name;
  namePlate.className = NAME_CLASS[name] || '';
  textEl.className = say.thought ? 'thought' : '';
  fullText = say.text || '';
  lastText = fullText;
  textEl.textContent = '';
  nextInd.style.display = 'none';
  dlg.classList.remove('hide');
  typing = true;
  let i = 0;
  const interval = Math.max(4, 58 - config.textspeed * 5.4);
  clearInterval(typeTimer);
  typeTimer = setInterval(() => {
    i++;
    textEl.textContent = fullText.slice(0, i);
    if (i % 3 === 0) AudioEngine.playSE('tick');
    if (i >= fullText.length) finishType();
  }, interval);
  if (fullText.length === 0) finishType();
}
function finishType() {
  clearInterval(typeTimer); typing = false;
  textEl.textContent = fullText;
  nextInd.style.display = 'block';
  backlog.push({ name: namePlate.textContent, text: fullText });
  if (autoMode) {
    clearTimeout(autoTimer);
    const wait = 500 + fullText.length * (120 - config.autospeed * 10);
    autoTimer = setTimeout(() => { if (autoMode) advance(); }, Math.max(400, wait));
  }
}
function advance() {
  if (panelOpen || !$('letter-view').classList.contains('hidden') || !$('ending-card').classList.contains('hidden')) return;
  if (!$('choices').classList.contains('hidden')) return;
  if (typing) { finishType(); return; }
  clearTimeout(autoTimer);
  run();
}
function showChoice(choice) {
  dlg.classList.add('hide');
  choicesEl.innerHTML = '';
  choicesEl.classList.remove('hidden');
  choice.options.forEach(opt => {
    const b = document.createElement('button');
    b.className = 'cbtn'; b.textContent = opt.label;
    b.onclick = () => {
      AudioEngine.playSE('chime');
      if (opt.set) Object.assign(flags, opt.set);
      choicesEl.classList.add('hidden');
      dlg.classList.remove('hide');
      idx = labelMap[opt.jump] !== undefined ? labelMap[opt.jump] : idx;
      run();
    };
    choicesEl.appendChild(b);
  });
}
function showLetter(text) {
  dlg.classList.add('hide');
  $('letter-body').textContent = text;
  $('letter-view').classList.remove('hidden');
  AudioEngine.playSE('page');
}
function showEnding(end) {
  dlg.classList.add('hide');
  $('ending-type').textContent = end.type;
  $('ending-name').textContent = end.name;
  $('ending-card').classList.remove('hidden');
  AudioEngine.playBGM('ending');
  AudioEngine.playSE('sparkle');
}

/* ---------- main loop ---------- */
function run() {
  if (skipMode) { /* handled by skip timer */ }
  while (idx < SCRIPT.length) {
    const s = SCRIPT[idx];
    if (s.label) { idx++; continue; }
    if (s.bg || s.bgm !== undefined || s.se || s.fx || s.particles !== undefined || s.letterbox !== undefined || s.chapter) {
      const blocking = applyScene(s);
      idx++;
      if (blocking) {
        const card = $('chapter-card');
        $('chapter-text').textContent = chapter;
        card.classList.add('show');
        setTimeout(() => { card.classList.remove('show'); run(); }, 2500);
        return;
      }
      continue;
    }
    if (s.set) { Object.assign(flags, s.set); idx++; continue; }
    if (s.jump) { idx = labelMap[s.jump] !== undefined ? labelMap[s.jump] : idx + 1; continue; }
    if (s.if) {
      const cond = flags[s.if.flag] === s.if.is;
      idx = labelMap[cond ? s.if.then : s.if.else] !== undefined ? labelMap[cond ? s.if.then : s.if.else] : idx + 1;
      continue;
    }
    if (s.hide) { if (chars[s.hide]) chars[s.hide].visible = false; renderChars(); idx++; continue; }
    if (s.show) { const sh = s.show; if (chars[sh.who]) { chars[sh.who].visible = true; chars[sh.who].expr = sh.expr || 'normal'; chars[sh.who].pos = sh.pos || 'center'; } renderChars(); idx++; continue; }
    if (s.say) { const at = idx; idx++; showSay(s.say, at); return; }
    if (s.choice) { idx++; showChoice(s.choice); return; }
    if (s.letter) { idx++; showLetter(s.letter); return; }
    if (s.end) { idx++; showEnding(s.end); return; }
    idx++;
  }
  showEnding({ type: 'THE END', name: '終電のホームで、君に会った' });
}

/* ---------- save / load ---------- */
function snapshot() {
  return {
    idx: currentSayIdx, flags, chapter, scene: { ...scene },
    chars: JSON.parse(JSON.stringify(chars)), backlog: backlog.slice(-60),
    ts: Date.now(), snippet: lastText.slice(0, 34)
  };
}
function saveTo(slot, silent) {
  try {
    localStorage.setItem('sakura_save_' + slot, JSON.stringify(snapshot()));
    if (!silent) toast('セーブしました');
  } catch (e) { if (!silent) toast('セーブに失敗しました'); }
}
function loadFrom(slot) {
  let data;
  try { data = JSON.parse(localStorage.getItem('sakura_save_' + slot)); } catch (e) {}
  if (!data) { toast('データがありません'); return; }
  idx = data.idx; flags = data.flags || {}; chapter = data.chapter || '';
  scene = { ...scene, ...data.scene }; chars = data.chars; backlog = data.backlog || [];
  $('chapter-label').textContent = chapter;
  if (scene.bg) { bgEl.src = 'assets/' + scene.bg + '.png'; bgEl.style.opacity = '1'; }
  if (scene.bgm) AudioEngine.playBGM(scene.bgm);
  setParticles(scene.particles || 'none');
  stage.classList.toggle('cinema', !!scene.letterbox);
  renderChars();
  closePanels();
  toast('ロードしました');
  run();
}
function getSave(slot) { try { return JSON.parse(localStorage.getItem('sakura_save_' + slot)); } catch (e) { return null; } }
function buildSlots(el, mode) {
  el.innerHTML = '';
  for (let i = 0; i < SAVE_SLOTS; i++) {
    const d = getSave(i);
    const b = document.createElement('button');
    b.className = 'slot' + (d ? '' : ' empty');
    const title = i === 0 ? 'AUTO' : 'SLOT ' + i;
    if (d) {
      const dt = new Date(d.ts);
      b.innerHTML = `<div class="slot-title">${title}</div><div>${d.chapter || '―'}</div><div class="slot-meta">${dt.toLocaleDateString()} ${dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}<br>${d.snippet || ''}</div>`;
    } else {
      b.innerHTML = `<div class="slot-title">${title}</div><div class="slot-meta">（空）</div>`;
    }
    b.onclick = () => {
      AudioEngine.playSE('chime');
      if (mode === 'save') saveTo(i);
      else loadFrom(i);
      buildSlots(el, mode);
    };
    el.appendChild(b);
  }
}

/* ---------- panels ---------- */
function openPanel(id) {
  closePanels(true);
  panelOpen = id;
  $(id).classList.remove('hidden');
  if (id === 'save-panel') buildSlots($('save-slots'), 'save');
  if (id === 'load-panel') buildSlots($('load-slots'), 'load');
  if (id === 'backlog-panel') {
    const list = $('backlog-list'); list.innerHTML = '';
    backlog.forEach(l => {
      const d = document.createElement('div'); d.className = 'log-line';
      d.innerHTML = (l.name ? `<div class="log-name">${l.name}</div>` : '') + `<div class="log-text">${l.text}</div>`;
      list.appendChild(d);
    });
    list.scrollTop = list.scrollHeight;
  }
  if (id === 'gallery-panel') {
    const grid = $('gallery-grid'); grid.innerHTML = '';
    Object.entries(BG_LIST).forEach(([id2, label]) => {
      const unlocked = gallery.includes(id2);
      const d = document.createElement('div');
      d.className = 'gitem' + (unlocked ? '' : ' locked');
      d.innerHTML = `<img src="assets/${id2}.png" alt=""><div class="glabel">${unlocked ? label : '？？？'}</div>`;
      grid.appendChild(d);
    });
  }
  if (id === 'config-panel') syncConfigUI();
}
function closePanels(keepFlag) {
  ['backlog-panel', 'save-panel', 'load-panel', 'config-panel', 'gallery-panel', 'menu-panel'].forEach(p => $(p).classList.add('hidden'));
  panelOpen = null;
  if (!keepFlag && fromTitle) { fromTitle = false; showTitle(); }
}
function syncConfigUI() {
  $('cfg-textspeed').value = config.textspeed;
  $('cfg-autospeed').value = config.autospeed;
  $('cfg-bgm').value = config.bgm;
  $('cfg-se').value = config.se;
  $('cfg-textsize').value = config.textsize;
  $('cfg-opacity').value = config.opacity;
  $('cfg-particles').value = config.particles;
  $('cfg-shake').value = config.shake;
}
function applyConfig() {
  persistConfig();
  AudioEngine.setBGM(config.bgm);
  AudioEngine.setSE(config.se);
  textEl.style.fontSize = `calc(var(--u)*1.62*${config.textsize / 100})`;
  const a = config.opacity / 100;
  dlg.style.background = `linear-gradient(180deg, rgba(12,12,24,${a}), rgba(12,12,24,${a * 0.82}))`;
  setParticles(scene.particles || 'none');
}

/* ---------- toast ---------- */
let toastTimer = null;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---------- screen flow ---------- */
function showTitle() {
  $('game').classList.add('hidden');
  $('title').classList.remove('hidden');
  AudioEngine.playBGM('title');
}
function showGame() {
  $('title').classList.add('hidden');
  $('game').classList.remove('hidden');
  fit();
}
function startGame() {
  idx = 0; flags = {}; backlog = []; chapter = ''; lastText = '';
  scene = { bg: null, bgm: null, particles: 'none', letterbox: false };
  chars = { mio: { expr: 'normal', pos: 'center', visible: false }, yuma: { expr: 'normal', pos: 'center', visible: false }, sensei: { expr: 'normal', pos: 'center', visible: false } };
  autoMode = false; skipMode = false;
  $('btn-auto').classList.remove('on'); $('btn-skip').classList.remove('on');
  fadeEl.classList.remove('white'); fadeEl.style.opacity = '1';
  renderChars();
  showGame();
  run();
}

/* ---------- input ---------- */
stage.addEventListener('click', e => {
  if (e.target.closest('button') || e.target.closest('.panel') || e.target.closest('#letter-view') || e.target.closest('#ending-card')) return;
  advance();
});
$('letter-view').addEventListener('click', () => {
  $('letter-view').classList.add('hidden');
  dlg.classList.remove('hide');
  run();
});
$('ending-card').addEventListener('click', () => {
  $('ending-card').classList.add('hidden');
  showTitle();
});
document.addEventListener('keydown', e => {
  AudioEngine.init();
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    if (!$('title').classList.contains('hidden')) { startGame(); return; }
    if (!$('ending-card').classList.contains('hidden')) { $('ending-card').classList.add('hidden'); showTitle(); return; }
    if (!$('letter-view').classList.contains('hidden')) { $('letter-view').classList.add('hidden'); dlg.classList.remove('hide'); run(); return; }
    advance();
  } else if (e.code === 'Escape') {
    if (panelOpen) closePanels();
    else if (!$('game').classList.contains('hidden')) openPanel('menu-panel');
  } else if (e.code === 'KeyA') { toggleAuto(); }
  else if (e.code === 'KeyS') { toggleSkip(); }
  else if (e.code === 'KeyB') { panelOpen === 'backlog-panel' ? closePanels() : openPanel('backlog-panel'); }
  else if (e.code === 'KeyQ') { saveTo(0); }
  else if (e.code === 'KeyF') { toggleFullscreen(); }
});
function toggleAuto() {
  autoMode = !autoMode;
  $('btn-auto').classList.toggle('on', autoMode);
  if (autoMode && !typing) { clearTimeout(autoTimer); autoTimer = setTimeout(advance, 600); }
  toast(autoMode ? 'オートモード ON' : 'オートモード OFF');
}
function toggleSkip() {
  skipMode = !skipMode;
  $('btn-skip').classList.toggle('on', skipMode);
  if (skipMode) {
    skipTimer = setInterval(() => {
      if (!skipMode || panelOpen || !$('choices').classList.contains('hidden') || !$('letter-view').classList.contains('hidden') || !$('ending-card').classList.contains('hidden')) {
        if (!$('choices').classList.contains('hidden') || !$('letter-view').classList.contains('hidden') || !$('ending-card').classList.contains('hidden')) toggleSkip();
        return;
      }
      if (typing) finishType(); else run();
    }, 40);
  } else clearInterval(skipTimer);
  toast(skipMode ? 'スキップモード ON' : 'スキップモード OFF');
}
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => {});
}

/* ---------- HUD / panels wiring ---------- */
$('btn-save').onclick = () => openPanel('save-panel');
$('btn-load').onclick = () => openPanel('load-panel');
$('btn-auto').onclick = toggleAuto;
$('btn-skip').onclick = toggleSkip;
$('btn-backlog').onclick = () => openPanel('backlog-panel');
$('btn-config').onclick = () => openPanel('config-panel');
$('btn-menu').onclick = () => openPanel('menu-panel');
document.querySelectorAll('.close-panel').forEach(b => b.onclick = () => closePanels());
document.querySelectorAll('.menu-act').forEach(b => b.onclick = () => {
  const act = b.dataset.act;
  if (act === 'title') { closePanels(); showTitle(); return; }
  openPanel(act + '-panel');
});
[['cfg-textspeed', 'textspeed'], ['cfg-autospeed', 'autospeed'], ['cfg-bgm', 'bgm'], ['cfg-se', 'se'], ['cfg-textsize', 'textsize'], ['cfg-opacity', 'opacity']].forEach(([id, key]) => {
  $(id).addEventListener('input', e => { config[key] = parseInt(e.target.value, 10); applyConfig(); });
});
$('cfg-particles').addEventListener('change', e => { config.particles = e.target.value; applyConfig(); });
$('cfg-shake').addEventListener('change', e => { config.shake = e.target.value; applyConfig(); });

/* ---------- title wiring ---------- */
document.querySelectorAll('.tbtn').forEach(b => b.onclick = () => {
  AudioEngine.init(); AudioEngine.playSE('chime');
  const act = b.dataset.act;
  if (act === 'new') startGame();
  else if (act === 'continue') {
    let latest = -1, latestTs = 0;
    for (let i = 0; i < SAVE_SLOTS; i++) { const d = getSave(i); if (d && d.ts > latestTs) { latestTs = d.ts; latest = i; } }
    if (latest >= 0) { showGame(); loadFrom(latest); } else { fromTitle = true; showGame(); openPanel('load-panel'); toast('セーブデータがありません'); }
  } else if (act === 'load' || act === 'config' || act === 'gallery') {
    fromTitle = true; showGame(); openPanel(act + '-panel');
  }
});
document.addEventListener('pointerdown', () => { AudioEngine.init(); AudioEngine.playBGM($('title').classList.contains('hidden') ? (scene.bgm || 'title') : 'title'); }, { once: true });

/* ---------- init ---------- */
(async function init() {
  fit();
  particleLoop();
  applyConfig();
  await preload();
  $('boot').classList.add('hidden');
  $('title').classList.remove('hidden');
})();
