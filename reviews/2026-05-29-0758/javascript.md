# JavaScript Correctness — Deep Review

## Severity counts
BLOCKER 0 · HIGH 1 · MEDIUM 3 · LOW 1

---

### `copyBibtex` targets a non-existent `#bibtex` element and is unwired
**Severity:** HIGH (latent)
**Location:** `index.html:458-462`
**Evidence:** `navigator.clipboard.writeText(document.getElementById('bibtex').textContent)`. Grep
shows no `id="bibtex"` anywhere in `index.html` and no `copyBibtex(` call site — currently dead code.
**Failure mode:** When a BibTeX/citation section is added with a Copy button but the element id is
missing, `getElementById('bibtex')` returns null → `TypeError` → silent clipboard failure.
**Recommendation:** Add the `id="bibtex"` element with the citation, or null-guard the function.

---

### `dashboard-arc1.js` boot-error names the wrong file ("tb2_haiku.json")
**Severity:** MEDIUM
**Location:** `dashboard-arc1.js:719` (DATA_URL at :13 correctly points to arc1)
**Evidence:** `showError(\`Could not load tb2_haiku.json: ... Did you run scripts/build_tb2_dashboard.py yet?\`)`
— copy-paste residue from `dashboard.js`.
**Failure mode:** When the ARC dataset is missing, the banner sends a debugger to the wrong file/script.
**Recommendation:** Reference `arc1_haiku.json` / `build_arc_dashboard.py`.

### main-anim header counter snaps 41→0 during the 600ms Act-2 lead-in
**Severity:** MEDIUM
**Location:** `main-anim.js:567-581, 596-598`
**Evidence:** `cumulativeAt()` returns 0 during the `leadin` window; `render()` then writes
"Solved 0 / 89 · 0.0%" for ~600ms before the "↺ replaying" caption is legible.
**Failure mode:** Header stat visibly regresses to zero — reads as a bug.
**Recommendation:** Hold the Act-1 final count during leadin (return `TB2_GENS[9].cumulative`), or
surface the rewind caption at the very start of the leadin.

### `wireFilters` dereferences `#search-input` without a guard
**Severity:** MEDIUM (latent)
**Location:** `dashboard.js:573`, `dashboard-arc1.js:656`
**Evidence:** `$("#search-input").addEventListener(...)`. Element exists on full dashboards but not on
summary pages (those load a different script, so no throw today). Loading `dashboard.js` on a page
without the input → `TypeError` inside `safely()` → halts filter/tab/task-list init.
**Recommendation:** `const si = $("#search-input"); if (!si) return;`.

---

### `_firstSentence` shadows global `window` with a local string
**Severity:** LOW
**Location:** `dashboard.js:210`, `dashboard-arc1.js:218`, `dashboard-tb2-summary.js:51`
**Evidence:** `const window = cleaned.slice(...)` then `window.lastIndexOf(...)` (String method — works,
but confusing and a footgun if anyone adds `window.scrollY`-style code).
**Recommendation:** Rename to `prefix`.

---

## Verified-clean
- Theme localStorage bootstrap (`index.html:21-24`) handles null / '' / 'dark' correctly.
- Nav/header element derefs at end of body are safe (elements present).
- `bench-switch.js` early-exit guards (`!switches.length`, `!benchTabs.length || !frame`) present;
  default `"tb2"` matches a tab; disabled poly/arc2 tabs guarded.
- d3 (`d3@7`) is loaded before `d3-charts.js` on all 4 pages that use it; every render guards `haveD3()`.
- Plotly loaded before `figure.js`; `typeof Plotly === "undefined"` guard present.
- `ResizeObserver`/`IntersectionObserver` feature-detected with fallback.
- Async dashboard boot `await`s the JSON before render; no observable fetch race.
