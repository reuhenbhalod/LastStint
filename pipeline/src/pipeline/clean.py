"""Lap cleaning rules (Phase 1.2).

Clean laps show true pace. Drop: inaccurate laps, non-green laps, pit in/out-laps and lap
1, then split off traffic laps (kept separately to fit the dirty-air penalty), then drop
outliers slower than ~107% of the driver's median clean lap. Every rule's removal count is
logged so a bad threshold is obvious.
"""

from __future__ import annotations

import pandas as pd

# Traffic = within this many seconds of the car ahead (kept to fit the dirty-air penalty).
TRAFFIC_GAP_SECONDS = 1.0
# Outlier cutoff as a multiple of the driver's median clean lap.
OUTLIER_FACTOR = 1.07
# FastF1 per-lap TrackStatus: "1" means the whole lap ran under green.
GREEN = "1"


def is_green(laps: pd.DataFrame) -> pd.Series:
    """True where the lap ran entirely under green flag."""
    return laps["TrackStatus"].astype("string") == GREEN


def is_pit_lap(laps: pd.DataFrame) -> pd.Series:
    """True for pit in-laps and out-laps."""
    return laps["PitInTime"].notna() | laps["PitOutTime"].notna()


def is_lap_one(laps: pd.DataFrame) -> pd.Series:
    """True for the opening lap (standing start distorts pace)."""
    return laps["LapNumber"] == 1


def _new_set(laps: pd.DataFrame) -> pd.DataFrame:
    """Per out-lap row: whether tyres changed and the compound fitted.

    Tyres changed if the set differs on the out-lap itself, or on the lap after it: some
    timing (e.g. Bahrain 2018, Hungary 2019 HAM lap 49) still labels the out-lap with the old
    set and shows the new one from the next lap. A pit-lane pass without a stop (Brazil 2021,
    laps 7-9, the whole field routed through the pit lane under the SC) keeps the same set,
    tyre age counting up, on both laps.
    """
    ordered = laps.sort_values(["Driver", "LapNumber"])
    g = ordered.groupby("Driver")[["Compound", "TyreLife"]]
    prev, nxt = g.shift(1), g.shift(-1)
    same_now = (ordered["Compound"] == prev["Compound"]) & (
        ordered["TyreLife"] == prev["TyreLife"] + 1
    )
    same_next = (nxt["Compound"] == ordered["Compound"]) & (
        nxt["TyreLife"] == ordered["TyreLife"] + 1
    )
    changed = ordered["PitOutTime"].notna() & ~(same_now & same_next)
    fitted = ordered["Compound"].where(~same_now, nxt["Compound"])
    return pd.DataFrame({"changed": changed, "compound": fitted}).reindex(laps.index)


def tyre_change_out_laps(laps: pd.DataFrame) -> pd.Series:
    """True for out-laps where tyres were actually changed (see _new_set)."""
    return _new_set(laps)["changed"]


def fitted_compound(laps: pd.DataFrame) -> pd.Series:
    """The compound fitted at each out-lap (the out-lap's, or the next lap's if the timing
    still shows the old set on the out-lap)."""
    return _new_set(laps)["compound"]


def gap_to_car_ahead(laps: pd.DataFrame) -> pd.Series:
    """Seconds to the car ahead on the same lap. NaN for the leader or missing timing.

    Computed on the full field so track position is correct even when the car ahead was
    pitting or set an inaccurate lap.
    """
    gap = pd.Series(index=laps.index, dtype="float64")
    for _, grp in laps.groupby("LapNumber", sort=False):
        ordered = grp.sort_values("Position")
        # sorted by position ascending, so .diff() = own Time - car-ahead Time (>= 0)
        gap.loc[ordered.index] = ordered["Time"].diff()
    return gap


def clean_laps(laps: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, dict]:
    """Return (clean_laps, traffic_laps, removal_log) for one race's lap frame."""
    log: dict[str, int] = {"total": len(laps)}

    # Gap to car ahead needs the full field for correct positions.
    gap = gap_to_car_ahead(laps)

    remaining = laps

    def drop(mask_keep: pd.Series, key: str) -> None:
        nonlocal remaining
        mask_keep = mask_keep.reindex(remaining.index).fillna(False)
        log[key] = int((~mask_keep).sum())
        remaining = remaining[mask_keep]

    drop(remaining["IsAccurate"].fillna(False).astype(bool), "not_accurate")
    drop(is_green(remaining), "not_green")
    drop(~is_pit_lap(remaining), "pit_lap")
    drop(~is_lap_one(remaining), "lap_1")
    drop(remaining["LapTime"].notna(), "no_laptime")

    # Split off traffic laps (dirty air): kept separately, not counted as "removed pace".
    in_traffic = (gap.reindex(remaining.index) < TRAFFIC_GAP_SECONDS).fillna(False)
    traffic_laps = remaining[in_traffic].copy()
    traffic_laps["GapAhead"] = gap.reindex(traffic_laps.index)
    log["traffic"] = int(in_traffic.sum())
    remaining = remaining[~in_traffic]

    # Outliers: slower than OUTLIER_FACTOR x the driver's median clean lap.
    keep = pd.Series(True, index=remaining.index)
    for _, grp in remaining.groupby("Driver", sort=False):
        median = grp["LapTime"].median()
        keep.loc[grp.index] = grp["LapTime"] <= OUTLIER_FACTOR * median
    log["outlier"] = int((~keep).sum())
    clean = remaining[keep].copy()

    log["clean"] = len(clean)
    return clean, traffic_laps, log
