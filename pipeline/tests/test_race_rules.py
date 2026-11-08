"""Era rules (eras build plan 4.1): the reference sim's rules, the parity vectors the TS sim
checks (packages/sim/tests/rules.test.ts), and the data/eras overlays' `rules` key.

Regenerate the vectors after a deliberate sim change with
`REGEN_RULES_VECTORS=1 uv run python -m pytest tests/test_race_rules.py`.
"""

from __future__ import annotations

import copy
import json
import os
from pathlib import Path

import pytest

from pipeline import export, race_rules, refuel, sim_reference
from pipeline.paths import DATA_DIR, GOLDEN_DIR, RACES_DIR

VECTORS = Path(__file__).parent / "fixtures" / "race_rules_parity.json"
SEEDS = [1, 2, 3, 4, 5]


def _model(race: str) -> dict:
    return json.loads((RACES_DIR / f"{race}.json").read_text())


def _with_stop(model: dict, code: str, stop: dict) -> list[dict]:
    """The car's real strategy plus an added stop (explicit loss: no TS sampling), which
    replaces a real stop on the same lap."""
    real = next(d for d in model["drivers"] if d["code"] == code)["realStrategy"]
    kept = [s for s in copy.deepcopy(real) if s["lap"] != stop["lap"]]
    return sorted([*kept, stop], key=lambda s: s["lap"])


def _sc_stops(model: dict) -> dict:
    """Added stops around each SC: entering at the end of the deployment lap (closed), at the
    end of the green lap before (exempt), at the end of the 2nd SC lap (open), and one onto a
    wet tyre in the closed window (exempt)."""
    sc = [
        e for e in model["events"] if e["type"] == "SC" and e["lap"] > model["race"]["takeoverLap"]
    ]
    loss = model["track"]["pitLossUnderSC"]
    order = sorted(model["drivers"], key=lambda d: d["stateAtTakeover"]["position"])
    codes = [d["code"] for d in order]
    dry = [c for c in model["compounds"] if c not in race_rules.WET_TYRES]
    strategies: dict = {}
    for k, e in enumerate(sc):
        picks = codes[k * 4 : k * 4 + 4]
        plan = [(picks[0], e["lap"] + 1), (picks[1], e["lap"]), (picks[2], e["lap"] + 2)]
        for code, out in plan:
            stop = {"lap": out, "to": dry[0], "added": True, "loss": loss}
            strategies[code] = _with_stop(model, code, stop)
        if "INTERMEDIATE" in model["compounds"]:
            stop = {"lap": e["lap"] + 1, "to": "INTERMEDIATE", "added": True, "loss": loss}
            strategies[picks[3]] = _with_stop(model, picks[3], stop)
    return strategies


def _cases() -> list[dict]:
    cases = []
    for race in ("abu-dhabi-2021", "canada-2024"):
        m = _model(race)
        stops = _sc_stops(m)
        cases += [
            {"name": f"{race} no tyre changes", "race": race, "rules": {"tyreChanges": False}},
            {
                "name": f"{race} pit lane closed under the SC",
                "race": race,
                "rules": {"pitLaneClosedUnderSC": True},
                "strategies": stops,
            },
            {
                "name": f"{race} added SC stops, pit lane open (no rules)",
                "race": race,
                "strategies": stops,
            },
            {"name": f"{race} scUnlap none", "race": race, "scUnlap": "none"},
            {
                "name": f"{race} every rule",
                "race": race,
                "scUnlap": "none",
                "rules": {
                    "twoCompound": False,
                    "tyreChanges": False,
                    "pitLaneClosedUnderSC": True,
                    "vsc": False,
                    "drs": False,
                    "ers": "none",
                },
                "strategies": stops,
            },
        ]
    return cases


def apply_case(case: dict) -> dict:
    """The case's race file with its rules and scUnlap set (as the TS test does)."""
    m = _model(case["race"])
    if "rules" in case:
        m["rules"] = case["rules"]
    if "scUnlap" in case:
        m["race"]["scUnlap"] = case["scUnlap"]
    return m


def build_vectors() -> dict:
    out = []
    for case in _cases():
        m = apply_case(case)
        results = {str(s): sim_reference.simulate(m, s, case.get("strategies")) for s in SEEDS}
        out.append({**case, "results": results})
    return {"cases": out}


def test_parity_vectors_are_current():
    want = build_vectors()
    if os.environ.get("REGEN_RULES_VECTORS"):
        VECTORS.write_text(json.dumps(want, indent=1) + "\n")
    assert json.loads(VECTORS.read_text()) == json.loads(json.dumps(want))


