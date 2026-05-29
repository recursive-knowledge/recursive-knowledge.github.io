# Project Website &mdash; Knowledge-Centric Self-Improvement

Static landing page and interactive figures/dashboards for the paper. Plain
HTML/CSS/JS, no build step. Deployed via GitHub Pages.

## Layout

```
.
  index.html                     # main landing page
  stage-anim/index.html          # standalone 3-stage curation animation (embed source)
  figures/
    index.html                   # figures hub (fuller paper page)
    figure/index.html            # scroll-driven interactive figure (Plotly)
    dashboard/
      index.html                 # dashboard hub
      tb2-haiku/        arc1-haiku/          # full per-task dashboards
      tb2-haiku-summary/ arc1-haiku-summary/ # curated per-generation summaries
    static/{css,js,data,images}  # figures-subtree assets + per-task JSON
    scripts/                     # build_tb2_dashboard.py, build_arc_dashboard.py
  static/{css,js,images}         # root-page assets
```

The root page (`index.html`) and the figures subtree each load their own copy
of `static/css/style.css` + `static/css/main-anim.css`; keep theme tokens in
the two `style.css` files in sync.

## Preview locally

```bash
python3 -m http.server 8000   # run from the repo root
# open http://localhost:8000
```

## Deploy

This repo is itself the GitHub Pages site (served at the repository's Pages
URL). `.nojekyll` is present so directory-index URLs (`figures/dashboard/`)
resolve to their `index.html`.

## Updating figures

The hero (`static/images/main_full.png`) and the two worked-trace exemplars
(`static/images/stylized_arc2_example.png`, `stylized_tb2_example.png`) are the
images actually rendered on `index.html`. Convert the paper PDFs with
Ghostscript (paths are relative to wherever the paper sources live):

```bash
cd static/images
for f in main_full stylized_arc2_example stylized_tb2_example; do
  gs -dQUIET -dNOPAUSE -dBATCH -sDEVICE=pngalpha -r200 \
     -sOutputFile="${f}.png" \
     "/path/to/paper/figures/${f}.pdf"
done
```

The figures hub (`figures/index.html`, `figures/figure/index.html`) uses the
full appendix exemplars under `figures/static/images/` (`arc2_example.png`,
`tb2_example.png`, `framework.png`, `main.png`) rather than the stylized
versions. PNG/JPG figures can be copied directly from the paper's `figures/`.

## Dashboards & data

The dashboards read per-run JSON from `figures/static/data/` (`tb2_haiku.json`,
`arc1_haiku.json`, `knowledge.json`, `arc1_knowledge.json`) plus per-task
transcripts/traces under `figures/static/data/{transcripts,arc1_transcripts,tool_traces}/`.
Regenerate the JSON (and its transcript side-files) with the builders in
`figures/scripts/`.

## Content sources

Page copy and tables are sourced from the paper LaTeX (the compiled paper uses
`sections/sec-experiments_v2.tex`, **not** the older `sections/sec-results.tex`):

- Hero, abstract, conclusion: paper main `.tex`, `sections/sec-introduction.tex`,
  `sections/sec-conclusion.tex`
- Method (3-stage protocol): `sections/sec-method.tex`
- Tables (agent-centric, prompt-opt, backbone, KT): `sections/sec-experiments_v2.tex`
