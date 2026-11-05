"""Lap-time model fit (Phase 1.3).

    t = pace_driver + offset_compound + wear_compound * age - fuel * lap + eps

Least squares with an explicit design matrix: one absolute pace term per driver, a
compound offset relative to the softest compound, a wear rate per compound
(compound x tyre age), and one fuel term (slope on lap number). Fitting across every stint
separates fuel (monotonic in lap number) from wear (resets to zero each stop).

Dry compounds are ordered and shrunk toward a physical baseline. In a single race each
compound tends to run in one phase (opening stints on heavy fuel and a green track, or a
late flat-out chase), so the raw data can put compounds out of physical order or make two
indistinguishable. The fit therefore enforces softer = faster and softer = wears faster,
and shrinks each adjacent-compound step toward the era prior in
pipeline/config/compound_priors.json with the weight of `pseudoLaps` laps of evidence. Where
the data alone would collapse a step to zero, `prior_notes` records that the prior decided
it. A per-compound cliff (an extra wear rate past a fitted tyre age) is searched jointly
with the rest of the model and kept only when it lowers BIC. Noise is each driver's residual
standard deviation.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from .paths import COMPOUND_PRIORS_PATH

_FIT_COLUMNS = ["LapTime", "TyreLife", "LapNumber", "Compound", "Driver"]
_COLLAPSED = 1e-6  # a data-only step at or below this is "no separation in the data"
# Model v3 stage 6 (T2): lap noise as a robust spread (1.4826 x MAD) instead of the standard
# deviation, which slow traffic laps and model misfit inflate.
ROBUST_NOISE = True


@dataclass
class LapTimeFit:
    """Fitted lap-time model parameters."""

    driver_pace: dict[str, float]  # absolute pace on the reference compound, age 0, lap 0
    driver_noise: dict[str, float]  # residual std per driver
    compound_offset: dict[str, float]  # seconds vs the reference compound (reference = 0.0)
    compound_wear: dict[str, float]  # seconds added per lap of tyre age, per compound
    fuel_per_lap: float  # seconds GAINED per lap as fuel burns off (>= 0 when sane)
    reference_compound: str
    r_squared: float
    n_obs: int
    # per compound (cliff age, extra s/lap past it), or None when no cliff was fitted
    compound_cliff: dict[str, tuple[int, float] | None] = field(default_factory=dict)
    fresh_tyre_bonus: float = 0.0  # s at full weight on the first clean lap of a new set
    fresh_tyre_laps: int = 3
    prior_notes: list[str] = field(default_factory=list)  # where the prior decided a step


def load_compound_priors(era: str) -> dict:
    """The dry-compound prior for an era from pipeline/config/compound_priors.json."""
    priors = json.loads(COMPOUND_PRIORS_PATH.read_text())
    if era not in priors:
        raise KeyError(f"no compound priors for era '{era}'")
    return priors[era]


def _solve(x: np.ndarray, y: np.ndarray, lower: np.ndarray):
    from scipy.optimize import lsq_linear

    return lsq_linear(x, y, bounds=(lower, np.full_like(lower, np.inf))).x


def fresh_weight(tyre_life, laps: int = 3):
    """Weight of the fresh-tyre bonus by FastF1 TyreLife: 1 on the first clean lap after the
    out-lap (TyreLife 2), fading linearly to 0 over `laps` laps."""
    age = np.asarray(tyre_life, dtype=float)
    return np.clip((laps + 2 - age) / laps, 0.0, 1.0) * (age >= 2)


def _cliff_term(df: pd.DataFrame, compound_cliff: dict) -> pd.Series:
    """Extra seconds from each lap's compound cliff (0 before the cliff or with none)."""
    extra = pd.Series(0.0, index=df.index)
    for compound, hinge in compound_cliff.items():
        if hinge:
            age, slope = hinge
            on = df["Compound"] == compound
            extra[on] = slope * np.maximum(0.0, df.loc[on, "TyreLife"].astype(float) - age)
    return extra


