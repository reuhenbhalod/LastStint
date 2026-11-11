"""Wet races before 2018 (Eras build plan 4.5, simulator roadmap R3): when the track was wet,
from the lap times alone.

Today's wet model (wet.py) fits a race's wetness timeline from its laps against the dry pace,
by tyre class, pulled toward damp on the laps the rain gauge says it rained. Before 2018 there
is no gauge (TUM 2014-19 and Jolpica have no weather) and Jolpica has no compounds either. This
module supplies what is missing, in the form the wet model already reads, so wet.py and both
sims run unchanged:

1. **Neutralised laps** (SC / VSC), which slow the field too and must not read as rain: from
   the per-lap TrackStatus where the source has it (TUM, FastF1); otherwise (Jolpica) from the
   laps: a lap the whole field ran SC_SHARE slower with the cars bunched up (the median gap to
   the car ahead in the top ten at most BUNCH of what it was before) is a safety car.
2. **Wet laps:** the field's median slowing against its own dry pace (each driver's fuel-
   corrected 10th-percentile lap) at least WET_SHARE: rain, or a track still wet from it.
   Laps under a neutralisation take the call of the green laps either side when they agree.
3. **Ambiguous laps** are flagged, never guessed: a slowing between BORDER and WET_SHARE; a
   lap as slow as a safety car without the bunching (heavy rain, or a yellow the source can't
   show); a neutralisation between a wet and a dry spell; the first green lap after one (cold
   tyres) and the lap before one (the SC may have come out during it).
4. **Tyre classes** (only where the source has no compounds, i.e. Jolpica): each stint (from
   the stops) gets the class that was fastest over that stint's laps at the fitted wetness
   (teams fit the tyre that suits the stint), and the wetness is refitted with those classes,
   until neither changes. Dry stints get DRY_PLACEHOLDER: which dry compound is estimated in
   step 2.4, not here. A stint whose tyre a race report gives (a sourced tyre fact in
   `data/estimates/<id>.tyres.json`, load_tyre_facts) keeps that class in every round (a
   report that says only "wets" fixes it to a rain tyre, and the fit picks inter or wet): the
   wetness is fitted around it.

Output: per-lap weather records `{"lap", "time", "rain", "source": "lap-times", ...}` in the
race's `<id>.weather.json`; wet.rain_laps reads a record with a `lap` as that lap's rain flag
(FastF1's records have none, so 2018+ races are untouched). "rain" here means the lap times
say the track was wet, rain falling or not. Every call is in the `<id>.wet-laps.json` report,
for the hand check against the race reports (docs/eras-checks/4.5-wet-races.md).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

from . import wet

SOURCE = "lap-times"
# The field's median slowing (share of its dry lap) that says the track is wet, and below it
# the band flagged as ambiguous (tyre wear and traffic reach ~1.5% on a dry track).
WET_SHARE = 0.03
BORDER = 0.02
# A safety car from the laps: the field this much slower, bunched to this share of its gaps.
SC_SHARE = 0.25
BUNCH = 0.5
# Each driver's dry lap: this quantile of their fuel-corrected accurate green laps.
DRY_QUANTILE = 0.1
MIN_DRY_LAPS = 3
# Placeholder dry compound for a source without compounds (step 2.4 estimates the real ones).
DRY_PLACEHOLDER = "MEDIUM"
CLASS_COMPOUND = {"slick": DRY_PLACEHOLDER, "inter": "INTERMEDIATE", "wet": "WET"}
MAX_ROUNDS = 8
# A stint's class: how well each class explains its laps at the fitted wetness (squared miss a
# lap, capped for offs), plus this weight on how fast that class was over the stint's laps
# (teams fit the tyre that suits the stint; it decides where the laps can't, e.g. a whole
# field on one tyre, whose laps any class explains at some wetness).
DATA_CAP = 0.01
HINDSIGHT = 0.03
OFFSET_SHRINK = 5
SAME_WET_STOP = 0.003


def _missing(col: pd.Series) -> bool:
    return bool(col.isna().all() or col.astype(str).isin(["", "None", "nan", "<NA>"]).all())


def has_status(laps: pd.DataFrame) -> bool:
    return not _missing(laps["TrackStatus"])


def has_compounds(laps: pd.DataFrame) -> bool:
    return not _missing(laps["Compound"])


@dataclass
class LapCall:
    lap: int
    slowing: float | None  # field median, share of the dry lap
    gap: float | None  # median gap to the car ahead in the top ten (s)
    neutral: bool  # SC / VSC
    wet: bool
    ambiguous: str | None = None


@dataclass
class Estimate:
    laps: pd.DataFrame  # with Compound / TrackStatus filled where the source had none
    calls: list[LapCall]
    neutral_source: str  # "status" or "lap-times"
    classes: dict[tuple[str, int], str] = field(default_factory=dict)  # inferred stints
    filled: list[str] = field(default_factory=list)

    @property
    def wet_laps(self) -> set[int]:
        return {c.lap for c in self.calls if c.wet}

    def records(self) -> list[dict]:
        """The weather records wet.py reads: one per lap, at the leader's lap end."""
        ends = self.laps.groupby("LapNumber")["Time"].min()
        out = []
        for c in self.calls:
            t = ends.get(float(c.lap))
            rec = {
                "lap": c.lap,
                "time": None if t is None or t != t else round(float(t), 3),
                "rain": c.wet,
                "source": SOURCE,
            }
            if c.ambiguous:
                rec["ambiguous"] = c.ambiguous
            out.append(rec)
        return out


