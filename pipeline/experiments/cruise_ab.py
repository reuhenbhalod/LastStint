"""F4 screen (model v3 spec stage 8) on the TUNING races: the leader eases off late.

cruise:N:G:C   in the last N laps, the race leader with a gap of at least G s to the car
               behind (at the start of the lap) runs C s/lap slower

  uv run python experiments/cruise_ab.py cruise:0:0:0 cruise:5:5:0.5
"""

from __future__ import annotations

import sys

import ceiling

from pipeline import build as build_mod
from pipeline import sim_reference as sim
from pipeline import validate as validate_mod

EXCLUDED = {"miami-2025"}
ORIG_RESOLVE = sim._resolve_order
STATE: dict = {}


def resolve(order, cars, *args):
    ORIG_RESOLVE(order, cars, *args)
    live = [c for c in order if not cars[c].retired]
    STATE["leader"] = live[0]
    STATE["lead"] = cars[live[1]].total_time - cars[live[0]].total_time if len(live) > 1 else 0


def patched_clean(n, g, c, total):
    def clean(car, compounds, fuel, lap, fresh=None):
        t = ceiling.ORIGINAL(car, compounds, fuel, lap, fresh)
        if total - lap < n and STATE.get("leader") == car.code and STATE.get("lead", 0) >= g:
            t += c
        return t

    return clean


def run(spec):
    n, g, c = (float(x) for x in spec.split(":")[1:])
    rows = []
    sim._resolve_order = resolve
    try:
        for rid, meta0 in build_mod.RACES.items():
            if meta0.get("split") != "tune" or rid in EXCLUDED:
                continue
            model, laps = build_mod.build_race_model(rid)
            meta = build_mod.resolved_meta(rid, laps)
            sim._clean_lap = patched_clean(n, g, c, int(model["race"]["laps"]))
            STATE.clear()
            r = validate_mod.robust_status(
                model,
                validate_mod.real_finishing_gaps(laps),
                rival=meta.get("rival"),
                score_positions=meta.get("score_positions", 6),
            )
            rows.append((rid, r.status, r.mean_gap_error))
            print(f"  {spec:16s} {rid:22s} {r.status:10s} {r.mean_gap_error:.2f}", flush=True)
    finally:
        sim._clean_lap = ceiling.ORIGINAL
        sim._resolve_order = ORIG_RESOLVE
    p = sum(s == "pass" for _, s, _ in rows)
    b = sum(s == "borderline" for _, s, _ in rows)
    print(f"== {spec}: {p} pass / {b} border, mean {sum(e for *_, e in rows) / len(rows):.2f}s")


if __name__ == "__main__":
    for s in sys.argv[1:]:
        run(s)
