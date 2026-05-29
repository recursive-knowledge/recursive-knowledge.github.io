# Deep Review: recursive-knowledge.github.io @ main @ 2026-05-29-0758

10-agent parallel review of the project website, cross-checked against the paper at
`~/Projects/Swarm-COLM-2026/`. **Headline counts: 5 blockers · 13 highs · ~19 mediums · ~20 lows.** *(2 data-integrity HIGHs retracted as false on verification — see notes.)*

Two cross-agent findings were verified at the source by the orchestrator (per `grounded-subagents`)
because they were load-bearing and the agents disagreed — see "Verification notes" at the end.

## Review team
| # | Dimension | Findings (B/H/M/L) | Report |
|---|-----------|--------------------|--------|
| 1 | paper-fidelity-numbers | 1 / 0 / 2 / 1 | [paper-fidelity-numbers.md](paper-fidelity-numbers.md) |
| 2 | paper-fidelity-claims  | 1 / 2 / 3 / 0 | [paper-fidelity-claims.md](paper-fidelity-claims.md) |
| 3 | data-integrity         | 0 / 0 / 2 / 2 | [data-integrity.md](data-integrity.md) — 2 HIGHs retracted (false) |
| 4 | links-nav-routing      | 1 / 2 / 1 / 1 | [links-nav-routing.md](links-nav-routing.md) |
| 5 | assets-figures         | 0 / 3 / 2 / 3 | [assets-figures.md](assets-figures.md) |
| 6 | javascript             | 0 / 1 / 3 / 1 | [javascript.md](javascript.md) |
| 7 | css-responsive-darkmode| 1 / 4 / 4 / 4 | [css-responsive-darkmode.md](css-responsive-darkmode.md) |
| 8 | accessibility          | 0 / 6 / 4 / 2 | [accessibility.md](accessibility.md) |
| 9 | seo-meta-html          | 0 / 5 / 5 / 4 | [seo-meta-html.md](seo-meta-html.md) |
| 10| copy-consistency       | 0 / 2 / 4 / 6 | [copy-consistency.md](copy-consistency.md) |

---

## Blockers

### B1. Double-blind identity leak in shipped HTML — flagged independently by 3 agents
*(claims, seo-meta, links-nav — strongest corroboration in this review)*
The page declares "Anonymous Authors / under double-blind review" yet links to the author's identity:
- `index.html:66` & `figures/index.html:68,499` → `https://github.com/xuefei-wang/swarms`
- `index.html:443` → `https://xuefei-wang.github.io/simple-agent-opt/` (personal site — strongest leak)

Verified present by the orchestrator. Any reviewer who clicks/hovers is deanonymized.
**Fix:** anonymize/remove all `xuefei-wang` URLs for the review period. An anonymized org
(`knowledge-centric-self-improvement`) is already used at `figures/figure/index.html:445` — make all
links match that.

### B2. Terminal-Bench 2 headline number disagrees: website 47.2% vs compiled paper 44.9%
*(numbers, claims, data)* — **and a third stale value (41.5%) sits in the repo.**
- Website (5 places incl. hero `index.html:102,142,247`) = **47.2%**, internally consistent with its
  own data (`tb2_haiku.json`: 42/89 = 47.19%).
- **Compiled** paper (`\input{sec-experiments_v2}`, `sec-experiments_v2.tex:138`) = **44.9%**.
- Uncompiled, stale `sec-results.tex:418` = **41.5%** (the numbers agent mistook this for authoritative).

This is the primary terminal-skills claim; a 2.3pp paper/website gap on the headline result.
**Fix:** choose one authoritative TB2 number, propagate to all 5 website locations + the compiled
paper, and retire the stale `sec-results.tex`. All *other* numbers (ARC1/2, Polyglot, SWE-Pro,
cross-backbone, prompt-opt, KT) match across paper and site — only TB2-Ours diverges.

