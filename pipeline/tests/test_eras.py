"""Era config blocks (eras build plan 1.2).

compound_priors.json has a block for every schema era, so a race tagged with any era builds:
the tyre fit and the wet-race fallback look the prior up by the race's era. The blocks are
copied from 2014-2025 until tuned, so a re-tagged race builds the same model, era aside, and
replays the same. The registry is re-tagged in memory; data/races is left alone.
"""

from __future__ import annotations

import json

import pytest

from pipeline import build, export, fit, sim_reference
from pipeline.paths import COMPOUND_PRIORS_PATH

ERAS = export.load_schema()["properties"]["era"]["enum"]
SEEDS = [1, 2, 3]


def test_a_prior_block_for_every_schema_era():
    priors = json.loads(COMPOUND_PRIORS_PATH.read_text())
    assert sorted(k for k in priors if not k.startswith("_")) == sorted(ERAS)
    base = priors["2014-2025"]
    for era in ERAS:
        prior = fit.load_compound_priors(era)
        if era == "2014-2025":
            assert "_copiedFrom" not in prior
        else:
            assert prior["_copiedFrom"] == "2014-2025"
            assert {k: v for k, v in prior.items() if k != "_copiedFrom"} == base


@pytest.fixture(scope="module")
def originals() -> dict[str, dict]:
    return {rid: build.build_race_model(rid)[0] for rid in ("abu-dhabi-2021", "russia-2021")}


# A dry race, and a wet one (its dry fit is on the dry laps only, and the wet tyres join).
@pytest.mark.parametrize("race_id", ["abu-dhabi-2021", "russia-2021"])
@pytest.mark.parametrize("era", ERAS)
def test_a_race_tagged_with_any_era_builds_and_replays(
    race_id: str, era: str, originals: dict, monkeypatch
):
    monkeypatch.setitem(build.RACES, race_id, {**build.RACES[race_id], "era": era})
    model, _ = build.build_race_model(race_id)
    export.validate_model(model)
    assert model["era"] == era
    original = originals[race_id]
    assert {**model, "era": original["era"]} == original
    for seed in SEEDS:
        assert sim_reference.simulate(model, seed) == sim_reference.simulate(original, seed)
