// ---------------------------------------------------------------------------
//  assets.config.mjs — the single source of truth for every asset the game
//  uses.  `tools/fetch-assets.mjs` reads this table and produces
//  assets.manifest.json + LICENSES.md, which are the ONLY things the game
//  itself reads.  No asset URL appears anywhere inside src/.
// ---------------------------------------------------------------------------

export const SOURCES = {
  dcss: {
    label: 'Dungeon Crawl Stone Soup sprite set (via "CC0 Public Domain Sprites") — monsters, dungeon, items, effects, player doll',
    author: 'Dungeon Crawl Stone Soup team & contributors (CC0 release), packaged by Papyszoo',
    source_page: 'https://github.com/Papyszoo/CC0-Public-Domain-Sprites',
    license: 'CC0-1.0',
    license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attribution_required: false,
    noncommercial_only: false,
    repo: 'Papyszoo/CC0-Public-Domain-Sprites',
    branch: 'main',
    clone: true,
  },
  superpowers: {
    label: 'Superpowers "Medieval Fantasy" UI / HUD / effects + Juhani Junkala "Retro Game Music Pack"',
    author: 'Superpowers (Sparklin Labs), music by Juhani Junkala, CC0 release via Academe Play',
    source_page: 'https://github.com/skillmoph/academe-play-assets',
    license: 'CC0-1.0',
    license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attribution_required: false,
    noncommercial_only: false,
    repo: 'skillmoph/academe-play-assets',
    branch: 'main',
    clone: true,
  },
  freesfx: {
    label: 'Free Game SFX archive — "Retro SFX by Juhani Junkala" (CC0)',
    author: 'Juhani Junkala and other public-domain contributors',
    source_page: 'https://github.com/JanTheLynx/free-game-sfx',
    license: 'CC0-1.0',
    license_url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attribution_required: false,
    noncommercial_only: false,
    repo: 'JanTheLynx/free-game-sfx',
    branch: 'master',
    clone: true,
    sparse: ['sound/Retro-SFX-By-Juhani-Junkala'],
  },
  drive: {
    label: '本質images — first-party character illustrations (Google Drive)',
    author: 'Project author (Google Drive folder "本質images")',
    source_page: 'https://drive.google.com/drive/folders/1orOhHZFKvQxrvtSM7XYYNyKD3ATtc88Y',
    license: 'first-party, personal use only',
    license_url: null,
    attribution_required: false,
    noncommercial_only: true,
    repo: null,
  },
  fontsource: {
    label: 'Google Fonts — Press Start 2P, DotGothic16 (Fontsource 5.x, OFL-1.1)',
    author: 'Press Start 2P: CodeMan38 · DotGothic16: Fontworks Inc.',
    source_page: 'https://fontsource.org/',
    license: 'OFL-1.1',
    license_url: 'https://openfontlicense.org/',
    attribution_required: false,
    noncommercial_only: false,
    repo: null,
  },
  drive_local: {
    label: '本質images — first-party character illustrations from Google Drive (checked into assets/source/drive/ by the author)',
    author: 'Project author (Google Drive folder "本質images")',
    source_page: 'https://drive.google.com/drive/folders/1OrOhHZFKvQxrvtSM7XYYNyKD3ATtc88Y',
    license: 'first-party, personal use only',
    license_url: null,
    attribution_required: false,
    noncommercial_only: true,
    repo: null,
  },
  local: {
    label: 'Bundled with this project (vendored libraries)',
    author: 'PixiJS contributors, James Simpson',
    source_page: 'https://github.com/pixijs/pixijs',
    license: 'MIT',
    license_url: 'https://opensource.org/license/mit',
    attribution_required: true,
    noncommercial_only: false,
    repo: null,
  },
};

export const NPM_PACKAGES = {
  pixi: { pkg: 'pixi.js', version: '7.4.3' },
  howler: { pkg: 'howler', version: '2.2.4' },
  dotgothic: { pkg: '@fontsource/dotgothic16', version: '5.3.1' },
  pressstart: { pkg: '@fontsource/press-start-2p', version: '5.0.0' },
};

