"""Schema v11 (eras build plan 1.1): the optional eras, provenance and rules blocks,
events[].storylineEvent and race.scUnlap "none".

Every race file in data/races must validate unchanged; each new field has valid and invalid
examples. Fixtures are copies of abu-dhabi-2021 changed in memory; data/races is read only.
"""

from __future__ import annotations

import copy
import json

import jsonschema
import pytest

from pipeline import SCHEMA_VERSION, export, paths

RACE_FILES = sorted(paths.RACES_DIR.glob("*.json"))


@pytest.fixture(scope="module")
def base() -> dict:
    return json.loads((paths.RACES_DIR / "abu-dhabi-2021.json").read_text())


def with_(base: dict, **fields) -> dict:
    model = copy.deepcopy(base)
    model.update(copy.deepcopy(fields))
    return model


def assert_valid(model: dict) -> None:
    export.validate_model(model)


def assert_invalid(model: dict) -> None:
    with pytest.raises((jsonschema.ValidationError, ValueError)):
        export.validate_model(model)


FULL_ERAS = {
    "eraId": 9,
    "order": 10,
    "userSide": "HAM",
    "target": {"type": "beat-rival", "rival": "VER"},
    "storyline": {
        "real": "Verstappen wins the race and the title",
        "rewriteCondition": {"type": "beat-rival", "rival": "VER"},
        "headline": "You won Lewis his eighth title",
    },
    "mastery": {"type": "no_neutralized_stop", "label": "Win without pitting under the SC"},
    "hidden": {"type": "margin", "seconds": 3, "label": "Win by more than 3 seconds"},
    "hardCalls": {"VER": 6, "HAM": 4},
    "briefing": "Short era-appropriate intro shown before the race.",
    "storylineCalls": [
        {
            "driver": "VER",
            "lap": 37,
            "real": "A real stop",
            "source": "https://en.wikipedia.org/wiki/2021_Abu_Dhabi_Grand_Prix",
        }
    ],
}


# --- existing files and the version --------------------------------------------------------


def test_race_files_exist():
    assert len(RACE_FILES) >= 60


@pytest.mark.parametrize("path", RACE_FILES, ids=lambda p: p.stem)
def test_every_race_file_validates_unchanged(path):
    model = json.loads(path.read_text())
    assert model["schemaVersion"] <= SCHEMA_VERSION
    export.validate_model(model)


def test_schema_version_is_11_and_old_versions_still_validate(base):
    assert SCHEMA_VERSION == 11
    for version in (1, 10, 11):
        assert_valid(with_(base, schemaVersion=version))
    assert_invalid(with_(base, schemaVersion=0))


# --- eras -----------------------------------------------------------------------------------


def test_eras_full_block_is_valid(base):
    assert_valid(with_(base, eras=FULL_ERAS))


def test_eras_minimal_block_is_valid(base):
    assert_valid(with_(base, eras={"eraId": 1, "order": 1}))


@pytest.mark.parametrize(
    "eras",
    [
        {"order": 1},  # eraId required
        {"eraId": 1},  # order required
        {"eraId": 0, "order": 1},
        {"eraId": 11, "order": 1},
        {"eraId": 1, "order": 11},
        {"eraId": 1, "order": 1, "reconstructed": False},  # moved to provenance
        {"eraId": 1, "order": 1, "briefing": ""},
        {"eraId": 1, "order": 1, "userSide": "X"},
        {"eraId": 1, "order": 1, "hardCalls": {"VER": -1}},
        {"eraId": 1, "order": 1, "hardCalls": {"VER": 1.5}},
        {"eraId": 1, "order": 1, "target": "finish_ahead_of_rival"},
    ],
)
def test_eras_invalid_blocks(base, eras):
    assert_invalid(with_(base, eras=eras))


VALID_TARGETS = [
    {"type": "win"},
    {"type": "defend"},
    {"type": "position", "position": 3},
    {"type": "beat-rival", "rival": "VER"},
    {"type": "team", "positions": [1, 2]},
    {"type": "deny", "rival": "VER", "position": 4},
]

