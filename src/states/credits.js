// ---------------------------------------------------------------------------
//  クレジット — a real staff roll. Every asset in the manifest appears here,
//  grouped by source, with its author, licence and the page it came from.
//  The text is generated at runtime from assets.manifest.json, so it can never
//  drift out of sync with what the game actually ships.
// ---------------------------------------------------------------------------
import * as UI from '../ui.js';

export class CreditsState {
  constructor(ctx) { Object.assign(this, ctx); }

  enter() {
    this.t = 0;
    this.speed = 34;             // px / second
    this.holdAtEnd = false;

    const root = this.root = new PIXI.Container();
    this.ui.addChild(root);

    const back = new PIXI.Sprite(this.registry.textures.get('bg_layer_cave_far') || PIXI.Texture.WHITE);
    back.width = UI.W; back.height = UI.H;
    back.tint = 0x25333f;
    root.addChild(back);
    const wash = new PIXI.Graphics();
    wash.beginFill(0x04060a, 0.9).drawRect(0, 0, UI.W, UI.H).endFill();
    root.addChild(wash);

    // embers drifting up behind the roll
    this.embers = new PIXI.Graphics();
    root.addChild(this.embers);
    this.emberData = Array.from({ length: 70 }, () => ({
      x: Math.random() * UI.W, y: Math.random() * UI.H,
      vy: -10 - Math.random() * 26, s: 2, a: 0.08 + Math.random() * 0.3,
      c: Math.random() < 0.6 ? 0xd7b169 : 0x59d7c8,
    }));

    // ---- the roll itself: one tall text column, masked by the frame
    const col = this.col = new PIXI.Container();
    col.x = 0;
    col.y = UI.H * 0.72;      // begins just under the lower third
    root.addChild(col);

    const lines = buildRoll(this.registry, this.game);
    let y = 0;
    for (const item of lines) {
      if (item.type === 'gap') { y += item.h; continue; }
      if (item.type === 'logo') {
        const t = UI.pxText(item.text, { size: 34, font: UI.FONT_JP_HEAVY, fill: 0xf0e4c8, outline: 5 });
        t.anchor.set(0.5, 0); t.x = UI.W / 2; t.y = y;
        col.addChild(t); y += t.height + 6;
        if (item.sub) {
          const s2 = UI.pxText(item.sub, { size: 10, font: UI.FONT_BIG, fill: 0x8d96a1, outline: 2 });
          s2.anchor.set(0.5, 0); s2.x = UI.W / 2; s2.y = y;
          col.addChild(s2); y += s2.height + 20;
        }
        continue;
      }
      if (item.type === 'head') {
        // long pack names wrap to two centred lines, never off the frame
        const t = UI.pxText(item.text, { size: 13, font: UI.FONT_BIG, fill: 0xd7b169, outline: 3, align: 'center' });
        t.anchor.set(0.5, 0); t.x = UI.W / 2; t.y = y;
        t.style.wordWrap = true;
        t.style.wordWrapWidth = 1000;
        t.style.breakWords = true;
        t.style.lineHeight = 24;
        col.addChild(t); y += t.height + 10;
        if (item.sub) {
          const s2 = UI.pxText(item.sub, { size: 10, fill: 0x7d8794, outline: 2 });
          s2.anchor.set(0.5, 0); s2.x = UI.W / 2; s2.y = y;
          col.addChild(s2); y += s2.height + 8;
        }
        const rule = new PIXI.Graphics();
        rule.beginFill(0xd7b169, 0.25).drawRect(UI.W / 2 - 260, y, 520, 1).endFill();
        col.addChild(rule);
        y += 18;
        continue;
      }
      // normal credit line: left = role/asset group, right = author · licence
      if (item.type === 'pair') {
        const l = UI.pxText(item.left, { size: 11, fill: 0xb8b2a4, outline: 2 });
        l.x = 96; l.y = y;
        const r = UI.pxText(truncate(item.right, 70), { size: 10, fill: 0x7a8390, outline: 2 });
        r.anchor.set(1, 0); r.x = UI.W - 96; r.y = y + 1;
        col.addChild(l, r);
        y += 22;
        continue;
      }
      if (item.type === 'small') {
        const t = UI.pxText(item.text, { size: 9, fill: 0x646c76, outline: 2, align: 'center' });
        t.anchor.set(0.5, 0); t.x = UI.W / 2; t.y = y;
        col.addChild(t); y += 18;
      }
    }
    this.rollHeight = y;

    // header / footer chrome stay put while the column moves
    const head = UI.pxText('CREDITS', { size: 10, font: UI.FONT_BIG, fill: 0x6f7883, outline: 2 });
    head.x = UI.SAFE; head.y = UI.SAFE - 12;
    root.addChild(head);
    this.footer = UI.pxText('', { size: 9, fill: 0x6f7883, outline: 2 });
    this.footer.anchor.set(1, 1);
    this.footer.x = UI.W - UI.SAFE; this.footer.y = UI.H - UI.SAFE + 14;
    root.addChild(this.footer);

    // top / bottom fades so the roll dissolves rather than clipping
    const fades = new PIXI.Graphics();
    for (let i = 0; i < 46; i++) {
      fades.beginFill(0x04060a, Math.pow(i / 46, 1.4) * 0.96).drawRect(0, i * 2, UI.W, 2).endFill();
      fades.beginFill(0x04060a, Math.pow(i / 46, 1.4) * 0.96).drawRect(0, UI.H - i * 2 - 2, UI.W, 2).endFill();
    }
    root.addChild(fades);

    this._offs = [
      this.input.on('confirm', () => this._exit()),
      this.input.onCancel(() => this._exit()),
      this.input.on('up', () => { this.speed = Math.min(260, this.speed + 40); }),
      this.input.on('down', () => { this.speed = Math.max(14, this.speed - 24); }),
    ];

    this.audio.playMusic('bgm_result', { fade: 1200 });
  }

