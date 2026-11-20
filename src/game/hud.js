/**
 * In-game HUD.
 *
 * Anchored to the corners and edges of the fixed 480x270 buffer with a ~5%
 * safe margin.  Fades back during quiet exploration, comes forward in combat,
 * and never uses a web-style widget: everything is skinned with the fetched
 * parchment 9-slice and the DawnLike icon set.
 */
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { VIEW_W, VIEW_H } from '../core/app.js';
import { COLORS, text } from '../ui/type.js';
import { StatBar, panel, hudPlate, glyphCap } from '../ui/widgets.js';
import { get } from '../core/textures.js';
import { TILE } from './dungeon.js';
import { input } from '../core/input.js';

const MARGIN = 24; // ~5% of 480

export class HUD {
  constructor(world) {
    this.world = world;
    this.root = new Container();
    this.root.alpha = 1;
    this.targetAlpha = 1;
    this.idleT = 0;
    this.combatT = 0;

    /* --- vitals, top-left -------------------------------------------- */
    this.vitals = new Container();
    this.vitals.x = MARGIN - 8;
    this.vitals.y = MARGIN - 8;
    this.root.addChild(this.vitals);

    this.vitals.addChild(hudPlate(150, 58, { fill: 0x120e16, fillAlpha: 0.86 }));

    // portrait medallion
    const portrait = new Sprite(get('hero_warrior_s'));
    portrait.width = 26;
    portrait.height = 26;
    portrait.x = 6;
    portrait.y = 8;
    this.vitals.addChild(portrait);
    const ringG = new Graphics();
    ringG.circle(19, 21, 15).stroke({ width: 1.5, color: 0xc9a06a, alpha: 0.85 });
    this.vitals.addChild(ringG);

    // Two stacked bars, each with its number right-aligned inside the trough:
    // no labels floating over the frame, nothing overlapping the medallion.
    this.hpBar = new StatBar({ width: 64, height: 9, fillTint: 0xd8484f, ghostColor: 0xffd9a0 });
    this.hpBar.x = 40;
    this.hpBar.y = 9;
    this.vitals.addChild(this.hpBar);
    this.mpBar = new StatBar({ width: 64, height: 9, fillTex: 'ui_bar_blue', fillTint: 0x6fd3d8, ghostColor: 0xbfeff6 });
    this.mpBar.x = 40;
    this.mpBar.y = 22;
    this.vitals.addChild(this.mpBar);

    // numbers sit beside the troughs, right of the fills
    this.hpReadout = text('100/100', { size: 7, font: 'pixel', fill: COLORS.bone });
    this.hpReadout.x = 108;
    this.hpReadout.y = 10;
    this.vitals.addChild(this.hpReadout);
    this.mpReadout = text('60/60', { size: 7, font: 'pixel', fill: COLORS.ghost });
    this.mpReadout.x = 108;
    this.mpReadout.y = 23;
    this.vitals.addChild(this.mpReadout);

    this.levelText = text('LV 1', { size: 8, font: 'pixel', fill: COLORS.gold, anchorX: 1 });
    this.levelText.x = 112;
    this.levelText.y = 42;
    this.vitals.addChild(this.levelText);

    /* --- objective, top-centre -------------------------------------- */
    this.objectiveBox = new Container();
    this.objectiveBox.x = VIEW_W / 2;
    this.objectiveBox.y = MARGIN + 4;
    this.root.addChild(this.objectiveBox);
    this.objectiveTxt = text('FIND THE SHATTERED WARDEN', {
      size: 7,
      font: 'pixel',
      fill: COLORS.goldDim,
      align: 'center',
      anchor: 0.5,
      letterSpacing: 1,
    });
    this.objectiveBox.addChild(this.objectiveTxt);
    const objLine = new Graphics();
    objLine.moveTo(-70, 10).lineTo(70, 10).stroke({ width: 1, color: 0x6b4a2a, alpha: 0.8 });
    this.objectiveBox.addChild(objLine);

    /* --- minimap, top-right ----------------------------------------- */
    this.mapBox = new Container();
    this.mapBox.x = VIEW_W - MARGIN - 78;
    this.mapBox.y = MARGIN - 8;
    this.root.addChild(this.mapBox);
    this.mapBox.addChild(hudPlate(78, 78, { fill: 0x0d0a12, fillAlpha: 0.9 }));
    this.mapCanvas = new Graphics();
    this.mapCanvas.x = 4;
    this.mapCanvas.y = 4;
    this.mapBox.addChild(this.mapCanvas);
    this.mapScale = 70 / Math.max(world.dungeon.cols, world.dungeon.rows);
    this.mapTick = 0;

    this.soulsBox = new Container();
    this.soulsBox.x = VIEW_W - MARGIN - 4;
    this.soulsBox.y = MARGIN + 80;
    this.root.addChild(this.soulsBox);
    const soulIcon = new Sprite(get('item_soul'));
    soulIcon.anchor.set(1, 0.5);
    soulIcon.width = 10;
    soulIcon.height = 10;
    soulIcon.x = 0;
    soulIcon.y = 6;
    this.soulsBox.addChild(soulIcon);
    this.soulsTxt = text('0', { size: 10, font: 'pixel', fill: COLORS.gold, anchorX: 1 });
    this.soulsTxt.x = -13;
    this.soulsTxt.y = 1;
    this.soulsBox.addChild(this.soulsTxt);

    /* --- ability / item slots, bottom-centre ------------------------ */
    this.slots = new Container();
    this.slots.x = VIEW_W / 2;
    this.slots.y = VIEW_H - 42;
    this.root.addChild(this.slots);
    this.slotDefs = [
      { key: input.prompt('attack', 'J'), icon: 'ui_cursor', label: 'SLASH' },
      { key: input.prompt('cast', 'K'), icon: 'fx_burst', label: 'EMBER' },
      { key: input.prompt('dash', 'SHIFT'), icon: 'fx_smoke', label: 'ROLL' },
      { key: input.prompt('interact', 'E'), icon: 'item_potion_hp', label: 'FLASK' },
    ];
    this.slotNodes = [];
    const slotW = 34;
    const gap = 6;
    const totalW = this.slotDefs.length * slotW + (this.slotDefs.length - 1) * gap;
    this.slotDefs.forEach((def, i) => {
      const g = new Container();
      g.x = -totalW / 2 + i * (slotW + gap);
      const plate = new Graphics();
      plate.roundRect(0, 0, slotW, slotW, 3).fill({ color: 0x140f18, alpha: 0.86 }).stroke({ width: 1, color: 0x8a6a44 });
      g.addChild(plate);
      const icon = new Sprite(get(def.icon));
      icon.width = 16;
      icon.height = 16;
      icon.x = slotW / 2 - 8;
      icon.y = 6;
      g.addChild(icon);
      const cap = glyphCap(def.key.replace(/[[\]]/g, '').slice(0, 5));
      cap.x = 3;
      cap.y = 23;
      g.addChild(cap);
      const count = text('', { size: 8, font: 'pixel', fill: COLORS.gold, align: 'right', anchorX: 1 });
      count.x = slotW - 4;
      count.y = 23;
      g.addChild(count);
      this.slots.addChild(g);
      this.slotNodes.push({ node: g, icon, count, cooldown: new Graphics() });
    });

    /* --- tutorial / prompt line, bottom-left ----------------------- */
    this.promptBox = new Container();
    this.promptBox.x = MARGIN;
    this.promptBox.y = VIEW_H - 13;
    this.root.addChild(this.promptBox);
    this.promptTxt = text('', { size: 8, font: 'pixel', fill: COLORS.boneDim, alpha: 0.9 });
    this.promptBox.addChild(this.promptTxt);
    this.promptT = 0;

    /* --- toast column, right edge ---------------------------------- */
    this.toasts = new Container();
    this.toasts.x = VIEW_W - MARGIN;
    this.toasts.y = 108;
    this.root.addChild(this.toasts);
    this.toastItems = [];

    /* --- boss bar -------------------------------------------------- */
    this.bossBox = new Container();
    this.bossBox.x = VIEW_W / 2;
    this.bossBox.y = VIEW_H - 62;
    this.bossBox.visible = false;
    this.root.addChild(this.bossBox);
    this.bossName = text('THE SHATTERED WARDEN', { size: 11, font: 'title', fill: COLORS.arcane, anchor: 0.5, letterSpacing: 2 });
    this.bossName.y = -12;
    this.bossBox.addChild(this.bossName);
    this.bossBar = new StatBar({ width: 220, height: 8, fillTint: 0xc8414a, ghostColor: 0xffffff });
    this.bossBar.x = -110;
    this.bossBox.addChild(this.bossBar);

    /* --- combat vignette flash ------------------------------------- */
    // Real edge vignette: nested frames that fade inward, so taking a hit
    // reddens the borders instead of washing the whole screen with colour.
    this.hurtVignette = new Graphics();
    const bands = 16;
    for (let i = 0; i < bands; i++) {
      const k = 1 - i / bands;
      const a = 0.09 * k * k;
      const inset = i * 3;
      this.hurtVignette
        .rect(inset, inset, VIEW_W - inset * 2, 3)
        .fill({ color: 0xb3243a, alpha: a });
      this.hurtVignette
        .rect(inset, VIEW_H - inset - 3, VIEW_W - inset * 2, 3)
        .fill({ color: 0xb3243a, alpha: a });
      this.hurtVignette
        .rect(inset, inset, 3, VIEW_H - inset * 2)
        .fill({ color: 0xb3243a, alpha: a });
      this.hurtVignette
        .rect(VIEW_W - inset - 3, inset, 3, VIEW_H - inset * 2)
        .fill({ color: 0xb3243a, alpha: a });
    }
    this.hurtVignette.alpha = 0;
    this.root.addChildAt(this.hurtVignette, 0);
    this.hurtPulse = 0;

    this.syncFromWorld(true);
    this.updatePrompts();
  }

