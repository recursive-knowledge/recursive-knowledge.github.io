#!/usr/bin/env python3
"""Build the hero concept figure from the paper's Figure 1.

The paper renders Figure 1 as three panels: agent-centric, knowledge-centric,
and a solve-rate-vs-cost scatter. The hero uses all three, so the headline
figure carries the result (Ours on the frontier) alongside the concept.

A straight Ghostscript export is not enough on its own. The figure is light
artwork (white background, grey title pills, navy line art) and the site
defaults to dark, so embedding it as-is puts a bright slab on a dark page.
Instead we drop the background entirely and recolor the line art per theme,
keeping the gradient arrows and the orange title exactly as the paper draws
them. That works because the palette is flat and well separated: the strokes
sit near luminance 0.25 while the arrows are saturated and bright.

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
# A pixel this saturated and this bright belongs to a gradient arrow or the
# orange title, and is passed through untouched.
KEEP_SAT, KEEP_VAL = 0.35, 0.60

STROKE_LIGHT = (29, 28, 26)     # --color-text, light theme
STROKE_DARK = (233, 231, 226)   # --color-text, dark theme

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


def recolor(im: Image.Image, stroke: tuple[int, int, int]) -> Image.Image:
    src = np.array(im.convert("RGB")).astype(float) / 255.0
    r, g, b = src[..., 0], src[..., 1], src[..., 2]
    val, low = src.max(axis=2), src.min(axis=2)
    sat = np.where(val > 0, (val - low) / np.maximum(val, 1e-6), 0)
    lum = 0.299 * r + 0.587 * g + 0.114 * b

    keep = (sat > KEEP_SAT) & (val > KEEP_VAL)
    ink = np.clip((INK_MAX_LUM - lum) / INK_RAMP, 0, 1)

    out = np.zeros(src.shape[:2] + (4,), dtype=float)
    out[..., :3] = np.array(stroke) / 255.0
    out[..., 3] = ink
    out[keep, :3] = src[keep]
    out[keep, 3] = 1.0
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
    for stroke, name in ((STROKE_LIGHT, "main_concept.png"),
                         (STROKE_DARK, "main_concept_dark.png")):
        art = pad_canvas(recolor(panels, stroke))
        art.save(IMAGES / name)
        print(f"wrote {IMAGES / name}  ({art.size[0]}x{art.size[1]})")


if __name__ == "__main__":
    main()
