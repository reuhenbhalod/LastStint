"""The Eras overtake model: pooled across races, by era and by track layout (Eras sim fix M3).

The Daily/Gauntlet build fits each race's own logistic P(pass next lap) on the follower's
model pace advantage and the gap (track.fit_overtake_model); the sims roll it once a lap for a
follower within PASS_WINDOW (2 s) and hold a follower that fails FOLLOW_GAP (0.3 s) behind.
One race is thin evidence: across the 17 Eras races of the races report's gap 2 ("weak
overtaking") the fitted paceCoef runs from 0.18 to 2.8 and the gapCoef from -1.0 to -9.2, and
a race with fewer than MIN_PASSES passes (Monaco 2017: 2) falls back to default slopes. So
*who* passes is off: Schumacher at Interlagos 2006 passes 3.7 cars a race against his real 7
(paceCoef 0.61), slower cars pass too often.

An Eras build (build.py's `eras_build`) takes this model instead, fitted on every timed, dry,
non-reconstructed race snapshot in data/raw (fitRaces in config/overtaking.json; wet races are
left out, their pace model doesn't hold on the wet laps), each race's own lap model giving the
pace advantage (track.pass_opportunities):

    P(pass) = sigmoid(intercept + paceCoef * adv + gapCoef * gap + trainCoef * train)

- `train`: the car ahead is itself within TRAIN_GAP (1.0 s) of the car ahead of it. With DRS
  the car ahead in a train has DRS too, and it is much harder to pass (fitted logit -0.90:
  5.3% of tries pass against 8.4% out of a train); before DRS it barely matters (-0.05).
- Slopes per era group: `drs` (2011-2025, the rules' DRS years) and `noDrs` (before 2011:
  the refuelling years, where the passing was mostly done in the pits, and 2010). Pre-DRS
  passing hangs much less on pace (paceCoef 0.81 against 1.84).
- The intercept per track layout and era group, matched (track.rate_matched_intercept) to the
  pass rate of every fitted race at that layout, pooled across years: a one-race track
  difficulty (Monaco 2017: 2 passes in 525 tries) leans on the other years (Monaco's DRS
  layout: 4 dry races, 26 passes in 2,144 tries).
  Within a layout the race-to-race spread of a race's own matched intercept is about half the
  spread across all races (0.34 against 0.65-0.77 logit), so the track explains most of it.
  A race's own pass rate then counts by partial pooling: its intercept is
  w * (its own matched intercept) + (1 - w) * (its layout's), w = passes / (passes + K), with
  K = shrinkPasses (13.4) = 1 / the true within-layout variance of the intercept (fitted:
  shrink_passes), so a race with many passes keeps most of its own rate and Monaco 2017's 2
  passes count for little.
  LAYOUT_CHANGES splits a circuit where its layout changed (LAYOUT_OF_RACE: Sakhir's outer
  loop). A race at a layout with no fitted race takes the group's slopes with its own pass
  rate (or, with no timing of its own, the group's intercept). A reconstructed race
  (1983-1995) keeps its own fit: its laps are solved to its anchors, and its replay is
  checked against them.

Gating: only an Eras build of a race with real timing writes trainCoef, and the sims apply
the train term only when the file has it, so every Daily/Gauntlet file and every committed
race file replays as before.

Measured and not adopted (docs/g1-report.md, "Eras sim fix M3"): against real on-track pass
counts the sim passes 1.1-3.8x too often in all 17 races and in every passing race checked,
mostly because a held follower sits at FOLLOW_GAP (0.3 s, the real 5th percentile; the real
median of a held-up follower is heldGap, 0.79 s), where the gap term is strongest, and because
lap noise passes cars without a roll. Rules that bring the counts to the real ones (a held gap
of 0.79 s; no pass without a roll; the roll at the real held gap) all made robust G1 worse on
most of the 28 races checked. Eras sim fix W3 (dirty_air.py) measured the train cost both ways
by start-of-lap gap: the real followers lose more than the sim's, not less (the 0.30-0.36 s
compared here were the races' dirtyAirPenalty, a median on end-of-lap gaps), and with the cost
matched these rules still make robust G1 worse; so neither is adopted (heldGap, rollOnly and
dirtyAirBands are in both sims, off).

    uv run python -m pipeline.overtaking [--cache DIR]   # refit, write config/overtaking.json
"""

