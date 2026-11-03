#!/usr/bin/env python3
"""Generate all icons and wallpapers for WebPad."""
import math
import os
import random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), "..")
ICONS = os.path.join(ROOT, "assets", "icons")
WALLS = os.path.join(ROOT, "assets", "wallpapers")
os.makedirs(ICONS, exist_ok=True)
os.makedirs(WALLS, exist_ok=True)

SIZE = 256
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

def font(size):
    return ImageFont.truetype(FONT_BOLD, size)

def rounded_mask(size, radius):
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m

def gradient_bg(c1, c2, size=SIZE, radius=58, vertical=True):
    img = Image.new("RGB", (size, size))
    for i in range(size):
        t = i / (size - 1) if vertical else 0
        r = int(c1[0] + (c2[0] - c1[0]) * t)
        g = int(c1[1] + (c2[1] - c1[1]) * t)
        b = int(c1[2] + (c2[2] - c1[2]) * t)
        for x in range(size):
            img.putpixel((x, i), (r, g, b))
    img = img.resize((size, size))
    # apply rounded mask
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), rounded_mask(size, radius))
    return out

def draw_icon(name, c1, c2, draw_fn, radius=58):
    img = gradient_bg(c1, c2, radius=radius)
    d = ImageDraw.Draw(img)
    draw_fn(d, img)
    img.save(os.path.join(ICONS, name + ".png"))
    print("icon:", name)

def app_icon(relpath, c1, c2, draw_fn, radius=58):
    img = gradient_bg(c1, c2, radius=radius)
    d = ImageDraw.Draw(img)
    draw_fn(d, img)
    path = os.path.join(ROOT, relpath)
    img.save(path)
    print("icon:", relpath)

# ---------- WebPad logo ----------
def _logo(d, img):
    d.text((128, 128), "W", font=font(150), fill=(255, 255, 255), anchor="mm")
draw_icon("webpad", (64, 120, 220), (138, 92, 246), _logo, radius=58)

# ---------- App Store ----------
def _store(d, img):
    d.text((128, 122), "A", font=font(148), fill=(255, 255, 255), anchor="mm")
draw_icon("appstore", (10, 132, 255), (0, 87, 216), _store)

# ---------- Settings (gear) ----------
def _gear(d, img):
    cx, cy = 128, 128
    # teeth
    for k in range(8):
        a = k * math.pi / 4
        x1 = cx + 62 * math.cos(a)
        y1 = cy + 62 * math.sin(a)
        d.line([(x1 - 14 * math.sin(a), y1 + 14 * math.cos(a)),
                (x1 + 14 * math.sin(a), y1 - 14 * math.cos(a))],
               fill=(255, 255, 255), width=26)
    d.ellipse([cx - 62, cy - 62, cx + 62, cy + 62], fill=(255, 255, 255))
    d.ellipse([cx - 26, cy - 26, cx + 26, cy + 26], fill=(110, 110, 118))
draw_icon("settings", (142, 142, 148), (84, 84, 92), _gear)

# ---------- Photos (petal flower) ----------
def _photos(d, img):
    cx, cy = 128, 128
    petals = [(255, 59, 48), (255, 149, 0), (255, 204, 0), (52, 199, 89),
              (0, 199, 190), (50, 173, 230), (0, 122, 255), (175, 82, 222)]
    overlay = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for i, col in enumerate(petals):
        a = i * math.pi / 4
        px = cx + 44 * math.cos(a)
        py = cy + 44 * math.sin(a)
        od.ellipse([px - 34, py - 22, px + 34, py + 22], fill=col + (200,))
        # rotate ellipse by drawing on temp
    # simpler: rotate the overlay progressively
    img.paste(overlay, (0, 0), overlay)
    d.ellipse([cx - 30, cy - 30, cx + 30, cy + 30], fill=(255, 255, 255, 230))
draw_icon("photos", (250, 250, 252), (225, 228, 235), _photos)

# ---------- Calculator ----------
def _calc(d, img):
    # dark keypad
    pad = 60
    d.rounded_rectangle([pad, 34, SIZE - pad, 78], radius=14, fill=(255, 255, 255))
    cols = [74, 128, 182]
    ys = [104, 152, 200]
    for r, y in enumerate(ys):
        for c, x in enumerate(cols):
            if c == 2:
                col = (255, 159, 10)
            elif r == 0 and c == 1:
                col = (165, 165, 165)
            elif r == 0 and c == 0:
                col = (165, 165, 165)
            else:
                col = (110, 110, 118)
            d.ellipse([x - 21, y - 21, x + 21, y + 21], fill=col)