def _driver_pace_from(
    laps, compound_offset, compound_wear, fuel_per_lap, compound_cliff, fresh=(0.0, 3)
):
    """Per-driver base pace and noise from the tyre/fuel-adjusted laps given.

    Using all green racing laps (not just the cleanest) captures true race-pace spread:
    slower teams run more compromised laps, so their base pace is correctly slower.
    """
    df = laps.dropna(subset=_FIT_COLUMNS).copy()
    df["Compound"] = df["Compound"].astype(str)
    base = (
        df["LapTime"].astype(float)
        - df["Compound"].map(compound_offset).astype(float)
        - df["Compound"].map(compound_wear).astype(float) * df["TyreLife"].astype(float)
        - _cliff_term(df, compound_cliff)
        - fresh[0] * fresh_weight(df["TyreLife"], fresh[1])
        + fuel_per_lap * df["LapNumber"].astype(float)
    )
    df = df.assign(_base=base)
    pace, noise = {}, {}
    for driver, grp in df.groupby("Driver"):
        pace[str(driver)] = float(grp["_base"].median())
        if len(grp) < 2:
            noise[str(driver)] = 0.3
        elif ROBUST_NOISE:
            dev = (grp["_base"] - grp["_base"].median()).abs().median()
            noise[str(driver)] = float(1.4826 * dev)
        else:
            noise[str(driver)] = float(grp["_base"].std(ddof=1))
    return pace, noise


@dataclass
class _Core:
    """One least-squares solve: parameters by name, data-only parameters, data SSE."""

    params: dict[str, float]
    data_only: dict[str, float]
    sse: float
    resid: np.ndarray


def _fit_core(df, drivers, ordered, free, reference, prior, cliff_ages, fixed_fuel=None) -> _Core:
    """Solve the ordered, prior-shrunk lap-time model with hinge columns at `cliff_ages`.
    `fixed_fuel`: the fuel effect is taken as given (s/lap), not fitted."""
    age = df["TyreLife"].astype(float).to_numpy()
    comp = df["Compound"].to_numpy()
    age_ref = float(np.median(age))  # turns a wear prior into lap-time units
    cols: list[np.ndarray] = []
    specs: list[tuple[str, float, float | None, float]] = []

    def add(values, name, lower=-np.inf, prior_value=None, scale=1.0):
        cols.append(np.asarray(values, dtype=float))
        specs.append((name, lower, prior_value, scale))

    for d in drivers:
        add(df["Driver"].to_numpy() == d, f"drv::{d}")
    for i in range(1, len(ordered)):  # offset step from ordered[i-1] to ordered[i]
        step_prior = prior["offset"][ordered[i]] - prior["offset"][ordered[i - 1]]
        add(np.isin(comp, ordered[i:]), f"offstep::{i}", 0.0, step_prior)
    if ordered:  # base wear of the hardest ordered compound
        hardest = ordered[-1]
        add(age * np.isin(comp, ordered), "wearbase", 0.0, prior["wear"][hardest], age_ref)
    for j in range(len(ordered) - 1):  # wear step from ordered[j+1] to the softer ordered[j]
        step_prior = prior["wear"][ordered[j]] - prior["wear"][ordered[j + 1]]
        add(age * np.isin(comp, ordered[: j + 1]), f"wearstep::{j}", 0.0, step_prior, age_ref)
    for c in free:  # wet compounds: unordered, unshrunk
        if c != reference:
            add(comp == c, f"off::{c}")
        add(age * (comp == c), f"wear::{c}", 0.0)
    for c, k in cliff_ages.items():  # extra wear past the cliff, fitted jointly
        add(np.maximum(0.0, age - k) * (comp == c), f"cliff::{c}", 0.0)
    fresh = prior.get("freshTyre")
    if fresh:  # bonus on a new set's first clean laps, shrunk toward the pooled prior
        scale = float(np.sqrt(fresh["pseudoLaps"] / prior["pseudoLaps"]))
        add(fresh_weight(age, fresh["laps"]), "fresh", -np.inf, fresh["bonus"], scale)
    if fixed_fuel is None:
        add(-df["LapNumber"].astype(float).to_numpy(), "fuel")

    x = np.column_stack(cols)
    y = df["LapTime"].astype(float).to_numpy()
    if fixed_fuel is not None:
        y = y + fixed_fuel * df["LapNumber"].astype(float).to_numpy()
    lower = np.array([s[1] for s in specs])
    names = [s[0] for s in specs]

    # Prior rows: each shrunk parameter gets sqrt(pseudoLaps) rows' worth of evidence.
    weight = float(np.sqrt(prior["pseudoLaps"]))
    prior_rows, prior_targets = [], []
    for k, (_, _, prior_value, scale) in enumerate(specs):
        if prior_value is None:
            continue
        row = np.zeros(len(specs))
        row[k] = weight * scale
        prior_rows.append(row)
        prior_targets.append(weight * scale * prior_value)

    data_only = dict(zip(names, _solve(x, y, lower), strict=True))
    if prior_rows:
        x_aug = np.vstack([x, np.array(prior_rows)])
        y_aug = np.concatenate([y, np.array(prior_targets)])
        params = dict(zip(names, _solve(x_aug, y_aug, lower), strict=True))
    else:
        params = data_only
    resid = y - x @ np.array([params[n] for n in names])
    if fixed_fuel is not None:
        params["fuel"] = data_only["fuel"] = float(fixed_fuel)
    return _Core(params=params, data_only=data_only, sse=float(resid @ resid), resid=resid)