from __future__ import annotations

import json
import math
from functools import cache
from pathlib import Path

import pandas as pd

from . import track
from .legend import circuit_for, parse_race_id
from .paths import CONFIG_DIR, DATA_DIR, RAW_DIR

OVERTAKING_PATH = CONFIG_DIR / "overtaking.json"
RECONSTRUCTION_DIR = DATA_DIR / "reconstruction"

TRAIN_GAP = 1.0  # s: the car ahead is in a train this close to its own car ahead (sim TRAIN_GAP)
PASS_RATE_PRIOR = track.PASS_RATE_PRIOR
DRS_YEARS = (2011, 2025)
# Circuits whose layout changed between races in the data: the year the new layout started.
# Sources: Wikipedia's circuit articles (Yas Marina 2021 reprofile, Catalunya 2023 final
# chicane removed, Marina Bay 2023 turns 16-19 removed, Albert Park 2022 reprofile, Hungaroring
# 2003 lengthened straight, Nurburgring 2002 new first sector, Hockenheim 2002 short layout,
# Spa 2007 new bus-stop chicane, Catalunya 2007 final chicane added).
LAYOUT_CHANGES = {
    "yas_marina": [2021],
    "catalunya": [2007, 2023],
    "marina_bay": [2023],
    "albert_park": [2022],
    "hungaroring": [2003],
    "nurburgring": [2002],
    "hockenheimring": [2002],
    "spa": [2007],
}
# Race ids at a circuit but on another layout of it.
LAYOUT_OF_RACE = {"sakhir": "bahrain_outer"}


def group_of(year: int) -> str:
    return "drs" if DRS_YEARS[0] <= year <= DRS_YEARS[1] else "noDrs"


def layout_of(race_id: str) -> str | None:
    """The track layout a race ran on: its circuit, split at LAYOUT_CHANGES (None: unknown)."""
    slug, year = parse_race_id(race_id)
    if slug in LAYOUT_OF_RACE:
        return LAYOUT_OF_RACE[slug]
    circuit = circuit_for(race_id)
    if circuit is None:
        return None
    epoch = sum(year >= y for y in LAYOUT_CHANGES.get(circuit, []))
    return circuit if epoch == 0 else f"{circuit}@{LAYOUT_CHANGES[circuit][epoch - 1]}"


COVARIATES = ["adv", "gap", "train"]
SLOPES = {"adv": "paceCoef", "gap": "gapCoef", "train": "trainCoef"}


def features(events: pd.DataFrame) -> pd.DataFrame:
    """The opportunities (a follower within PASS_WINDOW) with the model's covariates."""
    return events.assign(
        adv=events["adv"].astype(float),
        gap=events["gap"].astype(float),
        train=(events["leader_gap"] < TRAIN_GAP).astype(float),
        passed=events["passed"].astype(float),
    )


def matched_intercept(feats: pd.DataFrame, slopes: dict[str, float]) -> float:
    """The intercept at which the model's mean P(pass) over `feats` equals their pass rate
    (smoothed by PASS_RATE_PRIOR), the slopes held (track.rate_matched_intercept, with the
    train shift folded into the pace term)."""
    n, passes = len(feats), float(feats["passed"].sum())
    rate = (passes + PASS_RATE_PRIOR) / (n + 2 * PASS_RATE_PRIOR)
    pace = slopes["paceCoef"]
    adv = (feats["adv"] + slopes["trainCoef"] * feats["train"] / pace).tolist()
    return track.rate_matched_intercept(adv, feats["gap"].tolist(), rate, pace, slopes["gapCoef"])


