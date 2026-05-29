# Links, Navigation & Routing — Deep Review

## Severity counts
BLOCKER 1 · HIGH 2 · MEDIUM 1 · LOW 1

---

### Orphaned pages: `figures/figure/` and `stage-anim/` have zero inbound links
**Severity:** BLOCKER
**Location:** `figures/figure/index.html`, `stage-anim/index.html`
**Evidence:** `grep "figures/figure|stage-anim"` across all HTML → no matches. Both are complete,
deployable pages with working internal links and valid assets, but nothing in the site links to them.
**Failure mode:** Users cannot discover the scroll-driven interactive figure or the standalone
stage animation by browsing; reachable only by direct URL.
**Recommendation:** Add a link from `index.html`/`figures/index.html` if intended to publish, else
remove from the deploy.

---

### arXiv button is `href="#"` with `aria-disabled` — dead click, not inert
**Severity:** HIGH
**Location:** `index.html:63-65`; `figures/index.html:65-67`; `figures/figure/index.html:39-41`
**Evidence:** `<a class="btn btn--primary" href="#" target="_blank" aria-disabled="true">`. `aria-disabled`
does not disable an `<a>`; clicking/Enter scrolls to top and `target="_blank"` opens a blank tab.
**Failure mode:** Confusing dead control; keyboard users get a page jump.
**Recommendation:** Use `<button disabled>` styled as `.btn--primary`, or `e.preventDefault()` + `tabindex="-1"`.

### Author identity leak in "Code" links (double-blind) — also a routing concern
**Severity:** HIGH (cross-flagged: claims, seo-meta)
**Location:** `index.html:66`, `figures/index.html:68`, `figures/index.html:499`
**Evidence:** All point to `https://github.com/xuefei-wang/swarms`. Note `figures/figure/index.html:445`
points to a *different* org `github.com/knowledge-centric-self-improvement/...` (anonymized) — links
are inconsistent across pages, and one set leaks identity.
**Recommendation:** Make all code links consistent and anonymized for the review period.

---

### "Contact" button scrolls to a TODO stub
**Severity:** MEDIUM
**Location:** `index.html:70-73` (button) → `index.html:428-436` (section)
**Evidence:** Section body is the placeholder "Correspondence details to be added." with `<!-- TODO -->`.
**Recommendation:** Fill in contact details or hide the Contact button + section until ready.

---

### og:image relative URL — social previews won't resolve
**Severity:** LOW (cross-flagged: seo-meta, assets)
**Location:** `index.html:11`, `figures/index.html:11`
**Evidence:** `content="static/images/main_full.png"` (relative). OG scrapers require absolute URLs.
**Recommendation:** Use `https://recursive-knowledge.github.io/static/images/main_full.png`.

---

## Verified-clean
- All `index.html` in-page anchors resolve (`#abstract #method #results #examples #correspondence`,
  `#res-reasoning #res-tb2 #res-crossbackbone #res-promptopt`, `#generations`).
- `bench-switch.js` `data-summary-src`/`data-full-src` (tb2-haiku-summary, arc1-haiku-summary,
  tb2-haiku, arc1-haiku) all map to real dirs with `index.html`.
- Dashboard `fetch()` paths (`../../static/data/*.json`) resolve from their loading pages.
- `.nojekyll` present → directory-index serving works.
- `figures/figure/` scene anchors `#scene-1..7` all present.
**Unverified (no external fetch):** existence of the external GitHub/CDN URLs.
