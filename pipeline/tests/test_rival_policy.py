"""Rival policies (eras build plan 9.1): the policy selector, the hook in the reference sim,
and Smart's wet-crossover rule against the vectors the TS sim checks too (parity)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from pipeline import rival_policy, sim_reference
from pipeline.paths import GOLDEN_DIR, RACES_DIR, REPO_ROOT
from pipeline.rival_policy import RivalPolicyError, resolve_rival_policy, wet_crossover
from pipeline.sim_reference import Car

VECTORS = Path(__file__).parent / "fixtures" / "rival_wet_crossover.json"
CONFIG_TS = REPO_ROOT / "packages" / "sim" / "src" / "eras" / "config.ts"


def _model(race: str) -> dict:
    return json.loads((RACES_DIR / f"{race}.json").read_text())


def _car(model: dict, code: str, compound: str, tyre_age: int) -> Car:
    d = next(x for x in model["drivers"] if x["code"] == code)
    return Car(
        code=code,
        base_pace=d["basePace"],
        noise=d["noise"],
        compound=compound,
        tyre_age=tyre_age,
        total_time=0.0,
        wet_pace=d.get("wetPace", 0.0),
    )


# --- the selector ---------------------------------------------------------------------------


def test_default_is_standard():
    assert resolve_rival_policy() == "standard"
    assert resolve_rival_policy(None) == "standard"
    assert resolve_rival_policy("standard") == "standard"


def test_names_match_the_ts_eras_config():
    text = CONFIG_TS.read_text()
    line = next(x for x in text.splitlines() if x.startswith("export const RIVAL_POLICIES"))
    names = tuple(part.strip(" '") for part in line.split("[")[1].split("]")[0].split(","))
    assert names == rival_policy.RIVAL_POLICIES


@pytest.mark.parametrize("bad", ["", "Standard", "legend", 3, ["standard"]])
def test_unknown_policies_are_rejected(bad):
    with pytest.raises(RivalPolicyError, match="unknown rival policy"):
        resolve_rival_policy(bad)


@pytest.mark.parametrize("policy", ["standard-plus", "smart", "expert"])
def test_undefined_policies_fail_loudly_with_the_gap(policy):
    with pytest.raises(RivalPolicyError, match=f"{policy} is not implemented"):
        resolve_rival_policy(policy)
    assert policy in rival_policy.RIVAL_POLICY_GAPS


# --- the hook in the reference sim ----------------------------------------------------------


GOLDEN_RACES = sorted(p.stem for p in GOLDEN_DIR.glob("*.json") if p.stem != "rng-vectors")


@pytest.mark.parametrize("race", GOLDEN_RACES)
def test_standard_replays_every_golden_file(race):
    model = _model(race)
    golden = json.loads((GOLDEN_DIR / f"{race}.json").read_text())
    for seed, want in golden.items():
        got = sim_reference.simulate(model, int(seed), rival_policy="standard")
        assert got["order"] == want["order"], (race, seed)
        assert got["finishers"] == want["finishers"], (race, seed)
        for code in want["finishers"]:
            assert got["times"][code] == pytest.approx(want["times"][code], abs=5e-4)
            assert got["gaps"][code] == pytest.approx(want["gaps"][code], abs=5e-4)


def test_the_sim_rejects_an_undefined_policy():
    with pytest.raises(RivalPolicyError):
        sim_reference.simulate(_model("abu-dhabi-2021"), 1, rival_policy="smart")


# --- Smart's wet crossover (parity vectors) -------------------------------------------------


def test_wet_crossover_matches_the_parity_vectors():
    vectors = json.loads(VECTORS.read_text())
    checked = 0
    for race, cases in vectors["races"].items():
        model = _model(race)
        for case in cases:
            car = _car(model, case["driver"], case["compound"], case["tyreAge"])
            for row in case["laps"]:
                assert wet_crossover(model, car, row["lap"]) == row["crossover"], (race, row)
                for wet, gap in row["gap"].items():
                    got = rival_policy.lap_time_gap(model, car, row["lap"], wet)
                    assert got == pytest.approx(gap, abs=1e-8)
                checked += 1
    assert checked > 500


def test_crossover_on_a_wet_race_comes_as_the_track_turns_wet():
    model = _model("russia-2021")
    car = _car(model, model["rival"], "HARD", 12)
    laps = range(model["race"]["takeoverLap"] + 1, model["race"]["laps"] + 1)
    calls = {lap: wet_crossover(model, car, lap) for lap in laps}
    first = min(lap for lap, c in calls.items() if c)
    assert calls[first] == "INTERMEDIATE"
    assert sim_reference.wetness(model["weather"], first) > sim_reference.wetness(
        model["weather"], first - 1
    )
    assert all(c is None for lap, c in calls.items() if lap < first)


def test_no_crossover_in_a_dry_race_or_on_wet_tyres():
    dry = _model("abu-dhabi-2021")
    assert wet_crossover(dry, _car(dry, dry["rival"], "HARD", 20), 40) is None
    wet = _model("russia-2021")
    assert wet_crossover(wet, _car(wet, wet["rival"], "INTERMEDIATE", 3), 50) is None


def test_no_crossover_without_a_wet_tyre_in_the_model():
    model = _model("russia-2021")
    model["compounds"] = {k: v for k, v in model["compounds"].items() if k in ("HARD", "MEDIUM")}
    car = _car(model, model["rival"], "HARD", 12)
    assert all(wet_crossover(model, car, lap) is None for lap in range(39, 54))
