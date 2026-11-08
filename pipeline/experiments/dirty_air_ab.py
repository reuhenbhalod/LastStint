"""W3 screen: robust G1, pass counts and dirty-air loss for one race under a variant.

base               the race as built without the W3 model (dirty_air.IN_ERAS_BUILDS off)
da                 the W3 model (bands, pace without the real dirty-air loss)
nopace             with da: the pace offsets keep their traffic laps as they are
offset:A,B,C,D     with da: the sims' bands = the real loss less these (simOffset)
pace               with da: the pace offsets take the real dirty-air loss off each lap
k:F                with da: the real loss scaled by F
held:X             with da: hold a failed follower X s behind (overtakeModel.heldGap)
hold:X             the same on any build (set after the build)
bands:A,B,C,D      dirty air by start-of-lap gap: A <0.5 s, B <1.0, C <1.5, D <2.0
roll               no pass without a roll (overtakeModel.rollOnly)
Variants join with '+'. --runs: G1 runs per seed set (default the robust 1000).

  uv run python experiments/dirty_air_ab.py RACE VARIANT [--runs N]
"""

from __future__ import annotations

import argparse
import statistics

from pipeline import build as build_mod
from pipeline import dirty_air as da
from pipeline import validate as validate_mod

ap = argparse.ArgumentParser()
ap.add_argument("race")
ap.add_argument("variant")
ap.add_argument("--runs", type=int, default=validate_mod.ROBUST_RUNS)
ap.add_argument("--sim-runs", type=int, default=200)
args = ap.parse_args()

PRE = {"base", "off", "nopace", "pace", "held", "offset", "k"}
parts = [p.partition(":") for p in args.variant.split("+")]
da.IN_ERAS_BUILDS = False
for name, _, val in parts:
    if name == "da":
        da.IN_ERAS_BUILDS = True
    elif name == "nopace":
        da.DETRAFFIC = False
    elif name == "pace":
        da.DETRAFFIC = True
    elif name == "k":
        da.LOSS_MULT = float(val)
    elif name == "held":
        da.HELD_GAP = float(val)
    elif name == "offset":
        da.SIM_OFFSET = [float(x) for x in val.split(",")]
res = build_mod.build_race(args.race)
model, laps = res.model, res.laps
track, ot = model["track"], model["track"]["overtakeModel"]
for name, _, val in parts:
    if name in PRE or name == "da":
        pass
    elif name == "bands":
        pens = [float(x) for x in val.split(",")]
        track["dirtyAirBands"] = [
            {"upTo": hi, "penalty": p} for (_, hi), p in zip(da.BANDS, pens, strict=False)
        ]
    elif name == "hold":
        ot["heldGap"] = float(val)
    elif name == "nobands":
        track.pop("dirtyAirBands", None)
    elif name == "roll":
        ot["rollOnly"] = True
    else:
        raise SystemExit(f"unknown variant {name}")

meta = build_mod.resolved_meta(args.race, laps)
rs = validate_mod.robust_status(
    model,
    validate_mod.real_finishing_gaps(laps),
    rival=meta.get("rival"),
    score_positions=meta.get("score_positions", validate_mod.DEFAULT_SCORE_POSITIONS),
    runs=args.runs,
)
fails: dict[str, list[str]] = {}
for r in rs.reports:
    for c in r.checks:
        if not c.passed:
            fails.setdefault(c.name, []).append(f"{c.value:.2f}")
worst = max(fails.items(), key=lambda kv: len(kv[1]), default=None)
why = f"{worst[0]} {'/'.join(worst[1])}" if worst else "-"
rows, sp = da.sim_laps(model, args.sim_runs)
rp, rc = da.real_passes(model, laps)
sim_loss = da.band_losses(rows)
real_loss = da.band_losses(da.real_laps(laps, res.fit))
print(
    f"RESULT {args.race} {args.variant} | {rs.status} {rs.mean_gap_error:.2f} | {why}"
    f" | passes real {rp} close {rc} sim {statistics.mean(p for p, _ in sp):.1f}"
    f" close {statistics.mean(c for _, c in sp):.1f}"
)
print(f"  real {da.summary(real_loss)}")
print(f"  sim  {da.summary(sim_loss)}")
