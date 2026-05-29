# Project Website &mdash; Knowledge-Centric Self-Improvement

Static landing page for the paper.

## Layout

```
website/
  index.html
  static/
    css/style.css
    images/         # figures sourced from ../../Swarm-COLM-2026/figures/
```

## Preview locally

```bash
cd website
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy

Push the `website/` contents to a `gh-pages` branch or copy them into a
GitHub Pages repo such as `xuefei-wang.github.io/knowledge-centric-si/`.

## Figures

The site uses exactly the figures the paper includes via `\includegraphics`:

| Site asset                | Paper source                       | Used in                |
|---------------------------|------------------------------------|------------------------|
| `main.png`                | `figures/main.pdf`                 | `sec-introduction.tex` |
| `framework.png`           | `figures/framework.pdf`            | `sec-method.tex`       |
| `arc2_example.png`        | `figures/arc2_example.pdf`         | `sec-appendix.tex`     |
| `tb2_example.png`         | `figures/tb2_example.pdf`          | `sec-appendix.tex`     |

Only figures that the live paper actually `\includegraphics` are mirrored.
The knowledge-transfer section uses an inline HTML/CSS heatmap (mirroring
`tab:kt_heatmap` in `sec-experiments_v2.tex`), not a paper figure. The "what
does the curated knowledge actually look like?" section uses the full
appendix exemplars (`arc2_example`, `tb2_example`) rather than the stylized
versions that appear inside the method-section figure.

Re-render the PDFs to transparent PNG via Ghostscript:

```bash
cd website/static/images
for f in main framework arc2_example tb2_example; do
  gs -dQUIET -dNOPAUSE -dBATCH -sDEVICE=pngalpha -r200 \
     -sOutputFile="${f}.png" \
     "../../../Swarm-COLM-2026/figures/${f}.pdf"
done
```

The CSS renders all figures on an opaque white card so transparent PNGs stay
legible in both light and dark themes.

## Content sources

- Hero, abstract, conclusion: `Swarm-COLM-2026/neurips_2026.tex`,
  `sections/sec-introduction.tex`, `sections/sec-conclusion.tex`
- Method (3-stage protocol): `sections/sec-method.tex`
- Tables (agent-centric, prompt-opt, backbone, KT): `sections/sec-experiments_v2.tex`
