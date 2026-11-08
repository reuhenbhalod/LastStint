"""Estimated fields for the Eras races (eras build plan 2.4, simulator roadmap P2).

Jolpica (jolpica.py) has lap times, positions and results, and the stops come from F1DB
before 2011, but nothing says which tyre a car ran or when the safety car was out. This fills
those gaps with estimates, each one listed so the race file can say so
(`provenance.estimated`):

- compounds   One dry compound per race before 2007 (MEDIUM). From 2007, two: each stint is
              scored from its pace step (against the field on the same laps) and its wear,
              read as tyre life (stint_scores); the softer-scoring half are the option
              (SOFT), the rest the prime (HARD), and a car that stopped must run both (the
              rule since 2007). On the 2018-2025 FastF1 races with two dry compounds, 79% of
              stints get the right one of the two. From 2010 to 2013 a top-ten qualifier's
              first stint is the option (the Q3 tyre rule, Q3_TYRE_RULE) and the rest are
              fitted as above. A race with any real compound (TUM, FastF1, OpenF1) is never
              relabelled.
- safetyCars  Laps the whole field ran slowly. A safety car slows the field a lot (1.3-1.7x)
              and bunches it up; rain slows it less and spreads it out. A period that looks
              like a safety car is applied as one (TrackStatus "4"); one that might be rain,
              yellow flags or a red flag is flagged ambiguous and applied as a yellow ("2":
              kept out of the pace fit, no frozen SC event). Every period goes into a
              hand-check file, data/estimates/<race-id>.sc.json, with status "unchecked" for
              the owner to confirm against race reports (docs/eras-checks/2.4-estimates.md).
              A period the owner has marked "confirmed" or "rejected" is kept as marked.
- fuelLoads   Refuelling races (1994-2009): each stint's fuel at its start is its laps x the
              era's standard burn (headset.json `fuel.burnPerLap`, kg a lap: the fuel-load
              model's unit). The real burn was higher and teams carried margins: an estimate.
              The race file has no field for them yet (eras build plan 4.2), so they live in
              the raw sidecar and the build report. The fill rate (track.refuel, refuel.py's
              physical prior) is an estimate too and is listed under the same field.

Also flagged, never hidden (`quirks`): an official race time rounded to 0.1 s (Hungary 1998
in Jolpica), and a driver whose summed laps disagree with the official time by more than the
field's common offset: a post-race time penalty (Europe 2012 MAL, Saudi 2021 VER, Monaco 2022
OCO) or a timing gap (Brazil 2009 KOV).
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

from . import events as events_mod
from . import refuel as refuel_mod
from .paths import DATA_DIR, REPO_ROOT

ESTIMATES_DIR = DATA_DIR / "estimates"
HEADSET_PATH = REPO_ROOT / "packages" / "sim" / "src" / "headset.json"

# The provenance.estimated names (race-model schema v11), in the schema's order.
FIELDS = ("compounds", "safetyCars", "fuelLoads", "weather")

# --- compounds ---------------------------------------------------------------------------

TWO_COMPOUNDS_FROM = 2007  # the both-compounds rule (roadmap R5)
SINGLE = "MEDIUM"  # the one dry compound before 2007
OPTION, PRIME = "SOFT", "HARD"  # the softer and harder of the two from 2007
MIN_STINT_LAPS = 4  # clean laps a stint needs to be scored
OUTLIER_FACTOR = 1.07  # as clean.py: slower than this x the driver's median is dropped
# Seconds a kg of fuel costs a lap: the fuel-load model's fuelEffectPerLap / burnPerLap
# (docs/fuel-load-spec.md, "about 0.03 s").
FUEL_SECONDS_PER_KG = 0.03
PACE_WEIGHT = 0.25  # the pace step's weight against tyre life in a stint's softness
# The Q3 tyre rule: "At the start of the race each car which took part in Q3 must be fitted
# with the tyres with which the driver set his grid time. This will only be necessary if
# dry-weather tyres were used to set the grid time and if dry-weather are used at the start
# of the race" (FIA F1 Sporting Regulations 2010, art. 25.4(d); 2013, art. 25.4(e), the same
# words). From 2014 it was the tyres of the car's fastest Q2 time (2014 regulations, art.
# 25.4(e)), scrapped from 2022. The Q3 tyre was the option (owner decision, Nov 7 2026), so
# a top-ten qualifier's first stint is labelled OPTION in these years.
Q3_TYRE_RULE = range(2010, 2014)
TOP_TEN = 10  # Q3's cars

# --- safety cars -------------------------------------------------------------------------

SLOW = 1.10  # a race lap this much slower than the green baseline is neutralized or wet
LAP_ONE_SLOW = 1.35  # lap 1 is slow anyway (standing start)
SC_PACE = 1.25  # a safety car's peak slowdown is at least this
BUNCHED = 0.6  # ...and it brings the gap to the car GAP_CAR places back down to this share
RED_FLAG = 3.0  # a lap this slow is more likely a stoppage
GAP_CAR = 6  # the gap from the leader to this place measures the bunching
BASELINE_WINDOW = 9  # laps in the rolling green baseline
SC, YELLOW, GREEN, RED = "4", "2", "1", "5"
CHECK_STATUSES = ("unchecked", "confirmed", "rejected")

# --- fuel --------------------------------------------------------------------------------

REFUELLING = range(1994, 2010)  # stops refuelled (and 1983, which has no laps)


def era_for_year(year: int) -> str:
    """The race-model schema era a season belongs to."""
    if year <= 1993:
        return "1988-1993"
    if year <= 2009:
        return "1994-2009"
    if year <= 2013:
        return "2010-2013"
    if year <= 2025:
        return "2014-2025"
    return "2026+"


def burn_per_lap(era: str, headset_path: Path = HEADSET_PATH) -> float:
    """The era's standard burn (kg a green lap) from headset.json."""
    headset = json.loads(Path(headset_path).read_text())
    if era not in headset or "fuel" not in headset[era]:
        raise KeyError(f"no fuel block for era '{era}' in {headset_path}")
    return float(headset[era]["fuel"]["burnPerLap"])


