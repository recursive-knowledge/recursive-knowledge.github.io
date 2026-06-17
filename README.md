# Project Website &mdash; Knowledge-Centric Self-Improvement

Static landing page and interactive per-task dashboards for the paper. Plain
HTML/CSS/JS, no build step. Deployed via GitHub Pages.

## Layout

The site is served from the `knowledge-centric-self-improvement/` subfolder
(at `https://recursive-knowledge.github.io/knowledge-centric-self-improvement/`).
The repo-root `index.html` is a tiny redirect to it.

```
.
  index.html                       # redirect: bare domain -> /knowledge-centric-self-improvement/
  .nojekyll                        # serve directory-index URLs as-is (no Jekyll)
  knowledge-centric-self-improvement/
    index.html                     # landing page
    tb2-haiku/index.html           # Terminal-Bench 2 per-task dashboard (Haiku 4.5)
    arc1-haiku/index.html          # ARC-AGI-1 per-task dashboard (Haiku 4.5)
    static/
      css/                         # style.css, main-anim.css, dashboard.css (shared by every page)
      js/                          # landing: generation-explorer.js, stages-anim.js
                                   # dashboards: d3-charts.js, dashboard.js, dashboard-arc1.js
      data/                        # *_haiku.json, *_knowledge.json + per-task transcripts/
      images/                      # landing images
    scripts/                       # build_{tb2,arc}_dashboard.py, declamp_insights.py
```

All pages share one stylesheet bundle under
`knowledge-centric-self-improvement/static/css/` (`style.css`, `main-anim.css`,
`dashboard.css`); theme tokens live once in the `:root` of `style.css`, so an
accent change applies site-wide. The CSS links carry a `?v=` cache-bust query —
bump it when shipping visual changes so returning visitors get the new styles.

## Preview locally

```bash
python3 -m http.server 8000   # run from the repo root
# open http://localhost:8000/   (redirects to the page below)
# or open http://localhost:8000/knowledge-centric-self-improvement/ directly
```

## Deploy

This repo is itself the GitHub Pages site, served at
`/knowledge-centric-self-improvement/`; the bare Pages URL redirects there via
the repo-root `index.html`. `.nojekyll` is present so directory-index URLs
(`knowledge-centric-self-improvement/tb2-haiku/`) resolve to their `index.html`.

## Dashboards & data

The dashboards (`tb2-haiku/`, `arc1-haiku/`) read per-run JSON from
`knowledge-centric-self-improvement/static/data/` (`tb2_haiku.json`,
`arc1_haiku.json`, `knowledge.json`, `arc1_knowledge.json`) plus per-task
transcripts under `.../static/data/{transcripts,arc1_transcripts}/`.
`knowledge.json` is large and is lazy-loaded (IntersectionObserver) only when
the evolving-knowledge section nears the viewport. The landing page also reads
`static/data/{tb2,arc1}_haiku.json` for its generation explorer. Regenerate the
JSON (and its transcript side-files) with the builders in
`knowledge-centric-self-improvement/scripts/`.

## Images

The landing page renders `static/images/main_concept.png` and
`static/images/main_scatter.png`; `static/images/main_full.png` is the
social-card image (`og:image` / `twitter:image`). Regenerate any PNG from the
paper PDFs with Ghostscript (transparent background; the CSS backs figures with
a white card so they stay legible in both themes):

```bash
cd knowledge-centric-self-improvement/static/images
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
