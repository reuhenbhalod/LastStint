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


# Mechanics M1 (model v3 spec, stage 5): a real green stop's frozen loss in the sim's own
# frame. The sim runs a stop's in- and out-laps at its clean-lap pace and adds the loss on the
# out-lap, so the loss that reproduces the real time is the real in- and out-laps minus the
# sim's prediction for them. (The field-median measurement in track.stop_records is in a
# different frame: it ignores the tyres each car is on, which the sim then adds again.)
SIM_FRAME_LOSS = True


def sim_frame_losses(
    laps: pd.DataFrame,
    base_pace: dict[str, float],
    compounds: dict,
    fuel_per_lap: float,
    fresh_tyre: dict | None,
    takeover_lap: int,
) -> dict[tuple[str, int], float]:
    """(driver, out-lap) -> loss for each green-flag stop after the takeover, in the sim frame.
    A stop whose in-lap is the takeover lap is charged its out-lap only."""
    from .clean import fitted_compound
    from .track import pit_stops

    fitted = fitted_compound(laps)

    def clean(code: str, compound: str, age: int, lap: int) -> float:
        car = Car(
            code=code,
            base_pace=base_pace[code],
            noise=0.0,
            compound=compound,
            tyre_age=age,
            total_time=0.0,
        )
        return _clean_lap(car, compounds, fuel_per_lap, lap, fresh_tyre)

    out: dict[tuple[str, int], float] = {}
    for code, in_lap, out_lap in pit_stops(laps):
        n_in, n_out = int(in_lap["LapNumber"]), int(out_lap["LapNumber"])
        if n_in < takeover_lap or code not in base_pace:
            continue
        if any(str(r["TrackStatus"]) != "1" for r in (in_lap, out_lap)):
            continue
        if pd.isna(in_lap["LapTime"]) or pd.isna(out_lap["LapTime"]):
            continue
        new = str(fitted.loc[out_lap.name])
        if new not in compounds or str(in_lap["Compound"]) not in compounds:
            continue
        loss = float(out_lap["LapTime"]) - clean(code, new, 0, n_out)
        if n_in > takeover_lap:
            age = max(0, int(in_lap["TyreLife"]) - 1)
            loss += float(in_lap["LapTime"]) - clean(code, str(in_lap["Compound"]), age, n_in)
        out[(code, n_out)] = loss
    return out
