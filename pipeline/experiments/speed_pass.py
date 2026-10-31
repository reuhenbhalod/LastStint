"""F2 measurement (model v3 spec stage 8): does straight-line speed predict real passes
beyond each race's fitted overtake model?

For every real pass opportunity (track.extract_pass_events), the race's own fitted model
gives z = intercept + paceCoef*adv + gapCoef*gap, with adv from the race model's clean laps.
A pooled logit with z as an offset then estimates the extra effect of

  st  follower minus leader race-median speed-trap speed (km/h, green laps, FastF1 SpeedST)

    uv run python experiments/speed_pass.py [tune|holdout|all]
"""

from __future__ import annotations

import sys

import numpy as np
import pandas as pd
import statsmodels.api as sm

from pipeline import build as build_mod
from pipeline import ingest
from pipeline import sim_reference as sim
from pipeline.track import extract_pass_events

EXCLUDED = {"miami-2025"}


def speed_traps(meta):
    s = ingest.load_race(meta["year"], meta["event"])
    laps = s.laps
    green = laps[(laps["TrackStatus"].astype(str) == "1") & laps["PitInTime"].isna()]
    return green.groupby("Driver")["SpeedST"].median().to_dict()


def clean(model, laps):
    drivers = {d["code"]: d for d in model["drivers"]}
    out = {}
    for r in laps.itertuples():
        compound = None if pd.isna(r.Compound) else str(r.Compound)
        if r.Driver not in drivers or compound not in model["compounds"]:
            continue
        car = sim.Car(
            code=r.Driver,
            base_pace=drivers[r.Driver]["basePace"],
            noise=0,
            compound=compound,
            tyre_age=max(0, int(r.TyreLife) - 1) if r.TyreLife == r.TyreLife else 0,
            total_time=0,
        )
        out[(int(r.LapNumber), r.Driver)] = sim._clean_lap(
            car,
            model["compounds"],
            model["fuelEffectPerLap"],
            int(r.LapNumber),
            model.get("freshTyre"),
        )
    return out


def events_for(rid, meta):
    model, laps = build_mod.build_race_model(rid)
    takeover = model["race"]["takeoverLap"]
    ev = extract_pass_events(laps)
    ev = ev[ev["lap"] > takeover]
    pred = clean(model, laps)
    ev["adv"] = [
        pred.get((e.lap, e.leader), np.nan) - pred.get((e.lap, e.follower), np.nan)
        for e in ev.itertuples()
    ]
    om = model["track"]["overtakeModel"]
    ev["z"] = om["intercept"] + om["paceCoef"] * ev["adv"] + om["gapCoef"] * ev["gap"]
    st = speed_traps(meta)
    ev["st"] = [st.get(e.follower, np.nan) - st.get(e.leader, np.nan) for e in ev.itertuples()]
    ev["race"] = rid
    return ev.dropna(subset=["adv", "st", "z"])


def main(which):
    frames = []
    for rid, meta in build_mod.RACES.items():
        if rid in EXCLUDED or (which != "all" and meta.get("split") != which):
            continue
        frames.append(events_for(rid, meta))
    ev = pd.concat(frames)
    n_pass = int(ev["passed"].sum())
    print(f"== {which}: {ev['race'].nunique()} races, {len(ev)} opportunities, {n_pass} passes")
    y = ev["passed"].astype(float)
    base = sm.GLM(y, np.ones((len(ev), 1)), family=sm.families.Binomial(), offset=ev["z"]).fit()
    x = sm.add_constant(ev[["st"]].astype(float))
    m = sm.GLM(y, x, family=sm.families.Binomial(), offset=ev["z"]).fit()
    print(m.summary().tables[1])
    drop = base.deviance - m.deviance
    print(f"  deviance {base.deviance:.1f} -> {m.deviance:.1f} (drop {drop:.1f}, 1 df)")
    for lo, hi in [(-99, -5), (-5, 0), (0, 5), (5, 99)]:
        g = ev[(ev["st"] >= lo) & (ev["st"] < hi)]
        if len(g):
            exp = (1 / (1 + np.exp(-g["z"]))).sum()
            real = int(g["passed"].sum())
            print(f"  st [{lo:+d},{hi:+d}): {len(g):5d} opps, real {real:4d}, expected {exp:6.1f}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "tune")
