# Assets, Figures & Images — Deep Review

## Severity counts
BLOCKER 0 · HIGH 3 · MEDIUM 2 · LOW 3

All 10 HTML `<img>`/og:image references resolve to files on disk — **zero broken image links**.

---

### "ARC-AGI-2: a worked trace" heading over a figure showing 8-char-hex task IDs
**Severity:** HIGH → **NEEDS AUTHOR CONFIRMATION** (heuristic is weak)
**Location:** `index.html:385` (heading), `index.html:389` (alt text); image `static/images/stylized_arc2_example.png`
**Evidence:** Image header reads "Knowledge Curation Example - ARC" (no version); task IDs visible
`#63613498`, `#137ea00f`, `#253bf280`. The agent inferred these are ARC-AGI-1 from the 8-char hex
format.
**Orchestrator caveat (grounded-subagents):** BOTH ARC-AGI-1 and ARC-AGI-2 use 8-char hex task IDs,
so "hex format ⇒ ARC-AGI-1" is **not** a reliable discriminator. The paper figure source is
`stylized_arc2_example.pdf`. Treat as "verify the task IDs against the ARC-AGI-1 vs -2 task lists"
rather than a confirmed mislabel.
**Recommendation:** Author should confirm which benchmark these task IDs belong to and correct the
heading/alt only if they are in fact ARC-AGI-1.

### Site `main_full.png` differs from paper `main_full.png` (axes, palette, points)
**Severity:** HIGH
**Location:** `index.html:11,77`; paper `figures/main_full.png`
**Evidence (visual):** Site right panel: y "Solve rate (%)", x "Efficiency 1/cost (10⁻³ $⁻¹)",
orange-arrow annotation. Paper: y "Performance (%)", x "Efficiency 1/cost" (0.004–0.012), teal markers.
No `main_full.pdf` in the paper dir; README Ghostscript loop omits `main_full` — so the site hero has
no documented regeneration path.
**Recommendation:** Create `main_full.pdf` + add to the conversion loop, or document the site hero as a
standalone redesign.

### og:image relative URLs break social previews
**Severity:** HIGH (cross-flagged: seo-meta, links-nav)
**Location:** `index.html:11`, `figures/index.html:11`
**Evidence:** `content="static/images/main_full.png"` / `main.png` — relative; OG needs absolute URL.
**Recommendation:** Absolute URLs once the domain is fixed.

---

### Seven orphan images in `static/images/`
**Severity:** MEDIUM
**Location:** `static/images/`
**Evidence:** No HTML references: `ablation.png`, `arc_knowledge.jpg`, `framework.png`,
`knowledge_schema.png`, `kt_swarms.png`, `main.png`, `tb2_knowledge.jpg`. Confirmed duplicates:
`static/images/main.png` ≡ `static/images/main_full.png`; `static/images/framework.png` ≡
`figures/static/images/framework.png`.
**Recommendation:** Delete/archive; at minimum remove the byte-duplicates.

### README Ghostscript loop is stale
**Severity:** MEDIUM (cross-flagged: copy-consistency)
**Location:** `README.md:36-41`
**Evidence:** Loop converts `framework main stylized_arc2_example stylized_tb2_example` — `framework`
and `main` become orphans; the actual hero `main_full` is missing from the loop.
**Recommendation:** Update loop to the assets actually used.

---

### LOW
- Favicon stroke color differs: `index.html:18` teal `#0c7a91` vs figures pages amber `#DA7800` — confirm intentional sub-site branding.
- `figures/figure/index.html:179` uses a different physical copy of `framework.png` than `figures/index.html` (same image, divergent update path).
- Root `README.md` doesn't document the two figure subtrees (detailed appendix exemplars vs stylized) — noted only in `figures/README.md`.
