# CSS, Responsive & Dark Mode — Deep Review

## Severity counts
BLOCKER 1 · HIGH 4 · MEDIUM 4 · LOW 4

---

### `.kt-cell { color:#1a1a1c }` is hardcoded — breaks in dark mode
**Severity:** BLOCKER
**Location:** `static/css/style.css:605`, `figures/static/css/style.css:508`; cells `index.html:355-365`
**Evidence:** `.kt-cell { color:#1a1a1c }` is a literal hex, not a token, with no `[data-theme="dark"]`
override. KT cells without an inline `color:#fff` (the light-background cells) force near-black text;
in dark mode this is jarring/inconsistent against the dark page, and any non-light cell color would be
dark-on-dark unreadable.
**Recommendation:** `.kt-cell { color: var(--color-text); }` in both files; keep inline `color:#fff` on high-heat cells.

### `--color-warm-low/high` have no dark-mode override; D3 ingests them at runtime
**Severity:** HIGH
**Location:** `static/css/style.css:15-16`, `figures/static/css/style.css:15-16`; consumed `d3-charts.js:47,121`
**Evidence:** `--color-warm-low:#fff8e6` (near-white) stays light in dark mode; heatmaps render light
tones on the dark page. No `[data-theme="dark"]` counterpart exists.
**Recommendation:** Add dark-mode warm tokens (e.g. low `#3a2a10`, high `#ff6b5b`).

### `figures/` nav background hardcoded pure white vs root warm off-white
**Severity:** HIGH
**Location:** `figures/static/css/style.css:86` (`rgba(255,255,255,0.86)`) vs `static/css/style.css:96` (`rgba(250,248,245,0.85)`); mobile dropdown `:723` similarly
**Evidence:** Nav bar color jumps perceptibly when navigating root → dashboards.
**Recommendation:** Align figures/ backdrop colors to root warm off-white.

### `figure.css` infinite scroll-cue animation has no reduced-motion guard
**Severity:** HIGH
**Location:** `figures/static/css/figure.css:80-85` (`hover-bob ... infinite`)
**Evidence:** Zero `@media (prefers-reduced-motion)` blocks in `figure.css` (grep). Indefinite bobbing
cannot be suppressed by OS motion settings.
**Recommendation:** Add `@media (prefers-reduced-motion:reduce){ .figure-hero-scroll-cue{animation:none} }`.

### Wide tables: `min-width:520px` sized for ~4 cols but tables have 9
**Severity:** HIGH
**Location:** `static/css/style.css:462-468`; tables `index.html:189-229, 257-293`
**Evidence:** 9-column abstract-reasoning + cross-backbone tables share `.results-table{min-width:520px}`;
wrapped in `.table-wrap{overflow-x:auto}` so they scroll, but cells are cramped/clipped at ~360px.
**Recommendation:** Add `.results-table--wide{min-width:680px}` for the multi-column tables.

---

## MEDIUM
- `--section-spacing` diverges root 7.5rem vs figures/ 6rem (`*/style.css:25`).
- `h2` styling diverges: root has teal `::after` underline + larger size; figures/ omits it (`*/style.css` h2 rules).
- `.results-subhead` lacks `scroll-margin-top` in `figures/static/css/style.css:437` (present in root).
- `.kt-table` has no scroll wrapper; could overflow at ≤360px (`static/css/style.css:563-571`).

## LOW
- `--color-warm-*` tokens defined but used only via JS (undocumented conduit).
- Dead empty rule `.main-anim.reduced-motion .main-anim-svg {}` in both `main-anim.css:340`.
- 0.5rem mismatch: `html{scroll-padding-top:...+2rem}` vs `.results-subhead{scroll-margin-top:...+1.5rem}`.
- Fonts (Source Serif 4 + Inter, `display=swap`, fallbacks) consistent across pages — clean.

**Top:** `.kt-cell` hardcoded color — one-line fix in each of the two style.css files.
**Note:** "static analysis only" for pixel-level overflow/clipping — would need a browser to confirm exact behavior.
