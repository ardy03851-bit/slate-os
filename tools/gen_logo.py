#!/usr/bin/env python3
"""Generate the Slate OS logo (used for boot splash, favicon, PWA icons)."""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), "..")
ICONS = os.path.join(ROOT, "assets", "icons")
os.makedirs(ICONS, exist_ok=True)

FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

def rounded_mask(size, radius):
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m

def make(size, out):
    # dark slate vertical gradient
    img = Image.new("RGBA", (size, size))
    top, bottom = (58, 64, 84), (22, 25, 36)
    px = img.load()
    for y in range(size):
        t = y / (size - 1)
        c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        for x in range(size):
            px[x, y] = c
    d = ImageDraw.Draw(img)
    # geometric mark: two offset slate shards forming an "S"-like chevron
    m = size
    w = int(m * 0.09)
    d.polygon([(m*0.28, m*0.38), (m*0.72, m*0.24), (m*0.72, m*0.38), (m*0.28, m*0.52)], fill=(255, 255, 255))
    d.polygon([(m*0.28, m*0.52), (m*0.72, m*0.38), (m*0.72, m*0.62), (m*0.28, m*0.76)], fill=(255, 255, 255, 200))
    d.polygon([(m*0.28, m*0.76), (m*0.72, m*0.62), (m*0.72, m*0.76), (m*0.28, m*0.90)], fill=(255, 255, 255, 160))
    # rounded-corner it
    out_img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out_img.paste(img, (0, 0), rounded_mask(size, int(size * 0.225)))
    out_img.save(out)
    print("logo:", out, out_img.size)

make(256, os.path.join(ICONS, "slate.png"))
make(512, os.path.join(ICONS, "slate-512.png"))
make(192, os.path.join(ICONS, "slate-192.png"))
print("done")