def test_each_rule_changes_its_replay():
    """Every case with a rule differs from the same race without it (so each rule is live)."""
    for case in _cases():
        if "rules" not in case and "scUnlap" not in case:
            continue
        base = _model(case["race"])
        ruled = apply_case(case)
        strategies = case.get("strategies")
        differs = any(
            sim_reference.simulate(base, s, strategies)
            != sim_reference.simulate(ruled, s, strategies)
            for s in SEEDS
        )
        assert differs, case["name"]


def test_no_rules_block_replays_the_golden_files():
    for path in sorted(GOLDEN_DIR.glob("*.json")):
        race = RACES_DIR / path.name
        if not race.exists():
            continue
        model = json.loads(race.read_text())
        assert "rules" not in model
        golden = json.loads(path.read_text())
        for seed in list(golden)[:3]:
            got = sim_reference.simulate(model, int(seed))
            assert got["order"] == golden[seed]["order"], (path.name, seed)


def test_a_rules_block_of_defaults_changes_nothing():
    m = _model("abu-dhabi-2021")
    ruled = copy.deepcopy(m)
    ruled["rules"] = {"twoCompound": True, "tyreChanges": True, "pitLaneClosedUnderSC": False}
    for s in SEEDS:
        assert sim_reference.simulate(ruled, s) == sim_reference.simulate(m, s)


# --- The rules themselves ---------------------------------------------------------------------


def test_no_tyre_changes_keeps_the_set_but_not_for_wet_or_damage():
    m = {"rules": {"tyreChanges": False}}
    assert not race_rules.stop_changes_tyres(m, "MEDIUM", {"to": "HARD"})
    assert not race_rules.stop_changes_tyres(m, "MEDIUM", {"to": "MEDIUM"})
    assert race_rules.stop_changes_tyres(m, "MEDIUM", {"to": "INTERMEDIATE"})
    assert race_rules.stop_changes_tyres(m, "WET", {"to": "MEDIUM"})
    assert race_rules.stop_changes_tyres(m, "MEDIUM", {"to": "MEDIUM", "damaged": True})
    assert race_rules.stop_changes_tyres({}, "MEDIUM", {"to": "HARD"})


def test_a_no_tyre_change_stop_keeps_wear_and_compound():
    m = _model("canada-2024")
    m["rules"] = {"tyreChanges": False}
    # HAM's lap-55 MEDIUM -> HARD stop keeps the mediums: the stop is pure loss.
    base = sim_reference.simulate(_model("canada-2024"), 1)
    ruled = sim_reference.simulate(m, 1)
    assert ruled["times"]["HAM"] != base["times"]["HAM"]


def test_pit_lane_closed_window():
    m = {"rules": {"pitLaneClosedUnderSC": True}}
    neutral = {53: "SC", 54: "SC", 55: "SC", 56: "SC", 57: "SC"}
    assert not race_rules.pit_lane_closed(m, neutral, 53, "SOFT")  # entered on green
    assert race_rules.pit_lane_closed(m, neutral, 54, "SOFT")  # end of the deployment lap
    assert not race_rules.pit_lane_closed(m, neutral, 55, "SOFT")  # queued: open
    assert not race_rules.pit_lane_closed(m, neutral, 54, "INTERMEDIATE")  # wet tyres only
    assert not race_rules.pit_lane_closed({}, neutral, 54, "SOFT")
    assert not race_rules.pit_lane_closed(m, {36: "VSC", 37: "VSC"}, 37, "SOFT")


def test_closed_pit_lane_costs_a_stop_go_served_on_green():
    m = _model("abu-dhabi-2021")  # SC laps 53-57: the stop-go is served on lap 58
    stops = _sc_stops(m)
    closed = next(c for c, st in stops.items() if any(s["lap"] == 54 for s in st))
    ruled = copy.deepcopy(m)
    ruled["rules"] = {"pitLaneClosedUnderSC": True}
    for seed in SEEDS:
        a = sim_reference.simulate(m, seed, stops)
        b = sim_reference.simulate(ruled, seed, stops)
        lost = b["times"][closed] - a["times"][closed]
        # The full stop-go, give or take the last lap's traffic.
        assert lost == pytest.approx(race_rules.stop_go_cost(m), abs=2.0)
        others = [
            c
            for c in a["times"]
            if c != closed and not any(s["lap"] == 54 for s in stops.get(c, []))
        ]
        assert any(a["times"][c] == b["times"][c] for c in others)


