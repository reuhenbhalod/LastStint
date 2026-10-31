"""D1 follow-up: does the sim double-count traffic? TUNING races, model mode, with the
dirty-air penalty and/or lap noise scaled.

    uv run python traffic_ab.py base air0 noise0 air0noise0 noise50
"""

from __future__ import annotations

import sys

from pipeline import build as build_mod
from pipeline import validate as validate_mod

EXCLUDED = {"miami-2025"}
VARIANTS = {
    "base": (1.0, 1.0),
    "air0": (0.0, 1.0),
    "noise0": (1.0, 0.0),
    "air0noise0": (0.0, 0.0),
    "noise50": (1.0, 0.5),
    "air0noise50": (0.0, 0.5),
    "air50": (0.5, 1.0),
    "air25": (0.25, 1.0),
}

for name in sys.argv[1:]:
    air, noise = VARIANTS[name]
    rows = []
    for rid, meta0 in build_mod.RACES.items():
        if meta0.get("split") != "tune" or rid in EXCLUDED:
            continue
        model, laps = build_mod.build_race_model(rid)
        meta = build_mod.resolved_meta(rid, laps)
        m = {
            **model,
            "track": {**model["track"], "dirtyAirPenalty": model["track"]["dirtyAirPenalty"] * air},
            "drivers": [{**d, "noise": d["noise"] * noise} for d in model["drivers"]],
        }
        res = validate_mod.robust_status(
            m,
            validate_mod.real_finishing_gaps(laps),
            rival=meta.get("rival"),
            score_positions=meta.get("score_positions", 6),
        )
        rows.append((rid, res.status, res.mean_gap_error))
        print(f"  {name:11s} {rid:22s} {res.status:10s} {res.mean_gap_error:.2f}", flush=True)
    n = sum(s == "pass" for _, s, _ in rows)
    b = sum(s == "borderline" for _, s, _ in rows)
    mean = sum(e for *_, e in rows) / len(rows)
    print(f"== {name}: {n} pass / {b} border, mean {mean:.2f}s", flush=True)
