#!/usr/bin/env python3
"""Build the static ARC Haiku dashboard payload.

Reads a Knowledge-Centric ARC campaign artifact tree (the swarms.cli output for
``--task-source arc``). The expected canonical input is the aggregate JSON
written by the campaign runner, e.g.::

    results/baseline_sweep_haiku_20260505b/arc1.json

The shape mirrors the TB2 builder; the differences are ARC-specific extractors:

  - Reward is ``eval_result.arc_pass_ratio`` (∈[0,1]); ``resolved`` is true iff
    every ``arc_per_test[i].correct`` is true.
  - The agent's predicted grids are recorded as ``tool_input.grid`` on every
    ``arc_set_output_grid`` tool-call. With ``arc_max_trials=2`` there are up
    to two attempts per test.
  - The task's train pairs and test input(s) live in ``TASK.md``, which the
    agent always Reads first — its tool_output is parsed once per task.

Ground-truth ARC outputs are pulled from the source data tree (see
``--arc-source``) and used to mark each predicted grid as correct/wrong.

Outputs (under ``--out`` parent dir)::

    arc1_haiku.json              # dashboard payload
    arc1_knowledge.json          # per-gen distillation deltas
    arc1_transcripts/<task>/gen<N>.txt   # narrative
"""

from __future__ import annotations

import argparse
import json
import re
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

STEP_SUMMARY_LIMIT = 200
STEP_SUMMARIES_PER_TRIAL = 6
TRANSCRIPT_LIMIT = 600_000


# ---------------------------------------------------------------- generic helpers

def _safe_str(x: Any) -> str:
    if x is None:
        return ""
    return x if isinstance(x, str) else str(x)


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


# ---------------------------------------------------------------- ARC-specific

LINE_PREFIX_RE = re.compile(r"(?m)^\s*\d+→")


def _strip_line_prefixes(text: str) -> str:
    """The agent's Read tool wraps lines as ``    N→<content>``. Drop the prefix."""
    return LINE_PREFIX_RE.sub("", text or "")


def _balanced_json_arrays(text: str) -> list[Any]:
    """Pull every top-level ``[...]`` array via bracket balancing, parse with
    ``json.loads``. Used to extract train/test grids from TASK.md content
    without depending on the exact section headers."""
    out: list[Any] = []
    i = 0
    n = len(text)
    while i < n:
        if text[i] == "[":
            depth = 0
            j = i
            while j < n:
                c = text[j]
                if c == "[":
                    depth += 1
                elif c == "]":
                    depth -= 1
                    if depth == 0:
                        chunk = text[i:j + 1]
                        try:
                            out.append(json.loads(chunk))
                        except (json.JSONDecodeError, ValueError):
                            pass
                        i = j + 1
                        break
                j += 1
            else:
                break
        else:
            i += 1
    return out


def _extract_task_grids(trace_obj: dict[str, Any]) -> tuple[list[dict], list[Any]]:
    """From a trial's tool_trace, find the first Read of TASK.md and parse
    train pairs + test inputs out of it. Returns ``(train_pairs, test_inputs)``
    where each train_pair is ``{"input": grid, "output": grid}`` and each test
    input is just a grid."""
    task_md = ""
    for s in trace_obj.get("tool_trace", []):
        if not isinstance(s, dict):
            continue
        if s.get("tool_name") != "Read":
            continue
        fp = s.get("file_path") or s.get("read_file_path") or ""
        if fp.endswith("/TASK.md") or fp.endswith("TASK.md"):
            task_md = s.get("tool_output") or ""
            break
    if not task_md:
        return [], []
    cleaned = _strip_line_prefixes(task_md)
    arrs = _balanced_json_arrays(cleaned)
    train_pairs: list[dict] = []
    test_inputs: list[Any] = []
    # First top-level array of dicts with both 'input' and 'output' → train.
    # Next array of dicts with 'input' (no/empty output) → test.
    for a in arrs:
        if not isinstance(a, list) or not a:
            continue
        first = a[0]
        if isinstance(first, dict) and "input" in first:
            if not train_pairs and any("output" in p and p.get("output") for p in a):
                train_pairs = [
                    {"input": p["input"], "output": p["output"]}
                    for p in a if isinstance(p, dict) and "input" in p and "output" in p
                ]
            elif not test_inputs:
                test_inputs = [p["input"] for p in a if isinstance(p, dict) and "input" in p]
        elif isinstance(first, list):
            # Bare grid: a single test input grid.
            if not test_inputs:
                test_inputs = [a]
    return train_pairs, test_inputs


