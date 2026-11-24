#!/usr/bin/env python3
"""Rebuild assets/lib/three-bundle.js from the pinned three@0.128.0 npm tarball.

The bundle keeps the classic global `THREE` scripts so the game can load it
through the manifest at runtime without a bundler.  Run only when refreshing
the pinned engine version; the generated bundle is checked in.
"""
from __future__ import annotations

import io
import tarfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
URL = "https://registry.npmjs.org/three/-/three-0.128.0.tgz"
OUT = ROOT / "assets/lib/three-bundle.js"
ORDER = [
    "package/build/three.min.js",
    "package/examples/js/shaders/CopyShader.js",
    "package/examples/js/shaders/LuminosityHighPassShader.js",
    "package/examples/js/shaders/VignetteShader.js",
    "package/examples/js/shaders/ColorCorrectionShader.js",
    "package/examples/js/postprocessing/Pass.js",
    "package/examples/js/postprocessing/EffectComposer.js",
    "package/examples/js/postprocessing/RenderPass.js",
    "package/examples/js/postprocessing/ShaderPass.js",
    "package/examples/js/postprocessing/MaskPass.js",
    "package/examples/js/postprocessing/UnrealBloomPass.js",
    "package/examples/js/loaders/GLTFLoader.js",
]


def main() -> None:
    req = urllib.request.Request(URL, headers={"User-Agent": "arena-agent"})
    data = urllib.request.urlopen(req, timeout=120).read()
    tf = tarfile.open(fileobj=io.BytesIO(data), mode="r:gz")
    parts = []
    for name in ORDER:
        src = tf.extractfile(name).read().decode("utf-8")
        parts.append(f"/* === {name} (three@0.128.0, MIT) === */\n{src}\n")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(parts), encoding="utf-8")
    # Keep the MIT notice beside the bundle.
    (OUT.parent / "MIT-three.txt").write_bytes(tf.extractfile("package/LICENSE").read())
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes) from {URL}")


if __name__ == "__main__":
    main()