app_icon("apps/calculator/icon.png", (58, 60, 68), (28, 30, 36), _calc)

# ---------- Clock ----------
def _clock(d, img):
    cx, cy = 128, 128
    d.ellipse([cx - 92, cy - 92, cx + 92, cy + 92], fill=(255, 255, 255))
    # marks
    for k in range(12):
        a = k * math.pi / 6
        d.line([(cx + 80 * math.sin(a), cy - 80 * math.cos(a)),
                (cx + 88 * math.sin(a), cy - 88 * math.cos(a))],
               fill=(60, 60, 67), width=5)
    # hands ~10:09
    d.line([(cx, cy), (cx + 42 * math.sin(math.radians(305)), cy - 42 * math.cos(math.radians(305)))], fill=(20, 20, 24), width=10)
    d.line([(cx, cy), (cx + 62 * math.sin(math.radians(55)), cy - 62 * math.cos(math.radians(55)))], fill=(20, 20, 24), width=7)
    d.line([(cx, cy), (cx + 74 * math.sin(math.radians(180)), cy - 74 * math.cos(math.radians(180)))], fill=(255, 159, 10), width=3)
    d.ellipse([cx - 8, cy - 8, cx + 8, cy + 8], fill=(255, 159, 10))
app_icon("apps/clock/icon.png", (26, 26, 30), (14, 14, 17), _clock)

# ---------- Notes ----------
def _notes(d, img):
    d.rectangle([0, 0, SIZE, 74], fill=(255, 214, 10))
    for i, y in enumerate([116, 152, 188]):
        d.rounded_rectangle([56, y, 200, y + 12], radius=6, fill=(60, 60, 67))
app_icon("apps/notes/icon.png", (250, 249, 244), (232, 230, 222), _notes)

# ---------- Weather ----------
def _weather(d, img):
    d.ellipse([70, 56, 150, 136], fill=(255, 214, 10))  # sun
    d.ellipse([92, 120, 148, 158], fill=(255, 255, 255))
    d.ellipse([130, 112, 200, 164], fill=(255, 255, 255))
    d.ellipse([164, 130, 214, 170], fill=(255, 255, 255))
    d.rounded_rectangle([92, 140, 214, 168], radius=16, fill=(255, 255, 255))
app_icon("apps/weather/icon.png", (41, 128, 185), (116, 177, 214), _weather)

# ---------- 2048 ----------
def _2048(d, img):
    d.rounded_rectangle([34, 74, 222, 182], radius=16, fill=(255, 250, 235))
    d.text((128, 128), "2048", font=font(46), fill=(119, 110, 101), anchor="mm")
app_icon("apps/game2048/icon.png", (243, 178, 61), (237, 140, 30), _2048)

# ================= Wallpapers =================
PALETTES = {
    "aurora":   [(20, 60, 90), (60, 130, 170), (120, 200, 200), (40, 90, 140), (170, 130, 220)],
    "sunset":   [(120, 50, 100), (240, 120, 90), (250, 180, 90), (90, 40, 110), (255, 150, 120)],
    "forest":   [(16, 66, 44), (40, 110, 70), (110, 170, 100), (20, 80, 55), (70, 140, 90)],
    "candy":    [(255, 150, 180), (255, 200, 120), (180, 140, 255), (255, 120, 160), (150, 200, 255)],
    "ocean":    [(10, 40, 80), (30, 90, 150), (60, 140, 190), (20, 60, 110), (110, 190, 210)],
    "midnight": [(10, 12, 24), (30, 34, 60), (50, 40, 90), (18, 20, 34), (70, 60, 120)],
}

for name, pal in PALETTES.items():
    random.seed(hash(name) & 0xffff)
    W, H = 1600, 1200
    img = Image.new("RGB", (W, H), pal[0])
    d = ImageDraw.Draw(img)
    for col in pal:
        for _ in range(6):
            x = random.randint(-200, W + 200)
            y = random.randint(-200, H + 200)
            r = random.randint(220, 520)
            d.ellipse([x - r, y - r, x + r, y + r], fill=col)
    img = img.filter(ImageFilter.GaussianBlur(160))
    # subtle vignette
    img.save(os.path.join(WALLS, name + ".jpg"), quality=88)
    print("wallpaper:", name)

print("done")
