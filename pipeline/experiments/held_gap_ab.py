"""F3 screen (model v3 spec stage 8): a RANDOM held gap on the TUNING races.

Real followers that fail to pass sit anywhere from 0.44 s (p10) to 2.08 s (p90) behind,
median 1.09; real passes start from a median 0.46 s (p10 0.15, p90 0.97). The sim holds a
failed follower at a fixed FOLLOW_GAP (0.3 s), always in prime passing range. Each variant
draws the held gap per hold from uniform [lo, hi] (from the follower's pass stream).

  adv:B:S:LO:HI  held gap = (B - S * clamp(advantage, 0, 1)) * uniform [LO, HI]: real held
                 gaps shrink from ~1.1 s (advantage < 0.3 s/lap) to ~0.7 s (> 1.0 s/lap)

  +clear         suffix: post-takeover pace from clear-air laps only (pace.CLEAR_AIR)

    uv run python experiments/held_gap_ab.py fixed:0.3 u:0.2:1.0 adv:1.1:0.4:0.65:1.35+clear
"""

from __future__ import annotations

import sys

import traffic_stats

from pipeline import build as build_mod
from pipeline import pace as pace_mod
from pipeline import sim_reference as sim
from pipeline import validate as validate_mod

EXCLUDED = {"miami-2025"}
ORIGINAL = sim._resolve_order


def patched_resolve(lo, hi, base=None, slope=0.0):
    def resolve(order, cars, clean, pass_rngs, overtake, prev_time, pitted, recent=None, lap=0):
        live = [c for c in order if not cars[c].retired]
        for i in range(1, len(live)):
            a, b = cars[live[i - 1]], cars[live[i]]
            if a.code in pitted or b.code in pitted:
                continue
            gap = prev_time[b.code] - prev_time[a.code]
            if not 0 <= gap < sim.PASS_WINDOW:
                continue
            advantage = clean[a.code] - clean[b.code]
            cooling = (
                recent is not None
                and sim.REPASS_COOLDOWN > 0
                and lap - recent.get((b.code, a.code), -(10**6)) <= sim.REPASS_COOLDOWN
            )
            rng = pass_rngs[b.code]
            if not cooling and rng.next() < sim.pass_probability(overtake, advantage, gap):
                if recent is not None:
                    recent[(a.code, b.code)] = lap
                if b.total_time >= a.total_time:
                    b.total_time = a.total_time - sim.PASS_MARGIN
            else:
                held = lo + (hi - lo) * rng.next()
                if base is not None:  # gap shrinks with pace advantage; lo/hi scale it
                    held *= base - slope * min(max(advantage, 0.0), 1.0)
                if b.total_time < a.total_time + held:
                    b.total_time = a.total_time + held
        live.sort(key=lambda c: cars[c].total_time)
        order[:] = live + [c for c in order if cars[c].retired]

    return resolve


def run(spec):
    # a "+clear" suffix also measures post-takeover pace on clear-air laps only (T1)
    pace_mod.CLEAR_AIR = spec.endswith("+clear")
    parts = spec.removesuffix("+clear").split(":")
    if parts[0] == "adv":  # adv:base:slope:lo:hi
        base, slope, lo, hi = map(float, parts[1:])
        sim._resolve_order = patched_resolve(lo, hi, base, slope)
    elif parts[0] == "fixed":
        sim._resolve_order = ORIGINAL
        sim.FOLLOW_GAP = float(parts[1])
    else:
        sim._resolve_order = patched_resolve(float(parts[1]), float(parts[2]))
    rows, real_p, sim_p = [], 0, 0.0
    try:
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
                f"  {spec:12s} {rid:22s} {res.status:10s} {res.mean_gap_error:.2f}"
                f"  passes real {rp} sim {sp:.1f}",
                flush=True,
            )
    finally:
        sim._resolve_order = ORIGINAL
        sim.FOLLOW_GAP = 0.3
        pace_mod.CLEAR_AIR = False
    n = sum(s == "pass" for _, s, _ in rows)
    b = sum(s == "borderline" for _, s, _ in rows)
    mean = sum(e for *_, e in rows) / len(rows)
    print(
        f"== {spec}: {n} pass / {b} border, mean {mean:.2f}s;"
        f" passes/race real {real_p / len(rows):.1f} sim {sim_p / len(rows):.1f}",
        flush=True,
    )


if __name__ == "__main__":
    for s in sys.argv[1:]:
        run(s)
