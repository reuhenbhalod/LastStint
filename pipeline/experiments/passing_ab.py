"""E1 screen (model v3 spec stage 7): passing mechanics on the TUNING races.

Each variant sets (REPASS_COOLDOWN, FOLLOW_GAP, PASS_MARGIN) in the reference sim and
reports G1 plus on-track passes per race against the real count (traffic_stats).
Measured on the tuning races: a follower that fails to pass sits a median 1.0 s behind
(p25 0.68), and a car just passed sits a median 1.25 s behind its passer (p25 0.76).

    uv run python experiments/passing_ab.py v0 v1 v2 v3 v4
"""

from __future__ import annotations

import sys

import traffic_stats

from pipeline import build as build_mod
from pipeline import sim_reference as sim
from pipeline import validate as validate_mod

VARIANTS = {
    "v0": (0, 0.3, 0.05),  # current
    "v1": (3, 0.3, 0.05),  # re-pass cooldown only
    "v2": (3, 1.0, 1.25),  # cooldown + measured medians
    "v3": (0, 1.0, 1.25),  # measured medians only
    "v4": (3, 0.7, 0.76),  # cooldown + measured p25s
    "v5": (3, 1.0, 0.05),  # cooldown + measured held gap, no time handed to the passer
    "v6": (3, 0.7, 0.05),
    "v7": (5, 0.3, 0.05),  # longer cooldown
    "v8": (5, 0.7, 0.05),
}
EXCLUDED = {"miami-2025"}

for name in sys.argv[1:]:
    sim.REPASS_COOLDOWN, sim.FOLLOW_GAP, sim.PASS_MARGIN = VARIANTS[name]
    rows, real_p, sim_p = [], 0, 0.0
    for rid, meta0 in build_mod.RACES.items():
        if meta0.get("split") != "tune" or rid in EXCLUDED:
            continue
        model, laps = build_mod.build_race_model(rid)
        meta = build_mod.resolved_meta(rid, laps)
        res = validate_mod.robust_status(
            model,
            validate_mod.real_finishing_gaps(laps),
            rival=meta.get("rival"),
            score_positions=meta.get("score_positions", 6),
        )
        _, rp = traffic_stats.real_stats(model, laps)
        _, sp = traffic_stats.sim_stats(model)
        real_p += rp
        sim_p += sp
        rows.append((rid, res.status, res.mean_gap_error))
        print(
            f"  {name} {rid:22s} {res.status:10s} {res.mean_gap_error:.2f}"
            f"  passes real {rp} sim {sp:.1f}",
            flush=True,
        )
    n = sum(s == "pass" for _, s, _ in rows)
    b = sum(s == "borderline" for _, s, _ in rows)
    mean = sum(e for *_, e in rows) / len(rows)
    print(
        f"== {name} {VARIANTS[name]}: {n} pass / {b} border, mean {mean:.2f}s;"
        f" passes/race real {real_p / len(rows):.1f} sim {sim_p / len(rows):.1f}",
        flush=True,
    )
