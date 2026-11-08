"""Weather (docs/weather-spec.md): how wet the track was on each lap, and what that costs each
kind of tyre.

The model. A lap's wetness w (0 dry .. 1 standing water) costs each tyre class a share of the
car's dry lap time, by three curves shared by every race (data/wet.json, fitted on all the wet
races by `pipeline wet-fit`):

    slick  a·w + b·w²                       (loses time ever faster: undriveable when wet)
    inter  min + dry·(best − w)⁺ + wet·(w − best)⁺   (best on a damp track; slow when dry)
    wet    the same shape, best on a soaked track

A race's wetness timeline is fitted from its own laps: each lap's time against the car's dry
pace (the dry lap model, fitted on the laps the rain didn't touch, with a fixed fuel effect
since the dry laps may be few), by tyre class, and a smooth path through them (a little pull
to dry on dry-looking laps, and away from bone dry where it was raining). Slicks barely wear
on a wet track, inters and wets wear fast on a dry one (wear multipliers below; the sims use
the same). Both sims read the curves and the timeline from the race model.
"""

from __future__ import annotations

import json

import numpy as np
import pandas as pd

from .paths import REPO_ROOT
from .refuel import fuel_lap_of

WET_CURVES_PATH = REPO_ROOT / "data" / "wet.json"
WET_COMPOUNDS = ("INTERMEDIATE", "WET")
# The fuel effect wet races are fitted with (s/lap): the median of the dry races' fits. A wet
# race's dry laps can be a short window, too short to fit it.
FUEL_PRIOR = 0.056
# The wetness grid the timeline is fitted on, and how smooth it must be lap to lap.
GRID = np.linspace(0.0, 1.0, 101)
SMOOTH = 0.05
# Model compounds for the wet tyres (no dry evidence to fit them on): their pace is in the
# curves; wear in seconds a lap of tyre age, and their life.
WET_TYRES = {
    "INTERMEDIATE": {"offset": 0.0, "degPerLap": 0.05, "cliffLap": 30},
    "WET": {"offset": 0.0, "degPerLap": 0.04, "cliffLap": 35},
}


def tyre_class(compound: str) -> str:
    return {"INTERMEDIATE": "inter", "WET": "wet"}.get(compound, "slick")


def penalty(curves: dict, compound: str, w: float):
    """The share of a dry lap a tyre loses at wetness w (numpy-friendly in w)."""
    cls = tyre_class(compound)
    if cls == "slick":
        c = curves["slick"]
        return c["a"] * w + c["b"] * w * w
    c = curves[cls]
    return (
        c["min"]
        + c["dry"] * np.maximum(0.0, c["best"] - w)
        + c["wet"] * np.maximum(0.0, w - c["best"])
    )


def wear_mult(compound: str, w: float) -> float:
    """Tyre wear a lap at wetness w, against a dry lap: slicks barely wear on a wet track;
    inters and wets overheat and wear fast on a drying one. Estimates (no wear evidence)."""
    cls = tyre_class(compound)
    if cls == "slick":
        return 1.0 - 0.8 * min(1.0, w / 0.05)
    edge = 0.15 if cls == "inter" else 0.3
    return 1.0 + 2.0 * max(0.0, (edge - w) / edge)


def load_curves() -> dict:
    return json.loads(WET_CURVES_PATH.read_text())


def is_wet_race(laps: pd.DataFrame, weather: list[dict] | None) -> bool:
    """A race with wet tyres on track or rain falling during it."""
    used = set(laps["Compound"].dropna().astype(str))
    return bool(used & set(WET_COMPOUNDS)) or bool(weather and rain_laps(laps, weather))


def rain_laps(laps: pd.DataFrame, weather: list[dict] | None) -> set[int]:
    """Laps on which rain fell in the five minutes before the leader finished them (records
    with a `lap`: the laps the lap times say were wet, wet_laps.py)."""
    if not weather:
        return set()
    if "lap" in weather[0]:
        return {int(x["lap"]) for x in weather if x["rain"]}
    ends = laps.groupby("LapNumber")["Time"].min()
    out = set()
    for lap, t in ends.items():
        if t == t and any(x["rain"] and t - 300 <= x["time"] <= t for x in weather):
            out.add(int(lap))
    return out


