#!/usr/bin/env python3
"""Generate the GitHub social preview image (1280x640) for CMX.

GitHub does not expose the social preview image through the REST API — it is
uploaded once via Settings -> General -> Social preview. This script produces
the file to upload, and keeps it reproducible so the preview can be refreshed
whenever the product's look changes.

Usage:
    python3 scripts/make_social_preview.py

Requires Pillow:  pip install pillow
"""

from __future__ import annotations

import pathlib
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
HERO = ROOT / "docs" / "screenshots" / "01-workspace-dark.png"
OUT = ROOT / "docs" / "social-preview.png"

W, H = 1280, 640

# Colours sampled from the app's own dark theme (docs/screenshots/01-workspace-dark.png)
BG_DEEP = (20, 20, 22)      # #141416
BG_PANEL = (31, 31, 35)    # #1F1F23
BORDER = (39, 39, 42)      # #27272A
TEXT = (228, 228, 231)     # #E4E4E7
MUTED = (161, 161, 170)    # zinc-400
ACCENT = (9, 105, 218)     # #0969DA
ACCENT_ALT = (33, 206, 232)  # #21CEE8

FONT_PATH = "/System/Library/Fonts/SFNS.ttf"


def font(size: int, weight: str = "Regular") -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(FONT_PATH, size)
    try:
        f.set_variation_by_name(weight)
    except OSError:
        pass
    return f


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius, fill=255)
    return mask


def build_background() -> Image.Image:
    """Dark canvas with a soft accent glow behind the product shot."""
    bg = Image.new("RGB", (W, H), BG_DEEP)

    glow = Image.new("RGB", (W, H), BG_DEEP)
    gd = ImageDraw.Draw(glow)
    gd.ellipse((W * 0.42, -H * 0.55, W * 1.25, H * 0.95), fill=(18, 52, 96))
    gd.ellipse((W * 0.55, -H * 0.2, W * 1.15, H * 0.7), fill=(14, 40, 74))
    glow = glow.filter(ImageFilter.GaussianBlur(150))

    return Image.blend(bg, glow, 0.45)


def paste_hero(canvas: Image.Image) -> None:
    """Right-hand product screenshot, rounded and lightly framed."""
    hero = Image.open(HERO).convert("RGB")

    card_w = 700
    card_h = round(card_w * hero.height / hero.width)          # ~367
    hero = hero.resize((card_w, card_h), Image.LANCZOS)

    x = W - card_w - 56
    y = (H - card_h) // 2

    # drop shadow
    shadow = Image.new("RGBA", (card_w + 80, card_h + 80), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (40, 40, card_w + 39, card_h + 39), radius=18, fill=(0, 0, 0, 150)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(26))
    canvas.paste(shadow, (x - 40, y - 40), shadow)

    # 1px frame + clipped screenshot
    frame = Image.new("RGBA", (card_w + 2, card_h + 2), BORDER + (255,))
    ImageDraw.Draw(frame).rounded_rectangle((0, 0, card_w + 1, card_h + 1), radius=16, outline=BORDER, width=2)

    shot = hero.convert("RGBA")
    shot.putalpha(rounded_mask((card_w, card_h), 16))

    frame.alpha_composite(shot, (1, 1))
    canvas.paste(frame, (x, y), frame)


def draw_wordmark(d: ImageDraw.ImageDraw) -> None:
    x, y = 72, 118

    d.text((x, y), "CMX", font=font(104, "Bold"), fill=TEXT)

    w = d.textlength("CMX", font=font(104, "Bold"))

    # accent rule under the wordmark
    d.rounded_rectangle((x, y + 132, x + 68, y + 140), radius=4, fill=ACCENT)
    d.rounded_rectangle((x + 76, y + 132, x + 116, y + 140), radius=4, fill=ACCENT_ALT)


def draw_copy(d: ImageDraw.ImageDraw) -> None:
    x = 72
    d.text((x, 308), "Lightweight, high performance", font=font(31, "Semibold"), fill=TEXT)
    d.text((x, 352), "code editor with Vim mode, search", font=font(24, "Regular"), fill=MUTED)
    d.text((x, 384), "and live preview.", font=font(24, "Regular"), fill=MUTED)

    # supporting-badge row
    labels = ["No Electron", "No bundled browser", "MIT licensed"]
    fx, fy = x, 462
    for label in labels:
        f = font(17, "Medium")
        tw = int(d.textlength(label, font=f))
        d.rounded_rectangle((fx, fy, fx + tw + 30, fy + 36), radius=18, fill=BG_PANEL, outline=BORDER, width=1)
        d.text((fx + 15, fy + 8), label, font=f, fill=TEXT)
        fx += tw + 30 + 10


def draw_footer(d: ImageDraw.ImageDraw) -> None:
    d.text((72, 566), "macOS  ·  Linux  ·  Windows", font=font(19, "Medium"), fill=MUTED)
    d.text((72, 596), "github.com/chaitmudunuri/cmx", font=font(16, "Regular"), fill=(113, 113, 122))


def main() -> int:
    if not HERO.exists():
        print(f"error: hero screenshot not found at {HERO}", file=sys.stderr)
        return 1

    canvas = build_background()
    paste_hero(canvas)

    d = ImageDraw.Draw(canvas)
    draw_wordmark(d)
    draw_copy(d)
    draw_footer(d)

    canvas.save(OUT, "PNG", optimize=True)
    print(f"wrote {OUT.relative_to(ROOT)} ({canvas.width}x{canvas.height})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())