def shrink_passes(own: list[tuple[str, str, float, float]]) -> float:
    """K in the partial pooling of a race's intercept toward its layout's (eras_model): the
    race's own intercept weighs passes / (passes + K). K = 1 / tau^2, tau^2 the true
    race-to-race variance of the intercept within a layout: the observed within-layout variance
    (layouts with two or more fitted races) less the sampling variance of a race's rate on the
    logit scale (about 1 / passes for rare passes)."""
    df = pd.DataFrame(own, columns=["layout", "group", "ic", "passes"])
    multi = df.groupby(["layout", "group"]).filter(lambda x: len(x) > 1)
    dev = multi["ic"] - multi.groupby(["layout", "group"])["ic"].transform("mean")
    size = multi.groupby(["layout", "group"])["ic"].transform("size")
    within = float((dev**2 * size / (size - 1)).mean())  # unbiased per layout
    sampling = float((1.0 / (multi["passes"] + PASS_RATE_PRIOR)).mean())
    return 1.0 / max(within - sampling, 0.01)


def held_gap(events: pd.DataFrame) -> float:
    """The median next-lap gap of a real follower that was held up (within PASS_WINDOW, didn't
    pass, still directly behind and closer than the lap before): reported, not used (the
    sims hold a follower FOLLOW_GAP behind; see the module docstring)."""
    held = events[~events["passed"].astype(bool) & (events["gap_next"] < events["gap"])]
    return float(held["gap_next"].median())


def fit(opportunities: dict[str, pd.DataFrame]) -> dict:
    """The table (OVERTAKING_PATH) from each fit race's pass_opportunities."""
    import statsmodels.api as sm

    rows = []
    for race_id, ev in opportunities.items():
        if ev.empty:
            continue
        year = parse_race_id(race_id)[1]
        rows.append(ev.assign(race=race_id, group=group_of(year), layout=layout_of(race_id)))
    allev = pd.concat(rows, ignore_index=True)
    feats = features(allev)
    groups, layouts = {}, {}
    own: list[tuple[str, str, float, float]] = []  # (layout, group, own intercept, passes)
    for g, d in feats.groupby("group"):
        x = sm.add_constant(d[COVARIATES])
        params = sm.Logit(d["passed"], x).fit(disp=0).params
        slopes = {SLOPES[c]: round(float(params[c]), 4) for c in COVARIATES}
        if slopes["paceCoef"] <= 0 or slopes["gapCoef"] >= 0:
            raise ValueError(f"overtaking: wrong-signed pooled fit for {g}: {slopes}")
        groups[g] = {
            "intercept": round(float(params["const"]), 4),
            **slopes,
            "opportunities": len(d),
            "passes": int(d["passed"].sum()),
        }
        for lay, r in d.dropna(subset=["layout"]).groupby("layout"):
            layouts.setdefault(lay, {})[g] = {
                "intercept": round(matched_intercept(r, slopes), 4),
                "races": sorted(r["race"].unique().tolist()),
                "opportunities": len(r),
                "passes": int(r["passed"].sum()),
            }
            for _, rr in r.groupby("race"):
                own.append((lay, g, matched_intercept(rr, slopes), float(rr["passed"].sum())))
    return {
        "_comment": (
            "Eras overtake model (pipeline/src/pipeline/overtaking.py; its docstring has the"
            " method). Generated by `python -m pipeline.overtaking`; do not edit by hand."
            " P(pass) = sigmoid(intercept + paceCoef*adv + gapCoef*gap + trainCoef*train),"
            " train = the car ahead within trainGap of its own car ahead; slopes per era group"
            " (drs 2011-2025, noDrs before), intercept per track layout and group (pooled over"
            " the layout's races). heldGap: the real median gap of a held-up follower (reported)."
        ),
        "trainGap": TRAIN_GAP,
        "shrinkPasses": round(shrink_passes(own), 1),
        "heldGap": round(held_gap(allev), 2),
        "groups": groups,
        "layouts": dict(sorted(layouts.items())),
        "fitRaces": sorted(opportunities),
    }