def _ordered(laps: pd.DataFrame) -> pd.DataFrame:
    return laps.sort_values(["Driver", "LapNumber"])


def _pit(laps: pd.DataFrame) -> pd.Series:
    return laps["PitInTime"].notna() | laps["PitOutTime"].notna()


def _stint_bounds(laps: pd.DataFrame) -> pd.DataFrame:
    """Each (Driver, Stint): its first and last lap, from the stop-derived Stint column."""
    known = laps.dropna(subset=["Stint"])
    g = known.groupby(["Driver", "Stint"])["LapNumber"]
    return pd.DataFrame({"first": g.min(), "last": g.max()}).reset_index()


# --- compounds ---------------------------------------------------------------------------


@dataclass
class CompoundEstimate:
    laps: pd.DataFrame
    estimated: bool
    method: str
    stints: list[dict] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


def fuel_on_board(laps: pd.DataFrame, burn: float, refuelling: bool) -> pd.Series:
    """kg of fuel at the start of each lap, at the standard burn: to the end of the stint
    with refuelling, to the flag without."""
    if refuelling:
        bounds = _stint_bounds(laps).set_index(["Driver", "Stint"])["last"]
        keys = zip(laps["Driver"], laps["Stint"], strict=True)
        last = pd.Series([bounds.get(k, np.nan) for k in keys], index=laps.index)
    else:
        last = pd.Series(float(laps["LapNumber"].max()), index=laps.index)
    return (last - laps["LapNumber"] + 1) * burn


def _scoring_laps(laps: pd.DataFrame) -> pd.DataFrame:
    accurate = laps["IsAccurate"].astype("boolean").fillna(False).astype(bool)
    green = laps["TrackStatus"].astype("string") == GREEN
    keep = accurate & green & ~_pit(laps) & (laps["LapNumber"] > 1) & laps["LapTime"].notna()
    df = laps[keep]
    median = df.groupby("Driver")["LapTime"].transform("median")
    return df[df["LapTime"] <= OUTLIER_FACTOR * median]


