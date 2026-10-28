"""F1 measurement (model v3 spec stage 8): does tyre fade depend on pressure?

Per green, non-pit lap after the takeover, the model residual (real lap minus the model's
clean lap) is demeaned within each driver stint, then regressed on

  age        tyre age (the model already has wear, so this is the model's wear error)
  chase_now  1 if the car started the lap within 1.0 s of the car ahead (dirty air now)
  cum_chase  laps so far this stint spent within PRESSURE s of the car ahead
  cum_def    laps so far this stint with the car behind within PRESSURE s

A positive cum_* coefficient means tyres fade faster the longer a car fights.

    uv run python experiments/fade_stats.py [tune|held|all]
"""

from __future__ import annotations

import sys

import ceiling
import numpy as np
import pandas as pd

from pipeline import build as build_mod
from pipeline.clean import gap_to_car_ahead

EXCLUDED = {"miami-2025"}
PRESSURE = 1.5


def features(model, laps):
    df = laps.assign(gap=gap_to_car_ahead(laps))
    # gap behind = the gap of the car one position back on the same lap
    behind = {}
    for lap, grp in df.groupby("LapNumber"):
        g = grp.sort_values("Position")
        codes, gaps = list(g["Driver"]), list(g["gap"])
        for i, c in enumerate(codes[:-1]):
            behind[(c, int(lap))] = gaps[i + 1]
    df["gap_behind"] = [
        behind.get((c, int(n)), np.nan) for c, n in zip(df["Driver"], df["LapNumber"], strict=True)
    ]
    df = df.sort_values(["Driver", "LapNumber"])
    df["chase"] = (df["gap"] < PRESSURE).astype(float)
    df["defend"] = (df["gap_behind"] < PRESSURE).astype(float)
    grp = df.groupby(["Driver", "Stint"])
    # laps BEFORE this one in the stint (pressure builds wear that shows on later laps)
    df["cum_chase"] = grp["chase"].cumsum() - df["chase"]
    df["cum_def"] = grp["defend"].cumsum() - df["defend"]
    df["chase_now"] = (df["gap"] < 1.0).astype(float)
    keep = df[["Driver", "LapNumber", "TyreLife", "chase_now", "cum_chase", "cum_def"]]
    res = ceiling.residuals(model, laps)
    out = res.merge(keep, left_on=["code", "lap"], right_on=["Driver", "LapNumber"])
    out["age"] = out["TyreLife"].astype(float)
    return out


def regress(rows):
    cols = ["age", "chase_now", "cum_chase", "cum_def"]
    d = rows.copy()
    for c in ["res", *cols]:
        d[c] = d[c] - d.groupby(["race", "code", "stint"])[c].transform("mean")
    # trim gross outliers (traffic incidents, lifts) so a few laps don't steer it
    d = d[d["res"].abs() < 3.0]
    x = d[cols].to_numpy()
    y = d["res"].to_numpy()
    beta, *_ = np.linalg.lstsq(x, y, rcond=None)
    resid = y - x @ beta
    sigma2 = resid @ resid / (len(y) - len(cols))
    se = np.sqrt(np.diag(sigma2 * np.linalg.inv(x.T @ x)))
    print(f"  laps {len(y)}")
    for c, b, s in zip(cols, beta, se, strict=True):
        print(f"  {c:10s} {b:+.4f} s  (se {s:.4f}, t {b / s:+.1f})")


def main(which):
    frames = []
    for rid, meta in build_mod.RACES.items():
        if rid in EXCLUDED or (which != "all" and meta.get("split") != which):
            continue
        model, laps = build_mod.build_race_model(rid)
        f = features(model, laps)
        f["race"] = rid
        frames.append(f)
    rows = pd.concat(frames)
    print(f"== {which}: {rows['race'].nunique()} races")
    regress(rows)
    # long stints only: where the Hungary 19 effect would live
    long = rows.groupby(["race", "code", "stint"])["age"].transform("max") >= 25
    print("== stints of 25+ laps")
    regress(rows[long])


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "tune")
