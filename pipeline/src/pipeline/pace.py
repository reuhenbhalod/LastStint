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

from dataclasses import dataclass

import numpy as np
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
    service: bool = False,
    eras_stops: bool = False,
    damp_pace: dict[str, float] | None = None,
    stint: StintTable | None = None,
) -> dict[tuple[str, int], float]:
    """(driver, out-lap) -> loss for each green-flag stop after the takeover, in the sim frame.
    A stop whose in-lap is the takeover lap is charged its out-lap only. `service`: the stops
    that changed no tyres instead (track.service_stops), on the set the car kept.

    `eras_stops` (Eras builds): a back-to-back stop (its in-lap the previous stop's out-lap,
    track.chained_in_laps) is charged its out-lap only too, so the shared lap counts once;
    and laps partly under a local yellow ("12", "21": track.racing_status) count as green, so
    such a stop is priced here rather than at the field-median figure. `stint` (pace by stint,
    Eras builds): each lap's clean lap carries the offset of the real stint it is in, as the sim
    runs it."""
    from .clean import fitted_compound
    from .track import chained_in_laps, pit_stops, racing_status, service_stops

    fitted = fitted_compound(laps)
    chained = chained_in_laps(laps) if eras_stops else set()
    green = racing_status if eras_stops else (lambda st: str(st) == "1")

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
            damp_pace=(damp_pace or {}).get(code),
            stint_pace=stint.on(code, int(row["LapNumber"])) if stint else 0.0,
            **car_fuel(row),  # a refuelling race: the tank on board, as the sim carries it
        )
        return _clean_lap(car, compounds, fuel_per_lap, int(row["LapNumber"]), fresh_tyre, weather)

    out: dict[tuple[str, int], float] = {}
    if service:
        # Stops with no tyre change (track.service_stops): the set runs on through the out-lap.
        for code, in_lap, out_lap in service_stops(laps, eras_stops):
            n_in, n_out = int(in_lap["LapNumber"]), int(out_lap["LapNumber"])
            if n_in < takeover_lap or code not in base_pace:
                continue
            compound = str(in_lap["Compound"])
            if compound not in compounds:
                continue
            out_wear = None if wear is None else float(wear.loc[out_lap.name])
            age = max(0, int(out_lap["TyreLife"]) - 1)
            loss = float(out_lap["LapTime"]) - clean(code, compound, age, out_lap, out_wear)
            if n_in > takeover_lap and (code, n_in) not in chained:
                in_wear = None if wear is None else float(wear.loc[in_lap.name])
                age = max(0, int(in_lap["TyreLife"]) - 1)
                loss += float(in_lap["LapTime"]) - clean(code, compound, age, in_lap, in_wear)
            out[(code, n_out)] = loss
        return out
    for code, in_lap, out_lap in pit_stops(laps):
        n_in, n_out = int(in_lap["LapNumber"]), int(out_lap["LapNumber"])
        if n_in < takeover_lap or code not in base_pace:
            continue
        own_in = n_in > takeover_lap and (code, n_in) not in chained
        # The in-lap is checked unless it is the previous stop's out-lap (Eras builds).
        check_in = (code, n_in) not in chained
        if not all(
            green(r["TrackStatus"]) for r in ((in_lap, out_lap) if check_in else (out_lap,))
        ):
            continue
        if pd.isna(out_lap["LapTime"]) or (check_in and pd.isna(in_lap["LapTime"])):
            continue
        new = str(fitted.loc[out_lap.name])
        if new not in compounds or (check_in and str(in_lap["Compound"]) not in compounds):
            continue
        loss = float(out_lap["LapTime"]) - clean(code, new, 0, out_lap)
        if own_in:
            age = max(0, int(in_lap["TyreLife"]) - 1)
            in_wear = None if wear is None else float(wear.loc[in_lap.name])
            loss += float(in_lap["LapTime"]) - clean(
                code, str(in_lap["Compound"]), age, in_lap, in_wear
            )
        out[(code, n_out)] = loss
    return out


# Eras model fix M2 (owner-approved, Nov 8 2026): pace by stint. One race pace per car averages
# away how a driver really ran each stint (a push after a stop, a leader managing to the flag,
# a car held up early that ran free later: docs/eras-races-report.md gap 3). Each scripted car
# gets an offset per real stint, fitted from its laps in that stint against the sim's clean lap
# for it (basePace, the post-takeover offset above included), shrunk toward 0:
#
#     offset = mean residual x n / (n + STINT_SHRINK_LAPS)
#
# (each residual clipped to +-STINT_CLIP s first, so one lap's spin can't set a stint's pace).
# The mean, not the median: a stint's time is the sum of its laps, and a leader easing off to
# the flag does it unevenly.
#
# The laps: green, not an in- or out-lap, dry (a wet race), not a fault's lap, after the
# takeover (the game replays only those). All of them, in traffic or not, as basePace's own fit
# counts them: measuring on clear-air laps only made every car that ran in clear air quicker
# than its basePace frame (the front-runners most), which broke passing races (austria-2002,
# malaysia-2013). Traffic: a stint run mostly behind another car (fewer than
# STINT_MIN_CLEAR_SHARE of its laps at least clean.TRAFFIC_GAP_SECONDS behind the car ahead)
# says how the car ahead ran, not this one, and the sim holds a car that can't pass itself:
# such a stint gets no offset. Nor does one with fewer than STINT_MIN_LAPS laps.
#
# A stint is keyed by the lap it began: its real stop's out-lap (realStrategy's lap), or 0 for
# the stint the car is on at the takeover. Both sims apply an offset while the car's current
# stint began on that lap, so a car on its real strategy runs each real stint at its real pace.
# A stint begun on a lap the real car never stopped on (a rival's reaction, an added stop) runs
# at 0, and a car that stays out past its real stop keeps the offset of the stint it is in. The
# player's car runs at 0 in live play (its effort is the player's: the pace modes), but in a
# replay of the real calls it is a scripted car like any other (Gate G1 replays the real race).
# Eras builds only (build.py's eras_build), never a reconstructed race (its laps are solved to
# the anchors, not timed).
STINT_SHRINK_LAPS = 5.0
STINT_CLIP = 3.0
STINT_MIN_LAPS = 3
STINT_MIN_CLEAR_SHARE = 0.25
STINT_DECIMALS = 3


