"""Ceiling test (model v3 spec, stage 0): how many races pass Gate G1 if the sim is handed
each driver's REAL pace after the takeover lap? This is cheating on purpose: it bounds what
any lap-pace model could achieve, separating pace error from race-mechanics error.

Oracles (each adds a per-driver offset to the model's clean lap; offsets are the mean of real
lap time minus the model's clean lap on green, non-pit laps after takeover):
  none    the current model
  driver  one offset per driver for the whole post-takeover race
  stint   one offset per driver per stint
  lap     the real residual on every lap (stint mean where a lap has none)
  replay  `lap` with the sim's dirty air and lap noise off (--replay): real lap times
          already include both, so what's left is pit stops, SCs and passing

    uv run python experiments/ceiling.py [race ...]
"""

from __future__ import annotations

import sys
from collections import defaultdict

import pandas as pd

from pipeline import build as build_mod
from pipeline import sim_reference as sim
from pipeline import validate as validate_mod

ORIGINAL = sim._clean_lap


def residuals(model: dict, laps: pd.DataFrame) -> pd.DataFrame:
    takeover = model["race"]["takeoverLap"]
    drivers = {d["code"]: d for d in model["drivers"]}
    post = laps[
        (laps["LapNumber"] > takeover)
        & (laps["TrackStatus"].astype(str) == "1")
        & laps["PitInTime"].isna()
        & laps["PitOutTime"].isna()
        & laps["LapTime"].notna()
    ]
    rows = []
    for r in post.itertuples():
        compound = None if pd.isna(r.Compound) else str(r.Compound)
        if r.Driver not in drivers or compound not in model["compounds"]:
            continue
        car = sim.Car(
            code=r.Driver,
            base_pace=drivers[r.Driver]["basePace"],
            noise=0,
            compound=compound,
            tyre_age=max(0, int(r.TyreLife) - 1),
            total_time=0,
        )
        pred = ORIGINAL(
            car,
            model["compounds"],
            model["fuelEffectPerLap"],
            int(r.LapNumber),
            model.get("freshTyre"),
        )
        rows.append((r.Driver, int(r.LapNumber), int(r.Stint), float(r.LapTime) - pred))
    return pd.DataFrame(rows, columns=["code", "lap", "stint", "res"])


def offsets(model: dict, laps: pd.DataFrame, kind: str) -> dict[tuple[str, int], float]:
    if kind == "none":
        return {}
    res = residuals(model, laps)
    total = int(model["race"]["laps"])
    takeover = model["race"]["takeoverLap"]
    stint_of = {
        (r.Driver, int(r.LapNumber)): int(r.Stint)
        for r in laps.itertuples()
        if not pd.isna(r.Stint)
    }
    by_driver = res.groupby("code")["res"].mean().to_dict()
    by_stint = res.groupby(["code", "stint"])["res"].mean().to_dict()
    by_lap = {(r.code, r.lap): r.res for r in res.itertuples()}
    out: dict[tuple[str, int], float] = {}
    for d in model["drivers"]:
        c = d["code"]
        for lap in range(takeover + 1, total + 1):
            s = stint_of.get((c, lap))
            stint_mean = by_stint.get((c, s), by_driver.get(c, 0.0))
            if kind == "replay":
                out[(c, lap)] = by_lap.get((c, lap), stint_mean)
            elif kind == "driver":
                out[(c, lap)] = by_driver.get(c, 0.0)
            elif kind == "stint":
                out[(c, lap)] = stint_mean
            else:
                out[(c, lap)] = by_lap.get((c, lap), stint_mean)
    return out


def run(race_ids: list[str], kinds: list[str]) -> None:
    table = defaultdict(dict)
    for rid in race_ids:
        model, laps = build_mod.build_race_model(rid)
        meta = build_mod.resolved_meta(rid, laps)
        gaps = validate_mod.real_finishing_gaps(laps)
        for kind in kinds:
            off = offsets(model, laps, kind)

            def patched(car, compounds, fuel, lap, fresh=None, _off=off):
                return ORIGINAL(car, compounds, fuel, lap, fresh) + _off.get((car.code, lap), 0.0)

            sim._clean_lap = patched
            m = model
            if kind == "replay":
                # Real lap times already include traffic and noise: don't add them again.
                m = {
                    **model,
                    "track": {**model["track"], "dirtyAirPenalty": 0.0},
                    "drivers": [{**d, "noise": 0.0} for d in model["drivers"]],
                }
            try:
                res = validate_mod.robust_status(
                    m,
                    gaps,
                    rival=meta.get("rival"),
                    score_positions=meta.get(
                        "score_positions", validate_mod.DEFAULT_SCORE_POSITIONS
                    ),
                )
            finally:
                sim._clean_lap = ORIGINAL
            table[rid][kind] = (res.status, res.mean_gap_error, meta.get("split"))
        row = "  ".join(f"{k}={table[rid][k][0][:4]} {table[rid][k][1]:5.2f}" for k in kinds)
        print(f"{rid:24s} {meta.get('split'):8s} {row}", flush=True)
    for split in ("tune", "holdout"):
        ids = [r for r in race_ids if table[r][kinds[0]][2] == split]
        if not ids:
            continue
        parts = []
        for k in kinds:
            n = sum(table[r][k][0] == "pass" for r in ids)
            b = sum(table[r][k][0] == "borderline" for r in ids)
            m = sum(table[r][k][1] for r in ids) / len(ids)
            parts.append(f"{k}: {n} pass/{b} border, {m:.2f}s")
        print(f"== {split} ({len(ids)}): " + " | ".join(parts))


if __name__ == "__main__":
    kinds = ["none", "driver", "stint", "lap"]
    if "--replay" in sys.argv:
        sys.argv.remove("--replay")
        kinds = ["none", "replay"]
    ids = sys.argv[1:] or list(build_mod.RACES)
    run(ids, kinds)
