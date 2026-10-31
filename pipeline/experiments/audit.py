"""Replay audit (model v3 spec, stage 1): with every driver's real lap pace (the `replay`
ceiling), which cars still finish far from their real gap? Pace can't explain those, so each
is a mechanics or data suspect: stops, safety cars, passing, takeover state, reference gaps.

    uv run python experiments/audit.py [race ...]
"""

from __future__ import annotations

import sys

import ceiling
import numpy as np

from pipeline import build as build_mod
from pipeline import sim_reference as sim
from pipeline import validate as validate_mod

SUSPECT = 5.0  # seconds off the real gap, after real pace is given
RUNS = 200


def audit(rid: str) -> list[str]:
    model, laps = build_mod.build_race_model(rid)
    gaps = validate_mod.real_finishing_gaps(laps)
    off = ceiling.offsets(model, laps, "replay")

    def patched(car, compounds, fuel, lap, fresh=None):
        return ceiling.ORIGINAL(car, compounds, fuel, lap, fresh) + off.get((car.code, lap), 0.0)

    m = {
        **model,
        "track": {**model["track"], "dirtyAirPenalty": 0.0},
        "drivers": [{**d, "noise": 0.0} for d in model["drivers"]],
    }
    sim._clean_lap = patched
    try:
        runs = [sim.simulate(m, 10000 + i)["times"] for i in range(RUNS)]
    finally:
        sim._clean_lap = ceiling.ORIGINAL
    winner = min(gaps, key=gaps.get)
    out = []
    for c in [c for c in model["realResult"] if c in gaps]:
        vals = [t[c] - t[winner] for t in runs if c in t and winner in t]
        if not vals:
            continue
        err = float(np.mean(vals)) - gaps[c]
        if abs(err) > SUSPECT:
            out.append(f"{c} {err:+.1f}s (real {gaps[c]:.1f})")
    return out


if __name__ == "__main__":
    for rid in sys.argv[1:] or list(build_mod.RACES):
        found = audit(rid)
        print(f"{rid:24s} {'; '.join(found) if found else 'ok'}", flush=True)
