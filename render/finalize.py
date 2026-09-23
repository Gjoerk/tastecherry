"""Turn raw Blender PNGs into web assets.

- Fades the shadow-catcher shadow (semi-transparent pixels) to `shadow` strength.
- Writes WebP with alpha into assets/img/.

python3 render/finalize.py title
python3 render/finalize.py seq strawberry|rough|cut
"""

import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "render/out")
DST = os.path.join(ROOT, "assets/img")


def fade_shadow(im, strength):
    a = np.asarray(im).astype(np.float32)
    alpha = a[..., 3] / 255.0
    soft = alpha < 0.995                       # shadow + antialiased edges
    alpha[soft] *= strength + (1 - strength) * alpha[soft] ** 4  # keep edges crisp
    a[..., 3] = alpha * 255
    return Image.fromarray(a.clip(0, 255).astype(np.uint8), "RGBA")


def save_webp(im, path, quality=88):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, "WEBP", quality=quality, alpha_quality=90, method=6)


def title():
    im = Image.open(os.path.join(RAW, "title.png")).convert("RGBA")
    im = fade_shadow(im, 0.55)
    save_webp(im, os.path.join(DST, "hero/title.webp"), 90)
    half = im.resize((im.width // 2, im.height // 2), Image.LANCZOS)
    save_webp(half, os.path.join(DST, "hero/title-1200.webp"), 90)
    print("title", im.size)


def seq(name, shadow=0.6):
    src = os.path.join(RAW, name)
    files = sorted(f for f in os.listdir(src) if f.endswith(".png"))
    for f in files:
        im = fade_shadow(Image.open(os.path.join(src, f)).convert("RGBA"), shadow)
        save_webp(im, os.path.join(DST, "turntable", name, f.replace(".png", ".webp")))
    print(name, len(files), "frames")


if __name__ == "__main__":
    if sys.argv[1] == "title":
        title()
    else:
        seq(sys.argv[2])
