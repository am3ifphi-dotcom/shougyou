/**
 * Result / game-over screen.
 *
 * Shares one layout for a death and for a clear, with the title and tint
 * swapped.  Shows the run tallies, a grade, and the retry / title options.
 */
import { Container, Graphics, Sprite } from 'pixi.js';
import { VIEW_W, VIEW_H } from '../core/app.js';
import { COLORS, text } from '../ui/type.js';
import { MenuList, panel, hudPlate } from '../ui/widgets.js';
import { glowTexture, fogTexture } from '../core/procedural.js';
import { get } from '../core/textures.js';
import { playSfx } from '../core/audio.js';
import { getSave } from '../core/save.js';

export class ResultScene {
  constructor({ stats, victory, onSelect }) {
    this.node = new Container();
    this.onSelect = onSelect;
    this.t = 0;
    this.victory = victory;

    this.bg = new Graphics();
    this.bg.rect(0, 0, VIEW_W, VIEW_H).fill(victory ? 0x0a0714 : 0x0c0508);
    this.node.addChild(this.bg);

    this.glow = new Sprite(glowTexture(320, victory ? '232,182,80' : '200,65,74'));
    this.glow.anchor.set(0.5);
    this.glow.x = VIEW_W / 2;
    this.glow.y = 80;
    this.glow.alpha = 0.22;
    this.glow.scale.set(1.6, 0.9);
    this.node.addChild(this.glow);

    this.fog = new Sprite(fogTexture());
    this.fog.anchor.set(0.5);
    this.fog.width = VIEW_W * 1.5;
    this.fog.height = 80;
    this.fog.x = VIEW_W / 2;
    this.fog.y = VIEW_H - 10;
    this.fog.alpha = 0.4;
    this.node.addChild(this.fog);

    this.crest = new Sprite(get(victory ? 'item_soul' : 'prop_skull'));
    this.crest.anchor.set(0.5);
    this.crest.width = 40;
    this.crest.height = 40;
    this.crest.x = VIEW_W / 2;
    this.crest.y = 52;
    this.node.addChild(this.crest);

    this.title = text(victory ? 'CROWN RECLAIMED' : 'YOU HAVE FALLEN', {
      size: victory ? 34 : 30,
      font: 'title',
      fill: victory ? COLORS.gold : COLORS.blood,
      anchor: 0.5,
      letterSpacing: 3,
      stroke: 0x0b0810,
      strokeWidth: 4,
    });
    this.title.x = VIEW_W / 2;
    this.title.y = 74;
    this.node.addChild(this.title);

    this.sub = text(victory ? 'THE SHATTERED WARDEN IS NO MORE' : 'THE CRYPT CLAIMS ANOTHER SOUL', {
      size: 9,
      font: 'pixel',
      fill: COLORS.boneDim,
      anchor: 0.5,
      letterSpacing: 2,
    });
    this.sub.x = VIEW_W / 2;
    this.sub.y = 96;
    this.node.addChild(this.sub);

    // tally panel, then a rank plate below it
    const PW = 236;
    const PX = VIEW_W / 2 - PW / 2;
    const PY = 108;
    this.plate = hudPlate(PW, 104, { fill: 0x0c0a12, fillAlpha: 0.95 });
    this.plate.x = PX;
    this.plate.y = PY;
    this.node.addChild(this.plate);
    const frame = panel(PW, 104, { id: 'ui_panel_inset', inset: true, alpha: 0.3 });
    frame.x = PX;
    frame.y = PY;
    this.node.addChild(frame);

    const rows = [
      ['SOULS', `${stats.souls}`],
      ['LEVEL', `${stats.level}`],
      ['FOES SLAIN', `${stats.kills}`],
      ['TIME', formatTime(stats.time)],
    ];
    rows.forEach(([k, v], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const cx = PX + 18 + col * 112;
      const cy = PY + 9 + row * 31;
      const kt = text(k, { size: 7, font: 'pixel', fill: COLORS.boneDim, letterSpacing: 1 });
      kt.x = cx;
      kt.y = cy;
      this.node.addChild(kt);
      const vt = text(v, { size: 17, font: 'title', fill: COLORS.bone });
      vt.x = cx;
      vt.y = cy + 9;
      this.node.addChild(vt);
    });

    // rank strip along the bottom of the panel
    const rankY = PY + 80;
    const rankRule = new Graphics();
    rankRule.rect(PX + 14, rankY - 6, PW - 28, 1).fill({ color: 0x4a3a2a, alpha: 0.85 });
    this.node.addChild(rankRule);
    this.gradeLabel = text('RANK', { size: 8, font: 'pixel', fill: COLORS.boneDim, letterSpacing: 3 });
    this.gradeLabel.x = PX + 18;
    this.gradeLabel.y = rankY + 3;
    this.node.addChild(this.gradeLabel);
    this.grade = text(gradeFor(stats), {
      size: 20,
      font: 'title',
      fill: victory ? COLORS.gold : COLORS.boneDim,
      anchorX: 1,
      stroke: 0x0b0810,
      strokeWidth: 3,
    });
    this.grade.x = PX + PW - 18;
    this.grade.y = rankY - 2;
    this.node.addChild(this.grade);

    const save = getSave();
    this.menu = new MenuList(
      [{ label: victory ? 'PLAY AGAIN' : 'RISE AGAIN' }, { label: 'TITLE SCREEN' }],
      { x: VIEW_W / 2, y: VIEW_H - 40, gap: 19, size: 13, width: 200, align: 0.5, onMove: () => playSfx('se_ui_move', { volume: 0.5 }) }
    );
    this.node.addChild(this.menu);

    this.flash = new Graphics();
    this.flash.rect(0, 0, VIEW_W, VIEW_H).fill(0xffffff);
    this.flash.alpha = 0.8;
    this.node.addChild(this.flash);
  }

  onInput(inp) {
    if (this.t < 700) return;
    if (inp.wasPressed('up')) this.menu.move(-1);
    if (inp.wasPressed('down')) this.menu.move(1);
    if (inp.wasPressed('confirm')) {
      playSfx('se_ui_confirm');
      this.onSelect?.(this.menu.active.label);
    }
    if (inp.wasPressed('cancel')) {
      playSfx('se_ui_cancel');
      this.onSelect?.('TITLE SCREEN');
    }
  }

  update(dtMs) {
    this.t += dtMs;
    this.flash.alpha = Math.max(0, this.flash.alpha - dtMs * 0.0035);
    this.title.alpha = Math.min(1, this.t / 500);
    this.title.scale.set(0.94 + Math.min(1, this.t / 500) * 0.06);
    this.menu.alpha = Math.max(0, Math.min(1, (this.t - 520) / 400));
    this.menu.update(dtMs);
    this.crest.y = 52 + Math.sin(this.t * 0.002) * 2;
    this.glow.alpha = 0.18 + Math.sin(this.t * 0.0016) * 0.06;
    this.grade.alpha = Math.max(0, Math.min(1, (this.t - 600) / 400));
  }
}

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function gradeFor(stats) {
  const score = stats.souls + stats.kills * 3 + (stats.victory ? 160 : 0) - stats.deaths * 20;
  if (score > 260) return 'S';
  if (score > 180) return 'A';
  if (score > 110) return 'B';
  if (score > 50) return 'C';
  return 'D';
}