def _extract_attempt_grids(trace_obj: dict[str, Any]) -> list[list[list[int]]]:
    """Collect every grid the agent submitted via ``arc_set_output_grid``,
    in call order."""
    out: list[list[list[int]]] = []
    for s in trace_obj.get("tool_trace", []):
        if not isinstance(s, dict):
            continue
        if s.get("tool_name") != "arc_set_output_grid":
            continue
        ti = s.get("tool_input") or {}
        g = ti.get("grid")
        if isinstance(g, list) and g and isinstance(g[0], list):
            out.append(g)
    return out


def _extract_assistant_summaries(trace_obj: dict[str, Any], limit: int = STEP_SUMMARIES_PER_TRIAL,
                                 char_limit: int = STEP_SUMMARY_LIMIT) -> list[str]:
    """For arc trials the agent has no ``summary`` field on tool calls, so use
    the first chars of each assistant turn's text as the narrative digest."""
    out: list[str] = []
    for s in trace_obj.get("tool_trace", []):
        if not isinstance(s, dict) or s.get("type") != "assistant":
            continue
        # Plotly-style payload — try a few likely fields.
        text = (s.get("text")
                or s.get("content")
                or s.get("message")
                or "")
        if not isinstance(text, str):
            # Anthropic-style: content blocks list of {type, text}
            text = ""
            if isinstance(s.get("content"), list):
                for blk in s["content"]:
                    if isinstance(blk, dict) and blk.get("type") == "text" and isinstance(blk.get("text"), str):
                        text += blk["text"]
        text = (text or "").strip().replace("\n", " ")
        if not text:
            continue
        if len(text) > char_limit:
            text = text[:char_limit].rstrip() + "…"
        out.append(text)
        if len(out) >= limit:
            break
    return out


def _grids_equal(a: list[list[int]] | None, b: list[list[int]] | None) -> bool:
    if not isinstance(a, list) or not isinstance(b, list):
        return False
    if len(a) != len(b):
        return False
    for ra, rb in zip(a, b):
        if not isinstance(ra, list) or not isinstance(rb, list) or len(ra) != len(rb):
            return False
        if ra != rb:
            return False
    return True


def _load_ground_truth(task_id: str, arc_source_dir: Path) -> list[list[list[int]]] | None:
    """Return list of expected output grids for the task's test set, or None."""
    p = arc_source_dir / f"{task_id}.json"
    if not p.exists():
        return None
    try:
        d = json.loads(p.read_text())
    except (OSError, json.JSONDecodeError):
        return None
    tests = d.get("test") or []
    return [t.get("output") for t in tests if isinstance(t, dict) and t.get("output")]


def _attempt_correctness(attempt: list[list[int]], expected: list[list[list[int]]] | None) -> bool | None:
    """True if attempt matches any test output; False if it matches none;
    None if no ground truth available."""
    if not expected:
        return None
    for exp in expected:
        if _grids_equal(attempt, exp):
            return True
    return False


def _grid_shape(grid: list[list[int]] | None) -> str:
    if not isinstance(grid, list) or not grid or not isinstance(grid[0], list):
        return "?"
    return f"{len(grid)}×{len(grid[0])}"


# ---------------------------------------------------------------- per-gen summary

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


# ---------------------------------------------------------------- payload builder

