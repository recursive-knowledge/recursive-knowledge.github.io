# Data Integrity & Dashboards — Deep Review

**Scope:** JSON data files, builder scripts, and dashboard JS aggregation/rendering.

## Severity counts
BLOCKER 0 · HIGH 0 · MEDIUM 2 · LOW 2
*(was HIGH 2 — both "dangling transcript" findings RETRACTED on verification; see below)*

---

### ~~Dangling transcript references — ARC-AGI-1 / Terminal-Bench 2~~ — RETRACTED (false)
**Original severity:** HIGH ×2 · **Verdict after orchestrator verification: NOT A BUG.**
The agent reported ~18 ARC-1 + many TB2 transcript dirs as "missing" based on `Glob` returning
"No files found". Direct verification (2026-05-29) shows every referenced transcript file exists:
- Exhaustive `os.path.exists` over all `transcript_path` values in `tb2_haiku.json`,
  `arc1_haiku.json`, `knowledge.json`, `arc1_knowledge.json` → **0 missing** (540/540 TB2,
  165/165 ARC-1 present). 88/88 TB2 and 50/50 ARC-1 transcript dirs on disk.
- Spot-checks the agent named as missing all exist, e.g. `transcripts/gpt2-codegolf/gen2.txt`
  (45694 bytes), `arc1_transcripts/d22278a0/gen1.txt` (3909 bytes).
This matches the documented failure mode "Explore/subagent 'file missing' claims are frequently
wrong" — the agent's Glob calls misfired. No action taken; nothing to prune or rebuild.

---

### ARC1 `solved_pct` (82.0) vs `macro_pass_pct` (83.0) diverge; macro never surfaced
**Severity:** MEDIUM
**Location:** `arc1_haiku.json:17-21`; rendered in `dashboard-arc1.js:128`
**Evidence:** `"solved":41,"solved_pct":82.0` (41/50=82.0 ✓); `"macro_pass_ratio":0.83,"macro_pass_pct":83.0`.
Dashboard shows only `solved_pct`. `macro_pass_pct` (partial-credit weighted) is stored but never displayed.
**Failure mode:** A 1-point gap a reader can't reconcile from the dashboard.
**Recommendation:** Surface macro as a second KPI or tooltip.

### `avg_actions_per_task` is actually per traced trial — mislabeled ~6×
**Severity:** MEDIUM
**Location:** `build_tb2_dashboard.py:401`, `build_arc_dashboard.py:464`; UI `dashboard.js:151`, `dashboard-arc1.js:159`
**Evidence:** Builder divides `total_actions / n_trials_traced` (TB2: 21481/540 = 39.8), not by
`total_tasks` (21481/89 = 241.4). UI label: "avg shell actions / task".
**Failure mode:** Per-task effort understated ~6× for TB2.
**Recommendation:** Rename key to `avg_actions_per_trial` and relabel UI, or recompute per task.

---

### Summary subtitle uses Math.round → "47%" while KPI shows "47.2%"
**Severity:** LOW
**Location:** `dashboard-tb2-summary.js:77-84`
**Evidence:** `${Math.round(first*100)}% → ${Math.round(last*100)}%` → "21% → 47%" while the KPI
card uses `fmtPct(k.solved_pct)` = "47.2%".
**Recommendation:** Use `(n*100).toFixed(1)` for consistent precision.

### `figure.js` hardcodes transfer-heatmap percentages with no backing JSON
**Severity:** LOW
**Location:** `figure.js:301-316` (`TRANSFER_DATA`)
**Evidence:** Polyglot/ARC transfer values inlined in JS; no `transfer_*.json` exists in `figures/static/data/`.
Values match the paper KT table, but cannot be regenerated/verified at build time.
**Recommendation:** Externalize to a data file or annotate the source experiment + verification date.

---

## KPI reconciliation — all checks passed
| Check | Computed | JSON | Pass |
|---|---|---|---|
| TB2 solved_pct | 42/89 = 47.19 → 47.2 | 47.2 | ✓ |
| TB2 per-gen deltas sum | 19+5+5+4+4+0+3+1+1+0 = 42 | solved=42 | ✓ |
| TB2 n_attempted progression | 89→70→65→60→56→52→52→49→48→47 | matches | ✓ |
| TB2 mean_tokens_per_task | (324938468+23711187)/89 = 3917411.9 | 3917411.9 | ✓ |
| ARC1 solved_pct | 41/50 = 82.0 | 82.0 | ✓ |
| ARC1 per-gen deltas sum | 30+3+2+1+3+0+2+0+0+0 = 41 | solved=41 | ✓ |
| ARC1 cost_per_task | 71.72/50 = 1.43 | 1.43 | ✓ |

Note: TB2 data is internally consistent at 47.2% (42/89). The mismatch is with the compiled
paper (44.9%), not within the data — see paper-fidelity-numbers.md.