# Laps before a wet spell that count as touched by it: the first drizzle comes before the rain
# gauge shows it (Great Britain 2024's slowing laps fitted a medium "cliff" otherwise).
WET_LEAD = 2


def wet_period(laps: pd.DataFrame, weather: list[dict] | None) -> set[int]:
    """Laps the rain touched: rain falling, or anyone on wet tyres, and the few laps before."""
    wet = laps[laps["Compound"].astype(str).isin(WET_COMPOUNDS)]["LapNumber"]
    core = {int(x) for x in wet} | rain_laps(laps, weather)
    return core | {lap - k for lap in core for k in range(1, WET_LEAD + 1) if lap - k >= 1}


def effective_age(laps: pd.DataFrame, period: set[int]) -> pd.Series:
    """Each lap's tyre wear in dry-lap units: a wet-period lap ages slicks a fifth as much
    (wear_mult at w >= 0.1)."""
    out = laps["TyreLife"].astype(float).copy()
    for _, grp in laps.sort_values("LapNumber").groupby(["Driver", "Stint"], dropna=False):
        first = grp["TyreLife"].iloc[0]
        age = float(first) - 1 if first == first else 0.0
        for idx, lap, comp in zip(
            grp.index, grp["LapNumber"], grp["Compound"].astype(str), strict=True
        ):
            slick = tyre_class(comp) == "slick"
            age += 0.2 if (slick and int(lap) in period) else 1.0
            out.loc[idx] = age
    return out


def observations(
    laps: pd.DataFrame, predict, period: set[int], wear: pd.Series | None = None
) -> pd.DataFrame:
    """Per lap and tyre class: the median share of a dry lap the field lost, and how many
    laps that is from. `predict(driver, compound, wear_age, lap)` is the dry model (compound
    None: the dry reference tyre, new)."""
    eff = effective_age(laps, period) if wear is None else wear + 1.0
    ok = (
        laps["IsAccurate"].fillna(False).astype(bool)
        & laps["TrackStatus"].astype(str).eq("1")
        & laps["LapTime"].notna()
    )
    rows = []
    for idx, r in laps[ok].iterrows():
        cls = tyre_class(str(r.Compound))
        dry = (
            predict(r.Driver, str(r.Compound), float(eff.loc[idx]), fuel_lap_of(r))
            if cls == "slick"
            else predict(r.Driver, None, 0.0, fuel_lap_of(r))
        )
        if dry is None:
            continue
        share = float(r.LapTime) / dry - 1
        if share < 0.6:  # an off or a spin, not the track
            rows.append((int(r.LapNumber), cls, share))
    obs = pd.DataFrame(rows, columns=["lap", "cls", "share"])
    return obs.groupby(["lap", "cls"])["share"].agg(["median", "count"]).reset_index()


# Before 2018 (wet_laps.py): the pull to dry on the laps the lap times call dry (no rain
# gauge to say so, and the dry model's misses would otherwise read as a damp track).
DRY_FIRM = 0.05


def dry_laps(weather: list[dict] | None) -> set[int]:
    """The laps lap-time records (wet_laps.py) call dry, ambiguous ones aside; none for a
    rain gauge's records."""
    if not weather or "lap" not in weather[0]:
        return set()
    return {int(x["lap"]) for x in weather if not x["rain"] and not x.get("ambiguous")}