def _search_cliffs(
    df, drivers, ordered, free, reference, prior, min_laps, min_stints, fixed_fuel=None
):
    """Per compound, the cliff age that best improves the joint fit, kept only if BIC drops.

    A candidate age needs `min_laps` laps past it from at least `min_stints` stints, so one
    driver's stint can't define a cliff. Each accepted cliff costs two parameters (age and
    slope) in the BIC penalty.
    """
    n = len(df)
    ages = df["TyreLife"].astype(float).to_numpy()
    comp = df["Compound"].to_numpy()
    stint_key = (
        (df["Driver"].astype(str) + "/" + df["Stint"].astype(str)).to_numpy()
        if "Stint" in df.columns
        else df["Driver"].astype(str).to_numpy()
    )

    def bic(sse: float, extra_params: int) -> float:
        return n * np.log(sse / n) + extra_params * np.log(n)

    accepted: dict[str, int] = {}
    current = _fit_core(df, drivers, ordered, free, reference, prior, accepted, fixed_fuel)
    for c in [*ordered, *free]:
        on = comp == c
        best_age, best_core = None, None
        for k in range(int(ages[on].min()) + 1, int(ages[on].max())):
            beyond = on & (ages > k)
            if beyond.sum() < min_laps or len(set(stint_key[beyond])) < min_stints:
                continue
            core = _fit_core(
                df, drivers, ordered, free, reference, prior, {**accepted, c: k}, fixed_fuel
            )
            if core.params[f"cliff::{c}"] > 0 and (best_core is None or core.sse < best_core.sse):
                best_age, best_core = k, core
        if best_core is not None and bic(best_core.sse, 2) < bic(current.sse, 0):
            accepted[c] = best_age
            current = best_core
    return accepted, current


