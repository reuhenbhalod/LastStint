"""Race events (Phase 1.5).

Derives the frozen event timeline from the lap snapshot's TrackStatus and timing:
safety cars (code 4), virtual safety cars (6/7), red flags (5), and retirements. These
events are replayed unchanged by the simulator.

Rain is not derivable from the lap snapshot (it needs weather/race-control data) and is
added later for wet races; both Gate G1 races are dry.
"""

from __future__ import annotations

import pandas as pd


def _status(laps: pd.DataFrame) -> pd.Series:
    return laps["TrackStatus"].astype("string")


def neutralization_events(laps: pd.DataFrame) -> list[dict]:
    """SC / VSC / RED events with their start lap and duration, from TrackStatus.

    A lap counts as neutralized if any car's status carries the code that lap. Priority
    when codes overlap: red flag > safety car > virtual safety car.
    """
    status = _status(laps)
    flags = laps.assign(
        _sc=status.str.contains("4", na=False),
        _vsc=status.str.contains("6", na=False) | status.str.contains("7", na=False),
        _red=status.str.contains("5", na=False),
    )
    per_lap = flags.groupby("LapNumber")[["_sc", "_vsc", "_red"]].any()

    def kind(row: pd.Series) -> str | None:
        if row["_red"]:
            return "RED"
        if row["_sc"]:
            return "SC"
        if row["_vsc"]:
            return "VSC"
        return None

    types = per_lap.apply(kind, axis=1)

    events: list[dict] = []
    cur, start, length = None, 0, 0
    for lap, t in types.items():
        lap = int(lap)
        if t == cur:
            length += 1 if t is not None else 0
        else:
            if cur is not None:
                events.append({"lap": start, "type": cur, "laps": length})
            cur, start, length = t, lap, (1 if t is not None else 0)
    if cur is not None:
        events.append({"lap": start, "type": cur, "laps": length})
    return events


def retirement_events(laps: pd.DataFrame, total_laps: int | None = None) -> list[dict]:
    """Drivers whose last lap ends well before the leader takes the flag.

    Uses lap-end session Time rather than lap count, so lapped finishers (who cross the
    line with the leader) are not mistaken for retirements.
    """
    total = total_laps or int(laps["LapNumber"].max())
    lead = laps[laps["LapNumber"] == total]
    race_end = (
        float(lead["Time"].max()) if lead["Time"].notna().any() else float(laps["Time"].max())
    )
    typical_lap = float(laps["LapTime"].median())

    events: list[dict] = []
    for driver, grp in laps.groupby("Driver"):
        last = grp.loc[grp["LapNumber"].idxmax()]
        if pd.isna(last["Time"]):
            continue
        if float(last["Time"]) < race_end - 1.5 * typical_lap:
            events.append(
                {"lap": int(last["LapNumber"]), "type": "RETIREMENT", "driver": str(driver)}
            )
    return events


def extract_events(laps: pd.DataFrame, total_laps: int | None = None) -> list[dict]:
    """All frozen events (neutralizations + retirements), sorted by lap."""
    events = neutralization_events(laps) + retirement_events(laps, total_laps)
    return sorted(events, key=lambda e: (e["lap"], e["type"]))
