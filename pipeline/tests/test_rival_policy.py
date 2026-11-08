"""Rival policies (eras build plan 9.1, eras spec §7): the policy selector, the hook in the
reference sim, and every rule function against the vectors the TS sim checks too (parity)."""

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
def test_every_defined_policy_resolves(policy):
    assert resolve_rival_policy(policy) == policy
    assert policy in rival_policy.IMPLEMENTED_RIVAL_POLICIES


def test_cover_windows_and_playouts():
    assert rival_policy.cover_window("standard") == rival_policy.COVER_WINDOW == 4
    assert rival_policy.cover_window("standard-plus") == 7
    assert rival_policy.cover_window("smart") == rival_policy.cover_window("expert") == 7
    assert rival_policy.playout_policy("expert") == "smart"
    assert rival_policy.playout_policy("smart") == "smart"
    assert [rival_policy.has_smart_rules(p) for p in rival_policy.RIVAL_POLICIES] == [
        False,
        False,
        True,
        True,
    ]
    assert rival_policy.EXPERT_SAMPLES == 100


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


def test_the_sim_rejects_an_unknown_policy():
    with pytest.raises(RivalPolicyError):
        sim_reference.simulate(_model("abu-dhabi-2021"), 1, rival_policy="legend")


@pytest.mark.parametrize("policy", ["standard-plus", "smart", "expert"])
def test_the_reference_sim_has_no_reacting_rival(policy):
    # No player-controlled car, so every policy replays the real race.
    model = _model("abu-dhabi-2021")
    assert sim_reference.simulate(model, 3, rival_policy=policy) == sim_reference.simulate(model, 3)


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


# --- the rule functions (rival_rules.json, checked by the TS sim too) ------------------------


def test_the_rule_vectors_are_current():
    # The fixture is what the rules give today: regenerate with `python -m pipeline.rival_policy`.
    want = json.loads(rival_policy.RULE_VECTORS.read_text())
    got = json.loads(json.dumps(rival_policy.rule_vectors(RACES_DIR)))
    assert got == want


def test_the_rule_vectors_have_teeth():
    v = json.loads(rival_policy.RULE_VECTORS.read_text())
    cases = [c for r in v["races"].values() for c in r["cases"] if "planTime" in c]
    covers = [c["cover"] for r in v["races"].values() for c in r["cases"] if "cover" in c]
    wet = [w for r in v["races"].values() for w in r["wet"]]
    assert len(cases) > 300
    assert any(c["overcutLap"] is not None for c in cases)
    assert any(c["overcutLap"] is None for c in cases)
    assert any(c["overcutLap"] and c["overcutLap"] > c["strategy"][0]["lap"] for c in cases)
    assert any(w["switch"][0] is None and w["switch"][1] for w in wet)  # Expert's lead
    assert any(c["window"][0] is None and c["window"][1] for c in covers)  # Standard+'s 7
    assert all(c["underSc"] is None for c in covers)
    assert {tuple(o["id"] for o in x["options"]) for x in v["options"]} >= {
        ("smart",),
        ("smart", "stay-out"),
        ("smart", "box-now"),
        ("smart", "stay-out", "box-now"),
    }


def test_the_overcut_stays_inside_the_tyre_life():
    model = _model("abu-dhabi-2021")
    for age in (3, 14, 26, 40):
        car = _car(model, model["rival"], "HARD", age)
        strategy = [{"lap": 56, "to": "MEDIUM"}]
        to = rival_policy.overcut_lap(model, car, strategy, 36)
        latest = rival_policy.latest_stop(model, car, 36)
        assert latest == 37 + max(0, int(rival_policy.life_of(model, "HARD") - 3 - age))
        assert to is None or 37 <= to <= min(latest, 57)


def test_the_overcut_picks_the_lowest_predicted_time():
    model = _model("spain-2021")
    car = _car(model, model["rival"], "MEDIUM", 10)
    strategy = [{"lap": 30, "to": "SOFT"}, {"lap": 50, "to": "MEDIUM"}]
    to = rival_policy.overcut_lap(model, car, strategy, 25)
    hi = min(rival_policy.latest_stop(model, car, 25), 49)
    times = {
        at: rival_policy.plan_time(model, car, 25, [{"lap": at, "to": "SOFT"}, strategy[1]])
        for at in range(26, hi + 1)
    }
    best = min(times, key=lambda at: (times[at], at))
    assert (to or 30) == best


