#!/usr/bin/env python3
"""Build the static tb2 Haiku dashboard payload.

Reads a Knowledge-Centric / TB2 campaign artifact tree as produced by
``swarms.cli`` on ``terminal_bench_2``. The expected canonical input is the
aggregate output JSON written by the campaign runner, e.g.::

    results/baseline_sweep_haiku_20260505b/tb2.json

Shape of that file (abridged)::

    {
      "args":  { ... CLI args ... },
      "num_tasks": 89,
      "num_traces": 588,
      "traces": [
        {
          "generation": 1,
          "agent_id":  "agent-34",
          "task_id":   "gpt2-codegolf",
          "eval_result": {
            "reward": 0.0, "resolved": false,
            "agent_exit_code": 0, "verifier_exit_code": 0,
            "category": "software-engineering", "difficulty": "hard",
            ...
          },
          "tool_trace":  [ ... list of tool_call dicts ... ],
          "token_usage": {
            "input_tokens": int,
            "output_tokens": int,
            "cache_creation_input_tokens": int,
            "cache_read_input_tokens": int,
          },
          "runtime_meta": { "status": "completed" | "error", "error": "..." },
          "model_output": "...",
          "native_score": float | null
        },
        ...
      ]
    }

Outputs (under ``--out`` parent dir)::

    tb2_haiku.json                                   # the dashboard payload
    transcripts/<task_id>/gen<N>.txt                 # human-readable tool trace
    tool_traces/<task_id>/gen<N>.json                # raw tool_trace list

Pricing defaults are Haiku 4.5 published prices (override with --price-*).
"""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

PRICE_DEFAULTS = {
    "input":          1.00,
    "output":         5.00,
    "cache_read":     0.10,
    "cache_creation": 1.25,
}

EXCERPT_LIMIT = 1200
TRANSCRIPT_LIMIT = 600_000
TOOL_OUTPUT_LIMIT = 4000


def _excerpt(text: str | None, limit: int = EXCERPT_LIMIT) -> dict[str, Any]:
    if not text:
        return {"text": "", "truncated": False, "full_length": 0}
    if len(text) <= limit:
        return {"text": text, "truncated": False, "full_length": len(text)}
    return {"text": text[:limit], "truncated": True, "full_length": len(text)}


def _safe_str(x: Any) -> str:
    if x is None:
        return ""
    if isinstance(x, str):
        return x
    return str(x)


def _cost_usd(tokens: dict[str, int], price: dict[str, float]) -> float:
    return sum(tokens.get(k, 0) * price[k] for k in price) / 1_000_000.0


def _tokens_from_trace(trace: dict[str, Any]) -> dict[str, int]:
    tu = trace.get("token_usage") or {}
    return {
        "input":          int(tu.get("input_tokens") or 0),
        "output":         int(tu.get("output_tokens") or 0),
        "cache_read":     int(tu.get("cache_read_input_tokens") or 0),
        "cache_creation": int(tu.get("cache_creation_input_tokens") or 0),
    }


def _classify_status(trace: dict[str, Any], eval_result: dict[str, Any]) -> str:
    """resolved | failed | infra | unknown"""
    if eval_result.get("resolved") is True:
        return "resolved"
    rt_status = (trace.get("runtime_meta") or {}).get("status", "")
    if (trace.get("error") or rt_status == "error"
            or eval_result.get("status") == "error"):
        return "infra"
    if eval_result.get("agent_exit_code") is None or eval_result.get("verifier_exit_code") is None:
        return "infra"
    return "failed"


def _step_summaries(trace: list[Any] | None, limit: int = 6) -> list[str]:
    """Pull the first N `tool_input.summary` strings — the agent's own narration
    of what it's doing — for a compact drill-down view. Falls back to a short
    `$ <command>` line if a step has no summary."""
    out: list[str] = []
    if not isinstance(trace, list):
        return out
    for step in trace:
        if not isinstance(step, dict):
            continue
        ti = step.get("tool_input") if isinstance(step.get("tool_input"), dict) else {}
        summary = _safe_str(ti.get("summary")).strip()
        if not summary:
            cmd = _safe_str(ti.get("command")).strip()
            if cmd:
                summary = "$ " + (cmd[:120] + "…" if len(cmd) > 120 else cmd)
        if summary:
            out.append(summary)
        if len(out) >= limit:
            break
    return out


def _tool_trace_summary(trace: list[Any] | None) -> dict[str, Any]:
    if not isinstance(trace, list) or not trace:
        return {"n_actions": 0, "by_kind": {}, "by_tool": {}}
    by_kind: Counter[str] = Counter()
    by_tool: Counter[str] = Counter()
    for step in trace:
        if not isinstance(step, dict):
            continue
        tn = _safe_str(step.get("tool_name") or step.get("tool") or "other")
        ti = step.get("tool_input") if isinstance(step.get("tool_input"), dict) else {}
        cmd = _safe_str(ti.get("command") or "").strip()
        kind = tn
        if tn == "tb2_shell" and cmd:
            head = cmd.split(None, 1)[0]
            kind = head if head else tn
        by_tool[tn] += 1
        by_kind[kind] += 1
    return {
        "n_actions": sum(by_tool.values()),
        "by_tool": dict(by_tool),
        "by_kind": dict(by_kind),
    }