  get node() {
    return this.root;
  }

  notify(msg, { color = COLORS.bone } = {}) {
    const item = new Container();
    const plate = panel(132, 20, { id: 'ui_panel_inset', inset: true, alpha: 0.9 });
    plate.pivot.set(132, 0);
    item.addChild(plate);
    const t = text(msg, { size: 8, font: 'pixel', fill: color, anchorX: 1 });
    t.x = -8;
    t.y = 6;
    item.addChild(t);
    item.x = 132;
    item.alpha = 0;
    this.toasts.addChild(item);
    this.toastItems.push({ node: item, t: 0, life: 2600 });
    this.toastItems.forEach((it, i) => {
      it.targetY = i * 24;
    });
  }

  updatePrompts() {
    const w = this.world;
    const p = w.player;
    if (p.level === 1 && w.elapsed < 9000) {
      this.promptTxt.text = `${input.prompt('up', 'MOVE')}   ${input.prompt('attack', 'ATTACK')}   ${input.prompt('cast', 'EMBER')}   ${input.prompt('dash', 'ROLL')}`;
    } else if (w.elapsed < 26000 && w.player.potions > 0) {
      this.promptTxt.text = `${input.prompt('interact', 'OPEN CHEST')}   ${input.prompt('cast', 'EMBER')} COSTS AETHER`;
    } else {
      this.promptTxt.text = '';
    }
  }

