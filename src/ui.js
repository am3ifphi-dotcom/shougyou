import {
  GAME_TITLE, GAME_SUBTITLE, CHARACTERS, MUSIC, GALLERY, ENDINGS,
} from './scenario.js';

const BASE = import.meta.env.BASE_URL;
const asset = (path) => `${BASE}assets/${path}`;

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const formatDate = (timestamp) => {
  if (!timestamp) return '—';
  try { return new Date(timestamp).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  catch { return '—'; }
};

export class UI {
  constructor(root, callbacks = {}) {
    this.root = root;
    this.callbacks = callbacks;
    this.titleScreen = root.querySelector('#title-screen');
    this.dialogue = root.querySelector('#dialogue');
    this.speakerName = root.querySelector('#speaker-name');
    this.nameplate = root.querySelector('#nameplate');
    this.dialogueText = root.querySelector('#dialogue-text');
    this.nextIndicator = root.querySelector('#next-indicator');
    this.voiceBadge = root.querySelector('#voice-badge');
    this.choiceLayer = root.querySelector('#choice-layer');
    this.quickMenu = root.querySelector('#quick-menu');
    this.overlayRoot = root.querySelector('#overlay-root');
    this.toast = root.querySelector('#toast');
    this.chapterOverlay = root.querySelector('#chapter-overlay');
    this.cgOverlay = root.querySelector('#cg-overlay');
    this.endingOverlay = root.querySelector('#ending-overlay');
    this.hiddenHint = root.querySelector('#hidden-hint');

    this.overlayOpen = false;
    this.overlayType = null;
    this.titleIndex = 0;
    this.titleButtons = [];
    this.activeChoices = null;
    this.chapterResolver = null;
    this.cgResolver = null;
    this.endingResolver = null;
    this.hiddenText = false;

    this.bindStaticEvents();
    this.renderTitle();
  }

  bindStaticEvents() {
    this.titleScreen.addEventListener('click', (event) => {
      const button = event.target.closest('[data-title-action]');
      if (!button) return;
      event.stopPropagation();
      this.runTitleAction(button.dataset.titleAction);
    });

    this.quickMenu.addEventListener('click', (event) => {
      const button = event.target.closest('[data-quick-action]');
      if (!button) return;
      event.stopPropagation();
      this.callbacks.onQuick?.(button.dataset.quickAction);
    });

    this.choiceLayer.addEventListener('click', (event) => {
      const button = event.target.closest('[data-choice-index]');
      if (!button || !this.activeChoices) return;
      event.stopPropagation();
      this.selectChoice(Number(button.dataset.choiceIndex));
    });

    this.choiceLayer.addEventListener('pointerover', (event) => {
      if (event.target.closest('[data-choice-index]')) this.callbacks.onHover?.();
    });

    this.overlayRoot.addEventListener('click', (event) => this.handleOverlayClick(event));
    this.overlayRoot.addEventListener('input', (event) => this.handleOverlayInput(event));

    for (const el of [this.chapterOverlay, this.cgOverlay, this.endingOverlay, this.hiddenHint]) {
      el.addEventListener('click', (event) => {
        event.stopPropagation();
        if (el === this.chapterOverlay) this.resolveChapter();
        else if (el === this.cgOverlay) this.resolveCg();
        else if (el === this.endingOverlay) this.resolveEnding();
        else this.callbacks.onQuick?.('hide');
      });
    }
  }

  // ── Title ──────────────────────────────────────────────────────
  renderTitle() {
    const items = [
      ['new', 'はじめから', 'NEW GAME'],
      ['continue', 'つづきから', 'CONTINUE'],
      ['save', 'セーブ', 'SAVE'],
      ['load', 'ロード', 'LOAD'],
      ['gallery', 'ギャラリー', 'GALLERY'],
      ['music', 'ミュージック', 'MUSIC'],
      ['endings', 'エンディング一覧', 'ENDINGS'],
      ['settings', '設定', 'OPTIONS'],
      ['credits', 'クレジット', 'CREDITS'],
    ];
    this.titleScreen.innerHTML = `
      <div class="title-vignette"></div>
      <div class="title-content">
        <div class="title-kicker">A CINEMATIC VISUAL NOVEL</div>
        <h1 class="game-title"><span>${escapeHtml(GAME_TITLE)}</span></h1>
        <div class="game-subtitle">${escapeHtml(GAME_SUBTITLE)}</div>
        <div class="title-rule"></div>
        <nav class="title-menu" aria-label="メインメニュー">
          ${items.map(([action, label, en], i) => `
            <button class="title-button${i === 0 ? ' selected' : ''}" data-title-action="${action}" data-index="${i}">
              <span class="title-button-en">${en}</span><span class="title-button-jp">${label}</span>
              <span class="title-button-mark">◇</span>
            </button>`).join('')}
        </nav>
        <div class="title-footer">
          <span>© 2026 KIRIHA ARCHIVE PROJECT</span>
          <span>ENTER / CLICK : 決定　　↑↓ : 選択</span>
        </div>
      </div>
      <div class="title-completion" id="title-completion"></div>
    `;
    this.titleButtons = [...this.titleScreen.querySelectorAll('.title-button')];
    this.titleIndex = 0;
  }

  showTitle(state) {
    this.root.dataset.screen = 'title';
    this.titleScreen.classList.remove('hidden');
    this.dialogue.classList.add('hidden');
    this.quickMenu.classList.add('hidden');
    this.choiceLayer.classList.add('hidden');
    this.closeOverlay();
    this.hideChapter();
    this.hideCg();
    this.hideEnding();
    this.setCompletion(state);
    this.setSelectedTitle(0);
    this.callbacks.onTitle?.();
  }

  setCompletion(state) {
    const el = this.titleScreen.querySelector('#title-completion');
    if (!el) return;
    const unlocked = ENDINGS.filter((ending) => state.unlocks.endings.includes(ending.id)).length;
    const trueDone = state.unlocks.endings.includes('true');
    el.innerHTML = `<span class="completion-dot${trueDone ? ' true' : ''}"></span> ENDING ${unlocked} / ${ENDINGS.length}${trueDone ? '　·　TRUE END 達成' : ''}`;
  }

  showGame() {
    this.root.dataset.screen = 'game';
    this.titleScreen.classList.add('hidden');
    this.quickMenu.classList.remove('hidden');
    this.dialogue.classList.remove('hidden');
    this.setCompletion(this.callbacks.getState?.() || { unlocks: { endings: [] } });
  }

  setSelectedTitle(index) {
    this.titleIndex = (index + this.titleButtons.length) % this.titleButtons.length;
    this.titleButtons.forEach((button, i) => button.classList.toggle('selected', i === this.titleIndex));
    this.callbacks.onHover?.();
  }

  moveTitle(delta) {
    this.setSelectedTitle(this.titleIndex + delta);
  }

  activateTitle() {
    const button = this.titleButtons[this.titleIndex];
    if (button) this.runTitleAction(button.dataset.titleAction);
  }

  runTitleAction(action) {
    this.callbacks.onTitleAction?.(action);
    switch (action) {
      case 'new': this.callbacks.onNewGame?.(); break;
      case 'continue': this.callbacks.onContinue?.(); break;
      case 'save': this.openOverlay('save', this.callbacks.getState?.()); break;
      case 'load': this.openOverlay('load', this.callbacks.getState?.()); break;
      case 'gallery': this.openOverlay('gallery', this.callbacks.getState?.()); break;
      case 'music': this.openOverlay('music', this.callbacks.getState?.()); break;
      case 'endings': this.openOverlay('endings', this.callbacks.getState?.()); break;
      case 'settings': this.openOverlay('settings', this.callbacks.getState?.()); break;
      case 'credits': this.openOverlay('credits', this.callbacks.getState?.()); break;
      default: break;
    }
  }

  handleTitleKey(event) {
    if (this.root.dataset.screen !== 'title') return false;
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') { this.moveTitle(-1); return true; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') { this.moveTitle(1); return true; }
    if (event.key === 'Enter' || event.key === ' ') { this.activateTitle(); return true; }
    return false;
  }

  // ── Dialogue ───────────────────────────────────────────────────
  prepareLine(scene) {
    const meta = scene.speakerId ? CHARACTERS[scene.speakerId] : null;
    if (meta) {
      this.nameplate.classList.remove('hidden');
      this.nameplate.style.setProperty('--speaker-color', meta.color);
      this.speakerName.textContent = meta.name;
      this.dialogue.classList.remove('is-narration');
    } else {
      this.nameplate.classList.add('hidden');
      this.dialogue.classList.add('is-narration');
      this.speakerName.textContent = '';
    }
    this.voiceBadge.classList.toggle('active', !!scene.voice && !!this.callbacks.getState?.().settings.voiceEnabled);
    this.dialogueText.textContent = '';
    this.nextIndicator.classList.remove('visible');
    this.dialogue.classList.remove('hidden');
  }

  setText(text, complete = false) {
    this.dialogueText.textContent = text;
    this.nextIndicator.classList.toggle('visible', complete);
  }

  setVoicePlaying(active) {
    this.voiceBadge.classList.toggle('playing', active);
  }

  hideDialogue() {
    this.dialogue.classList.add('hidden');
    this.nextIndicator.classList.remove('visible');
  }

  setHiddenText(hidden) {
    this.hiddenText = hidden;
    this.root.classList.toggle('text-hidden', hidden);
    this.hiddenHint.classList.toggle('hidden', !hidden);
  }

  // ── Choices ────────────────────────────────────────────────────
  showChoices(prompt, options, onSelect) {
    this.activeChoices = { options, onSelect };
    this.choiceLayer.innerHTML = `
      <div class="choice-panel">
        <div class="choice-kicker">CHOICE</div>
        <div class="choice-prompt">${escapeHtml(prompt)}</div>
        <div class="choice-list">
          ${options.map((option, i) => `
            <button class="choice-button" data-choice-index="${i}">
              <span class="choice-number">0${i + 1}</span>
              <span class="choice-label">${escapeHtml(option.label)}</span>
              <span class="choice-arrow">›</span>
            </button>`).join('')}
        </div>
      </div>`;
    this.choiceLayer.classList.remove('hidden');
    this.choiceLayer.querySelector('.choice-button')?.classList.add('hovered');
    this.hideDialogue();
    this.callbacks.onChoiceShown?.();
  }

  selectChoice(index) {
    if (!this.activeChoices || !this.activeChoices.options[index]) return;
    const option = this.activeChoices.options[index];
    const callback = this.activeChoices.onSelect;
    this.activeChoices = null;
    this.choiceLayer.classList.add('hidden');
    callback?.(option);
  }

  handleChoiceKey(event) {
    if (!this.activeChoices) return false;
    const numeric = Number(event.key);
    if (Number.isInteger(numeric) && numeric >= 1 && numeric <= this.activeChoices.options.length) {
      this.selectChoice(numeric - 1);
      return true;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const buttons = [...this.choiceLayer.querySelectorAll('.choice-button')];
      const current = buttons.findIndex((b) => b.classList.contains('hovered'));
      const next = (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons.forEach((b, i) => b.classList.toggle('hovered', i === next));
      return true;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      const hovered = this.choiceLayer.querySelector('.choice-button.hovered');
      const index = hovered ? Number(hovered.dataset.choiceIndex) : 0;
      this.selectChoice(index);
      return true;
    }
    return false;
  }

  // ── Cinematic cards ────────────────────────────────────────────
  showChapter(node) {
    this.hideDialogue();
    this.choiceLayer.classList.add('hidden');
    this.chapterOverlay.innerHTML = `
      <div class="chapter-card">
        <div class="chapter-kicker">CHAPTER</div>
        <div class="chapter-title">${escapeHtml(node.title)}</div>
        <div class="chapter-subtitle">${escapeHtml(node.subtitle)}</div>
        <div class="chapter-line"></div>
        <div class="chapter-hint">CLICK / ENTER で続ける</div>
      </div>`;
    this.chapterOverlay.classList.remove('hidden');
    return new Promise((resolve) => {
      this.chapterResolver = resolve;
      this.chapterTimer = window.setTimeout(() => this.resolveChapter(), node.hold || 2200);
    });
  }

  resolveChapter() {
    if (!this.chapterResolver) return;
    const resolve = this.chapterResolver;
    this.chapterResolver = null;
    window.clearTimeout(this.chapterTimer);
    this.hideChapter();
    resolve();
  }

  hideChapter() {
    this.chapterOverlay.classList.add('hidden');
  }

  showCg(node) {
    this.hideDialogue();
    this.choiceLayer.classList.add('hidden');
    this.cgOverlay.innerHTML = `
      <div class="cg-frame">
        <div class="cg-badge">STILL / ${escapeHtml(node.image)}</div>
        <div class="cg-caption"><span>${escapeHtml(node.caption)}</span></div>
        <div class="cg-hint">CLICK / ENTER で続ける</div>
      </div>`;
    this.cgOverlay.style.backgroundImage = `linear-gradient(180deg, rgba(4,7,14,.05), rgba(4,7,14,.5)), url("${asset(`bg/${node.image}.jpg`)}")`;
    this.cgOverlay.classList.remove('hidden');
    return new Promise((resolve) => { this.cgResolver = resolve; });
  }

  resolveCg() {
    if (!this.cgResolver) return;
    const resolve = this.cgResolver;
    this.cgResolver = null;
    this.hideCg();
    resolve();
  }

  hideCg() {
    this.cgOverlay.classList.add('hidden');
  }

  showEnding(node, meta, state) {
    this.hideDialogue();
    this.choiceLayer.classList.add('hidden');
    const isTrue = meta.type === 'TRUE END';
    this.endingOverlay.innerHTML = `
      <div class="ending-card ${isTrue ? 'true-ending' : ''}">
        <div class="ending-type">${escapeHtml(meta.type)}</div>
        <div class="ending-title">${escapeHtml(meta.title)}</div>
        <div class="ending-rule"></div>
        <div class="ending-description">${escapeHtml(meta.description)}</div>
        <div class="ending-record">ENDING ${ENDINGS.filter((e) => state.unlocks.endings.includes(e.id)).length} / ${ENDINGS.length}　·　OBSERVATION ${state.flags.light}　·　TRUTH ${state.flags.truth}</div>
        <button class="ending-return" data-action="return-title">タイトルへ戻る</button>
      </div>`;
    this.endingOverlay.classList.remove('hidden');
    return new Promise((resolve) => { this.endingResolver = resolve; });
  }

  resolveEnding() {
    if (!this.endingResolver) return;
    const resolve = this.endingResolver;
    this.endingResolver = null;
    this.hideEnding();
    resolve();
  }

  hideEnding() {
    this.endingOverlay.classList.add('hidden');
  }

  // ── Toast / quick menu ─────────────────────────────────────────
  showToast(text, duration = 1600) {
    if (!text) return;
    this.toast.textContent = text;
    this.toast.classList.remove('hidden');
    this.toast.classList.add('visible');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toast.classList.remove('visible');
      window.setTimeout(() => this.toast.classList.add('hidden'), 320);
    }, duration);
  }

  setModes({ auto = false, skip = false } = {}) {
    this.quickMenu.querySelector('[data-quick-action="auto"]')?.classList.toggle('active', auto);
    this.quickMenu.querySelector('[data-quick-action="skip"]')?.classList.toggle('active', skip);
    this.root.dataset.auto = auto ? 'on' : 'off';
    this.root.dataset.skip = skip ? 'on' : 'off';
  }

  // ── Overlays ───────────────────────────────────────────────────
  openOverlay(type, state, extra = {}) {
    this.overlayType = type;
    this.overlayOpen = true;
    this.root.classList.add('overlay-open');
    this.callbacks.onOverlayOpen?.(type);
    this.renderOverlay(type, state, extra);
  }

  closeOverlay() {
    if (!this.overlayOpen && !this.overlayRoot.innerHTML) {
      this.root.classList.remove('overlay-open');
      return;
    }
    this.overlayOpen = false;
    this.overlayType = null;
    this.overlayRoot.innerHTML = '';
    this.root.classList.remove('overlay-open');
    this.callbacks.onOverlayClose?.();
  }

  handleOverlayClick(event) {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;
    event.stopPropagation();
    const action = actionEl.dataset.action;
    if (action === 'close') { this.closeOverlay(); return; }
    if (action === 'system') { this.openOverlay('system', this.callbacks.getState?.()); return; }
    if (action === 'save') { this.openOverlay('save', this.callbacks.getState?.()); return; }
    if (action === 'load') { this.openOverlay('load', this.callbacks.getState?.()); return; }
    if (action === 'settings') { this.openOverlay('settings', this.callbacks.getState?.()); return; }
    if (action === 'gallery') { this.openOverlay('gallery', this.callbacks.getState?.()); return; }
    if (action === 'music') { this.openOverlay('music', this.callbacks.getState?.()); return; }
    if (action === 'endings') { this.openOverlay('endings', this.callbacks.getState?.()); return; }
    if (action === 'credits') { this.openOverlay('credits', this.callbacks.getState?.()); return; }
    if (action === 'backlog') { this.openOverlay('backlog', this.callbacks.getState?.()); return; }
    if (action === 'title') { this.callbacks.onReturnTitle?.(); return; }
    if (action === 'save-slot') { this.callbacks.onSave?.(Number(actionEl.dataset.slot)); return; }
    if (action === 'load-slot') { this.callbacks.onLoad?.(Number(actionEl.dataset.slot)); return; }
    if (action === 'music-play') { this.callbacks.onMusicPlay?.(actionEl.dataset.track); return; }
    if (action === 'music-stop') { this.callbacks.onMusicStop?.(); return; }
    if (action === 'gallery-open') { this.openOverlay('gallery-image', this.callbacks.getState?.(), { id: actionEl.dataset.id }); return; }
    if (action === 'gallery-back') { this.openOverlay('gallery', this.callbacks.getState?.()); return; }
    if (action === 'return-title') { this.callbacks.onReturnTitle?.(); return; }
  }

  handleOverlayInput(event) {
    const input = event.target.closest('[data-setting]');
    if (!input) return;
    const key = input.dataset.setting;
    const value = input.type === 'checkbox' ? input.checked : Number(input.value);
    const label = this.overlayRoot.querySelector(`[data-value-for="${key}"]`);
    if (label) label.textContent = input.type === 'checkbox' ? (value ? 'ON' : 'OFF') : `${Math.round(value * 100)}%`;
    this.callbacks.onSetting?.(key, value);
  }

  overlayShell(title, en, body, footer = '') {
    return `
      <div class="modal-backdrop" data-action="close"></div>
      <section class="modal-panel">
        <header class="modal-header">
          <div><span class="modal-en">${escapeHtml(en)}</span><h2>${escapeHtml(title)}</h2></div>
          <button class="modal-close" data-action="close">✕</button>
        </header>
        <div class="modal-body">${body}</div>
        ${footer ? `<footer class="modal-footer">${footer}</footer>` : ''}
      </section>`;
  }

  renderOverlay(type, state = {}, extra = {}) {
    const s = state || { settings: {}, unlocks: { cg: [], music: [], endings: [] }, flags: {}, saves: [], backlog: [] };
    switch (type) {
      case 'system': this.overlayRoot.innerHTML = this.overlayShell('システムメニュー', 'SYSTEM', this.systemBody()); break;
      case 'save': this.overlayRoot.innerHTML = this.overlayShell('セーブ', 'SAVE DATA', this.saveLoadBody('save', s)); break;
      case 'load': this.overlayRoot.innerHTML = this.overlayShell('ロード', 'LOAD DATA', this.saveLoadBody('load', s)); break;
      case 'settings': this.overlayRoot.innerHTML = this.overlayShell('設定', 'OPTIONS', this.settingsBody(s.settings)); break;
      case 'backlog': this.overlayRoot.innerHTML = this.overlayShell('バックログ', 'TEXT LOG', this.backlogBody(s.backlog)); break;
      case 'gallery': this.overlayRoot.innerHTML = this.overlayShell('ギャラリー', 'STILL ARCHIVE', this.galleryBody(s)); break;
      case 'gallery-image': this.overlayRoot.innerHTML = this.overlayShell('ビューア', 'STILL VIEWER', this.galleryImageBody(extra.id)); break;
      case 'music': this.overlayRoot.innerHTML = this.overlayShell('ミュージック', 'SOUND ARCHIVE', this.musicBody(s)); break;
      case 'endings': this.overlayRoot.innerHTML = this.overlayShell('エンディング', 'ENDING LIST', this.endingsBody(s)); break;
      case 'credits': this.overlayRoot.innerHTML = this.overlayShell('クレジット', 'CREDITS', this.creditsBody()); break;
      default: this.overlayRoot.innerHTML = '';
    }
    if (type === 'backlog') {
      const body = this.overlayRoot.querySelector('.backlog-list');
      if (body) body.scrollTop = body.scrollHeight;
    }
  }

  systemBody() {
    const items = [
      ['save', 'セーブ', 'SAVE'], ['load', 'ロード', 'LOAD'], ['backlog', 'バックログ', 'LOG'],
      ['settings', '設定', 'OPTIONS'], ['gallery', 'ギャラリー', 'GALLERY'], ['music', 'ミュージック', 'MUSIC'],
      ['endings', 'エンディング', 'ENDINGS'], ['credits', 'クレジット', 'CREDITS'], ['title', 'タイトルへ', 'TITLE'],
    ];
    return `<div class="system-grid">${items.map(([action, jp, en]) => `<button class="system-tile" data-action="${action}"><span>${en}</span>${jp}</button>`).join('')}</div>`;
  }

  saveLoadBody(mode, state) {
    const slots = state.saves || [];
    return `
      <div class="save-mode-row"><span>${mode === 'save' ? 'データを書き込みます' : 'データを読み込みます'}</span><button data-action="${mode === 'save' ? 'load' : 'save'}">${mode === 'save' ? 'ロードへ' : 'セーブへ'}</button></div>
      <div class="save-grid">
        ${Array.from({ length: 8 }, (_, i) => {
          const slot = slots[i];
          const empty = !slot;
          return `<button class="save-slot${empty ? ' empty' : ''}" data-action="${mode}-slot" data-slot="${i}" ${mode === 'load' && empty ? 'disabled' : ''}>
            <span class="slot-no">SLOT ${String(i + 1).padStart(2, '0')}</span>
            <span class="slot-chapter">${empty ? 'データなし' : escapeHtml(slot.chapter || 'つづきから')}</span>
            <span class="slot-date">${empty ? '— — / — —' : formatDate(slot.timestamp)}</span>
          </button>`;
        }).join('')}
      </div>`;
  }

  settingsBody(settings = {}) {
    const row = (key, label, value, min = 0, max = 1, step = 0.01) => `
      <label class="setting-row">
        <span class="setting-label">${label}</span>
        <input type="range" data-setting="${key}" min="${min}" max="${max}" step="${step}" value="${value}">
        <span class="setting-value" data-value-for="${key}">${Math.round(value * 100)}%</span>
      </label>`;
    const toggle = (key, label, checked) => `
      <label class="setting-row toggle-row">
        <span class="setting-label">${label}</span>
        <input type="checkbox" data-setting="${key}" ${checked ? 'checked' : ''}>
        <span class="setting-value" data-value-for="${key}">${checked ? 'ON' : 'OFF'}</span>
      </label>`;
    return `
      <div class="settings-group">
        ${row('bgm', 'BGM音量', settings.bgm ?? 0.62)}
        ${row('se', '効果音音量', settings.se ?? 0.72)}
        ${row('voice', 'ボイス音量', settings.voice ?? 0.86)}
        ${row('ambient', '環境音音量', settings.ambient ?? 0.4)}
        ${row('textSpeed', '文字速度', settings.textSpeed ?? 0.72)}
        ${toggle('voiceEnabled', 'キーボイス再生', settings.voiceEnabled ?? true)}
        ${toggle('skipRead', '既読のみスキップ', settings.skipRead ?? true)}
      </div>
      <p class="settings-note">ENTER / SPACE : 送る　A : オート　S : スキップ　B : バックログ　ESC : メニュー　CTRL : テキスト非表示</p>`;
  }

  backlogBody(entries = []) {
    return `<div class="backlog-list">${entries.slice(-120).map((entry) => `
      <div class="backlog-entry"><span class="backlog-name" style="--speaker-color:${CHARACTERS[entry.speakerId]?.color || '#9aa8c0'}">${escapeHtml(entry.speakerName || '')}</span><span class="backlog-text">${escapeHtml(entry.text)}</span></div>`).join('') || '<div class="empty-note">まだログがありません。</div>'}</div>`;
  }

  galleryBody(state) {
    const unlocked = state.unlocks?.cg || [];
    const count = GALLERY.filter((g) => unlocked.includes(g.id)).length;
    return `
      <div class="archive-progress">STILL <strong>${count}</strong> / ${GALLERY.length}　·　${Math.round((count / GALLERY.length) * 100)}% ARCHIVED</div>
      <div class="gallery-grid">
        ${GALLERY.map((g) => {
          const open = unlocked.includes(g.id);
          return `<button class="gallery-tile${open ? '' : ' locked'}" data-action="${open ? 'gallery-open' : ''}" data-id="${g.id}" ${open ? '' : 'disabled'}>
            <img src="${asset(`bg/${g.id}.jpg`)}" alt="">
            <span class="gallery-label">${open ? escapeHtml(g.title) : '???　未収録'}</span>
          </button>`;
        }).join('')}
      </div>`;
  }

  galleryImageBody(id) {
    const g = GALLERY.find((item) => item.id === id) || GALLERY[0];
    return `
      <div class="gallery-viewer">
        <img src="${asset(`bg/${g.id}.jpg`)}" alt="">
        <div class="viewer-caption"><h3>${escapeHtml(g.title)}</h3><p>${escapeHtml(g.caption)}</p></div>
        <button class="viewer-back" data-action="gallery-back">← 一覧へ</button>
      </div>`;
  }

  musicBody(state) {
    const unlocked = state.unlocks?.music || [];
    return `
      <div class="archive-progress">TRACK <strong>${unlocked.length}</strong> / ${Object.keys(MUSIC).length}</div>
      <div class="music-list">
        ${Object.entries(MUSIC).map(([id, meta], i) => {
          const open = unlocked.includes(id);
          return `<div class="music-row${open ? '' : ' locked'}">
            <span class="track-no">${String(i + 1).padStart(2, '0')}</span>
            <div class="track-meta"><strong>${open ? escapeHtml(meta.title) : '???　未聴取'}</strong><small>${open ? escapeHtml(meta.source) : 'ゲーム内で再生すると解放されます'}</small></div>
            <button data-action="music-play" data-track="${id}" ${open ? '' : 'disabled'}>▶</button>
          </div>`;
        }).join('')}
      </div>
      <button class="music-stop" data-action="music-stop">■ 再生停止</button>`;
  }

  endingsBody(state) {
    const unlocked = state.unlocks?.endings || [];
    return `<div class="ending-list">${ENDINGS.map((ending, i) => {
      const open = unlocked.includes(ending.id);
      return `<div class="ending-row${open ? '' : ' locked'}${ending.id === 'true' ? ' true' : ''}">
        <span class="ending-no">${String(i + 1).padStart(2, '0')}</span>
        <div><strong>${open ? escapeHtml(ending.title) : '???'}</strong><span>${open ? escapeHtml(ending.description) : '未到達の結末'}</span></div>
        <em>${open ? escapeHtml(ending.type) : 'LOCKED'}</em>
      </div>`;
    }).join('')}</div>`;
  }

  creditsBody() {
    return `
      <div class="credits-scroll">
        <h3>シナリオ・演出・実装</h3><p>Arena.ai Agent Mode</p>
        <h3>キャラクター立ち絵</h3><p>ユーザー所有 Google Drive アセット「偏差値60の教室から✝本質✝が漏れ出している件について」より、透過・サイズ・共通ボックスを再正規化して使用。</p>
        <h3>背景イラスト</h3><p>Arena.ai Image Generation（本作向け生成）</p>
        <h3>BGM</h3><p>DURU-AI — CC0 BGM pack / 320 kbps MP3。CC0 1.0。</p>
        <h3>効果音</h3><p>Wyzowl SFX Kit — 48 kHz / 24-bit WAV。CC0 1.0。雨・星屑などの環境音は Web Audio API で別途合成。</p>
        <h3>Live2D</h3><p>Live2D Inc. サンプルモデル「Shizuku」 / pixi-live2d-display (MIT) / Cubism 2.1 runtime mirror。モデルは Live2D フリー素材ライセンスに従い、観測システム〈シズク〉として使用。</p>
        <h3>フォント</h3><p>Noto Serif JP Variable — SIL Open Font License 1.1。</p>
        <h3>キーボイス</h3><p>Arena.ai Speech Generation（重要場面のみ）</p>
        <p class="credits-fine">本作はコンソール/PC向け商業ノベルゲームの画面構成を志向したプロトタイプです。収録素材のライセンス文は public/assets/licenses に同梱しています。</p>
      </div>`;
  }

  handleOverlayKey(event) {
    if (!this.overlayOpen) return false;
    if (event.key === 'Escape') { this.closeOverlay(); return true; }
    return false;
  }
}
