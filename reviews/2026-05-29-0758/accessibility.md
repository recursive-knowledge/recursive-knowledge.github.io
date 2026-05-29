# Accessibility (WCAG 2.1 AA) — Deep Review

## Severity counts
HIGH 6 · MEDIUM 4 · LOW 2

Contrast formula: sRGB linearize → L = 0.2126R+0.7152G+0.0722B → ratio = (L_light+0.05)/(L_dark+0.05).

---

### [H4] `--color-text-secondary` (#71717a) on bg (#faf8f5) = 4.18:1 — body copy fails 4.5:1
**Severity:** HIGH (widest blast radius)
**Location:** `static/css/style.css:7`; used for `.abstract-text`, `.table-caption`, `.results-intro`, `.institutions`, figcaptions, `.stage-card p`, `.example-card p`
**Evidence:** computed 4.18:1 < 4.5:1. This is the color of essentially all secondary body text site-wide.
**Recommendation:** Darken to ≥ `#636369` (~5.5:1); re-verify dark-mode pair separately. WCAG 1.4.3.

### [H3] White text on orange/red KT cells fails contrast
**Severity:** HIGH
**Location:** `index.html:335,340,341`; `figures/index.html:396-402`
**Evidence:** `#dc5a44`+white = 3.55:1; `#ea7252`+white = 2.85:1; `#ed8e60`+white = 2.31:1 — all < 4.5:1 (normal-weight ~0.88rem).
**Recommendation:** Dark text on these cells, or darken backgrounds (e.g. `#b34030` ≈ 7:1 with white).

### [H1] Stage tabs / bench tabs: no arrow-key navigation (WAI-ARIA Tabs)
**Severity:** HIGH
**Location:** `index.html:118-122, 407-411`; `stage-anim/index.html:33-37`; `stages-anim.js:707-709`, `bench-switch.js:68`
**Evidence:** Only click + Enter/Space wired; no ArrowLeft/Right, no roving tabindex.
**Recommendation:** Implement arrow-key nav + roving tabindex. WCAG 2.1.1.

### [H2] Dashboard task tabs never update `aria-selected`; panels lack `aria-labelledby`
**Severity:** HIGH
**Location:** `dashboard.js:550-554`; `figures/dashboard/tb2-haiku/index.html:116-124`, `arc1-haiku/index.html:114-123`
**Evidence:** `setActiveTab` toggles only `.active` class, never `aria-selected`; panels have no labelledby.
**Recommendation:** Set `aria-selected` in JS; add tab ids + panel `aria-labelledby`; add arrow keys. WCAG 4.1.2.

### [H5] `nav-toggle` never sets `aria-expanded`
**Severity:** HIGH
**Location:** `index.html:47` (+ figures pages); handler `index.html:472-475`
**Evidence:** No `aria-expanded` in HTML or JS.
**Recommendation:** Add `aria-expanded`, toggle it in the click handler. WCAG 4.1.2.

### [H6] Multi-level results tables missing `scope` on `<th>`
**Severity:** HIGH
**Location:** `index.html:189-228, 259-290` (dup in `figures/index.html`)
**Evidence:** Two-row headers with rowspan/colspan and no `scope="colgroup/col/row"`.
**Recommendation:** Add scope attributes (technique H63). WCAG 1.3.1.

---

## MEDIUM
- [M1] Heading skip h2→h4 in KT section (`index.html:319,325,347`) — change `<h4>` to `<h3>`. WCAG 1.3.1.
- [M2] arXiv `<a href="#" aria-disabled>` is focusable + activatable — state mismatch. WCAG 4.1.2.
- [M3] Dashboard search `outline:none` with only a 1px border-color focus (`dashboard.css:198-201`) — restore visible outline. WCAG 2.4.7.
- [M4] Stage/bench tabs have no `role="tabpanel"` counterpart with `aria-labelledby` (`index.html:116-149, 405-421`). WCAG 4.1.2.

## LOW
- [L1] `.main-anim.is-paused::after` status is CSS content only (acceptable; play button aria-label already toggles).
- [L2] `<figcaption>` outside `<figure>` in the bench-switch widget (`index.html:418-420`). WCAG 1.3.1.

## Strengths (genuine)
Skip link on all pages; `lang="en"` everywhere; labeled theme/play/pause/restart buttons; rich
`sr-only` animation description; `prefers-reduced-motion` handled in CSS **and** JS (stages-anim.js:718-724);
`aria-live="polite"` caption; the `figures/index.html` Walkthrough/Generations tabs are a correct,
fully-wired ARIA tabs implementation (with arrow keys) — use it as the template for the others.

**Top:** [H4] one-variable fix (`style.css:7`) repairs contrast on nearly all body copy site-wide.
**Caveat:** dynamic focus order after tab switches not confirmable statically.
