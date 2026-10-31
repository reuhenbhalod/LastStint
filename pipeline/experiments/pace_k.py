"""Model v3 B2a tuning (spec stage 2): G1 on the TUNING races for each shrink setting.
Held-out races are not run here (spec B3). Result (Oct 26): inf 5/1/10 3.47s, 0 7/1/8 2.39s,
5 7/1/8 2.34s (chosen), 15 6/0/10 2.36s; a median instead of the mean: 4/0/12 3.36s.

    uv run python experiments/pace_k.py inf 0 5 15
"""

from __future__ import annotations

import sys

from pipeline import build as build_mod
from pipeline import pace
from pipeline import validate as validate_mod

EXCLUDED = {"miami-2025"}  # data issue (corrupt tyre timing upstream)

for k in [float(a) for a in sys.argv[1:]]:
    pace.SHRINK_LAPS = k
    n = {"pass": 0, "borderline": 0, "fail": 0}
    errs = []
    for rid, meta0 in build_mod.RACES.items():
        if meta0.get("split") != "tune" or rid in EXCLUDED:
            continue
        model, laps = build_mod.build_race_model(rid)
        meta = build_mod.resolved_meta(rid, laps)
        res = validate_mod.robust_status(
            model,
            validate_mod.real_finishing_gaps(laps),
            rival=meta.get("rival"),
            score_positions=meta.get("score_positions", validate_mod.DEFAULT_SCORE_POSITIONS),
        )
        n[res.status] += 1
        errs.append(res.mean_gap_error)
        print(f"  k={k:g} {rid:22s} {res.status:10s} {res.mean_gap_error:.2f}", flush=True)
    mean = sum(errs) / len(errs)
    print(
        f"== k={k:g}: {n['pass']} pass / {n['borderline']} border / {n['fail']} fail,"
        f" mean {mean:.2f}s",
        flush=True,
    )