INVALID_TARGETS = [
    {"type": "finish_ahead_of_rival"},
    {"type": "win", "position": 1},  # win takes no parameters
    {"type": "position"},
    {"type": "position", "position": 0},
    {"type": "beat-rival"},
    {"type": "team", "positions": [1]},
    {"type": "team", "positions": [1, 2, 3]},
    {"type": "deny", "rival": "VER"},
    {"type": "deny", "position": 4},
    {"type": "deny", "rival": "VER", "position": 1},  # P1 or worse is always true
]


@pytest.mark.parametrize("target", VALID_TARGETS, ids=lambda t: t["type"])
def test_valid_targets_and_rewrite_conditions(base, target):
    assert_valid(with_(base, eras={"eraId": 9, "order": 1, "target": target}))
    storyline = {"real": "r", "rewriteCondition": target, "headline": "h"}
    assert_valid(with_(base, eras={"eraId": 9, "order": 1, "storyline": storyline}))


@pytest.mark.parametrize("target", INVALID_TARGETS)
def test_invalid_targets_and_rewrite_conditions(base, target):
    assert_invalid(with_(base, eras={"eraId": 9, "order": 1, "target": target}))
    storyline = {"real": "r", "rewriteCondition": target, "headline": "h"}
    assert_invalid(with_(base, eras={"eraId": 9, "order": 1, "storyline": storyline}))


@pytest.mark.parametrize(
    "storyline",
    [
        {"real": "r", "headline": "h"},
        {"real": "r", "rewriteCondition": {"type": "win"}},
        {"rewriteCondition": {"type": "win"}, "headline": "h"},
        {"real": "", "rewriteCondition": {"type": "win"}, "headline": "h"},
        {"real": "r", "rewriteCondition": {"type": "win"}, "headline": "h", "radio": "x"},
    ],
)
def test_invalid_storylines(base, storyline):
    assert_invalid(with_(base, eras={"eraId": 9, "order": 1, "storyline": storyline}))


def test_a_storyline_the_eras_side_really_won_has_no_rewrite(base):
    # Owner decision, Nov 8 2026: no rewrite condition, and so no headline.
    assert_valid(with_(base, eras={"eraId": 9, "order": 1, "storyline": {"real": "r"}}))


def test_storyline_calls(base):
    # A storyline call is one of its driver's real stops (out-laps; VER's first here).
    lap = next(d for d in base["drivers"] if d["code"] == "VER")["realStrategy"][0]["lap"]
    call = {"driver": "VER", "lap": lap, "real": "r", "source": "https://example.org/a"}
    assert_valid(with_(base, eras={"eraId": 9, "order": 1, "storylineCalls": [call]}))
    for bad in (
        {**call, "lap": lap + 1},  # not a real stop of VER's
        {**call, "driver": "XXX"},  # not in the race
        {**call, "source": "a book"},  # not a URL
        {k: v for k, v in call.items() if k != "real"},
    ):
        assert_invalid(with_(base, eras={"eraId": 9, "order": 1, "storylineCalls": [bad]}))


VALID_OBJECTIVES = [
    {"type": "stop_count", "max": 1},
    {"type": "stop_count", "exact": 2},
    {"type": "beat_real_call"},
    {"type": "finish_position", "position": 1},
    {"type": "margin", "seconds": 5},
    {"type": "compound_rule", "mustAvoid": "SOFT"},
    {"type": "compound_rule", "mustUse": "HARD"},
    {"type": "compound_rule", "mustUse": "HARD", "mustAvoid": "SOFT"},
    {"type": "mode_rule", "mode": "push", "maxLaps": 5},
    {"type": "mode_rule", "mode": "liftAndCoast", "maxLaps": 0},
    {"type": "no_neutralized_stop"},
    {"type": "team_result", "positions": [10, 10]},
]

