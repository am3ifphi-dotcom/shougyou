# SHATTERED CROWN

A dark-fantasy pixel-art action RPG presentation layer — title flow, HUD, menus,
options, staff roll, game feel — built as a personal, non-commercial project.

Everything runs in a single full-screen 16:9 letterboxed canvas with no page
chrome: no headers, no cards, no explanatory text, no scrollbars. It should read
as a console game that happens to be running in a browser.

```
npm start            # http://localhost:4173
```

`node tools/serve.mjs` is a zero-dependency static server. Any static host works
too — the entry point is `index.html`, everything is relative.

---

## Controls

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Move | `W A S D` / arrows | left stick / D-pad |
| Attack | `J` / `Z` | X |
| Ember (spell) | `K` / `X` | Y |
| Roll (dash) | `Shift` / `C` | RB |
| Interact / flask | `E` | Y |
| Pause | `Esc` / `P` | Start |
| Map | `Tab` / `M` | Back |
| Confirm / back | `Enter` / `Esc` | A / B |

The last device used decides which glyphs the prompts display.

---

## Architecture

```
index.html            canvas shell, import map, #nogl fallback
src/main.js           finite state machine + frame loop
src/core/
  app.js              Pixi Application, letterbox stage, layers, fullscreen
  assets.js           manifest loading, id lookup, user-override index
  textures.js         PNG/atlas preload, font loading, fallbacks
  audio.js            Howler wrapper, music/sfx/voice buses, -14 LUFS target
  input.js            keyboard + gamepad + pointer normalisation, glyph tables
  transitions.js      fade / wipe / veil, tween helpers, hitstop-friendly clock
  procedural.js       canvas-generated textures (stars, fog, glows, mountains)
  save.js             localStorage checkpoint
src/game/
  dungeon.js          seeded generation, rooms, corridors, props, lights
  world.js            tilemap, lighting, actors, fixed-step simulation
  entities.js         actor/enemy factories and AI
  camera.js           look-ahead camera, bounds, shake
  effects.js          particles, floating numbers, decals, hitstop/slow-mo
  hud.js              vitals, minimap, slots, objective, toasts, boss bar
src/ui/
  type.js             text factory for the three fetched faces
  widgets.js          panels, stat bars, menu list, sliders, dividers
  dialogue.js         typewriter message window + area banner
src/scenes/           boot, loading, title, game, result, credits, pause, options
tools/
  serve.mjs           dev server
  fetch_assets.py     asset pipeline (see below)
```

### State machine

```
BOOT → LOADING → TITLE → GAME → RESULT → TITLE
                   ├→ CREDITS
                   └→ OPTIONS (also reachable from PAUSE)
```

Every transition goes through `transitions.js`, so nothing ever hard-cuts.
Scene swaps dispose the outgoing scene explicitly (`setScene()` calls
`dispose()` before removing the node) so nothing leaks across reloads.

### Layers

`stage` holds four ordered containers: `sceneLayer`, `worldLayer`,
`uiLayer`, `overlayLayer` (fades, flashes, letterbox bars). Input is polled once
per frame and cleared at the *end* of the frame, so a keypress that lands
between two frames is never swallowed.

---

## Asset pipeline

**`assets.manifest.json` is the only place asset references exist.** Code never
contains a URL: it asks for an `id`, and `assets.js` resolves that id through the
fetched local manifest.

```
python3 tools/fetch_assets.py            # download everything not yet present
python3 tools/fetch_assets.py --only se  # one bucket: image|sprite|tile|music|sfx|font
python3 tools/fetch_assets.py --force    # re-download
python3 tools/fetch_assets.py --verify   # re-check already-fetched files
python3 tools/fetch_assets.py --report   # rebuild LICENSES.md + credits.js + user index
COMMERCIAL_BUILD=true python3 tools/fetch_assets.py
```

Outputs:

| file | purpose |
| --- | --- |
| `assets/manifest.local.json` | per-asset status (`ok` / `cached` / `user` / `fallback`), byte size, hash |
| `assets/fetch.log` | append-only run log |
| `LICENSES.md` | generated licence roll: author, licence, source, modifications |
| `src/generated/credits.js` | the same roll as data, consumed by the CREDITS scene |
| `assets/user/index.json` | which hand-placed overrides exist |

### Current asset set

| category | source | licence |
| --- | --- | --- |
| 16×16 tiles, actors, props | DawnLike (DragonDePlatino & DawnBringer) | CC BY 4.0 |
| UI skin (panels, bars, cursors, buttons) | Kenney — UI Pack: Adventure | CC0 1.0 |
| Sound effects | Kenney — RPG / UI / Digital audio | CC0 1.0 |
| Music | Juhani Junkala — Chiptune Adventures | CC0 1.0 |
| Typefaces | Pirata One, IM Fell English (+SC), DotGothic16 | OFL 1.1 |
| Engine | PixiJS 8 (MIT), Howler.js 2 (MIT) | MIT |

Every entry is `noncommercial_only: false` and `redistribute_allowed: true`;
`COMMERCIAL_BUILD=true` drops anything that is not. Licences were verified at the
source page before adding an entry — if terms were unclear the asset was not used.

### User overrides

Drop a file into `assets/user/` whose name matches the basename of a manifest
`local_path` and it replaces the downloaded asset with no code change:

```
assets/user/warrior_s0.png
assets/user/PirataOne-Regular.ttf
assets/user/dungeon.ogg
```

Run `--report` afterwards so `assets/user/index.json` is refreshed; the game
reads that index, so it never probes for files that are not there.

### Fallbacks

If a download fails or a file is missing at runtime, the affected id resolves to
a procedural texture drawn on a canvas (`core/procedural.js`) and the entry is
marked `fallback`. The game stays playable with zero network access; the loading
screen reports `ready=` / `fallback=` counts in its fetch log.

---

## Audio

Three buses (`music`, `sfx`, `voice`) behind Howler, master loudness targeted at
about -14 LUFS. WebAudio is unlocked by the first real input, which the title
screen waits for so the theme is never dropped by the browser's autoplay policy.
Each scene declares its own BGM, cross-faded on transition.

---

## Presentation checklist

- Single letterboxed 16:9 canvas, no page chrome.
- Boot card → loading screen with per-stage log, progress bar and `Esc` skip.
- Title: parallax skyline, drifting embers, slow camera push, blinking
  `PRESS ANY KEY`, then NEW GAME / CONTINUE / OPTIONS / CREDITS / QUIT.
- HUD: VIT/AET with delayed ghost damage trail, portrait, level, minimap, soul
  counter, four skill slots, objective line, toasts, boss bar, contextual fade.
- Game feel: screen shake, hitstop, hit flash, particles, damage numbers, decals,
  eased UI, look-ahead camera.
- Pause overlay with RESUME / OPTIONS / ABANDON RUN.
- Options: three audio buses, display mode, mute, control legend that follows the
  active device.
- Staff roll generated from the manifest, so credits can never drift from the
  licences actually shipped.
- Result screen with tallies, rank, retry and title.
