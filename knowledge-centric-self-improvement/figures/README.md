# Figures subtree &mdash; Knowledge-Centric Self-Improvement

Figures hub, interactive figure, and dashboards. See the repo-root `README.md`
for the overall layout and local-preview instructions (serve from the repo root
with `python3 -m http.server 8000`, then open `/figures/`).

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
cd figures/static/images
for f in main framework arc2_example tb2_example; do
  gs -dQUIET -dNOPAUSE -dBATCH -sDEVICE=pngalpha -r200 \
     -sOutputFile="${f}.png" \
     "/path/to/paper/figures/${f}.pdf"
done
```

The CSS renders all figures on an opaque white card so transparent PNGs stay
legible in both light and dark themes.

## Content sources

- Hero, abstract, conclusion: `Swarm-COLM-2026/neurips_2026.tex`,
  `sections/sec-introduction.tex`, `sections/sec-conclusion.tex`
- Method (3-stage protocol): `sections/sec-method.tex`
- Tables (agent-centric, prompt-opt, backbone, KT): `sections/sec-experiments_v2.tex`