  syncFromWorld(instant = false) {
    const p = this.world.player;
    this.hpBar.setValue(p.hp / p.maxHp, { instant });
    this.hpReadout.text = `${Math.ceil(p.hp)}/${p.maxHp}`;
    this.mpBar.setValue(p.mp / p.maxMp, { instant });
    this.mpReadout.text = `${Math.floor(p.mp)}/${p.maxMp}`;
    this.levelText.text = `LV ${p.level}`;
    this.soulsTxt.text = `${p.souls}`;
    this.slotNodes[3].count.text = `${p.potions}`;
    this.objectiveTxt.text = this.world.objective;
  }

  onEvent(ev) {
    switch (ev.type) {
      case 'player-hit':
        this.hurtVignette.alpha = 0.85;
        this.combatT = 3200;
        this.syncFromWorld();
        break;
      case 'souls':
        this.soulsTxt.text = `${ev.souls}`;
        break;
      case 'level-up':
        this.notify(`LEVEL ${ev.level} REACHED`, { color: COLORS.gold });
        this.syncFromWorld();
        break;
      case 'potion-used':
        this.slotNodes[3].count.text = `${ev.potions}`;
        break;
      case 'boss-spawn':
        this.bossBox.visible = true;
        this.bossName.text = 'THE SHATTERED WARDEN';
        this.combatT = 4000;
        break;
      case 'boss-died':
        this.bossBox.visible = false;
        break;
      default:
        break;
    }
  }

