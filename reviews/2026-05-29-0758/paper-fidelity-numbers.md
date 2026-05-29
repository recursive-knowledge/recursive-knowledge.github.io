# Paper-Fidelity: Numbers — Deep Review

**Scope:** Every quantitative claim on the website cross-checked against the paper.
**Authoritative paper source:** The compiled paper `\input`s `sections/sec-experiments_v2.tex`
(neurips_2026.tex:288). `sections/sec-results.tex` is **commented out of the build**
(neurips_2026.tex:287) — it is STALE and must not be treated as authoritative.

> Orchestrator correction (grounded-subagents verification): the dispatched agent treated
> `sec-results.tex:418` (41.5%) as authoritative. Source verification showed that file is not
> compiled. The authoritative TB2 number is **44.9%** (`sec-experiments_v2.tex:138`).

## Severity counts
BLOCKER 1 · HIGH 0 · MEDIUM 2 · LOW 1

---

### Terminal-Bench 2 "Ours" score: website 47.2% vs compiled paper 44.9% (and a 3rd stale value 41.5%)
**Severity:** BLOCKER
**Location:**
- Website: `index.html:102`, `index.html:142`, `index.html:247`; also `figures/index.html`, `figures/figure/index.html`; data `figures/static/data/tb2_haiku.json:17`
- Compiled paper: `sec-experiments_v2.tex:138` → `OURS & \textbf{44.9\%}`
- Stale uncompiled file: `sec-results.tex:418` → `OURS & \textbf{41.5\%}`

**Evidence:**
- `index.html:247`: `<tr class="ours"><td>Ours (Haiku 4.5)</td><td class="best">47.2%</td></tr>`
- `index.html:102`: `Curated knowledge compounds over ten generations — 21% → 47.2% on Terminal-Bench 2.`
- `tb2_haiku.json`: `"solved": 42, "solved_pct": 47.2, "total_tasks": 89` → 42/89 = 47.19% (website is internally consistent)
- `sec-experiments_v2.tex:138` (COMPILES): `OURS & \textbf{44.9\%} \\`
- `sec-results.tex:418` (does NOT compile): `OURS & \textbf{41.5\%} \\`

**Failure mode:** The headline benchmark result differs between the website (47.2%) and the
actual paper PDF (44.9%) by 2.3 percentage points. A reviewer comparing the two sees an
unexplained overstatement on the primary terminal-skills claim. Separately, the repo still
contains an uncompiled `sec-results.tex` quoting a third value (41.5%), which is a latent
paper-hygiene hazard (someone could re-enable it).

**Recommendation:** Pick one authoritative TB2 number and propagate it everywhere. If 47.2%
(42/89) is the final run, update `sec-experiments_v2.tex:138` to 47.2% and delete/retire the
stale `sec-results.tex`. If the paper at 44.9% is frozen, correct all five website locations.
Do not ship a paper/website mismatch on the headline number.

---

### ARC-AGI-1 cost $46 excludes cache-creation tokens; dashboard JSON full cost is $71.72
**Severity:** MEDIUM
**Location:** `index.html:208`, `index.html:278`; paper `sec-experiments_v2.tex:112`; data `figures/static/data/arc1_haiku.json:26`
**Evidence:**
- Website + paper both report ARC-AGI-1 Ours = `82% / $46`.
- `arc1_haiku.json`: `"cost_usd_total": 71.72`.
- Recompute with the file's own price model (input $1/M, output $5/M, cache_read $0.10/M, cache_creation $1.25/M):
  - excluding cache_creation: $46.28 ≈ **$46** (matches paper/site)
  - including cache_creation: $46.28 + $25.43 = **$71.72** (matches JSON total)

**Failure mode:** The reported $46 silently excludes 36% of the true token cost (cache
creation). The exclusion is undocumented. Cost-efficiency comparisons against baselines may be
on an inconsistent accounting basis. (TB2 has zero cache tokens so no analogous gap there.)

**Recommendation:** Either document that reported costs exclude cache-creation tokens (and
confirm all benchmarks use the same rule), or recompute to include them.

---

### Hero "21%" starting point is underived in prose (correct, but unexplained)
**Severity:** MEDIUM
**Location:** `index.html:102` ("21% →"), data `tb2_haiku.json` gen-1 `macro_pass_ratio = 0.2135`
**Evidence:** 19/89 = 21.35% → "21%". Internally consistent with the data, but the page never
states that 21% is the generation-1 baseline; a reader cannot reconstruct it.
**Failure mode:** Ambiguous headline; "21% → 47.2%" reads as a vague before/after.
**Recommendation:** Annotate as "from 21% (generation 1) to 47.2% (generation 10)".

---

### KT figure caption in paper has donor/receiver swapped (paper-side, not website)
**Severity:** LOW (paper-side; website table is correct)
**Location:** paper `sec-results.tex:590` (note: in the uncompiled file; verify the live caption in the compiled build)
**Evidence:** Caption says "GPT-curated knowledge raises Haiku from 12% to 62% on Polyglot",
but the table's GPT-donor→Haiku-receiver cell = 56%; 62% is Haiku-donor→GPT-receiver. The
website's KT table (`index.html:333-365`) renders all cells correctly.
**Recommendation:** Fix the paper caption directionality. No website change needed.

---

## Verified-correct (no discrepancy)
- Main table (ARC1 82/$46, ARC2 76/$65, Polyglot 80/$92, SWE-Pro 84/$76; HyperAgents
  70/$150, 60/$120, 56/$97, 42/$276; DGM n/a, n/a, 64/$180, 66/$456) — website matches
  `sec-experiments_v2.tex:112` and the baseline rows.
- Cross-backbone table — matches `sec-experiments_v2.tex:242-243`.
- Prompt-opt table (Ours 82/80, GEPA 44/36, OpenEvolve 54/60) — matches `:172`.
- KT 8-cell tables (Polyglot 18/48/62/12/56/50; ARC1 32/42/38/18/24/20) — match paper.
- TB2 leaderboard rows (OpenHands 13.9, Terminus 2 28.3, Mini-SWE 29.8, Terminus-KIRA 33.7,
  Goose 35.5, Meta-Harness 37.6) — match `sec-experiments_v2.tex:130-136`.
- Meta-Harness "(Opus 4.7 + Haiku 4.5)" annotation — supported by `sec-experiments_v2.tex:27`.
- "15 newly solved tasks", "ten generations / 10 generations" — supported.
- All data-file KPIs reconcile internally (see data-integrity.md).
