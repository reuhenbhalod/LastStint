"""A/B a mechanics switch on the TUNING races, in model mode and replay mode (spec stage 5).

    uv run python experiments/mech_ab.py pace.SIM_FRAME_LOSS
"""

from __future__ import annotations

import importlib
import sys

import ceiling
from pipeline import build as build_mod
from pipeline import sim_reference as sim
from pipeline import validate as validate_mod

EXCLUDED = {"miami-2025"}


def status(rid: str, replay: bool) -> tuple[str, float]:
    model, laps = build_mod.build_race_model(rid)
    meta = build_mod.resolved_meta(rid, laps)
    gaps = validate_mod.real_finishing_gaps(laps)
    m = model
    if replay:
        off = ceiling.offsets(model, laps, "replay")
        sim._clean_lap = lambda car, c, f, lap, fresh=None: ceiling.ORIGINAL(
            car, c, f, lap, fresh
        ) + off.get((car.code, lap), 0.0)
        m = {
            **model,
            "track": {**model["track"], "dirtyAirPenalty": 0.0},
            "drivers": [{**d, "noise": 0.0} for d in model["drivers"]],
        }
    try:
        res = validate_mod.robust_status(
            m, gaps, rival=meta.get("rival"), score_positions=meta.get("score_positions", 6)
        )
    finally:
        sim._clean_lap = ceiling.ORIGINAL
    return res.status, res.mean_gap_error


def main(switch: str, split: str = "tune") -> None:
    mod_name, attr = switch.rsplit(".", 1)
    mod = importlib.import_module(f"pipeline.{mod_name}")
    ids = [r for r, m in build_mod.RACES.items() if m.get("split") == split and r not in EXCLUDED]
    totals = {}
    for value in (False, True):
        setattr(mod, attr, value)
        for mode in ("model", "replay"):
            rows = [status(r, mode == "replay") for r in ids]
            for r, (st, err) in zip(ids, rows, strict=True):
                print(f"  {switch}={value} {mode:6s} {r:22s} {st:10s} {err:.2f}", flush=True)
            n = sum(st == "pass" for st, _ in rows)
            b = sum(st == "borderline" for st, _ in rows)
            mean = sum(e for _, e in rows) / len(rows)
            totals[(value, mode)] = f"{n} pass/{b} border, {mean:.2f}s"
    for k, v in totals.items():
        print(f"== {switch}={k[0]} {k[1]}: {v}")


if __name__ == "__main__":
    main(*sys.argv[1:])
