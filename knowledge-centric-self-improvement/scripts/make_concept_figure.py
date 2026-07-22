#!/usr/bin/env python3
"""Build the hero concept figure from the paper's Figure 1.

The paper renders Figure 1 as three panels: agent-centric, knowledge-centric,
and a solve-rate-vs-cost scatter. The hero uses all three, so the headline
figure carries the result (Ours on the frontier) alongside the concept.

A straight Ghostscript export is not enough on its own. The figure is light
artwork (white background, grey title pills, navy line art) and the site
defaults to dark, so embedding it as-is puts a bright slab on a dark page.
Instead we drop the background entirely and recolor the line art per theme,
keeping the cool concept-panel arrows as the paper draws them and repainting the
warm elements (the frontier arrow, the orange labels, the Ours star) in the
theme accent so nothing turns to a muddy grey on a dark page.

Usage:
    python3 scripts/make_concept_figure.py [path/to/paper/figures/main.pdf]

Writes static/images/main_concept.png (light) and main_concept_dark.png.
Requires Ghostscript on PATH and Pillow.
"""

from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image

DPI = 200
# Luminance below which a greyscale pixel counts as line art rather than
# background, and the ramp width used so antialiased edges stay smooth.
INK_MAX_LUM, INK_RAMP = 0.80, 0.55
# A cool, saturated, bright pixel belongs to a concept-panel gradient arrow
# (magenta/cyan) and is passed through untouched.
KEEP_SAT, KEEP_VAL = 0.35, 0.60
# The scatter's frontier arrow, the "knowledge-centric" labels, and the Ours
# star are all warm (orange/brown, R >= G >= B). The paper draws the arrow as a
# dark-brown-to-orange gradient; passing the dark end through leaves a muddy
# grey tail once it lands on a dark page, so warm pixels are repainted in the
# theme accent instead, with a slight brightness ramp that keeps the climb.
# Warmth is gated on the red-minus-blue spread rather than saturation, so the
# arrow's faint antialiased base is caught while true neutrals stay grey.
WARM_SPREAD = 0.08

STROKE_LIGHT = (29, 28, 26)     # --color-text, light theme
STROKE_DARK = (233, 231, 226)   # --color-text, dark theme
ACCENT_LIGHT = (196, 94, 59)    # --color-accent, light theme (#c45e3b)
ACCENT_DARK = (229, 138, 95)    # --color-accent, dark theme (#e58a5f)

# The paper's Figure 1 bleeds the left arrow to its bounding-box edge, so the
# crop starts flush against that arrow and it reads as truncated. Add a
# transparent margin (fraction of the cropped width) so the artwork breathes.
MARGIN_X, MARGIN_Y = 0.05, 0.03

HERE = Path(__file__).resolve().parent
IMAGES = HERE.parent / "static" / "images"
DEFAULT_PDF = Path.home() / "Projects/Swarm-COLM-2026/figures/main.pdf"


def render(pdf: Path, out: Path) -> None:
    subprocess.run(
        ["gs", "-dQUIET", "-dNOPAUSE", "-dBATCH", "-sDEVICE=pngalpha",
         f"-r{DPI}", f"-sOutputFile={out}", str(pdf)],
        check=True,
    )


def crop_figure(im: Image.Image) -> Image.Image:
    """Trim the whitespace around the full three-panel figure.

    Keeps all of Figure 1 &mdash; the two concept panels plus the solve-rate-vs-cost
    scatter on the right &mdash; cropping only the surrounding transparent margin.
    """
    lum = np.array(im.convert("RGB")).astype(int).mean(axis=2)
    dark = lum < 170
    rows, cols = np.where(dark.sum(axis=1) > 0)[0], np.where(dark.sum(axis=0) > 0)[0]
    pad = 14
    return im.crop((max(cols.min() - pad, 0), max(rows.min() - pad, 0),
                    min(cols.max() + pad + 1, lum.shape[1]), min(rows.max() + pad + 1, lum.shape[0])))


def pad_canvas(im: Image.Image) -> Image.Image:
    """Center the recolored (transparent) art on a larger transparent canvas."""
    mx, my = round(im.width * MARGIN_X), round(im.height * MARGIN_Y)
    canvas = Image.new("RGBA", (im.width + 2 * mx, im.height + 2 * my), (0, 0, 0, 0))
    canvas.paste(im, (mx, my), im)
    return canvas


def recolor(im: Image.Image, stroke: tuple[int, int, int],
            accent: tuple[int, int, int]) -> Image.Image:
    src = np.array(im.convert("RGB")).astype(float) / 255.0
    r, g, b = src[..., 0], src[..., 1], src[..., 2]
    val, low = src.max(axis=2), src.min(axis=2)
    sat = np.where(val > 0, (val - low) / np.maximum(val, 1e-6), 0)
    lum = 0.299 * r + 0.587 * g + 0.114 * b

    # Warm (orange/brown) pixels: the frontier arrow, the orange labels/title,
    # and the Ours star. R >= G >= B excludes the cool magenta/cyan arrows and
    # the navy dots/line art; the red-minus-blue spread excludes true neutrals.
    warm = (r >= g) & (g >= b) & ((r - b) > WARM_SPREAD)
    # Cool saturated arrows kept exactly as the paper draws them.
    keep = (sat > KEEP_SAT) & (val > KEEP_VAL) & ~warm
    ink = np.clip((INK_MAX_LUM - lum) / INK_RAMP, 0, 1)

    out = np.zeros(src.shape[:2] + (4,), dtype=float)
    out[..., :3] = np.array(stroke) / 255.0
    out[..., 3] = ink
    out[keep, :3] = src[keep]
    out[keep, 3] = 1.0
    # Repaint warm pixels in the accent; a mild brightness ramp keyed on the
    # original value keeps the dark-to-bright climb without a grey tail.
    fac = 0.62 + 0.38 * np.clip(val[warm], 0.0, 1.0)
    out[warm, :3] = (np.array(accent) / 255.0)[None, :] * fac[:, None]
    out[warm, 3] = 1.0
    return Image.fromarray((out * 255).round().astype("uint8"), "RGBA")


def main() -> None:
    pdf = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PDF
    if not pdf.exists():
        raise SystemExit(f"no such PDF: {pdf}")

    with tempfile.TemporaryDirectory() as tmp:
        raw = Path(tmp) / "main.png"
        render(pdf, raw)
        panels = crop_figure(Image.open(raw))

    IMAGES.mkdir(parents=True, exist_ok=True)
    for stroke, accent, name in ((STROKE_LIGHT, ACCENT_LIGHT, "main_concept.png"),
                                 (STROKE_DARK, ACCENT_DARK, "main_concept_dark.png")):
        art = pad_canvas(recolor(panels, stroke, accent))
        art.save(IMAGES / name)
        print(f"wrote {IMAGES / name}  ({art.size[0]}x{art.size[1]})")


if __name__ == "__main__":
    main()