def _build_transcript(trace_list: list[Any] | None, final_text: str | None) -> str:
    """Render the tool_trace into a readable text transcript."""
    lines: list[str] = []
    if not isinstance(trace_list, list):
        return ""
    for i, step in enumerate(trace_list, 1):
        if not isinstance(step, dict):
            continue
        tn = _safe_str(step.get("tool_name") or step.get("tool") or "tool")
        ti = step.get("tool_input") if isinstance(step.get("tool_input"), dict) else {}
        to = step.get("tool_output") if isinstance(step.get("tool_output"), dict) else {}
        cmd = _safe_str(ti.get("command")).strip()
        summary = _safe_str(ti.get("summary")).strip()
        out = _safe_str(to.get("stdout") or to.get("combined_output") or "")
        err = _safe_str(to.get("stderr") or "").strip()
        ec = to.get("exit_code")
        lines.append(f"── step {i:>3} · {tn} ──")
        if summary:
            lines.append(f"# {summary}")
        if cmd:
            lines.append(f"$ {cmd}")
        if out:
            chunk = out if len(out) <= TOOL_OUTPUT_LIMIT else (out[:TOOL_OUTPUT_LIMIT] + f"\n…[+{len(out)-TOOL_OUTPUT_LIMIT} bytes truncated]")
            lines.append(chunk.rstrip())
        if err:
            chunk = err if len(err) <= TOOL_OUTPUT_LIMIT else (err[:TOOL_OUTPUT_LIMIT] + f"\n…[+{len(err)-TOOL_OUTPUT_LIMIT} bytes truncated]")
            lines.append("[stderr] " + chunk.rstrip())
        if ec is not None and ec != 0:
            lines.append(f"[exit_code={ec}]")
        lines.append("")
    if final_text:
        lines.append("── final ──")
        lines.append(final_text.strip())
    return "\n".join(lines)


def _per_gen_summary(trials_per_gen: dict[int, list[dict[str, Any]]],
                     best_so_far: dict[int, dict[str, float]],
                     total_tasks: int) -> list[dict[str, Any]]:
    gens = sorted(trials_per_gen)
    cumulative_resolved: set[str] = set()
    rows: list[dict[str, Any]] = []
    for gen in gens:
        gen_trials = trials_per_gen[gen]
        new_resolved = {t["task_id"] for t in gen_trials if t["resolved"]}
        cumulative_resolved |= new_resolved
        rewards = [v for v in best_so_far[gen].values() if v is not None]
        macro = sum(rewards) / total_tasks if total_tasks else 0.0
        mean_attempt_reward = (
            sum((t["reward"] or 0.0) for t in gen_trials) / len(gen_trials)
            if gen_trials else 0.0
        )
        tok = {"input": 0, "output": 0, "cache_read": 0, "cache_creation": 0}
        for t in gen_trials:
            for k in tok:
                tok[k] += t["tokens"].get(k, 0)
        rows.append({
            "gen": gen,
            "delta": len(new_resolved - (cumulative_resolved - new_resolved)),
            "cumulative": len(cumulative_resolved),
            "n_attempted": len(gen_trials),
            "macro_pass_ratio": round(macro, 4),
            "mean_attempt_reward": round(mean_attempt_reward, 4),
            "tokens": tok,
        })
    return rows


