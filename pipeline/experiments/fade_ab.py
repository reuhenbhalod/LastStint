"""F1 screen (model v3 spec stage 8) on the TUNING races, patched into the reference sim:
extra late-stint wear for faster cars.

  front:K:A  adds K * (1 - rank) * max(0, age - A) s to each clean lap, where rank is the
             car's base-pace rank in the field (0 fastest, 1 slowest)

  uv run python experiments/fade_ab.py front:0.015:18 front:0.025:18
"""

from __future__ import annotations

import sys

import ceiling

from pipeline import build as build_mod
from pipeline import sim_reference as sim
from pipeline import validate as validate_mod

EXCLUDED = {"miami-2025"}


def run(spec):
    _, k, a = spec.split(":")
    k, a = float(k), float(a)
    rows = []
    for rid, meta0 in build_mod.RACES.items():
        if meta0.get("split") != "tune" or rid in EXCLUDED:
            continue
        model, laps = build_mod.build_race_model(rid)
        meta = build_mod.resolved_meta(rid, laps)
        ranked = sorted(model["drivers"], key=lambda d: d["basePace"])
        rank = {d["code"]: i / (len(ranked) - 1) for i, d in enumerate(ranked)}

        def patched(car, compounds, fuel, lap, fresh=None, _rank=rank):
            base = ceiling.ORIGINAL(car, compounds, fuel, lap, fresh)
            return base + k * (1 - _rank.get(car.code, 1.0)) * max(0.0, car.tyre_age - a)

        sim._clean_lap = patched
        try:
            r = validate_mod.robust_status(
                model,
                validate_mod.real_finishing_gaps(laps),
                rival=meta.get("rival"),
                score_positions=meta.get("score_positions", 6),
            )
        finally:
            sim._clean_lap = ceiling.ORIGINAL
        rows.append((rid, r.status, r.mean_gap_error))
        print(f"  {spec:16s} {rid:22s} {r.status:10s} {r.mean_gap_error:.2f}", flush=True)
    n = sum(s == "pass" for _, s, _ in rows)
    b = sum(s == "borderline" for _, s, _ in rows)
    print(f"== {spec}: {n} pass / {b} border, mean {sum(e for *_, e in rows) / len(rows):.2f}s")


if __name__ == "__main__":
    for s in sys.argv[1:]:
        run(s)
