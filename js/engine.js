/* ============================================================
   桜色の約束 ― ノベルゲームエンジン
   進行 / タイプライター / セーブ・ロード / 演出 / ギャラリー
   ============================================================ */
(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const stage = $('stage'), shakeWrap = $('shakeWrap');
  const bgLayer = $('bgLayer'), bgA = $('bgA'), bgB = $('bgB');
  const charLayer = $('charLayer'), fxCanvas = $('fxCanvas');
  const flashEl = $('flash'), cgLayer = $('cgLayer'), cgImg = $('cgImg'), cgCaption = $('cgCaption');
  const textBox = $('textBox'), namePlate = $('namePlate'), nameText = $('nameText');
  const textBody = $('textBody'), textSpan = $('textSpan'), nextIndicator = $('nextIndicator');
  const choiceLayer = $('choiceLayer');
  const chapterCard = $('chapterCard'), chapterTitle = $('chapterTitle'), chapterSub = $('chapterSub');
  const titleScreen = $('titleScreen'), titleBg = $('titleBg'), clearBadge = $('clearBadge');
  const modalLayer = $('modalLayer');
  const endingScreen = $('endingScreen'), staffInner = $('staffInner'), btnToTitle = $('btnToTitle');
  const fadeBlack = $('fadeBlack'), toastEl = $('toast');

  const Audio = new AudioEngine();

  /* ---------------- 設定 ---------------- */
  function loadConfig() {
    try {
      return Object.assign(
        { textSpeed: 3, autoDelay: 1800, bgm: 0.7, se: 0.8, voice: 0.6, voiceOn: true },
        JSON.parse(localStorage.getItem('sakura_config') || '{}')
      );
    } catch (e) {
      return { textSpeed: 3, autoDelay: 1800, bgm: 0.7, se: 0.8, voice: 0.6, voiceOn: true };
    }
  }
  let config = loadConfig();
  function saveConfig() { try { localStorage.setItem('sakura_config', JSON.stringify(config)); } catch (e) {} }

  /* ---------------- 状態 ---------------- */
  const state = {
    step: 0, flags: {}, bg: 'station', chars: {}, backlog: [],
    typing: false, typeTimer: null, fullText: '', who: null,
    auto: false, autoTimer: null, skip: false, skipTimer: null,
    lastLine: null, chapter: '', fx: 'none', ambient: null,
    chapterTimer: null, cgTimer: null
  };
  let uiMode = 'title';       // 'title' | 'game'
  let modalOpen = false, choiceOpen = false, chapterOpen = false, cgOpen = false, endingOpen = false;

  const labelMap = {};
  SCRIPT.forEach((s, i) => { if (s.t === 'label') labelMap[s.id] = i; });

  /* ---------------- ステージ縮小 ---------------- */
  function resize() {
    const s = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    stage.style.transform = 'scale(' + s + ')';
  }
  window.addEventListener('resize', resize);
  resize();

  /* ---------------- プリロード ---------------- */
  function preload() {
    Object.values(BGS).forEach((u) => { const i = new Image(); i.src = u; });
    Object.values(CGS).forEach((c) => { const i = new Image(); i.src = c.img; });
    Object.values(CHARACTERS).forEach((c) => { if (c.img) { const i = new Image(); i.src = c.img; } });
  }

  /* ---------------- 背景 ---------------- */
  let bgFlip = false;
  function setBG(id, instant) {
    const url = BGS[id];
    if (!url) return;
    state.bg = id;
    const show = bgFlip ? bgA : bgB, hide = bgFlip ? bgB : bgA;
    bgFlip = !bgFlip;
    if (instant) {
      show.src = url; show.classList.add('on'); hide.classList.remove('on');
      return;
    }
    const im = new Image();
    im.onload = () => { show.src = url; show.classList.add('on'); hide.classList.remove('on'); };
    im.onerror = () => { show.classList.remove('on'); };
    im.src = url;
  }

  /* ---------------- キャラ ---------------- */
  function showChar(who, pos) {
    const ch = CHARACTERS[who];
    if (!ch || !ch.img) return;
    state.chars[who] = pos || 'center';
    let el = charLayer.querySelector('[data-who="' + who + '"]');
    if (el) { el.className = 'char pos-' + state.chars[who] + ' on'; return; }
    el = document.createElement('div');
    el.className = 'char pos-' + state.chars[who];
    el.dataset.who = who;
    const inner = document.createElement('div');
    inner.className = 'charInner';
    const img = document.createElement('img');
    img.src = ch.img; img.alt = ch.name;
    img.onerror = () => { el.remove(); };
    inner.appendChild(img); el.appendChild(inner);
    charLayer.appendChild(el);
    requestAnimationFrame(() => el.classList.add('on'));
  }
  function hideChar(who) {
    delete state.chars[who];
    const el = charLayer.querySelector('[data-who="' + who + '"]');
    if (el) { el.classList.remove('on'); setTimeout(() => { if (!el.classList.contains('on')) el.remove(); }, 600); }
  }
  function hideAllChars() { Object.keys(state.chars).forEach(hideChar); }
  function setFocus(who) {
    charLayer.querySelectorAll('.char').forEach((el) => {
      el.classList.toggle('dim', !!who && el.dataset.who !== who);
      el.classList.remove('talk');
    });
  }
  function talkBounce(who) {
    const el = charLayer.querySelector('[data-who="' + who + '"]');
    if (el) { el.classList.remove('talk'); void el.offsetWidth; el.classList.add('talk'); }
  }

  /* ---------------- 演出 ---------------- */
  let fxMode = 'none';
  function setFX(id) {
    state.fx = id;
    if (id === 'petals') { fxMode = 'petals'; }
    else if (id === 'rain') { fxMode = 'rain'; Audio.startRain(); }
    else if (id === 'heartbeat') { Audio.startHeartbeat(); }
    else if (id === 'flash') {
      flashEl.style.opacity = '0.9';
      setTimeout(() => { flashEl.style.opacity = '0'; }, 70);
    } else if (id === 'shake') {
      shakeWrap.classList.remove('shake'); void shakeWrap.offsetWidth; shakeWrap.classList.add('shake');
    } else { // none
      fxMode = 'none'; Audio.stopRain(); Audio.stopHeartbeat();
    }
  }
  function playAmbient(id) {
    if (id === 'wind') { Audio.stopRain(); Audio.startWind(); state.ambient = 'wind'; }
    else if (id === 'rain') { Audio.stopWind(); Audio.startRain(); state.ambient = 'rain'; }
    else { Audio.playSE(id); }
  }

  /* 花びら・雨パーティクル */
  const fxCtx = fxCanvas.getContext('2d');
  const petals = [], drops = [];
  function newPetal(any) {
    return { x: Math.random() * 1280, y: any ? Math.random() * 720 : -20,
             s: 5 + Math.random() * 7, a: Math.random() * Math.PI * 2,
             spin: (Math.random() - 0.5) * 0.05, vy: 0.6 + Math.random() * 1.1, ph: Math.random() * Math.PI * 2 };
  }
  for (let i = 0; i < 45; i++) petals.push(newPetal(true));
  for (let i = 0; i < 130; i++) drops.push({ x: Math.random() * 1400, y: Math.random() * 720, len: 10 + Math.random() * 14, sp: 9 + Math.random() * 8 });
  (function fxLoop() {
    requestAnimationFrame(fxLoop);
    fxCtx.clearRect(0, 0, 1280, 720);
    if (fxMode === 'petals') {
      petals.forEach((p) => {
        p.y += p.vy; p.x += Math.sin(p.ph += 0.01) * 0.8; p.a += p.spin;
        if (p.y > 740) Object.assign(p, newPetal(false));
        fxCtx.save(); fxCtx.translate(p.x, p.y); fxCtx.rotate(p.a);
        fxCtx.fillStyle = 'rgba(255,183,213,0.75)';
        fxCtx.beginPath(); fxCtx.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, Math.PI * 2); fxCtx.fill();
        fxCtx.restore();
      });
    } else if (fxMode === 'rain') {
      fxCtx.strokeStyle = 'rgba(170,195,255,0.45)'; fxCtx.lineWidth = 1; fxCtx.beginPath();
      drops.forEach((d) => {
        d.y += d.sp; d.x -= 1.2;
        if (d.y > 720) { d.y = -20; d.x = Math.random() * 1400; }
        fxCtx.moveTo(d.x, d.y); fxCtx.lineTo(d.x + 2, d.y + d.len);
      });
      fxCtx.stroke();
    }
  })();

  /* パララックス */
  let px = 0, py = 0, tx = 0, ty = 0;
  stage.addEventListener('mousemove', (e) => {
    const r = stage.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
  });
  (function parLoop() {
    requestAnimationFrame(parLoop);
    px += (tx - px) * 0.04; py += (ty - py) * 0.04;
    bgLayer.style.transform = 'translate(' + (px * 10) + 'px,' + (py * 6) + 'px)';
    charLayer.style.transform = 'translate(' + (px * -6) + 'px,' + (py * -3) + 'px)';
  })();

  /* ---------------- テキスト表示 ---------------- */
  function displayLine(s) {
    state.typing = true; state.fullText = s.text; state.who = s.who || null;
    if (s.t === 'say') {
      const ch = CHARACTERS[s.who];
      namePlate.classList.remove('empty');
      nameText.textContent = ch.name; nameText.style.color = ch.color;
    } else {
      namePlate.classList.add('empty');
    }
    textBody.className = s.t === 'narr' ? 'narr' : (s.t === 'mono' ? 'mono' : '');
    textSpan.textContent = ''; nextIndicator.classList.remove('on');
    setFocus(s.t === 'say' ? s.who : null);
    if (s.t === 'say') talkBounce(s.who);
    state.backlog.push({
      name: s.t === 'say' ? CHARACTERS[s.who].name : '',
      color: s.t === 'say' ? CHARACTERS[s.who].color : '',
      text: s.text, kind: s.t
    });
    if (state.backlog.length > 120) state.backlog.shift();
    state.lastLine = { who: s.who || null, text: s.text, kind: s.t };
    autosave();
    let i = 0;
    const interval = Math.max(8, 110 - config.textSpeed * 18);
    clearInterval(state.typeTimer);
    state.typeTimer = setInterval(() => {
      i++;
      textSpan.textContent = s.text.slice(0, i);
      if (config.voiceOn && s.t === 'say' && i % 2 === 0) Audio.voiceBlip(CHARACTERS[s.who].voice);
      if (i >= s.text.length) completeType();
    }, interval);
  }
  function completeType() {
    if (!state.typing) return;
    clearInterval(state.typeTimer);
    state.typing = false;
    textSpan.textContent = state.fullText;
    nextIndicator.classList.add('on');
    if (state.auto) scheduleAuto();
  }

  /* ---------------- 進行 ---------------- */
  function run() {
    cancelAuto();
    while (state.step < SCRIPT.length) {
      const s = SCRIPT[state.step++];
      switch (s.t) {
        case 'bg': setBG(s.id); break;
        case 'bgm': if (s.id === 'none') Audio.stopBGM(); else Audio.playBGM(s.id); break;
        case 'se': playAmbient(s.id); break;
        case 'fx': setFX(s.id); break;
        case 'show': showChar(s.who, s.pos); break;
        case 'hide': hideChar(s.who); break;
        case 'hideAll': hideAllChars(); break;
        case 'set': state.flags[s.flag] = true; break;
        case 'label': break;
        case 'jump': if (!s.cond || state.flags[s.cond]) state.step = labelMap[s.id]; break;
        case 'say': case 'narr': case 'mono': displayLine(s); return;
        case 'cg': showCG(s.id); return;
        case 'choice': showChoice(s); return;
        case 'chapter': showChapter(s); return;
        case 'end': showEnding(s.ending); return;
      }
    }
  }
  function advance() {
    if (uiMode !== 'game' || modalOpen || choiceOpen || endingOpen) return;
    if (chapterOpen) { hideChapter(); return; }
    if (cgOpen) { closeCG(); return; }
    if (state.typing) { completeType(); return; }
    Audio.playSE('click');
    run();
  }

  /* ---------------- 章タイトル ---------------- */
  function showChapter(s) {
    chapterOpen = true; state.chapter = s.title;
    chapterTitle.textContent = s.title; chapterSub.textContent = s.sub || '';
    chapterCard.classList.add('on'); textBox.classList.add('hide');
    state.chapterTimer = setTimeout(hideChapter, state.skip ? 700 : 2800);
  }
  function hideChapter() {
    if (!chapterOpen) return;
    clearTimeout(state.chapterTimer);
    chapterOpen = false;
    chapterCard.classList.remove('on'); textBox.classList.remove('hide');
    run();
  }

  /* ---------------- CG ---------------- */
  function unlockCG(id) {
    let arr = [];
    try { arr = JSON.parse(localStorage.getItem('sakura_cg') || '[]'); } catch (e) {}
    if (!arr.includes(id)) { arr.push(id); try { localStorage.setItem('sakura_cg', JSON.stringify(arr)); } catch (e) {} }
  }
  function showCG(id) {
    const cg = CGS[id];
    if (!cg) { run(); return; }
    cgOpen = true;
    cgImg.src = cg.img; cgCaption.textContent = cg.cap || '';
    cgLayer.classList.add('on'); textBox.classList.add('hide');
    unlockCG(id); Audio.playSE('chime');
    if (state.skip) state.cgTimer = setTimeout(closeCG, 900);
  }
  function closeCG() {
    if (!cgOpen) return;
    clearTimeout(state.cgTimer);
    cgOpen = false;
    cgLayer.classList.remove('on'); textBox.classList.remove('hide');
    run();
  }

  /* ---------------- 選択肢 ---------------- */
  function showChoice(s) {
    choiceOpen = true; setSkip(false);
    choiceLayer.innerHTML = '';
    s.options.forEach((opt) => {
      const b = document.createElement('button');
      b.className = 'choiceBtn'; b.textContent = opt.text;
      b.onclick = (e) => {
        e.stopPropagation();
        Audio.playSE('chime');
        choiceOpen = false; choiceLayer.classList.remove('on');
        state.step = labelMap[opt.goto];
        run();
      };
      choiceLayer.appendChild(b);
    });
    choiceLayer.classList.add('on');
  }

  /* ---------------- エンディング ---------------- */
  function buildStaff(kind) {
    const endName = kind === 'true' ? 'TRUE END ―桜色の約束―' : 'NORMAL END ―桜色の約束―';
    staffInner.innerHTML =
      '<div class="stTitle">桜色の約束</div><div class="stSub">―君と過ごす、最後の春―</div>' +
      '<div class="stRole">ENDING</div><div class="stName">' + endName + '</div>' +
      '<div class="stRole">シナリオ・演出</div><div class="stName">Sakura Project</div>' +
      '<div class="stRole">キャラクターデザイン</div><div class="stName">AI Illustration</div>' +
      '<div class="stRole">背景・イベントCG</div><div class="stName">AI Illustration</div>' +
      '<div class="stRole">音楽・効果音</div><div class="stName">WebAudio 生成サウンド</div>' +
      '<div class="stRole">プログラム</div><div class="stName">Web Novel Engine</div>' +
      '<div class="stThanks">Thank you for playing</div>' +
      '<div class="stRole">――桜は、今年も咲いている――</div>';
    staffInner.style.animation = 'none'; void staffInner.offsetWidth; staffInner.style.animation = '';
  }
  function showEnding(kind) {
    setSkip(false); cancelAuto();
    endingOpen = true; textBox.classList.add('hide');
    fadeBlack.classList.add('on');
    setTimeout(() => {
      buildStaff(kind);
      endingScreen.classList.add('on');
      fadeBlack.classList.remove('on');
      Audio.playBGM(kind === 'true' ? 'hopeful' : 'sad');
      setFX('none');
      try { localStorage.setItem(kind === 'true' ? 'sakura_clear_true' : 'sakura_clear_normal', '1'); } catch (e) {}
      setTimeout(() => btnToTitle.classList.add('on'), 2500);
    }, 1000);
  }
  btnToTitle.onclick = (e) => {
    e.stopPropagation();
    endingOpen = false;
    endingScreen.classList.remove('on'); btnToTitle.classList.remove('on');
    showTitle();
  };

  /* ---------------- セーブ / ロード ---------------- */
  function serialize() {
    return { step: state.step, flags: state.flags, bg: state.bg, chars: state.chars,
             backlog: state.backlog, chapter: state.chapter, lastLine: state.lastLine,
             fx: state.fx, ambient: state.ambient, time: Date.now() };
  }
  function makeThumb() {
    try {
      const img = bgA.classList.contains('on') ? bgA : bgB;
      const cv = document.createElement('canvas'); cv.width = 320; cv.height = 180;
      const ctx = cv.getContext('2d');
      const iw = img.naturalWidth || 1280, ih = img.naturalHeight || 720;
      const scale = Math.max(320 / iw, 180 / ih);
      const w = iw * scale, h = ih * scale;
      ctx.drawImage(img, (320 - w) / 2, (180 - h) / 2, w, h);
      return cv.toDataURL('image/jpeg', 0.6);
    } catch (e) { return ''; }
  }
  function saveTo(slot) {
    try {
      const d = serialize(); d.thumb = makeThumb();
      localStorage.setItem('sakura_save_' + slot, JSON.stringify(d));
    } catch (e) { toast('セーブに失敗しました'); }
  }
  function readSlot(slot) {
    try { const s = localStorage.getItem('sakura_save_' + slot); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  }
  function autosave() { try { localStorage.setItem('sakura_autosave', JSON.stringify(serialize())); } catch (e) {} }
  function loadFrom(slot) { const d = readSlot(slot); if (d) restore(d); }
  function loadAutosave() {
    try { const s = localStorage.getItem('sakura_autosave'); if (s) restore(JSON.parse(s)); } catch (e) {}
  }
  function restore(d) {
    state.step = d.step || 0; state.flags = d.flags || {}; state.backlog = d.backlog || [];
    state.chapter = d.chapter || ''; state.lastLine = d.lastLine || null;
    setBG(d.bg || 'station', true);
    charLayer.innerHTML = ''; state.chars = {};
    Object.entries(d.chars || {}).forEach(([who, pos]) => showChar(who, pos));
    setFX(d.fx || 'none');
    if (d.ambient === 'wind') { Audio.stopRain(); Audio.startWind(); state.ambient = 'wind'; }
    if (d.ambient === 'rain') { Audio.stopWind(); Audio.startRain(); state.ambient = 'rain'; }
    hideTitle();
    if (state.lastLine) {
      const ll = state.lastLine;
      state.typing = false;
      if (ll.kind === 'say') {
        const ch = CHARACTERS[ll.who];
        namePlate.classList.remove('empty');
        nameText.textContent = ch.name; nameText.style.color = ch.color;
      } else { namePlate.classList.add('empty'); }
      textBody.className = ll.kind === 'narr' ? 'narr' : (ll.kind === 'mono' ? 'mono' : '');
      textSpan.textContent = ll.text; nextIndicator.classList.add('on');
      setFocus(ll.kind === 'say' ? ll.who : null);
    }
  }

  /* ---------------- オート / スキップ ---------------- */
  function scheduleAuto() {
    cancelAuto();
    state.autoTimer = setTimeout(() => { if (state.auto && !state.typing) advance(); }, config.autoDelay);
  }
  function cancelAuto() { clearTimeout(state.autoTimer); }
  function setAuto(on) {
    state.auto = on;
    $('btnAuto').classList.toggle('active', on);
    if (!on) cancelAuto();
  }
  function setSkip(on) {
    state.skip = on;
    $('btnSkip').classList.toggle('active', on);
    clearInterval(state.skipTimer);
    if (on) {
      state.skipTimer = setInterval(() => {
        if (modalOpen || choiceOpen || endingOpen || chapterOpen || cgOpen) return;
        if (state.typing) completeType(); else run();
      }, 60);
    }
  }

  /* ---------------- モーダル ---------------- */
  function openModal(html) {
    modalLayer.innerHTML = '<div class="modalBox">' + html + '</div>';
    modalLayer.classList.add('on'); modalOpen = true;
    const c = modalLayer.querySelector('.modalClose');
    if (c) c.onclick = (e) => { e.stopPropagation(); closeModal(); };
  }
  function closeModal() { modalLayer.classList.remove('on'); modalLayer.innerHTML = ''; modalOpen = false; }
  modalLayer.addEventListener('click', (e) => { if (e.target === modalLayer) closeModal(); });

  function escapeHtml(s) {
    return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function openSaveLoad(mode) {
    let html = '<button class="modalClose">閉じる</button><h2>' + (mode === 'save' ? 'セーブ' : 'ロード') + '</h2><div class="slotGrid">';
    for (let i = 1; i <= 8; i++) {
      const d = readSlot(i);
      html += '<div class="slot">';
      html += (d && d.thumb) ? '<img src="' + d.thumb + '">' : '<img>';
      html += '<div class="info">';
      if (d) {
        html += '<div class="date">' + new Date(d.time).toLocaleString('ja-JP') + '</div>' +
                '<div class="chap">' + escapeHtml(d.chapter || '') + '</div>' +
                '<div class="line">' + escapeHtml(d.lastLine ? d.lastLine.text : '') + '</div>';
      } else {
        html += '<div class="emptySlot">―― 空きスロット ――</div>';
      }
      html += '</div><div class="ops">';
      if (mode === 'save') html += '<button class="miniBtn" data-act="save" data-slot="' + i + '">保存</button>';
      else html += '<button class="miniBtn" data-act="load" data-slot="' + i + '"' + (d ? '' : ' disabled') + '>読込</button>';
      if (d) html += '<button class="miniBtn" data-act="del" data-slot="' + i + '">削除</button>';
      html += '</div></div>';
    }
    html += '</div>';
    openModal(html);
    modalLayer.querySelectorAll('[data-act]').forEach((b) => {
      b.onclick = (e) => {
        e.stopPropagation();
        const slot = +b.dataset.slot, act = b.dataset.act;
        if (act === 'save') { saveTo(slot); Audio.playSE('chime'); toast('セーブしました'); openSaveLoad('save'); }
        if (act === 'load') { loadFrom(slot); closeModal(); toast('ロードしました'); }
        if (act === 'del') { try { localStorage.removeItem('sakura_save_' + slot); } catch (err) {} openSaveLoad(mode); }
      };
    });
  }

  function openBacklog() {
    let html = '<button class="modalClose">閉じる</button><h2>バックログ</h2><div class="backlogList">';
    if (!state.backlog.length) html += '<div class="emptySlot">まだログがありません</div>';
    state.backlog.forEach((b) => {
      html += '<div class="blItem ' + b.kind + '">' +
        (b.name ? '<div class="blName" style="color:' + b.color + '">' + escapeHtml(b.name) + '</div>' : '') +
        '<div class="blText">' + escapeHtml(b.text) + '</div></div>';
    });
    html += '</div>';
    openModal(html);
  }

  function openConfig() {
    openModal(
      '<button class="modalClose">閉じる</button><h2>設定</h2>' +
      '<div class="cfgRow"><label>テキスト速度</label><input type="range" id="cfgText" min="1" max="5" step="1" value="' + config.textSpeed + '"><span class="val" id="cfgTextV">' + config.textSpeed + '</span></div>' +
      '<div class="cfgRow"><label>オート待ち時間</label><input type="range" id="cfgAuto" min="500" max="4000" step="100" value="' + config.autoDelay + '"><span class="val" id="cfgAutoV">' + config.autoDelay + '</span></div>' +
      '<div class="cfgRow"><label>BGM音量</label><input type="range" id="cfgBgm" min="0" max="100" value="' + Math.round(config.bgm * 100) + '"><span class="val" id="cfgBgmV">' + Math.round(config.bgm * 100) + '</span></div>' +
      '<div class="cfgRow"><label>SE音量</label><input type="range" id="cfgSe" min="0" max="100" value="' + Math.round(config.se * 100) + '"><span class="val" id="cfgSeV">' + Math.round(config.se * 100) + '</span></div>' +
      '<div class="cfgRow"><label>ボイス音量</label><input type="range" id="cfgVoice" min="0" max="100" value="' + Math.round(config.voice * 100) + '"><span class="val" id="cfgVoiceV">' + Math.round(config.voice * 100) + '</span></div>' +
      '<div class="cfgRow"><label>ボイス（ビープ音）</label><input type="checkbox" id="cfgVoiceOn"' + (config.voiceOn ? ' checked' : '') + '></div>'
    );
    const bind = (id, vid, fn) => {
      const el = $(id);
      el.oninput = () => { fn(+el.value); $(vid).textContent = el.value; saveConfig(); };
    };
    bind('cfgText', 'cfgTextV', (v) => { config.textSpeed = v; });
    bind('cfgAuto', 'cfgAutoV', (v) => { config.autoDelay = v; });
    bind('cfgBgm', 'cfgBgmV', (v) => { config.bgm = v / 100; Audio.setVolumes(config); });
    bind('cfgSe', 'cfgSeV', (v) => { config.se = v / 100; Audio.setVolumes(config); });
    bind('cfgVoice', 'cfgVoiceV', (v) => { config.voice = v / 100; Audio.setVolumes(config); });
    $('cfgVoiceOn').onchange = (e) => { config.voiceOn = e.target.checked; saveConfig(); };
  }

  function openGallery() {
    let unlocked = [];
    try { unlocked = JSON.parse(localStorage.getItem('sakura_cg') || '[]'); } catch (e) {}
    let html = '<button class="modalClose">閉じる</button><h2>ギャラリー</h2><div class="galGrid">';
    Object.keys(CGS).forEach((id) => {
      const un = unlocked.includes(id);
      html += '<div class="galItem' + (un ? '' : ' locked') + '" data-cg="' + id + '">' +
              '<img src="' + CGS[id].img + '"><div class="galCap">' + (un ? escapeHtml(CGS[id].cap) : '???') + '</div></div>';
    });
    html += '</div>';
    openModal(html);
    modalLayer.querySelectorAll('.galItem').forEach((el) => {
      el.onclick = (e) => {
        e.stopPropagation();
        const id = el.dataset.cg;
        if (!unlocked.includes(id)) { toast('まだ解放されていません'); return; }
        openModal('<button class="modalClose">閉じる</button><h2>' + escapeHtml(CGS[id].cap) + '</h2><img src="' + CGS[id].img + '" style="width:100%;border-radius:5px;">');
      };
    });
  }

  /* ---------------- トースト ---------------- */
  let toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg; toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('on'), 1800);
  }

  /* ---------------- タイトル ---------------- */
  function updateTitleMenu() {
    $('menuContinue').disabled = !localStorage.getItem('sakura_autosave');
    const t = localStorage.getItem('sakura_clear_true'), n = localStorage.getItem('sakura_clear_normal');
    clearBadge.textContent = (t && n) ? 'TRUE END ＆ NORMAL END CLEAR' : (t ? 'TRUE END CLEAR' : (n ? 'NORMAL END CLEAR' : ''));
  }
  function showTitle() {
    uiMode = 'title';
    clearInterval(state.typeTimer); state.typing = false;
    cancelAuto(); setSkip(false); setAuto(false);
    titleScreen.classList.remove('hide');
    textBox.classList.add('hide');
    titleBg.src = BGS.sakura;
    setFX('petals');
    Audio.stopRain(); Audio.stopWind(); Audio.stopHeartbeat();
    Audio.playBGM('title');
    updateTitleMenu();
  }
  function hideTitle() {
    uiMode = 'game';
    titleScreen.classList.add('hide');
    textBox.classList.remove('hide');
  }
  function resetState() {
    state.step = 0; state.flags = {}; state.backlog = []; state.chars = {};
    state.lastLine = null; state.chapter = '';
    charLayer.innerHTML = ''; textSpan.textContent = ''; namePlate.classList.add('empty');
    setBG('station', true); setFX('none');
    Audio.stopRain(); Audio.stopWind(); Audio.stopHeartbeat();
  }
  function startNewGame() { resetState(); hideTitle(); run(); }
  function confirmNewGame() {
    if (!localStorage.getItem('sakura_autosave')) { startNewGame(); return; }
    openModal('<div class="confirmBox"><h2>はじめから</h2>' +
      '<p>オートセーブが上書きされます。<br>本当に最初から始めますか？</p>' +
      '<div class="row"><button class="bigBtn" id="cfYes">はい</button><button class="bigBtn ghost" id="cfNo">キャンセル</button></div></div>');
    $('cfYes').onclick = (e) => { e.stopPropagation(); closeModal(); startNewGame(); };
    $('cfNo').onclick = (e) => { e.stopPropagation(); closeModal(); };
  }

  $('menuNew').onclick = (e) => { e.stopPropagation(); Audio.init(); Audio.setVolumes(config); confirmNewGame(); };
  $('menuContinue').onclick = (e) => { e.stopPropagation(); Audio.init(); Audio.setVolumes(config); loadAutosave(); };
  $('menuLoad').onclick = (e) => { e.stopPropagation(); Audio.init(); Audio.setVolumes(config); openSaveLoad('load'); };
  $('menuConfig').onclick = (e) => { e.stopPropagation(); Audio.init(); Audio.setVolumes(config); openConfig(); };
  $('menuGallery').onclick = (e) => { e.stopPropagation(); Audio.init(); Audio.setVolumes(config); openGallery(); };

  /* ---------------- システムバー ---------------- */
  function bindSys(id, fn) {
    $(id).onclick = (e) => { e.stopPropagation(); if (uiMode !== 'game') return; fn(); };
  }
  bindSys('btnSave', () => { Audio.playSE('click'); openSaveLoad('save'); });
  bindSys('btnLoad', () => { Audio.playSE('click'); openSaveLoad('load'); });
  bindSys('btnAuto', () => { Audio.playSE('click'); setAuto(!state.auto); });
  bindSys('btnSkip', () => { Audio.playSE('click'); setSkip(!state.skip); });
  bindSys('btnBacklog', () => { Audio.playSE('click'); openBacklog(); });
  bindSys('btnConfig', () => { Audio.playSE('click'); openConfig(); });
  bindSys('btnTitle', () => { Audio.playSE('click'); showTitle(); });
  bindSys('btnFull', () => { toggleFull(); });

  function toggleFull() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  }

  /* ---------------- 入力 ---------------- */
  stage.addEventListener('click', () => {
    Audio.init();
    if (modalOpen || choiceOpen || endingOpen || uiMode !== 'game') return;
    advance();
  });
  document.addEventListener('pointerdown', () => {
    Audio.init(); Audio.setVolumes(config);
    if (uiMode === 'title' && !Audio.track) Audio.playBGM('title');
  });
  document.addEventListener('keydown', (e) => {
    Audio.init();
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (!modalOpen) advance(); }
    if (e.code === 'Escape' && modalOpen) closeModal();
    if (e.code === 'KeyF') toggleFull();
    if ((e.code === 'ControlLeft' || e.code === 'ControlRight') && !e.repeat) setSkip(true);
  });
  document.addEventListener('keyup', (e) => {
    if (e.code === 'ControlLeft' || e.code === 'ControlRight') setSkip(false);
  });

  /* ---------------- 初期化 ---------------- */
  preload();
  showTitle();
})();
