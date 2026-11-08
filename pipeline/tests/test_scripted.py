"""Eras model fixes M4: the SC restart's jump and spread (restart.py), scripted team orders and
let-bys (TEAM_ORDER facts and events), avoidable storyline retirements (storyline.py), a
reconstruction's last-lap stops, and the TS parity vectors (fixtures/scripted_parity.json,
checked by packages/sim/tests/scripted.test.ts)."""

from __future__ import annotations

import copy
import json
import os
from pathlib import Path

import pytest

from pipeline import build, export, incidents, restart, sim_reference, storyline
from pipeline.paths import RACES_DIR, RAW_DIR

FIXTURES = Path(__file__).parent / "fixtures"
PARITY = FIXTURES / "scripted_parity.json"
SOURCE = "https://en.wikipedia.org/wiki/2021_Abu_Dhabi_Grand_Prix"


def _abu() -> dict:
    path = RACES_DIR / "abu-dhabi-2021.json"
    if not path.exists():
        pytest.skip("no abu-dhabi-2021 race file")
    return json.loads(path.read_text())


# --- 1. the restart ---------------------------------------------------------------------------


def test_the_committed_restart_fit_is_the_fit():
    if not all((RAW_DIR / f"{r}.parquet").exists() for r in restart.FIT_RACES):
        pytest.skip("raw snapshots missing")
    got = restart.fit()
    assert (got["jump"], got["spread"], got["places"]) == (
        restart.JUMP,
        restart.SPREAD,
        restart.PLACES,
    )
    assert got["loss"] < got["todayLoss"]
    assert abs(got["medianError"]) < abs(got["todayMedianError"])


def test_restart_extra():
    block = restart.track_block()
    assert restart.extra(block, 0) == 0.0
    assert restart.extra(block, 1) == pytest.approx(restart.JUMP + restart.SPREAD)
    assert restart.extra(block, 50) == restart.extra(block, restart.PLACES)


def test_the_restart_lap_is_the_green_lap_after_an_sc_lap():
    red = {"free": {}, "wipes": {}}
    neutral = {10: "SC", 11: "SC"}
    assert sim_reference.is_restart_lap(neutral, red, 12)
    assert not sim_reference.is_restart_lap(neutral, red, 11)
    assert not sim_reference.is_restart_lap({10: "VSC"}, red, 11)
    # A standing restart's first lap has its own spread.
    standing = {"free": {}, "wipes": {11: (sim_reference.redflag.STANDING_RESTART_GAP, 9)}}
    assert not sim_reference.is_restart_lap({9: "RED", 10: "SC", 11: "SC"}, standing, 12)


def test_the_restart_spreads_the_queue_only_where_the_file_has_it():
    model = _abu()
    with_block = copy.deepcopy(model)
    with_block["track"]["restart"] = restart.track_block()
    base = sim_reference.simulate(model, 3)
    spread = sim_reference.simulate(with_block, 3)
    assert sim_reference.simulate(model, 3) == base  # no block: today's replay
    # The refit (job 1.5): the back of the queue loses JUMP + SPREAD x PLACES (1.15 s) more.
    last = base["finishers"][-1]
    assert spread["gaps"][last] > base["gaps"][last] + 0.5


# --- 2. team orders ---------------------------------------------------------------------------


def _write(tmp_path: Path, data: dict) -> Path:
    path = tmp_path / "incidents.json"
    path.write_text(json.dumps(data))
    return path


def test_team_order_facts_are_checked(tmp_path):
    good = {"lap": 50, "type": "TEAM_ORDER", "driver": "BOT", "passer": "HAM", "source": SOURCE}
    path = _write(tmp_path, {"x-2021": [good, {"lap": 3, "type": "SC"}]})
    assert incidents.team_order_facts("x-2021", path) == [good]
    for bad in (
        {**good, "source": "Wikipedia"},
        {**good, "passer": "BOT"},
        {**good, "lap": 0},
        {**good, "gap": 1.0},
    ):
        with pytest.raises(ValueError):
            incidents.team_order_facts("x-2021", _write(tmp_path, {"x-2021": [bad]}))


def test_the_committed_team_orders_name_real_cars():
    for race_id in ("hungary-2024", "russia-2018", "europe-1997", "malaysia-1999", "austria-2002"):
        facts = incidents.team_order_facts(race_id)
        assert facts, race_id
        path = RACES_DIR / f"{race_id}.json"
        if path.exists():
            events = incidents.team_order_events(facts, json.loads(path.read_text()))
            assert len(events) == len(facts)  # every one is after the takeover