def build_payload(traces: list[dict[str, Any]], args_section: dict[str, Any],
                  *, experiment: str, model: str, price: dict[str, float]) -> dict[str, Any]:
    by_task: dict[str, list[dict[str, Any]]] = defaultdict(list)
    by_gen: dict[int, list[dict[str, Any]]] = defaultdict(list)

    normalized: list[dict[str, Any]] = []
    for raw in traces:
        eval_result = raw.get("eval_result") if isinstance(raw.get("eval_result"), dict) else {}
        rt = raw.get("runtime_meta") if isinstance(raw.get("runtime_meta"), dict) else {}
        reward = eval_result.get("reward")
        if reward is None:
            reward = raw.get("native_score")
        if reward is not None:
            try:
                reward = float(reward)
            except (TypeError, ValueError):
                reward = None
        resolved = bool(eval_result.get("resolved")) or (reward is not None and reward >= 1.0)
        tokens = _tokens_from_trace(raw)
        trial = {
            "task_id":   _safe_str(raw.get("task_id")) or "<unknown>",
            "generation": int(raw.get("generation") or 1),
            "agent_id":  _safe_str(raw.get("agent_id")),
            "reward":    reward,
            "resolved":  resolved,
            "agent_exit_code":    eval_result.get("agent_exit_code"),
            "verifier_exit_code": eval_result.get("verifier_exit_code"),
            "status":             _classify_status(raw, eval_result),
            "trial_status":       _safe_str(eval_result.get("status") or rt.get("status") or "unknown"),
            "category":           _safe_str(eval_result.get("category") or ""),
            "difficulty":         _safe_str(eval_result.get("difficulty") or ""),
            "docker_image":       _safe_str(eval_result.get("docker_image") or ""),
            "build_timeout_sec":  eval_result.get("build_timeout_sec"),
            "agent_timeout_sec":  eval_result.get("agent_timeout_sec"),
            "verifier_timeout_sec": eval_result.get("verifier_timeout_sec"),
            "error":              _safe_str(raw.get("error") or rt.get("error") or ""),
            "tokens":             tokens,
            "cost_usd":           round(_cost_usd(tokens, price), 4),
            "tool_trace_summary": _tool_trace_summary(raw.get("tool_trace")),
            "model_output_excerpt": _excerpt(_safe_str(raw.get("model_output") or "")),
            "_tool_trace": raw.get("tool_trace") if isinstance(raw.get("tool_trace"), list) else [],
        }
        normalized.append(trial)
        by_task[trial["task_id"]].append(trial)
        by_gen[trial["generation"]].append(trial)

    total_tasks = len(by_task)

    # Best-so-far reward per task at each generation (for macro pass ratio curve).
    all_gens = sorted(by_gen)
    best_so_far: dict[int, dict[str, float]] = {g: {} for g in all_gens}
    for task_id, trials in by_task.items():
        trials.sort(key=lambda t: t["generation"])
        running_best: float | None = None
        for g in all_gens:
            this_gen_trials = [t for t in trials if t["generation"] == g]
            if this_gen_trials:
                top_here = max(
                    (t["reward"] for t in this_gen_trials if t["reward"] is not None),
                    default=None,
                )
                if top_here is not None:
                    running_best = top_here if running_best is None else max(running_best, top_here)
            best_so_far[g][task_id] = running_best if running_best is not None else 0.0

    # Per-task payload + roll-ups.
    tasks_payload: dict[str, Any] = {}
    total_tokens = {"input": 0, "output": 0, "cache_read": 0, "cache_creation": 0}
    resolved_count = 0
    rewards_for_macro = []
    by_category: Counter[str] = Counter()
    by_difficulty: Counter[str] = Counter()

    for task_id, trials in by_task.items():
        trials_sorted = sorted(trials, key=lambda t: t["generation"])
        first_solved_gen = next((t["generation"] for t in trials_sorted if t["resolved"]), None)
        best = max(trials_sorted, key=lambda t: (
            1 if t["resolved"] else 0,
            t["reward"] if t["reward"] is not None else -1.0,
            -t["generation"],
        ))
        if best["resolved"]:
            resolved_count += 1
        rewards_for_macro.append(best["reward"] if best["reward"] is not None else 0.0)
        task_tokens = {"input": 0, "output": 0, "cache_read": 0, "cache_creation": 0}
        per_gen_records: list[dict[str, Any]] = []
        for trial in trials_sorted:
            for k in task_tokens:
                task_tokens[k] += trial["tokens"].get(k, 0)
            per_gen_records.append({
                "gen": trial["generation"],
                "resolved": trial["resolved"],
                "reward": trial["reward"],
                "error": trial["error"],
                "n_actions": trial["tool_trace_summary"]["n_actions"],
                "step_summaries": _step_summaries(trial["_tool_trace"], limit=6),
                "has_transcript": bool(trial["_tool_trace"]),
                "transcript_path": (
                    f"transcripts/{trial['task_id']}/gen{trial['generation']}.txt"
                    if trial["_tool_trace"] else None
                ),
            })
        for k in total_tokens:
            total_tokens[k] += task_tokens[k]
        cat = best["category"] or "unknown"
        diff = best["difficulty"] or "unknown"
        by_category[cat] += 1
        by_difficulty[diff] += 1
        tasks_payload[task_id] = {
            "first_solved_gen": first_solved_gen,
            "best_reward":     best["reward"],
            "best_generation": best["generation"],
            "resolved":        best["resolved"],
            "agent_exit_code": best["agent_exit_code"],
            "verifier_exit_code": best["verifier_exit_code"],
            "status":          "resolved" if best["resolved"] else best["status"],
            "trial_status":    best["trial_status"],
            "category":        cat,
            "difficulty":      diff,
            "docker_image":    best["docker_image"],
            "tokens":          task_tokens,
            "cost_usd":        round(_cost_usd(task_tokens, price), 4),
            "per_gen":         per_gen_records,
        }

    total_cost = _cost_usd(total_tokens, price)
    macro_pass_ratio = (
        sum(rewards_for_macro) / total_tasks if total_tasks else 0.0
    )

    # Per-gen "newly solved" task list — emit task_id + category + difficulty
    # so the centerpiece can render chips without re-deriving anything.
    newly_solved_by_gen: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for tid, t in tasks_payload.items():
        fg = t.get("first_solved_gen")
        if fg is not None:
            newly_solved_by_gen[fg].append({
                "task_id":    tid,
                "category":   t.get("category", ""),
                "difficulty": t.get("difficulty", ""),
            })
    generations_rows = _per_gen_summary(by_gen, best_so_far, total_tasks)
    for row in generations_rows:
        row["newly_solved"] = newly_solved_by_gen.get(row["gen"], [])

    # Run-at-a-glance aggregates: total tool-actions across all trials, broken
    # down by command-kind (the first token of each shell command).
    total_actions = 0
    by_kind_counter: Counter[str] = Counter()
    n_trials_traced = 0
    for trial in normalized:
        tt = trial.get("_tool_trace") or []
        if not tt:
            continue
        n_trials_traced += 1
        for step in tt:
            if not isinstance(step, dict):
                continue
            tn = _safe_str(step.get("tool_name") or step.get("tool") or "other")
            ti = step.get("tool_input") if isinstance(step.get("tool_input"), dict) else {}
            cmd = _safe_str(ti.get("command")).strip()
            kind = tn
            if tn == "tb2_shell" and cmd:
                head = cmd.split(None, 1)[0]
                kind = head if head else tn
            by_kind_counter[kind] += 1
            total_actions += 1
    top_kinds_raw = by_kind_counter.most_common(4)
    run_summary = {
        "total_actions":         total_actions,
        "avg_actions_per_task":  round(total_actions / n_trials_traced, 1) if n_trials_traced else 0.0,
        "n_trials_with_trace":   n_trials_traced,
        "top_kinds": [
            {"kind": k, "count": c, "pct": round(c / total_actions, 4) if total_actions else 0.0}
            for k, c in top_kinds_raw
        ],
    }

    return {
        "experiment": experiment,
        "model": model,
        "total_tasks": total_tasks,
        "total_traces": len(traces),
        "args_summary": {
            "generations":            args_section.get("generations"),
            "max_concurrent_tasks":   args_section.get("max_concurrent_tasks"),
            "per_task_forum_rounds":  args_section.get("per_task_forum_rounds"),
            "cross_task_forum_rounds":args_section.get("cross_task_forum_rounds"),
            "distill_enabled":        args_section.get("distill_enabled"),
            "drop_solved":            args_section.get("drop_solved"),
            "seed":                   args_section.get("seed"),
        },
        "kpis": {
            "solved":          resolved_count,
            "solved_pct":      round(100.0 * resolved_count / total_tasks, 1) if total_tasks else 0.0,
            "macro_pass_ratio": round(macro_pass_ratio, 4),
            "macro_pass_pct":   round(100.0 * macro_pass_ratio, 1),
            "total_input_tokens":   total_tokens["input"],
            "total_output_tokens":  total_tokens["output"],
            "total_cache_read":     total_tokens["cache_read"],
            "total_cache_creation": total_tokens["cache_creation"],
            "mean_tokens_per_task": round(
                sum(sum(v for v in t["tokens"].values()) for t in tasks_payload.values()) / total_tasks, 1
            ) if total_tasks else 0,
            "cost_usd_total":    round(total_cost, 2),
            "cost_usd_per_task": round(total_cost / total_tasks, 2) if total_tasks else 0.0,
        },
        "categories":   dict(by_category),
        "difficulties": dict(by_difficulty),
        "generations":  generations_rows,
        "run_summary":  run_summary,
        "tasks":        tasks_payload,
        "price_model":  price,
    }, normalized


