/**
 * Texture bank.
 *
 * `get(id)` walks the manifest tiers and always returns *some* texture:
 *
 *   user override -> local download -> procedural fallback
 *
 * Fonts are registered through the CSS font-loading API so Pixi's Text objects
 * can reference them by family name; if the font file is missing the family
 * resolves to the declared serif / monospace stack instead.
 */
import { Assets, Texture } from 'pixi.js';
import { entry, localUrlFor, markStatus, State, bootLog, userOverrides } from './assets.js';
import * as proc from './procedural.js';

const cache = new Map();
const pending = new Map();

const FALLBACK_FAMILY = {
  font_title: 'Georgia, "Times New Roman", serif',
  font_body: 'Georgia, "Times New Roman", serif',
  font_body_sc: 'Georgia, "Times New Roman", serif',
  font_pixel_ja: '"Hiragino Kaku Gothic ProN", "Yu Gothic", monospace',
};

const FALLBACK_TEXTURE = {
  // tiles
  tile_floor_stone: proc.floorTileTexture,
  tile_floor_brick: proc.floorTileTexture,
  tile_floor_dirt: proc.floorTileTexture,
  tile_wall_brick: proc.wallTileTexture,
  tile_wall_flat: proc.wallTileTexture,
  tile_blood: () => proc.glowTexture(32, '142,31,47'),
  // hero
  hero_warrior_s: proc.heroTexture,
  hero_warrior_s_walk: () => proc.heroWalkTexture(0),
  hero_warrior_s_walk2: () => proc.heroWalkTexture(1),
  hero_warrior_s_walk3: () => proc.heroWalkTexture(2),
  hero_warrior_e: proc.heroTexture,
  hero_warrior_e_walk: () => proc.heroWalkTexture(0),
  hero_warrior_e_walk2: () => proc.heroWalkTexture(1),
  hero_warrior_e_walk3: () => proc.heroWalkTexture(2),
  hero_warrior_n: proc.heroTexture,
  hero_warrior_n_walk: () => proc.heroWalkTexture(0),
  hero_warrior_w: proc.heroTexture,
  hero_warrior_w_walk: () => proc.heroWalkTexture(1),
  hero_warrior_w_walk2: () => proc.heroWalkTexture(0),
  hero_warrior_w_walk3: () => proc.heroWalkTexture(2),
  // foes
  foe_skeleton: () => proc.skeletonTexture(0),
  foe_skeleton_b: () => proc.skeletonTexture(1),
  foe_imp: () => proc.impTexture(0),
  foe_imp_b: () => proc.impTexture(1),
  foe_bat: () => proc.batTexture(0),
  foe_bat_b: () => proc.batTexture(1),
  foe_wraith: () => proc.wraithTexture(0),
  foe_wraith_b: () => proc.wraithTexture(1),
  foe_goblin: () => proc.impTexture(0),
  foe_goblin_b: () => proc.impTexture(1),
  foe_rat: () => proc.batTexture(0),
  foe_rat_b: () => proc.batTexture(1),
  foe_spider: () => proc.slimeTexture(0),
  foe_spider_b: () => proc.slimeTexture(1),
  foe_slime: () => proc.slimeTexture(0),
  foe_slime_b: () => proc.slimeTexture(1),
  foe_lich: () => proc.lichTexture(0),
  foe_lich_b: () => proc.lichTexture(1),
  foe_lich_king: () => proc.bossTexture(0),
  foe_lich_king_b: () => proc.bossTexture(1),
  foe_eye: proc.eyeTexture,
  // props
  prop_grave: proc.graveTexture,
  prop_grave_b: proc.graveTexture,
  prop_bones: proc.bonesTexture,
  prop_web: proc.webTexture,
  prop_coffin: proc.statueTexture,
  prop_candle: () => proc.candleTexture(0),
  prop_candle_b: () => proc.candleTexture(1),
  prop_statue: proc.statueTexture,
  prop_skull: proc.skullTexture,
  prop_chest_closed: () => proc.chestTexture(false),
  prop_chest_open: () => proc.chestTexture(true),
  // items
  item_coin: proc.coinTexture,
  item_potion_hp: () => proc.potionTexture('hp'),
  item_potion_mp: () => proc.potionTexture('mp'),
  item_soul: proc.soulTexture,
  // fx
  fx_sparks_a: () => proc.sparkTexture(false),
  fx_sparks_b: () => proc.sparkTexture(true),
  fx_burst: proc.burstTexture,
  fx_smoke: proc.smokeTexture,
  fx_fog: proc.fogTexture,
  fx_blood: () => proc.glowTexture(24, '142,31,47'),
  // ui
  ui_panel: () => proc.panelTexture(100, 100),
  ui_panel_inset: () => proc.panelTexture(93, 93),
  ui_button: () => proc.panelTexture(190, 49),
  ui_button_pressed: () => proc.panelTexture(190, 49),
  ui_cursor: () => proc.inputIconTexture('pad'),
  ui_cross: () => proc.inputIconTexture('cancel'),
  ui_bar_back: proc.floorTileTexture,
  ui_bar_red: () => proc.glowTexture(18, '200,65,74'),
  ui_bar_blue: () => proc.glowTexture(18, '111,211,216'),
  ui_arrow: () => proc.inputIconTexture('confirm'),
  logo_title: proc.skullTexture,
};