def test_team_order_events_keep_the_laps_after_the_takeover():
    model = _abu()
    facts = [
        {"lap": 20, "type": "TEAM_ORDER", "driver": "BOT", "passer": "HAM", "source": SOURCE},
        {"lap": 45, "type": "TEAM_ORDER", "driver": "BOT", "passer": "HAM", "source": SOURCE},
    ]
    assert incidents.team_order_events(facts, model) == [
        {"lap": 45, "type": "TEAM_ORDER", "driver": "BOT", "other": "HAM"}
    ]
    with pytest.raises(ValueError):
        incidents.team_order_events([{**facts[1], "passer": "XXX"}], model)


def test_a_team_order_swaps_the_cars_and_holds_them():
    model = _abu()
    swapped = copy.deepcopy(model)
    # SAI ahead of BOT in every plain replay of these seeds; told to let him by on lap 45.
    swapped["events"].append({"lap": 45, "type": "TEAM_ORDER", "driver": "SAI", "other": "BOT"})
    for seed in range(1, 6):
        plain = sim_reference.simulate(model, seed)["order"]
        got = sim_reference.simulate(swapped, seed)["order"]
        assert plain.index("SAI") < plain.index("BOT"), seed
        assert got.index("BOT") < got.index("SAI"), seed


def test_apply_team_orders_rules():
    car = sim_reference.Car
    cars = {
        "A": car("A", 90, 0, "SOFT", 1, 100.0),
        "B": car("B", 90, 0, "SOFT", 1, 101.0),
        "C": car("C", 90, 0, "SOFT", 1, 130.0),
    }
    order = ["A", "B", "C"]
    recent: dict = {}
    orders = sim_reference.team_orders(
        [
            {"lap": 10, "type": "TEAM_ORDER", "driver": "A", "other": "B"},
            {"lap": 10, "type": "TEAM_ORDER", "driver": "A", "other": "C"},
        ]
    )
    sim_reference.apply_team_orders(orders, order, cars, 9, 50, recent)
    assert order == ["A", "B", "C"]  # not open yet
    sim_reference.apply_team_orders(orders, order, cars, 10, 50, recent)
    assert order == ["B", "A", "C"]
    assert cars["A"].total_time == pytest.approx(101.0 + sim_reference.TEAM_ORDER_GAP)
    assert recent[("A", "B")] == 50
    # C is out of the window (28.5 s): the order waits, then lapses.
    assert len(orders) == 1
    sim_reference.apply_team_orders(orders, order, cars, 13, 50, recent)
    assert orders == []


# --- 3. storyline retirements -----------------------------------------------------------------

LAPS = [
    {"lap": 40, "modes": {"pace": "standard"}, "tyreAge": 40, "gaps": {"HIL": 1.5}},
    {"lap": 41, "modes": {"pace": "push"}, "tyreAge": 41, "gaps": {"HIL": 0.8}},
    {"lap": 42, "modes": {"pace": "push"}, "tyreAge": 0, "gaps": {"HIL": -2.0}},
]
CONDITIONS = [
    ({"type": "mode", "key": "pace", "value": "push", "fromLap": 41}, 42, True),
    ({"type": "mode", "key": "pace", "value": "push", "fromLap": 40}, 42, False),
    ({"type": "mode", "key": "pace", "value": "push", "fromLap": 30}, 41, False),
    ({"type": "mode", "key": "pace", "value": "push", "fromLap": 43}, 43, False),
    ({"type": "tyre_age", "minLaps": 41}, 41, True),
    ({"type": "tyre_age", "minLaps": 41}, 42, False),
    ({"type": "tyre_age", "minLaps": 41}, 45, False),
    ({"type": "pressure", "driver": "HIL", "seconds": 1.0}, 41, True),
    ({"type": "pressure", "driver": "HIL", "seconds": 1.0}, 40, False),
    ({"type": "pressure", "driver": "HIL", "seconds": 1.0}, 42, False),
    ({"type": "pressure", "driver": "XXX", "seconds": 1.0}, 41, False),
    ({"type": "fuel"}, 41, False),
]


@pytest.mark.parametrize("cond,lap,want", CONDITIONS)
def test_condition_met(cond, lap, want):
    assert storyline.condition_met(cond, LAPS, lap) is want