def stint_scores(laps: pd.DataFrame, burn: float, refuelling: bool) -> pd.DataFrame:
    """Per (Driver, Stint): its laps, clean laps, pace step and softness. Unscored stints
    (fewer than MIN_STINT_LAPS clean laps) have NaN.

    - pace step: the stint's mean clean lap against the field's median on the same laps (so
      the fuel burn and the track's evolution cancel), less the driver's own median; with
      refuelling, the fuel on board is taken out first (FUEL_SECONDS_PER_KG). Negative =
      faster than the driver's other stints.
    - wear, as tyre life: the stint's laps. A softer tyre wears faster and is stopped sooner.
      Measured on the 2018-2025 FastF1 races (real compounds, two dry ones used), the softer
      of a driver's two stints was the shorter 84% of the time; the per-lap wear slope and
      the fresh-tyre pace were no better than chance (teams manage the tyres), so the slope
      isn't used.
    - softness = -z(laps) - PACE_WEIGHT * z(pace step), z-scored over the race's stints.
    """
    df = _scoring_laps(laps)
    corrected = df["LapTime"]
    if refuelling:
        corrected = corrected - FUEL_SECONDS_PER_KG * fuel_on_board(df, burn, refuelling)
    rel = corrected - corrected.groupby(df["LapNumber"]).transform("median")
    rel = rel - rel.groupby(df["Driver"]).transform("median")
    df = df.assign(_rel=rel)
    rows = []
    for (driver, stint), grp in _stint_bounds(laps).set_index(["Driver", "Stint"]).iterrows():
        mine = df[(df["Driver"] == driver) & (df["Stint"] == stint)]
        scored = len(mine) >= MIN_STINT_LAPS
        rows.append(
            {
                "Driver": driver,
                "Stint": stint,
                "first": int(grp["first"]),
                "last": int(grp["last"]),
                "laps": int(grp["last"] - grp["first"] + 1),
                "cleanLaps": len(mine),
                "step": float(mine["_rel"].mean()) if scored else np.nan,
            }
        )
    out = pd.DataFrame(rows)

    def z(col: pd.Series) -> pd.Series:
        sd = col.std()
        return (col - col.mean()) / sd if sd and not np.isnan(sd) else col * 0.0

    life = out["laps"].where(out["step"].notna())
    out["softness"] = -z(life) - PACE_WEIGHT * z(out["step"])
    return out


def assign_two_compounds(
    scores: pd.DataFrame, forced: dict[tuple[str, float], str] | None = None
) -> tuple[dict[tuple[str, float], str], dict]:
    """Label each stint OPTION or PRIME from its softness, then make every car with two or
    more stints run both (the stint nearest the threshold flips). Unscored stints take the
    compound the car still needs, else the race's more common one. `forced` stints (the Q3
    tyre rule's first stints) keep their given label and never flip; the threshold is still
    the median over every scored stint. Returns the labels and why each was given ("pace" /
    "rule" / "default" / "q3")."""
    forced = forced or {}
    scored = scores.dropna(subset=["softness"])
    threshold = float(scored["softness"].median()) if len(scored) else 0.0
    label: dict[tuple[str, float], str] = {}
    why: dict[tuple[str, float], str] = {}
    for key, compound in forced.items():
        label[key], why[key] = compound, "q3"
    for r in scored.itertuples():
        if (r.Driver, r.Stint) in forced:
            continue
        label[(r.Driver, r.Stint)] = OPTION if r.softness > threshold else PRIME
        why[(r.Driver, r.Stint)] = "pace"
    counts = pd.Series(list(label.values())).value_counts()
    common = str(counts.idxmax()) if len(counts) else PRIME
    for driver, grp in scores.groupby("Driver"):
        keys = [(driver, s) for s in grp["Stint"]]
        for key in keys:
            if key in label:
                continue
            used = {label[k] for k in keys if k in label}
            label[key] = ({OPTION, PRIME} - used).pop() if len(used) == 1 else common
            why[key] = "default"
        if len(keys) >= 2 and len({label[k] for k in keys}) == 1:
            have = label[keys[0]]
            need = PRIME if have == OPTION else OPTION
            soft = grp.set_index("Stint")["softness"]
            soft = soft[[(driver, st) not in forced for st in soft.index]]
            # The stint whose score is closest to the other compound flips (never a forced one).
            ranked = soft.sort_values(ascending=(need == PRIME), na_position="last")
            flip = (driver, ranked.index[0])
            label[flip] = need
            why[flip] = "rule"
    return label, why


