"""Unit tests for assemble + export (Phase 1.6).

Builds the Abu Dhabi 2021 race model from the committed snapshot (offline) and checks it
conforms to the schema and carries the right values.
"""

from __future__ import annotations

import json

import pytest

from pipeline import build, export


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
