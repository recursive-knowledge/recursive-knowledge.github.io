# Paper-Fidelity: Claims / Prose — Deep Review

**Scope:** Qualitative claims, method description, terminology, captions vs the paper.
**Authoritative paper source:** `sections/sec-experiments_v2.tex` (compiled), abstract in
`neurips_2026.tex`, `sec-method.tex`, `sec-introduction.tex`, `sec-conclusion.tex`.

## Severity counts
BLOCKER 1 · HIGH 2 · MEDIUM 3 · LOW 0

---

### Double-blind identity leak: GitHub + personal site links on a page claiming anonymity
**Severity:** BLOCKER (for a submission under double-blind review)
**Location:** `index.html:66` and `index.html:443`; `figures/index.html:68` and `figures/index.html:499`
**Evidence:**
- `index.html:66`: `href="https://github.com/xuefei-wang/swarms"` (the "Code" button)
- `index.html:443`: footer `href="https://xuefei-wang.github.io/simple-agent-opt/"`
- Same page declares (`index.html:60-61`): "Anonymous Authors / Affiliations withheld during double-blind review", badge "NeurIPS 2026 · under review".
- Verified present by grep (orchestrator).

**Failure mode:** Any reviewer who clicks or hovers a link instantly learns the author's GitHub
identity, defeating double-blind. The personal `xuefei-wang.github.io` footer link is an even
stronger deanonymizer than the repo name.

**Recommendation:** Replace both with anonymized placeholders / an anon-repo URL, or remove,
until the review period ends. (See also seo-meta-html.md, links-nav-routing.md — independently
flagged.) NOTE: `figures/figure/index.html:445` uses a *different*, already-anonymized org
(`knowledge-centric-self-improvement`), so the canonical anonymized form already exists.

---

### Knowledge-Transfer section omits the task-conditioned adapter step
**Severity:** HIGH
**Location:** `index.html:321`; `figures/index.html:382`; paper `sec-experiments_v2.tex:266`
**Evidence:**
- Website: "We freeze a generation-10 knowledge bundle and apply it zero-shot to disjoint
  evaluation tasks — with no new forum, no recipient-side distillation."
- Paper: "...no new forum discussion and no recipient-side distillation. A task-conditioned
  adapter converts the shared donor asset into a short memo tailored to the current task before
  the solver acts."

**Failure mode:** The website omits a real mechanism (the adapter). It makes transfer look like
raw bundle injection; a reader cannot reproduce the setup from the site description.
**Recommendation:** Add a clause noting the task-conditioned adapter tailors the bundle per task.

---

### "Stage 4: Results" presented as a protocol stage; paper has exactly three
**Severity:** HIGH (cross-flagged by copy-consistency.md)
**Location:** `index.html:122`, `index.html:146-147`; `stage-anim/index.html:37`; paper `sec-method.tex:20,25-44`
**Evidence:**
- Website tab: `<span class="stage-tab-num">4</span>Results`; figcaption: "One bank, four stages."
- `index.html:113` itself says "a three-stage protocol".
- Paper: "Knowledge curation protocol consisting of three stages" with `\paragraph{Stage 1/2/3}` and no Stage 4.

**Failure mode:** Contradicts the paper and the page's own method text; a reader may report the
protocol as having four stages.
**Recommendation:** Label the fourth tab "Results / Outcomes" (not "Stage 4"); change "four
stages" to "three stages + results".

---

### Website abstract drops "controlled case studies" qualifier
**Severity:** MEDIUM
**Location:** `index.html:90`; paper `neurips_2026.tex` abstract ("We conduct controlled case studies to operationalize this idea...")
**Evidence:** Website: "We operationalize this idea via a simple protocol." (qualifier removed).
Note `figures/index.html` retains the fuller phrasing — so the two site pages also disagree.
**Failure mode:** Removes a scoping qualifier; broadens the apparent claim beyond the paper.
**Recommendation:** Restore "We conduct controlled case studies to..." for consistency.

---

### Causal overclaim: "the source of the gains over Meta-Harness, Goose, and Terminus-KIRA"
**Severity:** MEDIUM
**Location:** `index.html:394-395`; paper `sec-experiments_v2.tex:152`
**Evidence:** Paper says the qualitative examples "illustrate the mechanism behind these gains";
website upgrades this to "the source of the gains over [named baselines]" — a causal attribution
the paper does not make.
**Recommendation:** Soften to "the mechanism the examples illustrate" / "consistent with the gains".

---

### "transfers across tasks and model families" / 15-newly-solved claim
**Severity:** MEDIUM (verified faithful — listed for completeness)
**Evidence:** `index.html:370` "share 15 newly solved tasks — evidence the bundle carries
donor-agnostic structure" matches `sec-experiments_v2.tex:330` verbatim. Transfer scope claim
supported by §4.4. No change needed; included so the synthesis records it was checked.

## Verified-faithful
Baseline names (DGM, HyperAgents, GEPA, OpenEvolve, OpenHands, Terminus 2, Mini-SWE-Agent,
Terminus-KIRA, Goose, Meta-Harness) and backbone names (Haiku 4.5, GPT-5.4-mini, Opus 4.7)
all spelled/attributed consistently with the paper.
