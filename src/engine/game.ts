/* ゲーム進行エンジン — シナリオ解釈 / セーブ / オート / バックログ */
import { SCENARIO } from '../scenario';
import type { Cmd, CgKey } from './script';
import { CG_PATHS } from './script';
import { audio, type BgmKey, type VoiceKey } from './audio';
import { stage, CHARACTERS, type CharId } from './stage';
import { fx } from './fx';
import { TextRenderer } from './text';
import { writeSave, captureThumbnail, AUTO_SLOT, type SaveData } from './save';

export type Phase = 'title' | 'playing' | 'choice' | 'ended';

export interface BacklogEntry { name: string; text: string; }

const SPEAKER_DISPLAY: Record<string, string> = {
  tooru: '透',
  setsuko: '節子',
  wada: '和田さん',
  genzo: '源三さん',
  keiichi: '啓一',
};

const sleep = (ms: number) => new Promise<void>(r => window.setTimeout(r, ms));

export class Game {
  index = 0;
  phase: Phase = 'title';
  chapter = 'プロローグ';
  auto = false;
  skip = false;
  modalOpen = false;
  transitionBusy = false;

  backlog: BacklogEntry[] = [];
  private playtimeBase = 0;
  private sessionStart = 0;
  private autoTimer: number | null = null;
  private skipTimer: number | null = null;
  private currentCg: CgKey | null = null;
  private currentBgm: BgmKey | null = null;
  private afterTextComplete: (() => void) | null = null;

  onEnding: ((endingId: string, title: string) => void) | null = null;
  onBacklogChange: (() => void) | null = null;

  textRenderer: TextRenderer;
  private nameplate = document.getElementById('nameplate')!;
  private nameplateText = document.getElementById('nameplate-text')!;
  private textboxWrap = document.getElementById('textbox-wrap')!;
  private nextIndicator = document.getElementById('next-indicator')!;
  private choiceLayer = document.getElementById('choice-layer')!;

  constructor() {
    this.textRenderer = new TextRenderer(
      document.getElementById('text-content')!,
      this.nextIndicator,
    );
    this.textRenderer.setOnGlyph(() => audio.playSE('click', 0.06));
    // タイプライター完了を検知してオート進行
    this.startWatchers();
  }

  private startWatchers() {
    window.setInterval(() => {
      if (this.phase !== 'playing' || this.modalOpen) return;
      if (this.skip && this.textRenderer.isComplete()) {
        this.advance();
      } else if (this.auto && this.textRenderer.isComplete()) {
        if (!this.autoTimer) {
          const est = Math.min(3800, 1100 + (document.getElementById('text-content')?.textContent?.length ?? 40) * 38);
          this.autoTimer = window.setTimeout(() => {
            this.autoTimer = null;
            if (this.auto && !this.modalOpen) this.advance();
          }, est);
        }
      }
    }, 250);
  }

  playtimeMs(): number { return this.playtimeBase + (this.sessionStart ? performance.now() - this.sessionStart : 0); }

  currentBgmKey(): BgmKey | null { return this.currentBgm; }

  /* ================= 開始・ロード ================= */

  newGame() {
    this.index = 0;
    this.chapter = 'プロローグ';
    this.backlog = [];
    this.auto = false; this.skip = false;
    this.playtimeBase = 0; this.sessionStart = performance.now();
    this.currentCg = null;
    stage.hideAll();
    stage.hideCG(true);
    stage.setBackground('cafe_day', true);
    this.textboxWrap.classList.remove('hidden');
    this.nameplate.classList.add('hidden');
    this.phase = 'playing';
    this.step();
  }

