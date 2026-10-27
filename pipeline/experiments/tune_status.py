"""G1 status on the TUNING races with the current pipeline (both rules). Spec stage 5.

    uv run python experiments/tune_status.py
"""

from __future__ import annotations

from pipeline import build as build_mod
from pipeline import validate as validate_mod

EXCLUDED = {"miami-2025"}

n, strict, errs = {}, {}, []
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
    n[res.status] = n.get(res.status, 0) + 1
    strict[res.strict_status] = strict.get(res.strict_status, 0) + 1
    errs.append(res.mean_gap_error)
    print(f"  {rid:22s} {res.status:10s} strict {res.strict_status:10s} {res.mean_gap_error:.2f}")
print(f"== tie rule {n} | strict {strict} | mean {sum(errs) / len(errs):.2f}s")