def timeline(
    obs: pd.DataFrame, laps: int, rain: set[int], curves: dict, dry: set[int] | None = None
) -> list[float]:
    """The race's wetness on each lap 1..laps: the smooth path that best explains `obs`
    (`dry`: laps firmly pulled to dry, wet_laps.py)."""
    model = {
        cls: penalty(curves, comp, GRID)
        for cls, comp in (("slick", "SOFT"), ("inter", "INTERMEDIATE"), ("wet", "WET"))
    }
    cost = np.zeros((laps + 1, len(GRID)))
    by_lap = {lap: g for lap, g in obs.groupby("lap")}
    for lap in range(1, laps + 1):
        g = by_lap.get(lap)
        c = np.zeros(len(GRID))
        if g is not None:
            for r in g.itertuples():
                c += min(int(r.count), 8) * (float(r.median) - model[r.cls]) ** 2
        slick_only = g is None or (g["cls"].eq("slick").all() and g["median"].max() < 0.03)
        if lap not in rain and slick_only:
            c += 0.002 * GRID  # dry-looking: a little pull to dry
        if lap in rain:
            # Raining: at least damp (slicks then wear slowly, wear_mult), even where the
            # lap times hardly show it.
            c += 0.5 * np.maximum(0.0, 0.05 - GRID)
        if dry and lap in dry:
            c += DRY_FIRM * GRID
        cost[lap] = c
    trans = SMOOTH * (GRID[:, None] - GRID[None, :]) ** 2
    best = np.full_like(cost, np.inf)
    back = np.zeros(cost.shape, dtype=int)
    best[1] = cost[1]
    for lap in range(2, laps + 1):
        total = best[lap - 1][:, None] + trans
        back[lap] = total.argmin(0)
        best[lap] = total.min(0) + cost[lap]
    k = int(best[laps].argmin())
    path = [k]
    for lap in range(laps, 1, -1):
        k = int(back[lap][k])
        path.append(k)
    return [round(float(GRID[i]), 2) for i in reversed(path)]


def fit_cost(obs: pd.DataFrame, laps: int, rain: set[int], curves: dict) -> float:
    """Squared error of the best timeline under `curves` (for fitting the curves)."""
    w = np.array(timeline(obs, laps, rain, curves))
    err = 0.0
    for r in obs.itertuples():
        comp = {"slick": "SOFT", "inter": "INTERMEDIATE", "wet": "WET"}[r.cls]
        err += (
            min(int(r.count), 8)
            * (float(r.median) - float(penalty(curves, comp, w[r.lap - 1]))) ** 2
        )
    return err


def curves_from(x) -> dict:
    a, b, imin, idry, iwet, ibest, wmin, wdry, wwet, wbest = (float(v) for v in x)
    return {
        "slick": {"a": a, "b": b},
        "inter": {"min": imin, "dry": idry, "wet": iwet, "best": ibest},
        "wet": {"min": wmin, "dry": wdry, "wet": wwet, "best": wbest},
    }


def curve_prior(c: dict) -> float:
    """Physics where the data is thin: inters ~8% off dry slicks on a dry track and never
    better than 3% off; past the crossover slicks lose time faster than inters, and inters
    faster than wets."""
    i, s, w = c["inter"], c["slick"], c["wet"]
    out = 200 * max(0, 0.08 - (i["min"] + i["dry"] * i["best"])) ** 2
    out += 200 * max(0, 0.03 - i["min"]) ** 2
    for x in (0.4, 0.6, 0.8, 1.0):
        out += 50 * max(0, i["wet"] - 0.8 * (s["a"] + 2 * s["b"] * x)) ** 2
    out += 50 * max(0, w["wet"] - i["wet"]) ** 2
    return out


def fit_curves(races: list[tuple[pd.DataFrame, int, set[int]]], start: dict) -> dict:
    """The curves that best explain every wet race at once (each with its own timeline)."""
    from scipy.optimize import minimize

    def total(x):
        if min(x) < 0 or x[5] > 1 or x[9] > 1:
            return 1e9
        c = curves_from(x)
        return curve_prior(c) + sum(fit_cost(obs, n, rain, c) for obs, n, rain in races)

    x0 = [start["slick"]["a"], start["slick"]["b"]] + [
        start[k][f] for k in ("inter", "wet") for f in ("min", "dry", "wet", "best")
    ]
    res = minimize(
        total, x0, method="Nelder-Mead", options={"maxiter": 4000, "xatol": 1e-4, "fatol": 1e-6}
    )
    return {k: {f: round(v, 4) for f, v in d.items()} for k, d in curves_from(res.x).items()}


