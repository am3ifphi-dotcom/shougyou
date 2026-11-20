/**
 * Title screen.
 *
 * Parallax night-town skyline (procedural layers built to match the fetched
 * pixel art), drifting embers, a slow camera push on the moon, the blackletter
 * logo, and a keyboard-first menu.  "PRESS ANY KEY" blinks until a real input
 * unlocks audio.
 */
import { Container, Graphics, Sprite } from 'pixi.js';
import { VIEW_W, VIEW_H } from '../core/app.js';
import { COLORS, text } from '../ui/type.js';
import { MenuList, panel } from '../ui/widgets.js';
import { glowTexture, starField, moonTexture, mountainLayer, buildingLayer, fogTexture } from '../core/procedural.js';
import { get } from '../core/textures.js';
import { playSfx } from '../core/audio.js';
import { input } from '../core/input.js';
import { VERSION } from '../version.js';

export class TitleScene {
  constructor({ onSelect, hasSave }) {
    this.node = new Container();
    this.onSelect = onSelect;
    this.t = 0;
    this.ready = true;
    this.menuOpen = false;
    this.particles = [];

    /* backdrop ------------------------------------------------------- */
    this.sky = new Sprite(starField(VIEW_W, VIEW_H, 12));
    this.sky.label='sky';
    this.node.addChild(this.sky);

    this.moonGlow = new Sprite(glowTexture(220, '170,150,220'));
    this.moonGlow.anchor.set(0.5);
    this.moonGlow.x = 356;
    this.moonGlow.y = 62;
    this.moonGlow.alpha = 0.35;
    this.moonGlow.label='moonGlow';
    this.node.addChild(this.moonGlow);

    this.moon = new Sprite(moonTexture());
    this.moon.anchor.set(0.5);
    this.moon.x = 356;
    this.moon.y = 62;
    this.moon.scale.set(2.1);
    this.moon.label='moon';
    this.node.addChild(this.moon);

    this.far = new Sprite(mountainLayer(VIEW_W * 2, 150, 3, '#171326', 5));
    this.far.y = 58;
    this.far.label='far';
    this.node.addChild(this.far);
    this.mid = new Sprite(mountainLayer(VIEW_W * 2, 130, 8, '#100d1b', 8));
    this.mid.y = 96;
    this.mid.label='mid';
    this.node.addChild(this.mid);
    this.city = new Sprite(buildingLayer(VIEW_W * 2, 110, 17, '#08060e'));
    this.city.y = 140;
    this.city.label='city';
    this.node.addChild(this.city);

    // the cathedral silhouette the whole story hangs on
    this.cathedral = new Graphics();
    this.drawCathedral(this.cathedral, 208, 92);
    this.cathedral.label='cathedral';
    this.node.addChild(this.cathedral);

    this.ground = new Sprite(buildingLayer(VIEW_W * 2, 54, 23, '#050409'));
    this.ground.y = VIEW_H - 54;
    this.ground.label='ground';
    this.node.addChild(this.ground);

    this.fog = new Sprite(fogTexture());
    this.fog.anchor.set(0.5);
    this.fog.width = VIEW_W * 1.6;
    this.fog.height = 110;
    this.fog.x = VIEW_W / 2;
    this.fog.y = VIEW_H - 40;
    this.fog.alpha = 0.7;
    this.fog.label='fog';
    this.node.addChild(this.fog);

    this.emberLayer = new Container();
    this.emberLayer.label='emberLayer';
    this.node.addChild(this.emberLayer);
    for (let i = 0; i < 34; i++) {
      const e = new Sprite(get('fx_sparks_a'));
      e.anchor.set(0.5);
      e.width = 3 + Math.random() * 4;
      e.height = e.width;
      e.tint = Math.random() > 0.6 ? 0xffc070 : 0xff7a3c;
      e.x = Math.random() * VIEW_W;
      e.y = Math.random() * VIEW_H;
      e.vy = -6 - Math.random() * 14;
      e.vx = 4 + Math.random() * 8;
      e.phase = Math.random() * 10;
      e.alpha = 0.3 + Math.random() * 0.6;
      this.emberLayer.addChild(e);
      this.particles.push(e);
    }

    /* logo ----------------------------------------------------------- */
    this.logoBox = new Container();
    this.logoBox.x = VIEW_W / 2;
    this.logoBox.y = 80;
    this.logoBox.label='logoBox';
    this.node.addChild(this.logoBox);

    this.logoGlow = new Sprite(glowTexture(260, '232,182,80'));
    this.logoGlow.anchor.set(0.5);
    this.logoGlow.y = 4;
    this.logoGlow.alpha = 0.16;
    this.logoGlow.scale.set(1.5, 0.8);
    this.logoBox.addChild(this.logoGlow);

    const skull = new Sprite(get('logo_title'));
    skull.anchor.set(0.5);
    skull.width = 22;
    skull.height = 22;
    skull.y = -32;
    skull.alpha = 0.9;
    this.logoBox.addChild(skull);

    this.logoMain = text('SHATTERED', {
      size: 46,
      font: 'title',
      fill: COLORS.gold,
      align: 'center',
      anchor: 0.5,
      letterSpacing: 4,
      stroke: 0x1a0f08,
      strokeWidth: 5,
    });
    this.logoMain.y = -6;
    this.logoBox.addChild(this.logoMain);

    this.logoSub = text('C R O W N', {
      size: 30,
      font: 'title',
      fill: COLORS.bone,
      align: 'center',
      anchor: 0.5,
      letterSpacing: 8,
      stroke: 0x1a0f08,
      strokeWidth: 5,
    });
    this.logoSub.y = 30;
    this.logoBox.addChild(this.logoSub);

    const rule = new Graphics();
    rule.moveTo(-96, 50).lineTo(96, 50).stroke({ width: 1, color: 0x8a6a44, alpha: 0.8 });
    rule.circle(0, 50, 2).fill(0xe8b650);
    this.logoBox.addChild(rule);

    /* menu ----------------------------------------------------------- */
    this.menuBox = new Container();
    this.menuBox.x = VIEW_W / 2;
    this.menuBox.y = 146;
    this.menuBox.alpha = 0;
    this.menuBox.label='menuBox';
    this.node.addChild(this.menuBox);

    // a dim parchment window so the menu reads against the skyline, with the
    // ornamental frame on top at low weight (the art is mostly outline)
    const shade = new Graphics();
    shade.roundRect(-100, -14, 200, 100, 4).fill({ color: 0x0a0714, alpha: 0.66 });
    this.menuBox.addChild(shade);
    this.menuPlate = panel(200, 100, { id: 'ui_panel_inset', inset: true, alpha: 0.5 });
    this.menuPlate.x = -100;
    this.menuPlate.y = -14;
    this.menuBox.addChild(this.menuPlate);

    this.menu = new MenuList(
      [
        { label: 'NEW GAME' },
        { label: 'CONTINUE', enabled: !!hasSave },
        { label: 'OPTIONS' },
        { label: 'CREDITS' },
        { label: 'QUIT' },
      ],
      { x: 0, y: 4, gap: 17, size: 13, width: 200, align: 0.5, onMove: () => playSfx('se_ui_move', { volume: 0.5 }) }
    );
    this.menuBox.addChild(this.menu);

    this.press = text('PRESS ANY KEY', { size: 11, font: 'pixel', fill: COLORS.gold, align: 'center', anchor: 0.5, letterSpacing: 3 });
    this.press.x = VIEW_W / 2;
    this.press.y = VIEW_H - 58;
    this.press.label='press';
    this.node.addChild(this.press);

    /* corner furniture ---------------------------------------------- */
    this.version = text(`v${VERSION}   NON-COMMERCIAL BUILD`, { size: 7, font: 'pixel', fill: 0x6b6357 });
    this.version.x = 12;
    this.version.y = VIEW_H - 14;
    this.node.addChild(this.version);

    this.copy = text('© 2026 HOLLOW LANTERN STUDIO - PERSONAL PROJECT', { size: 7, font: 'pixel', fill: 0x6b6357, anchorX: 1 });
    this.copy.x = VIEW_W - 12;
    this.copy.y = VIEW_H - 14;
    this.node.addChild(this.copy);

    this.deviceHint = text('', { size: 7, font: 'pixel', fill: 0x4a4152 });
    this.deviceHint.x = 12;
    this.deviceHint.y = 10;
    this.node.addChild(this.deviceHint);
  }