  applySaveData(data: SaveData) {
    this.chapter = data.chapter;
    this.playtimeBase = data.playtimeMs; this.sessionStart = performance.now();
    this.auto = false; this.skip = false;
    this.currentBgm = data.bgm;
    this.currentCg = (data.cgKey as CgKey | null) ?? null;
    this.index = data.index;
    if (data.bgKey) stage.setBackground(data.bgKey as never, true);
    if (this.currentCg) stage.showCG(CG_PATHS[this.currentCg], true); else stage.hideCG(true);
    stage.applyState(data.sprites);
    if (data.bgm) audio.playBGM(data.bgm, 0.6); else audio.stopBGM(0.3);
    this.textboxWrap.classList.remove('hidden');
    this.nameplate.classList.add('hidden');
    this.phase = 'playing';
    this.step();
  }

  collectPublicSave(slot: number) {
    return this.collectSaveData(slot, null);
  }

  private collectSaveData(slot: number, thumb: string | null): Omit<SaveData, 'version' | 'timestamp'> {
    return {
      slot,
      chapter: this.chapter,
      index: this.index,
      bgKey: stage.getCurrentBg(),
      cgKey: this.currentCg,
      sprites: stage.getState(),
      bgm: this.currentBgm ?? audio.currentBgmKey(),
      playtimeMs: this.playtimeMs(),
      thumb,
    };
  }

  async save(slot: number): Promise<boolean> {
    if (this.phase === 'title') return false;
    try {
      const thumb = await captureThumbnail();
      writeSave({ ...this.collectSaveData(slot, thumb), thumb });
      return true;
    } catch (e) {
      fx.toast('セーブに失敗しました');
      console.error(e);
      return false;
    }
  }

  /* ================= 進行 ================= */

