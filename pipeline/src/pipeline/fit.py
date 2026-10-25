"""Lap-time model fit (Phase 1.3).

    t = pace_driver + offset_compound + wear_compound * age + fuel * lap + eps

Ordinary least squares with an explicit design matrix: one absolute pace term per driver,
a compound offset relative to a reference compound, a wear rate per compound
(compound x tyre age), and one fuel term (slope on lap number). Fitting across every stint
separates fuel (monotonic in lap number) from wear (resets to zero each stop). Noise is
each driver's residual standard deviation. `detect_cliff` looks for a tyre age past which
residuals rise sharply.
"""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

_FIT_COLUMNS = ["LapTime", "TyreLife", "LapNumber", "Compound", "Driver"]


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


def _design_matrix(df: pd.DataFrame, drivers, compounds, reference):
    """Explicit design matrix so coefficients map one-to-one to model parameters."""
    nonref = [c for c in compounds if c != reference]
    x = pd.DataFrame(index=df.index)
    for d in drivers:  # absolute pace per driver (no global intercept)
        x[f"drv::{d}"] = (df["Driver"] == d).astype(float)
    for c in nonref:  # compound offset vs the reference compound
        x[f"off::{c}"] = (df["Compound"] == c).astype(float)
    for c in compounds:  # wear slope per compound (continuous x category)
        x[f"wear::{c}"] = df["TyreLife"].astype(float) * (df["Compound"] == c).astype(float)
    x["fuel"] = df["LapNumber"].astype(float)
    return x, nonref


def fit_lap_model(clean_laps: pd.DataFrame, reference_compound: str = "SOFT") -> LapTimeFit:
    """Fit the lap-time model; return fitted driver pace, compound params, fuel, noise."""
    import statsmodels.api as sm

    df = clean_laps.dropna(subset=_FIT_COLUMNS).copy()
    df["Compound"] = df["Compound"].astype(str)

    drivers = sorted(df["Driver"].unique())
    compounds = sorted(df["Compound"].unique())
    reference = reference_compound if reference_compound in compounds else compounds[0]

    x, nonref = _design_matrix(df, drivers, compounds, reference)
    result = sm.OLS(df["LapTime"].astype(float), x).fit()
    p = result.params

    driver_pace = {d: float(p[f"drv::{d}"]) for d in drivers}
    compound_offset = {reference: 0.0}
    compound_offset.update({c: float(p[f"off::{c}"]) for c in nonref})
    compound_wear = {c: float(p[f"wear::{c}"]) for c in compounds}

    resid = result.resid
    driver_noise = {d: float(resid[df["Driver"] == d].std(ddof=1)) for d in drivers}

    return LapTimeFit(
        driver_pace=driver_pace,
        driver_noise=driver_noise,
        compound_offset=compound_offset,
        compound_wear=compound_wear,
        fuel_per_lap=-float(p["fuel"]),  # negate: coef is negative when pace improves
        reference_compound=reference,
        r_squared=float(result.rsquared),
        n_obs=int(result.nobs),
    )


def predict(fit: LapTimeFit, driver: str, compound: str, tyre_age: float, lap: float) -> float:
    """Predicted lap time in seconds for the given state (no noise/traffic/events)."""
    return (
        fit.driver_pace[driver]
        + fit.compound_offset.get(compound, 0.0)
        + fit.compound_wear.get(compound, 0.0) * tyre_age
        - fit.fuel_per_lap * lap
    )


def detect_cliff(
    clean_laps: pd.DataFrame,
    fit: LapTimeFit,
    min_laps_beyond: int = 6,
    rise_threshold: float = 0.4,
) -> dict[str, int | None]:
    """Per compound, the tyre age past which residuals rise sharply, else None.

    Residual = actual - linear prediction. If a stint's wear accelerates past a cliff, the
    linear model under-predicts late-stint laps, so residuals climb. We scan candidate cliff
    ages and flag the one whose beyond-cliff mean residual exceeds `rise_threshold` seconds.
    """
    df = clean_laps.dropna(subset=_FIT_COLUMNS).copy()
    df["Compound"] = df["Compound"].astype(str)
    df["_pred"] = [
        predict(fit, r.Driver, r.Compound, r.TyreLife, r.LapNumber) for r in df.itertuples()
    ]
    df["_resid"] = df["LapTime"].astype(float) - df["_pred"]

    cliffs: dict[str, int | None] = {}
    for compound, grp in df.groupby("Compound"):
        ages = grp["TyreLife"].astype(int)
        best_age: int | None = None
        best_rise = rise_threshold
        for cliff in range(int(ages.min()) + 1, int(ages.max())):
            beyond = grp[ages > cliff]
            if len(beyond) < min_laps_beyond:
                continue
            rise = float(beyond["_resid"].mean())
            if rise > best_rise:
                best_rise, best_age = rise, cliff
        cliffs[str(compound)] = best_age
    return cliffs
