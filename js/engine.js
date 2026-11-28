/* ============================================================
   engine.js — 『灯りの向こう側』ビジュアルノベル・ランタイム
   1280x720固定ステージ / タイプライター / 分岐 / セーブ / ギャラリー
   ============================================================ */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const stage = $('stage');
  const bgA = $('bg-a'), bgB = $('bg-b'), bgTint = $('bg-tint');
  const fxCanvas = $('fx-canvas'), fx = fxCanvas.getContext('2d');
  const boot = $('boot-screen'), bootFill = $('boot-fill');
  const titleScreen = $('title-screen'), gameUI = $('game-ui');
  const dialogueBox = $('dialogue-box'), nameText = $('name-text'), dialogueText = $('dialogue-text');
  const choiceBox = $('choice-box'), nextIndicator = $('next-indicator');
  const chapterCard = $('chapter-card'), chapterTitle = $('chapter-title'), chapterSub = $('chapter-sub');
  const endingCard = $('ending-card');
  const modal = $('modal'), modalTitle = $('modal-title'), modalBody = $('modal-body'), modalClose = $('modal-close');
  const fade = $('fade'), flash = $('flash');
  const bgEls = { a:bgA, b:bgB };
  const slots = { left:$('slot-left'), center:$('slot-center'), right:$('slot-right') };
  const SAVE_PREFIX = 'sakura-kobo-save-';
  const GALLERY_KEY = 'sakura-kobo-gallery';
  const bgFallback = { music:'classroom' };
  const state = {
    nodeId:null, actionIndex:0, flags:{yukino:0,mio:0,promise:0,memory:0,truth:0},
    history:[], charas:{left:null,center:null,right:null}, currentBg:'title', currentTint:'',
    resume:null, ending:false, auto:false, skip:false
  };
  let activeBg = 'a', waiting = false, busy = false;
  let typing = false, typedTimer = null, typedFull = '', typedPos = 0;
  let autoTimer = null, choiceIndex = 0, titleIndex = 0, bootDone = false;
  let fxMode = null, fxUntil = 0, particles = [];

  /* ---------- ステージ・初期化 ---------- */
  function resizeStage() {
    const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 720);
    stage.style.transform = `scale(${Math.max(.35, scale)})`;
  }
  window.addEventListener('resize', resizeStage);

  function init() {
    resizeStage();
    setBackground('title', '', true);
    bindUI();
    runBoot();
    requestAnimationFrame(drawFX);
  }

  function runBoot() {
    let progress = 0;
    const timer = setInterval(() => {
      progress += Math.random() * 18 + 8;
      if (progress >= 100) { progress = 100; clearInterval(timer); }
      bootFill.style.width = `${progress}%`;
      if (progress >= 100) {
        setTimeout(() => {
          bootDone = true;
          boot.classList.add('hidden');
          updateContinueButton();
        }, 420);
      }
    }, 120);
  }

  function bindUI() {
    document.querySelectorAll('.title-btn').forEach((btn, i) => {
      btn.addEventListener('click', () => titleAction(btn.dataset.act));
      btn.addEventListener('mouseenter', () => { titleIndex = i; updateTitleFocus(); });
    });
    $('btn-save').addEventListener('click', () => openSaves('save'));
    $('btn-load').addEventListener('click', () => openSaves('load'));
    $('btn-backlog').addEventListener('click', openBacklog);
    $('btn-auto').addEventListener('click', toggleAuto);
    $('btn-skip').addEventListener('click', toggleSkip);
    $('btn-config').addEventListener('click', openConfig);
    $('btn-title').addEventListener('click', () => {
      if (window.confirm('タイトル画面に戻りますか？\n現在の進行はセーブされません。')) showTitle();
    });
    modalClose.addEventListener('click', closeModal);
    $('ending-button').addEventListener('click', showTitle);
    stage.addEventListener('click', e => {
      if (e.target.closest('button, input, select, #modal, #choice-box')) return;
      if (!titleScreen.classList.contains('hidden') || bootDone === false) return;
      if (!choiceBox.classList.contains('hidden')) return;
      advance();
    });
    document.addEventListener('keydown', onKey);
  }

  function onKey(e) {
    if (!bootDone) return;
    if (!modal.classList.contains('hidden')) {
      if (e.key === 'Escape') closeModal();
      return;
    }
    if (!titleScreen.classList.contains('hidden')) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); titleIndex = (titleIndex + 1) % 4; updateTitleFocus(); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); titleIndex = (titleIndex + 3) % 4; updateTitleFocus(); }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const acts = ['new','continue','gallery','config']; titleAction(acts[titleIndex]); }
      return;
    }
    if (!choiceBox.classList.contains('hidden')) {
      const buttons = [...choiceBox.querySelectorAll('.choice-btn')];
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); choiceIndex = (choiceIndex + 1) % buttons.length; updateChoiceFocus(); }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); choiceIndex = (choiceIndex + buttons.length - 1) % buttons.length; updateChoiceFocus(); }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); buttons[choiceIndex]?.click(); }
      return;
    }
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); advance(); }
    if (e.key.toLowerCase() === 'a') toggleAuto();
    if (e.key.toLowerCase() === 's') toggleSkip();
    if (e.key.toLowerCase() === 'b') openBacklog();
  }

  function updateTitleFocus() {
    document.querySelectorAll('.title-btn').forEach((b,i) => b.classList.toggle('focus', i === titleIndex));
  }
  function updateContinueButton() {
    const btn = document.querySelector('[data-act="continue"]');
    if (btn) btn.classList.toggle('disabled', !hasSave());
  }
  function titleAction(act) {
    AudioSys.init();
    AudioSys.click();
    if (act === 'new') startNew();
    if (act === 'continue') { const slot = latestSave(); slot ? loadData(slot) : openNotice('つづきから', 'セーブデータがありません。\n「はじめから」で物語を始めてください。'); }
    if (act === 'gallery') openGallery();
    if (act === 'config') openConfig();
  }

  /* ---------- 背景 / キャラクター ---------- */
  function setBackground(name, tint = '', instant = false) {
    const actual = bgFallback[name] || name;
    const targetKey = activeBg === 'a' ? 'b' : 'a';
    const target = bgEls[targetKey], other = bgEls[activeBg];
    const url = `assets/bg/${actual}.jpg`;
    target.style.backgroundImage = `url("${url}")`;
    target.classList.add('on');
    if (instant) {
      other.classList.remove('on');
      activeBg = targetKey;
    } else {
      setTimeout(() => other.classList.remove('on'), 80);
      activeBg = targetKey;
    }
    bgTint.className = '';
    if (tint) bgTint.classList.add(tint);
    state.currentBg = name; state.currentTint = tint;
  }

  function slotFor(pos) { return slots[pos || 'center'] || slots.center; }
  function setCharacter(id, pos = 'center', pose = 'normal', dim = false) {
    const slot = slotFor(pos), front = slot.querySelector('.front'), back = slot.querySelector('.back');
    const safePose = pose || 'normal';
    const src = `assets/chara/${id}_${safePose}_t.png`;
    const current = state.charas[pos];
    // 表情差分がまだ生成されていない場合は通常立ち絵へフォールバック
    back.onerror = () => { back.onerror = null; back.src = `assets/chara/${id}_normal_t.png`; };
    back.onload = () => {
      back.style.opacity = '1'; front.style.opacity = '0';
      setTimeout(() => { front.src = back.src; front.style.opacity = '1'; back.style.opacity = '0'; }, 470);
    };
    if (!current || current.id !== id || current.pose !== safePose) {
      back.style.opacity = '0';
      back.src = src;
    } else {
      slot.classList.add('show');
    }
    slot.dataset.chara = id;
    slot.classList.add('show');
    slot.classList.toggle('dim', !!dim);
    state.charas[pos] = {id, pos, pose:safePose, dim:!!dim, visible:true};
  }
  function hideCharacter(pos) {
    if (pos) {
      const slot = slotFor(pos); slot.classList.remove('show'); delete state.charas[pos];
    } else {
      Object.keys(slots).forEach(p => slots[p].classList.remove('show'));
      state.charas = {left:null,center:null,right:null};
    }
  }
  function focusCharacter(id) {
    Object.entries(slots).forEach(([pos, slot]) => {
      if (!slot.classList.contains('show')) return;
      slot.classList.toggle('dim', !!id && slot.dataset.chara !== id);
    });
  }
  function restoreCharacters(data) {
    hideCharacter();
    Object.entries(data || {}).forEach(([pos, ch]) => { if (ch && ch.id) setCharacter(ch.id, pos, ch.pose, ch.dim); });
  }

  /* ---------- シナリオ実行 ---------- */
  function resetState() {
    state.nodeId = Scenario.start; state.actionIndex = 0;
    state.flags = {yukino:0,mio:0,promise:0,memory:0,truth:0}; state.history = [];
    state.charas = {left:null,center:null,right:null}; state.currentBg = 'title'; state.currentTint = '';
    state.resume = null; state.ending = false; state.auto = false; state.skip = false;
    waiting = false; busy = false; typing = false;
    if (autoTimer) clearTimeout(autoTimer);
    AudioSys.stopVoice();
    hideCharacter();
    dialogueBox.classList.remove('hidden'); choiceBox.classList.add('hidden'); chapterCard.classList.add('hidden'); endingCard.classList.add('hidden');
    $('auto-indicator').classList.add('hidden');
  }
  function startNew() {
    resetState();
    titleScreen.classList.add('hidden'); gameUI.classList.remove('hidden');
    AudioSys.init();
    processActions();
  }
  function processActions() {
    if (busy || waiting || state.ending) return;
    while (!busy && !waiting && !state.ending) {
      const actions = Scenario.nodes[state.nodeId];
      if (!actions || state.actionIndex >= actions.length) return;
      const action = actions[state.actionIndex++];
      state.resume = {nodeId:state.nodeId, index:state.actionIndex - 1};
      runAction(action);
    }
  }
  function runAction(a) {
    if (!a) return;
    switch (a.type) {
      case 'chapter': showChapter(a); break;
      case 'bg': setBackground(a.name, a.tint || '', false); break;
      case 'music': AudioSys.playBGM(a.mood); break;
      case 'sfx': playSFX(a.name); break;
      case 'char': setCharacter(a.id, a.pos, a.pose, a.dim); break;
      case 'hide': hideCharacter(a.pos); break;
      case 'flag':
      case 'set': Object.assign(state.flags, a.set || {}); break;
      case 'effect': runEffect(a.name); break;
      case 'delay': busy = true; setTimeout(() => { busy = false; processActions(); }, a.ms || 500); break;
      case 'dialogue':
      case 'narration': showLine(a); break;
      case 'choice': showChoices(a); break;
      case 'jump': state.nodeId = a.to; state.actionIndex = 0; break;
      case 'branch': runBranch(a); break;
      case 'end': showEnding(a); break;
      default: break;
    }
  }
  function runBranch(a) {
    const found = (a.cases || []).find(c => evaluate(c.when));
    state.nodeId = found ? found.to : a.otherwise;
    state.actionIndex = 0;
  }
  function evaluate(condition) {
    if (!condition) return false;
    if (condition.all) return condition.all.every(evaluate);
    if (condition.any) return condition.any.some(evaluate);
    if (condition.key) {
      const value = state.flags[condition.key] || 0;
      if (condition.gte != null) return value >= condition.gte;
      if (condition.lte != null) return value <= condition.lte;
      if (condition.eq != null) return value === condition.eq;
      return !!value;
    }
    return false;
  }

  function showChapter(a) {
    dialogueBox.classList.add('hidden'); choiceBox.classList.add('hidden');
    chapterTitle.textContent = a.title || ''; chapterSub.textContent = a.sub || '';
    chapterCard.classList.remove('hidden');
    busy = true;
    AudioSys.pageSE();
    setTimeout(() => { chapterCard.classList.add('hidden'); busy = false; processActions(); }, 1750);
  }
  function showLine(a) {
    clearAuto();
    dialogueBox.classList.remove('hidden'); choiceBox.classList.add('hidden');
    nameText.textContent = a.speaker || '';
    if (a.chara) focusCharacter(a.chara);
    else focusCharacter(null);
    const clean = (a.text || '').trim();
    state.history.push({speaker:a.speaker || '', text:clean});
    if (state.history.length > 120) state.history.shift();
    state.resume = {nodeId:state.nodeId, index:state.actionIndex - 1};
    typedFull = clean; typedPos = 0; typing = true; waiting = true;
    dialogueText.textContent = '';
    nextIndicator.style.opacity = '0';
    if (a.chara) AudioSys.speak(clean, a.chara);
    const delay = state.skip ? 1 : 25;
    typedTimer = setInterval(() => {
      if (typedPos >= typedFull.length) { finishTyping(); return; }
      const ch = typedFull[typedPos++]; dialogueText.textContent += ch;
      if (!state.skip && /[^\s、。！？,.!?]/.test(ch) && typedPos % 5 === 0) AudioSys.blip(.018);
    }, delay);
  }
  function finishTyping() {
    if (!typing && typedPos >= typedFull.length) return;
    if (typedTimer) { clearInterval(typedTimer); typedTimer = null; }
    dialogueText.textContent = typedFull; typedPos = typedFull.length; typing = false;
    nextIndicator.style.opacity = '1';
    if (state.auto) {
      clearAuto(); autoTimer = setTimeout(() => { if (waiting && !state.ending) advance(); }, 1050);
    }
  }
  function showChoices(a) {
    clearAuto(); finishTyping();
    dialogueBox.classList.add('hidden'); choiceBox.classList.remove('hidden'); choiceBox.innerHTML = '';
    choiceIndex = 0; state.resume = {nodeId:state.nodeId, index:state.actionIndex - 1};
    (a.choices || []).forEach((c, i) => {
      const b = document.createElement('button'); b.className = 'choice-btn'; b.textContent = c.text;
      b.addEventListener('click', () => choose(c)); choiceBox.appendChild(b);
    });
    waiting = true; updateChoiceFocus();
  }
  function updateChoiceFocus() {
    [...choiceBox.querySelectorAll('.choice-btn')].forEach((b,i) => b.classList.toggle('focus', i === choiceIndex));
  }
  function choose(c) {
    if (!waiting) return;
    AudioSys.click(); clearAuto(); Object.assign(state.flags, c.set || {});
    waiting = false; choiceBox.classList.add('hidden');
    if (c.to) { state.nodeId = c.to; state.actionIndex = 0; }
    processActions();
  }
  function advance() {
    if (state.ending || busy || !choiceBox.classList.contains('hidden')) return;
    AudioSys.init();
    if (typing) { finishTyping(); return; }
    if (waiting) { waiting = false; AudioSys.pageSE(); processActions(); return; }
    processActions();
  }

  /* ---------- 演出 ---------- */
  function runEffect(name) {
    if (name === 'wind') launchFX('wind', 1450);
    if (name === 'sparkle') launchFX('sparkle', 2500);
    if (name === 'fade') {
      fade.classList.add('on'); busy = true;
      setTimeout(() => { busy = false; processActions(); }, 800);
    }
    if (name === 'flash') {
      AudioSys.flashSE(); flash.style.transition = 'none'; flash.style.opacity = '.8';
      setTimeout(() => { flash.style.transition = 'opacity .65s ease'; flash.style.opacity = '0'; fade.classList.remove('on'); }, 80);
      busy = true; setTimeout(() => { busy = false; processActions(); }, 700);
    }
    if (name === 'letterbox') {
      $('letterbox-top').classList.toggle('on'); $('letterbox-bottom').classList.toggle('on');
    }
  }
  function launchFX(mode, duration) {
    fxMode = mode; fxUntil = performance.now() + duration; particles = [];
    const count = mode === 'wind' ? 42 : 70;
    for (let i=0;i<count;i++) particles.push({x:Math.random()*1280,y:Math.random()*720,s:Math.random()*2+1,v:Math.random()*1.4+.4,a:Math.random()*Math.PI*2});
  }
  function drawFX(now) {
    fx.clearRect(0,0,1280,720);
    if (fxMode && now < fxUntil) {
      const remain = Math.min(1, (fxUntil-now)/600);
      particles.forEach(p => {
        if (fxMode === 'wind') {
          p.x += p.v * 7; p.y += Math.sin(now/480+p.a)*.35;
          if (p.x > 1320) p.x = -80;
          fx.strokeStyle = `rgba(255,244,238,${.13*remain})`; fx.lineWidth = p.s;
          fx.beginPath(); fx.moveTo(p.x,p.y); fx.lineTo(p.x+25+p.v*8,p.y-3); fx.stroke();
        } else {
          p.y += p.v*.3; p.x += Math.sin(now/800+p.a)*.15;
          if (p.y > 730) p.y=-10;
          fx.fillStyle = `rgba(255,221,236,${.35*remain})`; fx.beginPath(); fx.arc(p.x,p.y,p.s,0,Math.PI*2); fx.fill();
        }
      });
    } else if (fxMode) { fxMode = null; particles = []; }
    requestAnimationFrame(drawFX);
  }
  function playSFX(name) {
    if (name === 'page') AudioSys.pageSE();
    if (name === 'bell') AudioSys.bell();
    if (name === 'heartbeat') AudioSys.heartbeat();
    if (name === 'waves') AudioSys.loopNoise('waves');
    if (name === 'rain') AudioSys.loopNoise('rain');
  }

  /* ---------- オート / スキップ ---------- */
  function clearAuto() { if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; } }
  function toggleAuto() {
    state.auto = !state.auto; $('btn-auto').classList.toggle('active', state.auto); $('auto-indicator').classList.toggle('hidden', !state.auto);
    if (state.auto && waiting && !typing) { clearAuto(); autoTimer = setTimeout(advance, 700); }
  }
  function toggleSkip() {
    state.skip = !state.skip; $('btn-skip').classList.toggle('active', state.skip);
    if (state.skip && typing) finishTyping();
  }

  /* ---------- エンディング ---------- */
  function showEnding(a) {
    state.ending = true; waiting = false; busy = false; clearAuto(); AudioSys.stopVoice();
    dialogueBox.classList.add('hidden'); choiceBox.classList.add('hidden'); chapterCard.classList.add('hidden');
    $('ending-label').textContent = a.title && a.title.includes('TRUE') ? 'SPECIAL EPILOGUE' : 'EPILOGUE';
    $('ending-title').textContent = a.title || '';
    $('ending-sub').textContent = a.sub || '';
    $('ending-text').textContent = a.text || '';
    endingCard.classList.remove('hidden');
    const gallery = getGallery(); gallery[a.title] = true; localStorage.setItem(GALLERY_KEY, JSON.stringify(gallery));
    AudioSys.bell();
  }
  function showTitle() {
    state.ending = false; waiting = false; busy = false; clearAuto(); AudioSys.stopVoice(); AudioSys.stopBGM();
    gameUI.classList.add('hidden'); endingCard.classList.add('hidden'); chapterCard.classList.add('hidden');
    titleScreen.classList.remove('hidden'); setBackground('title','',true); updateContinueButton();
    try { AudioSys.playBGM('title'); } catch (e) {}
  }

  /* ---------- セーブ / ロード ---------- */
  function hasSave() { return [1,2,3].some(i => !!localStorage.getItem(SAVE_PREFIX+i)); }
  function latestSave() {
    let latest = null, time = 0;
    [1,2,3].forEach(i => { const raw=localStorage.getItem(SAVE_PREFIX+i); if (raw) { try { const d=JSON.parse(raw); if ((d.time||0)>time) {time=d.time||0; latest=d;} } catch(e){} } });
    return latest;
  }
  function makeSave(slot) {
    const data = {version:1, time:Date.now(), nodeId:state.nodeId, actionIndex:state.actionIndex,
      resume:state.resume, flags:state.flags, history:state.history.slice(-40), charas:state.charas,
      currentBg:state.currentBg, currentTint:state.currentTint};
    localStorage.setItem(SAVE_PREFIX+slot, JSON.stringify(data));
    AudioSys.bell(); openNotice('SAVE COMPLETE', `スロット ${slot} に保存しました。`);
    updateContinueButton();
  }
  function loadData(data) {
    if (!data) return;
    closeModal(); resetState(); titleScreen.classList.add('hidden'); gameUI.classList.remove('hidden');
    state.nodeId=data.nodeId || Scenario.start; state.actionIndex=data.resume ? data.resume.index : (data.actionIndex||0);
    state.resume=data.resume||null; state.flags=Object.assign(state.flags,data.flags||{}); state.history=data.history||[];
    state.currentBg=data.currentBg||'title'; state.currentTint=data.currentTint||'';
    setBackground(state.currentBg,state.currentTint,true); restoreCharacters(data.charas);
    processActions();
  }
  function openSaves(mode) {
    modalTitle.textContent = mode === 'save' ? 'SAVE DATA' : 'LOAD DATA';
    modalBody.innerHTML = '';
    [1,2,3].forEach(i => {
      const raw=localStorage.getItem(SAVE_PREFIX+i); let data=null;
      if (raw) { try { data=JSON.parse(raw); } catch(e){} }
      const row=document.createElement('div'); row.className='save-slot' + (data?'':' empty');
      const img=document.createElement('img'); img.src=data ? `assets/bg/${bgFallback[data.currentBg]||data.currentBg||'title'}.jpg` : 'assets/bg/title.jpg';
      const info=document.createElement('div'); info.className='slot-info';
      info.innerHTML = `<strong>SLOT ${i}</strong><br>${data ? formatDate(data.time)+'<br>'+nodeLabel(data.nodeId) : 'EMPTY SLOT'}`;
      row.append(img,info);
      if (data || mode === 'save') row.addEventListener('click', () => mode === 'save' ? makeSave(i) : loadData(data));
      modalBody.appendChild(row);
    });
    modal.classList.remove('hidden');
  }
  function formatDate(t) { return new Date(t).toLocaleString('ja-JP',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}); }
  function nodeLabel(id) {
    const chapter = {prologue:'序章　帰郷',day1:'第一章　潮風と記憶',lighthouse_first:'第二章　灯台の下で',night_town:'第三章　星のない夜',summer_plan:'第四章　七日間の名前',hospital_day:'最終章　灯りの向こう側'};
    return chapter[id] || id || '星波町の夏';
  }

  /* ---------- モーダル / ギャラリー / 設定 ---------- */
  function closeModal() { modal.classList.add('hidden'); }
  function openNotice(title, text) {
    modalTitle.textContent = title; modalBody.innerHTML = `<div style="white-space:pre-line; padding:28px 8px; text-align:center; line-height:2; color:#eee;">${escapeHTML(text)}</div>`; modal.classList.remove('hidden');
  }
  function openBacklog() {
    modalTitle.textContent = 'BACKLOG'; modalBody.innerHTML='';
    if (!state.history.length) modalBody.innerHTML='<div style="padding:30px;text-align:center;color:#999;">まだ記録はありません。</div>';
    state.history.forEach(line => { const d=document.createElement('div'); d.className='backlog-line'; d.innerHTML=`${line.speaker?`<span class="bl-name">${escapeHTML(line.speaker)}</span>`:''}${escapeHTML(line.text)}`; modalBody.appendChild(d); });
    modalBody.scrollTop=modalBody.scrollHeight; modal.classList.remove('hidden');
  }
  function openConfig() {
    modalTitle.textContent='CONFIG';
    modalBody.innerHTML=`
      <div class="config-row"><span>BGM VOLUME</span><input id="cfg-bgm" type="range" min="0" max="1" step=".05" value="${AudioSys.cfg.bgm}"></div>
      <div class="config-row"><span>SE VOLUME</span><input id="cfg-se" type="range" min="0" max="1" step=".05" value="${AudioSys.cfg.se}"></div>
      <div class="config-row"><span>VOICE</span><select id="cfg-voice"><option value="on">ON</option><option value="off">OFF</option></select></div>
      <div class="config-row"><span>TEXT SPEED</span><select id="cfg-speed"><option value="1">NORMAL</option><option value="1.5">FAST</option><option value="2">VERY FAST</option></select></div>`;
    $('cfg-voice').value=AudioSys.cfg.voice?'on':'off'; $('cfg-speed').value=AudioSys.cfg.voiceRate || 1;
    $('cfg-bgm').addEventListener('input',e=>{AudioSys.cfg.bgm=+e.target.value;AudioSys.setVolumes();});
    $('cfg-se').addEventListener('input',e=>{AudioSys.cfg.se=+e.target.value;AudioSys.setVolumes();});
    $('cfg-voice').addEventListener('change',e=>AudioSys.cfg.voice=e.target.value==='on');
    $('cfg-speed').addEventListener('change',e=>AudioSys.cfg.voiceRate=+e.target.value);
    modal.classList.remove('hidden');
  }
  function getGallery() { try { return JSON.parse(localStorage.getItem(GALLERY_KEY)||'{}'); } catch(e) { return {}; } }
  function openGallery() {
    const g=getGallery(); modalTitle.textContent='GALLERY'; modalBody.innerHTML='';
    const items=[['title','星波町・灯台','title'],['classroom','夏の教室','classroom'],['beach','七年前の浜辺','beach'],['shrine','桜の季節','shrine'],['night','星のない夜','night'],['station','帰りの駅','station'],['rooftop','屋上の風','rooftop'],['hospital','約束の日','hospital']];
    const grid=document.createElement('div'); grid.className='gallery-grid';
    items.forEach(([key,label,file])=>{ const d=document.createElement('div'); const unlocked=g[key]||key==='title'; d.className='gallery-item'+(unlocked?'':' locked'); d.innerHTML=`<img src="assets/bg/${file}.jpg" alt=""><div class="g-label">${unlocked?label:'？？？？？？'}</div>`; grid.appendChild(d); });
    [['ending_true','TRUE END'],['ending_mio','AFTER END'],['ending_normal','NORMAL END']].forEach(([key,label])=>{ const d=document.createElement('div'); const unlocked=!!g[label]; d.className='gallery-item'+(unlocked?'':' locked'); d.innerHTML=`<img src="assets/bg/${unlocked?'shrine':'title'}.jpg" alt=""><div class="g-label">${unlocked?label:'？？？？？？'}</div>`; grid.appendChild(d); });
    modalBody.appendChild(grid); modal.classList.remove('hidden');
  }
  function escapeHTML(s) { return String(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  init();
})();