def build_payload(traces: list[dict[str, Any]], args_section: dict[str, Any],
                  *, experiment: str, model: str, price: dict[str, float],
                  arc_source_dir: Path) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    by_task: dict[str, list[dict[str, Any]]] = defaultdict(list)
    by_gen:  dict[int, list[dict[str, Any]]] = defaultdict(list)

    # Cache: task_id → (train_pairs, test_inputs, ground_truth)
    task_grids: dict[str, tuple[list, list, list | None]] = {}

    normalized: list[dict[str, Any]] = []
    for raw in traces:
        er = raw.get("eval_result") if isinstance(raw.get("eval_result"), dict) else {}
        rt = raw.get("runtime_meta") if isinstance(raw.get("runtime_meta"), dict) else {}
        task_id = _safe_str(raw.get("task_id")) or "<unknown>"
        # Extract grids the first time we see this task.
        if task_id not in task_grids:
            train_pairs, test_inputs = _extract_task_grids(raw)
            ground_truth = _load_ground_truth(task_id, arc_source_dir)
            task_grids[task_id] = (train_pairs, test_inputs, ground_truth)
        train_pairs, test_inputs, ground_truth = task_grids[task_id]

        reward = er.get("arc_pass_ratio")
        if reward is None:
            reward = er.get("native_score")
        try:
            reward = None if reward is None else float(reward)
        except (TypeError, ValueError):
            reward = None
        resolved = bool(er.get("resolved")) or (reward is not None and reward >= 1.0)
        tokens = _tokens_from_trace(raw)

        attempts = _extract_attempt_grids(raw)
        attempts_with_marks = []
        for grid in attempts:
            attempts_with_marks.append({
                "grid":    grid,
                "shape":   _grid_shape(grid),
                "correct": _attempt_correctness(grid, ground_truth),
            })

        # status classification
        if resolved:
            status = "resolved"
        elif (raw.get("error") or rt.get("status") == "error" or
              er.get("status") == "error"):
            status = "infra"
        elif not er.get("arc_per_test"):
            status = "infra"
        else:
            status = "failed"

        trial = {
            "task_id":    task_id,
            "generation": int(raw.get("generation") or 1),
            "agent_id":   _safe_str(raw.get("agent_id")),
            "reward":     reward,
            "resolved":   resolved,
            "status":     status,
            "trial_status": _safe_str(er.get("status") or rt.get("status") or "unknown"),
            "error":      _safe_str(raw.get("error") or rt.get("error") or ""),
            "tokens":     tokens,
            "cost_usd":   round(_cost_usd(tokens, price), 4),
            "n_actions":  sum(1 for s in raw.get("tool_trace", []) if isinstance(s, dict) and s.get("type") == "tool_call"),
            "n_tool_calls": _count_tool_kinds(raw.get("tool_trace", [])),
            "step_summaries": _extract_assistant_summaries(raw),
            "attempts":   attempts_with_marks,
            "_tool_trace": raw.get("tool_trace") if isinstance(raw.get("tool_trace"), list) else [],
        }
        normalized.append(trial)
        by_task[trial["task_id"]].append(trial)
        by_gen[trial["generation"]].append(trial)

    total_tasks = len(by_task)

    # Best-so-far reward per task at each gen.
    all_gens = sorted(by_gen)
    best_so_far: dict[int, dict[str, float]] = {g: {} for g in all_gens}
    for tid, trials in by_task.items():
        trials.sort(key=lambda t: t["generation"])
        running_best: float | None = None
        for g in all_gens:
            here = [t for t in trials if t["generation"] == g]
            if here:
                top = max((t["reward"] for t in here if t["reward"] is not None), default=None)
                if top is not None:
                    running_best = top if running_best is None else max(running_best, top)
            best_so_far[g][tid] = running_best if running_best is not None else 0.0

    # Per-task payload
    tasks_payload: dict[str, Any] = {}
    total_tokens = {"input": 0, "output": 0, "cache_read": 0, "cache_creation": 0}
    resolved_count = 0
    rewards_for_macro: list[float] = []

    for tid, trials in by_task.items():
        sorted_trials = sorted(trials, key=lambda t: t["generation"])
        first_solved_gen = next((t["generation"] for t in sorted_trials if t["resolved"]), None)
        best = max(sorted_trials, key=lambda t: (
            1 if t["resolved"] else 0,
            t["reward"] if t["reward"] is not None else -1.0,
            -t["generation"],
        ))
        if best["resolved"]:
            resolved_count += 1
        rewards_for_macro.append(best["reward"] if best["reward"] is not None else 0.0)
        task_tokens = {"input": 0, "output": 0, "cache_read": 0, "cache_creation": 0}
        per_gen_records: list[dict[str, Any]] = []
        for tr in sorted_trials:
            for k in task_tokens:
                task_tokens[k] += tr["tokens"].get(k, 0)
            per_gen_records.append({
                "gen": tr["generation"],
                "resolved": tr["resolved"],
                "reward":   tr["reward"],
                "error":    tr["error"],
                "n_actions": tr["n_actions"],
                "step_summaries": tr["step_summaries"],
                "attempts": tr["attempts"],
                "has_transcript": bool(tr["_tool_trace"]),
                "transcript_path": (
                    f"arc1_transcripts/{tr['task_id']}/gen{tr['generation']}.txt"
                    if tr["_tool_trace"] else None
                ),
            })
        for k in total_tokens:
            total_tokens[k] += task_tokens[k]
        train_pairs, test_inputs, _gt = task_grids[tid]
        test_shape = _grid_shape(test_inputs[0]) if test_inputs else "?"
        tasks_payload[tid] = {
            "first_solved_gen": first_solved_gen,
            "best_reward":     best["reward"],
            "best_generation": best["generation"],
            "resolved":        best["resolved"],
            "status":          "resolved" if best["resolved"] else best["status"],
            "trial_status":    best["trial_status"],
            "grid_shape":      test_shape,
            "n_train_pairs":   len(train_pairs),
            "n_test_inputs":   len(test_inputs),
            "train_pairs":     train_pairs,
            "test_inputs":     test_inputs,
            "tokens":          task_tokens,
            "cost_usd":        round(_cost_usd(task_tokens, price), 4),
            "per_gen":         per_gen_records,
        }

    # Newly-solved per gen.
    newly_solved_by_gen: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for tid, t in tasks_payload.items():
        fg = t.get("first_solved_gen")
        if fg is not None:
            newly_solved_by_gen[fg].append({
                "task_id":    tid,
                "category":   t.get("grid_shape", ""),
                "difficulty": f"{t.get('n_train_pairs', '?')} train",
            })

    generations_rows = _per_gen_summary(by_gen, best_so_far, total_tasks)
    for row in generations_rows:
        row["newly_solved"] = newly_solved_by_gen.get(row["gen"], [])

    # Run-at-a-glance aggregates.
    total_actions = 0
    by_tool_counter: Counter[str] = Counter()
    n_trials_traced = 0
    for trial in normalized:
        tt = trial["_tool_trace"]
        if not tt:
            continue
        n_trials_traced += 1
        for s in tt:
            if not isinstance(s, dict) or s.get("type") != "tool_call":
                continue
            tn = _safe_str(s.get("tool_name") or "other")
            by_tool_counter[tn] += 1
            total_actions += 1
    top_kinds = by_tool_counter.most_common(4)
    run_summary = {
        "total_actions":      total_actions,
        "avg_actions_per_task": round(total_actions / n_trials_traced, 1) if n_trials_traced else 0.0,
        "n_trials_with_trace": n_trials_traced,
        "top_kinds": [
            {"kind": k, "count": c, "pct": round(c / total_actions, 4) if total_actions else 0.0}
            for k, c in top_kinds
        ],
    }

    total_cost = _cost_usd(total_tokens, price)
    macro_pass_ratio = (sum(rewards_for_macro) / total_tasks) if total_tasks else 0.0
    return {
        "experiment": experiment,
        "model":      model,
        "benchmark":  "arc1",
        "total_tasks":  total_tasks,
        "total_traces": len(traces),
        "args_summary": {
            "generations":           args_section.get("generations"),
            "max_concurrent_tasks":  args_section.get("max_concurrent_tasks"),
            "per_task_forum_rounds": args_section.get("per_task_forum_rounds"),
            "cross_task_forum_rounds": args_section.get("cross_task_forum_rounds"),
            "distill_enabled":       args_section.get("distill_enabled"),
            "drop_solved":           args_section.get("drop_solved"),
            "arc_max_trials":        args_section.get("arc_max_trials"),
            "seed":                  args_section.get("seed"),
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
            "cost_usd_total":    round(total_cost, 2),
            "cost_usd_per_task": round(total_cost / total_tasks, 2) if total_tasks else 0.0,
        },
        "generations": generations_rows,
        "run_summary": run_summary,
        "tasks":       tasks_payload,
        "price_model": price,
    }, normalized