  drawCathedral(g, cx, baseY) {
    g.rect(cx - 30, baseY - 40, 60, 48).fill(0x0a0812);
    g.poly([cx - 34, baseY - 40, cx, baseY - 74, cx + 34, baseY - 40]).fill(0x0a0812);
    g.rect(cx - 6, baseY - 96, 12, 56).fill(0x0a0812);
    g.poly([cx - 9, baseY - 96, cx, baseY - 112, cx + 9, baseY - 96]).fill(0x0a0812);
    // lit windows
    g.rect(cx - 20, baseY - 30, 4, 8).fill({ color: 0xd8a05a, alpha: 0.85 });
    g.rect(cx - 8, baseY - 34, 4, 10).fill({ color: 0xffc070, alpha: 0.9 });
    g.rect(cx + 6, baseY - 30, 4, 8).fill({ color: 0xd8a05a, alpha: 0.7 });
    g.circle(cx, baseY - 84, 2.4).fill({ color: 0xffc070, alpha: 0.85 });
    g.rect(cx - 2, baseY - 16, 4, 24).fill({ color: 0x1a1220 });
  }

  onInput(inp) {
    if (!this.menuOpen) {
      if (inp.anyPressed || inp.pointer.clicked) {
        this.openMenu();
      }
      return;
    }
    if (!this.ready) return;
    if (inp.wasPressed('up')) this.menu.move(-1);
    if (inp.wasPressed('down')) this.menu.move(1);
    if (inp.wasPressed('confirm')) {
      const item = this.menu.active;
      if (item.enabled === false) {
        playSfx('se_ui_denied');
        return;
      }
      playSfx('se_ui_confirm', { volume: 0.85 });
      this.onSelect?.(item.label);
    }
    if (inp.wasPressed('cancel') && this.menu.index !== 0) {
      playSfx('se_ui_cancel');
      this.menu.select(0);
    }
  }