def option_starters(year: int, sidecar: dict | None) -> tuple[set[str] | None, str | None]:
    """The cars the Q3 tyre rule put on the option at the start (Q3_TYRE_RULE years): those
    in the Jolpica sidecar's Q3 classification that also started in the top ten. A Q3 car
    starting further back is left to the fit: a grid penalty kept the rule, but an exclusion
    or a pit-lane start (abu-dhabi-2012 VET, grid 24) freed the choice, and the grid can't
    tell them apart. Returns (cars, None), or (None, why not) outside those years or without
    a Q3 classification (a sidecar ingested before it was read: re-ingest)."""
    if year not in Q3_TYRE_RULE:
        return None, None
    side = sidecar or {}
    q3 = side.get("q3")
    if q3 is None:
        return None, (
            "Q3 tyre rule not applied: no Q3 classification in the sidecar"
            " (re-ingest with `pipeline jolpica <race-id> --force`)"
        )
    top_grid = {
        r["driver"] for r in side.get("results", []) if r.get("grid") and r["grid"] <= TOP_TEN
    }
    return {r["driver"] for r in q3} & top_grid, None


def estimate_compounds(
    laps: pd.DataFrame,
    year: int,
    burn: float,
    refuelling: bool,
    option_start: set[str] | None = None,
) -> CompoundEstimate:
    """Fill Compound (roadmap P2). Leaves a race with any real compound untouched.
    `option_start`: cars whose first stint is the option (option_starters)."""
    if laps["Compound"].notna().any():
        return CompoundEstimate(laps, False, "real compounds: not relabelled")
    out = laps.copy()
    if year < TWO_COMPOUNDS_FROM:
        out["Compound"] = SINGLE
        return CompoundEstimate(
            out,
            True,
            f"one dry compound before {TWO_COMPOUNDS_FROM}: every lap {SINGLE}",
            notes=["wet tyres aren't estimated: a wet race needs its weather block"],
        )
    if out["Stint"].isna().all():
        raise ValueError("two-compound estimate needs the stops (Stint is empty)")
    scores = stint_scores(out, burn, refuelling)
    first = scores.groupby("Driver")["Stint"].min()
    forced = {(d, first[d]): OPTION for d in sorted(option_start or ()) if d in first.index}
    label, why = assign_two_compounds(scores, forced)
    keys = list(zip(out["Driver"], out["Stint"], strict=True))
    out["Compound"] = [label.get(k) for k in keys]
    stints = []
    for r in scores.itertuples():
        key = (r.Driver, r.Stint)
        stints.append(
            {
                "driver": str(r.Driver),
                "stint": int(r.Stint),
                "fromLap": r.first,
                "toLap": r.last,
                "compound": label[key],
                "by": why[key],
                "cleanLaps": int(r.cleanLaps),
                "paceStep": None if np.isnan(r.step) else round(float(r.step), 3),
                "softness": None if np.isnan(r.softness) else round(float(r.softness), 3),
            }
        )
    notes = []
    if forced:
        unforced, _ = assign_two_compounds(scores)
        changed = sum(unforced[k] != OPTION for k in forced)
        notes.append(
            f"{len(forced)} top-ten first stints set to {OPTION} by the Q3 tyre rule"
            f" ({changed} the fit alone labelled {PRIME})"
        )
    flipped = sum(s["by"] == "rule" for s in stints)
    if flipped:
        notes.append(f"{flipped} stints set by the both-compounds rule")
    defaults = sum(s["by"] == "default" for s in stints)
    if defaults:
        notes.append(f"{defaults} stints too short to score")
    method = (
        f"two compounds ({OPTION} option, {PRIME} prime) from each stint's pace step and wear"
        " (tyre life), with the both-compounds rule"
    )
    if forced:
        method += f"; the top ten start on the {OPTION} (the Q3 tyre rule, {year})"
    return CompoundEstimate(out, True, method, stints, notes)


