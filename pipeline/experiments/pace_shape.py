"""D1 screen (model v3 spec stage 6): per-driver pace shape on the TUNING races.

On the green, non-pit laps after the takeover, each driver's residual against the current
model is regressed on x (tyre age for "wear", race lap for "drift"); the slope is shrunk by
n / (n + K) and applied in the sim as slope x (x - the driver's mean x), so the driver's
average pace is unchanged. Patched into the reference sim for screening only.

    uv run python experiments/pace_shape.py wear:10 wear:30 drift:10 drift:30
"""

from __future__ import annotations

import sys

import ceiling
import numpy as np
import pandas as pd

from pipeline import build as build_mod
from pipeline import sim_reference as sim
from pipeline import validate as validate_mod

EXCLUDED = {"miami-2025"}


def slopes(model, laps, kind, k):
    res = ceiling.residuals(model, laps)  # code, lap, stint, res (vs the model's clean lap)
    ages = {}
    post = laps[laps["LapNumber"] > model["race"]["takeoverLap"]]
    for r in post.itertuples():
        if not pd.isna(r.TyreLife):
            ages[(r.Driver, int(r.LapNumber))] = max(0, int(r.TyreLife) - 1)
    out = {}
    for code, g in res.groupby("code"):
        x = np.array(
            [ages.get((code, lap), np.nan) if kind == "wear" else lap for lap in g["lap"]],
            dtype=float,
        )
        y = g["res"].to_numpy()
        ok = ~np.isnan(x)
        x, y = x[ok], y[ok]
        if len(x) < 3 or np.var(x) == 0:
            continue
        b = float(np.cov(x, y, bias=True)[0, 1] / np.var(x)) * len(x) / (len(x) + k)
        out[code] = (b, float(x.mean()))
    return out


def run(spec: str) -> None:
    kind, k = spec.split(":")
    rows = []
    for rid, meta0 in build_mod.RACES.items():
        if meta0.get("split") != "tune" or rid in EXCLUDED:
            continue
        model, laps = build_mod.build_race_model(rid)
        meta = build_mod.resolved_meta(rid, laps)
        sl = slopes(model, laps, kind, float(k)) if kind != "none" else {}

        def patched(car, compounds, fuel, lap, fresh=None, _s=sl):
            t = ceiling.ORIGINAL(car, compounds, fuel, lap, fresh)
            if car.code in _s:
                b, xm = _s[car.code]
                t += b * ((car.tyre_age if kind == "wear" else lap) - xm)
            return t

        sim._clean_lap = patched
        try:
            res = validate_mod.robust_status(
                model,
                validate_mod.real_finishing_gaps(laps),
                rival=meta.get("rival"),
                score_positions=meta.get("score_positions", 6),
            )
        finally:
            sim._clean_lap = ceiling.ORIGINAL
        rows.append((rid, res.status, res.mean_gap_error))
        print(f"  {spec:9s} {rid:22s} {res.status:10s} {res.mean_gap_error:.2f}", flush=True)
    n = sum(s == "pass" for _, s, _ in rows)
    b = sum(s == "borderline" for _, s, _ in rows)
    mean = sum(e for *_, e in rows) / len(rows)
    print(f"== {spec}: {n} pass / {b} border, mean {mean:.2f}s", flush=True)


if __name__ == "__main__":
    for s in sys.argv[1:]:
        run(s)
