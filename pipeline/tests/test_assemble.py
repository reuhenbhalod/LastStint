"""Unit tests for assemble + export (Phase 1.6).

Builds the Abu Dhabi 2021 race model from the committed snapshot (offline) and checks it
conforms to the schema and carries the right values.
"""

from __future__ import annotations

import json

import pandas as pd
import pytest

from pipeline import assemble, build, export


@pytest.fixture(scope="module")
def model() -> dict:
    model, _ = build.build_race_model("abu-dhabi-2021")
    return model


def test_model_validates_against_schema(model: dict):
    export.validate_model(model)  # raises jsonschema.ValidationError on failure


def test_has_all_required_keys(model: dict):
    schema = export.load_schema()
    assert set(schema["required"]) <= set(model)


def test_race_metadata(model: dict):
    assert model["race"]["id"] == "abu-dhabi-2021"
    assert model["race"]["laps"] == 58
    assert model["race"]["takeoverLap"] == 34
    assert model["era"] == "2014-2025"
    assert model["userSide"] == "HAM"


def test_real_result_podium(model: dict):
    assert model["realResult"][:3] == ["VER", "HAM", "SAI"]


def test_driver_strategies_from_takeover(model: dict):
    by_code = {d["code"]: d for d in model["drivers"]}
    assert by_code["HAM"]["realStrategy"] == []  # Hamilton stayed out after takeover
    assert by_code["VER"]["realStrategy"][-1] == {"lap": 54, "to": "SOFT"}
    assert by_code["HAM"]["stateAtTakeover"]["position"] == 1
    assert by_code["HAM"]["stateAtTakeover"]["gapAhead"] == 0.0  # leader


def test_events_from_takeover_onward(model: dict):
    assert model["events"]  # non-empty
    assert all(e["lap"] >= 34 for e in model["events"])
    assert any(e["type"] == "VSC" for e in model["events"])


def test_compounds_valid(model: dict):
    for vals in model["compounds"].values():
        assert isinstance(vals["cliffLap"], int) and vals["cliffLap"] >= 1
        assert vals["degPerLap"] >= 0


def test_write_and_reload_roundtrip(model: dict, tmp_path):
    out = export.write_race(model, races_dir=tmp_path)
    reloaded = json.loads(out.read_text())
    export.validate_model(reloaded)  # still valid after a round-trip
    assert reloaded["race"]["id"] == "abu-dhabi-2021"


def test_no_fitted_cliff_means_cliff_at_longest_observed_stint():
    # Spain 2021: no soft cliff is fitted, and the longest soft stint in the data is 32 laps.
    model, laps = build.build_race_model("spain-2021")
    soft = model["compounds"]["SOFT"]
    assert "cliffDegPerLap" not in soft
    assert soft["cliffLap"] == assemble.longest_stints(laps)["SOFT"] == 32


def test_resolved_meta_fills_an_automatic_duel(monkeypatch):
    # A validation-only entry (no sides) gets runner-up vs winner from the data.
    entry = {**build.RACES["abu-dhabi-2021"], "user_side": None, "rival": None}
    monkeypatch.setitem(build.RACES, "auto-test", entry)
    laps = pd.read_parquet(build.ingest.raw_snapshot_path("abu-dhabi-2021"))
    meta = build.resolved_meta("auto-test", laps)
    assert (meta["user_side"], meta["rival"]) == ("HAM", "VER")


def test_every_race_has_a_split():
    assert {m["split"] for m in build.RACES.values()} == {"tune", "holdout"}


def test_a_thinly_run_compound_takes_its_life_from_the_well_run_ones():
    from pipeline import assemble

    longest = {"SOFT": 2, "MEDIUM": 21, "HARD": 42}
    stints = {"SOFT": 1, "MEDIUM": 19, "HARD": 30}
    # Monza 24: one 2-lap soft stint; softs last ~0.4x the longest hard stint (42 -> 17).
    assert assemble.thin_life("SOFT", longest, stints, 53) == 17
    # Well-run compounds keep their own fit.
    assert assemble.thin_life("HARD", longest, stints, 53) is None
    # Never past the race distance, nor short of what was actually run.
    assert assemble.thin_life("SOFT", {"SOFT": 30, "HARD": 200}, {"SOFT": 1, "HARD": 9}, 53) == 53


def test_the_edge_of_the_evidence_is_not_short_of_what_the_other_compounds_suggest():
    from pipeline import assemble

    # Mexico 24: three short soft stints (5 laps at most), mediums run 39 laps.
    longest = {"SOFT": 5, "MEDIUM": 39, "HARD": 49}
    stints = {"SOFT": 3, "MEDIUM": 21, "HARD": 17}
    assert assemble.life_floor("SOFT", longest, stints, 71) == 21
