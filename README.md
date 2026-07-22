# recursive-knowledge.github.io

The Recursive Knowledge org site, deployed via GitHub Pages. Plain HTML/CSS/JS,
no build step.

## Layout

- `index.html` — the org landing page (`https://recursive-knowledge.github.io/`)
- `knowledge-centric-self-improvement/` — the Knowledge-Centric Self-Improvement
  paper site (blog plus interactive per-task dashboards), served at
  `https://recursive-knowledge.github.io/knowledge-centric-self-improvement/`.
  Everything project-specific — structure, dashboards and data, the image
  pipeline, content sources — is documented in
  [`knowledge-centric-self-improvement/README.md`](knowledge-centric-self-improvement/README.md).
- `.nojekyll` — serve directory-index URLs as-is (no Jekyll)

New projects get their own subfolder alongside
`knowledge-centric-self-improvement/`, with their own README.

## Preview locally

```bash
python3 -m http.server 8000   # run from the repo root
# open http://localhost:8000/                                    (org landing page)
# open http://localhost:8000/knowledge-centric-self-improvement/ (paper site)
```

## Deploy

This repo is itself the GitHub Pages site: merging to `main` deploys. The bare
Pages URL serves the org landing page; each project is served from its
subfolder.
