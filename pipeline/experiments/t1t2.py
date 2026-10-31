"""Stage 6 T1 (clear-air pace) x T2 (robust noise) on the TUNING races, model mode."""

from __future__ import annotations

from pipeline import build as build_mod
from pipeline import fit, pace
from pipeline import validate as validate_mod

EXCLUDED = {"miami-2025"}

for clear_air, robust in [(False, False), (True, False), (False, True), (True, True)]:
    pace.CLEAR_AIR, fit.ROBUST_NOISE = clear_air, robust
    name = f"T1={'on' if clear_air else 'off'} T2={'on' if robust else 'off'}"
    rows = []
    for rid, meta0 in build_mod.RACES.items():
        if meta0.get("split") != "tune" or rid in EXCLUDED:
            continue
        model, laps = build_mod.build_race_model(rid)
        meta = build_mod.resolved_meta(rid, laps)
        res = validate_mod.robust_status(
            model,
            validate_mod.real_finishing_gaps(laps),
            rival=meta.get("rival"),
            score_positions=meta.get("score_positions", 6),
        )
        rows.append((rid, res.status, res.mean_gap_error))
        print(f"  {name} {rid:22s} {res.status:10s} {res.mean_gap_error:.2f}", flush=True)
    n = sum(s == "pass" for _, s, _ in rows)
    b = sum(s == "borderline" for _, s, _ in rows)
    mean = sum(e for *_, e in rows) / len(rows)
    print(f"== {name}: {n} pass / {b} border, mean {mean:.2f}s", flush=True)
