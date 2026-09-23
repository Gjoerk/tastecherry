"""Composite a transparent render over --paper and report the dominant face colour.

python3 render/inspect_render.py render/out/title_test.png [out.jpg]
"""

import sys
from collections import Counter

from PIL import Image

PAPER = (0xF3, 0xF1, 0xEB)

src = Image.open(sys.argv[1]).convert("RGBA")
bg = Image.new("RGBA", src.size, PAPER + (255,))
comp = Image.alpha_composite(bg, src).convert("RGB")
out = sys.argv[2] if len(sys.argv) > 2 else sys.argv[1].rsplit(".", 1)[0] + "_on_paper.jpg"
comp.save(out, quality=92)

# Most common colours among fully opaque pixels (the object, not the shadow)
px = [p[:3] for p in src.getdata() if p[3] == 255]
common = Counter((r >> 1 << 1, g >> 1 << 1, b >> 1 << 1) for r, g, b in px).most_common(5)
print("paper", PAPER, "| opaque px", len(px), "| top", common)
print("wrote", out)
