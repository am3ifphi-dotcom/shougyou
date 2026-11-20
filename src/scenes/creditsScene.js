/**
 * Credits.
 *
 * A staff roll generated from the manifest: every author, licence and source
 * page used by the build scrolls past in the classic end-of-game style, with
 * the generated timestamp at the foot so it is obvious which fetch run the
 * roll belongs to.
 */
import { Container, Graphics, Sprite } from 'pixi.js';
import { VIEW_W, VIEW_H } from '../core/app.js';
import { COLORS, text } from '../ui/type.js';
import { CREDIT_ROLL } from '../generated/credits.js';
import { playSfx } from '../core/audio.js';
import { starField, glowTexture, fogTexture } from '../core/procedural.js';
import { get } from '../core/textures.js';

const FOOTER = 26;

export class CreditsScene {
  constructor({ onBack }) {
    this.node = new Container();
    this.onBack = onBack;
    this.t = 0;
    this.speed = 26; // px / s

    this.bg = new Sprite(starField(VIEW_W, VIEW_H, 33));
    this.bg.alpha = 0.5;
    this.node.addChild(this.bg);

    this.glow = new Sprite(glowTexture(300, '120,90,190'));
    this.glow.anchor.set(0.5);
    this.glow.x = VIEW_W / 2;
    this.glow.y = VIEW_H / 2;
    this.glow.alpha = 0.14;
    this.node.addChild(this.glow);

    this.fog = new Sprite(fogTexture());
    this.fog.anchor.set(0.5);
    this.fog.width = VIEW_W * 1.4;
    this.fog.height = 80;
    this.fog.x = VIEW_W / 2;
    this.fog.y = VIEW_H - 8;
    this.fog.alpha = 0.35;
    this.node.addChild(this.fog);

    this.roll = new Container();
    this.node.addChild(this.roll);



    const items = [];
    const push = (node, height, gap) => items.push({ node, height, gap });

    push(centered(text('SHATTERED CROWN', { size: 32, font: 'title', fill: COLORS.gold, anchor: 0.5, letterSpacing: 3, stroke: 0x1a0f08, strokeWidth: 3 })), 34, 10);
    push(centered(text('A NON-COMMERCIAL PERSONAL PROJECT', { size: 8, font: 'pixel', fill: COLORS.boneDim, anchor: 0.5, letterSpacing: 2 })), 10, 34);

    const skull = new Sprite(get('logo_title'));
    skull.anchor.set(0.5);
    skull.width = 20;
    skull.height = 20;
    skull.x = VIEW_W / 2;
    push(skull, 20, 26);

    push(section('DESIGN & CODE'), 18, 8);
    push(entry('Hollow Lantern Studio', 'systems, rendering, audio direction'), 26, 22);

    push(section('PIXEL ART & TILES'), 18, 8);
    push(entry('DragonDePlatino & DawnBringer', 'DawnLike 16x16 universal roguelike tileset'), 26, 22);

    push(section('UI SKIN'), 18, 8);
    push(entry('Kenney (kenney.nl)', 'UI Pack - Adventure: panels, bars, cursor, buttons'), 26, 22);

    push(section('MUSIC'), 18, 8);
    push(entry('Juhani Junkala', 'Chiptune Adventures / Retro Game Music (CC0)'), 26, 22);

    push(section('SOUND EFFECTS'), 18, 8);
    push(entry('Kenney (kenney.nl)', 'RPG Audio, UI Audio, Digital Audio, Jingles (CC0)'), 26, 22);

    push(section('TYPEFACES'), 18, 8);
    push(entry('Rodrigo Fuenzalida', 'Pirata One (OFL)'), 26, 2);
    push(entry('Igino Marini', 'IM Fell English & Small Caps (OFL)'), 26, 2);
    push(entry('Fontworks / Google Fonts', 'DotGothic16 (OFL)'), 26, 22);

    push(section('ENGINE'), 18, 8);
    push(entry('PixiJS contributors', 'PixiJS 8.6.6 (MIT)'), 26, 2);
    push(entry('James Simpson', 'Howler.js 2.2.4 (MIT)'), 26, 30);

    push(section('LICENCE ROLL'), 18, 12);
    for (const c of CREDIT_ROLL.credits) {
      push(licenceBlock(c), 40, 14);
    }

    push(centered(text(`GENERATED ${CREDIT_ROLL.generatedAt}`, { size: 7, font: 'pixel', fill: 0x4a4152, anchor: 0.5 })), 10, 14);
    push(centered(text('FULL LICENCE TEXT IN LICENSES.MD', { size: 7, font: 'pixel', fill: 0x6b6357, anchor: 0.5 })), 10, 40);

    let y = VIEW_H + 16;
    for (const it of items) {
      it.node.y = y;
      this.roll.addChild(it.node);
      y += it.height + it.gap;
    }
    // roll.y is the scroll offset; every item starts below the frame
    this.roll.y = 0;
    this.rollLength = y - VIEW_H;
    this.finished = false;

    // soft edges instead of a hard clip: the roll dissolves into the dark at
    // the top and bottom of the frame like a film roll
    const fadeTop = new Graphics();
    for (let i = 0; i < 46; i++) {
      fadeTop.rect(0, i, VIEW_W, 1).fill({ color: 0x05040a, alpha: 1 - i / 46 });
    }
    this.node.addChild(fadeTop);
    const fadeBottom = new Graphics();
    for (let i = 0; i < 34; i++) {
      fadeBottom.rect(0, VIEW_H - FOOTER - 34 + i, VIEW_W, 1).fill({ color: 0x05040a, alpha: i / 34 });
    }
    this.node.addChild(fadeBottom);

    // opaque footer strip so the scrolling roll never collides with the hint
    const footerBar = new Graphics();
    footerBar.rect(0, VIEW_H - FOOTER, VIEW_W, FOOTER).fill({ color: 0x05040a, alpha: 1 });
    footerBar.rect(0, VIEW_H - FOOTER, VIEW_W, 1).fill({ color: 0x2a2118, alpha: 0.9 });
    this.node.addChild(footerBar);

    this.footer = text('', { size: 8, font: 'pixel', fill: COLORS.boneDim, anchor: 0.5 });
    this.footer.x = VIEW_W / 2;
    this.footer.y = VIEW_H - FOOTER + 11;
    this.node.addChild(this.footer);

    this.scrollbar = new Graphics();
    this.node.addChild(this.scrollbar);

    this.hintBox = centered(text('[ESC] BACK', { size: 7, font: 'pixel', fill: 0x4a4152, anchor: 0.5 }));
    this.hintBox.y = 8;
    this.node.addChild(this.hintBox);
  }