export const DRIVE_IDS = {
  'chr_ryoma_01_tsuujou.png': '1lavEzKxWf8H3Z7by9Uatw_R3yJGx6Fh3',
  'chr_ryoma_07_shinken_ketsui.png': '1c-O85ZUL7ZtC7G7XoxH0CBG3GKX8XfKz',
  'chr_ryoma_02_niyari.png': '1HERWf5D4sGJnxqRUNbB1MIwAOQz_abvV',
  'chr_izumi_04_ketsui.png': '13YsUpw4MCZtzDHeMDAkTY6DC0eBaNFPX',
  'chr_izumi_03_kinchou.png': '1jvFMNh7BNHZuxyoBzOSCvOGN2kkJqJIY',
  'chr_mie_07_honki_shinken.png': '1ej3fiuAzkv575SvmN2rXnT8bAAawjMEV',
  'chr_mie_01_reishou.png': '1jzNPRj2Kd3unenU-syn5PRBX6IuX44nR',
  'chr_mitsumine_01_tsuujou.png': '1-fs4P4M5-PyiIEDuYHbWII49UIkks_8f',
  'chr_satou_02_muhyoujou.png': '1ruDlIyBZaRMzk1ra-enT2vNME0W6AxcP',
  'chr_satou_01_game_gyoushi.png': '1B_st80Ikt7_KSHkvJOEnBzAYiSRTynaR',
  'chr_kuraishi_03_chousa_shinken.png': '17Eocp9hH-Nkd1mLArfVRsOx_qaWGe96G',
  'chr_katsuya_06_katai_muhyoujou.png': '1VZ8FlmAeJe7-lp3crW4QD-AImjzf_ka-',
  'chr_naitou_01_tsuujou.png': '111dinaI8aYXkN4ccZbz0AbmnXftKEmIK',
  'chr_rei_01_suzushii.png': '1YoPknUIg2pZA-fYQorhmcMNHonIhmcxU',
  'chr_terachi_01_nemusou.png': '11PsQlpP4Hmi5bXiQGG9APTit3L4_ydFM',
  'chr_meshino_05_eigo_doya.png': '1eSOcf8piyrqdeIHqS9gAC9GxmqOF6EDH',
  'chr_sakura_05_egao.png': '1TguouIKC-i1gPqjDjCqgNs8qZ1lvJwp4',
  'chr_inaba_01_furushashin_hohoemi.png': '1LuV7U-llRUA5di1AmzAa2fJ2WO7gIVt6',
};

// ---------------------------------------------------------------------------
//  Art sources.  `sprite` = one 32x32 transparent PNG, `sheet` = an animation
//  strip cut on a uniform grid, `image` = a plain picture.
// ---------------------------------------------------------------------------
const DC = (p) => `packs/${p}`;
const SP = (f) => `Superpowers__medieval-fantasy__${f}`;
const CC = (p) => `packs/${p}`;
const SFX = (f) => `sound/Retro-SFX-By-Juhani-Junkala/${f}`;