const imageLoad = [];

/** Kick off loading of every image-ish id. Safe to call more than once. */
export async function preloadImages(onProgress) {
  const ids = new Set([
    ...Object.keys(FALLBACK_TEXTURE),
    'ui_panel_inset',
    'ui_button_pressed',
  ]);
  const list = [...ids];
  let done = 0;
  const tasks = list.map(async (id) => {
    await ensureTexture(id);
    done++;
    onProgress?.(done, list.length, id);
  });
  await Promise.allSettled(tasks);
  return { total: list.length, done };
}

export async function ensureTexture(id) {
  if (cache.has(id)) return cache.get(id);
  if (pending.has(id)) return pending.get(id);

  const p = (async () => {
    const rec = entry(id);
    if (!rec) return fallbackTexture(id, 'not in manifest');
    if (rec.status === State.FALLBACK || rec.status === State.MISSING) {
      return fallbackTexture(id, 'manifest marks it unavailable');
    }

    const base = rec.local_path.split('/').pop();
    const candidates = [...(userOverrides(base) ? [`./assets/user/${base}`] : []), localUrlFor(id)];
    for (const url of candidates) {
      try {
        const tex = await Assets.load({ src: url, loadParser: 'loadTextures', data: { scaleMode: 'nearest' } });
        tex.source.scaleMode = 'nearest';
        cache.set(id, tex);
        markStatus(id, url.includes('/user/') ? State.USER : State.CACHED);
        imageLoad.push({ id, url, ok: true });
        return tex;
      } catch (err) {
        /* try the next tier */
      }
    }
    return fallbackTexture(id, 'all fetch tiers failed');
  })();

  pending.set(id, p);
  const tex = await p;
  pending.delete(id);
  return tex;
}

function fallbackTexture(id, reason) {
  const make = FALLBACK_TEXTURE[id];
  if (!make) {
    const t = Texture.WHITE;
    cache.set(id, t);
    return t;
  }
  const tex = make();
  cache.set(id, tex);
  markStatus(id, State.FALLBACK, { reason });
  imageLoad.push({ id, ok: false, reason });
  return tex;
}

export function get(id) {
  return cache.get(id) || fallbackTexture(id, 'synchronous request before preload');
}

/** ui nine-slice: return texture + slice so NineSliceSprite can be built. */
export function sliceInfo(id) {
  const rec = entry(id);
  return { texture: get(id), slice: rec?.slice || 12 };
}

export const FALLBACK_FONTS = FALLBACK_FAMILY;

export async function loadFonts(onProgress) {
  const faces = [
    { id: 'font_title', family: 'SC-Title', file: 'PirataOne-Regular.ttf', weight: '400' },
    { id: 'font_body', family: 'SC-Body', file: 'IMFeENrm28P.ttf', weight: '400' },
    { id: 'font_body_sc', family: 'SC-Body', file: 'IMFeENsc28P.ttf', weight: '600' },
    { id: 'font_pixel_ja', family: 'SC-Pixel', file: 'DotGothic16-Regular.ttf', weight: '400' },
  ];
  let done = 0;
  const results = await Promise.allSettled(
    faces.map(async (f) => {
      const rec = entry(f.id);
      const ok = rec && rec.status !== State.FALLBACK && rec.status !== State.MISSING;
      if (!ok) {
        markStatus(f.id, State.FALLBACK, { reason: 'font file absent' });
        bootLog.push(`[fonts] ${f.id} -> system fallback stack`);
        done++;
        onProgress?.(done, faces.length);
        return;
      }
      const urls = [...(userOverrides(f.file) ? [`./assets/user/${f.file}`] : []), `./${rec.local_path}`];
      for (const url of urls) {
        try {
          const face = new FontFace(f.family, `url(${url})`, { weight: f.weight, display: 'block' });
          await face.load();
          document.fonts.add(face);
          bootLog.push(`[fonts] ${f.id} loaded from ${url}`);
          done++;
          onProgress?.(done, faces.length);
          return;
        } catch {
          /* next tier */
        }
      }
      markStatus(f.id, State.FALLBACK, { reason: 'FontFace load failed' });
      bootLog.push(`[fonts] ${f.id} -> system fallback stack`);
      done++;
      onProgress?.(done, faces.length);
    })
  );
  await Promise.allSettled(results);
  return {
    title: document.fonts.check('16px SC-Title') ? 'SC-Title' : 'Georgia, serif',
    body: document.fonts.check('16px SC-Body') ? 'SC-Body' : 'Georgia, serif',
    pixel: document.fonts.check('16px SC-Pixel') ? 'SC-Pixel' : 'monospace',
  };
}

export function fontDiagnostics() {
  return {
    title: document.fonts.check('16px SC-Title'),
    body: document.fonts.check('16px SC-Body'),
    pixel: document.fonts.check('16px SC-Pixel'),
  };
}

export function loadReport() {
  return imageLoad.slice();
}
