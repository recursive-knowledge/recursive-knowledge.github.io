#!/usr/bin/env python3
"""Cosmetic cleanup for hard-clamped insight text in the dashboard data files.

Upstream (pre-#690) KSI distillation wrote insight `text` with a hard
``text[:cap]`` slice, cutting operative clauses mid-word (e.g. "...not
agent-logic fa"). The full text was never persisted, so it cannot be restored
— this only makes the surviving truncation *read* as intentional: back the cut
off to the last word boundary and append an ellipsis ("...not agent-logic…").

A field is treated as clamped when its length is exactly one of the known cap
values AND it does not already end in terminal punctuation (so naturally short
or already-complete insights are left untouched). Idempotent and safe to re-run
after any dashboard rebuild from the legacy knowledge DBs.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

# Hard-slice cap values used by the legacy distillation / builder paths.
CAPS = {240, 1200}
# Keys whose string values are insight bodies (the "curated voice" surface).
TEXT_KEYS = {"text", "insight"}
TERMINAL = ".!?…"


def declamp(text: str) -> str | None:
    """Return cleaned text, or None if the value was not a mid-word clamp."""
    if len(text) not in CAPS or not text:
        return None
    if text[-1] in TERMINAL:
        return None  # ends cleanly — almost certainly not a mid-word cut
    space = text.rfind(" ")
    # Only back off to a boundary in the latter half; otherwise keep the words.
    base = text[:space] if space > len(text) // 2 else text
    base = base.rstrip(" ,;:-—")
    return base + "…"


def walk(node, stats: dict[str, int]) -> None:
    if isinstance(node, dict):
        for key, val in node.items():
            if key in TEXT_KEYS and isinstance(val, str):
                fixed = declamp(val)
                if fixed is not None:
                    node[key] = fixed
                    stats["fixed"] += 1
            else:
                walk(val, stats)
    elif isinstance(node, list):
        for val in node:
            walk(val, stats)


def process(path: Path) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    stats = {"fixed": 0}
    walk(data, stats)
    # Match the builder's writer exactly (indent=2, ensure_ascii=True) so the
    # diff touches only the changed text lines.
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")
    print(f"{path.name}: declamped {stats['fixed']} insight fields")


def main(argv: list[str]) -> int:
    here = Path(__file__).resolve().parents[1] / "static" / "data"
    targets = [Path(a) for a in argv[1:]] or [
        here / "knowledge.json",
        here / "arc1_knowledge.json",
    ]
    for p in targets:
        if not p.exists():
            print(f"skip (missing): {p}", file=sys.stderr)
            continue
        process(p)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
