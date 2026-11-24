# HONSHITSU ARCHIVE — ✝本質✝ // THE INVISIBLE BORDER

A personal, **noncommercial** console/PC-style score-attack game. It is built
as one fixed 16:9 game screen — a dark-fantasy dot-art judgement arcade game —
rather than a web page. The source motif is the novel and character art in the
Google Drive folder `本質images`: the invisible 南棟 / 北棟 border, 偏差値 60 / 70,
紺 / えんじネクタイ, コーンスープの有無, 等高線, ✝本質✝ / は？, 配信, 年鑑.
The novel is used as a motif, never as a long text dump.

## Run

```sh
npm start
# open the live preview / http://localhost:4173
```

No build step is required. `index.html` loads `src/main.js`; that reads
`assets.manifest.json` and resolves every image, font, OGG, glTF and library by
its manifest `id`. **No asset URL is hard-coded in game code.**

## Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Move / select | ↑↓←→ / WASD | D-pad / stick |
| Decide / advance | Enter / Space / Z | A |
| Cancel / pause | Esc / X / P | B / Start |
| Judge ✝本質✝ | ← / A / Q | D-pad left / X |
| Judge は？ | → / D / E | D-pad right / Y |
| Skills | ↑ / ↓ / 1 / 2 / 3 | D-pad up/down / LB / RB |
| Fullscreen | F | — |
| Asset debug log | F3 | — |

The first key/pad/pointer input unlocks Web Audio. All menus work from the
keyboard or gamepad; nothing depends on mouse hover.

## Assets, licenses, overrides

- `assets.manifest.json` is the single source of truth: `id, type, url,
  local_path, author, source_page, license, attribution_required,
  noncommercial_only`, plus pinned metadata, checksums and credit strings.
- `LICENSES.md` is generated from the manifest and carries the bundled CC0,
  CC BY 4.0, OFL 1.1 and MIT notices. The in-game **CREDITS** staff roll shows
  every used asset's author, source and license at runtime.
- Kenney assets are CC0. Current Kenney pack pages were source-checked for
  Fantasy UI Borders, UI Pack - Adventure, Game Icons, Input Prompts,
  Background Elements Remastered, Retro Textures Fantasy, Monochrome RPG,
  Particle Pack and Graveyard Kit. The older `UI Adventure Pack` and
  `Explosion Pack` files come from the pinned repository commit whose root
  LICENSE.txt/README explicitly place the full library under CC0; their
  manifest `source_page` points at that pinned README rather than a dead
  individual pack URL. Oculus Audio Pack 01 is CC BY 4.0 (OGG via
  `facebookincubator/Meta-open-sound`), Press Start 2P / DotGothic16 are
  OFL 1.1, and Howler.js 2.2.4 / three.js r128 are MIT.
- The nine Drive-derived pixel portraits are marked `noncommercial_only: true`.
  `COMMERCIAL_BUILD=true` (or `?commercial=1`) excludes them and uses
  procedural silhouette fallbacks. `npm run commercial` writes a filtered
  `dist/` with the flag enabled.
- `assets/user/<id>` (or `<id>.<ext>`) overrides any fetched asset once the id
  is declared in `assets/user/index.json`. Override binaries and the original
  Drive downloads are intentionally ignored by Git; the tiny index is committed.
- Acquisition order: user override → `local_path` → pinned upstream URL from
  the manifest (browser Cache API). `npm run prefetch` pre-populates `assets/`.
  Any failure is logged in the loading screen / F3 debug overlay and downgrades
  to procedural graphics, Web Audio synthesis or system fonts; gameplay never
  stops for a missing asset.

## Regeneration

```sh
npm run verify
npm run licenses
npm run manifest          # rebuild manifest + checksums from curated table
python3 scripts/make_pixel_portraits.py   # requires Pillow + Drive PNGs
python3 scripts/build-three-bundle.py     # pinned three@0.128.0 bundle
```

Place the nine original Drive PNGs in `google_drive/` or
`assets/source/drive/` before regenerating portraits. The derived 72×108
sprites are committed; the source illustrations are not.