# --- safety cars -------------------------------------------------------------------------


def race_lap_pace(laps: pd.DataFrame) -> pd.DataFrame:
    """Per race lap: the field's median lap time (lead-lap cars, no in- or out-laps), the
    green baseline (rolling median of the laps near the race's median pace), their ratio,
    and the gap from the leader to the GAP_CAR-th car at the lap's end."""
    lead = events_mod.leader_laps(laps).set_index("LapNumber")["Time"]
    df = laps.dropna(subset=["LapTime", "Time"])
    df = df[~_pit(df)]
    next_lead = lead.shift(-1).reindex(df["LapNumber"]).to_numpy()
    on_lead_lap = np.isnan(next_lead) | (df["Time"].to_numpy() <= next_lead)
    df = df[on_lead_lap]
    median = df.groupby("LapNumber")["LapTime"].median()
    count = df.groupby("LapNumber")["LapTime"].size()
    median = median[count >= 3]
    overall = median[median.index > 1].median()
    calm = median.where((median.index > 1) & (median < 1.07 * overall))
    baseline = (
        calm.rolling(BASELINE_WINDOW, center=True, min_periods=3).median().interpolate().bfill()
    ).ffill()
    timed = laps.dropna(subset=["Time", "Position"])
    gap = {}
    for lap, grp in timed.groupby("LapNumber"):
        ordered = grp.sort_values("Position")["Time"].to_numpy()
        if len(ordered) >= GAP_CAR:
            gap[lap] = float(ordered[GAP_CAR - 1] - ordered[0])
    return pd.DataFrame(
        {
            "median": median,
            "baseline": baseline,
            "ratio": median / baseline,
            "gap": pd.Series(gap).reindex(median.index),
        }
    )


def detect_neutralizations(laps: pd.DataFrame) -> list[dict]:
    """Periods of field-wide slow laps, each judged a likely safety car or ambiguous."""
    pace = race_lap_pace(laps)
    slow = pace["ratio"] >= SLOW
    if 1 in slow.index:
        slow.loc[1] = pace.at[1, "ratio"] >= LAP_ONE_SLOW
    periods: list[list[int]] = []
    for lap, is_slow in slow.items():
        if not is_slow:
            continue
        if periods and periods[-1][-1] == lap - 1:
            periods[-1].append(int(lap))
        else:
            periods.append([int(lap)])
    out = []
    for laps_in in periods:
        start, end = laps_in[0], laps_in[-1]
        peak = float(pace.loc[laps_in, "ratio"].max())
        before = pace["gap"].get(start - 1)
        after_laps = [n for n in (*laps_in, end + 1) if n in pace.index]
        after = pace.loc[after_laps, "gap"].min() if after_laps else np.nan
        compression = (
            float(after / before)
            if before is not None and not np.isnan(before) and before > 0 and not np.isnan(after)
            else None
        )
        reasons = []
        if peak >= RED_FLAG:
            reasons.append(f"a {peak:.1f}x lap: a red flag?")
        if peak < SC_PACE:
            reasons.append(f"only {peak:.2f}x slower: rain, yellow flags or a short SC?")
        if compression is not None and compression > BUNCHED:
            reasons.append(
                f"the field didn't bunch up (P1-P{GAP_CAR} {before:.1f}s -> {after:.1f}s): rain?"
            )
        if compression is None and peak < SC_PACE + 0.1:
            reasons.append("no gap before it to show bunching")
        if len(laps_in) == 1:
            reasons.append("a single slow lap")
        out.append(
            {
                "startLap": start,
                "endLap": end,
                "laps": len(laps_in),
                "kind": "SC",
                "confidence": "ambiguous" if reasons else "likely",
                "peakRatio": round(peak, 3),
                "gapBefore": None if before is None or np.isnan(before) else round(before, 1),
                "gapAfter": None if np.isnan(after) else round(float(after), 1),
                "reasons": reasons,
                "status": "unchecked",
            }
        )
    return out