def sim_wear(laps: pd.DataFrame, weather: dict) -> pd.Series:
    """Each lap's tyre wear as the sims count it while running the lap (dry-lap units, the
    weather's wear multipliers along the stint)."""
    from .sim_reference import weather_wear

    out = pd.Series(np.nan, index=laps.index)
    for _, grp in laps.sort_values("LapNumber").groupby(["Driver", "Stint"], dropna=False):
        first = grp["TyreLife"].iloc[0]
        wear = float(first) - 1 if first == first else 0.0
        for idx, lap, comp in zip(
            grp.index, grp["LapNumber"], grp["Compound"].astype(str), strict=True
        ):
            out.loc[idx] = wear
            wear += weather_wear(weather, comp, int(lap))
    return out


def race_observations(
    laps: pd.DataFrame, weather: list[dict] | None, fitted, curves: dict | None = None
) -> tuple[pd.DataFrame, int, set[int]]:
    """A wet race's observations against its dry model, its laps, and its rain laps."""
    from . import fit as fit_mod

    def predict(driver, compound, age, lap):
        if driver not in fitted.driver_pace:
            return None
        return fit_mod.predict(fitted, driver, compound or fitted.reference_compound, age, lap)

    # Two passes: tyre wear depends on the wetness (wear_mult), so the second pass counts the
    # wear exactly as the sims will along the first pass's timeline.
    total, rain = int(laps["LapNumber"].max()), rain_laps(laps, weather)
    obs = observations(laps, predict, wet_period(laps, weather))
    if curves is not None:
        first = {
            "curves": curves,
            "wetness": timeline(obs, total, rain, curves, dry_laps(weather)),
        }
        obs = observations(laps, predict, wet_period(laps, weather), sim_wear(laps, first))
    return obs, total, rain


def weather_block(laps: pd.DataFrame, weather: list[dict] | None, fitted, curves: dict) -> dict:
    """The race model's `weather`: the curves and the race's wetness on every lap."""
    obs, total, rain = race_observations(laps, weather, fitted, curves)
    return {"curves": curves, "wetness": timeline(obs, total, rain, curves, dry_laps(weather))}


def rms(obs: pd.DataFrame, wetness: list[float], curves: dict) -> float:
    """Root-mean-square miss (share of a lap) of the curves on a race's observations."""
    comp = {"slick": "SOFT", "inter": "INTERMEDIATE", "wet": "WET"}
    err = [
        float(r.median) - float(penalty(curves, comp[r.cls], wetness[r.lap - 1]))
        for r in obs.itertuples()
    ]
    return float(np.sqrt(np.mean(np.square(err)))) if err else 0.0


# A driver's wet pace is shrunk toward the field's by this many laps' worth of evidence.
WET_PACE_SHRINK = 5
# Laps drier than this count as dry (for the dry pace offsets), wetter for the wet pace.
DRY_BELOW = 0.02


def wet_scale(w: float) -> float:
    """How much of a driver's wet pace applies at wetness w (all of it from 0.1)."""
    return min(1.0, w / 0.1)


def driver_wet_pace(
    laps: pd.DataFrame, weather: dict, fitted, period: set[int]
) -> dict[str, float]:
    """Each driver's extra share of a lap in the wet beyond the curves (shrunk), from their
    clean wet laps (wetness 0.05 and up)."""
    from . import fit as fit_mod

    eff = sim_wear(laps, weather) + 1.0
    ok = (
        laps["IsAccurate"].fillna(False).astype(bool)
        & laps["TrackStatus"].astype(str).eq("1")
        & laps["LapTime"].notna()
    )
    res: dict[str, list[float]] = {}
    for idx, r in laps[ok].iterrows():
        d = str(r.Driver)
        w = float(weather["wetness"][int(r.LapNumber) - 1])
        if d not in fitted.driver_pace or w < 0.05:
            continue
        comp = str(r.Compound)
        slick = tyre_class(comp) == "slick"
        dry = fit_mod.predict(
            fitted,
            d,
            comp if slick else fitted.reference_compound,
            float(eff.loc[idx]) if slick else 0.0,
            fuel_lap_of(r),
        )
        share = float(r.LapTime) / dry - 1 - float(penalty(weather["curves"], comp, w))
        if abs(share) < 0.3:
            res.setdefault(d, []).append(share / wet_scale(w))
    return {
        d: round(float(np.median(v)) * len(v) / (len(v) + WET_PACE_SHRINK), 4)
        for d, v in res.items()
    }