// 32x32 still sprites copied verbatim (monsters, dungeon props, items)
const STILLS = {
  // ---- enemies: the wraiths / husks that leak out of the 本質
  mon_wraith: 'dcss-monsters-and-creatures/sprites/undead/wraith.png',
  mon_shadow_wraith: 'dcss-monsters-and-creatures/sprites/undead/shadow_wraith.png',
  mon_freezing_wraith: 'dcss-monsters-and-creatures/sprites/undead/freezing_wraith.png',
  mon_ghost: 'dcss-monsters-and-creatures/sprites/undead/ghost.png',
  mon_phantom: 'dcss-monsters-and-creatures/sprites/undead/phantom.png',
  mon_flayed_ghost: 'dcss-monsters-and-creatures/sprites/undead/flayed_ghost.png',
  mon_hungry_ghost: 'dcss-monsters-and-creatures/sprites/undead/hungry_ghost.png',
  mon_lich: 'dcss-monsters-and-creatures/sprites/undead/lich.png',
  mon_ancient_lich: 'dcss-monsters-and-creatures/sprites/undead/ancient_lich.png',
  mon_reaper: 'dcss-monsters-and-creatures/sprites/demons/reaper.png',
  mon_executioner: 'dcss-monsters-and-creatures/sprites/demons/executioner.png',
  mon_imp: 'dcss-monsters-and-creatures/sprites/demons/imp.png',
  mon_iron_imp: 'dcss-monsters-and-creatures/sprites/demons/iron_imp.png',
  mon_shadow_dragon: 'dcss-monsters-and-creatures/sprites/shadow_dragon.png',
  mon_eye_devastation: 'dcss-monsters-and-creatures/sprites/eye_of_devastation.png',
  mon_giant_eyeball: 'dcss-monsters-and-creatures/sprites/giant_eyeball.png',
  mon_curse_skull: 'dcss-monsters-and-creatures/sprites/undead/curse_skull.png',
  mon_gargoyle: 'dcss-monsters-and-creatures/sprites/nonliving/gargoyle.png',
  mon_insubstantial_wisp: 'dcss-monsters-and-creatures/sprites/nonliving/insubstantial_wisp.png',
  mon_shadow: 'dcss-monsters-and-creatures/sprites/undead/shadow.png',
  mon_necrophage: 'dcss-monsters-and-creatures/sprites/undead/necrophage.png',
  mon_rotting_hulk: 'dcss-monsters-and-creatures/sprites/undead/rotting_hulk.png',
  mon_abomination: 'dcss-monsters-and-creatures/sprites/demons/abomination_large.png',
  mon_chaos_spawn: 'dcss-monsters-and-creatures/sprites/demons/chaos_spawn.png',
  mon_cacodemon: 'dcss-monsters-and-creatures/sprites/demons/cacodemon.png',
  mon_lemure: 'dcss-monsters-and-creatures/sprites/demons/lemure.png',
  mon_quasit: 'dcss-monsters-and-creatures/sprites/demons/quasit.png',
  mon_boggart: 'dcss-monsters-and-creatures/sprites/boggart.png',
  mon_deformed_human: 'dcss-monsters-and-creatures/sprites/deformed_human.png',
  mon_simulacrum: 'dcss-monsters-and-creatures/sprites/undead/simulacrum_small.png',
  mon_spectral: 'dcss-monsters-and-creatures/sprites/undead/spectral_warrior.png',
  mon_orb_destruction: 'dcss-monsters-and-creatures/sprites/nonliving/orb_of_destruction1.png',
  mon_ball_lightning: 'dcss-monsters-and-creatures/sprites/nonliving/ball_lightning.png',
  mon_fire_vortex: 'dcss-monsters-and-creatures/sprites/nonliving/fire_vortex.png',
  mon_vapour: 'dcss-monsters-and-creatures/sprites/nonliving/vapour.png',

  // ---- floor / wall tiles (the missing corn-soup vending machine room)
  tile_floor_a: 'dcss-dungeon-environments/sprites/floor/cobble_blood1.png',
  tile_floor_b: 'dcss-dungeon-environments/sprites/floor/cobble_blood4.png',
  tile_floor_c: 'dcss-dungeon-environments/sprites/floor/cobble_blood7.png',
  tile_floor_d: 'dcss-dungeon-environments/sprites/floor/cobble_blood11.png',
  tile_floor_e: 'dcss-dungeon-environments/sprites/floor/sandstone_floor0.png',
  tile_floor_f: 'dcss-dungeon-environments/sprites/floor/grey_dirt0.png',
  tile_wall_a: 'dcss-dungeon-environments/sprites/wall/brick_brown0.png',
  tile_wall_b: 'dcss-dungeon-environments/sprites/wall/brick_brown3.png',
  tile_wall_c: 'dcss-dungeon-environments/sprites/wall/brick_brown7.png',
  tile_wall_d: 'dcss-dungeon-environments/sprites/wall/brick_dark0.png',
  tile_wall_e: 'dcss-dungeon-environments/sprites/wall/brick_brown5.png',
  torch_0: 'dcss-dungeon-environments/sprites/wall/torches/torch0.png',
  torch_1: 'dcss-dungeon-environments/sprites/wall/torches/torch1.png',
  torch_2: 'dcss-dungeon-environments/sprites/wall/torches/torch2.png',
  torch_3: 'dcss-dungeon-environments/sprites/wall/torches/torch3.png',
  torch_4: 'dcss-dungeon-environments/sprites/wall/torches/torch4.png',
  prop_statue: 'dcss-dungeon-environments/sprites/dngn_granite_statue.png',
  prop_column: 'dcss-dungeon-environments/sprites/crumbled_column.png',
  prop_fountain: 'dcss-dungeon-environments/sprites/dngn_blood_fountain.png',
  prop_door_closed: 'dcss-dungeon-environments/sprites/dngn_closed_door.png',
  gateway_zot: 'dcss-dungeon-environments/sprites/gateways/dngn_enter_zot_closed.png',
  gateway_abyss: 'dcss-dungeon-environments/sprites/gateways/dngn_enter_abyss.png',
  deco_bones: 'dcss-dungeon-environments/sprites/floor/cobble_blood9.png',
  deco_candle: 'dcss-dungeon-environments/sprites/floor/cobble_blood3.png',
  deco_blood: 'dcss-dungeon-environments/sprites/floor/cobble_blood2.png',
  deco_altar: 'dcss-dungeon-environments/sprites/altars/dngn_altar.png',

  // ---- named monsters (boss / elite ladder) from the DCSS unique roster
  boss_headmaster: 'dcss-monsters-and-creatures/sprites/unique/ilsuiw.png',
  boss_dean: 'dcss-monsters-and-creatures/sprites/unique/azrael.png',
  boss_dragon: 'dcss-monsters-and-creatures/sprites/dragon.png',
  boss_lich: 'dcss-monsters-and-creatures/sprites/unique/dispater.png',
  boss_demon: 'dcss-monsters-and-creatures/sprites/demons/pit_fiend.png',
  boss_hydra: 'dcss-monsters-and-creatures/sprites/unique/lernaean_hydra.png',
  mon_hell_knight: 'dcss-monsters-and-creatures/sprites/hell_knight.png',
  mon_deep_elf_knight: 'dcss-monsters-and-creatures/sprites/deep_elf_knight.png',
  mon_elf: 'dcss-monsters-and-creatures/sprites/elf.png',
  mon_bone_dragon: 'dcss-monsters-and-creatures/sprites/undead/bone_dragon.png',
  mon_wight: 'dcss-monsters-and-creatures/sprites/undead/wight.png',
  mon_mummy: 'dcss-monsters-and-creatures/sprites/undead/mummy.png',

  // ---- pickups / drops
  drop_potion: 'dcss-items-and-equipment/sprites/potion/brilliant_blue.png',
  drop_potion_hp: 'dcss-items-and-equipment/sprites/potion/ruby.png',
  drop_scroll: 'dcss-items-and-equipment/sprites/book/gold.png',
  drop_gold: 'dcss-items-and-equipment/sprites/misc/gold_pile.png',
  drop_gem: 'dcss-items-and-equipment/sprites/misc/misc_crystal.png',
  drop_soup: 'dcss-items-and-equipment/sprites/food/meat_ration.png',

  // ---- spell / impact effects
  fx_fireball: 'devwizard-pixel-art-spells/sprites/fireball (16x16).png',
  fx_darkness_orb: 'devwizard-pixel-art-spells/sprites/darkness-orb (16x16).png',
  fx_darkness_bolt: 'devwizard-pixel-art-spells/sprites/darkness-bolt (16x16).png',
  fx_magic_orb: 'devwizard-pixel-art-spells/sprites/magic-orb (16x16).png',
  fx_magic_ray: 'devwizard-pixel-art-spells/sprites/magic-ray (16x16).png',
  fx_arcane_bolt: 'devwizard-pixel-art-spells/sprites/arcane-bolt (16x16).png',
  fx_ice_lance: 'devwizard-pixel-art-spells/sprites/ice-lance (16x16).png',
  fx_shield: 'devwizard-pixel-art-spells/sprites/pixelart-shield (48x48).png',
  fx_splash: 'devwizard-pixel-art-spells/sprites/splash (32x32).png',
  fx_smoke: 'dcss-characters-and-spells/sprites/effect/cloud_black_smoke.png',
  fx_miasma: 'dcss-characters-and-spells/sprites/effect/cloud_miasma.png',
  fx_bolt: 'dcss-characters-and-spells/sprites/effect/bolt04.png',
  fx_arrow: 'dcss-characters-and-spells/sprites/effect/arrow3.png',

  // ---- UI chrome
  ui_slot: 'kenney-ui-pack/sprites/Grey/Default/button_rectangle_depth_border.png',
};

