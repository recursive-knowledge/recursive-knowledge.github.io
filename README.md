# Project Website &mdash; Knowledge-Centric Self-Improvement

Static landing page for the paper, modeled after
[xuefei-wang.github.io/simple-agent-opt](https://xuefei-wang.github.io/simple-agent-opt/)
and the personal site at [xuefei-wang.github.io](https://xuefei-wang.github.io/).

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

## Updating figures

PDF figures from the paper are converted with Ghostscript:

```bash
cd website/static/images
for f in framework main stylized_arc2_example stylized_tb2_example; do
  gs -dQUIET -dNOPAUSE -dBATCH -sDEVICE=pngalpha -r200 \
     -sOutputFile="${f}.png" \
     "../../Swarm-COLM-2026/figures/${f}.pdf"
done
```

PNG/JPG figures can be copied directly from `Swarm-COLM-2026/figures/`.

## Content sources

- Hero, abstract, conclusion: `Swarm-COLM-2026/neurips_2026.tex`,
  `sections/sec-introduction.tex`, `sections/sec-conclusion.tex`
- Method (3-stage protocol): `sections/sec-method.tex`
- Tables (agent-centric, prompt-opt, backbone, KT): `sections/sec-experiments_v2.tex`