@cache
def load_table(path: Path = OVERTAKING_PATH) -> dict:
    return json.loads(Path(path).read_text())


def eras_model(
    race_id: str, events: pd.DataFrame | None, table: dict | None = None
) -> tuple[dict[str, float], str]:
    """The race's overtakeModel for an Eras build, and a build note. `events`: the race's
    pass_opportunities (None or empty for a reconstructed race: its laps are synthetic)."""
    table = table or load_table()
    year = parse_race_id(race_id)[1]
    g = group_of(year)
    grp = table["groups"][g]
    layout = layout_of(race_id)
    row = (table["layouts"].get(layout) or {}).get(g) if layout else None
    if row is not None and events is not None and not events.empty:
        # Partial pooling: the race's own pass rate, shrunk toward its layout's.
        mine = matched_intercept(features(events), grp)
        passes = float(events["passed"].sum())
        w = passes / (passes + table["shrinkPasses"])
        intercept = w * mine + (1 - w) * row["intercept"]
        how = (
            f"its own pass rate ({int(passes)} passes, weight {w:.2f}) and layout {layout}"
            f" ({len(row['races'])} races, {row['passes']} passes)"
        )
    elif row is not None:
        intercept = row["intercept"]
        how = f"layout {layout} ({len(row['races'])} races, {row['passes']} passes)"
    elif events is not None and not events.empty:
        intercept = matched_intercept(features(events), grp)
        how = "its own pass rate (no fitted race at its layout)"
    else:
        intercept = grp["intercept"]
        how = "the era group's (no fitted race at its layout, no timing of its own)"
    if not math.isfinite(intercept):
        raise ValueError(f"{race_id}: overtake intercept {intercept}")
    model = {"intercept": intercept, **{k: grp[k] for k in SLOPES.values()}}
    return model, f"overtakeModel: Eras pooled model ({g} slopes), intercept from {how}"


def fit_races(raw_dir: Path = RAW_DIR) -> list[str]:
    """Every race snapshot in raw_dir with real timing (not reconstructed)."""
    recon = {p.stem for p in RECONSTRUCTION_DIR.glob("*.json")}
    return sorted(p.stem for p in Path(raw_dir).glob("*.parquet") if p.stem not in recon)


def race_opportunities(race_id: str) -> pd.DataFrame | None:
    """A race's pass opportunities from a full build (None: a wet race, left out of the fit,
    or a race that doesn't build)."""
    from . import build

    try:
        res = build.build_race(race_id)
    except (ValueError, FileNotFoundError, KeyError):
        return None
    if res.wet or res.fit is None:
        return None
    return track.pass_opportunities(res.laps, res.fit)


def main(argv: list[str] | None = None) -> None:
    import argparse

    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--cache", type=Path, help="per-race opportunities (parquet) cache dir")
    ap.add_argument("--out", type=Path, default=OVERTAKING_PATH)
    args = ap.parse_args(argv)
    opps: dict[str, pd.DataFrame] = {}
    for race_id in fit_races():
        cached = args.cache / f"{race_id}.parquet" if args.cache else None
        skip = args.cache / f"{race_id}.skip" if args.cache else None
        if skip is not None and skip.exists():
            print(f"{race_id}: left out (wet or not buildable)")
            continue
        if cached is not None and cached.exists():
            ev = pd.read_parquet(cached)
        else:
            ev = race_opportunities(race_id)
            if ev is None:
                print(f"{race_id}: left out (wet or not buildable)")
                if skip is not None:
                    skip.parent.mkdir(parents=True, exist_ok=True)
                    skip.touch()
                continue
            if cached is not None:
                cached.parent.mkdir(parents=True, exist_ok=True)
                ev.to_parquet(cached)
        opps[race_id] = ev
        print(f"{race_id}: {len(ev)} opportunities, {int(ev['passed'].sum())} passes")
    table = fit(opps)
    args.out.write_text(json.dumps(table, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {args.out}: {json.dumps(table['groups'])} heldGap {table['heldGap']}")


if __name__ == "__main__":
    main()
