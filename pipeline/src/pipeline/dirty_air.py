"""Dirty air: the time a follower loses a lap behind another car (Eras sim fix W3).

Measured the same way on real laps and on the sims' laps, so the two compare:

- A lap's *residual* is its time less the car's clean-air pace for that lap: on real laps the
  race's dry lap model (fit.predict); in a sim the lap's `clean` time (`_clean_lap` plus the
  car's faults), so the residual holds the lap noise, the dirty-air penalty and whatever the
  hold rule (a failed pass held behind) costs.
- The lap's *gap* is the gap to the car directly ahead at the start of the lap (the line on
  the lap before), the gap the sims price dirty air and the pass roll on.
- Kept: green laps after a green lap (no SC restart lap), from lap 2, neither the car nor the
  car directly ahead pitting on the lap (in- or out-lap), with a model pace and a lap time.
- The loss in a gap band is the mean residual there less the car's own clear-air level in the
  same stint (the median residual of its laps 3 s or more behind the car ahead, CLEAR_GAP),
  so a stint run faster or slower than the model (a car catching another is often running
  faster than its fitted pace) doesn't read as dirty air. Stints with no clear lap are left
  out; residuals more than TRIM s from the stint's clear level (mistakes, damage) too.

The model (`fit`, config/dirty_air.json; fitted on the 92 dry timed races of overtaking.py's
fit). Per era group (overtaking.group_of: drs 2011-2025, noDrs before) the pooled loss in the
four bands to PASS_WINDOW is the *shape* (drs 0.67 / 0.49 / 0.25 / 0.12 s, noDrs 1.32 / 0.76 /
0.43 / 0.17 s). A race's *scale* on it is the weighted least-squares fit of its own band
losses (standard errors clustered by stint), partly pooled toward its track layout's
(overtaking.layout_of): weight tauRace / (tauRace + its sampling variance), tauRace the true
within-layout variance of the scale; the layout's own scale is shrunk toward 1 the same way
(tauLayout). Monaco's DRS layout runs at 2.1x the shape, Bahrain's at 0.49x. The sims' cost
by band (track.dirtyAirBands) is the race's real loss less the group's `simOffset`, the loss
the sims' hold rule (a failed follower held FOLLOW_GAP behind, inheriting the car ahead's lap)
makes by itself: calibrated (`calibrate_race`, `pool_calibration`) by running the reference sim
on every Eras-built fit race with the bands at the real loss, drs 0.09 / 0.12 / 0.14 / 0.13 s.

Measured and not adopted (docs/g1-report.md, "Eras sim fix W3"): the switch IN_ERAS_BUILDS is
off, so no race file carries the bands. Real followers lose more than the sims' (0.89 / 0.57
/ 0.23 / 0.13 s against 0.58 / 0.50 / 0.19 / 0.14 s over the 28 races of M3), but the bands
that match them make robust G1 worse on those races (11 pass, 2.61 s mean -> 8 pass, 3.32 s),
and with them M3's realistic-passing options worse still (heldGap 0.79 s: 4 pass, 4.48 s, the
pass count at the real one; no pass without a roll: 7 pass, 3.79 s), as is taking the real
loss off the pace offsets' laps (DETRAFFIC: 6 pass, 4.16 s). The race pace (basePace, the
stint offsets) is measured on every lap, traffic included, so any cost the sims add on
top counts a car's real traffic twice; a larger cost widens the error.
"""

from __future__ import annotations

import json
import math
from functools import cache
from pathlib import Path

import numpy as np
import pandas as pd

from .clean import gap_to_car_ahead
from .fit import LapTimeFit, predict
from .paths import CONFIG_DIR
from .refuel import fuel_lap_of

DIRTY_AIR_PATH = CONFIG_DIR / "dirty_air.json"
# The switches (experiments set them; build.py reads them): the model in Eras builds of timed
# races, the real loss taken off the pace offsets' laps, and the held gap of a failed follower
# (None: the sims' FOLLOW_GAP).
IN_ERAS_BUILDS = False
DETRAFFIC = False
HELD_GAP: float | None = None
SIM_OFFSET: list[float] | None = None  # experiments: override the table's simOffset
LOSS_MULT = 1.0  # experiments: scale the real loss
# Start-of-lap gap bands (s). The sims price dirty air within DIRTY_AIR_RANGE (1.0 s) and roll
# a pass within PASS_WINDOW (2.0 s); 2-3 s is the edge, CLEAR_GAP and over clear air.
BANDS = [(0.0, 0.5), (0.5, 1.0), (1.0, 1.5), (1.5, 2.0), (2.0, 3.0)]
CLEAR_GAP = 3.0
TRIM = 3.0  # s: a residual this far from the stint's clear-air level is left out


