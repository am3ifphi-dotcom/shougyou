/* テキスト演出エンジン — タイプライター表示 + ルビ + 強調 */

export interface TextConfig {
  charsPerSecond: number;
  rubyEnabled: boolean;
}

interface GlyphSpec { html: string; em: boolean }

const TOKEN_RE = /\[([^\]|]+)\|([^\]]+)\]|【([^】]+)】/g;

function parseTokens(raw: string, rubyEnabled: boolean): GlyphSpec[] {
  const out: GlyphSpec[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(raw)) !== null) {
    const before = raw.slice(last, m.index);
    for (const ch of before) out.push({ html: escapeHtml(ch), em: false });
    if (m[1] !== undefined) {
      // ルビ: [漢字|かんじ]
      if (rubyEnabled) {
        out.push({ html: `<ruby>${escapeHtml(m[1])}<rt>${escapeHtml(m[2])}</rt></ruby>`, em: false });
      } else {
        for (const ch of m[1]) out.push({ html: escapeHtml(ch), em: false });
      }
    } else if (m[3] !== undefined) {
      for (const ch of m[3]) out.push({ html: escapeHtml(ch), em: true });
    }
    last = m.index + m[0].length;
  }
  for (const ch of raw.slice(last)) out.push({ html: escapeHtml(ch), em: false });
  return out;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export class TextRenderer {
  private container: HTMLElement;
  private nextIndicator: HTMLElement;
  private glyphs: HTMLElement[] = [];
  private shown = 0;
  private accumulator = 0;
  private timer: number | null = null;
  private lastTime = 0;
  private cfg: TextConfig = { charsPerSecond: 42, rubyEnabled: true };
  private onGlyphSound: (() => void) | null = null;
  private glyphCounter = 0;

  constructor(container: HTMLElement, nextIndicator: HTMLElement) {
    this.container = container;
    this.nextIndicator = nextIndicator;
  }

  setConfig(cfg: TextConfig) { this.cfg = cfg; }
  setOnGlyph(cb: (() => void) | null) { this.onGlyphSound = cb; }

  /* 文をセット。完了まで isComplete()==false */
  setText(raw: string): void {
    this.clearTimer();
    this.container.innerHTML = '';
    this.glyphs = [];
    this.shown = 0;
    this.accumulator = 0;
    this.glyphCounter = 0;
    this.nextIndicator.classList.remove('visible');

    const specs = parseTokens(raw, this.cfg.rubyEnabled);
    for (const spec of specs) {
      const span = document.createElement('span');
      span.className = 'glyph' + (spec.em ? ' em' : '');
      span.innerHTML = spec.html;
      this.container.appendChild(span);
      this.glyphs.push(span);
    }

    this.lastTime = performance.now();
    const step = (now: number) => {
      const dt = Math.min(64, now - this.lastTime);
      this.lastTime = now;
      this.accumulator += (this.cfg.charsPerSecond * dt) / 1000;
      let advanced = false;
      while (this.accumulator >= 1 && this.shown < this.glyphs.length) {
        const g = this.glyphs[this.shown];
        g.classList.add('shown');
        this.shown++;
        this.accumulator -= 1;
        advanced = true;
        this.glyphCounter++;
        if (this.onGlyphSound && this.glyphCounter % 2 === 0) {
          const ch = g.textContent ?? '';
          if (ch.trim() !== '') this.onGlyphSound();
        }
      }
      if (this.shown >= this.glyphs.length) {
        this.finish();
        return;
      }
      this.timer = window.setTimeout(() => step(performance.now()), 16);
      void advanced;
    };
    this.timer = window.setTimeout(() => step(performance.now()), 16);
  }

  private finish() {
    this.clearTimer();
    for (const g of this.glyphs) g.classList.add('shown');
    this.shown = this.glyphs.length;
    this.nextIndicator.classList.add('visible');
  }

  private clearTimer() {
    if (this.timer !== null) { window.clearTimeout(this.timer); this.timer = null; }
  }

  isComplete(): boolean { return this.shown >= this.glyphs.length; }

  /* タイプ途中なら全表示、完了済みなら何もしない */
  complete(): void { this.finish(); }

  destroy() { this.clearTimer(); this.container.innerHTML = ''; }
}
