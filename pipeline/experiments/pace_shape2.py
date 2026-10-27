"""E2/E3 screens (model v3 spec stage 7) on the TUNING races, patched into the reference sim.

compound:K  driver x compound offset: each driver's mean residual per compound minus their
            overall mean, shrunk by n / (n + K)
quad:K      per-compound quadratic wear: residual regressed on (age^2 - mean) over all
            drivers, shrunk by n / (n + K)

  uv run python experiments/pace_shape2.py compound:10 compound:30 quad:0 quad:50
"""

from __future__ import annotations

import sys

import numpy as np

import ceiling
from pipeline import build as build_mod
from pipeline import sim_reference as sim
from pipeline import validate as validate_mod

EXCLUDED = {"miami-2025"}


def terms(model, laps, kind, k):
    res = ceiling.residuals(model, laps)
    post = laps[laps["LapNumber"] > model["race"]["takeoverLap"]]
    info = {
        (r.Driver, int(r.LapNumber)): (str(r.Compound), max(0, int(r.TyreLife) - 1))
        for r in post.itertuples()
        if not (r.TyreLife != r.TyreLife)
    }
    res["compound"] = [info.get((c, lap), (None, 0))[0] for c, lap in zip(res.code, res.lap)]
    res["age"] = [info.get((c, lap), (None, 0))[1] for c, lap in zip(res.code, res.lap)]
    if kind == "compound":
        out = {}
        for code, g in res.groupby("code"):
            mean = g["res"].mean()
            for comp, h in g.groupby("compound"):
                out[(code, comp)] = (h["res"].mean() - mean) * len(h) / (len(h) + k)
        return out
    out = {}
    for comp, g in res.groupby("compound"):
        x = g["age"].to_numpy(dtype=float) ** 2
        y = g["res"].to_numpy()
        if len(x) < 5 or np.var(x) == 0:
            continue
        q = float(np.cov(x, y, bias=True)[0, 1] / np.var(x)) * len(x) / (len(x) + k)
        out[comp] = (q, float(x.mean()))
    return out


def run(spec):
    kind, k = spec.split(":")
    rows = []
    for rid, meta0 in build_mod.RACES.items():
        if meta0.get("split") != "tune" or rid in EXCLUDED:
            continue
        model, laps = build_mod.build_race_model(rid)
        meta = build_mod.resolved_meta(rid, laps)
        t = terms(model, laps, kind, float(k))

        def patched(car, compounds, fuel, lap, fresh=None, _t=t):
            base = ceiling.ORIGINAL(car, compounds, fuel, lap, fresh)
            if kind == "compound":
                return base + _t.get((car.code, car.compound), 0.0)
            q, xm = _t.get(car.compound, (0.0, 0.0))
            return base + q * (car.tyre_age**2 - xm)

        sim._clean_lap = patched
        try:
            r = validate_mod.robust_status(
                model,
                validate_mod.real_finishing_gaps(laps),
                rival=meta.get("rival"),
                score_positions=meta.get("score_positions", 6),
            )
        finally:
            sim._clean_lap = ceiling.ORIGINAL
        rows.append((rid, r.status, r.mean_gap_error))
        print(f"  {spec:12s} {rid:22s} {r.status:10s} {r.mean_gap_error:.2f}", flush=True)
    n = sum(s == "pass" for _, s, _ in rows)
    b = sum(s == "borderline" for _, s, _ in rows)
    print(f"== {spec}: {n} pass / {b} border, mean {sum(e for *_, e in rows) / len(rows):.2f}s")


if __name__ == "__main__":
    for s in sys.argv[1:]:
        run(s)
