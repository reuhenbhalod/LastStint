"""D2 evidence: where do cars that unlap behind a SC rejoin? For each SC after the takeover,
the restart gap (end of the last SC lap, same lap count) between each lapped-then-unlapped
car and the last car that was on the lead lap all along."""

from __future__ import annotations

import pandas as pd

from pipeline import build as build_mod

for rid in build_mod.RACES:
    model, laps = build_mod.build_race_model(rid)
    green = model["track"].get("greenLapTime") or 90
    for e in model["events"]:
        if e["type"] != "SC":
            continue
        start, end = e["lap"], e["lap"] + e["laps"] - 1
        t = laps.pivot_table(index="Driver", columns="LapNumber", values="Time")
        if start - 1 not in t.columns or end not in t.columns:
            continue
        lead_before = t[start - 1].min()
        before = t[start - 1] - lead_before
        restart = t[end] - t[end].min()
        lapped = before[before > green].index
        on_lead = before[before <= green].index
        if not len(lapped):
            continue
        back = restart[on_lead].max()
        rows = [
            f"{c} {before[c] - green:.0f}->{restart[c] - back:.0f}"
            for c in lapped
            if not pd.isna(restart.get(c))
        ]
        print(
            f"{rid:22s} SC {start}-{end} green {green:.0f}:"
            f" (s behind on track -> s behind queue back) {', '.join(rows)}"
        )