def stint_key(stops: list[int], lap: int) -> int:
    """The key of the stint a car is on during `lap`: the latest of its `stops` (out-laps after
    the takeover) at or before it, else 0 (the stint it was on at the takeover)."""
    return max((s for s in stops if s <= lap), default=0)


@dataclass
class StintTable:
    """Each car's stint offsets (key -> s/lap) and its real stops after the takeover."""

    offsets: dict[str, dict[int, float]]
    stops: dict[str, list[int]]

    def on(self, code: str, lap: int) -> float:
        """The offset a car on its real strategy runs on `lap` (0 for none)."""
        table = self.offsets.get(code)
        if not table:
            return 0.0
        return table.get(stint_key(self.stops.get(code, []), lap), 0.0)

    def entries(self, code: str) -> list[dict]:
        """The car's drivers[].stintPace entries, by key."""
        return [
            {"lap": k, "offset": v}
            for k, v in sorted(self.offsets.get(code, {}).items())
            if v != 0.0
        ]


def real_stops(strategy: dict[str, list[dict]], takeover_lap: int) -> dict[str, list[int]]:
    """Per car, its real stops' out-laps after the takeover (the sim fires no stop before
    takeover + 1, so a stop on the takeover lap belongs to the takeover stint)."""
    return {
        code: sorted(int(st["lap"]) for st in stops if int(st["lap"]) > takeover_lap)
        for code, stops in strategy.items()
    }


def stint_offsets(
    laps: pd.DataFrame,
    base_pace: dict[str, float],
    compounds: dict,
    fuel_per_lap: float,
    fresh_tyre: dict | None,
    takeover_lap: int,
    stops: dict[str, list[int]],
    weather: dict | None = None,
    wear: pd.Series | None = None,
    shrink_laps: float = STINT_SHRINK_LAPS,
    min_laps: int = STINT_MIN_LAPS,
    clip: float = STINT_CLIP,
    min_clear_share: float = STINT_MIN_CLEAR_SHARE,
) -> StintTable:
    """Per car and real stint, the pace offset (s/lap) of its green racing laps after the
    takeover against the sim's clean lap at `base_pace` (the race model's basePace)."""
    from .clean import TRAFFIC_GAP_SECONDS, gap_to_car_ahead

    gap = gap_to_car_ahead(laps).reindex(laps.index)
    clear = gap.isna() | (gap >= TRAFFIC_GAP_SECONDS)  # NaN: the leader
    post = laps[
        (laps["LapNumber"] > takeover_lap)
        & (laps["TrackStatus"].astype(str) == "1")
        & laps["PitInTime"].isna()
        & laps["PitOutTime"].isna()
        & laps["LapTime"].notna()
        & laps["TyreLife"].notna()
    ]
    residuals: dict[tuple[str, int], list[float]] = {}
    in_clear: dict[tuple[str, int], int] = {}
    for r in post.itertuples():
        code = str(r.Driver)
        compound = None if pd.isna(r.Compound) else str(r.Compound)
        lap = int(r.LapNumber)
        if weather and weather["wetness"][lap - 1] >= DRY_LAP_BELOW:
            continue
        if code not in base_pace or compound not in compounds:
            continue
        car = Car(
            code=code,
            base_pace=base_pace[code],
            noise=0.0,
            compound=compound,
            tyre_age=max(0, int(r.TyreLife) - 1),  # the sim's age while running this lap
            total_time=0.0,
            tyre_wear=None if wear is None else float(wear.loc[r.Index]),
            **car_fuel(r),  # a refuelling race: the tank on board, as the sim carries it
        )
        predicted = _clean_lap(car, compounds, fuel_per_lap, lap, fresh_tyre, weather)
        key = stint_key(stops.get(code, []), lap)
        if bool(clear.loc[r.Index]):
            in_clear[(code, key)] = in_clear.get((code, key), 0) + 1
        residuals.setdefault((code, key), []).append(float(r.LapTime) - predicted)
    offsets: dict[str, dict[int, float]] = {}
    for (code, key), res in sorted(residuals.items()):
        n = len(res)
        if n < min_laps or in_clear.get((code, key), 0) < min_clear_share * n:
            continue
        mean = float(np.mean(np.clip(res, -clip, clip)))
        value = round(mean * n / (n + shrink_laps), STINT_DECIMALS)
        if value != 0.0:
            offsets.setdefault(code, {})[key] = value
    return StintTable(offsets=offsets, stops={c: list(s) for c, s in stops.items()})