def band_of(gap: float) -> str | None:
    """The band label ("0.0-0.5", ...) of a start-of-lap gap, "clear" at CLEAR_GAP or more."""
    if gap is None or not math.isfinite(gap) or gap < 0:
        return None
    if gap >= CLEAR_GAP:
        return "clear"
    for lo, hi in BANDS:
        if lo <= gap < hi:
            return f"{lo:.1f}-{hi:.1f}"
    return None


BAND_LABELS = [f"{lo:.1f}-{hi:.1f}" for lo, hi in BANDS]


def real_laps(laps: pd.DataFrame, fit: LapTimeFit) -> pd.DataFrame:
    """One row per kept real lap: driver, stint, lap, gap (start of lap) and residual."""
    work = laps.assign(_gap=gap_to_car_ahead(laps))
    status = work.groupby("LapNumber")["TrackStatus"].first().astype(str)
    green = {int(k) for k, v in status.items() if v == "1"}
    pitting = {
        (int(r.LapNumber), str(r.Driver))
        for r in work.itertuples()
        if not pd.isna(r.PitInTime) or not pd.isna(r.PitOutTime)
    }
    # The start-of-lap state: the order and gaps at the line on the lap before.
    ahead: dict[tuple[int, str], tuple[str, float]] = {}
    for lap_num, grp in work.dropna(subset=["Position"]).groupby("LapNumber"):
        order = grp.sort_values("Position")
        codes, gaps = list(order["Driver"].astype(str)), list(order["_gap"])
        for i in range(1, len(codes)):
            ahead[(int(lap_num), codes[i])] = (codes[i - 1], float(gaps[i]))
    rows = []
    for r in work.itertuples():
        lap, drv = int(r.LapNumber), str(r.Driver)
        if lap < 2 or lap not in green or lap - 1 not in green or (lap, drv) in pitting:
            continue
        if pd.isna(r.LapTime) or pd.isna(r.Compound) or pd.isna(r.TyreLife):
            continue
        if drv not in fit.driver_pace:
            continue
        prev = ahead.get((lap - 1, drv))
        if prev is None or (lap, prev[0]) in pitting or not math.isfinite(prev[1]):
            continue
        pred = predict(fit, drv, str(r.Compound), float(r.TyreLife), fuel_lap_of(r))
        rows.append(
            {
                "driver": drv,
                "stint": f"{drv}:{int(r.Stint) if not pd.isna(r.Stint) else 0}",
                "lap": lap,
                "gap": prev[1],
                "residual": float(r.LapTime) - pred,
            }
        )
    return pd.DataFrame(rows, columns=["driver", "stint", "lap", "gap", "residual"])


def band_losses(rows: pd.DataFrame) -> dict[str, dict[str, float]]:
    """{band: {loss, n, se}}: the mean residual in each gap band less the stint's clear-air
    level (module docstring). Rows: stint, gap, residual."""
    if rows.empty:
        return {}
    df = rows.assign(band=[band_of(g) for g in rows["gap"]]).dropna(subset=["band"])
    level = df[df["band"] == "clear"].groupby("stint")["residual"].median()
    df = df[df["stint"].isin(level.index)]
    df = df.assign(rel=df["residual"] - df["stint"].map(level))
    df = df[df["rel"].abs() <= TRIM]
    out = {}
    for band in [*BAND_LABELS, "clear"]:
        d = df[df["band"] == band]
        if len(d):
            # Standard error clustered by stint (a car's laps in a train aren't independent).
            mean = float(d["rel"].mean())
            sums = (d["rel"] - mean).groupby(d["stint"]).sum()
            se = math.sqrt(float((sums**2).sum())) / len(d) if len(d) > 1 else math.inf
            out[band] = {"loss": mean, "n": len(d), "se": se}
    # The clear band's own mean (the residuals' skew above their median) is the zero point.
    zero = out.get("clear", {}).get("loss", 0.0)
    for band in out:
        out[band]["loss"] -= zero
    return out