  private cleanMarkers(raw: string): string {
    return raw
      .replace(/\[([^\]|]+)\|[^\]]+\]/g, '$1')
      .replace(/【([^】]+)】/g, '$1');
  }

  private pushBacklog(name: string | null, text: string) {
    this.backlog.push({ name: name ?? '', text: this.cleanMarkers(text) });
    if (this.backlog.length > 220) this.backlog.shift();
    this.onBacklogChange?.();
  }

  async step(): Promise<void> {
    if (this.phase === 'title') return;
    const cmd = SCENARIO[this.index] as Cmd | undefined;
    if (!cmd) return;

    switch (cmd.t) {
      case 'bg':
        stage.setBackground(cmd.key, cmd.instant);
        this.index++;
        return this.step();

      case 'setParticle':
        fx.particles.setMode(cmd.mode);
        this.index++;
        return this.step();

      case 'cg': {
        this.transitionBusy = true;
        this.currentCg = cmd.key;
        audio.unlockCg(cmd.key);
        stage.showCG(CG_PATHS[cmd.key]);
        await sleep(1150);
        this.transitionBusy = false;
        this.index++;
        return this.step();
      }

      case 'unlockCG':
        audio.unlockCg(cmd.key);
        this.index++;
        return this.step();

      case 'cgHide':
        this.currentCg = null;
        stage.hideCG();
        await sleep(400);
        this.index++;
        return this.step();

      case 'show':
        stage.show(cmd.char, cmd.expr ?? 'normal', cmd.slot);
        this.index++;
        return this.step();

      case 'hide':
        stage.hide(cmd.char);
        this.index++;
        return this.step();

      case 'expr':
        stage.setExpression(cmd.char, cmd.expr);
        this.index++;
        return this.step();

      case 'bgm':
        this.currentBgm = cmd.key;
        audio.playBGM(cmd.key, cmd.fade ?? 1.6);
        this.index++;
        return this.step();

      case 'se':
        audio.playSE(cmd.key, cmd.volume ?? 1);
        this.index++;
        return this.step();

      case 'wait':
        await sleep(cmd.ms);
        this.index++;
        return this.step();

      case 'fx': {
        this.index++;
        switch (cmd.kind) {
          case 'flash': await fx.flash(); break;
          case 'shake': await fx.shake(cmd.intensity ?? 12, 620); break;
          case 'fadeblack': await fx.fade('black', true, cmd.intensity ?? 900); break;
          case 'fadeblackOut': await fx.fade('black', false, cmd.intensity ?? 900); break;
          case 'fadewhite': await fx.fade('white', true, cmd.intensity ?? 900); break;
          case 'fadewhiteOut': await fx.fade('white', false, cmd.intensity ?? 900); break;
          case 'stardust': fx.particles.setMode('stardust'); await sleep(1600); break;
        }
        return this.step();
      }

      case 'chapter': {
        this.transitionBusy = true;
        this.chapter = cmd.title;
        await fx.chapterCard(cmd.kicker, cmd.title, 2200);
        this.transitionBusy = false;
        this.index++;
        // オートセーブ
        void this.autosave();
        return this.step();
      }

      case 'label':
        this.index++;
        return this.step();

      case 'jump':
        this.index = this.findLabel(cmd.to);
        return this.step();

      case 'choice':
        this.phase = 'choice';
        this.renderChoice(cmd.options);
        return; // 入力待ち

      case 'say': {
        const displayName = cmd.speaker === 'narrator' ? null : SPEAKER_DISPLAY[cmd.speaker];
        const charId = (cmd.speaker === 'narrator' || cmd.speaker === 'keiichi') ? null : cmd.speaker as CharId;

        if (charId) {
          if (cmd.expr) stage.setExpression(charId, cmd.expr);
          stage.spotlight(charId);
        } else {
          stage.spotlight(null);
        }

        if (displayName) {
          this.nameplateText.textContent = displayName;
          this.nameplate.classList.remove('hidden');
        } else {
          this.nameplate.classList.add('hidden');
        }

        this.pushBacklog(displayName, cmd.text);
        this.nextIndicator.classList.remove('visible');
        this.textRenderer.setText(cmd.text);

        if (cmd.voice) {
          const v: VoiceKey = cmd.voice;
          audio.playVoice(v);
        }

        // このsayは入力待ち
        return;
      }

      case 'ending': {
        this.phase = 'ended';
        stage.spotlight(null);
        audio.unlockEnding(cmd.id);
        audio.playSE('star', 1);
        this.textboxWrap.classList.add('hidden');
        this.onEnding?.(cmd.id, cmd.title);
        return;
      }
    }
  }

  private findLabel(id: string): number {
    const i = SCENARIO.findIndex(c => c.t === 'label' && c.id === id);
    return i >= 0 ? i + 1 : this.index;
  }

  private renderChoice(options: Array<{ label: string; to: string }>) {
    this.choiceLayer.innerHTML = '';
    this.choiceLayer.classList.add('visible');
    for (const opt of options) {
      const btn = document.createElement('button');
      btn.className = 'choice-btn';
      btn.textContent = opt.label;
      btn.addEventListener('mouseenter', () => audio.playSE('hover', 0.7));
      btn.addEventListener('click', () => {
        audio.playSE('confirm');
        this.choiceLayer.classList.remove('visible');
        this.choiceLayer.innerHTML = '';
        this.phase = 'playing';
        this.index = this.findLabel(opt.to);
        this.step();
      });
      this.choiceLayer.appendChild(btn);
    }
  }

  advance() {
    if (this.modalOpen) return;
    if (this.phase !== 'playing') return;

    if (!this.textRenderer.isComplete()) {
      this.textRenderer.complete();
      return;
    }
    audio.stopVoice();
    if (this.autoTimer) { window.clearTimeout(this.autoTimer); this.autoTimer = null; }
    this.index++;
    this.step();
  }

  toggleAuto(): boolean {
    this.auto = !this.auto;
    if (!this.auto && this.autoTimer) { window.clearTimeout(this.autoTimer); this.autoTimer = null; }
    return this.auto;
  }

  toggleSkip(): boolean {
    this.skip = !this.skip;
    return this.skip;
  }

  async autosave() {
    if (this.phase !== 'playing') return;
    try {
      writeSave({ ...this.collectSaveData(AUTO_SLOT, null), thumb: null });
    } catch { /* ignore */ }
  }

  returnToTitle() {
    this.phase = 'title';
    this.auto = false; this.skip = false;
    stage.hideAll();
    stage.hideCG(true);
    audio.stopAll();
  }
}
