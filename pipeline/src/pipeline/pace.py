"""Race pace after the takeover (model v3 spec, B2a).

A driver's base pace comes from the whole race, but the game replays only the laps after the
takeover, and drivers' pace there often differs from their whole-race figure (tyre and fuel
saving early, a car that came alive later). One offset per driver, measured on the green,
non-pit laps after the takeover against the model's own clean-lap prediction, is added to
the base pace, shrunk toward zero when there are few laps:

    offset = mean residual x n / (n + SHRINK_LAPS)

It is one number per driver, independent of tyres and strategy, so a player's different
strategy still meets the same driver (a per-stint offset would encode how the driver ran
the real strategy, and would be wrong for any other).
"""

from __future__ import annotations

import pandas as pd

from .sim_reference import Car, _clean_lap

SHRINK_LAPS = 5.0


def post_takeover_offsets(
    laps: pd.DataFrame,
    base_pace: dict[str, float],
    compounds: dict,
    fuel_per_lap: float,
    fresh_tyre: dict | None,
    takeover_lap: int,
    shrink_laps: float = SHRINK_LAPS,
) -> dict[str, float]:
    """Per-driver pace offset (s/lap) on green, non-pit laps after the takeover lap."""
    post = laps[
        (laps["LapNumber"] > takeover_lap)
        & (laps["TrackStatus"].astype(str) == "1")
        & laps["PitInTime"].isna()
        & laps["PitOutTime"].isna()
        & laps["LapTime"].notna()
        & laps["TyreLife"].notna()
    ]
    residuals: dict[str, list[float]] = {}
    for r in post.itertuples():
        compound = None if pd.isna(r.Compound) else str(r.Compound)
        if r.Driver not in base_pace or compound not in compounds:
            continue
        car = Car(
            code=str(r.Driver),
            base_pace=base_pace[r.Driver],
            noise=0.0,
            compound=compound,
            tyre_age=max(0, int(r.TyreLife) - 1),  # the sim's age while running this lap
            total_time=0.0,
        )
        predicted = _clean_lap(car, compounds, fuel_per_lap, int(r.LapNumber), fresh_tyre)
        residuals.setdefault(str(r.Driver), []).append(float(r.LapTime) - predicted)
    return {
        code: sum(res) / len(res) * len(res) / (len(res) + shrink_laps)
        for code, res in residuals.items()
    }
