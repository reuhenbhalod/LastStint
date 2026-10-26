"""Takeover state and decision moments (Phase 1.5).

Records each car's state at the takeover lap (position, gap ahead, compound, tyre age),
reconstructs each driver's real strategy from pit stops, and surfaces candidate decision
moments. The final 2-4 decision moments per race are hand-picked in Phase 5.
"""

from __future__ import annotations

import pandas as pd

from .clean import gap_to_car_ahead


def real_strategy(laps: pd.DataFrame) -> dict[str, list[dict]]:
    """Per driver, the pit stops as {lap, to} — the out-lap and the compound fitted."""
    out: dict[str, list[dict]] = {}
    for driver, grp in laps.groupby("Driver"):
        stops = grp[grp["PitOutTime"].notna()].sort_values("LapNumber")
        out[str(driver)] = [
            {"lap": int(r.LapNumber), "to": str(r.Compound)} for r in stops.itertuples()
        ]
    return out


def state_at_takeover(laps: pd.DataFrame, takeover_lap: int) -> dict[str, dict]:
    """Per-car position, gap ahead (s), compound and tyre age at the takeover lap."""
    gaps = gap_to_car_ahead(laps)
    rows = laps[laps["LapNumber"] == takeover_lap]
    state: dict[str, dict] = {}
    for r in rows.itertuples():
        gap = gaps.get(r.Index)
        state[str(r.Driver)] = {
            "position": None if pd.isna(r.Position) else int(r.Position),
            "gapAhead": None if gap is None or pd.isna(gap) else round(float(gap), 3),
            "compound": None if pd.isna(r.Compound) else str(r.Compound),
            "tyreAge": None if pd.isna(r.TyreLife) else int(r.TyreLife),
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
