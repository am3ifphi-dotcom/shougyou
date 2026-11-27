#!/usr/bin/env python3
"""Fetch permissively licensed third-party game assets from GitHub.

Run after `npm install`.  Requires the pre-authenticated `gh` CLI in this sandbox.
All fetched files are written below public/assets and public/vendor.
"""
from __future__ import annotations

import base64
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "public" / "assets"
VENDOR = ROOT / "public" / "vendor"


def gh_json(endpoint: str):
    out = subprocess.check_output(
        ["gh", "api", endpoint, "-H", "Accept: application/vnd.github+json", "--jq", "."],
        text=True,
    )
    return json.loads(out)


def gh_jq(endpoint: str, jq: str) -> str:
    return subprocess.check_output(
        ["gh", "api", endpoint, "-H", "Accept: application/vnd.github+json", "--jq", jq],
        text=True,
    ).strip()


def blob(repo: str, sha: str) -> bytes:
    data = gh_json(f"repos/{repo}/git/blobs/{sha}")
    return base64.b64decode(data["content"])


def contents(repo: str, path: str, ref: str = "main") -> bytes:
    encoded = gh_jq(f"repos/{repo}/contents/{path}?ref={ref}", ".content")
    return base64.b64decode(encoded)


def save(rel: Path, data: bytes) -> None:
    target = ASSETS / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    print(f"  {rel}  {len(data):,} bytes")


def tree(repo: str, ref: str) -> dict[str, str]:
    data = gh_json(f"repos/{repo}/git/trees/{ref}?recursive=1")
    if data.get("truncated"):
        raise RuntimeError(f"Tree for {repo}@{ref} was truncated")
    return {item["path"]: item["sha"] for item in data["tree"] if item["type"] == "blob"}


def main() -> None:
    print("Fetching CC0 BGM…")
    bgm_repo = "uncle-sheepsky/duru-ai-cc0-bgm"
    bgm_entries = gh_json(f"repos/{bgm_repo}/contents/mp3?ref=main")
    bgm_sha = {item["name"]: item["sha"] for item in bgm_entries if item["type"] == "file"}
    bgm = {
        "title.mp3": "duru-zoneout-16-shootingstar-whistle.mp3",
        "daily.mp3": "duru-zoneout-01-melty-afternoon.mp3",
        "archive.mp3": "duru-roomscene-lofi.mp3",
        "nocturne.mp3": "duru-zoneout-11-warm-milk-nocturne.mp3",
        "truth.mp3": "duru-bed-brainmap-leftpanel.mp3",
        "climax.mp3": "duru-zoneout-04-pillow-waltz.mp3",
        "epilogue.mp3": "duru-reacts.mp3",
    }
    for out_name, source_name in bgm.items():
        save(Path("bgm") / out_name, blob(bgm_repo, bgm_sha[source_name]))

    print("Fetching CC0 cinematic SFX…")
    sfx_repo = "wyzowl/sfx-kit"
    sfx_tree = tree(sfx_repo, "main")
    sfx = {
        "click.wav": "sounds/interface/click-button-soft.wav",
        "hover.wav": "sounds/interface/click-hover-soft.wav",
        "confirm.wav": "sounds/interface/click-toggle-on-soft.wav",
        "cancel.wav": "sounds/interface/click-toggle-off-soft.wav",
        "page.wav": "sounds/everyday-props/props-page-turn.wav",
        "book.wav": "sounds/everyday-props/props-book-close.wav",
        "paper.wav": "sounds/foley/foley-paper-touch.wav",
        "shimmer.wav": "sounds/shimmers/shimmer-short-soft.wav",
        "starlight.wav": "sounds/shimmers/shimmer-long-soft.wav",
        "whoosh.wav": "sounds/whooshes/whoosh-medium-soft.wav",
        "impact.wav": "sounds/cinematic-hits/cinematic-drum-big.wav",
        "riser.wav": "sounds/risers-and-fallers/riser-2s-soft.wav",
        "ding.wav": "sounds/tones/tone-ding-low.wav",
        "tick.wav": "sounds/data/data-tick.wav",
        "blip.wav": "sounds/digital/digital-blip-subtle.wav",
        "power.wav": "sounds/digital/digital-power-up.wav",
        "glitch.wav": "sounds/digital/digital-glitch-subtle.wav",
        "latch.wav": "sounds/mechanical/mechanical-latch-light.wav",
        "chime.wav": "sounds/notifications/notification-success-soft.wav",
        "message.wav": "sounds/notifications/notification-message-in-soft.wav",
        "sting.wav": "sounds/logo-stings/sting-warm-short.wav",
        "rumble.wav": "sounds/booms-and-bass/bass-rumble-short.wav",
    }
    for out_name, source in sfx.items():
        save(Path("se") / out_name, blob(sfx_repo, sfx_tree[source]))

    print("Fetching Live2D Cubism 2.1 sample model…")
    live2d_repo = "guansss/pixi-live2d-display"
    live2d_tree = tree(live2d_repo, "v0.4.0")
    prefix = "test/assets/shizuku/"
    for path, sha in live2d_tree.items():
        if path.startswith(prefix):
            rel = path[len(prefix):]
            save(Path("live2d") / "shizuku" / rel, blob(live2d_repo, sha))

    dylan_repo = "dylanNew/live2d"
    VENDOR.mkdir(parents=True, exist_ok=True)
    runtime = contents(dylan_repo, "webgl/Live2D/lib/live2d.min.js", "master")
    (VENDOR / "live2d.min.js").write_bytes(runtime)
    print(f"  vendor/live2d.min.js  {len(runtime):,} bytes")

    print("Fetching license texts…")
    licenses = {
        "licenses/DURU-AI-CC0-BGM-LICENSE.txt": (bgm_repo, "LICENSE", "main"),
        "licenses/SFX-KIT-CC0-LICENSE.txt": (sfx_repo, "LICENSE", "main"),
        "licenses/PIXI-LIVE2D-DISPLAY-MIT-LICENSE.txt": (
            live2d_repo,
            "LICENSE",
            "v0.4.0",
        ),
    }
    for out_name, (repo, path, ref) in licenses.items():
        try:
            save(Path(out_name), contents(repo, path, ref))
        except subprocess.CalledProcessError as exc:
            print(f"  skipped {out_name}: {exc}")

    print("External asset fetch complete.")


if __name__ == "__main__":
    main()
