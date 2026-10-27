"""Mid-race accuracy (realism check): G1 scores the finish only. Here, on each green lap at
25%, 50% and 75% of the way from the takeover to the flag, the sim's mean gap to the leader
for the real top 6 at that lap is compared with the real gap, replaying real strategies.

    uv run python experiments/midrace.py [race ...]
"""

from __future__ import annotations

import sys

import numpy as np

from pipeline import build as build_mod
from pipeline import sim_reference as sim

RUNS = 200


def snapshots(model, seeds, laps_wanted):
    out = {lap: [] for lap in laps_wanted}
    original = sim._resolve_order

    def hook(order, cars, clean, pass_rngs, overtake, prev_time, pitted, recent=None, lap=0):
        original(order, cars, clean, pass_rngs, overtake, prev_time, pitted, recent, lap)
        if lap in out:
            out[lap].append({c: cars[c].total_time for c in cars if not cars[c].retired})

    sim._resolve_order = hook
    try:
        for s in seeds:
            sim.simulate(model, s)
    finally:
        sim._resolve_order = original
    return out


def check(rid):
    model, laps = build_mod.build_race_model(rid)
    t0, total = model["race"]["takeoverLap"], model["race"]["laps"]
    green = set(laps[laps["TrackStatus"].astype(str) == "1"]["LapNumber"].astype(int))
    wanted = []
    for f in (0.25, 0.5, 0.75):
        lap = int(t0 + f * (total - t0))
        while lap not in green and lap < total:
            lap += 1
        wanted.append(lap)
    snaps = snapshots(model, range(30000, 30000 + RUNS), wanted)
    rows = []
    for lap in wanted:
        real = laps[laps["LapNumber"] == lap].dropna(subset=["Time", "Position"])
        real = real.sort_values("Position")
        lead_t = float(real["Time"].iloc[0])
        top = [(str(r.Driver), float(r.Time) - lead_t) for r in real.head(6).itertuples()]
        errs, order_ok = [], 0
        for snap in snaps[lap]:
            min(snap.values())
            sim_order = sorted(snap, key=snap.get)[:3]
            order_ok += sim_order == [c for c, _ in top[:3]]
        for c, real_gap in top:
            vals = [s[c] - min(s.values()) for s in snaps[lap] if c in s]
            if vals:
                errs.append(abs(np.mean(vals) - real_gap))
        rows.append((lap, float(np.mean(errs)), order_ok / max(1, len(snaps[lap])), top[0][0]))
    return rows


if __name__ == "__main__":
    ids = sys.argv[1:]
    allerr = []
    for rid in ids:
        rows = check(rid)
        allerr += [e for _, e, _, _ in rows]
        cells = "  ".join(
            f"lap {lap}: gap err {e:4.1f}s, top-3 order {o:4.0%} (real leader {ldr})"
            for lap, e, o, ldr in rows
        )
        print(f"{rid:22s} {cells}", flush=True)
    print(f"== mean top-6 gap error mid-race {np.mean(allerr):.1f}s")
