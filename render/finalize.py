"""Turn raw Blender PNGs into web assets.

- Fades the shadow-catcher shadow (semi-transparent pixels) to `shadow` strength.
- Writes WebP with alpha into assets/img/.

python3 render/finalize.py title
python3 render/finalize.py seq strawberry          (one WebP per frame)
python3 render/finalize.py sheets rough|cut       (3x3 sprite sheets, what the site loads)
python3 render/finalize.py gaze eye   (gaze grid + grid.json → assets/img/eye/)
python3 render/finalize.py compare   (screenshots from render/compare/shoot.js)
"""

import os
import shutil
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


def sheets(name, shadow=0.6, cols=3, rows=3):
    """A turntable as sprite sheets: frames 0,1,2… fill each sheet row by row
    (cols×rows consecutive frames per sheet) → assets/img/turntable/<name>/sheet-NN.webp.
    Far fewer files and requests than one image per frame. Reads the raw PNGs from
    render/out/<name> if they are there, else the single-frame WebPs (which it then removes)."""
    raw = os.path.join(RAW, name)
    dst = os.path.join(DST, "turntable", name)
    if os.path.isdir(raw) and any(f.endswith(".png") for f in os.listdir(raw)):
        files = [os.path.join(raw, f) for f in sorted(os.listdir(raw)) if f.endswith(".png")]
        frame = lambda f: fade_shadow(Image.open(f).convert("RGBA"), shadow)  # noqa: E731
    else:
        files = [os.path.join(dst, f) for f in sorted(os.listdir(dst)) if f[:3].isdigit() and f.endswith(".webp")]
        frame = lambda f: Image.open(f).convert("RGBA")  # noqa: E731
    per = cols * rows
    assert files and len(files) % per == 0, f"{len(files)} frames don't fill {cols}x{rows} sheets"
    w, h = Image.open(files[0]).size
    for k in range(len(files) // per):
        sheet = Image.new("RGBA", (w * cols, h * rows), (0, 0, 0, 0))
        for c in range(per):
            sheet.paste(frame(files[k * per + c]), ((c % cols) * w, (c // cols) * h))
        save_webp(sheet, os.path.join(dst, f"sheet-{k:02d}.webp"), 86)
    for f in os.listdir(dst):                                  # single frames are superseded
        if f[:3].isdigit() and f.endswith(".webp"):
            os.remove(os.path.join(dst, f))
    print(name, len(files), "frames in", len(files) // per, f"{cols}x{rows} sheets of {w}x{h}")


def gaze(name, shadow=0.6):
    """A gaze grid (render/eye.py): frames + grid.json into assets/img/<name>/."""
    src, dst = os.path.join(RAW, name), os.path.join(DST, name)
    files = sorted(f for f in os.listdir(src) if f.endswith(".png"))
    for f in files:
        im = fade_shadow(Image.open(os.path.join(src, f)).convert("RGBA"), shadow)
        save_webp(im, os.path.join(dst, f.replace(".png", ".webp")), 85)
    shutil.copy(os.path.join(src, "grid.json"), os.path.join(dst, "grid.json"))
    print(name, len(files), "frames")


def compare():
    """#problem: the clean AI screenshots, light and dark (opaque) + the red-pen layer (alpha)."""
    src = os.path.join(RAW, "compare")
    for size, width in (("desktop", 2000), ("mobile", 780), ("desktop-dark", 2000), ("mobile-dark", 780)):
        for layer, mode in (("clean", "RGB"), ("pen", "RGBA")):
            if layer == "pen" and size.endswith("-dark"):
                continue                      # same layout: the light pen layer serves both
            im = Image.open(os.path.join(src, f"ai-{layer}-{size}.png")).convert(mode)
            if im.width > width:
                im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
            save_webp(im, os.path.join(DST, "compare", f"ai-{layer}-{size}.webp"), 84)
            print(f"ai-{layer}-{size}", im.size)


if __name__ == "__main__":
    if sys.argv[1] == "title":
        title()
    elif sys.argv[1] == "sheets":
        sheets(sys.argv[2])
    elif sys.argv[1] == "gaze":
        gaze(sys.argv[2])
    elif sys.argv[1] == "compare":
        compare()
    else:
        seq(sys.argv[2])
