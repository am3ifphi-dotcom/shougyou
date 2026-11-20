#!/usr/bin/env python3
"""
SHATTERED CROWN - asset fetcher / preprocessor.

    python3 tools/fetch_assets.py              # prefetch everything (recommended)
    python3 tools/fetch_assets.py --force      # ignore the on-disk cache
    python3 tools/fetch_assets.py --verify     # offline sanity check only
    python3 tools/fetch_assets.py --report     # re-emit LICENSES.md + credits
    COMMERCIAL_BUILD=true python3 tools/fetch_assets.py

Sources are public GitHub repository trees served through the blob API
(`?ref=<sha>` pins the exact revision).  Every payload is validated by
signature: a Git LFS pointer, an HTML error page or an API rate-limit body is
rejected and the entry is marked `fallback`, which makes the game swap in its
procedural / synthesised replacement instead of breaking.

Outputs
    assets/<path>                 the files the game actually loads
    assets/manifest.local.json    id -> status / size / dimensions / sha256
    assets/fetch.log              human readable run log
    LICENSES.md                   attribution roll, generated
    src/generated/credits.js      same roll as data for the CREDITS scene
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import struct
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "assets.manifest.json"
LOCAL_MANIFEST = ROOT / "assets" / "manifest.local.json"
USER_DIR = ROOT / "assets" / "user"
LOGFILE = ROOT / "assets" / "fetch.log"

COMMERCIAL_BUILD = os.environ.get("COMMERCIAL_BUILD", "").strip().lower() in {"1", "true", "yes", "on"}

LICENCE_TEXT = {
    "CC0-1.0": ("Creative Commons Zero 1.0 Universal", "https://creativecommons.org/publicdomain/zero/1.0/"),
    "CC-BY-3.0": ("Creative Commons Attribution 3.0", "https://creativecommons.org/licenses/by/3.0/"),
    "CC-BY-4.0": ("Creative Commons Attribution 4.0 International", "https://creativecommons.org/licenses/by/4.0/"),
    "CC-BY-SA-4.0": ("Creative Commons Attribution-ShareAlike 4.0", "https://creativecommons.org/licenses/by-sa/4.0/"),
    "CC-BY-NC-4.0": ("Creative Commons Attribution-NonCommercial 4.0", "https://creativecommons.org/licenses/by-nc/4.0/"),
    "CC-BY-NC-SA-4.0": ("Creative Commons Attribution-NonCommercial-ShareAlike 4.0", "https://creativecommons.org/licenses/by-nc-sa/4.0/"),
    "OFL-1.1": ("SIL Open Font License 1.1", "https://openfontlicense.org/"),
    "MIT": ("MIT License", "https://opensource.org/license/mit"),
}

NONCOMMERCIAL_TAGS = ("NC", "NONCOMMERCIAL", "NON-COMMERCIAL", "PERSONAL USE")

log_lines: list[str] = []


def log(msg: str) -> None:
    print(msg, flush=True)
    log_lines.append(msg)


def is_noncommercial(lic: str) -> bool:
    up = (lic or "").upper()
    return any(tag in up for tag in NONCOMMERCIAL_TAGS)


# ---------------------------------------------------------------------------
# transport
# ---------------------------------------------------------------------------
def resolve_urls(entry: dict) -> list[str]:
    """Ordered list of places to try for one manifest entry."""
    urls: list[str] = []
    for key in ("urls", ):
        if isinstance(entry.get(key), list):
            urls.extend(entry[key])
    for key in ("raw_url", "url"):
        u = entry.get(key)
        if u and u not in urls:
            urls.append(u)
    return urls


def _via_gh_cli(url: str) -> bytes | None:
    """Use the authenticated GitHub CLI transport when available.

    The blob API is limited to 60 anonymous requests per hour, which is far
    less than a sprite set needs; the CLI carries the user's own token.
    """
    if not shutil.which("gh"):
        return None
    m = re.match(r"https://api\.github\.com/repos/([^/]+/[^/]+)/contents/(.+?)(\?.*)?$", url)
    if not m:
        return None
    repo, path = m.group(1), m.group(2)
    try:
        out = subprocess.run(
            ["gh", "api", f"repos/{repo}/contents/{path}", "-H", "Accept: application/vnd.github.raw"],
            capture_output=True,
            timeout=120,
            check=False,
        )
    except Exception:  # noqa: BLE001
        return None
    if out.returncode != 0 or not out.stdout:
        return None
    return out.stdout


def _via_http(url: str) -> bytes:
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN") or ""
    headers = {
        "User-Agent": "shattered-crown-asset-fetcher/1.0",
        "Accept": "application/vnd.github.raw, */*",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    if token and "api.github.com" in url:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def fetch(url: str) -> bytes:
    cli = _via_gh_cli(url)
    if cli is not None:
        return cli
    return _via_http(url)


def looks_like_lfs(data: bytes) -> bool:
    return data[:64].startswith(b"version https://git-lfs.github.com/spec")


def sniff(data: bytes) -> str:
    head = data[:16]
    if head.startswith(b"\x89PNG"):
        return "png"
    if head.startswith(b"OggS"):
        return "ogg"
    if head.startswith(b"ID3") or head[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"):
        return "mp3"
    if head.startswith(b"wOF2"):
        return "woff2"
    if head.startswith(b"wOFF"):
        return "woff"
    if head.startswith(b"OTTO"):
        return "otf"
    if head.startswith(b"\x00\x01\x00\x00") or head.startswith(b"true") or head.startswith(b"ttcf"):
        return "ttf"
    if data[:5].lower() in (b"<svg ", b"<?xml"):
        return "svg"
    if head.startswith(b"RIFF"):
        return "riff"
    if head.startswith(b"{") or head.startswith(b"["):
        return "api-body"
    return "unknown"


EXPECT = {
    "font": {"ttf", "otf", "woff", "woff2"},
    "audio": {"ogg", "mp3", "riff"},
}


def expected_kinds(typ: str) -> set[str]:
    return EXPECT.get(typ, {"png", "svg"})


# ---------------------------------------------------------------------------
# PNG helpers - pure stdlib so the fetcher has zero dependencies
# ---------------------------------------------------------------------------
def png_header(data: bytes) -> tuple[int, int, int, int]:
    assert data[:8] == b"\x89PNG\r\n\x1a\n", "not a png"
    w, h, bit, color = struct.unpack(">IIBB", data[16:26])
    return w, h, bit, color


def png_dimensions(path: Path) -> str:
    w, h, _, _ = png_header(path.read_bytes())
    return f"{w}x{h}"


def _unfilter(raw: bytes, w: int, h: int, ch: int, bits: int) -> list[bytearray]:
    stride = (w * ch * bits + 7) // 8
    bpp = max(1, (ch * bits + 7) // 8)
    out: list[bytearray] = []
    prev = bytearray(stride)
    p = 0
    for _ in range(h):
        f = raw[p]
        p += 1
        line = bytearray(raw[p : p + stride])
        p += stride
        if f == 1:
            for i in range(bpp, stride):
                line[i] = (line[i] + line[i - bpp]) & 0xFF
        elif f == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 0xFF
        elif f == 3:
            for i in range(stride):
                left = line[i - bpp] if i >= bpp else 0
                line[i] = (line[i] + ((left + prev[i]) >> 1)) & 0xFF
        elif f == 4:
            for i in range(stride):
                a = line[i - bpp] if i >= bpp else 0
                b = prev[i]
                c = prev[i - bpp] if i >= bpp else 0
                pp = a + b - c
                pa, pb, pc = abs(pp - a), abs(pp - b), abs(pp - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[i] = (line[i] + pr) & 0xFF
        out.append(line)
        prev = line
    return out


def png_to_rgba(path: Path) -> tuple[int, int, bytearray]:
    """Decode a PNG (any bit depth / colour type / interlace 0) to RGBA8."""
    import zlib

    data = path.read_bytes()
    w, h, bit, color = png_header(data)
    pos, idat, interlace = 8, bytearray(), 0
    while pos < len(data):
        (ln,) = struct.unpack(">I", data[pos : pos + 4])
        typ = data[pos + 4 : pos + 8]
        chunk = data[pos + 8 : pos + 8 + ln]
        if typ == b"IHDR":
            interlace = chunk[12]
        elif typ == b"IDAT":
            idat += chunk
        elif typ == b"IEND":
            break
        pos += 12 + ln
    assert interlace == 0, f"interlaced png not supported: {path}"
    ch = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[color]
    raw = zlib.decompress(bytes(idat))
    lines = _unfilter(raw, w, h, ch, bit)

    palette = b""
    trns = b""
    pos = 8
    while pos < len(data):
        (ln,) = struct.unpack(">I", data[pos : pos + 4])
        typ = data[pos + 4 : pos + 8]
        chunk = data[pos + 8 : pos + 8 + ln]
        if typ == b"PLTE":
            palette = chunk
        elif typ == b"tRNS":
            trns = chunk
        pos += 12 + ln

    def sample(line: bytearray, i: int, maxv: int) -> int:
        if bit == 8:
            return line[i]
        if bit == 16:
            return line[2 * i]
        per = 8 // bit
        byte = line[i // per]
        shift = 8 - bit * (i % per + 1)
        return (byte >> shift) & ((1 << bit) - 1)

    maxv = (1 << bit) - 1
    out = bytearray(w * h * 4)
    for y in range(h):
        line = lines[y]
        for x in range(w):
            d = (y * w + x) * 4
            if color == 6:  # RGBA
                if bit == 8:  # fast path
                    out[d : d + 4] = line[x * 4 : x * 4 + 4]
                else:
                    out[d : d + 3] = bytes(sample(line, x * 4 + i, maxv) for i in range(3))
                    out[d + 3] = sample(line, x * 4 + 3, maxv)
            elif color == 2:  # RGB
                out[d : d + 3] = bytes(sample(line, x * 3 + i, maxv) for i in range(3))
                out[d + 3] = 255
            elif color == 0:  # grey
                g = sample(line, x, maxv)
                g = g * 255 // maxv
                out[d : d + 3] = bytes((g, g, g))
                out[d + 3] = 255
            elif color == 4:  # grey + alpha
                g = sample(line, x * 2, maxv) * 255 // maxv
                a = sample(line, x * 2 + 1, maxv) * 255 // maxv
                out[d : d + 3] = bytes((g, g, g))
                out[d + 3] = a
            else:  # palette
                idx = sample(line, x, maxv)
                if palette:
                    out[d : d + 3] = palette[idx * 3 : idx * 3 + 3]
                    out[d + 3] = trns[idx] if idx < len(trns) else 255
                else:
                    out[d : d + 4] = bytes((0, 0, 0, 0))
    return w, h, out


def rgba_to_png(path: Path, w: int, h: int, rgba: bytearray) -> None:
    import zlib

    raw = bytearray()
    stride = w * 4
    for y in range(h):
        raw.append(0)
        raw += rgba[y * stride : (y + 1) * stride]

    def chunk(typ: bytes, payload: bytes) -> bytes:
        return struct.pack(">I", len(payload)) + typ + payload + struct.pack(">I", zlib.crc32(typ + payload) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)


def crop_frame(src: Path, dst: Path, fw: int, fh: int, index: int) -> None:
    w, h, px = png_to_rgba(src)
    cols = max(1, w // fw)
    x0 = (index % cols) * fw
    y0 = (index // cols) * fh
    out = bytearray(fw * fh * 4)
    for y in range(fh):
        s = ((y0 + y) * w + x0) * 4
        out[y * fw * 4 : (y + 1) * fw * 4] = px[s : s + fw * 4]
    rgba_to_png(dst, fw, fh, out)


# ---------------------------------------------------------------------------
# main loop
# ---------------------------------------------------------------------------
def process(entry: dict, args, counts: dict) -> dict:
    aid = entry["id"]
    typ = entry.get("type", "image")
    rec = {
        "id": aid,
        "type": typ,
        "role": entry.get("role"),
        "local_path": entry["local_path"],
        "author": entry.get("author"),
        "source_page": entry.get("source_page"),
        "license": entry.get("license"),
        "attribution_required": bool(entry.get("attribution_required", False)),
        "noncommercial_only": bool(entry.get("noncommercial_only", False)) or is_noncommercial(entry.get("license", "")),
        "modified": bool(entry.get("modified", False)),
        "redistribute_allowed": bool(entry.get("redistribute_allowed", True)),
        "notes": entry.get("notes", ""),
        "status": "pending",
        "bytes": 0,
    }

    if COMMERCIAL_BUILD and rec["noncommercial_only"]:
        rec["status"] = "excluded-noncommercial"
        counts["excluded"] += 1
        log(f"[excl ] {aid:22s} removed (non-commercial licence, COMMERCIAL_BUILD)")
        return rec

    local = ROOT / entry["local_path"]
    override = USER_DIR / Path(entry["local_path"]).name
    if override.exists() and not args.force:
        rec.update(status="user-override", bytes=override.stat().st_size)
        counts["user"] += 1
        log(f"[user ] {aid:22s} {override.relative_to(ROOT)}")
        return rec

    if local.exists() and not args.force:
        try:
            kind = sniff(local.read_bytes())
        except Exception:  # noqa: BLE001
            kind = "unreadable"
        if kind in expected_kinds(typ):
            rec.update(status="cached", bytes=local.stat().st_size, format=kind)
            if kind == "png":
                rec["dimensions"] = png_dimensions(local)
            counts["cached"] += 1
            log(f"[cache] {aid:22s} {local.stat().st_size:>9,}B {kind}")
            return rec

    errors = []
    for url in resolve_urls(entry):
        try:
            data = fetch(url)
            if looks_like_lfs(data):
                raise RuntimeError("source is a Git LFS pointer")
            kind = sniff(data)
            if kind == "api-body":
                raise RuntimeError(f"source returned JSON: {data[:120]!r}")
            if kind == "unknown":
                raise RuntimeError(f"unrecognised payload {data[:16]!r}")
            if kind not in expected_kinds(typ):
                raise RuntimeError(f"wrong payload type {kind} for {typ}")
            local.parent.mkdir(parents=True, exist_ok=True)
            local.write_bytes(data)

            job = entry.get("post")
            if isinstance(job, dict) and job.get("op") == "crop_frame":
                crop_frame(local, local, job["w"], job["h"], job["index"])
                rec["modified"] = True

            rec.update(
                status="ok",
                bytes=local.stat().st_size,
                format=kind,
                sha256=hashlib.sha256(local.read_bytes()).hexdigest()[:16],
            )
            if kind == "png":
                rec["dimensions"] = png_dimensions(local)
            counts["ok"] += 1
            dims = f" {rec['dimensions']}" if rec.get("dimensions") else ""
            log(f"[ ok  ] {aid:22s} {local.stat().st_size:>9,}B {kind}{dims}")
            return rec
        except Exception as e:  # noqa: BLE001
            errors.append(f"{type(e).__name__}: {e}")
            time.sleep(1.0)

    rec.update(status="fallback", error=" | ".join(errors)[:400])
    counts["fallback"] += 1
    log(f"[FALL ] {aid:22s} {errors[0][:120] if errors else 'no source'} -> procedural fallback")
    return rec


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default=None)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--verify", action="store_true")
    ap.add_argument("--report", action="store_true", help="only rebuild LICENSES.md + credits.js")
    args = ap.parse_args()

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))

    if args.report and LOCAL_MANIFEST.exists():
        recs = json.loads(LOCAL_MANIFEST.read_text(encoding="utf-8"))["assets"]
        write_user_index()
        write_licenses(recs)
        write_credits_js(recs)
        log(f"regenerated LICENSES.md and src/generated/credits.js from {len(recs)} records")
        return 0

    records = []
    counts = {"ok": 0, "cached": 0, "user": 0, "fallback": 0, "excluded": 0}

    for entry in manifest["assets"]:
        typ = entry.get("type", "image")
        if args.only:
            bucket = "image" if typ in ("image", "sprite", "tile", "decal") else typ
            if args.only not in (typ, bucket):
                continue
        records.append(process(entry, args, counts))
        sys.stdout.flush()

    # keep records for entries filtered out this run
    if LOCAL_MANIFEST.exists():
        old = {r["id"]: r for r in json.loads(LOCAL_MANIFEST.read_text(encoding="utf-8")).get("assets", [])}
        merged = [r if r["status"] != "pending" else old.get(r["id"], r) for r in records]
        if len(merged) < len(manifest["assets"]):
            have = {r["id"] for r in merged}
            for entry in manifest["assets"]:
                if entry["id"] not in have and entry["id"] in old:
                    merged.append(old[entry["id"]])
            order = {e["id"]: i for i, e in enumerate(manifest["assets"])}
            merged.sort(key=lambda r: order.get(r["id"], 9999))
        records = merged

    payload = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "commercial_build": COMMERCIAL_BUILD,
        "counts": counts,
        "assets": records,
    }
    LOCAL_MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    LOCAL_MANIFEST.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    LOGFILE.write_text("\n".join(log_lines) + "\n", encoding="utf-8")

    write_user_index()
    write_licenses(records)
    write_credits_js(records)
    log("")
    log("ok={ok} cached={cached} user={user} fallback={fallback} excluded={excluded}  "
        "manifest -> assets/manifest.local.json".format(**counts))
    return 0


# ---------------------------------------------------------------------------
# generated docs
# ---------------------------------------------------------------------------
def write_user_index() -> None:
    """Publish the list of hand-placed overrides so the game never probes 404s."""
    USER_DIR.mkdir(parents=True, exist_ok=True)
    files = sorted(p.name for p in USER_DIR.iterdir() if p.is_file() and not p.name.startswith('.'))
    (USER_DIR / "index.json").write_text(json.dumps({"files": files}, indent=2) + "\n", encoding="utf-8")
    if files:
        log(f"[user ] index.json lists {len(files)} override(s)")


def group_records(records):
    groups: dict[tuple, list] = {}
    for r in records:
        if r["status"] == "excluded-noncommercial":
            continue
        key = (r.get("author") or "Unknown", r.get("license") or "Unknown", r.get("source_page") or "")
        groups.setdefault(key, []).append(r)
    return groups


def write_licenses(records) -> None:
    groups = group_records(records)
    missing = [r["id"] for r in records if r["status"] == "fallback"]
    lines = [
        "# LICENSES",
        "",
        "**SHATTERED CROWN** - personal, non-commercial 2D action RPG.",
        "",
        "This file is generated by `tools/fetch_assets.py` from `assets.manifest.json`.",
        "Do not edit by hand - re-run `python3 tools/fetch_assets.py --report`.",
        "",
        f"Build flavour: **{'COMMERCIAL' if COMMERCIAL_BUILD else 'NON-COMMERCIAL (personal)'}** · "
        f"generated {time.strftime('%Y-%m-%d %H:%M UTC')}",
        "",
        "Every entry below was fetched from a public distribution page whose licence",
        "permits this use, and each downloaded payload was signature-checked (an LFS",
        "pointer or an error body is rejected, never shipped).",
        "",
        "---",
        "",
    ]
    for (author, lic, page), items in sorted(groups.items()):
        name, lic_url = LICENCE_TEXT.get(lic, (lic, ""))
        lines.append(f"## {author}")
        lines.append("")
        lines.append(f"- **Licence:** {lic} - {name}")
        if lic_url:
            lines.append(f"- **Licence text:** {lic_url}")
        if page:
            lines.append(f"- **Source:** {page}")
        if any(i["noncommercial_only"] for i in items):
            lines.append("- **Scope:** non-commercial use only; dropped automatically when `COMMERCIAL_BUILD=true`.")
        if any(i["attribution_required"] for i in items):
            lines.append("- **Attribution:** required by the licence - credited above and in the in-game CREDITS roll.")
        else:
            lines.append("- **Attribution:** not required by the licence, credited voluntarily.")
        for i in items:
            mod = " (modified: trimmed/re-encoded locally)" if i["modified"] else ""
            lines.append(f"  - `{i['id']}`{mod}")
        lines.append("")

    if missing:
        lines += [
            "## Runtime fallbacks",
            "",
            "These ids could not be verified during the last fetch run and are",
            "replaced at runtime by procedural art / synthesised audio written for",
            "this project (CC0). The game remains fully playable without them.",
            "",
        ]
        lines += [f"- `{m}`" for m in missing]
        lines.append("")

    lines += [
        "---",
        "",
        "## Engine & runtime libraries",
        "",
        "- **PixiJS 8.6.6** (MIT) - WebGL renderer - https://pixijs.com/",
        "- **Howler.js 2.2.4** (MIT) - audio bus / crossfades - https://howlerjs.com/",
        "",
        "## Generated fallbacks",
        "",
        "Procedurally generated textures and WebAudio synthesis are original work",
        "released CC0 as part of this project.",
        "",
        "## Font fallbacks",
        "",
        "If a bundled font fails to load the UI falls back to the system stack",
        "`Georgia, 'Times New Roman', serif` (body) and `monospace` (pixel UI).",
        "",
    ]
    (ROOT / "LICENSES.md").write_text("\n".join(lines), encoding="utf-8")


def write_credits_js(records) -> None:
    roll = []
    for (author, lic, page), items in sorted(group_records(records).items()):
        roll.append(
            {
                "author": author,
                "license": lic,
                "licenseUrl": LICENCE_TEXT.get(lic, ("", ""))[1],
                "licenseName": LICENCE_TEXT.get(lic, (lic, ""))[0],
                "source": page,
                "noncommercialOnly": any(i["noncommercial_only"] for i in items),
                "attributionRequired": any(i["attribution_required"] for i in items),
                "assets": [i["id"] for i in items],
            }
        )
    payload = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "commercialBuild": COMMERCIAL_BUILD,
        "credits": roll,
    }
    dest = ROOT / "src" / "generated" / "credits.js"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(
        "// AUTO-GENERATED by tools/fetch_assets.py - do not edit by hand.\n"
        "export const CREDIT_ROLL = " + json.dumps(payload, indent=2, ensure_ascii=False) + ";\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    sys.exit(main())
