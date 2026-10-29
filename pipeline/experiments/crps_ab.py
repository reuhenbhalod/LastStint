"""F3 scoring (model v3 spec stage 8): probabilistic accuracy of the finishing gaps.

G1's gap error is |mean sim gap - real gap|, which rewards a sim that makes the real outcome
near-certain: when a key pass is a real coin flip, the mean lands between the two outcomes.
CRPS (continuous ranked probability score, in seconds) scores the whole sim distribution:
E|X - real| - 0.5 E|X - X'|. It equals the absolute error for a certain sim and is lower
when the sim's spread honestly covers the real result. Coverage is the share of real gaps
inside the sim's 10-90% range (80% for a calibrated sim).

    uv run python experiments/crps_ab.py current adv:1.1:0.4:1:1 [tune|holdout]
"""

from __future__ import annotations

import sys

import ceiling
import cruise_ab
import held_gap_ab as h
import numpy as np

from pipeline import build as build_mod
from pipeline import sim_reference as sim
from pipeline import validate as validate_mod

RUNS = 300
EXCLUDED = {"miami-2025"}


def crps(samples: np.ndarray, real: float) -> float:
    x = np.sort(samples)
    n = len(x)
    # E|X - X'| from sorted samples: 2 / n^2 * sum (2i - n - 1) x_i
    spread = 2.0 / n**2 * np.sum((2 * np.arange(1, n + 1) - n - 1) * x)
    return float(np.mean(np.abs(x - real)) - 0.5 * spread)


def score_race(model, laps, meta):
    real = validate_mod.real_finishing_gaps(laps)
    order = [c for c in model["realResult"] if c in real][: meta.get("score_positions", 6)]
    winner = order[0]
    gaps = {c: [] for c in order}
    for i in range(RUNS):
        times = sim.simulate(model, 30000 + i)["times"]
        if winner not in times:
            continue
        for c in order:
            if c in times:
                gaps[c].append(times[c] - times[winner])
    out = []
    for c in order[1:]:  # the winner's gap is 0 by construction
        x = np.array(gaps[c])
        lo, hi = np.quantile(x, [0.1, 0.9])
        out.append((crps(x, real[c]), abs(x.mean() - real[c]), lo <= real[c] <= hi))
    return out


def run(spec, split):
    cruise = None
    if spec == "current":
        sim._resolve_order = h.ORIGINAL
    elif spec.startswith("cruise:"):  # cruise:N:G:C (cruise_ab.py)
        cruise = [float(x) for x in spec.split(":")[1:]]
        sim._resolve_order = cruise_ab.resolve
    else:
        base, slope, lo, hi = map(float, spec.split(":")[1:])
        sim._resolve_order = h.patched_resolve(lo, hi, base, slope)
    rows = []
    try:
        for rid, meta in build_mod.RACES.items():
            if meta.get("split") != split or rid in EXCLUDED:
                continue
            model, laps = build_mod.build_race_model(rid)
            if cruise:
                sim._clean_lap = cruise_ab.patched_clean(*cruise, int(model["race"]["laps"]))
            r = score_race(model, laps, build_mod.resolved_meta(rid, laps))
            rows += r
            c = np.mean([x[0] for x in r])
            e = np.mean([x[1] for x in r])
            print(f"  {spec:18s} {rid:22s} crps {c:5.2f}  mean-err {e:5.2f}", flush=True)
    finally:
        sim._resolve_order = h.ORIGINAL
        sim._clean_lap = ceiling.ORIGINAL
    c, e, cov = (np.mean([x[k] for x in rows]) for k in range(3))
    print(f"== {spec} ({split}): crps {c:.2f}s  mean-err {e:.2f}s  coverage {cov:.0%}", flush=True)


if __name__ == "__main__":
    args = sys.argv[1:]
    split = args.pop() if args[-1] in ("tune", "holdout") else "tune"
    for s in args:
        run(s, split)