# Eras builds (model fix M1): driver pace by track state. A driver's pace on a damp track and
# on a wet one, from their clear-air laps, measured against the rest of the field on the same
# lap and tyre class, and shrunk toward the field (pace 0) so a few laps can't overfit.
# A lap is clear air with no car within this many seconds ahead (the dirty air of a car
# within ~1.5 s costs time the sim adds itself).
BAND_TRAFFIC_GAP = 1.5
# Wetness below this is damp (slick weather: the slick-inter crossover is about 0.16 on the
# fitted curves), from it wet.
DAMP_EDGE = 0.15
# Prior strength, in full-wetness laps (wet_scale 1): a driver's overall wet-weather pace is
# shrunk toward the field's by FIELD_PRIOR laps of evidence, and each band's toward the
# driver's overall by BAND_PRIOR. Empirical Bayes on the 17 wet Eras races' clear-air laps
# (docs/g1-report.md, model fix M1): lap noise sd 2.0% of a lap, driver sd 1.5% (prior
# 2.0^2 / 1.5^2 = 1.8 laps); a driver's damp and wet pace correlate 0.47, so a band's own
# deviation sd is about 1.1% (prior 3.3 laps). A residual is capped at BAND_CLIP (an off).
FIELD_PRIOR = 2.0
BAND_PRIOR = 3.0
BAND_CLIP = 0.06
# A lap's field reference needs this many other clear-air cars on the same tyre class.
BAND_MIN_FIELD = 2


def band_of(w: float) -> str:
    return "damp" if w < DAMP_EDGE else "wet"


def clear_air_shares(laps: pd.DataFrame, weather: dict, fitted) -> pd.DataFrame:
    """Each clear-air wet lap's share of a dry lap lost beyond the curves. Clear air: green,
    the lap before green too (no restart), no pit in or out, not lap 1, no car within
    BAND_TRAFFIC_GAP ahead. Columns driver, lap, w, cls, share."""
    from . import fit as fit_mod
    from .clean import gap_to_car_ahead

    eff = sim_wear(laps, weather) + 1.0
    gap = gap_to_car_ahead(laps)
    from .track import racing_status

    racing = laps["TrackStatus"].map(racing_status).astype(bool)
    prev_green = (
        laps.assign(_g=racing)
        .sort_values("LapNumber")
        .groupby("Driver")["_g"]
        .shift(1, fill_value=False)
        .reindex(laps.index, fill_value=False)
    )
    ok = (
        laps["IsAccurate"].fillna(False).astype(bool)
        & racing
        & prev_green
        & laps["PitInTime"].isna()
        & laps["PitOutTime"].isna()
        & (laps["LapNumber"] > 1)
        & laps["LapTime"].notna()
        & ~(gap < BAND_TRAFFIC_GAP).fillna(False)
    )
    rows = []
    for idx, r in laps[ok].iterrows():
        d = str(r.Driver)
        w = float(weather["wetness"][int(r.LapNumber) - 1])
        if d not in fitted.driver_pace or w < DRY_BELOW:
            continue
        comp = str(r.Compound)
        slick = tyre_class(comp) == "slick"
        dry = fit_mod.predict(
            fitted,
            d,
            comp if slick else fitted.reference_compound,
            float(eff.loc[idx]) if slick else 0.0,
            fuel_lap_of(r),
        )
        share = float(r.LapTime) / dry - 1 - float(penalty(weather["curves"], comp, w))
        if abs(share) < 0.3:
            rows.append((d, int(r.LapNumber), w, tyre_class(comp), share))
    return pd.DataFrame(rows, columns=["driver", "lap", "w", "cls", "share"])