def _count_tool_kinds(trace_list: list[Any]) -> dict[str, int]:
    by = Counter()
    for s in trace_list:
        if isinstance(s, dict) and s.get("type") == "tool_call":
            by[_safe_str(s.get("tool_name") or "other")] += 1
    return dict(by)


# ---------------------------------------------------------------- transcripts side-files

TOOL_OUTPUT_LIMIT = 4000


def _build_transcript(trace_list: list[Any], step_summaries: list[str]) -> str:
    lines: list[str] = []
    if not isinstance(trace_list, list):
        return ""
    for i, step in enumerate(trace_list, 1):
        if not isinstance(step, dict):
            continue
        tn = _safe_str(step.get("tool_name") or step.get("type") or "step")
        ti = step.get("tool_input") if isinstance(step.get("tool_input"), dict) else {}
        to = step.get("tool_output") if isinstance(step.get("tool_output"), dict) else {}
        lines.append(f"── step {i:>3} · {tn} ──")
        if isinstance(ti, dict):
            for k, v in ti.items():
                if k == "grid":
                    rows = len(v) if isinstance(v, list) else "?"
                    cols = len(v[0]) if rows and isinstance(v[0], list) else "?"
                    lines.append(f"  {k}: <{rows}x{cols} grid>")
                else:
                    s = _safe_str(v)
                    if len(s) > 200:
                        s = s[:200] + "…"
                    lines.append(f"  {k}: {s}")
        if isinstance(to, dict):
            out = _safe_str(to.get("stdout") or to.get("content") or "")
            if out:
                chunk = out if len(out) <= TOOL_OUTPUT_LIMIT else (out[:TOOL_OUTPUT_LIMIT] + f"\n…[+{len(out)-TOOL_OUTPUT_LIMIT} bytes truncated]")
                lines.append(chunk.rstrip())
        elif isinstance(step.get("tool_output"), str):
            out = _safe_str(step.get("tool_output"))
            if out:
                chunk = out if len(out) <= TOOL_OUTPUT_LIMIT else (out[:TOOL_OUTPUT_LIMIT] + f"\n…[+{len(out)-TOOL_OUTPUT_LIMIT} bytes truncated]")
                lines.append(chunk.rstrip())
        lines.append("")
    return "\n".join(lines)