def accurate(laps: pd.DataFrame) -> pd.Series:
    return laps["IsAccurate"].astype("boolean").fillna(False).astype(bool) & laps["LapTime"].notna()


def dry_shares(laps: pd.DataFrame, neutral: set[int]) -> pd.Series:
    """Each accurate lap's time as a share over the driver's dry lap: fuel-corrected by the
    wet model's fuel prior and, where tyre ages are known, by the field's wear (seconds a lap
    of tyre age, fitted on the dry-looking laps); NaN for drivers with too few laps to say."""
    total = int(laps["LapNumber"].max())
    corr = laps["LapTime"] - wet.FUEL_PRIOR * (total - laps["LapNumber"])
    ok = accurate(laps) & ~laps["LapNumber"].astype(int).isin(neutral)

    def shares(t: pd.Series) -> pd.Series:
        q = t[ok].groupby(laps.loc[ok, "Driver"])
        base = q.quantile(DRY_QUANTILE).where(q.size() >= MIN_DRY_LAPS)
        return (t / laps["Driver"].map(base) - 1).where(accurate(laps))

    first = shares(corr)
    age = laps["TyreLife"].astype(float)
    dry = ok & first.notna() & age.notna() & (first < BORDER)
    if dry.sum() >= 20 and age[dry].std() > 0:
        x, y = age[dry], corr[dry] - corr[dry].groupby(laps.loc[dry, "Driver"]).transform("mean")
        slope = float(((x - x.mean()) * y).sum() / ((x - x.mean()) ** 2).sum())
        if slope > 0:
            return shares(corr - slope * age.fillna(0.0))
    return first


def field_gaps(laps: pd.DataFrame) -> pd.Series:
    """Per lap: the median gap between consecutive cars in the top ten at the lap's end."""
    out = {}
    for lap, g in laps.dropna(subset=["Time"]).groupby("LapNumber"):
        times = np.sort(g["Time"].to_numpy(float))[:10]
        out[int(lap)] = float(np.median(np.diff(times))) if len(times) > 2 else np.nan
    return pd.Series(out)


def status_neutral(laps: pd.DataFrame) -> set[int]:
    """Laps most of the field ran partly under an SC / VSC (TrackStatus has a 4 or 6)."""
    st = laps["TrackStatus"].astype(str)
    hit = st.str.contains("4|6", regex=True)
    share = hit.groupby(laps["LapNumber"].astype(int)).mean()
    return {int(lap) for lap, s in share.items() if s >= 0.5}


def detect_neutral(slowing: pd.Series, gaps: pd.Series) -> set[int]:
    """Safety-car laps from the laps alone: the field SC_SHARE slower and bunched (to BUNCH of
    the gaps over the three laps before it) or, once a run has started, still that slow."""
    out: set[int] = set()
    for lap in sorted(slowing.index):
        s = slowing.get(lap)
        if s is None or s != s or s < SC_SHARE:
            # A lap with no accurate times (everyone pitted) inside a run stays neutral.
            if (s is None or s != s) and lap - 1 in out:
                out.add(lap)
            continue
        if lap - 1 in out:
            out.add(lap)
            continue
        before = [gaps.get(k) for k in range(lap - 3, lap) if k not in out and k >= 2]
        before = [g for g in before if g is not None and g == g]
        g = gaps.get(lap)
        if before and g is not None and g == g and g <= BUNCH * float(np.median(before)):
            out.add(lap)
            # The laps just before, as slow but not yet bunched: the field closing up on the
            # safety car.
            k = lap - 1
            while k >= 2 and k not in out and (slowing.get(k) or 0) >= SC_SHARE:
                out.add(k)
                k -= 1
    return out