### B3. Orphaned pages: `figures/figure/` and `stage-anim/` unreachable
*(links-nav)* Complete, deployable pages with zero inbound links. Either link them in or drop them.

### B4. `.kt-cell { color:#1a1a1c }` hardcoded — dark-mode text defect
*(css)* Literal hex, no theme token, no dark override (`static/css/style.css:605`,
`figures/static/css/style.css:508`). One-line fix each: `color: var(--color-text)`.

### B5. Knowledge-Transfer section omits the task-conditioned adapter
*(claims)* Website says transfer is "zero-shot, no forum, no recipient distillation" but drops the
paper's adapter step (`sec-experiments_v2.tex:266`) that converts the donor bundle into a per-task
memo. Materially understates the mechanism; not reproducible from the site as written.

---

## Highs (grouped by theme)

**Social/SEO previews are broken** *(seo-meta, assets, links-nav — 3 agents)*
- `og:image` is a relative URL on both `index.html:11` and `figures/index.html:11` → no preview image.
- No `og:url`; no Twitter Card tags anywhere; no canonical link.

**Accessibility — keyboard & ARIA** *(accessibility)*
- Stage/bench tabs and dashboard task tabs use `role="tab"` but never update `aria-selected`, have no
  `tabpanel`/`aria-labelledby`, and no arrow-key navigation (H1, H2, M4).
- `nav-toggle` never sets `aria-expanded` (H5).
- Multi-level results tables lack `scope` on `<th>` (H6).
- (The `figures/index.html` Walkthrough tabs are correctly wired — use as the template.)

**Accessibility — contrast** *(accessibility, css)*
- `--color-text-secondary` #71717a on #faf8f5 = 4.18:1 — fails 4.5:1 for *most body copy site-wide*
  (one-variable fix, `style.css:7`).
- White text on KT cells #dc5a44/#ea7252/#ed8e60 = 3.55/2.85/2.31:1 — fail.

**Dark mode beyond the KT cells** *(css)* `--color-warm-low/high` have no dark override and are read
by D3 at runtime → heatmaps render light tones on the dark page.

**Reduced motion** *(css)* `figure.css` scroll-cue animates `infinite` with no `prefers-reduced-motion` guard.

**figures/ vs root style drift** *(css)* nav background pure-white vs warm off-white; section spacing
7.5rem vs 6rem; h2 underline accent present vs absent — the dashboards look like a different site.

**Hero figure mismatch** *(assets)* site `main_full.png` has different axes/palette/points than the
paper's `figures/main_full.png`, with no regeneration path (no `main_full.pdf`, omitted from README loop).

~~**Data: dangling transcripts**~~ — RETRACTED (false). Verified all 705 referenced transcripts
exist on disk (0 missing); the agent's Glob calls misfired. See data-integrity.md.

**`copyBibtex` latent bug** *(javascript)* targets a non-existent `#bibtex` and is unwired (`index.html:458`).

**Overclaim** *(claims)* "the source of the gains over Meta-Harness, Goose, Terminus-KIRA"
(`index.html:394`) is stronger than the paper's "illustrate the mechanism".

---

## Mediums (brief)
- "three-stage protocol" vs "four stages" self-contradiction *(copy, claims — index.html:113 vs 147)*.
- Live "Correspondence details to be added." placeholder behind the Contact button *(copy, seo, links)*.
- Shipped `<!-- COPY:... -->` and `<!-- TODO -->` comments *(seo, copy — index.html:59,175,425,432)*.
- Stale README (describes nonexistent `website/` dir; `cd website` fails; stale Ghostscript loop) *(copy, assets)*.
- ARC-AGI-1 cost $46 excludes cache-creation tokens (JSON full cost $71.72), undocumented *(numbers)*.
- ARC1 `macro_pass_pct` 83% computed but never surfaced; `avg_actions_per_task` actually per-trial (~6× off) *(data)*.
- Benchmark name "ARC-2" vs "ARC-AGI-2"; "knowledge bank" vs "knowledge base" *(copy)*.
- Abstract drops "controlled case studies"; "Stage 4" labeling *(claims)*.
- `dashboard-arc1.js` boot error names wrong file; main-anim counter snaps 41→0; `wireFilters` unguarded *(javascript)*.
- arXiv `<a href="#" aria-disabled>` is a dead, focusable click *(links, accessibility)*.
- Dashboard search `outline:none` weak focus; KT h2→h4 heading skip; meta-description length/missing; no canonical *(accessibility, seo)*.
- Wide 9-col tables cramped at mobile widths *(css)*.