def _first_sentence_py(s: str, max_chars: int = 140) -> str:
    """Word-boundary clamp to <= max_chars. Mirrors the JS _firstSentence so
    headlines in the JSON and on the page agree byte-for-byte."""
    if not s:
        return ""
    cleaned = " ".join(s.split())
    if len(cleaned) <= max_chars:
        return cleaned
    window = cleaned[: max_chars + 1]
    cut = max(window.rfind(" "), window.rfind(","), window.rfind(";"))
    if cut < 40:
        cut = max_chars
    return cleaned[:cut].rstrip(" ,;") + "…"


# Hand-curated per-generation picks. Each entry references the most
# intellectually notable added insight (by text-prefix match against the gen's
# bundle) plus a brief caption explaining why it matters, and the most
# narratively notable newly-solved task(s) with a one-line note.
#
# Read in order, these tell the bundle's evolution arc: "outputs ≠ logs", then
# "use domain validators", then "grep the test files", then "run the verifier
# locally", then "consecutive identical failures mean missing diagnostics".
PINNED_PER_GEN: dict[int, dict[str, Any]] = {
    1: {
        "insight_prefix": "native_score=0.0 with agent_exit=0",
        "caption":        "The bundle's first rule, seen in path-tracing and pytorch-model-cli: clean exit codes are not correctness — debug schemas and artifacts, not logic. pytorch-model-cli, one of the two, goes on to solve at gen 3.",
        "featured":       [
            ("git-leak-recovery",   "Recovering leaked secrets from git history — a classic ops task where surface-level commands look right but miss subtle artifact requirements."),
        ],
    },
    2: {
        "insight_prefix": "Pre-submission domain validation via backward-compatible oracle",
        "caption":        "From principle to practice. Evidence from protein-assembly and chess-best-move converges on one rule: call a domain-specific oracle (chess.legal_moves, FPBase, BsaI digestion) before submitting.",
        "featured":       [
            ("pypi-server",         "Packaging a PyPI server — fails until the agent inspects the artifact's actual structure (tar -tzf) before launching, exactly what this insight prescribes."),
        ],
    },
    3: {
        "insight_prefix": "make 2>&1 | tee build.log",
        "caption":        "Concrete tool surfaces. fix-ocaml-gc and overfull-hbox both show that multi-phase compilers interleave streams — capture both with `make 2>&1 | tee build.log`.",
        "featured":       [
            ("build-cython-ext",    "Building a Cython extension — needs exactly the multi-phase log capture this insight describes."),
            ("schemelike-metacircular-eval", "A meta-circular Scheme evaluator — silent failures unless the agent reads the verifier's tests first."),
        ],
    },
    4: {
        "insight_prefix": "Extract verifier success criteria from /tests/test_outputs.py",
        "caption":        "Read the tests as spec. Seven tasks — query-optimize, openssl-selfsigned-cert, count-dataset-tokens, dna-assembly and more — fold into one rule: grep /tests/ before writing solution code. query-optimize and openssl-selfsigned-cert later solve at gen 7.",
        "featured":       [
            ("build-pmars",         "Building the pMARS Core War interpreter — a 1990s C codebase the bundle now learns to probe via its test fixtures first."),
        ],
    },
    5: {
        "insight_prefix": "When verifier_exit=0 AND agent_exit=0 AND native_score=0.0",
        "caption":        "Sharpening the diagnostic. count-dataset-tokens pins the signature — three zero exit codes plus score 0.0 is a schema mismatch, not a runtime crash — and solves this generation.",
        "featured":       [
            ("prove-plus-comm",     "Coq proof of plus_comm — a proof-assistant task where the verifier wants exact term shapes. The bundle's diagnostic recipe applies cleanly."),
            ("large-scale-text-editing", "Bulk text edits — silent zero scores until the agent verifies the output schema."),
        ],
    },
    6: {
        "insight_prefix": "After any in-place modification of a data structure or artifact file",
        "caption":        "Cache invalidation, cross-task. adaptive-rejection-sampler, protein-assembly and filter-js-from-html independently hit the same footgun: modifying state without re-querying yields stale reads. One rule distilled for the next agent.",
        "featured":       [],   # no newly solved this gen — bundle is consolidating
    },
    7: {
        "insight_prefix": "Before submitting output to verifier, instantiate and execute the verifier's validation operation locally",
        "caption":        "Run the verifier yourself. Synthesized from mteb-retrieve and db-wal-recovery: execute the verifier's own checks locally (sqlite3.connect, rdflib query, json.load) before submitting.",
        "featured":       [
            ("query-optimize",          "Query optimization — needs local execution of the verifier's sqlite/timing harness exactly as this insight prescribes."),
            ("openssl-selfsigned-cert", "Generating a self-signed cert — silent fails for 6 gens, then solved once the agent runs openssl's verify subcommand locally."),
            ("sanitize-git-repo",       "Sanitising a git repo — also stuck for 6 gens, also unblocked by local verifier execution."),
        ],
    },
    8: {
        "insight_prefix": "Cross-compilation and polyglot language tasks require shared-subset-grammar",
        "caption":        "The CompCert breakthrough. Distilled from the polyglot tasks (polyglot-c-py, polyglot-rust-c): cross-compilation needs a C89 shared-subset grammar. compile-compcert — stuck seven generations — reads the bundle and finally solves this gen.",
        "featured":       [
            ("compile-compcert",   "Compiling the CompCert verified C compiler — stuck across G1–G7 (7 failed generations), finally solved at G8 after this insight surfaces."),
        ],
    },
    9: {
        "insight_prefix": "Before implementing any task logic, extract verifier acceptance criteria from /tests/test.sh",
        "caption":        "Path-precision. caffe-cifar-10 shows hardcoded fixture paths are gate-keepers: character-for-character precision, or the task fails silently.",
        "featured":       [
            ("break-filter-js-from-html", "Bypass an HTML-to-JS filter — needs exact knowledge of the verifier's input/output paths to land."),
        ],
    },
    10: {
        "insight_prefix": "When verifier_exit=0 + reward=0.0 across 5+ consecutive generations",
        "caption":        "A meta-rule from four tasks. mteb-retrieve, db-wal-recovery, sparql-university and financial-document-processor share one signature — the same failure for 5+ generations means a missing diagnostic step, not a wrong algorithm.",
        "featured":       [],
    },
}


