"""Unit tests for the reference simulator (Phase 1.7).

These assert the engine's *mechanics* (determinism, structure, accounting) — not Gate G1,
which is a separate, still-open modelling bar tracked in validate.
"""

from __future__ import annotations

import pytest

from pipeline import build, sim_reference


@pytest.fixture(scope="module")
def model() -> dict:
    model, _ = build.build_race_model("abu-dhabi-2021")
    return model


def test_deterministic_for_a_seed(model: dict):
    a = sim_reference.simulate(model, seed=7)
    b = sim_reference.simulate(model, seed=7)
    assert a["order"] == b["order"]
    assert a["times"] == b["times"]


def test_seeds_produce_variation(model: dict):
    a = sim_reference.simulate(model, seed=1)
    b = sim_reference.simulate(model, seed=2)
    assert a["times"] != b["times"]  # per-car noise differs by seed


def test_result_structure_and_accounting(model: dict):
    result = sim_reference.simulate(model, seed=1)
    assert {"order", "gaps", "times", "finishers"} <= set(result)
    # every modelled driver is classified exactly once
    assert set(result["order"]) == {d["code"] for d in model["drivers"]}
    assert len(result["order"]) == len(model["drivers"])
    # the winner's gap is zero and gaps are non-negative and ascending-ish
    assert result["gaps"][result["finishers"][0]] == 0.0
    assert all(g >= 0 for g in result["gaps"].values())


def test_write_golden(model: dict, tmp_path, monkeypatch):
    monkeypatch.setattr(sim_reference, "GOLDEN_DIR", tmp_path)
    sim_reference.write_golden(model, seeds=[1, 2, 3])
    out = tmp_path / "abu-dhabi-2021.json"
    assert out.exists()


def test_pass_probability_direction(model: dict):
    overtake = model["track"]["overtakeModel"]
    p = sim_reference.pass_probability
    assert p(overtake, 1.0, 0.5) > p(overtake, 0.2, 0.5)  # faster follower passes more
    assert p(overtake, 1.0, 0.5) > p(overtake, 1.0, 1.5)  # closer follower passes more
    assert 0.0 < p(overtake, 0.0, 1.0) < 0.5


def _ham_win_rate(model: dict, ham_strategy: list, runs: int = 60) -> float:
    strategies = {"HAM": ham_strategy}
    wins = sum(
        sim_reference.simulate(model, seed=500 + i, strategies=strategies)["order"][0] == "HAM"
        for i in range(runs)
    )
    return wins / runs


def test_sc_stop_cost_depends_on_timing(model: dict):
    # Abu Dhabi 2021, SC laps 53-57; VER really pitted (out-lap 54). Covering on the same
    # lap keeps HAM ahead; stopping into the already-bunched train (lap 57) loses the lead.
    cover = _ham_win_rate(model, [{"lap": 54, "to": "SOFT"}])
    late = _ham_win_rate(model, [{"lap": 57, "to": "SOFT"}])
    assert cover > 0.8
    assert late < 0.3