  onInput(inp) {
    if (inp.wasPressed('cancel') || inp.wasPressed('pause')) {
      playSfx('se_ui_cancel');
      this.onBack?.();
      return;
    }
    if (inp.wasPressed('confirm')) this.roll.y -= 120;
    if (inp.anyPressed && this.finished) {
      // finishing the roll then pressing anything returns, like a real end roll
    }
  }

  update(dtMs, inp = { isDown: () => false }) {
    this.t += dtMs;
    const boost = inp.isDown('down') ? 6 : inp.isDown('up') ? -3 : 1;
    this.roll.y -= this.speed * boost * (dtMs / 1000);
    if (this.roll.y > VIEW_H) this.roll.y = VIEW_H;

    if (-this.roll.y > this.rollLength - 4 && !this.finished) {
      this.finished = true;
      playSfx('se_ui_confirm', { volume: 0.3 });
    }
    if (this.finished) this.roll.y += 0; // hold at the end

    this.footer.text = this.finished ? 'THANK YOU FOR PLAYING   ·   [ESC] BACK' : 'HOLD DOWN TO SCROLL   ·   [ESC] BACK';
    this.footer.alpha = 0.45 + Math.sin(this.t * 0.004) * 0.25;

    const k = Math.min(1, Math.max(0, -this.roll.y / Math.max(1, this.rollLength)));
    this.scrollbar.clear();
    this.scrollbar.rect(VIEW_W - 4, 4, 1.5, VIEW_H - FOOTER - 6).fill({ color: 0x241c14, alpha: 0.9 });
    this.scrollbar.rect(VIEW_W - 4, 4 + (VIEW_H - FOOTER - 6) * k, 1.5, 22).fill({ color: 0xc9a06a, alpha: 0.85 });
  }
}

function centered(node) {
  node.x = VIEW_W / 2;
  return node;
}

function section(label) {
  const c = new Container();
  const t = text(label, { size: 11, font: 'pixel', fill: COLORS.gold, anchor: 0.5, letterSpacing: 2 });
  t.x = VIEW_W / 2;
  c.addChild(t);
  const g = new Graphics();
  g.moveTo(VIEW_W / 2 - 74, 15).lineTo(VIEW_W / 2 + 74, 15).stroke({ width: 1, color: 0x6b4a2a, alpha: 0.9 });
  g.circle(VIEW_W / 2, 15, 1.6).fill(0xe8b650);
  c.addChild(g);
  return c;
}

function entry(author, role) {
  const c = new Container();
  const a = text(author, { size: 14, font: 'title', fill: COLORS.bone, anchor: 0.5, letterSpacing: 1 });
  a.x = VIEW_W / 2;
  c.addChild(a);
  const r = text(role, { size: 7, font: 'pixel', fill: COLORS.boneDim, anchor: 0.5, align: 'center' });
  r.x = VIEW_W / 2;
  r.y = 16;
  c.addChild(r);
  return c;
}

function licenceBlock(c) {
  const box = new Container();
  const name = text(c.author, { size: 10, font: 'body', fill: COLORS.bone, anchor: 0.5 });
  name.x = VIEW_W / 2;
  box.addChild(name);
  const lic = `${c.license}${c.noncommercialOnly ? '  ·  NON-COMMERCIAL ONLY' : ''}`;
  const l = text(lic, { size: 7, font: 'pixel', fill: c.noncommercialOnly ? COLORS.blood : COLORS.goldDim, anchor: 0.5 });
  l.x = VIEW_W / 2;
  l.y = 12;
  box.addChild(l);
  const src = text(c.source || '', { size: 6, font: 'pixel', fill: 0x6b6357, anchor: 0.5, align: 'center', wordWrap: true, wrapWidth: 400 });
  src.x = VIEW_W / 2;
  src.y = 21;
  box.addChild(src);
  return box;
}