def call_laps(laps: pd.DataFrame) -> tuple[list[LapCall], str]:
    """Each lap's neutral / wet call and its ambiguity (see the module docstring)."""
    total = int(laps["LapNumber"].max())
    gaps = field_gaps(laps)
    lap_no = laps["LapNumber"].astype(int)
    if has_status(laps):
        neutral, source = status_neutral(laps), "status"
        share = dry_shares(laps, neutral)
    else:
        source = "lap-times"
        share = dry_shares(laps, set())
        neutral = detect_neutral(share.groupby(lap_no).median(), gaps)
        share = dry_shares(laps, neutral)
    slowing = share.groupby(lap_no).median()
    # The dry floor: the field's slowing on its driest laps (each driver's dry lap is their
    # 10th percentile, so the field's typical dry lap sits a little above zero).
    green = slowing.drop(index=[k for k in neutral if k in slowing.index], errors="ignore")
    floor = float(green.quantile(0.2)) if len(green) else 0.0

    calls = []
    for lap in range(1, total + 1):
        s = slowing.get(lap)
        s = None if s is None or s != s else float(s)
        g = gaps.get(lap)
        g = None if g is None or g != g else round(float(g), 3)
        c = LapCall(lap, None if s is None else round(s, 4), g, lap in neutral, False)
        if not c.neutral and s is not None:
            excess = s - floor
            c.wet = excess >= WET_SHARE
            if BORDER <= excess < WET_SHARE:
                c.ambiguous = "borderline slowing: drizzle, or tyre wear"
            elif source == "lap-times" and s >= SC_SHARE:
                c.ambiguous = "as slow as a safety car without the bunching: heavy rain or a yellow"
        calls.append(c)
    _bridge(calls)
    return calls, source


def _bridge(calls: list[LapCall]) -> None:
    """Neutralised laps take the wet call of the green laps either side when they agree; the
    first lap without timed evidence (lap 1) takes lap 2's. Flags the edges of each run."""
    by = {c.lap: c for c in calls}
    first = by.get(1)
    if first and first.slowing is None and 2 in by:
        first.wet = by[2].wet
    runs, cur = [], []
    for c in calls:
        if c.neutral:
            cur.append(c)
        elif cur:
            runs.append(cur)
            cur = []
    if cur:
        runs.append(cur)
    for run in runs:
        lo, hi = run[0].lap - 1, run[-1].lap + 1
        before, after = by.get(lo), by.get(hi)
        sides = [x.wet for x in (before, after) if x is not None and not x.neutral]
        wet_run = bool(sides) and all(sides)
        for c in run:
            c.wet = wet_run
            if len(set(sides)) > 1:
                c.ambiguous = "neutralised between a wet and a dry spell: when it changed is unseen"
        if after is not None and not after.ambiguous:
            after.ambiguous = "first green lap after a neutralisation (cold tyres)"
        if before is not None and before.lap > 1 and not before.ambiguous:
            before.ambiguous = "lap before a neutralisation (it may have started during it)"


def stints(laps: pd.DataFrame) -> pd.Series:
    stint = laps["Stint"]
    return stint.fillna(1.0).astype(int) if stint.notna().any() else pd.Series(1, laps.index)


def stint_cost(
    laps_k: list[int], shares_k: list[float], pen: np.ndarray, at: np.ndarray, neutral: set[int]
) -> float:
    """How badly one tyre class explains a stint: its laps' squared misses (capped for offs)
    after a shrunk offset of the driver's own (a driver slow in the wet is not on the wrong
    tyre), plus HINDSIGHT x that class's time lost over the stint's green laps."""
    miss = [s - float(pen[at[lap - 1]]) for lap, s in zip(laps_k, shares_k, strict=True) if s == s]
    off = sum(miss) / (len(miss) + OFFSET_SHRINK) if miss else 0.0
    data = sum(min(DATA_CAP, (m - off) ** 2) for m in miss)
    lost = sum(float(pen[at[lap - 1]]) for lap in laps_k if lap not in neutral)
    return data + HINDSIGHT * lost


