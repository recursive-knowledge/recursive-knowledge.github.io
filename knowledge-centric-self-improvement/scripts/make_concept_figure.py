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
    Content is dark ink OR saturated colour: the magenta/cyan arrows are brighter
    than the ink threshold, and a darkness-only mask puts the left crop edge
    inside the agent-centric arrow's barb, amputating it.
    """
    arr = np.array(im.convert("RGBA")).astype(float)
    rgb = arr[..., :3]
    lum = rgb.mean(axis=2)
    sat = (rgb.max(axis=2) - rgb.min(axis=2)) / np.maximum(rgb.max(axis=2), 1)
    content = (arr[..., 3] > 60) & ((lum < 170) | (sat > 0.30))
    rows = np.where(content.sum(axis=1) > 0)[0]
    cols = np.where(content.sum(axis=0) > 0)[0]
    pad = 14
    return im.crop((max(cols.min() - pad, 0), max(rows.min() - pad, 0),
                    min(cols.max() + pad + 1, lum.shape[1]), min(rows.max() + pad + 1, lum.shape[0])))


def pad_canvas(im: Image.Image) -> Image.Image:
    """Center the recolored (transparent) art on a larger transparent canvas."""
    mx, my = round(im.width * MARGIN_X), round(im.height * MARGIN_Y)
    canvas = Image.new("RGBA", (im.width + 2 * mx, im.height + 2 * my), (0, 0, 0, 0))
    canvas.paste(im, (mx, my), im)
    return canvas


def heal_left_barb(im: Image.Image) -> Image.Image:
    """Round off the left arrowhead barb, which Figma clipped flat on export.

    The agent-centric arrow's left barb runs off the artboard's left edge, so
    the exported PDF cuts it to a flat vertical stub (there is no editable
    source to re-export). Detect that stub &mdash; a tall run of the cool arrow
    colour at the leftmost edge of the arrow region &mdash; and cap it with a
    half-disc in the barb's own colour, matching the arrow's round stroke ends.
    Runs on the padded canvas so the cap has transparent room to grow into. If
    the barb is not clipped (a short, pointed run), it is a no-op, so a future
    un-clipped export needs no code change.
    """
    arr = np.array(im).astype(float)
    h, w, _ = arr.shape
    al, g, b = arr[..., 3], arr[..., 1], arr[..., 2]
    mx, mn = arr[..., :3].max(2), arr[..., :3].min(2)
    sat = (mx - mn) / np.maximum(mx, 1)
    cool = (al > 60) & (b > g + 12) & (sat > 0.30)

    # Only the arrow region (lower-left); never the cool title text up top.
    region = np.zeros_like(cool)
    region[int(0.35 * h):int(0.85 * h), :int(0.30 * w)] = True
    m = cool & region
    cols = np.where(m.sum(axis=0) > 0)[0]
    if len(cols) == 0:
        return im
    c0 = int(cols.min())
    run = np.where(m[:, c0])[0]
    if len(run) < 12:              # a natural pointed cap — nothing to heal
        return im
    r0, r1 = int(run.min()), int(run.max())
    mid, rad = (r0 + r1) / 2.0, (r1 - r0) / 2.0 + 1.0

    seg, segc = arr[r0:r1 + 1, c0:c0 + 6, :], m[r0:r1 + 1, c0:c0 + 6]
    if not segc.any():
        return im
    colour = seg[segc].mean(axis=0)

    yy, xx = np.mgrid[0:h, 0:w]
    dist = np.sqrt((xx - c0) ** 2 + (yy - mid) ** 2)
    cap = (xx <= c0) & (dist <= rad)
    edge = np.clip(rad - dist, 0, 1)               # 1px antialiased rim
    for ch in range(3):
        arr[..., ch] = np.where(cap, colour[ch], arr[..., ch])
    arr[..., 3] = np.where(cap, np.maximum(arr[..., 3], 255 * edge), arr[..., 3])
    return Image.fromarray(arr.clip(0, 255).astype("uint8"), "RGBA")


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
        art = heal_left_barb(pad_canvas(recolor(panels, stroke, accent)))
        art.save(IMAGES / name)
        print(f"wrote {IMAGES / name}  ({art.size[0]}x{art.size[1]})")


if __name__ == "__main__":
    main()