INVALID_OBJECTIVES = [
    {"type": "stop_count"},
    {"type": "stop_count", "max": 1, "exact": 1},
    {"type": "stop_count", "max": -1},
    {"type": "beat_real_call", "position": 1},
    {"type": "finish_position"},
    {"type": "finish_position", "position": 0},
    {"type": "margin"},
    {"type": "margin", "seconds": 0},
    {"type": "compound_rule"},
    {"type": "mode_rule", "mode": "push"},
    {"type": "mode_rule", "mode": "flat-out", "maxLaps": 5},
    {"type": "mode_rule", "maxLaps": 5},
    {"type": "team_result", "positions": [1]},
    {"type": "fastest_lap"},
]


@pytest.mark.parametrize("objective", VALID_OBJECTIVES, ids=lambda o: o["type"])
def test_valid_mastery_and_hidden_objectives(base, objective):
    labelled = {**objective, "label": "A label"}
    for key in ("mastery", "hidden"):
        assert_valid(with_(base, eras={"eraId": 9, "order": 1, key: labelled}))


@pytest.mark.parametrize("objective", INVALID_OBJECTIVES)
def test_invalid_mastery_and_hidden_objectives(base, objective):
    labelled = {**objective, "label": "A label"}
    for key in ("mastery", "hidden"):
        assert_invalid(with_(base, eras={"eraId": 9, "order": 1, key: labelled}))


def test_objectives_need_a_label(base):
    for key in ("mastery", "hidden"):
        assert_invalid(with_(base, eras={"eraId": 9, "order": 1, key: {"type": "beat_real_call"}}))
        bad = {"type": "beat_real_call", "label": ""}
        assert_invalid(with_(base, eras={"eraId": 9, "order": 1, key: bad}))


def test_all_eight_objective_types_and_six_targets_are_in_the_schema():
    defs = export.load_schema()["$defs"]
    objective_types = {o["properties"]["type"]["const"] for o in defs["erasObjective"]["oneOf"]}
    target_types = {o["properties"]["type"]["const"] for o in defs["erasTarget"]["oneOf"]}
    assert objective_types == {
        "stop_count",
        "beat_real_call",
        "finish_position",
        "margin",
        "compound_rule",
        "mode_rule",
        "no_neutralized_stop",
        "team_result",
    }
    assert target_types == {"win", "defend", "position", "beat-rival", "team", "deny"}


@pytest.mark.parametrize(
    "eras",
    [
        {"eraId": 9, "order": 1, "userSide": "SEN"},
        {"eraId": 9, "order": 1, "hardCalls": {"VER": 6, "PRO": 4}},
        {"eraId": 9, "order": 1, "target": {"type": "beat-rival", "rival": "SEN"}},
        {"eraId": 9, "order": 1, "target": {"type": "deny", "rival": "SEN", "position": 4}},
        {
            "eraId": 9,
            "order": 1,
            "storyline": {
                "real": "r",
                "rewriteCondition": {"type": "beat-rival", "rival": "SEN"},
                "headline": "h",
            },
        },
    ],
)
def test_eras_drivers_must_be_in_the_race(base, eras):
    with pytest.raises(ValueError, match="SEN|PRO"):
        export.validate_model(with_(base, eras=eras))


# --- provenance -----------------------------------------------------------------------------


@pytest.mark.parametrize(
    "provenance",
    [
        {"kind": "real"},
        {"kind": "real", "estimated": []},
        {"kind": "real", "estimated": ["compounds", "safetyCars"]},
        {"kind": "reconstructed", "estimated": ["compounds", "safetyCars", "fuelLoads", "weather"]},
    ],
)
def test_valid_provenance(base, provenance):
    assert_valid(with_(base, provenance=provenance))


@pytest.mark.parametrize(
    "provenance",
    [
        {},
        {"kind": "estimated"},
        {"kind": "real", "estimated": ["lapTimes"]},
        {"kind": "real", "estimated": ["compounds", "compounds"]},
        {"kind": "real", "estimated": "compounds"},
        {"kind": "real", "source": "jolpica"},
        "real",
    ],
)
def test_invalid_provenance(base, provenance):
    assert_invalid(with_(base, provenance=provenance))