//  Name of the entity keeps the arcade side honest: every wraith is an idea.
//  Some DCSS "monsters" are really 3-frame pulses, so they ship as strips.
const PULSE = new Set(['mon_wraith', 'mon_shadow_wraith', 'mon_freezing_wraith', 'mon_phantom', 'mon_lich', 'mon_ancient_lich', 'mon_reaper', 'mon_vapour', 'mon_insubstantial_wisp', 'mon_ball_lightning', 'mon_fire_vortex', 'mon_shadow']);
const SPELLS = new Set(['fx_fireball', 'fx_darkness_orb', 'fx_darkness_bolt', 'fx_magic_orb', 'fx_magic_ray', 'fx_arcane_bolt', 'fx_ice_lance', 'fx_splash', 'fx_shield']);
const UI = new Set(['ui_box_small', 'ui_box_medium', 'ui_slot16', 'ui_slot16b', 'ui_bar_full', 'ui_bar_empty', 'ui_heart_full', 'ui_heart_empty', 'ui_tileset']);

const FILE_LIST = [
  ...Object.entries(STILLS).map(([id, remote]) => ({
    id, type: 'sprite', src: 'dcss', remote: DC(remote), local: `assets/img/${id}.png`,
  })),

  // ---- the player avatar (DCSS "player doll", 32x32 pieces layered at runtime)
  // The player doll is layered exactly the way DCSS layers it: base → body →
  // cloak → head → hair, each its own 32px sprite.
  ...[
    ['base/human_m', 'pc_base'],
    ['body/chainmail', 'pc_body'],
    ['cloak/black', 'pc_cloak'],
    ['head/chain', 'pc_head'],
    ['head/ninja_black', 'pc_hair'],
  ].map(([part, id]) => ({
    id, type: 'sprite', src: 'dcss',
    remote: DC(`dcss-characters-and-spells/sprites/player/${part}.png`),
    local: `assets/img/${id}.png`, optional: true,
  })),

  // ---- UI / HUD from Superpowers
  { id: 'ui_box_small', type: 'sprite', src: 'superpowers', remote: SP('hud__little-box.png'), local: 'assets/img/ui_box_small.png' },
  { id: 'ui_box_medium', type: 'sprite', src: 'superpowers', remote: SP('hud__medium-box.png'), local: 'assets/img/ui_box_medium.png' },
  { id: 'ui_slot16', type: 'sprite', src: 'superpowers', remote: SP('hud__1.png'), local: 'assets/img/ui_slot16.png' },
  { id: 'ui_slot16b', type: 'sprite', src: 'superpowers', remote: SP('hud__2.png'), local: 'assets/img/ui_slot16b.png' },
  { id: 'ui_bar_full', type: 'sprite', src: 'superpowers', remote: SP('hud__life-box.png'), local: 'assets/img/ui_bar_full.png' },
  { id: 'ui_bar_empty', type: 'sprite', src: 'superpowers', remote: SP('hud__life-box-empty.png'), local: 'assets/img/ui_bar_empty.png' },
  { id: 'ui_bar_full_wide', type: 'sprite', src: 'superpowers', remote: SP('hud__life-box-2.png'), local: 'assets/img/ui_bar_full_wide.png' },
  { id: 'ui_bar_empty_wide', type: 'sprite', src: 'superpowers', remote: SP('hud__life-box-empty-2.png'), local: 'assets/img/ui_bar_empty_wide.png' },
  { id: 'ui_heart_full', type: 'sprite', src: 'superpowers', remote: SP('hud__full-heart.png'), local: 'assets/img/ui_heart_full.png' },
  { id: 'ui_heart_empty', type: 'sprite', src: 'superpowers', remote: SP('hud__empty-heart.png'), local: 'assets/img/ui_heart_empty.png' },
  { id: 'ui_emblem_sheet', type: 'image', src: 'superpowers', remote: SP('items__emblem__all.png'), local: 'assets/img/ui_emblem_sheet.png' },
  { id: 'ui_weapon_sheet', type: 'image', src: 'superpowers', remote: SP('items__weapon__weapon.png'), local: 'assets/img/ui_weapon_sheet.png' },
  { id: 'ui_tileset', type: 'image', src: 'superpowers', remote: SP('background-elements__0-tileset.png'), local: 'assets/img/ui_tileset.png' },
  { id: 'ui_coin_anim', type: 'sheet', src: 'superpowers', remote: SP('items__gold-&-gem__coin.png'), local: 'assets/img/ui_coin_anim.png', grid: [1, 1] },
  ...[1, 2, 3, 4, 5].map((i) => ({
    id: `ui_fx_${i}`, type: 'sheet', src: 'superpowers',
    remote: SP(`fx__${i}.png`), local: `assets/img/ui_fx_${i}.png`, frameW: null,
  })),
  { id: 'ui_dungeon_0', type: 'image', src: 'superpowers', remote: SP('background-elements__17.png'), local: 'assets/img/ui_dungeon_0.png', optional: true },

  // ---- audio: music
  { id: 'bgm_title', type: 'audio', src: 'superpowers', remote: 'music__Juhani Junkala [Retro Game Music Pack] Title Screen.wav', local: 'assets/audio/bgm_title.ogg', transcode: 'ogg', loop: true, gain: 0.5 },
  { id: 'bgm_game', type: 'audio', src: 'superpowers', remote: 'music__Juhani Junkala [Retro Game Music Pack] Level 3.wav', local: 'assets/audio/bgm_game.ogg', transcode: 'ogg', loop: true, gain: 0.45 },
  { id: 'bgm_boss', type: 'audio', src: 'superpowers', remote: 'music__Juhani Junkala [Retro Game Music Pack] Level 1.wav', local: 'assets/audio/bgm_boss.ogg', transcode: 'ogg', loop: true, gain: 0.45, optional: true },
  { id: 'bgm_result', type: 'audio', src: 'superpowers', remote: 'music__Juhani Junkala [Retro Game Music Pack] Ending.wav', local: 'assets/audio/bgm_result.ogg', transcode: 'ogg', loop: true, gain: 0.5 },
  { id: 'bgm_theme1', type: 'audio', src: 'superpowers', remote: SP('music__theme-1.ogg'), local: 'assets/audio/bgm_theme1.ogg', loop: true, gain: 0.5 },
  { id: 'bgm_theme3', type: 'audio', src: 'superpowers', remote: SP('music__theme-3.ogg'), local: 'assets/audio/bgm_theme3.ogg', loop: true, gain: 0.5 },
  { id: 'bgm_theme5', type: 'audio', src: 'superpowers', remote: SP('music__theme-5.ogg'), local: 'assets/audio/bgm_theme5.ogg', loop: true, gain: 0.5 },
  { id: 'bgm_theme6', type: 'audio', src: 'superpowers', remote: SP('music__theme-6.ogg'), local: 'assets/audio/bgm_theme6.ogg', loop: true, gain: 0.5, optional: true },

  // ---- audio: SE (each id = one semantic sound; the mixer jitters pitch/gain)
  ...[
    ['se_move', 'General Sounds/Menu Sounds/sfx_menu_move1.wav'],
    ['se_move_b', 'General Sounds/Menu Sounds/sfx_menu_move3.wav'],
    ['se_ok', 'General Sounds/Menu Sounds/sfx_menu_select2.wav'],
    ['se_back', 'General Sounds/Menu Sounds/sfx_menu_select4.wav'],
    ['se_hit', 'General Sounds/Simple Damage Sounds/sfx_damage_hit5.wav'],
    ['se_hit_heavy', 'General Sounds/Simple Damage Sounds/sfx_damage_hit9.wav'],
    ['se_hurt', 'General Sounds/Negative Sounds/sfx_sounds_damage2.wav'],
    ['se_shot', 'Weapons/Lasers/sfx_wpn_laser6.wav'],
    ['se_slash', 'Weapons/Melee/sfx_wpn_sword1.wav'],
    ['se_explode', 'Explosions/Medium Length/sfx_exp_medium1.wav'],
    ['se_explode_big', 'Explosions/Long/sfx_exp_long4.wav'],
    ['se_coin', 'General Sounds/Coins/sfx_coin_single1.wav'],
    ['se_coin_double', 'General Sounds/Coins/sfx_coin_double3.wav'],
    ['se_heal', 'General Sounds/Positive Sounds/sfx_sounds_powerup3.wav'],
    ['se_power', 'General Sounds/Positive Sounds/sfx_sounds_powerup8.wav'],
    ['se_levelup', 'General Sounds/Fanfares/sfx_sounds_fanfare2.wav'],
    ['se_win', 'General Sounds/Fanfares/sfx_sounds_fanfare3.wav'],
    ['se_death', 'Death Screams/Robot/sfx_deathscream_robot2.wav'],
    ['se_lowhp', 'General Sounds/Alarms/Low health Alarms/sfx_lowhealth_alarmloop1.wav'],
    ['se_pause_in', 'General Sounds/Pause Sounds/sfx_sounds_pause3_in.wav'],
    ['se_pause_out', 'General Sounds/Pause Sounds/sfx_sounds_pause3_out.wav'],
    ['se_blip', 'General Sounds/Simple Bleeps/sfx_sounds_Blip2.wav'],
    ['se_blip_b', 'General Sounds/Simple Bleeps/sfx_sounds_Blip6.wav'],
    ['se_error', 'General Sounds/Negative Sounds/sfx_sounds_error4.wav'],
    ['se_charge', 'General Sounds/Positive Sounds/sfx_sounds_powerup10.wav'],
    ['se_dash', 'Movement/Portals and Transitions/sfx_movement_portal1.wav'],
    ['se_monster', 'General Sounds/Weird Sounds/sfx_sound_bling.wav'],
  ].map(([id, remote]) => ({
    id, type: 'audio', src: 'freesfx', remote: SFX(remote.replace(/^.*?(?=(General|Weapons|Explosions|Movement|Death))/s, '')), local: `assets/audio/${id}.ogg`, transcode: 'ogg',
  })),
  // Superpowers in-game sounds (monsters, victory, whooshes) + ambience
  ...['sounds__monster-1.wav', 'sounds__monster-2.wav', 'sounds__victory-1.wav', 'sounds__woosh-1.wav', 'sounds__woosh-2.wav'].map((f) => ({
    id: 'se_' + f.replace(/^sounds__/, '').replace('.wav', '').replace(/-/g, '_'),
    type: 'audio', src: 'superpowers', remote: SP(f), local: `assets/audio/se_sp_${f.replace(/^sounds__/, '').replace('.wav', '')}.ogg`, transcode: 'ogg',
  })),
  { id: 'amb_dungeon', type: 'audio', src: 'superpowers', remote: SP('sounds__forest-ambience.wav'), local: 'assets/audio/amb_dungeon.ogg', transcode: 'ogg', loop: true, gain: 0.22, optional: true },

  // ---- hi-res glow FX (64-frame 128px grids) and parallax skies
  { id: 'fx_torch_anim', type: 'image', src: 'dcss', remote: CC('ztn-fire-and-spell-animations/sprites/torch (128x128).png'), local: 'assets/img/fx_torch_anim.png', grid: [8, 8] },
  { id: 'fx_fireball_big', type: 'image', src: 'dcss', remote: CC('ztn-fire-and-spell-animations/sprites/fireball2 (128x128).png'), local: 'assets/img/fx_fireball_big.png', grid: [8, 8] },
  { id: 'fx_firewall', type: 'image', src: 'dcss', remote: CC('ztn-fire-and-spell-animations/sprites/firewall (128x128).png'), local: 'assets/img/fx_firewall.png', grid: [8, 8] },
  { id: 'fx_barrier', type: 'image', src: 'dcss', remote: CC('ztn-fire-and-spell-animations/sprites/barrier (128x128).png'), local: 'assets/img/fx_barrier.png', grid: [8, 8] },
  { id: 'fx_firespell', type: 'image', src: 'dcss', remote: CC('ztn-fire-and-spell-animations/sprites/firespell1 (128x128).png'), local: 'assets/img/fx_firespell.png', grid: [8, 8] },
  { id: 'fx_burst_a', type: 'image', src: 'dcss', remote: CC('para-animated-particle-effects-1/sprites/particlefx_09 (128x128).png'), local: 'assets/img/fx_burst_a.png', grid: [8, 8] },
  { id: 'fx_burst_b', type: 'image', src: 'dcss', remote: CC('para-animated-particle-effects-1/sprites/particlefx_03 (128x128).png'), local: 'assets/img/fx_burst_b.png', grid: [8, 8] },
  { id: 'fx_burst_c', type: 'image', src: 'dcss', remote: CC('para-animated-particle-effects-1/sprites/particlefx_11 (128x128).png'), local: 'assets/img/fx_burst_c.png', grid: [8, 8] },
  { id: 'bg_sky_night', type: 'image', src: 'dcss', remote: CC('sbs-seamless-sky-backgrounds/sprites/Bumpy_Sky-Night_02-512x512.png'), local: 'assets/img/bg_sky_night.png', optional: true },
  { id: 'bg_sky_dusk', type: 'image', src: 'dcss', remote: CC('sbs-seamless-sky-backgrounds/sprites/Bumpy_Sky-Sunset_02-512x512.png'), local: 'assets/img/bg_sky_dusk.png', optional: true },
  { id: 'bg_layer_forest', type: 'image', src: 'dcss', remote: CC('pixelboy-parallax-backgrounds/sprites/layers_1.png'), local: 'assets/img/bg_layer_forest.png' },
  { id: 'bg_layer_forest_far', type: 'image', src: 'dcss', remote: CC('pixelboy-parallax-backgrounds/sprites/layers_40.png'), local: 'assets/img/bg_layer_forest_far.png' },
  { id: 'bg_layer_cave', type: 'image', src: 'dcss', remote: CC('pixelboy-parallax-backgrounds/sprites/layers_100.png'), local: 'assets/img/bg_layer_cave.png' },
  { id: 'bg_layer_cave_far', type: 'image', src: 'dcss', remote: CC('pixelboy-parallax-backgrounds/sprites/layers_96.png'), local: 'assets/img/bg_layer_cave_far.png' },

  // ---- first-party illustrations from Drive /本質images
  ...Object.keys(DRIVE_IDS).map((file) => {
    const key = file.replace(/^chr_/, '').replace(/\.png$/, '');
    return {
      id: `art_${key}`, type: 'image', src: 'drive_local', remote: file,
      local: `assets/img/art_${key}.png`, crop: 'portrait',
    };
  }),
];
// Derived at load time so log lines carry a category instead of "undefined".
export const FILES = FILE_LIST.map((f) => {
  const type = f.type || (/\.(png|webp)$/i.test(f.local) ? 'sprite' : /\.(ogg|wav|mp3)$/i.test(f.local) ? 'audio' : 'image');
  if (type === 'sprite' && PULSE.has(f.id)) return { ...f, type, sheetH: 32, scale: 4 };
  if (SPELLS.has(f.id)) { const m = /^(.*?)(?:\((\d+)x(\d+)\))?\.png$/i.exec(f.local); return { ...f, type, sheetH: f.sheetH || 16, scale: 4 }; }
  if (type === 'sprite' && !f.scale) return { ...f, scale: UI.has(f.id) ? 2 : 4 };
  return { ...f, type };
});

// Fonts and libraries are placed by `tools/vendor.mjs` from node_modules so the
// build is reproducible without network access.
export const LOCAL_ASSETS = [
  { id: 'font_press_start', type: 'font', local_path: 'assets/fonts/press-start-2p.woff2', src: 'fontsource', family: 'Press Start 2P', weight: 400, script: 'latin' },
  { id: 'font_dotgothic', type: 'font', local_path: 'assets/fonts/dotgothic16-latin.woff2', src: 'fontsource', family: 'DotGothic16', weight: 400, script: 'latin' },
  { id: 'font_dotgothic_jp', type: 'font', local_path: 'assets/fonts/dotgothic16-jp.woff2', src: 'fontsource', family: 'DotGothic16', weight: 400, script: 'japanese' },
  { id: 'lib_pixi', type: 'library', local_path: 'public/vendor/pixi.min.js', src: 'local', version: 'pixi.js 7.4.3' },
  { id: 'lib_howler', type: 'library', local_path: 'public/vendor/howler.min.js', src: 'local', version: 'howler.js 2.2.4' },
];
