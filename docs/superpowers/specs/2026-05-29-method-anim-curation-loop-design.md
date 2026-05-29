# Method animation redesign — knowledge curation loop

**Section:** "How does self-improving knowledge work?" (`#method` in `index.html`)
**Replaces:** the dense 4-stage `stages-anim` flywheel (one busy SVG canvas with flying tokens, an 8-agent ring, a filling bank, a 15-tile grid, and a results finale).
**Date:** 2026-05-29 · **Branch:** `feat/method-anim-curation-loop`

## Problem

The old animation showed ~6 things moving at once on a single canvas, with continuous
auto-play and no rest state. Viewers had no anchor and had to track motion between distant
regions. Goal: make the mechanism the easiest possible thing to follow.

## Decision

A calm, paper-aligned **loop** ("Design 1 · loop + central vault"), one beat lit at a time,
with the shared knowledge base living at the center and visibly improving.

### Beats (paper vocabulary — sec-method.tex / intro)

Five beats around a ring, clockwise from top:

1. **Seed** — a generic, stateless agent receives a distilled bundle from the base
   (task-level + cross-task guidance).
2. **Attempt** — it attempts one task with standard tools; outcome recorded.
3. **Task-level forum** (Stage 1) — agents post task-scoped evidence. *Core.*
4. **Cross-task forum** (Stage 2) — agents **discuss** what transfers, grounded in a concrete
   primitive, with agree / disagree / synthesize replies. *Core.* (Never "test what transfers".)
5. **Distillation** (Stage 3) — surviving claims consolidated into typed bundles, written back
   to the base. *Core.*

The arrow from Distillation back to Seed = "next generation seeds from the improved base."

### Visual rules

- **One beat lit at a time**; non-active nodes dimmed. A single pulse travels the ring.
- **Forums look like forums**: the detail panel renders real threaded posts (author chips,
  replies, agree/synthesize stances, "grounded in …"); agents gather at the active forum node.
- **Forums marked as core**: the three curation nodes' forum steps get a double-ring + a
  `core` chip in the detail header. (No "THREE-STAGE … THE CORE" arc/label — dropped per review.)
- **The base improves, strikingly**: the central vault fills with insight "spines," the big
  solve-rate counts up with a `+N` flash, and a token flies into the base at Distillation.
- **Detail panel** sits to the right of the ring (stacks below on narrow screens), consistent
  location across beats.
- The **"Results" beat is removed** — baselines/transfer already live in the `#results` section.

## Real data (from `figures/static/data/tb2_haiku.json`, Terminal-Bench 2, Haiku 4.5)

- Total tasks: **89**. Final: **42 solved = 47.2%**. Cost: **$4.98 / task**.
- Cumulative solved per generation (1→10): **19, 24, 29, 33, 37, 37, 40, 41, 42, 42**.
- Per-generation distilled insights (from `highlights.per_gen`), short labels:
  1. Clean exit ≠ correctness — debug schemas/artifacts, not logic
  2. Call a domain oracle before submitting
  3. Capture both streams (`make 2>&1 | tee build.log`)
  4. Read the tests as spec (grep `/tests/` first)
  5. exit 0 + score 0 = schema mismatch, not a crash
  6. Re-query after you mutate (stale caches)
  7. Run the verifier yourself
  8. C89 shared subset for polyglot/cross-compile
  9. Exact fixture paths
  10. Same failure 5 gens = a missing diagnostic step
- The threaded example (path-tracing / pytorch-model-cli, "exit 0 but empty artifact") is the
  honest Gen-1 rule.

## Files

- `index.html` — replace the `figure.stages-wrap` method block with the loop markup
  (5 beat tabs, playback bar, SVG + detail two-column, sr-only description, figcaption).
  Keep the `.stage-grid` Stage 1/2/3 cards (already aligned).
- `static/js/stages-anim.js` — rewrite as the loop controller. Preserve production features:
  reduced-motion (static last frame), IntersectionObserver pause when offscreen,
  play/pause/restart + 0.5/1/2× speed, ARIA, keyboard-activatable beat tabs.
- `static/css/main-anim.css` — rewrite for the loop design; scope under `.kc-fig`; use the
  global `--color-*` tokens from `style.css`.

## Out of scope

Rebuilding the `#results` section; touching other figures; dark-mode fine-tuning beyond
inheriting tokens.
