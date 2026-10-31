"""C3 (model v3 spec stage 5): calibrate SC_PIT_LOSS_FACTOR on the TUNING races that have a
safety car after the takeover.

    uv run python experiments/sc_factor.py 0.55 0.7 0.85 1.0
"""

from __future__ import annotations

import sys

from pipeline import build as build_mod
from pipeline import track
from pipeline import validate as validate_mod


def sc_races() -> list[str]:
    out = []
    for rid, meta in build_mod.RACES.items():
        if meta.get("split") != "tune":
            continue
        model, _ = build_mod.build_race_model(rid)
        if any(e["type"] == "SC" for e in model["events"]):
            out.append(rid)
    return out


races = sc_races()
print("SC races:", races, flush=True)
for factor in [float(a) for a in sys.argv[1:]]:
    track.SC_PIT_LOSS_FACTOR = factor
    rows = []
    for rid in races:
        model, laps = build_mod.build_race_model(rid)
        meta = build_mod.resolved_meta(rid, laps)
        res = validate_mod.robust_status(
            model,
            validate_mod.real_finishing_gaps(laps),
            rival=meta.get("rival"),
            score_positions=meta.get("score_positions", validate_mod.DEFAULT_SCORE_POSITIONS),
        )
        rows.append((rid, res.status, res.mean_gap_error))
    line = "  ".join(f"{r}={s[:4]} {e:.2f}" for r, s, e in rows)
    n = sum(s == "pass" for _, s, _ in rows)
    mean = sum(e for *_, e in rows) / len(rows)
    print(f"== {factor:.2f}: {n} pass, mean {mean:.2f}s | {line}", flush=True)
