"""Job 1.5 screen: robust G1 for one race under a restart / laps-down variant.

base      the race as built with neither (restart.IN_ERAS_BUILDS and
          restart.LAPS_DOWN_IN_ERAS_BUILDS off)
down      the SC / red-flag queues take the scripted cars' real laps down (lapsDown)
restart   the SC restart's jump and spread (track.restart)
Variants join with '+'. Prints one JSON line (status, mean gap error, failing checks); --out
appends it to a file.

  uv run python experiments/restart_ab.py RACE VARIANT [--runs N] [--out FILE]
"""

from __future__ import annotations

import argparse
import json

from pipeline import build as build_mod
from pipeline import restart
from pipeline import validate as validate_mod

ap = argparse.ArgumentParser()
ap.add_argument("race")
ap.add_argument("variant")
ap.add_argument("--runs", type=int, default=validate_mod.ROBUST_RUNS)
ap.add_argument("--out")
args = ap.parse_args()

parts = set(args.variant.split("+"))
unknown = parts - {"base", "down", "restart"}
if unknown:
    raise SystemExit(f"unknown variant {unknown}")
restart.IN_ERAS_BUILDS = "restart" in parts
restart.LAPS_DOWN_IN_ERAS_BUILDS = "down" in parts
res = build_mod.build_race(args.race)
model, laps = res.model, res.laps
meta = build_mod.resolved_meta(args.race, laps)
rs = validate_mod.robust_status(
    model,
    validate_mod.real_finishing_gaps(laps),
    rival=meta.get("rival"),
    score_positions=meta.get("score_positions", validate_mod.DEFAULT_SCORE_POSITIONS),
    runs=args.runs,
)
fails = {}
for r in rs.reports:
    for c in r.checks:
        if not c.passed:
            fails.setdefault(c.name, []).append(round(c.value, 2))
row = {
    "race": args.race,
    "variant": args.variant,
    "status": rs.status,
    "strict": rs.strict_status,
    "error": round(rs.mean_gap_error, 3),
    "fails": {
        k: [*v, c.limit]
        for r in rs.reports[:1]
        for c in r.checks
        for k, v in fails.items()
        if k == c.name
    },
    "lapsDown": [
        e.get("lapsDown") is not None for e in model["events"] if e["type"] in ("SC", "RED")
    ],
    "restartBlock": "restart" in model["track"],
}
line = json.dumps(row)
print(line)
if args.out:
    with open(args.out, "a") as f:
        f.write(line + "\n")