def band_residuals(laps: pd.DataFrame, weather: dict, fitted) -> pd.DataFrame:
    """Each clear-air wet lap's residual against the field: its share (clear_air_shares) less
    the median of the other clear-air cars on that lap and tyre class (BAND_MIN_FIELD of them
    at least), capped at BAND_CLIP. Columns driver, lap, w, band, cls, r."""
    df = clear_air_shares(laps, weather, fitted)
    out = []
    for _, g in df.groupby(["lap", "cls"]):
        if len(g) < BAND_MIN_FIELD + 1:
            continue
        vals = g["share"].to_numpy()
        for i, r in enumerate(g.itertuples()):
            ref = float(np.median(np.delete(vals, i)))
            res = float(np.clip(r.share - ref, -BAND_CLIP, BAND_CLIP))
            out.append((r.driver, r.lap, r.w, band_of(r.w), r.cls, res))
    return pd.DataFrame(out, columns=["driver", "lap", "w", "band", "cls", "r"])


def driver_band_pace(
    laps: pd.DataFrame, weather: dict, fitted
) -> tuple[dict[str, float], dict[str, float]]:
    """Eras builds: each driver's pace (share of a lap, negative quicker) on a wet track
    (wetness DAMP_EDGE and up: the race model's `wetPace`) and a damp one (`dampPace`), both
    fading in with wet_scale as the sims apply them. A ridge fit through wet_scale: the
    driver's overall pace is sum(r·s) / (sum(s²) + FIELD_PRIOR), and each band's
    (sum_b(r·s) + BAND_PRIOR·overall) / (sum_b(s²) + BAND_PRIOR), so a band with few laps
    keeps the driver's overall pace and a driver with few laps the field's."""
    res = band_residuals(laps, weather, fitted)
    wet_out: dict[str, float] = {}
    damp_out: dict[str, float] = {}
    for d, g in res.groupby("driver"):
        s = g["w"].map(wet_scale).to_numpy()
        r = g["r"].to_numpy()
        overall = float((r * s).sum() / ((s * s).sum() + FIELD_PRIOR))
        for band, out in (("wet", wet_out), ("damp", damp_out)):
            m = (g["band"] == band).to_numpy()
            p = ((r[m] * s[m]).sum() + BAND_PRIOR * overall) / ((s[m] * s[m]).sum() + BAND_PRIOR)
            out[str(d)] = round(float(p), 4)
    return wet_out, damp_out


# Eras builds (model fix M1): the full wet against the intermediate, per race, where the race
# can tell them apart: laps with at least TYRE_MIN_FIELD clear-air cars on each, TYRE_MIN_LAPS
# such laps at least. The shift of the wet curve is the mean gap between the two tyres'
# residuals on those laps, shrunk by TYRE_PRIOR laps toward the shared curves (none).
TYRE_MIN_FIELD = 2
TYRE_MIN_LAPS = 5
TYRE_PRIOR = 3.0


def wet_tyre_shift(laps: pd.DataFrame, weather: dict, fitted) -> float:
    """The race's full wets against its inters beyond the shared curves (share of a lap,
    negative: the wets were quicker than the curves say); 0 where the race can't tell."""
    df = clear_air_shares(laps, weather, fitted)
    diffs = []
    for _, g in df.groupby("lap"):
        inter, wets = g[g["cls"] == "inter"]["share"], g[g["cls"] == "wet"]["share"]
        if len(inter) >= TYRE_MIN_FIELD and len(wets) >= TYRE_MIN_FIELD:
            diffs.append(float(wets.median() - inter.median()))
    if len(diffs) < TYRE_MIN_LAPS:
        return 0.0
    return round(sum(diffs) / (len(diffs) + TYRE_PRIOR), 4)


def shifted_curves(curves: dict, shift: float) -> dict:
    """The curves with the full wet's moved by `shift` (wet_tyre_shift)."""
    out = {k: dict(v) for k, v in curves.items()}
    out["wet"]["min"] = round(max(0.0, out["wet"]["min"] + shift), 4)
    return out