def fit_lap_model(
    clean_laps: pd.DataFrame,
    reference_compound: str | None = None,
    pace_laps: pd.DataFrame | None = None,
    era: str = "2014-2025",
    fallback_pace_laps: pd.DataFrame | None = None,
    min_laps_beyond_cliff: int = 6,
    min_stints_beyond_cliff: int = 2,
    fixed_fuel: float | None = None,
) -> LapTimeFit:
    """Fit the lap-time model; return fitted driver pace, compound params, fuel, noise.

    Compound/wear/fuel/cliffs are fit jointly on the clean laps with the ordering + prior
    described in the module docstring. Driver base pace and noise come from `pace_laps` (all
    green racing laps) when supplied, else from the clean-lap fit; a driver missing from
    `pace_laps` takes its pace from `fallback_pace_laps` if given. `reference_compound`
    defaults to the softest dry compound present.
    """
    prior = load_compound_priors(era)
    df = clean_laps.dropna(subset=_FIT_COLUMNS).copy()
    df["Compound"] = df["Compound"].astype(str)

    present = set(df["Compound"].unique())
    ordered = [c for c in prior["order"] if c in present]
    free = sorted(present - set(ordered))
    reference = reference_compound or (ordered[0] if ordered else free[0])
    drivers = sorted(df["Driver"].unique())

    cliff_ages, core = _search_cliffs(
        df,
        drivers,
        ordered,
        free,
        reference,
        prior,
        min_laps_beyond_cliff,
        min_stints_beyond_cliff,
        fixed_fuel,
    )
    params, data_only = core.params, core.data_only

    compound_offset = {reference: 0.0} if reference not in ordered else {}
    compound_wear: dict[str, float] = {}
    if ordered:
        compound_offset[ordered[0]] = 0.0
        for i in range(1, len(ordered)):
            compound_offset[ordered[i]] = compound_offset[ordered[i - 1]] + params[f"offstep::{i}"]
        compound_wear[ordered[-1]] = params["wearbase"]
        for j in range(len(ordered) - 2, -1, -1):
            compound_wear[ordered[j]] = compound_wear[ordered[j + 1]] + params[f"wearstep::{j}"]
    for c in free:
        compound_offset[c] = params.get(f"off::{c}", 0.0)
        compound_wear[c] = params[f"wear::{c}"]
    compound_cliff = {
        c: ((cliff_ages[c], float(params[f"cliff::{c}"])) if c in cliff_ages else None)
        for c in present
    }
    fuel_per_lap = float(params["fuel"])
    fresh_laps = int(prior.get("freshTyre", {}).get("laps", 3))
    fresh_bonus = float(params.get("fresh", 0.0))

    notes = []
    collapsed = "no separation in data, prior used"
    for i in range(1, len(ordered)):
        if data_only[f"offstep::{i}"] <= _COLLAPSED:
            notes.append(f"offset {ordered[i - 1]}->{ordered[i]}: {collapsed}")
    for j in range(len(ordered) - 1):
        if data_only[f"wearstep::{j}"] <= _COLLAPSED:
            notes.append(f"wear {ordered[j + 1]}->{ordered[j]}: {collapsed}")

    y = df["LapTime"].astype(float).to_numpy()
    r_squared = float(1 - core.resid.var() / y.var())

    if pace_laps is not None:
        args = (compound_offset, compound_wear, fuel_per_lap, compound_cliff)
        driver_pace, driver_noise = _driver_pace_from(pace_laps, *args, (fresh_bonus, fresh_laps))
        if fallback_pace_laps is not None:
            # Drivers with no laps in `pace_laps` (e.g. a whole race in traffic) use these.
            more_pace, more_noise = _driver_pace_from(
                fallback_pace_laps, *args, (fresh_bonus, fresh_laps)
            )
            for d, p in more_pace.items():
                if d not in driver_pace:
                    driver_pace[d], driver_noise[d] = p, more_noise[d]
    else:
        driver_pace = {d: float(params[f"drv::{d}"]) for d in drivers}
        drv = df["Driver"].to_numpy()
        driver_noise = {d: float(np.std(core.resid[drv == d], ddof=1)) for d in drivers}

    return LapTimeFit(
        driver_pace=driver_pace,
        driver_noise=driver_noise,
        compound_offset={k: float(v) for k, v in compound_offset.items()},
        compound_wear={k: float(v) for k, v in compound_wear.items()},
        fuel_per_lap=fuel_per_lap,
        reference_compound=reference,
        r_squared=r_squared,
        n_obs=int(len(df)),
        compound_cliff=compound_cliff,
        fresh_tyre_bonus=fresh_bonus,
        fresh_tyre_laps=fresh_laps,
        prior_notes=notes,
    )


def predict(fit: LapTimeFit, driver: str, compound: str, tyre_age: float, lap: float) -> float:
    """Predicted lap time in seconds for the given state (no noise/traffic/events)."""
    hinge = fit.compound_cliff.get(compound)
    cliff = hinge[1] * max(0.0, tyre_age - hinge[0]) if hinge else 0.0
    return (
        fit.driver_pace[driver]
        + fit.compound_offset.get(compound, 0.0)
        + fit.compound_wear.get(compound, 0.0) * tyre_age
        + cliff
        - fit.fuel_per_lap * lap
        + fit.fresh_tyre_bonus * float(fresh_weight(tyre_age, fit.fresh_tyre_laps))
    )
