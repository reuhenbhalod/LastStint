"""Model validation (Implementation Plan 1.7, Gate G1).

Run N simulations with every team's real strategy and report mean absolute error in each
driver's gap to the leader and how often the predicted finishing order matches. Pass bar:
main contenders' gaps within a few seconds, order correct in most runs.
"""

from __future__ import annotations

from dataclasses import dataclass

DEFAULT_RUNS = 500


@dataclass
class ValidationReport:
    runs: int
    mean_gap_error: dict[str, float]  # driver code -> mean abs gap error (seconds)
    order_match_rate: float  # share of runs with the real finishing order
    passed: bool


def validate_race(model: dict, runs: int = DEFAULT_RUNS) -> ValidationReport:
    """Replay real strategies through the reference sim and score the error."""
    raise NotImplementedError("Phase 1.7: run reference sim and score gap/order error")
