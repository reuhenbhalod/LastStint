"""E1 measurement (model v3 spec stage 7): traffic and passing, real vs sim, after the
takeover on green laps where neither car pits.

  traffic  share of car-laps that start within 1.0 s of the car ahead
  passes   on-track position swaps per race (neither car pitting on that lap or the next)
  held     share of car-laps within 2.0 s that the follower ends still behind

    uv run python experiments/traffic_stats.py [race ...]
"""

from __future__ import annotations

import sys

import pandas as pd

from pipeline import build as build_mod
from pipeline import sim_reference as sim
from pipeline.clean import gap_to_car_ahead

RUNS = 100
EXCLUDED = {"miami-2025"}


def real_stats(model, laps):
    takeover = model["race"]["takeoverLap"]
    gap = gap_to_car_ahead(laps)
    df = laps.assign(gap=gap)
    pit = df["PitInTime"].notna() | df["PitOutTime"].notna()
    pitting = set(zip(df.loc[pit, "Driver"], df.loc[pit, "LapNumber"].astype(int)))
    green = df["TrackStatus"].astype(str) == "1"
    post = df[(df["LapNumber"] > takeover) & green & ~pit & df["gap"].notna()]
    traffic = float((post["gap"] < 1.0).mean())
    # Passes: consecutive green laps, both cars not pitting, order flips.
    pos = df.pivot_table(index="LapNumber", columns="Driver", values="Position")
    passes = 0
    laps_n = int(df["LapNumber"].max())
    status = df.groupby("LapNumber")["TrackStatus"].first().astype(str)
    for lap in range(takeover + 1, laps_n):
        if status.get(lap) != "1" or status.get(lap + 1) != "1":
            continue
        a, b = pos.loc[lap], pos.loc[lap + 1]
        cars = [c for c in pos.columns if pd.notna(a[c]) and pd.notna(b[c])]
        cars = [c for c in cars if (c, lap + 1) not in pitting and (c, lap) not in pitting]
        for i, x in enumerate(cars):
            for y in cars[i + 1 :]:
                if (a[x] < a[y]) != (b[x] < b[y]) and abs(a[x] - a[y]) == 1:
                    passes += 1
    return traffic, passes


def sim_stats(model):
    counts = {"car_laps": 0, "traffic": 0, "passes": 0}
    original = sim._resolve_order

    def counting(order, cars, clean, pass_rngs, overtake, prev_time, pitted, *extra):
        live = [c for c in order if not cars[c].retired]
        before = list(live)
        for i in range(1, len(live)):
            a, b = live[i - 1], live[i]
            if a in pitted or b in pitted:
                continue
            counts["car_laps"] += 1
            if 0 <= prev_time[b] - prev_time[a] < 1.0:
                counts["traffic"] += 1
        original(order, cars, clean, pass_rngs, overtake, prev_time, pitted, *extra)
        after = [c for c in order if not cars[c].retired]
        idx = {c: k for k, c in enumerate(after)}
        for i in range(1, len(before)):
            a, b = before[i - 1], before[i]
            if a in pitted or b in pitted or a not in idx or b not in idx:
                continue
            if idx[b] < idx[a]:
                counts["passes"] += 1

    sim._resolve_order = counting
    try:
        for s in range(RUNS):
            sim.simulate(model, 5000 + s)
    finally:
        sim._resolve_order = original
    return counts["traffic"] / max(1, counts["car_laps"]), counts["passes"] / RUNS


if __name__ == "__main__":
    ids = sys.argv[1:] or [
        r for r, m in build_mod.RACES.items() if m.get("split") == "tune" and r not in EXCLUDED
    ]
    tot = [0.0, 0.0, 0.0, 0.0]
    for rid in ids:
        model, laps = build_mod.build_race_model(rid)
        rt, rp = real_stats(model, laps)
        st, sp = sim_stats(model)
        tot = [tot[0] + rt, tot[1] + st, tot[2] + rp, tot[3] + sp]
        print(
            f"{rid:22s} traffic real {rt:5.1%} sim {st:5.1%} | passes real {rp:3d} sim {sp:5.1f}",
            flush=True,
        )
    n = len(ids)
    print(
        f"== mean traffic real {tot[0] / n:.1%} sim {tot[1] / n:.1%} | passes real {tot[2] / n:.1f} sim {tot[3] / n:.1f}"
    )