def test_provenance_agrees_with_reconstructed(base):
    assert_valid(with_(base, reconstructed=True, provenance={"kind": "reconstructed"}))
    assert_valid(with_(base, reconstructed=False, provenance={"kind": "real"}))
    assert_invalid(with_(base, reconstructed=True, provenance={"kind": "real"}))
    assert_invalid(with_(base, reconstructed=False, provenance={"kind": "reconstructed"}))


# --- rules ----------------------------------------------------------------------------------


@pytest.mark.parametrize(
    "rules",
    [
        {},
        {"twoCompound": False, "vsc": False, "drs": False, "ers": "none"},  # 2005-ish
        {"refuelling": True, "tyreChanges": False},  # 2005
        {"pitLaneClosedUnderSC": True, "refuelling": True, "ers": "kers"},  # 2009
        {"fuelLimit": 150, "refuelling": False},  # 1986
        {"fuelLimit": 150},
        {"ers": "hybrid", "drs": True},
    ],
)
def test_valid_rules(base, rules):
    assert_valid(with_(base, rules=rules))


@pytest.mark.parametrize(
    "rules",
    [
        {"twoCompound": "yes"},
        {"tyreChanges": 0},
        {"refuelling": None},
        {"fuelLimit": 0},
        {"fuelLimit": -5},
        {"fuelLimit": 150, "refuelling": True},  # the capped tank has no refuelling
        {"pitLaneClosedUnderSC": "true"},
        {"vsc": 1},
        {"drs": "on"},
        {"ers": True},
        {"ers": "mguh"},
        {"scUnlap": "none"},  # scUnlap is a race field, not a rule
    ],
)
def test_invalid_rules(base, rules):
    assert_invalid(with_(base, rules=rules))


def test_sc_unlap_none(base):
    for value in ("all", "duel", "none"):
        model = copy.deepcopy(base)
        model["race"]["scUnlap"] = value
        assert_valid(model)
    model["race"]["scUnlap"] = "some"
    assert_invalid(model)


# --- storylineEvent -------------------------------------------------------------------------


def test_storyline_event(base):
    model = copy.deepcopy(base)
    model["events"][2]["storylineEvent"] = True
    assert_valid(model)
    model["events"][2]["storylineEvent"] = False
    assert_valid(model)
    model["events"][2]["storylineEvent"] = "yes"
    assert_invalid(model)


# --- writing the new fields -----------------------------------------------------------------


def test_with_eras_fields_sets_the_blocks_and_flags_events(base, tmp_path):
    rules = {"vsc": True}
    model = export.with_eras_fields(
        base,
        eras=FULL_ERAS,
        provenance={"kind": "real", "estimated": []},
        rules=rules,
        storyline_events=[(53, "SC")],
    )
    assert model["eras"] == FULL_ERAS
    assert model["rules"] == rules
    assert [e.get("storylineEvent") for e in model["events"]] == [None, None, True, None, None]
    assert "eras" not in base and "storylineEvent" not in base["events"][2]  # a copy
    out = export.write_race(model, races_dir=tmp_path)
    assert json.loads(out.read_text()) == model


def test_with_eras_fields_without_blocks_is_unchanged(base):
    assert export.with_eras_fields(base) == base


def test_with_eras_fields_rejects_a_missing_event_and_a_bad_block(base):
    with pytest.raises(ValueError, match="no SC event on lap 20"):
        export.with_eras_fields(base, storyline_events=[(20, "SC")])
    with pytest.raises(jsonschema.ValidationError):
        export.with_eras_fields(base, rules={"vsc": "no"})


def test_write_race_rejects_an_invalid_eras_block(base, tmp_path):
    with pytest.raises(jsonschema.ValidationError):
        export.write_race(with_(base, eras={"eraId": 9}), races_dir=tmp_path)
    assert not list(tmp_path.iterdir())
