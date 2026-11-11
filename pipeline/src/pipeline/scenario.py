"""Takeover state and decision moments (Phase 1.5).

Records each car's state at the takeover lap (position, gap ahead, compound, tyre age),
reconstructs each driver's real strategy from pit stops, and surfaces candidate decision
moments. The final 2-4 decision moments per race are hand-picked in Phase 5.
"""

from __future__ import annotations

import pandas as pd

from .clean import fitted_compound, gap_to_car_ahead, tyre_change_out_laps

DRY_COMPOUNDS = ("SOFT", "MEDIUM", "HARD")
WET_TYRES = ("INTERMEDIATE", "WET")


def real_strategy(laps: pd.DataFrame) -> dict[str, list[dict]]:
    """Per driver, the pit stops as {lap, to} — the out-lap and the compound fitted."""
    out: dict[str, list[dict]] = {}
    changed = tyre_change_out_laps(laps)
    fitted = fitted_compound(laps)
    for driver, grp in laps.groupby("Driver"):
        stops = grp[changed.loc[grp.index].fillna(False).astype(bool)].sort_values("LapNumber")
        out[str(driver)] = [
            {"lap": int(r.LapNumber), "to": str(fitted.loc[r.Index])} for r in stops.itertuples()
        ]
    return out


def state_at_takeover(laps: pd.DataFrame, takeover_lap: int) -> dict[str, dict]:
    """Per-car position, gap ahead (s), compound, tyre age and the compounds used so far, the
    takeover lap's included, at the takeover lap. Wet tyres count: a car that has run one is
    free of the two-compound rule (sim.ts ruleSatisfied), so a car on intermediates at the
    takeover, or one that started on them, may finish on a single dry compound."""
    gaps = gap_to_car_ahead(laps)
    rows = laps[laps["LapNumber"] == takeover_lap]
    tyres = DRY_COMPOUNDS + WET_TYRES
    so_far = laps[(laps["LapNumber"] <= takeover_lap) & laps["Compound"].isin(tyres)]
    used = so_far.groupby("Driver")["Compound"].agg(lambda c: sorted(set(map(str, c))))
    state: dict[str, dict] = {}
    for r in rows.itertuples():
        gap = gaps.get(r.Index)
        state[str(r.Driver)] = {
            "position": None if pd.isna(r.Position) else int(r.Position),
            "gapAhead": None if gap is None or pd.isna(gap) else round(float(gap), 3),
            "compound": None if pd.isna(r.Compound) else str(r.Compound),
            "tyreAge": None if pd.isna(r.TyreLife) else int(r.TyreLife),
            "compoundsUsed": list(used.get(r.Driver, [])),
        }
    return state


def candidate_decision_moments(laps: pd.DataFrame, events: list[dict]) -> list[int]:
    """Candidate decision-moment laps: neutralization starts and every pit stop.

    A superset surfaced for review; the final 2-4 genuine dilemmas are hand-picked in
    Phase 5 using the grader output.
    """
    moments: set[int] = set()
    for event in events:
        if event["type"] in ("SC", "VSC", "RED", "RAIN"):
            moments.add(int(event["lap"]))
    for stops in real_strategy(laps).values():
        for stop in stops:
            moments.add(int(stop["lap"]))
    return sorted(moments)


# Fastest-lap stops (2019-2024, when the fastest lap scored a point): a late green stop for
# fresh tyres, made only because the gap behind was big enough to stop for free. In a what-if
# where that gap is gone, a real team wouldn't stop, so the sims treat these as optional.
FASTEST_LAP_POINT_YEARS = range(2019, 2025)
FASTEST_LAP_WINDOW = 8  # laps from the flag


def _gap_behind(laps: pd.DataFrame, driver: str, lap: int) -> float:
    """Seconds to the car behind at the end of `lap` (inf if last or untimed: free)."""
    field = laps[laps["LapNumber"] == lap].dropna(subset=["Position", "Time"])
    field = field.sort_values("Position")
    codes = list(field["Driver"].astype(str))
    if driver not in codes:
        return -1.0
    i = codes.index(driver)
    if i + 1 >= len(codes):
        return float("inf")
    times = list(field["Time"].astype(float))
    return times[i + 1] - times[i]


def fastest_lap_stops(
    laps: pd.DataFrame, losses: dict[tuple[str, int], float], default_loss: float
) -> set[tuple[str, int]]:
    """(driver, out-lap) of real stops in the last FASTEST_LAP_WINDOW laps, on green in- and
    out-laps, made with a gap behind above the stop's cost at the end of the lap before the
    in-lap or of the in-lap itself (Hungary 2019 VER stopped only after HAM passed him on the
    in-lap; an in-lap's own time includes pit entry, so either may show the free gap)."""
    total = int(laps["LapNumber"].max())
    status = {(str(r.Driver), int(r.LapNumber)): str(r.TrackStatus) for r in laps.itertuples()}
    out: set[tuple[str, int]] = set()
    for driver, stops in real_strategy(laps).items():
        for stop in stops:
            out_lap = stop["lap"]
            if out_lap < total - FASTEST_LAP_WINDOW:
                continue
            if any(status.get((driver, n)) != "1" for n in (out_lap - 1, out_lap)):
                continue
            cost = losses.get((driver, out_lap), default_loss)
            if any(_gap_behind(laps, driver, n) > cost for n in (out_lap - 2, out_lap - 1)):
                out.add((driver, out_lap))
    return out


TAKEOVER_LEAD = 3  # laps of play before the first strategic event
TAKEOVER_EARLIEST_EVENT = 10  # ignore events before this lap (opening-lap chaos, lap-1 stops)


def default_takeover_lap(laps: pd.DataFrame, events: list[dict], drivers: list[str]) -> int:
    """Phase 1 close-out D3: TAKEOVER_LEAD laps before the first strategic event after lap
    TAKEOVER_EARLIEST_EVENT that involves `drivers` (the user and the rival): one of their
    stops (its in-lap) or the start of a SC/VSC. Falls back to mid-race if there is none.
    """
    candidates: list[int] = []
    strategy = real_strategy(laps)
    for d in drivers:
        candidates += [s["lap"] - 1 for s in strategy.get(d, [])]
    candidates += [e["lap"] for e in events if e["type"] in ("SC", "VSC")]
    after = [lap for lap in candidates if lap > TAKEOVER_EARLIEST_EVENT]
    total = int(laps["LapNumber"].max())
    first = min(after) if after else total // 2
    return max(2, first - TAKEOVER_LEAD)