def sim_laps(
    model: dict, runs: int, seed0: int = 5000
) -> tuple[pd.DataFrame, list[tuple[int, int]]]:
    """The reference sim's laps measured as real_laps measures real ones (`runs` runs), and its
    on-track (passes, close passes) per run, counted as real_passes counts them."""
    from . import sim_reference as sim

    original = sim._resolve_order
    rows: list[tuple[str, float, float]] = []
    passes: list[tuple[int, int]] = []
    state = {"run": 0, "last": -1, "stints": {}, "passes": 0, "close": 0}

    def measuring(order, cars, clean, pass_rngs, overtake, prev_time, pitted, recent=None, lap=0):
        start = [c for c in order if not cars[c].retired]
        for c in pitted:
            state["stints"][c] = state["stints"].get(c, 0) + 1
        original(order, cars, clean, pass_rngs, overtake, prev_time, pitted, recent, lap)
        after = [c for c in order if not cars[c].retired]
        idx = {c: k for k, c in enumerate(after)}
        for i in range(1, len(start)):
            a, b = start[i - 1], start[i]
            if a in pitted or b in pitted or a not in idx or b not in idx:
                continue
            if idx[b] < idx[a]:
                state["passes"] += 1
                state["close"] += prev_time[b] - prev_time[a] < 2.0
        if state["last"] == lap - 1:  # the lap before was green too
            for i in range(1, len(start)):
                a, b = start[i - 1], start[i]
                if a in pitted or b in pitted or cars[b].retired:
                    continue
                gap = prev_time[b] - prev_time[a]
                lt = cars[b].total_time - prev_time[b]
                stint = f"{state['run']}:{b}:{state['stints'].get(b, 0)}"
                rows.append((stint, gap, lt - clean[b]))
        state["last"] = lap

    sim._resolve_order = measuring
    try:
        for s in range(runs):
            state.update(run=s, last=-1, stints={}, passes=0, close=0)
            sim.simulate(model, seed0 + s)
            passes.append((state["passes"], state["close"]))
    finally:
        sim._resolve_order = original
    return pd.DataFrame(rows, columns=["stint", "gap", "residual"]), passes


def summary(losses: dict[str, dict[str, float]]) -> str:
    return "  ".join(
        f"{b} {losses[b]['loss']:+.2f}±{losses[b]['se']:.2f} ({losses[b]['n']})"
        for b in BAND_LABELS
        if b in losses
    )


@cache
def load_table(path: Path = DIRTY_AIR_PATH) -> dict:
    return json.loads(Path(path).read_text())


def _weighted(values: list[tuple[float, float]]) -> tuple[float, float]:
    """Inverse-variance mean and its variance of (estimate, variance) pairs."""
    w = np.array([1.0 / v for _, v in values])
    x = np.array([e for e, _ in values])
    return float((w * x).sum() / w.sum()), float(1.0 / w.sum())


def race_rows(race_id: str) -> pd.DataFrame | None:
    """A fit race's real_laps from a full build (None: a wet race or one that doesn't build,
    left out as in overtaking.race_opportunities)."""
    from . import build

    try:
        res = build.build_race(race_id)
    except (ValueError, FileNotFoundError, KeyError):
        return None
    if res.wet or res.fit is None:
        return None
    return real_laps(res.laps, res.fit)


