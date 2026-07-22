# Knowledge-Centric Self-Improvement — paper site

The paper's landing page/blog plus interactive per-task dashboards, served by
GitHub Pages from this subfolder at
`https://recursive-knowledge.github.io/knowledge-centric-self-improvement/`.
Plain HTML/CSS/JS, no build step. The page links out to the KSI docs and code.

## Structure

```
.
  index.html                     # paper landing page / blog
  tb2-haiku/index.html           # Terminal-Bench 2 per-task dashboard (Haiku 4.5)
  arc1-haiku/index.html          # ARC-AGI-1 per-task dashboard (Haiku 4.5)
  static/
    css/                         # style.css, main-anim.css, dashboard.css (shared by every page)
    js/                          # landing: generation-explorer.js, stages-anim.js
                                 # dashboards: d3-charts.js, dashboard.js, dashboard-arc1.js
    data/                        # *_haiku.json, *_knowledge.json + per-task transcripts/
    images/                      # landing images
  scripts/                       # build_{tb2,arc}_dashboard.py, declamp_insights.py,
                                 # make_concept_figure.py
```

All pages share one stylesheet bundle under `static/css/` (`style.css`,
`main-anim.css`, `dashboard.css`); theme tokens live once in the `:root` of
`style.css`, so an accent change applies site-wide. The CSS links carry a `?v=`
cache-bust query — bump it when shipping visual changes so returning visitors
get the new styles, and keep the `style.css` bust in sync across all three
pages (blog + both dashboards).

## Dashboards & data

The dashboards (`tb2-haiku/`, `arc1-haiku/`) read per-run JSON from
`static/data/` (`tb2_haiku.json`, `arc1_haiku.json`, `knowledge.json`,
`arc1_knowledge.json`) plus per-task transcripts under
`static/data/{transcripts,arc1_transcripts}/`. `knowledge.json` is large and is
lazy-loaded (IntersectionObserver) only when the evolving-knowledge section
nears the viewport. The landing page also reads `static/data/tb2_haiku.json`
for its generation explorer. Regenerate the JSON (and its transcript
side-files) with the builders in `scripts/`.

## Images

The hero concept figure is the paper's Figure 1, built by
`scripts/make_concept_figure.py`:

```bash
python3 scripts/make_concept_figure.py [path/to/paper/figures/main.pdf]
```

It keeps all three panels of Figure 1 (the two concept panels plus the
solve-rate-vs-cost scatter, so the hero carries the headline result), then
writes two theme variants: `static/images/main_concept.png` for light and
`main_concept_dark.png` for dark. Both have a transparent background with the
line art recolored to the theme's text token, so the figure sits on the page
instead of inside a light card — embedding the paper's artwork as-is puts a
bright slab on the dark default theme. `.concept-art` in `style.css` swaps them
on `[data-theme]`, so only the active variant is fetched.

`static/images/main_full.png` is the social-card image (`og:image` /
`twitter:image`). Other paper PNGs can be exported straight with Ghostscript:

```bash
cd static/images
gs -dQUIET -dNOPAUSE -dBATCH -sDEVICE=pngalpha -r200 \
   -sOutputFile=NAME.png "/path/to/paper/figures/NAME.pdf"
```

## Content sources

Page copy and tables are sourced from the paper LaTeX (the compiled paper uses
`sections/sec-experiments_v2.tex`, **not** the older `sections/sec-results.tex`):

- Hero, abstract, conclusion: paper main `.tex`, `sections/sec-introduction.tex`,
  `sections/sec-conclusion.tex`
- Method (3-stage protocol): `sections/sec-method.tex`
- Tables (agent-centric, prompt-opt, backbone, KT): `sections/sec-experiments_v2.tex`
