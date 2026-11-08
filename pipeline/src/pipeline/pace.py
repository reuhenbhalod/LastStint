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

from .refuel import car_fuel
from .sim_reference import Car, _clean_lap

SHRINK_LAPS = 5.0
# Stage 6 (T1): measure the offset on clear-air laps only (the sim adds dirty air itself).
CLEAR_AIR = False  # rejected (stage 6 T1): 5 pass, 4.85s on the tuning races


def post_takeover_offsets(
    laps: pd.DataFrame,
    base_pace: dict[str, float],
    compounds: dict,
    fuel_per_lap: float,
    fresh_tyre: dict | None,
    takeover_lap: int,
    shrink_laps: float = SHRINK_LAPS,
    weather: dict | None = None,
    wear: pd.Series | None = None,
) -> dict[str, float]:
    """Per-driver pace offset (s/lap) on green, non-pit laps after the takeover lap."""
    from .clean import TRAFFIC_GAP_SECONDS, gap_to_car_ahead

    clear = (
        (gap_to_car_ahead(laps) >= TRAFFIC_GAP_SECONDS).reindex(laps.index).fillna(True)
        if CLEAR_AIR
        else pd.Series(True, index=laps.index)
    )
    post = laps[
        clear
        & (laps["LapNumber"] > takeover_lap)
        & (laps["TrackStatus"].astype(str) == "1")
        & laps["PitInTime"].isna()
        & laps["PitOutTime"].isna()
        & laps["LapTime"].notna()
        & laps["TyreLife"].notna()
    ]
    residuals: dict[str, list[float]] = {}
    for r in post.itertuples():
        compound = None if pd.isna(r.Compound) else str(r.Compound)
        tyre_wear = None if wear is None else float(wear.loc[r.Index])
        # A wet race: the dry offset from dry laps (the wet ones have their own, wetPace).
        if weather and weather["wetness"][int(r.LapNumber) - 1] >= DRY_LAP_BELOW:
            continue
        if r.Driver not in base_pace or compound not in compounds:
            continue
        car = Car(
            code=str(r.Driver),
            base_pace=base_pace[r.Driver],
            noise=0.0,
            compound=compound,
            tyre_age=max(0, int(r.TyreLife) - 1),  # the sim's age while running this lap
            total_time=0.0,
            tyre_wear=tyre_wear,
            **car_fuel(r),  # a refuelling race: the tank on board, as the sim carries it
        )
        predicted = _clean_lap(car, compounds, fuel_per_lap, int(r.LapNumber), fresh_tyre, weather)
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
# A wet race's laps at this wetness and up aren't dry (wet.DRY_BELOW).
DRY_LAP_BELOW = 0.02


def sim_frame_losses(
    laps: pd.DataFrame,
    base_pace: dict[str, float],
    compounds: dict,
    fuel_per_lap: float,
    fresh_tyre: dict | None,
    takeover_lap: int,
    weather: dict | None = None,
    wear: pd.Series | None = None,
    wet_pace: dict[str, float] | None = None,
) -> dict[tuple[str, int], float]:
    """(driver, out-lap) -> loss for each green-flag stop after the takeover, in the sim frame.
    A stop whose in-lap is the takeover lap is charged its out-lap only."""
    from .clean import fitted_compound
    from .track import pit_stops

    fitted = fitted_compound(laps)

    def clean(code: str, compound: str, age: int, row: pd.Series, tyre_wear=None) -> float:
        car = Car(
            code=code,
            base_pace=base_pace[code],
            noise=0.0,
            compound=compound,
            tyre_age=age,
            total_time=0.0,
            tyre_wear=tyre_wear,
            wet_pace=(wet_pace or {}).get(code, 0.0),
            **car_fuel(row),  # a refuelling race: the tank on board, as the sim carries it
        )
        return _clean_lap(car, compounds, fuel_per_lap, int(row["LapNumber"]), fresh_tyre, weather)

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
        loss = float(out_lap["LapTime"]) - clean(code, new, 0, out_lap)
        if n_in > takeover_lap:
            age = max(0, int(in_lap["TyreLife"]) - 1)
            in_wear = None if wear is None else float(wear.loc[in_lap.name])
            loss += float(in_lap["LapTime"]) - clean(
                code, str(in_lap["Compound"]), age, in_lap, in_wear
            )
        out[(code, n_out)] = loss
    return out