def real_passes(model: dict, laps: pd.DataFrame) -> tuple[int, int]:
    """(passes, close passes) on track after the takeover, counted as sim_laps counts the sim's:
    a pair adjacent at the start of a lap the sims run green (no SC/VSC/red event on it) whose
    order swaps by the line, neither car on an in- or out-lap; close = the follower started
    within PASS_WINDOW (2 s)."""
    neutral = {
        lap
        for e in model["events"]
        if e["type"] in ("SC", "VSC", "RED")
        for lap in range(int(e["lap"]), int(e["lap"]) + int(e.get("laps", 1)))
    }
    work = laps.assign(_gap=gap_to_car_ahead(laps)).dropna(subset=["Position"])
    pitting = {
        (int(r.LapNumber), str(r.Driver))
        for r in work.itertuples()
        if not pd.isna(r.PitInTime) or not pd.isna(r.PitOutTime)
    }
    by_lap = {int(k): g.sort_values("Position") for k, g in work.groupby("LapNumber")}
    takeover = int(model["race"]["takeoverLap"])
    passes = close = 0
    for lap in range(takeover + 1, int(model["race"]["laps"]) + 1):
        if lap in neutral or lap not in by_lap or lap - 1 not in by_lap:
            continue
        start = by_lap[lap - 1]
        end = dict(zip(by_lap[lap]["Driver"].astype(str), by_lap[lap]["Position"], strict=True))
        codes = [c for c in start["Driver"].astype(str) if c in end]
        gaps = dict(zip(start["Driver"].astype(str), start["_gap"], strict=True))
        for a, b in zip(codes, codes[1:], strict=False):
            if (lap, a) in pitting or (lap, b) in pitting:
                continue
            if end[b] < end[a]:
                passes += 1
                close += bool(gaps.get(b, math.inf) < 2.0)
    return passes, close


def start_gaps(laps: pd.DataFrame) -> pd.Series:
    """Each lap row's start-of-lap gap to the car ahead: the car's gap at the line on the lap
    before (NaN on lap 1, for the leader, or with no timing)."""
    gap = gap_to_car_ahead(laps)
    key = dict(
        zip(
            zip(laps["Driver"].astype(str), laps["LapNumber"].astype(int), strict=True),
            gap,
            strict=True,
        )
    )
    prev = [
        key.get((str(d), int(n) - 1), float("nan"))
        for d, n in zip(laps["Driver"], laps["LapNumber"], strict=True)
    ]
    return pd.Series(prev, index=laps.index, dtype="float64")


def cost(bands: list[dict] | None, gap: float) -> float:
    """The loss of a lap started `gap` s behind the car ahead under `bands` ([{upTo, penalty}],
    ascending), as the sims price it (sim_reference.dirty_air_cost); 0 with no bands."""
    if not bands or not gap > 0:
        return 0.0
    for band in bands:
        if gap < band["upTo"]:
            return band["penalty"]
    return 0.0


# The sims' bands: the first four (to PASS_WINDOW); past 2 s the real loss is 0.03-0.07 s.
SIM_BANDS = BAND_LABELS[:4]
SCALE_FLOOR = 0.0  # a race's fitted scale is floored here (a negative loss isn't dirty air)


def _scale(losses: dict, shape: dict[str, float]) -> tuple[float, float]:
    """The weighted least-squares scale of `losses` on the group's `shape` over SIM_BANDS, and
    its sampling variance (inverse-variance weights from the clustered standard errors)."""
    num = den = 0.0
    for b in SIM_BANDS:
        e = losses.get(b)
        if e is None or not (0 < e["se"] < math.inf):
            continue
        w = 1.0 / e["se"] ** 2
        num += w * e["loss"] * shape[b]
        den += w * shape[b] ** 2
    return (num / den, 1.0 / den) if den else (float("nan"), math.inf)


def _tau2(scales: pd.DataFrame, by: str | None) -> float:
    """The true variance of the scale between races within `by` (layouts with two or more
    races), or between `by=None` rows: observed variance less mean sampling variance."""
    if by is None:
        observed = float(scales["s"].var(ddof=1))
    else:
        multi = scales.groupby(by).filter(lambda x: len(x) > 1)
        dev = multi["s"] - multi.groupby(by)["s"].transform("mean")
        size = multi.groupby(by)["s"].transform("size")
        observed = float((dev**2 * size / (size - 1)).mean())
        scales = multi
    return max(observed - float(scales["v"].mean()), 0.01)