def merge_hand_checks(detected: list[dict], existing: list[dict]) -> list[dict]:
    """Keep the owner's checked periods as written (confirmed or rejected, laps as edited);
    a fresh detection overlapping one is dropped; unchecked ones are replaced."""
    for p in existing:
        if p.get("status") not in CHECK_STATUSES:
            raise ValueError(
                f"hand-check status {p.get('status')!r} (laps {p.get('startLap')}-"
                f"{p.get('endLap')}) is not one of {CHECK_STATUSES}"
            )
        laps = (p.get("startLap"), p.get("endLap"))
        if not all(isinstance(n, int) for n in laps) or laps[0] < 1 or laps[1] < laps[0]:
            raise ValueError(f"hand-check period needs startLap <= endLap (laps): {p}")
        if p.get("kind", "SC") not in ("SC", "RED"):
            raise ValueError(f"hand-check kind {p.get('kind')!r} is not SC or RED")
    checked = [p for p in existing if p["status"] != "unchecked"]

    def overlaps(a: dict, b: dict) -> bool:
        return a["startLap"] <= b["endLap"] and b["startLap"] <= a["endLap"]

    fresh = [d for d in detected if not any(overlaps(d, c) for c in checked)]
    return sorted([*checked, *fresh], key=lambda p: p["startLap"])


def period_code(period: dict) -> str | None:
    """The TrackStatus a period applies: SC / red flag, yellow for an ambiguous unconfirmed
    one, nothing for a rejected one."""
    if period["status"] == "rejected":
        return None
    if period["status"] == "confirmed":
        return RED if period.get("kind") == "RED" else SC
    return SC if period["confidence"] == "likely" else YELLOW


def apply_neutralizations(
    laps: pd.DataFrame, periods: list[dict]
) -> tuple[pd.DataFrame, list[dict]]:
    """Fill TrackStatus (FastF1's per-lap codes: every code the car's lap saw, in order) and
    the status timeline [{time, status}] from the periods, on the leader's race laps."""
    lead = events_mod.leader_laps(laps).set_index("LapNumber")["Time"].sort_index()
    total = int(laps["LapNumber"].max())
    race_code = dict.fromkeys(range(1, total + 1), GREEN)
    timeline = [{"time": 0.0, "status": GREEN}]
    for p in periods:
        code = period_code(p)
        if code is None:
            continue
        for n in range(p["startLap"], p["endLap"] + 1):
            race_code[n] = code
        begin = float(lead.get(p["startLap"] - 1, 0.0)) if p["startLap"] > 1 else 0.0
        end = lead.get(p["endLap"])
        timeline.append({"time": round(begin, 3), "status": code})
        if end is not None and not pd.isna(end):
            timeline.append({"time": round(float(end), 3), "status": GREEN})
    timeline.sort(key=lambda r: r["time"])
    # Race-lap windows on the leader's clock.
    ends = lead.reindex(range(1, total + 1)).ffill().to_numpy()
    starts = np.concatenate([[0.0], ends[:-1]])
    out = _ordered(laps).copy()
    prev = out.groupby("Driver")["Time"].shift(1).fillna(0.0)
    statuses = []
    for n, t0, t1 in zip(out["LapNumber"], prev, out["Time"], strict=True):
        if pd.isna(t1):
            statuses.append(race_code.get(int(n), GREEN))
            continue
        # Race laps the car's lap overlapped by more than a second.
        hit = [
            race_code[i + 1] for i in range(total) if min(t1, ends[i]) - max(t0, starts[i]) > 1.0
        ] or [race_code.get(int(n), GREEN)]
        codes = list(dict.fromkeys(hit))
        statuses.append("".join(codes))
    out["TrackStatus"] = statuses
    return out.reindex(laps.index), timeline