  _exit() {
    this.audio.cue('back', { volume: 0.6 });
    this.game.goto('title');
  }

  update(dt) {
    this.t += dt;
    this.col.y -= this.speed * dt;
    // the roll parks with its last line at the lower third, then waits
    const floorY = UI.H * 0.82 - this.rollHeight;
    if (this.col.y < floorY) { this.col.y = floorY; this.holdAtEnd = true; }
    if (this.holdAtEnd) this.speed = 0;
    const pct = Math.min(1, Math.max(0, (UI.H - this.col.y) / Math.max(1, this.rollHeight)));
    this.footer.text = `${Math.round(pct * 100)}%   [${this.input.label('up')}/${this.input.label('down')}] 速度   [${this.input.label('back')}] 戻る`;
    this.embers.clear();
    for (const e of this.emberData) {
      e.y += e.vy * dt;
      if (e.y < -4) { e.y = UI.H + 4; e.x = Math.random() * UI.W; }
      this.embers.beginFill(e.c, e.a).drawRect(e.x | 0, e.y | 0, e.s, e.s).endFill();
    }
  }

  exit() { this._offs?.forEach((o) => o()); this.root?.destroy({ children: true }); }
}

// ---------------------------------------------------------------------------
/** Build the roll from the live manifest: sources → authors → licences. */
function buildRoll(reg, game) {
  const out = [];
  out.push({ type: 'gap', h: 60 });
  out.push({ type: 'logo', text: '本 質', sub: 'HONSHITSU — 偏差値60の教室' });
  out.push({ type: 'small', text: 'a personal, non-commercial arcade score attack' });
  out.push({ type: 'gap', h: 40 });

  out.push({ type: 'head', text: 'ARENA WORKS', sub: '制作 / DIRECTION · CODE · DESIGN' });
  out.push({ type: 'pair', left: '原作モチーフ', right: '「本質」 — 個人配布テキスト' });
  out.push({ type: 'pair', left: 'キャラクター画', right: '本質images (first-party, personal use)' });
  out.push({ type: 'gap', h: 30 });

  // sources, grouped by the short human name we ship in LICENSES.md
  const bySource = new Map();
  for (const a of reg.entries) {
    const key = a.source_id || shortSource(a);
    if (!bySource.has(key)) bySource.set(key, []);
    bySource.get(key).push(a);
  }
  const order = [...bySource.keys()].sort((a, b) => bySource.get(b).length - bySource.get(a).length);
  for (const key of order) {
    const list = bySource.get(key);
    const authors = [...new Set(list.map((a) => a.author).filter(Boolean))];
    const licences = [...new Set(list.map((a) => a.license).filter(Boolean))];
    const page = list.find((a) => a.source_page)?.source_page || '';
    const pack = list.find((a) => a.source_pack)?.source_pack || '';
    out.push({ type: 'head', text: SOURCE_LABEL[key] || key.toUpperCase(), sub: `${list.length} assets` });
    for (const a of authors.slice(0, 3)) out.push({ type: 'pair', left: 'author', right: truncate(a, 66) });
    out.push({ type: 'pair', left: 'LICENSE', right: licences.join(' / ') || 'see manifest' });
    if (pack) out.push({ type: 'small', text: truncate(pack, 110) });
    if (page) out.push({ type: 'pair', left: 'source', right: truncate(page, 66) });
    // every id is listed, wrapped in narrow columns
    const ids = list.map((a) => a.id).join('   ·   ');
    for (const chunk of chunkString(ids, 108)) out.push({ type: 'small', text: chunk });
    out.push({ type: 'gap', h: 24 });
  }

  out.push({ type: 'head', text: 'TOOLS', sub: 'made with' });
  out.push({ type: 'pair', left: 'Rendering', right: 'PixiJS 7 — MIT' });
  out.push({ type: 'pair', left: 'Audio', right: 'Howler.js 2 — MIT' });
  out.push({ type: 'pair', left: 'Type', right: 'Press Start 2P, DotGothic16 — SIL OFL 1.1' });
  out.push({ type: 'gap', h: 30 });

  out.push({ type: 'head', text: 'ASSET LICENSING' });
  out.push({ type: 'small', text: '全アセットは CC0-1.0 / SIL OFL-1.1 / 第一者提供。' });
  out.push({ type: 'small', text: 'noncommercial_only の項目は COMMERCIAL_BUILD で自動的に除外されます。' });
  out.push({ type: 'pair', left: `TOTAL ASSETS`, right: `${reg.entries.length}` });
  out.push({ type: 'pair', left: `BUILD`, right: game.manifest.commercial_build ? 'COMMERCIAL' : 'PERSONAL / NON-COMMERCIAL' });
  out.push({ type: 'gap', h: 60 });
  out.push({ type: 'logo', text: 'Thank you for playing', sub: '本質は、元からあった。' });
  out.push({ type: 'gap', h: 120 });
  return out;
}

const SOURCE_LABEL = {
  dcss: 'DUNGEON CRAWL STONE SOUP',
  superpowers: 'SUPERPOWERS · MEDIEVAL FANTASY',
  freesfx: 'JUHANI JUNKALA · RETRO SFX',
  drive: '本質images — FIRST PARTY',
  drive_local: '本質images — FIRST PARTY',
  fontsource: 'GOOGLE FONTS (OFL)',
  local: 'ARENA WORKS',
};

function shortSource(a) {
  if (/dungeon crawl/i.test(a.author || '') || /dcss/i.test(a.source_pack || '')) return 'dcss';
  if (/superpowers/i.test(a.author || '')) return 'superpowers';
  if (/juhani|freesfx/i.test(a.author || '')) return 'freesfx';
  if (/first-party/i.test(a.license || '')) return 'drive';
  if (/OFL/i.test(a.license || '')) return 'fontsource';
  return 'local';
}

function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function chunkString(s, n) {
  const out = [];
  for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n));
  return out;
}