def _match_added(added: list[dict[str, Any]], prefix: str) -> dict[str, Any] | None:
    """Find the bundle-added insight whose text starts with `prefix` (case-insens).
    Returns the first match, or the first added item if none match."""
    if not added:
        return None
    norm_pref = (prefix or "").lower().strip()
    for it in added:
        text = (it.get("text") or "").strip().lower()
        if norm_pref and text.startswith(norm_pref):
            return it
    return added[0]


def _resolve_featured(featured: list[tuple[str, str]],
                      tasks: dict[str, Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for tid, note in featured:
        t = tasks.get(tid)
        if not t:
            continue
        per_gen = t.get("per_gen") or []
        first_solved = t.get("first_solved_gen")
        failed_gens = sorted({pg["gen"] for pg in per_gen
                              if not pg.get("resolved") and pg.get("gen") is not None
                              and (first_solved is None or pg["gen"] < first_solved)})
        out.append({
            "task_id":          tid,
            "first_solved_gen": first_solved,
            "category":         t.get("category", "") or "",
            "difficulty":       t.get("difficulty", "") or "",
            "failed_gens":      failed_gens,
            "n_failed_before_solve": len(failed_gens),
            "note":             note,
        })
    return out


def compute_highlights(payload: dict[str, Any],
                       knowledge: dict[str, Any] | None) -> dict[str, Any]:
    """Pick three exemplary tasks and three exemplary insights for the
    `tb2-haiku-summary` page. Heuristics:
    - tasks: resolved, first_solved_gen ∈ [3, 8], sort by (-gen, -n_failed).
    - insights: transferable_insights.added, confidence='high', evidence≥3,
                dedup by normalized text (keep earliest gen), then sort by
                evidence-count desc.
    """
    tasks = payload.get("tasks", {}) or {}

    # ---------- exemplary tasks
    task_candidates: list[dict[str, Any]] = []
    for tid, t in tasks.items():
        if not t.get("resolved"):
            continue
        fg = t.get("first_solved_gen")
        if fg is None or not (3 <= fg <= 8):
            continue
        per_gen = t.get("per_gen") or []
        failed = sorted({pg["gen"] for pg in per_gen
                         if not pg.get("resolved") and pg.get("gen") is not None and pg["gen"] < fg})
        task_candidates.append({
            "task_id":               tid,
            "first_solved_gen":      fg,
            "category":              t.get("category", "") or "",
            "difficulty":            t.get("difficulty", "") or "",
            "failed_gens":           failed,
            "n_failed_before_solve": len(failed),
        })
    task_candidates.sort(key=lambda x: (-x["first_solved_gen"], -x["n_failed_before_solve"], x["task_id"]))
    exemplary_tasks = task_candidates[:3]

    # ---------- exemplary insights
    exemplary_insights: list[dict[str, Any]] = []
    if knowledge:
        seen_norm: set[str] = set()
        all_high: list[dict[str, Any]] = []
        for slot in knowledge.get("generations", []) or []:
            gen   = slot.get("gen")
            delta = slot.get("cross_task_distill_delta") or {}
            added = (delta.get("transferable_insights") or {}).get("added") or []
            for it in added:
                if (it.get("confidence") or "").lower() != "high":
                    continue
                evidence = it.get("evidence") or []
                if len(evidence) < 3:
                    continue
                text = it.get("text") or it.get("insight") or ""
                norm = _norm_text(text)
                if not norm or norm in seen_norm:
                    continue
                seen_norm.add(norm)
                all_high.append({
                    "gen":            gen,
                    "confidence":     it.get("confidence"),
                    "evidence_count": len(evidence),
                    "section":        "transferable_insights",
                    "applies_when":   it.get("applies_when") or "",
                    "headline":       _first_sentence_py(text, 140),
                    "full_text":      text,
                })
        all_high.sort(key=lambda x: (-x["evidence_count"], x["gen"]))
        exemplary_insights = all_high[:3]

    # ---------- hand-curated per-gen picks (the summary page's centerpiece)
    per_gen_curated: list[dict[str, Any]] = []
    if knowledge:
        knowledge_by_gen = {
            slot.get("gen"): slot for slot in (knowledge.get("generations") or [])
        }
        newly_solved_by_gen: dict[int, set[str]] = {}
        for g in payload.get("generations", []) or []:
            ids = {n.get("task_id") for n in (g.get("newly_solved") or [])
                   if n.get("task_id")}
            newly_solved_by_gen[g.get("gen")] = ids

        for gen in sorted(PINNED_PER_GEN.keys()):
            pin = PINNED_PER_GEN[gen]
            slot = knowledge_by_gen.get(gen) or {}
            added = (((slot.get("cross_task_distill_delta") or {})
                      .get("transferable_insights") or {}).get("added") or [])
            insight = _match_added(added, pin.get("insight_prefix", ""))
            insight_payload: dict[str, Any] | None = None
            if insight:
                full_text = insight.get("text") or ""
                insight_payload = {
                    "headline":       _first_sentence_py(full_text, 160),
                    "full_text":      full_text,
                    "confidence":     insight.get("confidence"),
                    "evidence_count": len(insight.get("evidence") or []),
                    "applies_when":   insight.get("applies_when") or "",
                }
            featured = _resolve_featured(pin.get("featured") or [], tasks)
            per_gen_curated.append({
                "gen":      gen,
                "caption":  pin.get("caption", ""),
                "insight":  insight_payload,
                "featured": featured,
                # Also surface the raw newly_solved counts so the gen card can
                # honestly show "+5 solves, 1 highlighted" instead of pretending.
                "n_newly_solved": len(newly_solved_by_gen.get(gen, set())),
            })

    return {
        "exemplary_tasks":    exemplary_tasks,
        "exemplary_insights": exemplary_insights,
        "per_gen":            per_gen_curated,
    }


def emit_side_files(trials: list[dict[str, Any]], out_root: Path) -> tuple[int, int]:
    tx_root = out_root / "transcripts"
    tt_root = out_root / "tool_traces"
    n_tx = n_tt = 0
    for t in trials:
        tool_trace = t.get("_tool_trace") or []
        if not tool_trace:
            continue
        tid = t["task_id"]
        gen = t["generation"]
        (tx_root / tid).mkdir(parents=True, exist_ok=True)
        (tt_root / tid).mkdir(parents=True, exist_ok=True)
        transcript = _build_transcript(tool_trace, t.get("model_output_excerpt", {}).get("text"))
        if transcript:
            (tx_root / tid / f"gen{gen}.txt").write_text(
                transcript[:TRANSCRIPT_LIMIT], encoding="utf-8"
            )
            n_tx += 1
        (tt_root / tid / f"gen{gen}.json").write_text(
            json.dumps(tool_trace, indent=2), encoding="utf-8"
        )
        n_tt += 1
    return n_tx, n_tt


KNOWLEDGE_SECTIONS = (
    "transferable_insights",
    "confirmed_constraints",
    "rejected_hypotheses",
    "pitfalls",
    "checks",
    "next_steps",
)


def _norm_text(s: Any) -> str:
    """Normalize an insight text for delta diffing — lower, collapse whitespace,
    cap to 240 chars. Same heuristic used by the original Streamlit
    knowledge_panel."""
    if not isinstance(s, str):
        return ""
    return " ".join(s.lower().split())[:240]


def _item_text(item: Any) -> str:
    if isinstance(item, dict):
        return _safe_str(item.get("text") or item.get("insight") or item.get("statement") or "")
    if isinstance(item, str):
        return item
    return ""


def _diff_section(curr_items: list[Any], prev_items: list[Any]) -> dict[str, list[Any]]:
    prev_keys = {_norm_text(_item_text(it)) for it in prev_items if _item_text(it)}
    added, kept = [], []
    for it in curr_items:
        if not _item_text(it):
            continue
        if _norm_text(_item_text(it)) in prev_keys:
            kept.append(it)
        else:
            added.append(it)
    curr_keys = {_norm_text(_item_text(it)) for it in curr_items if _item_text(it)}
    removed = [it for it in prev_items
               if _item_text(it) and _norm_text(_item_text(it)) not in curr_keys]
    return {"added": added, "kept": kept, "removed": removed}


def build_knowledge(db_path: Path) -> dict[str, Any]:
    """Read distilled and raw knowledge from the run's knowledge SQLite.

    Emits a shape consumable by the Knowledge tab and a per-task lookup used
    by the per-task drill-in. Only entries with non-null parseable JSON content
    are surfaced.
    """
    con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    try:
        rows = con.execute(
            "SELECT generation, task_id, agent_id, entry_type, source_phase, content "
            "FROM knowledge WHERE entry_type IN ('distillation', 'insight') ORDER BY generation, id"
        ).fetchall()
    except sqlite3.DatabaseError:
        rows = []
    finally:
        con.close()

    def _safe_parse(c: str | None) -> Any:
        if not c:
            return None
        try:
            return json.loads(c)
        except (TypeError, json.JSONDecodeError):
            return None

    per_gen: dict[int, dict[str, Any]] = {}
    per_task: dict[str, list[dict[str, Any]]] = defaultdict(list)
    raw_insights_by_gen: dict[int, list[dict[str, Any]]] = defaultdict(list)

    for gen, task_id, agent_id, entry_type, source_phase, content in rows:
        parsed = _safe_parse(content)
        if entry_type == "distillation":
            slot = per_gen.setdefault(gen, {
                "gen": gen,
                "cross_task_distill": None,
                "per_task_distill_count": 0,
                "per_task_distill_summaries": [],
            })
            if source_phase == "cross_task_distill" and isinstance(parsed, dict):
                slot["cross_task_distill"] = parsed
            elif source_phase == "per_task_distill" and isinstance(parsed, dict):
                slot["per_task_distill_count"] += 1
                if len(slot["per_task_distill_summaries"]) < 200:
                    slot["per_task_distill_summaries"].append({
                        "task_id": task_id,
                        "n_insights": len(parsed.get("transferable_insights") or []),
                        "n_constraints": len(parsed.get("confirmed_constraints") or []),
                        "n_pitfalls": len(parsed.get("pitfalls") or []),
                        "n_checks": len(parsed.get("checks") or []),
                        "bundle": parsed,
                    })
                per_task[task_id].append({"gen": gen, "bundle": parsed})
        elif entry_type == "insight" and isinstance(parsed, dict):
            text = parsed.get("text") or parsed.get("insight")
            if text:
                raw_insights_by_gen[gen].append({
                    "gen": gen, "task_id": task_id, "agent_id": agent_id,
                    "text": text[:1200],
                })

    generations = []
    prev_bundle: dict[str, Any] | None = None
    for gen, slot in sorted(per_gen.items()):
        slot["n_raw_insights"] = len(raw_insights_by_gen.get(gen, []))
        curr_bundle = slot.get("cross_task_distill") or {}
        delta: dict[str, dict[str, list[Any]]] = {}
        for section in KNOWLEDGE_SECTIONS:
            curr_list = curr_bundle.get(section) if isinstance(curr_bundle.get(section), list) else []
            prev_list = prev_bundle.get(section) if (prev_bundle and isinstance(prev_bundle.get(section), list)) else []
            delta[section] = _diff_section(curr_list, prev_list)
        slot["cross_task_distill_delta"] = delta
        slot["delta_counts"] = {
            section: {"added": len(d["added"]), "kept": len(d["kept"]), "removed": len(d["removed"])}
            for section, d in delta.items()
        }
        generations.append(slot)
        prev_bundle = curr_bundle if curr_bundle else prev_bundle
    return {
        "generations": generations,
        "raw_insights_sample": {
            gen: raw_insights_by_gen[gen][:40] for gen in sorted(raw_insights_by_gen)
        },
        "per_task": dict(per_task),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True,
                        help="Path to the campaign tb2.json file (the aggregate).")
    parser.add_argument("--out", type=Path, required=True,
                        help="Output path for tb2_haiku.json. Side files go to its parent dir.")
    parser.add_argument("--knowledge-db", type=Path, default=None,
                        help="Optional path to the run's knowledge SQLite. "
                             "Enables Knowledge tab content.")
    parser.add_argument("--experiment", default="tb2_haiku_20260505b")
    parser.add_argument("--model", default="claude-haiku-4-5-20251001")
    parser.add_argument("--price-input",          type=float, default=PRICE_DEFAULTS["input"])
    parser.add_argument("--price-output",         type=float, default=PRICE_DEFAULTS["output"])
    parser.add_argument("--price-cache-read",     type=float, default=PRICE_DEFAULTS["cache_read"])
    parser.add_argument("--price-cache-creation", type=float, default=PRICE_DEFAULTS["cache_creation"])
    args = parser.parse_args(argv)

    if not args.input.exists():
        print(f"error: input {args.input} does not exist", file=sys.stderr)
        return 2

    price = {
        "input":          args.price_input,
        "output":         args.price_output,
        "cache_read":     args.price_cache_read,
        "cache_creation": args.price_cache_creation,
    }

    print(f"loading {args.input} ({args.input.stat().st_size/1024/1024:.0f} MB)…",
          file=sys.stderr, flush=True)
    with args.input.open() as f:
        doc = json.load(f)
    traces = doc.get("traces") if isinstance(doc, dict) else None
    if not isinstance(traces, list) or not traces:
        print("error: no traces[] in input", file=sys.stderr)
        return 3
    args_section = doc.get("args") if isinstance(doc.get("args"), dict) else {}

    payload, normalized = build_payload(
        traces, args_section,
        experiment=args.experiment, model=args.model, price=price,
    )
    args.out.parent.mkdir(parents=True, exist_ok=True)
    n_tx, n_tt = emit_side_files(normalized, args.out.parent)

    # Build the knowledge bundle *before* writing the dashboard JSON so we can
    # inject the `highlights` block (which depends on both payload + knowledge).
    n_kn_gens = 0
    knowledge: dict[str, Any] | None = None
    if args.knowledge_db and args.knowledge_db.exists():
        knowledge = build_knowledge(args.knowledge_db)
        (args.out.parent / "knowledge.json").write_text(
            json.dumps(knowledge, indent=2), encoding="utf-8"
        )
        n_kn_gens = len(knowledge["generations"])

    payload["highlights"] = compute_highlights(payload, knowledge)
    args.out.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    k = payload["kpis"]
    hl = payload["highlights"]
    print(
        f"wrote {args.out}\n"
        f"  tasks   = {payload['total_tasks']}\n"
        f"  traces  = {payload['total_traces']}\n"
        f"  solved  = {k['solved']} ({k['solved_pct']}%)\n"
        f"  macro%  = {k['macro_pass_pct']}\n"
        f"  cost    = ${k['cost_usd_total']:,}\n"
        f"  gens    = {len(payload['generations'])}\n"
        f"  knowledge gens = {n_kn_gens}\n"
        f"  side    = {n_tx} transcripts, {n_tt} tool_trace files\n"
        f"  highlights = {len(hl['exemplary_tasks'])} tasks, {len(hl['exemplary_insights'])} insights",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