def driver_classes(costs: list[dict[str, float]]) -> list[str]:
    """A driver's stint classes, in order: the cheapest sequence, a stop that keeps a wet
    tyre class costing SAME_WET_STOP (a stop in the wet is almost always to change tyre)."""
    classes = list(costs[0])
    best = {c: (costs[0][c], [c]) for c in classes}
    for cost in costs[1:]:
        best = {
            c: min(
                (
                    (v + cost[c] + (SAME_WET_STOP if p == c and c != "slick" else 0.0), path + [c])
                    for p, (v, path) in best.items()
                ),
                key=lambda t: (t[0], t[1][-2] != "slick"),
            )
            for c in classes
        }
    return min(best.values(), key=lambda t: (t[0], t[1][-1] != "slick"))[1]


def fit_classes(
    laps: pd.DataFrame,
    calls: list[LapCall],
    curves: dict,
    known: dict[tuple[str, int], str] | None = None,
) -> tuple[dict[tuple[str, int], str], list[float]]:
    """Each stint's tyre class (no compounds in the source) and the wetness they imply:
    alternately the wetness from the classes (wet.timeline) and the classes from the
    wetness, from all slicks, until neither changes. `known`: sourced classes (tyre facts),
    held in every round."""
    known = known or {}
    total = int(laps["LapNumber"].max())
    neutral = {c.lap for c in calls if c.neutral}
    rain = {c.lap for c in calls if c.wet}
    share = dry_shares(laps, neutral)
    key = list(zip(laps["Driver"].astype(str), stints(laps), strict=True))
    lap_no = laps["LapNumber"].astype(int)
    ok = share.notna() & ~lap_no.isin(neutral) & (share < 0.6)
    classes = {k: RAIN_CLASSES.get(known.get(k, "slick"), (known.get(k, "slick"),))[0]
               for k in dict.fromkeys(key)}  # fmt: skip
    grid_pen = {
        cls: wet.penalty(curves, comp, wet.GRID)
        for cls, comp in (("slick", "SOFT"), ("inter", "INTERMEDIATE"), ("wet", "WET"))
    }
    # Per stint: its laps and their shares (NaN where untimed, neutral or an off).
    mine: dict[tuple[str, int], tuple[list[int], list[float]]] = {}
    for k, lap, sh in zip(key, lap_no, share.where(ok), strict=True):
        mine.setdefault(k, ([], []))
        mine[k][0].append(int(lap))
        mine[k][1].append(float(sh))
    by_driver: dict[str, list[tuple[str, int]]] = {}
    for k in sorted(mine):
        by_driver.setdefault(k[0], []).append(k)
    w: list[float] = []
    for _ in range(MAX_ROUNDS):
        cls_of = pd.Series([classes[k] for k in key], index=laps.index)
        rows = pd.DataFrame({"lap": lap_no[ok], "cls": cls_of[ok], "share": share[ok]})
        obs = rows.groupby(["lap", "cls"])["share"].agg(["median", "count"]).reset_index()
        w = wet.timeline(obs, total, rain, curves)
        at = np.searchsorted(wet.GRID, np.round(w, 2) - 1e-9)
        new = {}
        for ks in by_driver.values():
            costs = [
                {
                    cls: np.inf
                    if k in known and cls not in RAIN_CLASSES.get(known[k], (known[k],))
                    else stint_cost(*mine[k], pen, at, neutral)
                    for cls, pen in grid_pen.items()
                }
                for k in ks
            ]
            new.update(zip(ks, driver_classes(costs), strict=True))
        if new == classes:
            break
        classes = new
    return classes, w