def emit_side_files(trials: list[dict[str, Any]], out_root: Path) -> int:
    tx_root = out_root / "arc1_transcripts"
    n = 0
    for t in trials:
        tt = t.get("_tool_trace") or []
        if not tt:
            continue
        (tx_root / t["task_id"]).mkdir(parents=True, exist_ok=True)
        transcript = _build_transcript(tt, t["step_summaries"])
        if transcript:
            (tx_root / t["task_id"] / f"gen{t['generation']}.txt").write_text(
                transcript[:TRANSCRIPT_LIMIT], encoding="utf-8"
            )
            n += 1
    return n


# ---------------------------------------------------------------- knowledge (reused from TB2)

KNOWLEDGE_SECTIONS = (
    "transferable_insights", "confirmed_constraints", "rejected_hypotheses",
    "pitfalls", "checks", "next_steps",
)


def _norm_text(s: Any) -> str:
    if not isinstance(s, str):
        return ""
    return " ".join(s.lower().split())[:240]


def _item_text(it: Any) -> str:
    if isinstance(it, dict):
        return _safe_str(it.get("text") or it.get("insight") or it.get("statement") or "")
    if isinstance(it, str):
        return it
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
    con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    try:
        rows = con.execute(
            "SELECT generation, task_id, agent_id, entry_type, source_phase, content "
            "FROM knowledge WHERE entry_type IN ('distillation','insight') ORDER BY generation, id"
        ).fetchall()
    except sqlite3.DatabaseError:
        rows = []
    finally:
        con.close()

    def parse(c):
        if not c: return None
        try: return json.loads(c)
        except (TypeError, json.JSONDecodeError): return None

    per_gen: dict[int, dict[str, Any]] = {}
    per_task: dict[str, list[dict[str, Any]]] = defaultdict(list)
    raw_insights_by_gen: dict[int, list[dict[str, Any]]] = defaultdict(list)

    for gen, task_id, agent_id, et, sp, content in rows:
        parsed = parse(content)
        if et == "distillation":
            slot = per_gen.setdefault(gen, {
                "gen": gen, "cross_task_distill": None,
                "per_task_distill_count": 0, "per_task_distill_summaries": [],
            })
            if sp == "cross_task_distill" and isinstance(parsed, dict):
                slot["cross_task_distill"] = parsed
            elif sp == "per_task_distill" and isinstance(parsed, dict):
                slot["per_task_distill_count"] += 1
                if len(slot["per_task_distill_summaries"]) < 200:
                    slot["per_task_distill_summaries"].append({
                        "task_id": task_id, "bundle": parsed,
                    })
                per_task[task_id].append({"gen": gen, "bundle": parsed})
        elif et == "insight" and isinstance(parsed, dict):
            tx = parsed.get("text") or parsed.get("insight")
            if tx:
                raw_insights_by_gen[gen].append({
                    "gen": gen, "task_id": task_id, "agent_id": agent_id, "text": tx[:1200],
                })

    generations: list[dict[str, Any]] = []
    prev_bundle: dict[str, Any] | None = None
    for gen, slot in sorted(per_gen.items()):
        slot["n_raw_insights"] = len(raw_insights_by_gen.get(gen, []))
        curr_bundle = slot.get("cross_task_distill") or {}
        delta: dict[str, Any] = {}
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


