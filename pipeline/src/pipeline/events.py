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


def leader_laps(laps: pd.DataFrame) -> pd.DataFrame:
    """One row per race lap: the leader's lap, which defines race-lap numbering.

    Lapped cars run behind in lap count, so their "lap 34" can coincide with the leader's
    lap 36. Events and retirements are keyed to the leader's laps to avoid that skew.
    Falls back to the earliest lap-end Time per lap where Position is missing.
    """
    timed = laps.dropna(subset=["Time"])
    by_pos = timed[timed["Position"] == 1].drop_duplicates("LapNumber")
    by_time = timed.loc[timed.groupby("LapNumber")["Time"].idxmin()]
    missing = by_time[~by_time["LapNumber"].isin(by_pos["LapNumber"])]
    return pd.concat([by_pos, missing]).sort_values("LapNumber").reset_index(drop=True)


def race_lap_at(laps: pd.DataFrame, time: float) -> int:
    """The race lap (leader's lap number) in progress at session time `time`."""
    lead = leader_laps(laps)
    ended_after = lead[lead["Time"] >= time]
    if ended_after.empty:
        return int(lead["LapNumber"].max())
    return int(ended_after["LapNumber"].iloc[0])


def neutralization_events(laps: pd.DataFrame) -> list[dict]:
    """SC / VSC / RED events with their start lap and duration, from TrackStatus.

    A race lap counts as neutralized if the leader's status carries the code that lap.
    Priority when codes overlap: red flag > safety car > virtual safety car.
    """
    lead = leader_laps(laps)
    status = _status(lead)
    flags = lead.assign(
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
    line with the leader) are not mistaken for retirements. The event lap is the race lap
    (leader's lap) in progress when the car stopped, not the car's own lap count.
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
                {
                    "lap": race_lap_at(laps, float(last["Time"])),
                    "type": "RETIREMENT",
                    "driver": str(driver),
                }
            )
    return events


def extract_events(laps: pd.DataFrame, total_laps: int | None = None) -> list[dict]:
    """All frozen events (neutralizations + retirements), sorted by lap."""
    events = neutralization_events(laps) + retirement_events(laps, total_laps)
    return sorted(events, key=lambda e: (e["lap"], e["type"]))