def test_storyline_check():
    model = _abu()  # LAT retires on lap 54, PER on 56; no fuel limit
    item = {
        "driver": "LAT",
        "condition": {"type": "pressure", "driver": "PER", "seconds": 2.0},
        "alsoRetires": ["PER"],
        "real": "x",
        "source": SOURCE,
    }
    assert storyline.check(model, [item])
    for bad in (
        {**item, "driver": "VER"},
        {**item, "alsoRetires": ["VER"]},
        {**item, "condition": {"type": "fuel"}},
        {**item, "condition": {"type": "mode", "key": "pace", "value": "push", "fromLap": 55}},
    ):
        with pytest.raises(ValueError):
            storyline.check(model, [bad])
    eras = {"eraId": 9, "order": 10, "storylineRetirements": [item]}
    export.with_eras_fields(model, eras=eras)  # schema-valid


# --- the build ------------------------------------------------------------------------------


@pytest.mark.parametrize("switch", [True, False])
def test_scripted_blocks(switch, monkeypatch):
    monkeypatch.setattr(restart, "IN_ERAS_BUILDS", switch)
    model = _abu()
    facts = [{"lap": 45, "type": "TEAM_ORDER", "driver": "BOT", "passer": "HAM", "source": SOURCE}]
    recon = {"lastLapStops": [{"driver": "VER"}, {"driver": "LAT"}]}
    out, lines = build.scripted_blocks(model, "abu-dhabi-2021", recon, facts)
    if switch:
        assert out["track"]["restart"] == restart.track_block()
    else:
        assert "restart" not in out["track"]
    assert {"lap": 45, "type": "TEAM_ORDER", "driver": "BOT", "other": "HAM"} in out["events"]
    # VER gets a last-lap retirement; LAT already has his.
    assert {"lap": 58, "type": "RETIREMENT", "driver": "VER"} in out["events"]
    assert sum(e.get("driver") == "LAT" for e in out["events"]) == 1
    assert out["events"] == sorted(out["events"], key=lambda e: (e["lap"], e["type"]))
    assert len(lines) == (3 if switch else 2)
    export.validate_model(out)
    assert "restart" not in model["track"]  # the input is left alone


def test_germany_1986_last_lap_stops_are_in_its_facts():
    from pipeline import reconstruct

    facts = reconstruct.load_facts("germany-1986")
    assert [s["driver"] for s in facts["lastLapStops"]] == ["ROSK", "PRO"]


# --- TS parity --------------------------------------------------------------------------------

PARITY_ORDERS = [
    # Lap 45: P3 and P4 of a plain seed-1 replay; lap 58 (the restart lap): another pair.
    {"lap": 45, "type": "TEAM_ORDER", "driver": "SAI", "other": "BOT"},
    {"lap": 58, "type": "TEAM_ORDER", "driver": "HAM", "other": "VER"},
]
PARITY_SEEDS = list(range(1, 9))


def parity_model() -> dict:
    model = _abu()
    model["track"]["restart"] = restart.track_block()
    model["events"] = sorted(
        model["events"] + copy.deepcopy(PARITY_ORDERS), key=lambda e: (e["lap"], e["type"])
    )
    return model


def parity_vectors() -> dict:
    model = parity_model()
    return {
        "_comment": "Eras model fixes M4 parity vectors: data/races/abu-dhabi-2021.json with "
        "track.restart and these TEAM_ORDER events, run by the Python reference sim, and the "
        "storyline conditions (storyline.condition_met). Checked by pipeline/tests/"
        "test_scripted.py and packages/sim/tests/scripted.test.ts. Regenerate with "
        "SCRIPTED_PARITY_WRITE=1.",
        "race": "abu-dhabi-2021",
        "restart": restart.track_block(),
        "orders": PARITY_ORDERS,
        "results": {str(s): sim_reference.simulate(model, s) for s in PARITY_SEEDS},
        "storylineLaps": LAPS,
        "conditions": [{"condition": c, "lap": lap, "met": m} for c, lap, m in CONDITIONS],
    }


def test_parity_vectors_are_the_reference_sims():
    want = parity_vectors()
    if os.environ.get("SCRIPTED_PARITY_WRITE"):
        PARITY.write_text(json.dumps(want, indent=1) + "\n")
    assert json.loads(PARITY.read_text()) == json.loads(json.dumps(want))


def test_the_parity_model_is_schema_valid_and_both_changes_matter():
    model = parity_model()
    export.validate_model(model)
    plain = sim_reference.simulate(_abu(), 1)
    assert sim_reference.simulate(model, 1) != plain
