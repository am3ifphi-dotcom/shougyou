#!/usr/bin/env python3
"""Normalize the transparent character sprites from Google Drive.

The source PNGs have different canvas sizes and transparent padding.  For each
character we compute one shared alpha bounding box across every expression, crop
all expressions to that exact box (so feet/heads never jump), then export a
high-quality alpha WebP plus a soft rim-light silhouette.
"""
from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "google_drive"
OUTPUT = ROOT / "public" / "assets" / "chars"

RENAME = {
    "mitsumine": "akari",
}

ALIASES = {
    "rei": {
        "normal": "01_suzushii",
        "smile": "02_hohoemi",
        "surprise": "04_odoroki",
        "serious": "05_data_shinken",
        "stiff": "05_data_shinken",
        "waver": "07_kotoba_erabu",
    },
    "akari": {
        "normal": "01_tsuujou",
        "tsukkomi": "02_tsukkomi",
        "smile": "03_egao",
        "playful": "03_egao",
        "flushed": "06_ha",
    },
    "naitou": {
        "normal": "01_tsuujou",
        "smile": "02_hohoemi",
        "surprise": "04_odoroki",
        "gentle": "05_yasashii_me",
        "softSmile": "06_sukoshi_warau",
    },
    "ryoma": {
        "normal": "01_tsuujou",
        "grin": "02_niyari",
        "serious": "04_kyuu_magao",
        "sad": "05_shonbori",
        "tearSmile": "06_nakiwarai",
        "resolve": "07_shinken_ketsui",
        "shy": "08_terekakushi",
        "cry": "09_goukyuu",
    },
    "katsuya": {
        "normal": "01_tsuujou",
        "smile": "02_hohoemi",
        "distant": "03_tooi_me",
        "surprise": "04_odoroki",
        "stiff": "06_katai_muhyoujou",
        "memory": "07_kaisou_me_hosomeru",
        "holdTears": "08_namida_koraeru",
        "cry": "09_naku",
        "bright": "10_hareyaka_emi",
    },
    "futami": {
        "normal": "01_tsuujou",
        "worried": "03_shinpai",
        "gentle": "03_shinpai",
        "playful": "04_itazura",
        "profile": "05_yokogao",
    },
    "inaba": {"normal": "01_furushashin_hohoemi"},
    "terachi": {"normal": "08_namida"},
    "satou": {"normal": "08_me_hikari_koraeru"},
}

CONTACT_ORDER = [
    "rei",
    "akari",
    "naitou",
    "ryoma",
    "katsuya",
    "futami",
    "inaba",
    "terachi",
    "satou",
]


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int]:
    alpha = image.getchannel("A").point(lambda p: 255 if p > 6 else 0)
    return alpha.getbbox() or (0, 0, image.width, image.height)


def union_bbox(image_paths: list[Path]) -> tuple[int, int, int, int]:
    boxes = []
    for path in image_paths:
        with Image.open(path) as im:
            im = im.convert("RGBA")
            boxes.append(alpha_bbox(im))
    left = min(b[0] for b in boxes)
    top = min(b[1] for b in boxes)
    right = max(b[2] for b in boxes)
    bottom = max(b[3] for b in boxes)
    pad = 10
    return (max(0, left - pad), max(0, top - pad), right + pad, bottom + pad)


def rim_silhouette(image: Image.Image) -> Image.Image:
    alpha = image.getchannel("A")
    glow = Image.new("RGBA", image.size, (255, 218, 168, 0))
    glow.putalpha(alpha.point(lambda p: int(p * 0.62)))
    glow = glow.filter(ImageFilter.GaussianBlur(11))
    return glow


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    groups: dict[str, list[Path]] = defaultdict(list)
    for path in sorted(SOURCE.glob("chr_*.png")):
        match = re.match(r"chr_([a-z]+)_(.+)\.png$", path.name)
        if not match:
            continue
        key = RENAME.get(match.group(1), match.group(1))
        if key not in ALIASES:
            continue
        groups[key].append(path)

    manifest: dict[str, dict] = {}
    contact_cards: list[tuple[str, Image.Image]] = []

    for key, paths in groups.items():
        expr_files = {p.name.split(f"chr_{key}_", 1)[-1][:-4]: p for p in paths}
        # Rename mitsumine files before splitting.
        if key == "akari":
            expr_files = {p.name.split("chr_mitsumine_", 1)[-1][:-4]: p for p in paths}
        bbox = union_bbox(paths)
        char_dir = OUTPUT / key
        char_dir.mkdir(parents=True, exist_ok=True)
        expressions: dict[str, dict] = {}
        first_image: Image.Image | None = None

        for expr_key, path in sorted(expr_files.items()):
            with Image.open(path) as im:
                im = im.convert("RGBA").crop(bbox)
                scale = min(1280 / im.height, 820 / im.width, 1.0)
                size = (max(1, round(im.width * scale)), max(1, round(im.height * scale)))
                im = im.resize(size, Image.Resampling.LANCZOS)
                out = char_dir / f"{expr_key}.webp"
                im.save(out, "WEBP", quality=93, method=6, exact=True)
                expressions[expr_key] = {
                    "src": f"{key}/{expr_key}.webp",
                    "width": size[0],
                    "height": size[1],
                }
                if first_image is None:
                    first_image = im.copy()

        if first_image is not None:
            rim = rim_silhouette(first_image)
            rim.save(char_dir / "rim.webp", "WEBP", quality=88, method=6, exact=True)
            contact_cards.append((key, first_image))

        alias_map = {}
        for alias, expr_key in ALIASES[key].items():
            if expr_key in expressions:
                alias_map[alias] = expressions[expr_key]
        if "normal" not in alias_map and expressions:
            alias_map["normal"] = next(iter(expressions.values()))

        manifest[key] = {
            "default": "normal",
            "rim": f"{key}/rim.webp",
            "expressions": expressions,
            "aliases": alias_map,
        }
        print(f"{key}: {len(expressions)} expressions, crop={bbox}")

    (OUTPUT / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    # Internal QA contact sheet (not part of the game UI).
    card_w, card_h = 210, 330
    sheet = Image.new("RGB", (card_w * 3, card_h * 3), (14, 18, 30))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    for i, key in enumerate(CONTACT_ORDER):
        match = next((img for name, img in contact_cards if name == key), None)
        if match is None:
            continue
        thumb = match.copy()
        thumb.thumbnail((card_w - 20, card_h - 42), Image.Resampling.LANCZOS)
        x = (i % 3) * card_w + (card_w - thumb.width) // 2
        y = (i // 3) * card_h + 8
        sheet.paste(thumb, (x, y), thumb)
        draw.text(((i % 3) * card_w + 10, (i // 3) * card_h + card_h - 26), key, fill=(220, 226, 240), font=font)
    sheet.save(ROOT / ".sprite-contact-sheet.jpg", quality=90)

    print(f"Wrote {OUTPUT / 'manifest.json'} and {sum(len(v['expressions']) for v in manifest.values())} sprites.")


if __name__ == "__main__":
    main()