def test_no_overcut_without_a_planned_stop():
    model = _model("spain-2021")
    car = _car(model, model["rival"], "MEDIUM", 10)
    assert rival_policy.overcut_lap(model, car, [], 25) is None
    assert rival_policy.overcut_lap(model, car, [{"lap": 20, "to": "SOFT"}], 25) is None


def test_plan_time_prices_stops_by_flag():
    model = _model("abu-dhabi-2021")
    car = _car(model, model["rival"], "HARD", 10)
    green = rival_policy.plan_time(model, car, 40, [{"lap": 45, "to": "MEDIUM"}])
    sc = rival_policy.plan_time(model, car, 40, [{"lap": 45, "to": "MEDIUM"}], {45: "sc"})
    track = model["track"]
    # A cheaper stop, and no lap time on the SC lap (a green lap costs more than its share).
    assert green - sc > track["pitLoss"] - track["pitLossUnderSC"] + 60
    none = rival_policy.plan_time(model, car, 40, [])
    assert none == pytest.approx(
        rival_policy.plan_time(model, car, 40, [{"lap": 30, "to": "SOFT"}])
    )


def test_same_lap_cover():
    model = _model("abu-dhabi-2021")
    plan = [{"lap": 45, "to": "HARD"}]
    cover = rival_policy.same_lap_cover
    assert cover(model, plan, 40, 3.0, "MEDIUM", None, 7) == "HARD"  # within 7 of lap 41
    assert cover(model, plan, 40, 3.0, "MEDIUM", None, 3) is None
    assert cover(model, plan, 40, 30.0, "MEDIUM", None, 7) is None  # not within a pit loss
    assert cover(model, plan, 40, 3.0, "MEDIUM", "vsc", 7) is None  # green only
    assert cover(model, [{"lap": 41, "to": "HARD"}], 40, 3.0, "MEDIUM", None, 7) is None
    spain = _model("spain-2021")
    real = next(d for d in spain["drivers"] if d["code"] == spain["userSide"])["realStrategy"][0]
    lap = real["lap"] - 1
    plan = [{"lap": lap + 3, "to": "SOFT"}]
    assert cover(spain, plan, lap, 3.0, "SOFT", None, 7) == "SOFT"
    assert cover(spain, plan, lap, 3.0, real["to"], None, 7) is None  # the real call


def test_box_now_compound():
    model = _model("abu-dhabi-2021")
    car = _car(model, model["rival"], "HARD", 20)
    box = rival_policy.box_now_compound
    assert box(model, car, [], ["HARD"], 40, "INTERMEDIATE") == "INTERMEDIATE"
    assert box(model, car, [{"lap": 50, "to": "SOFT"}], ["HARD"], 40, None) == "SOFT"
    # The two-compound rule: a new dry compound.
    assert box(model, car, [], ["HARD"], 40, None) in ("SOFT", "MEDIUM")
    assert box(model, car, [], ["MEDIUM", "HARD"], 40, None) in model["compounds"]


def test_decision_reasons():
    reasons = rival_policy.decision_reasons
    assert reasons(10, 58, True, None, "sc", True, True) == [
        "player-stop",
        "neutral-next",
        "own-stop",
        "wet-crossover",
    ]
    assert reasons(10, 58, False, "sc", "sc", False, False) == []  # the SC started already
    assert reasons(57, 58, True, None, None, True, False) == []  # no lap left to box on


def test_rival_options_dedupe_and_defer():
    opts = rival_policy.rival_options
    a = {"lap": 21, "to": "HARD"}
    got = opts(20, 58, [a], [a], "HARD")
    assert [o["id"] for o in got] == ["smart", "stay-out"]
    assert got[1]["stops"] == [{"lap": 22, "to": "HARD", "added": True}]
    got = opts(20, 58, [], [], "MEDIUM")
    assert [o["id"] for o in got] == ["smart", "box-now"]
    assert opts(56, 58, [{"lap": 57, "to": "SOFT"}], [], None)[0]["stops"] == []