  update(dtMs) {
    const w = this.world;
    const p = w.player;
    this.hpBar.update(dtMs);
    this.mpBar.update(dtMs);
    this.syncFromWorld();
    this.combatT = Math.max(0, this.combatT - dtMs);
    this.hurtVignette.alpha = Math.max(0, this.hurtVignette.alpha - dtMs * 0.0012);

    // HUD breathing: full while fighting or hurt, 0.55 while exploring
    const combatish = this.combatT > 0 || w.enemies.some((e) => e.aggro && Math.hypot(e.x - p.x, e.y - p.y) < 150);
    this.targetAlpha = combatish ? 1 : 0.62;
    this.root.alpha += (this.targetAlpha - this.root.alpha) * Math.min(1, dtMs * 0.004);

    if (this.bossBox.visible) {
      const boss = w.enemies.find((e) => e.isBoss);
      if (boss) this.bossBar.setValue(boss.hp / boss.maxHp);
      this.bossBar.update(dtMs);
    }

    // minimap redraw at 8fps is plenty
    this.mapTick += dtMs;
    if (this.mapTick > 120) {
      this.mapTick = 0;
      this.drawMinimap();
    }

    // prompt line pulses in
    this.promptT += dtMs;
    this.promptBox.alpha = 0.55 + Math.sin(this.promptT * 0.003) * 0.15;

    // toasts
    for (let i = this.toastItems.length - 1; i >= 0; i--) {
      const it = this.toastItems[i];
      it.t += dtMs;
      const k = it.t / it.life;
      it.node.alpha = k < 0.12 ? k / 0.12 : k > 0.8 ? (1 - k) / 0.2 : 1;
      it.node.x = 132 + (1 - Math.min(1, k / 0.15)) * 24;
      const ty = (it.targetY ?? 0) * (1 - Math.min(1, k * 3));
      it.node.y += (ty - it.node.y) * Math.min(1, dtMs * 0.012);
      if (k >= 1) {
        it.node.destroy();
        this.toastItems.splice(i, 1);
      }
    }
  }

  drawMinimap() {
    const d = this.world.dungeon;
    const g = this.mapCanvas;
    const s = 70 / Math.max(d.cols, d.rows);
    g.clear();
    for (const r of d.rooms) {
      g.rect(r.x * s, r.y * s, r.w * s, r.h * s).fill({ color: 0x6b5a44, alpha: 0.55 });
    }
    // boss room glows
    const br = d.bossRoom;
    g.rect(br.x * s, br.y * s, br.w * s, br.h * s).fill({ color: 0x8e1f2f, alpha: 0.5 });
    for (const e of this.world.enemies) {
      g.circle((e.x / TILE) * s, (e.y / TILE) * s, 1).fill({ color: e.isBoss ? 0xc3aaff : 0xc8414a, alpha: 0.9 });
    }
    const p = this.world.player;
    g.circle((p.x / TILE) * s, (p.y / TILE) * s, 1.6).fill(0xffe9b0);
    g.circle((p.x / TILE) * s, (p.y / TILE) * s, 3).stroke({ width: 0.7, color: 0xffe9b0, alpha: 0.5 });
  }
}