def estimate(
    laps: pd.DataFrame,
    curves: dict | None = None,
    dry_labels: dict[tuple[str, int], str] | None = None,
    known: dict[tuple[str, int], str] | None = None,
) -> Estimate:
    """The lap-time weather of a race with no weather data (and its tyre classes and SC laps
    where the source has none). `dry_labels`: step 2.4's estimated dry compound per (driver,
    stint) when the snapshot's compounds are that estimate rather than the source's (a
    Jolpica race ingested with estimates, which never labels a wet tyre): the classes are
    refitted, and a stint fitted as slick keeps its 2.4 label instead of DRY_PLACEHOLDER.
    `known`: sourced tyre classes per (driver, stint) (load_tyre_facts), kept as given."""
    curves = curves or wet.load_curves()
    calls, source = call_laps(laps)
    out, filled = laps.copy(), []
    neutral = {c.lap for c in calls if c.neutral}
    lap_no = out["LapNumber"].astype(int)
    if not has_status(laps):
        out["TrackStatus"] = np.where(lap_no.isin(neutral), "4", "1").astype(object)
        filled.append("TrackStatus: '4' on the safety-car laps found from the lap times, else '1'")
    classes: dict[tuple[str, int], str] = {}
    if dry_labels is not None or not has_compounds(laps):
        held = {k: v for k, v in (known or {}).items() if k in set(zip(
            out["Driver"].astype(str), stints(out), strict=True))}  # fmt: skip
        classes, _ = fit_classes(out, calls, curves, held)
        labels = dry_labels or {}
        key = zip(out["Driver"].astype(str), stints(out), strict=True)
        out["Compound"] = pd.Series(
            [
                labels.get(k, DRY_PLACEHOLDER)
                if classes[k] == "slick"
                else CLASS_COMPOUND[classes[k]]
                for k in key
            ],
            index=out.index,
            dtype=object,
        )
        dry = (
            "dry stints keep step 2.4's estimated compound"
            if dry_labels is not None
            else f"dry stints are '{DRY_PLACEHOLDER}' until step 2.4 estimates the dry compounds"
        )
        filled.append(f"Compound: each stint's tyre class fitted from the lap times; {dry}")
        if held:
            filled.append(
                f"Compound: {len(held)} stints' tyre class from sourced tyre facts"
                " (data/estimates/<id>.tyres.json), held through the fit"
            )
    return Estimate(out, calls, source, classes, filled)


# A tyre fact's class: slick, inter or wet, or "rain" when the report says only that the car
# went to rain tyres ("wets", "wet tyres" without saying which): the fit picks inter or wet.
RAIN_CLASSES = {"rain": ("inter", "wet")}
TYRE_FACT_KEYS = {"driver", "stint", "class", "fromLap", "toLap", "fact", "source", "note"}


def tyre_facts_path(race_id: str, estimates_dir: Path | None = None) -> Path:
    from . import estimates

    return Path(estimates_dir or estimates.ESTIMATES_DIR) / f"{race_id}.tyres.json"


def load_tyre_facts(race_id: str, estimates_dir: Path | None = None) -> dict[tuple[str, int], str]:
    """A race's sourced tyre classes, {(driver, stint): class}, from
    `data/estimates/<id>.tyres.json` ({"race", "stints": [{"driver", "stint", "class", "source",
    ...}]}: class is slick, inter, wet or rain (RAIN_CLASSES), source an http(s) URL); {} when
    there is none."""
    path = tyre_facts_path(race_id, estimates_dir)
    if not path.exists():
        return {}
    out: dict[tuple[str, int], str] = {}
    for i, item in enumerate(json.loads(path.read_text()).get("stints", [])):
        where = f"{path.name}: stints[{i}]"
        bad = sorted(set(item) - TYRE_FACT_KEYS)
        if bad:
            raise ValueError(f"{where}: unknown fields {bad}")
        if item.get("class") not in {*CLASS_COMPOUND, *RAIN_CLASSES}:
            raise ValueError(
                f"{where}: class must be one of {sorted({*CLASS_COMPOUND, *RAIN_CLASSES})}"
            )
        if not isinstance(item.get("driver"), str) or not isinstance(item.get("stint"), int):
            raise ValueError(f"{where}: needs a driver code and a stint number")
        src = item.get("source")
        if not isinstance(src, str) or not src.startswith(("http://", "https://")):
            raise ValueError(f"{where}: a tyre fact needs its source URL")
        key = (item["driver"], item["stint"])
        if key in out:
            raise ValueError(f"{where}: {key} given twice")
        out[key] = item["class"]
    return out


def estimated_dry_labels(sidecar: dict | None) -> dict[tuple[str, int], str] | None:
    """Step 2.4's dry compound per (driver, stint) from a Jolpica sidecar, if the race's
    compounds were estimated; None for a source with real compounds (TUM, FastF1). A stint
    an earlier run relabelled wet (update_sidecar) gives its 2.4 label back (`dry`), so a
    re-run fits from the same labels."""
    block = (sidecar or {}).get("estimates") or {}
    if "compounds" not in block.get("estimated", []):
        return None
    return {
        (str(s["driver"]), int(s["stint"])): str(s.get("dry", s["compound"]))
        for s in block.get("compounds", {}).get("stints", [])
    }