# ---------------------------------------------------------------- ARC highlights

def _first_sentence_py(s: str, max_chars: int = 140) -> str:
    if not s:
        return ""
    cleaned = " ".join(s.split())
    if len(cleaned) <= max_chars:
        return cleaned
    window = cleaned[: max_chars + 1]
    cut = max(window.rfind(" "), window.rfind(","), window.rfind(";"))
    if cut < 40:
        cut = max_chars
    return cleaned[:cut].rstrip(" ,;") + "..."


ARC_PINNED_PER_GEN: dict[int, dict[str, Any]] = {
    1: {
        "insight_prefix": "Before testing spatial transformations",
        "caption": "The first bundle is broad because generation 1 solves many easy-to-medium ARC puzzles. The useful theme is not a single trick, but an ordering: find separators and regions before trying rotations or reflections.",
        "featured": [("780d0b14", "A large separator-grid puzzle: the trace is a clean example of treating blank rows and columns as structure, then reading the regions they define.")],
    },
    2: {
        "insight_prefix": "Before applying any inferred transformation rule",
        "caption": "Generation 2 tightens the loop from visual guessing to executable validation. The bundle starts insisting that every proposed rule be run against all training pairs before touching the test grid.",
        "featured": [("05f2a901", "A compact three-example puzzle where the important asset is the validation habit: a plausible rule is only useful after it reproduces every training output.")],
    },
    3: {
        "insight_prefix": "For grid tasks involving sparse markers",
        "caption": "The summary starts moving from generic validation toward ARC-specific primitives: sparse markers, bounding boxes, and positions as lookup keys.",
        "featured": [("ea32f347", "A four-example puzzle that benefits from comparing explicit grid properties across examples instead of reading one pattern by eye.")],
    },
    4: {
        "insight_prefix": "When inferring region-based rules",
        "caption": "Generation 4 makes region extraction more explicit. The asset is to enumerate disconnected regions first, then test color or fill rules on those extracted objects.",
        "featured": [("caa06a1f", "The newly solved puzzle is a good anchor for the region-first framing: extract the pieces, then validate the rule over the full training set.")],
    },
    5: {
        "insight_prefix": "For region-classification tasks",
        "caption": "Generation 5 consolidates the object view: connected components, bounding boxes, and feature tables become the reusable vocabulary for harder grid transformations.",
        "featured": [("6455b5f5", "A multi-example puzzle where flood-fill style component extraction is the useful transferable operation, not just the final answer.")],
    },
    6: {
        "insight_prefix": "Extract signed displacement vectors",
        "caption": "No new puzzles solve in generation 6, but the bundle still changes: it records movement as signed displacement vectors instead of vague spatial language.",
        "featured": [],
    },
    7: {
        "insight_prefix": "Dynamically locate separator row",
        "caption": "Generation 7 turns repeated separator failures into a more operational rule: locate structure from the current grid, not from hard-coded row or column indices.",
        "featured": [("dc0a314f", "A 16x16 puzzle where the representative lesson is dynamic structural detection before applying the transformation.")],
    },
    8: {
        "insight_prefix": "For same-row neighbor detection",
        "caption": "With no new solves, the bundle sharpens implementation details. Neighbor detection is no longer prose; it becomes row-equality and column-equality tests.",
        "featured": [],
    },
    9: {
        "insight_prefix": "Same-row/column neighbor filtering",
        "caption": "Generation 9 keeps the focus on making spatial primitives executable: same-row and same-column relations must be checked directly before expansion or fill rules are trusted.",
        "featured": [],
    },
    10: {
        "insight_prefix": "For grid-expansion or directional-fill tasks",
        "caption": "The final bundle reads more like an ARC workbench: validation gates, separator scans, component extraction, marker loops, and truth tables rather than a single headline trick.",
        "featured": [],
    },
}