def fit(rows_by_race: dict[str, pd.DataFrame]) -> dict:
    """The table (DIRTY_AIR_PATH) from each fit race's real_laps: per era group the pooled loss
    by band (the shape), per track layout and group its scale on the shape (shrunk toward 1),
    and the two true variances the build's partial pooling uses."""
    from .legend import parse_race_id
    from .overtaking import group_of, layout_of

    tagged = {
        rid: rows.assign(stint=rid + ":" + rows["stint"].astype(str))
        for rid, rows in rows_by_race.items()
        if not rows.empty
    }
    by_group: dict[str, list[str]] = {}
    for rid in tagged:
        by_group.setdefault(group_of(parse_race_id(rid)[1]), []).append(rid)
    groups, layouts = {}, {}
    for g, ids in sorted(by_group.items()):
        pooled = band_losses(pd.concat([tagged[r] for r in ids]))
        shape = {b: pooled[b]["loss"] for b in SIM_BANDS}
        races = pd.DataFrame(
            [(r, layout_of(r), *_scale(band_losses(tagged[r]), shape)) for r in ids],
            columns=["race", "layout", "s", "v"],
        ).dropna(subset=["layout", "s"])
        lay = []
        for name, d in races.groupby("layout"):
            s, v = _scale(band_losses(pd.concat([tagged[r] for r in d["race"]])), shape)
            lay.append((name, s, v, sorted(d["race"])))
        lay_df = pd.DataFrame(lay, columns=["layout", "s", "v", "races"])
        tau_race, tau_layout = _tau2(races, "layout"), _tau2(lay_df, None)
        groups[g] = {
            "bands": [
                {"upTo": BANDS[i][1], "loss": round(shape[b], 4), "laps": pooled[b]["n"]}
                for i, b in enumerate(SIM_BANDS)
            ],
            "tauRace": round(tau_race, 4),
            "tauLayout": round(tau_layout, 4),
            "races": len(ids),
        }
        for name, s, v, rs in lay:
            w = tau_layout / (tau_layout + v)
            layouts.setdefault(name, {})[g] = {
                "scale": round(max(SCALE_FLOOR, w * s + (1 - w) * 1.0), 4),
                "races": rs,
            }
    return {
        "_comment": (
            "Eras dirty-air model (pipeline/src/pipeline/dirty_air.py; its docstring has the"
            " method). Generated by `python -m pipeline.dirty_air`; do not edit by hand. Real"
            " loss by start-of-lap gap band = the group's band loss x the race's scale (its own,"
            " partly pooled toward its layout's, itself shrunk toward 1)."
        ),
        "groups": groups,
        "layouts": dict(sorted(layouts.items())),
        "fitRaces": sorted(tagged),
    }


def eras_dirty_air(
    race_id: str, rows: pd.DataFrame | None, table: dict | None = None
) -> tuple[dict, str]:
    """The race's dirty-air block for an Eras build of a timed race and a build note:
    {"real": its real loss by band (the pace offsets take it off each lap), "bands": the sims'
    cost by band (track.dirtyAirBands: the real loss less the group's simOffset, the part of
    the loss the sims' hold rule makes by itself)}. `rows`: its real_laps."""
    from .legend import parse_race_id
    from .overtaking import group_of, layout_of

    table = table or load_table()
    g = group_of(parse_race_id(race_id)[1])
    grp = table["groups"][g]
    shape = {b: e["loss"] for b, e in zip(SIM_BANDS, grp["bands"], strict=True)}
    layout = layout_of(race_id)
    row = (table["layouts"].get(layout) or {}).get(g) if layout else None
    prior = row["scale"] if row else 1.0
    own, var = _scale(band_losses(rows), shape) if rows is not None else (math.nan, math.inf)
    if math.isfinite(own) and math.isfinite(var):
        w = grp["tauRace"] / (grp["tauRace"] + var)
        scale = w * own + (1 - w) * prior
        how = f"its own laps (scale {own:.2f}, weight {w:.2f})"
    else:
        scale, how = prior, "no laps of its own"
    scale = max(SCALE_FLOOR, scale) * LOSS_MULT
    where = f"layout {layout} ({prior:.2f})" if row else f"the {g} group (1.00)"
    offsets = SIM_OFFSET or grp.get("simOffset", [0.0] * len(SIM_BANDS))
    real = [{"upTo": e["upTo"], "penalty": round(scale * e["loss"], 4)} for e in grp["bands"]]
    bands = [
        {"upTo": e["upTo"], "penalty": round(max(0.0, e["penalty"] - off), 4)}
        for e, off in zip(real, offsets, strict=True)
    ]
    note = (
        f"dirtyAirBands: Eras dirty-air model ({g} band losses x scale {scale:.2f}, from {how}"
        f" and {where})"
    )
    return {"real": real if DETRAFFIC else None, "bands": bands}, note


def held_gap() -> float | None:
    """The held gap an Eras build writes as overtakeModel.heldGap (None: none)."""
    return HELD_GAP