def test_stop_go_at_the_flag_when_no_green_lap_is_left():
    class C:
        stop_go = 30.0

    car = C()
    assert race_rules.serve_stop_go(car, "SC", 57, 58) == 0.0
    assert race_rules.serve_stop_go(car, "SC", 58, 58) == 30.0
    assert car.stop_go == 0.0


def test_sc_unlap_none_keeps_lapped_cars_a_lap_down():
    m = _model("abu-dhabi-2021")
    m["race"]["scUnlap"] = "all"
    none = copy.deepcopy(m)
    none["race"]["scUnlap"] = "none"
    green = m["track"]["greenLapTime"]
    for s in SEEDS:
        all_ = sim_reference.simulate(m, s)
        kept = sim_reference.simulate(none, s)
        # Unlapping closes the whole field up: nobody ends a lap down behind the leader.
        assert max(all_["gaps"].values()) < green
        assert max(kept["gaps"].values()) > green


# --- The rules by year and the overlays -------------------------------------------------------


@pytest.mark.parametrize(
    ("year", "want"),
    [
        (
            1988,
            {
                "twoCompound": False,
                "tyreChanges": True,
                "pitLaneClosedUnderSC": False,
                "vsc": False,
                "drs": False,
                "ers": "none",
            },
        ),
        (
            2005,
            {
                "twoCompound": False,
                "tyreChanges": False,
                "pitLaneClosedUnderSC": False,
                "vsc": False,
                "drs": False,
                "ers": "none",
            },
        ),
        (
            2007,
            {
                "twoCompound": True,
                "tyreChanges": True,
                "pitLaneClosedUnderSC": True,
                "vsc": False,
                "drs": False,
                "ers": "none",
            },
        ),
        (
            2009,
            {
                "twoCompound": True,
                "tyreChanges": True,
                "pitLaneClosedUnderSC": False,
                "vsc": False,
                "drs": False,
                "ers": "kers",
            },
        ),
        (
            2010,
            {
                "twoCompound": True,
                "tyreChanges": True,
                "pitLaneClosedUnderSC": False,
                "vsc": False,
                "drs": False,
                "ers": "none",
            },
        ),
        (
            2011,
            {
                "twoCompound": True,
                "tyreChanges": True,
                "pitLaneClosedUnderSC": False,
                "vsc": False,
                "drs": True,
                "ers": "kers",
            },
        ),
        (
            2014,
            {
                "twoCompound": True,
                "tyreChanges": True,
                "pitLaneClosedUnderSC": False,
                "vsc": False,
                "drs": True,
                "ers": "hybrid",
            },
        ),
        (
            2015,
            {
                "twoCompound": True,
                "tyreChanges": True,
                "pitLaneClosedUnderSC": False,
                "vsc": True,
                "drs": True,
                "ers": "hybrid",
            },
        ),
    ],
)
def test_rules_for_year(year, want):
    assert race_rules.rules_for_year(year) == want


def test_sc_unlap_by_year():
    assert [race_rules.sc_unlap_for_year(y) for y in (2006, 2007, 2009, 2010, 2011, 2012)] == [
        "none",
        "all",
        "all",
        "none",
        "none",
        "all",
    ]


def test_every_appendix_race_has_its_rules_overlay():
    ids = race_rules.appendix_races()
    assert len(ids) == 100 and len(set(ids)) == 100
    base = _model("abu-dhabi-2021")
    for race_id in ids:
        overlay = json.loads((DATA_DIR / "eras" / f"{race_id}.json").read_text())
        rules = overlay["rules"]
        # 4.1's keys, plus refuelling / fuelLimit (eras build plan 4.2, refuel.py).
        want = {
            **race_rules.rules_for_year(race_rules.race_year(race_id)),
            **refuel.r4_rules_for_year(race_rules.race_year(race_id)),
        }
        assert rules == want, race_id
        # The block validates against the schema (on a copy of a real race).
        export.validate_model({**base, "rules": rules})


def test_write_rules_overlays_keeps_other_keys(tmp_path):
    (tmp_path / "japan-2005.json").write_text(json.dumps({"eras": {"eraId": 5, "order": 2}}))
    race_rules.write_rules_overlays(["japan-2005"], tmp_path)
    got = json.loads((tmp_path / "japan-2005.json").read_text())
    assert got["eras"] == {"eraId": 5, "order": 2}
    assert got["rules"]["tyreChanges"] is False
