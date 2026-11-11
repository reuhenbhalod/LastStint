"""Why a race misses Gate G1: split each scored driver's gap error into its sources.

For each scored finisher behind the winner, the sim's mean gap error (sim gap - real gap) is
compared with the driver's real lap times minus the lap-time model on green, non-pit laps
after takeover, relative to the winner ("pace": real traffic and driver/stint pace the model
doesn't capture). Whatever is left is the sim's race mechanics: passes, traffic, SC bunching
and the estimated cost of SC stops (green and VSC stops are frozen at their measured time,
and SC stops can't be measured from lap times). The dominant source by squared error is the
race's diagnosis.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from .refuel import car_fuel
from .sim_reference import Car, _clean_lap, simulate
from .validate import real_finishing_gaps

LABELS = {
    "pace": "lap pace (driver/stint pace the model doesn't capture)",
    "rest": "race mechanics (passes, traffic, SC bunching and SC stops)",
}


@dataclass
class Diagnosis:
    share: dict[str, float]  # share of squared error per source
    dominant: str  # key of LABELS

    def line(self) -> str:
        parts = ", ".join(f"{k} {v:.0%}" for k, v in self.share.items())
        return f"{LABELS[self.dominant]} ({parts})"


def diagnose(model: dict, laps: pd.DataFrame, score_positions: int, runs: int = 150) -> Diagnosis:
    gaps = real_finishing_gaps(laps)
    takeover = model["race"]["takeoverLap"]
    order = [c for c in model["realResult"] if c in gaps][:score_positions]
    winner = order[0]
    sims = [simulate(model, 1000 + s) for s in range(runs)]

    def sim_gap(code: str) -> float:
        vals = [s["times"][code] - s["times"][winner] for s in sims if code in s["times"]]
        return float(np.mean(vals)) if vals else float("nan")

    drivers = {d["code"]: d for d in model["drivers"]}
    post = laps[
        (laps["LapNumber"] > takeover)
        & (laps["TrackStatus"].astype(str) == "1")
        & laps["PitInTime"].isna()
        & laps["PitOutTime"].isna()
        & laps["LapTime"].notna()
    ]
    # Pace by stint (pace.stint_offsets): each lap's clean lap carries its real stint's offset.
    from .pace import stint_key

    stint = {
        code: (
            {int(e["lap"]): float(e["offset"]) for e in d.get("stintPace", [])},
            sorted(int(st["lap"]) for st in d["realStrategy"] if int(st["lap"]) > takeover),
        )
        for code, d in drivers.items()
    }
    pace: dict[str, float] = {}
    for r in post.itertuples():
        compound = None if pd.isna(r.Compound) else str(r.Compound)
        if r.Driver not in drivers or compound not in model["compounds"]:
            continue
        car = Car(
            code=r.Driver,
            base_pace=drivers[r.Driver]["basePace"],
            noise=0,
            compound=compound,
            tyre_age=int(r.TyreLife),
            total_time=0,
            stint_pace=stint[r.Driver][0].get(stint_key(stint[r.Driver][1], int(r.LapNumber)), 0.0),
            **car_fuel(r),
        )
        predicted = _clean_lap(
            car,
            model["compounds"],
            model["fuelEffectPerLap"],
            int(r.LapNumber),
            model.get("freshTyre"),
        )
        pace[r.Driver] = pace.get(r.Driver, 0.0) + float(r.LapTime) - predicted

    squared = {"pace": 0.0, "rest": 0.0}
    for code in order[1:]:
        err = sim_gap(code) - gaps[code]
        p = pace.get(code, 0.0) - pace.get(winner, 0.0)
        rest = err + p  # time a driver really lost shows as a negative sim error
        squared["pace"] += p * p
        squared["rest"] += rest * rest
    total = sum(squared.values()) or 1.0
    share = {k: v / total for k, v in squared.items()}
    return Diagnosis(share=share, dominant=max(share, key=share.get))