def calibrate_race(race_id: str, runs: int = 100) -> dict | None:
    """One race's share of the sims' calibration (simOffset): built with the bands at the real
    loss (no offset), the sims' loss in each band less the band's cost there, and the laps."""
    from . import build
    from .legend import parse_race_id
    from .overtaking import group_of

    global SIM_OFFSET
    saved = SIM_OFFSET
    SIM_OFFSET = [0.0] * len(SIM_BANDS)
    try:
        res = build.build_race(race_id)
    except (ValueError, FileNotFoundError, KeyError):
        return None
    finally:
        SIM_OFFSET = saved
    bands = res.model["track"].get("dirtyAirBands")
    if res.wet or not bands:
        return None
    rows, _ = sim_laps(res.model, runs)
    losses = band_losses(rows)
    return {
        "group": group_of(parse_race_id(race_id)[1]),
        "excess": {
            b: [losses[b]["loss"] - e["penalty"], losses[b]["n"]]
            for b, e in zip(SIM_BANDS, bands, strict=True)
            if b in losses
        },
    }


def pool_calibration(parts: list[dict]) -> dict[str, list[float]]:
    """Per era group, the lap-weighted mean excess by band (the part of the loss the hold rule
    makes with no dirty-air cost of its own): the table's simOffset."""
    out = {}
    for g in sorted({p["group"] for p in parts}):
        mine = [p for p in parts if p["group"] == g]
        out[g] = [
            round(
                sum(p["excess"][b][0] * p["excess"][b][1] for p in mine if b in p["excess"])
                / sum(p["excess"][b][1] for p in mine if b in p["excess"]),
                4,
            )
            for b in SIM_BANDS
        ]
    return out


def main(argv: list[str] | None = None) -> None:
    import argparse

    from .overtaking import fit_races

    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--cache", type=Path, help="per-race real_laps (parquet) cache dir")
    ap.add_argument("--out", type=Path, default=DIRTY_AIR_PATH)
    ap.add_argument("--calibrate", metavar="RACE", help="one race's calibration, to --cache")
    ap.add_argument(
        "--pool", action="store_true", help="write simOffset from the cached calibrations"
    )
    args = ap.parse_args(argv)
    if args.calibrate:
        part = calibrate_race(args.calibrate)
        path = args.cache / "calibration" / f"{args.calibrate}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(part))
        print(f"{args.calibrate}: {part}")
        return
    if args.pool:
        parts = [
            p
            for f in sorted((args.cache / "calibration").glob("*.json"))
            if (p := json.loads(f.read_text())) is not None
        ]
        table = json.loads(args.out.read_text())
        for g, offsets in pool_calibration(parts).items():
            table["groups"][g]["simOffset"] = offsets
            table["groups"][g]["calibrationRaces"] = sum(p["group"] == g for p in parts)
        args.out.write_text(json.dumps(table, indent=2) + "\n")
        print(f"wrote {args.out}: simOffset {pool_calibration(parts)}")
        return
    rows: dict[str, pd.DataFrame] = {}
    for race_id in fit_races():
        cached = args.cache / f"{race_id}.parquet" if args.cache else None
        skip = args.cache / f"{race_id}.skip" if args.cache else None
        if skip is not None and skip.exists():
            continue
        if cached is not None and cached.exists():
            r = pd.read_parquet(cached)
        else:
            r = race_rows(race_id)
            if r is None:
                print(f"{race_id}: left out (wet or not buildable)")
                if skip is not None:
                    skip.parent.mkdir(parents=True, exist_ok=True)
                    skip.touch()
                continue
            if cached is not None:
                cached.parent.mkdir(parents=True, exist_ok=True)
                r.to_parquet(cached)
        rows[race_id] = r
    table = fit(rows)
    old = json.loads(args.out.read_text()) if args.out.exists() else {}
    for g, grp in table["groups"].items():  # the sim calibration (calibrate) is kept
        if "simOffset" in old.get("groups", {}).get(g, {}):
            grp["simOffset"] = old["groups"][g]["simOffset"]
    args.out.write_text(json.dumps(table, indent=2) + "\n")
    print(f"wrote {args.out}: {json.dumps(table['groups'])}")


if __name__ == "__main__":
    main()