def sc_check_path(race_id: str, estimates_dir: Path = ESTIMATES_DIR) -> Path:
    return Path(estimates_dir) / f"{race_id}.sc.json"


def load_hand_checks(race_id: str, estimates_dir: Path = ESTIMATES_DIR) -> list[dict]:
    path = sc_check_path(race_id, estimates_dir)
    return json.loads(path.read_text())["periods"] if path.exists() else []


def write_hand_checks(race_id: str, periods: list[dict], estimates_dir: Path) -> Path:
    path = sc_check_path(race_id, estimates_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    doc = {
        "race": race_id,
        "how": "docs/eras-checks/2.4-estimates.md: check each period against a race report;"
        " set status to confirmed or rejected (edit startLap/endLap if they're off), then"
        " re-run `pipeline jolpica <race-id> --force`.",
        "periods": periods,
    }
    path.write_text(json.dumps(doc, indent=1) + "\n")
    return path


# --- fuel --------------------------------------------------------------------------------


def estimate_fuel_loads(laps: pd.DataFrame, burn: float) -> list[dict]:
    """Each stint's fuel at its start: its laps x the standard burn (kg). A car that
    retired gets the laps it ran, not the fill it took (unknowable)."""
    out = []
    for r in _stint_bounds(laps).itertuples():
        n = int(r.last - r.first + 1)
        out.append(
            {
                "driver": str(r.Driver),
                "stint": int(r.Stint),
                "fromLap": int(r.first),
                "laps": n,
                "fuelKg": round(n * burn, 1),
            }
        )
    return out


# --- quirks ------------------------------------------------------------------------------


def time_quirks(race_time_check: list[dict], results: list[dict]) -> list[str]:
    """Official race times that summed laps can't reproduce: a time rounded to 0.1 s, and a
    driver whose difference isn't the field's common one (a post-race penalty or a gap)."""
    out = []
    winner = next((r for r in results if r.get("position") == 1), None)
    if winner and winner.get("time") is not None:
        t = winner["time"]
        if abs(t * 10 - round(t * 10)) < 1e-6 and abs(t * 100 - round(t * 100)) < 1e-6:
            out.append(
                f"{winner['driver']}: official race time {t:.3f}s is rounded to 0.1s in"
                " Jolpica; every lead-lap gap carries that rounding"
            )
    diffs = [r["diff"] for r in race_time_check if r.get("diff") is not None]
    if not diffs:
        return out
    common = float(np.median(diffs))
    if abs(common) > 0.1:
        out.append(f"summed laps are {common:+.3f}s off the official times for the whole field")
    for r in race_time_check:
        if r.get("diff") is None:
            out.append(f"{r['driver']}: an untimed lap, the race time can't be checked")
            continue
        extra = r["diff"] - common
        if abs(extra) >= 1.0:
            what = (
                "a post-race time penalty?"
                if extra < 0
                else "official time shorter than the laps: a timing gap or a removed penalty?"
            )
            out.append(
                f"{r['driver']} (P{r['position']}): official time {-extra:+.3f}s against the"
                f" summed laps, {what} The laps order is used; check the classification"
            )
    return out


# --- one race ----------------------------------------------------------------------------


@dataclass
class RaceEstimates:
    laps: pd.DataFrame
    status: list[dict]
    periods: list[dict]
    block: dict  # the sidecar's "estimates" block


def estimate_race(
    race_id: str,
    laps: pd.DataFrame,
    year: int,
    *,
    sidecar: dict | None = None,
    hand_checks: list[dict] | None = None,
    headset_path: Path = HEADSET_PATH,
) -> RaceEstimates:
    """Every estimate for one race's raw laps, and the sidecar block listing them."""
    era = era_for_year(year)
    estimated: list[str] = []
    block: dict = {"era": era}
    # Safety cars first: the compound estimate scores green laps only.
    if laps["TrackStatus"].notna().any():
        out, status, periods = laps, None, []
        block["safetyCars"] = {"method": "real track status: not estimated"}
    else:
        detected = detect_neutralizations(laps)
        periods = merge_hand_checks(detected, hand_checks or [])
        out, status = apply_neutralizations(laps, periods)
        estimated.append("safetyCars")
        block["safetyCars"] = {
            "method": f"field-wide slow laps (>= {SLOW}x the green baseline); likely SC when"
            f" >= {SC_PACE}x and the field bunches up, else ambiguous (applied as yellow)",
            "periods": periods,
        }
    refuelling = year in REFUELLING
    burn = burn_per_lap(era, headset_path)
    starters, no_rule = option_starters(year, sidecar)
    comp = estimate_compounds(out, year, burn, refuelling, starters)
    out = comp.laps
    if comp.estimated:
        estimated.append("compounds")
        if no_rule:
            comp.notes.append(no_rule)
    block["compounds"] = {"method": comp.method, "stints": comp.stints, "notes": comp.notes}
    if refuelling and out["Stint"].notna().any():
        estimated.append("fuelLoads")
        block["fuelLoads"] = {
            "method": "stint laps x the era's standard burn (headset.json fuel.burnPerLap)",
            "burnPerLap": burn,
            "unit": "kg",
            "fillRate": refuel_mod.FILL_RATE_METHOD,
            "stints": estimate_fuel_loads(out, burn),
        }
    if year == 2005:
        block["compounds"]["notes"].append(
            "2005: no tyre changes in the race, but TyreLife restarts at each stop"
            " (rules.tyreChanges, eras build plan 4.1)"
        )
    block["estimated"] = [f for f in FIELDS if f in estimated]
    side = sidecar or {}
    block["quirks"] = time_quirks(side.get("raceTimeCheck", []), side.get("results", []))
    return RaceEstimates(out, status, periods, block)


def provenance(estimated: list[str], overlay: dict | None = None) -> dict | None:
    """The race file's provenance: the overlay's kind (default real) and the union of the
    estimated fields. None when nothing is estimated and the overlay sets none."""
    if not estimated and not overlay:
        return None
    merged = set(estimated) | set((overlay or {}).get("estimated", []))
    unknown = merged - set(FIELDS)
    if unknown:
        raise ValueError(f"unknown estimated fields {sorted(unknown)}")
    out = {"kind": (overlay or {}).get("kind", "real")}
    if merged:
        out["estimated"] = [f for f in FIELDS if f in merged]
    return out


def report_lines(block: dict) -> list[str]:
    """The build report's lines for a race's estimates."""
    lines = []
    est = block.get("estimated", [])
    lines.append(f"estimated: {', '.join(est) if est else 'nothing'}")
    comp = block.get("compounds")
    if comp and "compounds" in est:
        tally = pd.Series([s["compound"] for s in comp["stints"]]).value_counts().to_dict()
        detail = f" ({', '.join(f'{k} {v} stints' for k, v in tally.items())})" if tally else ""
        lines.append(f"  compounds: {comp['method']}{detail}")
        lines += [f"    {n}" for n in comp["notes"]]
    sc = block.get("safetyCars")
    if sc and "safetyCars" in est:
        lines.append(f"  safety cars: {len(sc['periods'])} periods")
        for p in sc["periods"]:
            why = f" ({'; '.join(p['reasons'])})" if p.get("reasons") else ""
            seen = f", peak {p['peakRatio']}x" if p.get("peakRatio") is not None else ""
            judged = f" {p['confidence']}" if p.get("confidence") else ""
            lines.append(
                f"    laps {p['startLap']}-{p['endLap']} {p.get('kind', 'SC')}{judged},"
                f" {p['status']}{seen}{why}"
            )
    fuel = block.get("fuelLoads")
    if fuel:
        kg = [s["fuelKg"] for s in fuel["stints"]]
        lines.append(
            f"  fuel loads: {len(kg)} stints at {fuel['burnPerLap']} kg/lap, {min(kg)}-{max(kg)} kg"
        )
        if fuel.get("fillRate"):
            lines.append(f"  {fuel['fillRate']}")
    lines += [f"  quirk: {q}" for q in block.get("quirks", [])]
    return lines
