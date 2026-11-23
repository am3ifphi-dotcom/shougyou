# 本質 / HONSHITSU — 偏差値60の教室

A personal, non-commercial **arcade score-attack** built as a single letterboxed
16:9 game screen. Dark-fantasy pixel art, a corridor that rearranges itself
every time you turn your back, and a vending machine that has been out of corn
soup for three months.

The motif comes from the novel and illustrations in the Drive folder
`本質images`: 本質 ("essence" — the thing that was always there), 偏差値60 (the
deviation score that never settles), and the absent コーンスープ.

```
boot logo → loading → title → difficulty → gameplay ⇄ pause → result → retry
```

---

## Running it

```bash
npm install          # pixi.js, howler, fontsource (only needed by the asset tool)
node server.mjs 8080 # zero-dependency static server, binds 0.0.0.0
# open http://localhost:8080/
```

The game needs a static origin (ES modules + `fetch('assets.manifest.json')`).
`server.mjs` also sends the COOP/COEP headers that keep it embeddable.

`?fast=1` forces the low-power path (no additive layers, capped simulation
step). It is automatic below ~26 fps, and exists so the game stays playable on
software rasterisers.

### Controls

| Action | Keyboard | Gamepad |
| --- | --- | --- |
| Move | `WASD` / arrows | left stick / d-pad |
| Fire 本質弾 (hold) | `Enter` / `Z` / `J` / `Space` | Ⓐ |
| 爆ぜる本質 (MP 40) | `E` / `L` | Ⓨ |
| Dash (i-frames) | `Shift` / `Q` | Ⓧ |
| Pause | `Esc` / `P` | START |
| Cancel | `Backspace` / `K` / `X` | Ⓑ |
| Fullscreen | `F` | SELECT |
| Mute | `M` | SELECT |

Every prompt, HUD slot and menu is drawn with the glyph for the device you last
touched.

---

## The design in one screen

* **One frame, no chrome.** `#frame` is a fixed 1280×720 canvas, CSS-scaled to
  the window and letterboxed. No header, footer, sidebar, cards, scrolling,
  text selection, context menu or native controls.
* **The corridor is the board.** Rooms are 1600×900 world units of 100-unit
  tiles. Walking out of an edge streams in the next room and the floor palette
  shifts, so the map never looks twice. Clear the room and the clock resets;
  let it run out with enemies alive and the pressure keeps building.
* **Feel first.** Hit-stop on both ends of a hit, screen shake, white flash,
  blood-simple particle bursts, floating damage numbers, a lagging
  after-image HP bar, a combo multiplier with a shrinking window bar, and a
  camera that leads 0.22 s in front of travel plus a nudge toward the aim.
* **The HUD lies to you usefully.** HP shows the real value instantly and the
  damage it took a fifth of a second later, so you can read exactly how much
  that hit cost. The HUD fades to 20 % during dialogue and returns on its own.
* **Dialogue is the only place text is long.** Bottom message window with a
  name plate, a 480² character portrait, and typewriter reveal at 42 cps —
  with a blip every third glyph.

## Structure

```
index.html                 fixed frame, font faces, module entry
server.mjs                 static server (COOP/COEP, iframe-safe)
assets.manifest.json       single source of truth for every asset
LICENSES.md                generated from the manifest
assets/img, assets/audio   downloaded + processed assets
assets/source/drive        first-party 本質images illustrations
assets/user/               optional per-id overrides (git-ignored)
public/vendor              pixi.min.js, howler.min.js
src/main.js                PIXI app, layers, fade/state machine, settings, save
src/assets.js              manifest registry, texture cache, procedural fallback
src/audio.js               Howler buses (bgm/se/voice), crossfade, pitch jitter
src/input.js               keyboard + gamepad → actions, device-aware glyphs
src/ui.js                  pxText, frames, MenuList, ToastStack, DialogueWindow
src/game/content.js        bestiary, bosses, waves, run tuning, difficulty, script
src/game/world.js          room grid, door logic, threat budget
src/game/render.js         tile batches, wall bands, torch light, camera, grade
src/game/hud.js            vitals, score, combo, minimap, slots, boss bar
src/states/*.js            boot, loading, title, menu, play, pause, result,
                           options, credits
tools/assets.config.mjs    asset catalogue (sources, licences, local names)
tools/fetch-assets.mjs     downloader/processor → manifest + LICENSES
```

## Assets

Everything visible and audible is a real external asset; the procedural
generators in `src/assets.js` are **fallbacks only** and are logged as such.

| Pack | Licence | What it gives us |
| --- | --- | --- |
| [Dungeon Crawl Stone Soup](https://github.com/Papyszoo/CC0-Public-Domain-Sprites) | CC0-1.0 | monsters, dungeon tiles, props, items, player doll, spell FX |
| [Superpowers "Medieval Fantasy"](https://github.com/skillmoph/academe-play-assets) | CC0-1.0 | HUD frames, slots, hearts, background elements |
| [Juhani Junkala retro SFX](https://github.com/JanTheLynx/free-game-sfx) | CC0-1.0 | 27 impact / UI / pickup sounds |
| 本質images (first-party) | personal use | the 18 character illustrations |
| [Press Start 2P, DotGothic16](https://fontsource.org/) | OFL-1.1 | display + Japanese text |
| [PixiJS](https://github.com/pixijs/pixijs), [Howler.js](https://github.com/goldfire/howler.js) | MIT | renderer, audio |

Nothing is taken from a commercial game, anime, or commercial music release.
Material whose terms were unclear was rejected rather than guessed at.

### Rules the code follows

* **No asset URL is hardcoded.** Every texture and sound is looked up by
  manifest id through `AssetRegistry`.
* **Every entry records** `id, type, url, local_path, author, source_page,
  license, attribution_required, noncommercial_only`. `LICENSES.md` and the
  in-game CREDITS roll are both generated from that data — the credits list
  every id, its author and its licence.
* **Failure is not fatal.** A missing or corrupt asset falls back to a
  procedural texture / synthesised sound, is logged in the loading screen's
  asset log (`OK` / `USR` / `FB`), and the game continues.
* **`COMMERCIAL_BUILD=true`** excludes every `noncommercial_only` entry and
  substitutes the fallback, so a commercial build cannot ship the
  first-party-only illustrations by accident.
* **`assets/user/<id>.<ext>`** overrides any asset by id without touching the
  manifest.

Regenerate everything with:

```bash
node tools/fetch-assets.mjs                    # fetch + build manifest + LICENSES
node tools/fetch-assets.mjs --only=audio       # one category
COMMERCIAL_BUILD=true node tools/fetch-assets.mjs
```

## Audio

Three buses (BGM / SE / Voice) with independent volumes, music crossfades
(1.2–1.6 s), ambience ducked under the mix, and per-shot pitch/gain jitter so
repeated hits never machine-gun into a single stamped sample. Audio unlocks on
the first real key/pointer gesture, as browsers require.

## Licence of this project

Personal, non-commercial use. The code is the author's; the assets remain under
their own licences (see `LICENSES.md`). The 本質images illustrations are
first-party and are flagged non-commercial-only.