## Lows / observations
- 7 orphan images in `static/images/` incl. 2 byte-duplicates *(assets)*.
- Favicon teal vs amber across pages; British spellings in figures/figure; `_firstSentence` shadows `window`;
  summary subtitle "47%" vs KPI "47.2%"; dead empty CSS rule; figcaption outside figure; scroll-offset 0.5rem mismatch;
  `figure.js` hardcodes transfer data with no backing JSON; footer comment tombstones.

---

## Cross-cutting themes (independently flagged by 2+ agents)
1. **Double-blind leaks** — claims + seo-meta + links-nav. *Highest-confidence finding.*
2. **TB2 47.2 / 44.9 / 41.5 number split** — numbers + claims + data, each from a different file.
3. **Broken social previews (relative og:image, no twitter/canonical)** — seo + assets + links-nav.
4. **figures/ subtree drift from root** — css (styles) + copy (terms/README) + assets (figure copies).
5. **ARIA tab pattern incomplete** — accessibility flagged across stage tabs, bench tabs, and dashboard tabs.

## Disagreements
- **Which paper file is authoritative for TB2** — numbers agent said `sec-results.tex` (41.5%), claims
  agent said `sec-experiments_v2.tex` (44.9%). **Resolved at source:** the compiled paper inputs
  `sec-experiments_v2.tex` (neurips_2026.tex:288); `sec-results.tex` is commented out (line 287). The
  claims agent was right; **44.9% is authoritative**, 41.5% is dead.

## Strengths
- Solid a11y foundation: skip links, `lang`, labeled controls, rich `sr-only` animation description,
  `prefers-reduced-motion` handled in CSS *and* JS, a correctly-wired ARIA tabs widget on figures/index.
- Data files are internally consistent; every KPI the data agent could recompute reconciled exactly.
- Defensive JS: early-exit guards, feature detection, d3/Plotly load-order guards, awaited fetches.
- All `<img>`/anchor targets resolve on disk — no broken images, no broken in-page anchors.

---

## Verification notes (orchestrator, grounded-subagents)
- **TB2 authoritative file:** verified `neurips_2026.tex:287-288` — `sec-results.tex` commented out,
  `sec-experiments_v2.tex` compiled. Grep confirmed 44.9% at `:138` and the stale 41.5% at
  `sec-results.tex:418`.
- **Double-blind leaks:** re-grepped — all `xuefei-wang` URLs confirmed present.
- **`copyBibtex`/`#bibtex`:** confirmed function exists, no `id="bibtex"`, no call-site.
- **Downgraded for uncertainty:** the assets agent's "ARC-AGI-2 heading shows ARC-AGI-1 task IDs"
  (HIGH) rests on an unreliable heuristic — *both* ARC benchmarks use 8-char hex task IDs. Re-tagged
  **NEEDS AUTHOR CONFIRMATION**, not a confirmed mislabel.
- Reviewer agents (`feature-dev:code-reviewer`) had no Write tool, so all 10 reports were persisted by
  the orchestrator from the agents' returned findings.
- **Dangling-transcripts (data-integrity, 2× HIGH) RETRACTED 2026-05-29:** exhaustive
  `os.path.exists` over every `transcript_path` in all four data JSONs found 0 missing (705/705
  present). The agent's `Glob`-based "missing" claims were false — a known subagent failure mode.
