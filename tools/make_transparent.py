#!/usr/bin/env python3
"""Magenta chroma-key -> transparent PNG, auto-crop, resize."""
import os, sys
import numpy as np
from PIL import Image

def process(src, dst, max_h=1400):
    im = Image.open(src).convert('RGB')
    arr = np.asarray(im).astype(np.int32)
    r, g, b = arr[...,0], arr[...,1], arr[...,2]
    # distance from magenta (255,0,255): magenta-ness = min(r,b)-g
    magenta = np.minimum(r, b) - g  # high where magenta
    # alpha: 0 when magenta>120, 255 when magenta<40, smooth between
    alpha = np.clip((120 - magenta) / 80.0, 0, 1) * 255
    # also kill near-pure magenta pixels fully
    alpha = np.where(magenta > 150, 0, alpha).astype(np.uint8)
    rgba = np.dstack([arr.astype(np.uint8), alpha])
    out = Image.fromarray(rgba, 'RGBA')
    # auto-crop to alpha bbox
    bbox = out.getbbox()
    if bbox:
        pad = 8
        l = max(0, bbox[0]-pad); t = max(0, bbox[1]-pad)
        r2 = min(out.width, bbox[2]+pad); b2 = min(out.height, bbox[3]+pad)
        out = out.crop((l, t, r2, b2))
    # resize if taller than max_h
    if out.height > max_h:
        w = int(out.width * max_h / out.height)
        out = out.resize((w, max_h), Image.LANCZOS)
    out.save(dst, optimize=True)
    print(f"{src} -> {dst}  {out.size}  {os.path.getsize(dst)//1024}KB")

if __name__ == '__main__':
    os.makedirs('assets/chara', exist_ok=True)
    for f in sorted(os.listdir('assets/chara')):
        if f.endswith('.png') and not f.endswith('_t.png'):
            src = os.path.join('assets/chara', f)
            dst = os.path.join('assets/chara', f.replace('.png', '_t.png'))
            process(src, dst)