def _match_added(added: list[Any], prefix: str) -> dict[str, Any] | None:
    if not added:
        return None
    norm_pref = (prefix or "").lower().strip()
    for it in added:
        if not isinstance(it, dict):
            continue
        text = (it.get("text") or it.get("insight") or "").strip().lower()
        if norm_pref and text.startswith(norm_pref):
            return it
    for it in added:
        if isinstance(it, dict):
            return it
    return None


def _resolve_featured(featured: list[tuple[str, str]],
                      tasks: dict[str, Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for tid, note in featured[:1]:
        t = tasks.get(tid)
        if not t:
            continue
        per_gen = t.get("per_gen") or []
        fg = t.get("first_solved_gen")
        failed = sorted({pg["gen"] for pg in per_gen
                         if not pg.get("resolved") and pg.get("gen") is not None
                         and fg is not None and pg["gen"] < fg})
        out.append({
            "task_id": tid,
            "category": t.get("grid_shape", "") or "",
            "difficulty": f"{t.get('n_train_pairs', '?')} train",
            "first_solved_gen": fg,
            "n_failed_before_solve": len(failed),
            "note": note,
        })
    return out


def compute_highlights(payload: dict[str, Any],
                       knowledge: dict[str, Any] | None) -> dict[str, Any]:
    tasks = payload.get("tasks", {}) or {}
    per_gen_curated: list[dict[str, Any]] = []

    knowledge_by_gen = {
        slot.get("gen"): slot for slot in ((knowledge or {}).get("generations") or [])
    }
    newly_solved_by_gen = {
        row.get("gen"): {n.get("task_id") for n in (row.get("newly_solved") or [])
                         if n.get("task_id")}
        for row in payload.get("generations", []) or []
    }

    for gen in sorted(ARC_PINNED_PER_GEN):
        pin = ARC_PINNED_PER_GEN[gen]
        slot = knowledge_by_gen.get(gen) or {}
        delta = slot.get("cross_task_distill_delta") or {}
        added = ((delta.get("transferable_insights") or {}).get("added") or [])
        insight = _match_added(added, pin.get("insight_prefix", ""))
        insight_payload: dict[str, Any] | None = None
        if insight:
            full_text = insight.get("text") or insight.get("insight") or ""
            insight_payload = {
                "headline": _first_sentence_py(full_text, 160),
                "full_text": full_text,
                "confidence": insight.get("confidence"),
                "evidence_count": len(insight.get("evidence") or []),
                "applies_when": insight.get("applies_when") or "",
            }
        per_gen_curated.append({
            "gen": gen,
            "caption": pin.get("caption", ""),
            "insight": insight_payload,
            "featured": _resolve_featured(pin.get("featured") or [], tasks),
            "n_newly_solved": len(newly_solved_by_gen.get(gen, set())),
        })

    return {
        "per_gen": per_gen_curated,
        "curated": True,
    }


# ---------------------------------------------------------------- entry point

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True,
                        help="Path to arc1.json (campaign aggregate).")
    parser.add_argument("--out", type=Path, required=True,
                        help="Output path for the dashboard JSON.")
    parser.add_argument("--knowledge-db", type=Path, default=None,
                        help="Optional knowledge SQLite for the curated bundle.")
    parser.add_argument("--arc-source", type=Path,
                        default=Path("/home/amanda/Multi-Agentic/swarms/benchmarks/arc1/source/data/training"),
                        help="Directory containing ground-truth ARC task JSONs.")
    parser.add_argument("--experiment", default="arc1_haiku_20260505b")
    parser.add_argument("--model", default="claude-haiku-4-5-20251001")
    parser.add_argument("--knowledge-out-name", default="arc1_knowledge.json",
                        help="Filename for the knowledge.json side-file.")
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
    doc = json.loads(args.input.read_text())
    traces = doc.get("traces") if isinstance(doc, dict) else None
    if not isinstance(traces, list) or not traces:
        print("error: no traces[] in input", file=sys.stderr)
        return 3
    args_section = doc.get("args") if isinstance(doc.get("args"), dict) else {}

    payload, normalized = build_payload(
        traces, args_section,
        experiment=args.experiment, model=args.model, price=price,
        arc_source_dir=args.arc_source,
    )
    args.out.parent.mkdir(parents=True, exist_ok=True)
    n_tx = emit_side_files(normalized, args.out.parent)

    n_kn_gens = 0
    knowledge: dict[str, Any] | None = None
    if args.knowledge_db and args.knowledge_db.exists():
        knowledge = build_knowledge(args.knowledge_db)
        (args.out.parent / args.knowledge_out_name).write_text(
            json.dumps(knowledge, indent=2), encoding="utf-8"
        )
        n_kn_gens = len(knowledge["generations"])

    payload["highlights"] = compute_highlights(payload, knowledge)
    args.out.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    k = payload["kpis"]
    n_grids = sum(len(t.get("attempts", [])) for t in normalized)
    hl = payload["highlights"]
    print(
        f"wrote {args.out}\n"
        f"  tasks   = {payload['total_tasks']}\n"
        f"  traces  = {payload['total_traces']}\n"
        f"  solved  = {k['solved']} ({k['solved_pct']}%)\n"
        f"  macro%  = {k['macro_pass_pct']}\n"
        f"  gens    = {len(payload['generations'])}\n"
        f"  knowledge gens = {n_kn_gens}\n"
        f"  transcripts    = {n_tx}\n"
        f"  attempt grids  = {n_grids}\n"
        f"  highlights     = {len(hl['per_gen'])} generations",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
