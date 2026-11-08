"""Rival policies (eras build plan 9.1, eras spec §7), mirrored from packages/sim/src/rivals.

Which policy a run's rival follows, and the rule pieces the harder policies are built from.
`standard` is today's rival and the default. The reference sim replays real strategies only
(no player-controlled car, so no rival reactions), so a policy can't change its output; it
validates the name so the two sims accept the same values. Standard+, Smart and Expert are
not implemented yet: eras spec §7 doesn't define them precisely enough (RIVAL_POLICY_GAPS).

Parity with the TS sim is checked on shared vectors (tests/fixtures/rival_wet_crossover.json,
read by pipeline/tests/test_rival_policy.py and packages/sim/tests/rival-policy.test.ts).
"""

from __future__ import annotations

from dataclasses import replace

from .sim_reference import Car, _clean_lap

# The same names, in the same order, as packages/sim/src/eras/config.ts RIVAL_POLICIES.
RIVAL_POLICIES = ("standard", "standard-plus", "smart", "expert")
DEFAULT_RIVAL_POLICY = "standard"
IMPLEMENTED_RIVAL_POLICIES = ("standard",)

RIVAL_POLICY_GAPS = {
    "standard-plus": (
        'eras spec §7 says Standard+ "also covers undercuts within 3 laps", but today\'s Standard '
        "already covers green-flag undercuts when its own stop is within 4 laps (COVER_WINDOW), "
        "so Standard+ as written adds nothing"
    ),
    "smart": (
        'builds on Standard+ (undefined), and "extends its stint to overcut when the player pits '
        'early" defines neither "early" nor how long the stint is extended'
    ),
    "expert": (
        'builds on Smart (undefined); "reacts one lap earlier" and the options, target and sample '
        "count of its own graded calls are not defined"
    ),
}

WET_TYRES = ("INTERMEDIATE", "WET")  # the TS sim's WET_TYRES order (ties go to the first)


class RivalPolicyError(ValueError):
    """A policy name was asked for that doesn't exist, or isn't implemented yet."""


def resolve_rival_policy(value: object = None) -> str:
    """The policy a run uses: `standard` when none is given. Raises RivalPolicyError on an
    unknown name, or on a policy the sim can't run yet (with the spec gap that blocks it)."""
    if value is None:
        return DEFAULT_RIVAL_POLICY
    if not isinstance(value, str) or value not in RIVAL_POLICIES:
        raise RivalPolicyError(
            f"unknown rival policy {value!r} (expected one of {', '.join(RIVAL_POLICIES)})"
        )
    if value not in IMPLEMENTED_RIVAL_POLICIES:
        gap = RIVAL_POLICY_GAPS.get(value, "not defined")
        raise RivalPolicyError(f"rival policy {value} is not implemented: {gap}")
    return value


def wet_crossover(model: dict, car: Car, lap: int) -> str | None:
    """Smart's wet-tyre rule (eras spec §7, "switches to wet tyres at the sim's crossover lap"):
    the wet tyre a car on slicks should switch to on `lap`, or None to stay on slicks. The
    crossover is the first lap on which a fresh set of a wet tyre has a faster model lap than
    the car's slicks as they are, at that lap's wetness on the race's timeline. Model laps
    only, no pit loss. Ties keep the slicks; between two faster wet tyres the faster wins
    (inters on an exact tie). None in a dry race, on wet tyres already, or with no wet tyre in
    the model. Mirrors wetCrossover in packages/sim/src/rivals/wet.ts."""
    weather = model.get("weather")
    if not weather or car.compound in WET_TYRES:
        return None
    compounds = model["compounds"]
    fuel = model["fuelEffectPerLap"]
    fresh = model.get("freshTyre")
    best = None
    best_time = _clean_lap(car, compounds, fuel, lap, fresh, weather)
    for wet in WET_TYRES:
        if wet not in compounds:
            continue
        on_wets = replace(car, compound=wet, tyre_age=0, tyre_wear=0.0)
        t = _clean_lap(on_wets, compounds, fuel, lap, fresh, weather)
        if t < best_time:
            best, best_time = wet, t
    return best


def lap_time_gap(model: dict, car: Car, lap: int, compound: str) -> float:
    """A fresh set of `compound`'s model lap minus the car's current tyres' on `lap` (s; <0:
    the fresh set is faster). The parity vectors compare it to catch near-ties."""
    compounds = model["compounds"]
    fuel = model["fuelEffectPerLap"]
    fresh = model.get("freshTyre")
    weather = model.get("weather")
    on_set = replace(car, compound=compound, tyre_age=0, tyre_wear=0.0)
    return _clean_lap(on_set, compounds, fuel, lap, fresh, weather) - _clean_lap(
        car, compounds, fuel, lap, fresh, weather
    )
