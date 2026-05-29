# SEO, Meta & HTML Validity — Deep Review

## Severity counts
HIGH 5 · MEDIUM 5 · LOW 4

---

### Author identity leaks in shipped HTML (double-blind)
**Severity:** HIGH (cross-flagged: claims, links-nav)
**Location:** `index.html:66` (Code button), `index.html:443` (footer `simple-agent-opt`), `figures/index.html:68,499`
**Evidence:** `github.com/xuefei-wang/swarms` and `xuefei-wang.github.io/simple-agent-opt/` on pages
declaring "Anonymous Authors / double-blind review".
**Recommendation:** Remove/anonymize for the review period.

### og:image relative URL — broken on all social scrapers
**Severity:** HIGH
**Location:** `index.html:11`, `figures/index.html:11`
**Evidence:** relative `static/images/main_full.png` / `main.png`; OG requires absolute URLs.
**Recommendation:** Absolute URL with the deploy domain.

### Missing `og:url` on pages carrying OG tags
**Severity:** HIGH
**Location:** `index.html`, `figures/index.html` heads
**Evidence:** grep `og:url` → no matches.
**Recommendation:** Add `og:url` per page.

### No Twitter Card tags anywhere
**Severity:** HIGH
**Evidence:** grep `twitter:` → none. Visual-heavy paper loses the large-image preview on X.
**Recommendation:** Add `twitter:card=summary_large_image` + title/description/image.

---

## MEDIUM
- Visible placeholder + `<!-- TODO -->` in shipped HTML: `index.html:432-433` ("Correspondence details to be added.").
- Editorial `<!-- COPY: ... removed -->` comments shipped: `index.html:59,175,425`.
- `index.html:7` meta description ~333 chars (Google truncates ~155-160); duplicated in `figures/index.html:7`.
- Missing `meta description` on 4 pages: `figures/dashboard/index.html`, `tb2-haiku-summary/`, `arc1-haiku-summary/`, `stage-anim/index.html`.
- No `<link rel="canonical">` on any page.

## LOW
- No JSON-LD `ScholarlyArticle` (defer until de-anonymized).
- Orphan `<!-- Footer -->` comment tombstone in dashboard pages (`tb2-haiku/index.html:132`, `arc1-haiku/:129`).
- og:image absolute-URL gap also affects `figures/index.html`.

## Verified-clean
All 9 pages have `<!DOCTYPE html>`, `<html lang="en">`, charset, viewport, unique `<title>`. No
duplicate ids within a page. Entities consistent. Favicon data-URI valid. `figures/figure/` footer
uses an anonymized org URL.

**Note:** `tidy`/`identify` not installed — image dimensions unverified; existence checked via Glob.

**Top:** double-blind identity leaks in shipped HTML.
