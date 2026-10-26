"""Track parameters (Phase 1.4).

Fits the track-level constants the simulator needs:

- pit loss (green) and pit loss under neutralization,
- dirty-air penalty (time lost per lap stuck behind a car),
- safety-car and virtual-safety-car lap times,
- overtaking difficulty (how hard it is for a faster car to get past).
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from .clean import gap_to_car_ahead
from .fit import LapTimeFit, predict


@dataclass
class TrackParams:
    pit_loss: float | None
    pit_loss_under_sc: float | None
    dirty_air_penalty: float
    overtake_difficulty: float
    green_lap_time: float
    sc_lap_time: float | None
    vsc_lap_time: float | None
    n_pass_opportunities: int
    n_passes: int


def _status(laps: pd.DataFrame) -> pd.Series:
    return laps["TrackStatus"].astype("string")


def _is_neutralized(status_value: object) -> bool:
    """A lap that ran under SC (code 4) or VSC (codes 6/7) for any part."""
    s = "" if status_value is None else str(status_value)
    return any(code in s for code in ("4", "6", "7"))


def pit_stops(laps: pd.DataFrame) -> list[tuple[str, pd.Series, pd.Series]]:
    """Return (driver, in_lap, out_lap) for each pit stop (in-lap paired with next out-lap)."""
    stops: list[tuple[str, pd.Series, pd.Series]] = []
    for driver, grp in laps.groupby("Driver"):
        grp = grp.sort_values("LapNumber")
        for _, in_lap in grp[grp["PitInTime"].notna()].iterrows():
            out = grp[(grp["LapNumber"] == in_lap["LapNumber"] + 1) & grp["PitOutTime"].notna()]
            if len(out):
                stops.append((str(driver), in_lap, out.iloc[0]))
    return stops


# Under a safety car the field is slowed, so pitting costs far less track time than under
# green. A single race has too few, too-noisy SC in/out laps to measure this directly
# (SC lap times swing wildly between the bunching lap and steady state), so we estimate it
# as a fraction of the green pit loss. The product doc's own example is 12.1/21.4 ~= 0.55.
# This is a calibration constant, refinable later with telemetry or pooled races.
SC_PIT_LOSS_FACTOR = 0.55


def pit_loss(laps: pd.DataFrame, clean_laps: pd.DataFrame) -> float | None:
    """Green-flag pit loss: (in-lap + out-lap) - 2 x driver median clean lap, median over
    green stops. SC/VSC stops are excluded (handled via SC_PIT_LOSS_FACTOR). None if no stops.
    """
    median_clean = clean_laps.groupby("Driver")["LapTime"].median()
    losses: list[float] = []
    for driver, in_lap, out_lap in pit_stops(laps):
        if driver not in median_clean.index:
            continue
        if _is_neutralized(in_lap["TrackStatus"]) or _is_neutralized(out_lap["TrackStatus"]):
            continue
        if pd.isna(in_lap["LapTime"]) or pd.isna(out_lap["LapTime"]):
            continue
        losses.append(float(in_lap["LapTime"] + out_lap["LapTime"] - 2 * median_clean[driver]))
    if not losses:
        return None
    return float(pd.Series(losses).median())


def dirty_air_penalty(traffic_laps: pd.DataFrame, fit: LapTimeFit) -> float:
    """Median seconds lost on a traffic lap vs the free-air pace the model predicts."""
    if traffic_laps.empty:
        return 0.0
    predicted = [
        predict(fit, r.Driver, r.Compound, r.TyreLife, r.LapNumber)
        for r in traffic_laps.itertuples()
    ]
    residual = traffic_laps["LapTime"].astype(float).to_numpy() - predicted
    return float(pd.Series(residual).median())


def sc_vsc_lap_times(laps: pd.DataFrame) -> dict[str, float | None]:
    """Median green / SC / VSC lap times, excluding pit in/out laps."""
    status = _status(laps)
    on_track = laps["LapTime"].notna() & laps["PitInTime"].isna() & laps["PitOutTime"].isna()

    def median_where(mask: pd.Series) -> float | None:
        vals = laps.loc[mask & on_track, "LapTime"]
        return float(vals.median()) if len(vals) else None

    is_sc = status.str.contains("4", na=False)
    is_vsc = (status.str.contains("6", na=False) | status.str.contains("7", na=False)) & ~is_sc
    return {
        "green": median_where(status == "1"),
        "sc": median_where(is_sc),
        "vsc": median_where(is_vsc),
    }


def extract_pass_events(laps: pd.DataFrame, close_gap: float = 2.0) -> pd.DataFrame:
    """On-track pass opportunities: a car within `close_gap` of the car ahead, and whether it
    got past on the next lap. Pit-stop-driven position swaps are excluded.
    """
    work = laps.copy()
    work["_gap"] = gap_to_car_ahead(work)
    pos = {(int(r.LapNumber), r.Driver): r.Position for r in work.itertuples()}
    lt = {(int(r.LapNumber), r.Driver): r.LapTime for r in work.itertuples()}
    pitting = {
        (int(r.LapNumber), r.Driver)
        for r in work.itertuples()
        if not pd.isna(r.PitInTime) or not pd.isna(r.PitOutTime)
    }

    rows: list[dict] = []
    for lap_num, grp in work.groupby("LapNumber"):
        lap = int(lap_num)
        order = grp.dropna(subset=["Position"]).sort_values("Position")
        codes = list(order["Driver"])
        gaps = dict(zip(order["Driver"], order["_gap"], strict=False))
        for i in range(1, len(codes)):
            follower, leader = codes[i], codes[i - 1]
            gap = gaps.get(follower)
            if gap is None or pd.isna(gap) or gap > close_gap:
                continue
            if any((lap, c) in pitting or (lap + 1, c) in pitting for c in (follower, leader)):
                continue
            pf, pl = pos.get((lap + 1, follower)), pos.get((lap + 1, leader))
            lf, ll = lt.get((lap, follower)), lt.get((lap, leader))
            if pf is None or pl is None or pd.isna(lf) or pd.isna(ll):
                continue
            rows.append(
                {
                    "lap": lap,
                    "follower": follower,
                    "leader": leader,
                    "gap": float(gap),
                    "pace_delta": float(ll - lf),  # positive: follower was quicker this lap
                    "passed": bool(pf < pl),
                }
            )
    return pd.DataFrame(rows)


def overtake_difficulty(laps: pd.DataFrame, close_gap: float = 2.0) -> tuple[float, int, int]:
    """Scalar difficulty in [0, 1] = share of close-following opportunities that did NOT pass.

    Returns (difficulty, n_opportunities, n_passes). Falls back to 0.5 with no data.
    """
    events = extract_pass_events(laps, close_gap=close_gap)
    n = len(events)
    if n == 0:
        return 0.5, 0, 0
    passes = int(events["passed"].sum())
    return 1.0 - passes / n, n, passes


def fit_track_params(
    laps: pd.DataFrame,
    clean_laps: pd.DataFrame,
    traffic_laps: pd.DataFrame,
    fit: LapTimeFit,
) -> TrackParams:
    """Fit every track-level parameter from one race."""
    times = sc_vsc_lap_times(laps)
    difficulty, n_opp, n_pass = overtake_difficulty(laps)
    green = times["green"]
    green_pit = pit_loss(laps, clean_laps)
    return TrackParams(
        pit_loss=green_pit,
        pit_loss_under_sc=(green_pit * SC_PIT_LOSS_FACTOR if green_pit is not None else None),
        dirty_air_penalty=dirty_air_penalty(traffic_laps, fit),
        overtake_difficulty=difficulty,
        green_lap_time=green if green is not None else float("nan"),
        sc_lap_time=times["sc"],
        vsc_lap_time=times["vsc"],
        n_pass_opportunities=n_opp,
        n_passes=n_pass,
    )
