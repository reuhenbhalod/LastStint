"""W3 measurement: real vs sim time lost per lap by start-of-lap gap band (dirty_air.py), and
on-track passes after the takeover, for one race per call.

    uv run python experiments/dirty_air_stats.py RACE [--runs N] [--scale D]
"""

from __future__ import annotations

import argparse
import statistics

import traffic_stats

from pipeline import build as build_mod
from pipeline import dirty_air as da

ap = argparse.ArgumentParser()
ap.add_argument("race")
ap.add_argument("--runs", type=int, default=100)
ap.add_argument("--scale", type=float, default=None, help="scale the dirty-air penalty")
args = ap.parse_args()

res = build_mod.build_race(args.race)
model, laps = res.model, res.laps
if args.scale is not None:
    model["track"]["dirtyAirPenalty"] *= args.scale
real = da.real_laps(laps, res.fit)
post = real[real["lap"] > model["race"]["takeoverLap"]]
sim_rows, sim_passes = da.sim_laps(model, args.runs)
_, real_passes = traffic_stats.real_stats(model, laps)
print(
    f"{args.race} dirtyAirPenalty {model['track']['dirtyAirPenalty']:.3f}"
    f" overtake {model['track']['overtakeModel']}"
)
print(f"  real all  {da.summary(da.band_losses(real))}")
print(f"  real post {da.summary(da.band_losses(post))}")
print(f"  sim       {da.summary(da.band_losses(sim_rows))}")
print(f"  passes real {real_passes} sim {statistics.mean(p for p, _ in sim_passes):.1f}")
