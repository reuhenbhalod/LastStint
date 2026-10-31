"""F4 measurement (model v3 spec stage 8): do cars with a safe gap behind ease off late?

Per green, non-pit lap after the takeover, the model residual is demeaned within each driver
stint (removing pace offsets), then averaged by gap to the car behind and laps remaining.

    uv run python experiments/cruise_stats.py [tune|holdout|all]
"""

from __future__ import annotations

import sys

import ceiling
import numpy as np
import pandas as pd

from pipeline import build as build_mod
from pipeline.clean import gap_to_car_ahead

EXCLUDED = {"miami-2025"}


def rows_for(model, laps):
    df = laps.assign(gap=gap_to_car_ahead(laps))
    behind = {}
    for lap, grp in df.groupby("LapNumber"):
        g = grp.sort_values("Position")
        codes, gaps = list(g["Driver"]), list(g["gap"])
        for i, c in enumerate(codes[:-1]):
            behind[(c, int(lap))] = gaps[i + 1]
    res = ceiling.residuals(model, laps)
    res["behind"] = [behind.get((c, n), np.nan) for c, n in zip(res.code, res.lap, strict=True)]
    pos = {(r.Driver, int(r.LapNumber)): r.Position for r in laps.itertuples()}
    res["pos"] = [pos.get((c, n)) for c, n in zip(res.code, res.lap, strict=True)]
    res["left"] = int(model["race"]["laps"]) - res["lap"]
    return res


def main(which):
    frames = []
    for rid, meta in build_mod.RACES.items():
        if rid in EXCLUDED or (which != "all" and meta.get("split") != which):
            continue
        model, laps = build_mod.build_race_model(rid)
        f = rows_for(model, laps)
        f["race"] = rid
        frames.append(f)
    d = pd.concat(frames)
    d = d[d["res"].abs() < 3]
    d["res"] = d["res"] - d.groupby(["race", "code", "stint"])["res"].transform("mean")
    d["gapbin"] = pd.cut(d["behind"], [0, 2, 5, 10, 20, 999], right=False)
    d["phase"] = pd.cut(d["left"], [-1, 5, 10, 20, 999], labels=["0-5", "6-10", "11-20", "21+"])
    print(f"== {which}: mean demeaned residual (s), by laps left (rows) and gap behind (cols)")

    def table(df, agg):
        return df.pivot_table(
            index="phase", columns="gapbin", values="res", aggfunc=agg, observed=True
        )

    print(table(d, "mean").round(2))
    print(table(d, "size"))
    print("== leaders only")
    print(table(d[d["pos"] == 1], "mean").round(2))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "tune")