def report(est: Estimate, race_id: str, wetness: list[float] | None = None) -> dict:
    """The hand-check report: every lap's call, the wet spells, the inferred stints."""

    def spans(laps: set[int]) -> list[str]:
        return [f"{a}-{b}" if a != b else str(a) for a, b in runs(laps)]

    return {
        "race": race_id,
        "source": SOURCE,
        "neutralSource": est.neutral_source,
        "filled": est.filled,
        "wetSpells": spans({c.lap for c in est.calls if c.wet}),
        "neutralLaps": spans({c.lap for c in est.calls if c.neutral}),
        "ambiguous": [{"lap": c.lap, "why": c.ambiguous} for c in est.calls if c.ambiguous],
        "stintClasses": [
            {"driver": d, "stint": s, "class": cls}
            for (d, s), cls in sorted(est.classes.items())
            if cls != "slick"
        ],
        **({"wetness": wetness} if wetness is not None else {}),
        "laps": [
            {
                "lap": c.lap,
                "slowing": c.slowing,
                "gap": c.gap,
                "neutral": c.neutral,
                "wet": c.wet,
            }
            for c in est.calls
        ],
    }


def runs(laps: set[int]) -> list[tuple[int, int]]:
    """Consecutive runs of lap numbers, as (first, last)."""
    out: list[tuple[int, int]] = []
    for lap in sorted(laps):
        if out and lap == out[-1][1] + 1:
            out[-1] = (out[-1][0], lap)
        else:
            out.append((lap, lap))
    return out


def report_path(race_id: str, raw_dir: Path) -> Path:
    return raw_dir / f"{race_id}.wet-laps.json"


def write(race_id: str, est: Estimate, raw_dir: Path, wetness: list[float] | None = None) -> None:
    """Write the lap-time weather records and the report next to the raw snapshot, and the
    snapshot itself where fields were filled."""
    from . import ingest

    if est.filled:
        est.laps.to_parquet(ingest.raw_snapshot_path(race_id, raw_dir))
    ingest.save_weather(race_id, est.records(), raw_dir)
    report_path(race_id, raw_dir).write_text(
        json.dumps(report(est, race_id, wetness), indent=1) + "\n", encoding="utf-8", newline="\n"
    )


# --- a Jolpica race ingested with step 2.4's estimates ---------------------------------------

SIDECAR_NOTE = "wet tyre classes refitted from the lap times by `pipeline wet-laps` (step 4.5)"


def update_sidecar(sidecar: dict, est: Estimate) -> dict:
    """The Jolpica sidecar after a wet-laps fit (`estimate` with its dry labels): each wet
    stint's tyre in the stint list (its 2.4 label kept as `dry`), "weather" listed as estimated
    (the race file's provenance lists it), and one note on the relabelling (a re-run starts
    from the 2.4 labels and replaces the note). The raw snapshot has the final compounds."""
    block = sidecar["estimates"]
    compounds = block.setdefault("compounds", {})
    for s in compounds.get("stints", []):
        if "dry" in s:  # relabelled by an earlier run: start again from 2.4's label
            s["compound"] = s.pop("dry")
            if "dryBy" in s:
                s["by"] = s.pop("dryBy")
        cls = est.classes.get((str(s["driver"]), int(s["stint"])), "slick")
        if cls != "slick":
            s["dry"] = s["compound"]
            if "by" in s:
                s["dryBy"] = s["by"]
            s["compound"], s["by"] = CLASS_COMPOUND[cls], "wet-laps"
    from . import estimates

    est_fields = set(block.get("estimated", [])) | {"weather"}
    block["estimated"] = [f for f in estimates.FIELDS if f in est_fields]
    block["weather"] = {"method": f"wet laps from the lap times ({SOURCE}, step 4.5)"}
    notes = compounds.setdefault("notes", [])
    notes[:] = [n for n in notes if not n.startswith(SIDECAR_NOTE)]
    wet_stints = sum(cls != "slick" for cls in est.classes.values())
    notes.append(
        f"{SIDECAR_NOTE}: {wet_stints} stints on INTERMEDIATE / WET (the snapshot's Compound is"
        " final; a relabelled stint keeps 2.4's dry label as `dry`)"
    )
    return sidecar
