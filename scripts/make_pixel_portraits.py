#!/usr/bin/env python3
"""Derive unified low-resolution pixel portraits from the user's Drive artwork.

The source files are the character illustrations in Google Drive / 本質images.
They are NOT committed to this repository.  Download them with the Drive
connector (or place them in assets/source/drive/) and run this script:

    python3 scripts/make_pixel_portraits.py

Output: assets/portraits/<id>.png  (72x108, 24-colour dark-fantasy palette)
The derived sprites are personal / non-commercial only, matching the source.
"""
from __future__ import annotations

import os
import sys
from collections import deque
from pathlib import Path

from PIL import Image, ImageEnhance, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIRS = [ROOT / "google_drive", ROOT / "assets" / "source" / "drive"]
OUT = ROOT / "assets" / "portraits"
OUT.mkdir(parents=True, exist_ok=True)

# id -> source filename in Drive / 本質images
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

# 24-colour unified palette.  Index 0 is transparent.
PALETTE = [
    (0, 0, 0),          # 0 transparent
    (9, 7, 14),         # 1 void
    (20, 15, 30),       # 2 ink
    (34, 24, 48),       # 3 night indigo
    (50, 35, 66),       # 4 bruised violet
    (74, 48, 88),       # 5 amethyst shadow
    (40, 38, 58),       # 6 navy slate
    (66, 62, 92),       # 7 uniform blue
    (96, 92, 126),      # 8 cool highlight
    (92, 26, 46),       # 9 dried blood
    (134, 32, 56),      # 10 crimson tie
    (184, 52, 72),      # 11 ember
    (120, 88, 58),      # 12 bronze
    (178, 138, 78),     # 13 old gold
    (226, 198, 142),    # 14 parchment
    (244, 232, 208),    # 15 bone / shirt
    (168, 124, 104),    # 16 skin shadow
    (214, 170, 142),    # 17 skin
    (240, 206, 178),    # 18 skin light
    (58, 44, 40),       # 19 dark hair
    (96, 66, 58),       # 20 brown hair
    (142, 96, 74),      # 21 auburn hair
    (44, 66, 62),       # 22 moss shadow
    (94, 122, 104),     # 23 moss
    (146, 142, 164),    # 24 shirt shadow
    (190, 186, 202),    # 25 shirt cool
    (222, 218, 230),    # 26 shirt light
    (112, 78, 52),      # 27 warm shadow
]


def find_source(name: str) -> Path | None:
    for d in SOURCE_DIRS:
        p = d / name
        if p.exists():
            return p
    return None


def remove_background(im: Image.Image) -> Image.Image:
    """Flood-fill the outer white/black backdrop, keeping interior white shirts."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    # Choose the brightest or darkest corner as the backdrop key.
    bg = max(corners, key=lambda c: c[0] + c[1] + c[2]) if sum(corners[0][:3]) > 600 else min(corners, key=lambda c: c[0] + c[1] + c[2])
    key = bg[:3]

    def close(c):
        return sum(abs(c[i] - key[i]) for i in range(3)) < 78

    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            q.append((x, y))
    while q:
        x, y = q.popleft()
        i = y * w + x
        if seen[i]:
            continue
        seen[i] = 1
        c = px[x, y]
        if not close(c):
            continue
        px[x, y] = (c[0], c[1], c[2], 0)
        if x > 0: q.append((x - 1, y))
        if x < w - 1: q.append((x + 1, y))
        if y > 0: q.append((x, y - 1))
        if y < h - 1: q.append((x, y + 1))
    return im


def make_portrait(src: Path, dst: Path) -> None:
    im = remove_background(Image.open(src))
    bbox = im.getbbox()
    if bbox:
        im = im.crop(bbox)
    w, h = im.size
    # Keep head + torso: the source illustrations are full-body.
    im = im.crop((0, 0, w, int(h * 0.60)))
    im = im.resize((72, 108), Image.Resampling.LANCZOS)

    # Dark-fantasy colour grade before quantisation.
    rgb = Image.new("RGB", im.size, PALETTE[2])
    rgb.paste(im, mask=im.getchannel("A"))
    rgb = ImageEnhance.Color(rgb).enhance(0.72)
    rgb = ImageEnhance.Contrast(rgb).enhance(1.18)
    veil = Image.new("RGB", rgb.size, (44, 24, 58))
    rgb = Image.blend(rgb, veil, 0.22)

    pal = Image.new("P", (1, 1))
    flat = []
    for c in PALETTE:
        flat.extend(c)
    flat.extend((0, 0, 0) * (256 - len(PALETTE)))
    pal.putpalette(flat)
    # No error diffusion: dot-art sprites need flat, unified colour cells.
    q = rgb.quantize(palette=pal, dither=Image.Dither.NONE)

    alpha = im.getchannel("A").point(lambda a: 255 if a > 96 else 0)
    q = q.convert("RGBA")
    q.putalpha(alpha)
    # Force fully transparent pixels to palette index 0 colour as well.
    pixels = q.load()
    for y in range(q.height):
        for x in range(q.width):
            if pixels[x, y][3] == 0:
                pixels[x, y] = (0, 0, 0, 0)
    q.save(dst, optimize=True)


def main() -> int:
    made = 0
    for aid, name in PORTRAITS.items():
        src = find_source(name)
        if not src:
            print(f"[portrait] skip {aid}: source not found ({name})")
            continue
        dst = OUT / f"{aid}.png"
        make_portrait(src, dst)
        print(f"[portrait] {aid} <- {src.name} -> {dst.relative_to(ROOT)}")
        made += 1
    print(f"[portrait] generated {made}/{len(PORTRAITS)}")
    return 0 if made else 1


if __name__ == "__main__":
    sys.exit(main())