  openMenu() {
    if (this.menuOpen) return;
    this.menuOpen = true;
    playSfx('se_ui_confirm', { volume: 0.4, pitchJitter: 0.01 });
  }

  refreshContinue(hasSave) {
    this.menu.items[1].enabled = !!hasSave;
    this.menu.rows[1].label.style.fill = hasSave ? COLORS.bone : COLORS.disabled;
  }

  update(dtMs) {
    this.t += dtMs;
    const t = this.t;
    // slow camera push + parallax drift
    const push = 1 + Math.sin(t * 0.00012) * 0.02;
    this.sky.scale.set(push);
    this.far.x = -((t * 0.003) % VIEW_W);
    this.mid.x = -((t * 0.008) % VIEW_W);
    this.city.x = -((t * 0.017) % VIEW_W);
    this.ground.x = -((t * 0.03) % VIEW_W);
    this.moonGlow.alpha = 0.3 + Math.sin(t * 0.0012) * 0.08;
    this.fog.y = VIEW_H - 40 + Math.sin(t * 0.0007) * 5;

    for (const e of this.particles) {
      e.y += e.vy * (dtMs / 1000) * 0.6;
      e.x += (e.vx + Math.sin(t * 0.001 + e.phase) * 4) * (dtMs / 1000);
      if (e.y < -6) {
        e.y = VIEW_H + 6;
        e.x = Math.random() * VIEW_W;
      }
      if (e.x > VIEW_W + 6) e.x = -6;
      e.alpha = 0.3 + Math.abs(Math.sin(t * 0.002 + e.phase)) * 0.55;
    }

    this.logoMain.scale.set(1 + Math.sin(t * 0.0016) * 0.006);
    this.logoGlow.alpha = 0.14 + Math.sin(t * 0.0022) * 0.05;

    const menuTarget = this.menuOpen ? 1 : 0;
    this.menuBox.alpha += (menuTarget - this.menuBox.alpha) * Math.min(1, dtMs * 0.006);
    this.press.alpha = this.menuOpen ? 0 : 0.35 + Math.abs(Math.sin(t * 0.003)) * 0.65;

    if (this.menuOpen) {
      this.menu.update(dtMs);
      this.menuBox.y = 146 + (1 - this.menuBox.alpha) * 6;
    }
    this.deviceHint.text = input.device === 'gamepad' ? 'GAMEPAD DETECTED' : input.device === 'pointer' ? 'POINTER' : 'KEYBOARD';
  }
}
