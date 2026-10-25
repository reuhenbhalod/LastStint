"""Lap-time model fit (Implementation Plan 1.3).

    t = pace_driver + offset_compound + wear_compound * age + fuel * lap + eps

OLS in statsmodels: a dummy per driver, a compound offset, a wear rate per compound
(compound x tyre age), one fuel term. Detect a tyre cliff from rising late-stint
residuals. Noise = each driver's residual std. Sanity-check wear ordering and fuel sign.
"""

from __future__ import annotations


def fit_lap_model(clean_laps):
    """Fit the lap-time model; return fitted driver pace, compound params, fuel, noise."""
    raise NotImplementedError("Phase 1.3: OLS fit with statsmodels")


def detect_cliff(residuals_by_age):
    """Find the tyre age where residuals rise sharply; return cliff age per compound."""
    raise NotImplementedError("Phase 1.3: fit a second steeper wear rate past the cliff")
