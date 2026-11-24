#!/usr/bin/env python3
"""Generate assets.manifest.json from the curated, source-verified asset table.

No game code hard-codes asset URLs: the runtime resolves each `id` through this
manifest.  `url` is a pinned upstream file for the prefetch script and the
browser Cache API fallback; `local_path` is the checked-in local copy.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
KEN_SHA = "3694c6879e487c108f55677be7dd2ca75b07cc3b"
KEN_RAW = f"https://raw.githubusercontent.com/shorepine/kenney/{KEN_SHA}/"
KEN_BLOB = f"https://github.com/shorepine/kenney/blob/{KEN_SHA}/"
KEN_LICENSE = f"https://github.com/shorepine/kenney/blob/{KEN_SHA}/LICENSE.txt"
META_RAW = "https://raw.githubusercontent.com/facebookincubator/Meta-open-sound/main/"
META_ATTRIBUTION = "https://github.com/facebookincubator/Meta-open-sound/blob/main/corpora/oculus-audio-pack/ATTRIBUTION.md"
META_ORIGIN = "https://developers.meta.com/vr/downloads/package/oculus-audio-pack-1/"
META_CREDIT = (
    '"Oculus Audio Pack 01" by Oculus VR, LLC '
    "(https://developers.meta.com/vr/downloads/package/oculus-audio-pack-1/), "
    "licensed under CC BY 4.0. Files renamed to the UCS naming convention; "
    "OGG previews transcoded from the original WAVs."
)
DRIVE_FOLDER = "https://drive.google.com/drive/folders/1orOhHZFKvQxrvtSM7XYYNyKD3ATtc88Y"

CC0_CONDITIONS = "CC0 1.0: no attribution required; credit given voluntarily. Personal/commercial use, modification and redistribution permitted."
CCBY_CONDITIONS = "CC BY 4.0: include the attribution in ATTRIBUTION.md and the license notice; indicate modifications; no additional restrictions."
OFL_CONDITIONS = "SIL OFL 1.1: include the copyright notice and license; do not sell the font by itself; do not use a Reserved Font Name for modified versions."
MIT_CONDITIONS = "MIT: include the copyright notice and permission notice in copies or substantial portions."

# id -> (source path in the pinned Kenney repo, pack label, origin page)
KENNEY_IMAGES: list[tuple[str, str, str, str]] = [
    ("ui-frame-ornate", "ui/Fantasy UI Borders/Double/Panel/panel-000.png", "Fantasy UI Borders", "https://kenney.nl/assets/fantasy-ui-borders"),
    ("ui-frame-square", "ui/Fantasy UI Borders/Double/Border/panel-border-008.png", "Fantasy UI Borders", "https://kenney.nl/assets/fantasy-ui-borders"),
    ("ui-frame-simple", "ui/Fantasy UI Borders/Double/Border/panel-border-000.png", "Fantasy UI Borders", "https://kenney.nl/assets/fantasy-ui-borders"),
    ("ui-divider", "ui/Fantasy UI Borders/Double/Divider/divider-000.png", "Fantasy UI Borders", "https://kenney.nl/assets/fantasy-ui-borders"),
    ("ui-panel-dark", "ui/UI Pack - Adventure/Double/panel_brown_dark.png", "UI Pack - Adventure", "https://kenney.nl/assets/ui-pack-adventure"),
    ("ui-panel-damaged", "ui/UI Pack - Adventure/Double/panel_brown_damaged_dark.png", "UI Pack - Adventure", "https://kenney.nl/assets/ui-pack-adventure"),
    ("ui-panel-parchment", "ui/UI Pack - Adventure/Double/panel_grid_paper.png", "UI Pack - Adventure", "https://kenney.nl/assets/ui-pack-adventure"),
    ("ui-banner-red", "ui/UI Pack - Adventure/Double/banner_classic_curtain.png", "UI Pack - Adventure", "https://kenney.nl/assets/ui-pack-adventure"),
    ("ui-banner-parchment", "ui/UI Pack - Adventure/Double/banner_hanging.png", "UI Pack - Adventure", "https://kenney.nl/assets/ui-pack-adventure"),
    ("ui-button-long", "ui/UI Adventure Pack/buttonLong_brown.png", "UI Adventure Pack", KEN_BLOB + "README.md"),
    ("ui-button-long-pressed", "ui/UI Adventure Pack/buttonLong_brown_pressed.png", "UI Adventure Pack", KEN_BLOB + "README.md"),
    ("ui-button-square", "ui/UI Adventure Pack/buttonSquare_brown.png", "UI Adventure Pack", KEN_BLOB + "README.md"),
    ("ui-button-square-pressed", "ui/UI Adventure Pack/buttonSquare_brown_pressed.png", "UI Adventure Pack", KEN_BLOB + "README.md"),
    ("ui-bar-back-left", "ui/UI Adventure Pack/barBack_horizontalLeft.png", "UI Adventure Pack", KEN_BLOB + "README.md"),
    ("ui-bar-back-mid", "ui/UI Adventure Pack/barBack_horizontalMid.png", "UI Adventure Pack", KEN_BLOB + "README.md"),
    ("ui-bar-back-right", "ui/UI Adventure Pack/barBack_horizontalRight.png", "UI Adventure Pack", KEN_BLOB + "README.md"),
    ("ui-bar-red-left", "ui/UI Adventure Pack/barRed_horizontalLeft.png", "UI Adventure Pack", KEN_BLOB + "README.md"),
    ("ui-bar-red-mid", "ui/UI Adventure Pack/barRed_horizontalMid.png", "UI Adventure Pack", KEN_BLOB + "README.md"),
    ("ui-bar-red-right", "ui/UI Adventure Pack/barRed_horizontalRight.png", "UI Adventure Pack", KEN_BLOB + "README.md"),
    ("ui-bar-blue-left", "ui/UI Adventure Pack/barBlue_horizontalLeft.png", "UI Adventure Pack", KEN_BLOB + "README.md"),
    ("ui-bar-blue-mid", "ui/UI Adventure Pack/barBlue_horizontalBlue.png", "UI Adventure Pack", KEN_BLOB + "README.md"),
    ("ui-bar-blue-right", "ui/UI Adventure Pack/barBlue_horizontalRight.png", "UI Adventure Pack", KEN_BLOB + "README.md"),
    ("ui-cursor", "ui/UI Adventure Pack/cursorGauntlet_bronze.png", "UI Adventure Pack", KEN_BLOB + "README.md"),
    ("ui-minimap-ring", "ui/UI Pack - Adventure/Double/minimap_ring_brown_detail.png", "UI Pack - Adventure", "https://kenney.nl/assets/ui-pack-adventure"),
    ("ui-minimap-exclamation", "ui/UI Pack - Adventure/Double/minimap_icon_exclamation_red.png", "UI Pack - Adventure", "https://kenney.nl/assets/ui-pack-adventure"),
    ("ui-minimap-star", "ui/UI Pack - Adventure/Double/minimap_icon_star_yellow.png", "UI Pack - Adventure", "https://kenney.nl/assets/ui-pack-adventure"),
    ("icon-cross", "icons/Game Icons/White/2x/cross.png", "Game Icons", "https://kenney.nl/assets/game-icons"),
    ("icon-star", "icons/Game Icons/White/2x/star.png", "Game Icons", "https://kenney.nl/assets/game-icons"),
    ("icon-question", "icons/Game Icons/White/2x/question.png", "Game Icons", "https://kenney.nl/assets/game-icons"),
    ("icon-check", "icons/Game Icons/White/2x/checkmark.png", "Game Icons", "https://kenney.nl/assets/game-icons"),
    ("icon-scroll", "icons/Game Icons/White/2x/scrollVertical.png", "Game Icons", "https://kenney.nl/assets/game-icons"),
    ("prompt-enter", "icons/Input Prompts/Keyboard & Mouse/Double/keyboard_enter.png", "Input Prompts", "https://kenney.nl/assets/input-prompts"),
    ("prompt-esc", "icons/Input Prompts/Keyboard & Mouse/Double/keyboard_escape.png", "Input Prompts", "https://kenney.nl/assets/input-prompts"),
    ("prompt-space", "icons/Input Prompts/Keyboard & Mouse/Double/keyboard_space.png", "Input Prompts", "https://kenney.nl/assets/input-prompts"),
    ("prompt-arrows", "icons/Input Prompts/Keyboard & Mouse/Double/keyboard_arrows.png", "Input Prompts", "https://kenney.nl/assets/input-prompts"),
    ("prompt-pad-a", "icons/Input Prompts/Xbox Series/Double/xbox_button_a.png", "Input Prompts", "https://kenney.nl/assets/input-prompts"),
    ("prompt-pad-b", "icons/Input Prompts/Xbox Series/Double/xbox_button_b.png", "Input Prompts", "https://kenney.nl/assets/input-prompts"),
    ("prompt-pad-dpad", "icons/Input Prompts/Xbox Series/Double/xbox_dpad.png", "Input Prompts", "https://kenney.nl/assets/input-prompts"),
    ("prompt-pad-start", "icons/Input Prompts/Xbox Series/Double/xbox_button_start.png", "Input Prompts", "https://kenney.nl/assets/input-prompts"),
    ("bg-castles", "2d/Background Elements Remastered/Backgrounds/backgroundCastles.png", "Background Elements Remastered", "https://kenney.nl/assets/background-elements-remastered"),
    ("bg-forest", "2d/Background Elements Remastered/Backgrounds/backgroundForest.png", "Background Elements Remastered", "https://kenney.nl/assets/background-elements-remastered"),
    ("bg-mountains", "2d/Background Elements Remastered/Backgrounds/Elements/mountains.png", "Background Elements Remastered", "https://kenney.nl/assets/background-elements-remastered"),
    ("bg-clouds", "2d/Background Elements Remastered/Backgrounds/Elements/cloudLayerB1.png", "Background Elements Remastered", "https://kenney.nl/assets/background-elements-remastered"),
    ("bg-hills", "2d/Background Elements Remastered/Backgrounds/Elements/hillsLarge.png", "Background Elements Remastered", "https://kenney.nl/assets/background-elements-remastered"),
    ("tex-stone-floor", "2d/Retro Textures Fantasy/floor_stone.png", "Retro Textures Fantasy", "https://kenney.nl/assets/retro-textures-fantasy"),
    ("tex-stone-pattern", "2d/Retro Textures Fantasy/floor_stone_pattern.png", "Retro Textures Fantasy", "https://kenney.nl/assets/retro-textures-fantasy"),
    ("tex-door-lit", "2d/Retro Textures Fantasy/door_wood_window_lit.png", "Retro Textures Fantasy", "https://kenney.nl/assets/retro-textures-fantasy"),
    ("tex-window-frame", "2d/Retro Textures Fantasy/window_square_frame.png", "Retro Textures Fantasy", "https://kenney.nl/assets/retro-textures-fantasy"),
    ("tile-mono-a", "2d/Monochrome RPG Tileset/Dot Matrix/Tiles/tile_0000.png", "Monochrome RPG", "https://kenney.nl/assets/monochrome-rpg"),
    ("tile-mono-b", "2d/Monochrome RPG Tileset/Dot Matrix/Tiles/tile_0032.png", "Monochrome RPG", "https://kenney.nl/assets/monochrome-rpg"),
    ("tile-mono-c", "2d/Monochrome RPG Tileset/Dot Matrix/Tiles/tile_0064.png", "Monochrome RPG", "https://kenney.nl/assets/monochrome-rpg"),
    ("particle-magic", "2d/Particle Pack/PNG (Transparent)/magic_01.png", "Particle Pack", "https://kenney.nl/assets/particle-pack"),
    ("particle-star", "2d/Particle Pack/PNG (Transparent)/star_01.png", "Particle Pack", "https://kenney.nl/assets/particle-pack"),
    ("particle-spark", "2d/Particle Pack/PNG (Transparent)/spark_01.png", "Particle Pack", "https://kenney.nl/assets/particle-pack"),
    ("particle-flare", "2d/Particle Pack/PNG (Transparent)/flare_01.png", "Particle Pack", "https://kenney.nl/assets/particle-pack"),
    ("particle-smoke", "2d/Particle Pack/PNG (Transparent)/smoke_01.png", "Particle Pack", "https://kenney.nl/assets/particle-pack"),
    ("particle-burst", "2d/Explosion Pack/Particles/burst.png", "Explosion Pack", KEN_BLOB + "README.md"),
    ("particle-cloud", "2d/Explosion Pack/Particles/redCloud1.png", "Explosion Pack", KEN_BLOB + "README.md"),
]

KENNEY_MODELS = [
    ("model-pillar-obelisk", "3d/graveyard/pillar-obelisk.glb", "assets/models/pillar-obelisk.glb", "model/gltf-binary"),
    ("model-altar-stone", "3d/graveyard/altar-stone.glb", "assets/models/altar-stone.glb", "model/gltf-binary"),
    ("model-candle-multiple", "3d/graveyard/candle-multiple.glb", "assets/models/candle-multiple.glb", "model/gltf-binary"),
    ("tex-graveyard-colormap", "3d/graveyard/Textures/colormap.png", "assets/textures/graveyard-colormap.png", "image/png"),
]

# id -> upstream OGG filename
AUDIO = {
    "bgm_title": "MUSCChim_WindChimes_LOOP_01.ogg",
    "bgm_game": "AMBForst_Night_LOOP_01.ogg",
    "bgm_boss": "AMBInd_RoomToneMachineRoom_LOOP_01.ogg",
    "bgm_result": "AMBHome_RoomTone_LOOP_01.ogg",
    "amb_creepy": "DSGNImpt_ImpactCreepyReverb_OS_01.ogg",
    "se_cursor": "UIClick_MagicalOpen_OS_01.ogg",
    "se_confirm": "UIClick_MagicalConfirm_OS_01.ogg",
    "se_cancel": "UIClick_MagicalBack_OS_01.ogg",
    "se_error": "UIAlert_MagicalError_OS_01.ogg",
    "se_hit": "METLImpt_MetalHitSurface_OS_01.ogg",
    "se_damage": "DSGNImpt_ImpactCreepyReverb_OS_02.ogg",
    "se_heal": "UIMisc_Powerup_OS_01.ogg",
    "se_levelup": "MUSCStngr_LevelUpOrchestral_OS_01.ogg",
    "se_notify": "UIAlert_Notification_OS_01.ogg",
    "se_coin": "OBJCoin_CoinDrop_OS_01.ogg",
    "se_whoosh": "WHSH_WhooshSmall_OS_01.ogg",
    "se_magic": "MAGSpel_MagicSpell_OS_01.ogg",
    "se_bell": "UIMisc_BelltreeUp_OS_01.ogg",
    "se_gameover": "MUSCStngr_LossElectronic_OS_01.ogg",
    "se_victory": "MUSCStngr_VictoryElectronic_OS_01.ogg",
}

PORTRAITS = {
    "portrait-ryoma": "chr_ryoma_01_tsuujou.png",
    "portrait-mie": "chr_mie_01_reishou.png",
    "portrait-terachi": "chr_terachi_03_haishin_shinken.png",
    "portrait-satou": "chr_satou_01_game_gyoushi.png",
    "portrait-katsuya": "chr_katsuya_01_tsuujou.png",
    "portrait-rei": "chr_rei_05_data_shinken.png",
    "portrait-kuraishi": "chr_kuraishi_01_nekkyou.png",
    "portrait-sakura": "chr_sakura_02_kenkyuusha.png",
    "portrait-inaba": "chr_inaba_01_furushashin_hohoemi.png",
}


def q(path: str) -> str:
    return quote(path, safe="/")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def base_entry(**kw):
    e = {
        "id": None,
        "type": None,
        "url": None,
        "local_path": None,
        "author": None,
        "source_page": None,
        "license": None,
        "attribution_required": False,
        "noncommercial_only": False,
    }
    e.update(kw)
    p = ROOT / e["local_path"]
    if p.exists():
        e["size"] = p.stat().st_size
        e["sha256"] = sha256(p)
    else:
        e["size"] = None
        e["sha256"] = None
    e["used"] = True
    return e


def kenney_entry(aid: str, src: str, pack: str, origin: str, local: str, kind: str, mime: str):
    modification = "Renamed; dark-fantasy tint applied at runtime with nearest-neighbour scaling."
    if kind == "model":
        modification = "Renamed; external colormap URI remapped at runtime to the manifest texture id."
    elif kind == "texture" and aid == "tex-graveyard-colormap":
        modification = "Renamed; served to GLTFLoader as the graveyard kit's external colormap."
    return base_entry(
        id=aid,
        type=kind,
        url=KEN_RAW + q(src),
        local_path=local,
        author="Kenney",
        source_page=KEN_BLOB + q(src),
        origin_page=origin,
        license="CC0 1.0",
        license_url="https://creativecommons.org/publicdomain/zero/1.0/",
        license_page=KEN_LICENSE,
        attribution_required=False,
        noncommercial_only=False,
        credit=f"Kenney — {pack} (CC0 1.0)",
        conditions=CC0_CONDITIONS,
        modification=modification,
        source_file=src,
        pack=pack,
        mime=mime,
    )


def audio_entry(aid: str, fn: str):
    src = "corpora/oculus-audio-pack/ogg/" + fn
    return base_entry(
        id=aid,
        type="audio",
        url=META_RAW + q(src),
        local_path=f"assets/audio/{aid}.ogg",
        author="Oculus VR, LLC (Oculus Audio Pack 01)",
        source_page=META_ATTRIBUTION,
        origin_page=META_ORIGIN,
        license="CC BY 4.0",
        license_url="https://creativecommons.org/licenses/by/4.0/",
        license_file="assets/source/meta-pack-license.txt",
        attribution_required=True,
        noncommercial_only=False,
        credit=META_CREDIT,
        conditions=CCBY_CONDITIONS,
        modification="Renamed to game IDs; OGG previews were transcoded from the original WAVs upstream; no audio edits.",
        source_file=src,
        pack="Oculus Audio Pack 01",
        mime="audio/ogg",
    )


def font_entry(aid: str, pkg: str, ver: str, file: str, family: str, designer: str, ofl: str, about: str):
    return base_entry(
        id=aid,
        type="font",
        url=f"https://cdn.jsdelivr.net/npm/@fontsource/{pkg}@{ver}/files/{file}",
        local_path=f"assets/fonts/{file}",
        author=designer,
        source_page=about,
        origin_page=f"https://www.npmjs.com/package/@fontsource/{pkg}/v/{ver}",
        license="SIL OFL 1.1",
        license_url="https://openfontlicense.org/",
        license_file=ofl,
        attribution_required=True,
        noncommercial_only=False,
        credit=f"{family} by {designer} — SIL OFL 1.1",
        conditions=OFL_CONDITIONS,
        modification="Subset WOFF2 repackaged by Fontsource; no glyph edits.",
        source_file=f"@fontsource/{pkg}@{ver}/files/{file}",
        pack="Google Fonts / Fontsource",
        font_family=family,
        mime="font/woff2",
    )


def library_entry(aid: str, url: str | None, local: str, author: str, page: str, lic: str, license_file: str, credit: str, modification: str, generator: str | None = None, origin: str | None = None):
    return base_entry(
        id=aid,
        type="library",
        url=url,
        local_path=local,
        author=author,
        source_page=page,
        origin_page=origin or page,
        license=lic,
        license_url="https://opensource.org/licenses/MIT" if lic == "MIT" else None,
        license_file=license_file,
        attribution_required=True,
        noncommercial_only=False,
        credit=credit,
        conditions=MIT_CONDITIONS,
        modification=modification,
        generator=generator,
        mime="application/javascript",
    )


def portrait_entry(aid: str, fn: str):
    return base_entry(
        id=aid,
        type="image",
        url=None,
        local_path=f"assets/portraits/{aid}.png",
        author="User (Google Drive folder 本質images)",
        source_page=DRIVE_FOLDER,
        origin_page=DRIVE_FOLDER,
        license="User-provided personal / noncommercial permission",
        license_url=None,
        attribution_required=False,
        noncommercial_only=True,
        credit=f"User-provided character motif — {fn} (personal / noncommercial only)",
        conditions="Use only in this personal, noncommercial build. Excluded automatically when COMMERCIAL_BUILD=true; a procedural silhouette fallback is used instead. Source artwork is not redistributed.",
        modification="Derived 72×108 pixel portrait, recoloured to a unified 28-colour dark-fantasy palette.",
        source_file=fn,
        generator="scripts/make_pixel_portraits.py",
        pack="本質images character motifs",
        mime="image/png",
    )


def main() -> None:
    assets: list[dict] = []
    for aid, src, pack, origin in KENNEY_IMAGES:
        assets.append(kenney_entry(aid, src, pack, origin, f"assets/images/{aid}.png", "image", "image/png"))
    for aid, src, local, mime in KENNEY_MODELS:
        kind = "model" if aid.startswith("model-") else "texture"
        assets.append(kenney_entry(aid, src, "Graveyard Kit", "https://kenney.nl/assets/graveyard-kit", local, kind, mime))
    for aid, fn in AUDIO.items():
        assets.append(audio_entry(aid, fn))
    assets.append(font_entry(
        "font-press-start", "press-start-2p", "5.3.0",
        "press-start-2p-latin-400-normal.woff2", "Press Start 2P",
        "CodeMan38 (Cody Boisclair)", "assets/fonts/OFL-press-start-2p.txt",
        "https://fonts.google.com/specimen/Press+Start+2P/about",
    ))
    assets.append(font_entry(
        "font-dotgothic", "dotgothic16", "5.3.1",
        "dotgothic16-japanese-400-normal.woff2", "DotGothic16",
        "Fontworks Inc.", "assets/fonts/OFL-dotgothic16.txt",
        "https://fonts.google.com/specimen/DotGothic16/about",
    ))
    assets.append(library_entry(
        "library-howler",
        "https://cdn.jsdelivr.net/npm/howler@2.2.4/dist/howler.min.js",
        "assets/lib/howler.min.js",
        "James Simpson and GoldFire Studios, Inc.",
        "https://github.com/goldfire/howler.js/blob/master/LICENSE.md",
        "MIT", "assets/lib/MIT-howler.txt",
        "Howler.js 2.2.4 by James Simpson and GoldFire Studios, Inc. — MIT",
        "Pinned v2.2.4 minified build bundled locally; used as the Web Audio context provider.",
        origin="https://www.npmjs.com/package/howler/v/2.2.4",
    ))
    assets.append(library_entry(
        "library-three",
        None,
        "assets/lib/three-bundle.js",
        "three.js authors",
        "https://github.com/mrdoob/three.js/blob/r128/LICENSE",
        "MIT", "assets/lib/MIT-three.txt",
        "three.js r128 (core, GLTFLoader, postprocessing and shaders) by the three.js authors — MIT",
        "Pinned r128 core, GLTFLoader, EffectComposer, bloom, vignette and colour-correction passes concatenated into one local bundle.",
        generator="scripts/build-three-bundle.py",
        origin="https://www.npmjs.com/package/three/v/0.128.0",
    ))
    for aid, fn in PORTRAITS.items():
        assets.append(portrait_entry(aid, fn))

    manifest = {
        "schema": 1,
        "game": "HONSHITSU ARCHIVE — ✝本質✝ // THE INVISIBLE BORDER",
        "build": "personal / noncommercial",
        "commercial_build": False,
        "generated": "2026-11-24",
        "asset_root": "assets/",
        "user_override_path": "assets/user/",
        "user_override_rule": "For any id, assets/user/<id> (or <id><original extension>) overrides the fetched/local asset. Commercial builds exclude entries with noncommercial_only=true and use procedural fallbacks.",
        "license_policy": "Only source-verified CC0, CC BY 4.0, OFL 1.1, MIT and user-provided personal/noncommercial assets are included. No commercial game/anime/music rips, unknown licenses or unapproved mirrors.",
        "commit_pins": {
            "kenney": KEN_SHA,
            "three": "r128 (npm 0.128.0)",
            "howler": "2.2.4",
            "fontsource_press_start_2p": "5.3.0",
            "fontsource_dotgothic16": "5.3.1",
            "meta_open_sound": "main (ATTRIBUTION.md / Oculus Audio Pack 01)",
        },
        "credits_roles": [
            "A GAME BY  ARENA AGENT MODE",
            "WORLD MOTIF  本質images / 偏差値60の教室から✝本質✝が漏れ出している件について",
            "ART & UI  KENNEY",
            "AUDIO  OCULUS VR, LLC",
            "TYPEFACES  CODEMAN38 / FONTWORKS INC.",
            "ENGINE  THREE.JS / HOWLER.JS",
            "LICENSES  CC0 / CC BY 4.0 / OFL 1.1 / MIT",
        ],
        "assets": assets,
    }
    out = ROOT / "assets.manifest.json"
    out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {out.relative_to(ROOT)} with {len(assets)} entries")
    missing = [a["id"] for a in assets if a["sha256"] is None]
    if missing:
        print("MISSING LOCAL FILES:", ", ".join(missing))
    by_license: dict[str, int] = {}
    for a in assets:
        by_license[a["license"]] = by_license.get(a["license"], 0) + 1
    print("licenses:", by_license)


if __name__ == "__main__":
    main()
