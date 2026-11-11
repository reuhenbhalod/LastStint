"""Race events (Phase 1.5).

Derives the frozen event timeline from the lap snapshot's TrackStatus and timing:
safety cars (code 4), virtual safety cars (6/7), red flags (5), and retirements. These
events are replayed unchanged by the simulator.

Rain is not derivable from the lap snapshot (it needs weather/race-control data) and is
added later for wet races; both Gate G1 races are dry.

Car faults (FAULT events) aren't derivable from timing either: they come from hand-checked
facts (incidents.fault_facts), fitted by pipeline/faults.py and merged in by with_faults.
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


NEUTRAL_CODES = {"4", "5", "6"}  # SC, red flag, VSC deployed


def deployment_times(track_status: list[dict]) -> list[float]:
    """Session times at which a neutralization began: a status of SC, VSC or red flag
    following one that wasn't neutralized (an SC replacing a VSC continues it)."""
    out, neutral = [], False
    for row in track_status:
        now = str(row["status"]) in NEUTRAL_CODES
        if now and not neutral:
            out.append(float(row["time"]))
        neutral = now
    return out


def green_entry_stops(
    laps: pd.DataFrame, events: list[dict], track_status: list[dict]
) -> set[tuple[str, int]]:
    """(driver, out-lap) of real stops whose out-lap is a neutralized race lap but whose pit
    entry came BEFORE that neutralization was deployed (Saudi 2022 PER, Miami 2024 PIA): they
    paid a green-flag stop, though the sim would price them by the out-lap's flag."""
    lead = leader_laps(laps).set_index("LapNumber")["Time"]
    deploys = deployment_times(track_status)
    neutral_laps: dict[int, float] = {}
    for e in events:
        if e["type"] not in ("SC", "VSC", "RED"):
            continue
        start = lead.get(e["lap"] - 1)
        end = lead.get(e["lap"])
        if start is None or end is None or pd.isna(start) or pd.isna(end):
            continue
        t = next((d for d in deploys if start - 1.0 <= d <= end), None)
        if t is None:
            continue
        for lap in range(e["lap"], e["lap"] + int(e.get("laps", 1))):
            neutral_laps[lap] = t
    out: set[tuple[str, int]] = set()
    pit_in = laps[laps["PitInTime"].notna()]
    for r in pit_in.itertuples():
        out_lap = int(r.LapNumber) + 1
        deployed = neutral_laps.get(out_lap)
        if deployed is not None and float(r.PitInTime) < deployed:
            out.add((str(r.Driver), out_lap))
    return out


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
    """All frozen events (neutralizations + retirements), sorted by lap. A red flag runs to
    the lap holding its stoppage, and the safety-car laps of its resumption follow it as an SC
    event (redflag.refine_events; its `restart` is added at assembly)."""
    from .redflag import refine_events

    events = refine_events(laps, neutralization_events(laps)) + retirement_events(laps, total_laps)
    return sorted(events, key=lambda e: (e["lap"], e["type"]))


def from_takeover(events: list[dict], takeover_lap: int) -> list[dict]:
    """The events a game taking over on `takeover_lap` replays: those from that lap on, plus
    any SC or VSC that started earlier and is still running after it, cut to start on the
    takeover lap (the sim then runs its remaining laps neutralised, and sees the period as
    already out rather than deployed on its first lap). A red flag isn't cut: its restart and
    free stops are tied to its real start."""
    out = []
    for e in events:  # in timeline order: a cut period starts before every event kept whole
        end = e["lap"] + int(e.get("laps", 1))  # the first lap after the period
        if e["lap"] >= takeover_lap:
            out.append(e)
        elif e["type"] in ("SC", "VSC") and end - 1 > takeover_lap:
            out.append({**e, "lap": takeover_lap, "laps": end - takeover_lap})
    return out


def with_faults(events: list[dict], faults: list[dict]) -> list[dict]:
    """The timeline with the race's FAULT events (faults.fault_events) merged in, by lap."""
    if not faults:
        return events
    return sorted([*events, *faults], key=lambda e: (e["lap"], e["type"]))
