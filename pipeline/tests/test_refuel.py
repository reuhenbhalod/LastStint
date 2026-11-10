"""Refuelling and fuel limits (eras build plan 4.2): the reference sim's refuelling replay, the
parity vectors the TS sim checks (packages/sim/tests/refuel.test.ts), the fill-rate fit, and
the overlays' rules.refuelling / rules.fuelLimit.

Regenerate the vectors after a deliberate sim change with
`REGEN_REFUEL_VECTORS=1 uv run python -m pytest tests/test_refuel.py`.
"""

from __future__ import annotations

import copy
import json
import os
from pathlib import Path
from types import SimpleNamespace

import pandas as pd
import pytest

from pipeline import export, race_rules, refuel, sim_reference
from pipeline.paths import DATA_DIR, RACES_DIR, RAW_DIR

VECTORS = Path(__file__).parent / "fixtures" / "refuel_parity.json"
SEEDS = [1, 2, 3, 4, 5]
# A fill model for the parity cases (a refuelling race's track.refuel), steep enough that
# every fill shows in the times.
FILL = {"secondsPerLap": 0.3, "laneBase": 18.0, "refFill": 15.0, "tankLaps": 30, "stops": 20}
# Hungary 1998 (Jolpica results): laps completed by the classified finishers, by car number.
HUNGARY_1998_FINISHED = {
    3: 77, 7: 77, 1: 77, 9: 77, 2: 77, 8: 76, 14: 76, 5: 76, 10: 76, 15: 76,
    16: 74, 11: 74, 19: 74, 21: 74, 22: 74,
}  # fmt: skip


def _model(race: str) -> dict:
    return json.loads((RACES_DIR / f"{race}.json").read_text())


def _real(model: dict, code: str) -> list[dict]:
    return copy.deepcopy(next(d for d in model["drivers"] if d["code"] == code)["realStrategy"])


def _abu_strategies(m: dict) -> dict:
    """Refuelling plans on Abu Dhabi 2021 (58 laps, takeover 34): HAM two new stops (no
    measured loss: fill time charged), SAI a short and a long fill, VER the real stops with
    the player's fill choice at the real lap-37 stop (a measured loss: priced against the
    real fill)."""
    return {
        "HAM": [{"lap": 40, "to": "HARD"}, {"lap": 50, "to": "SOFT"}],
        "SAI": [
            {"lap": 38, "to": "HARD", "fill": "short"},
            {"lap": 47, "to": "SOFT", "fill": "long"},
        ],
        "VER": [{**_real(m, "VER")[0], "fill": "long"}, *_real(m, "VER")[1:]],
        "PER": [{"lap": 45, "to": "HARD", "fill": "standard"}],
        # Exact fills (the real team's calls, the engineer's plans): 9 laps, to the lap-48
        # in-lap, then 30 laps, past the flag, held to it (10).
        "LEC": [
            {"lap": 40, "to": "HARD", "fill": {"laps": 9}},
            {"lap": 49, "to": "SOFT", "fill": {"laps": 30}},
        ],
    }


def _cases() -> list[dict]:
    abu = _model("abu-dhabi-2021")
    return [
        {
            "name": "abu-dhabi-2021 refuelling, real strategies (the weight)",
            "race": "abu-dhabi-2021",
            "rules": {"refuelling": True},
            "refuel": FILL,
        },
        {
            "name": "abu-dhabi-2021 refuelling, new stops and fill choices",
            "race": "abu-dhabi-2021",
            "rules": {"refuelling": True},
            "refuel": FILL,
            "strategies": _abu_strategies(abu),
        },
        {
            "name": "abu-dhabi-2021 2005 rules: a stop only refuels",
            "race": "abu-dhabi-2021",
            "rules": {"refuelling": True, "tyreChanges": False},
            "refuel": FILL,
            "strategies": _abu_strategies(abu),
        },
        {
            "name": "canada-2024 refuelling, no fit (the physical prior), wet stops",
            "race": "canada-2024",
            "rules": {"refuelling": True},
        },
    ]


def apply_case(case: dict) -> dict:
    """The case's race file with its rules and fill model set (as the TS test does)."""
    m = _model(case["race"])
    m["rules"] = case["rules"]
    if "refuel" in case:
        m["track"]["refuel"] = case["refuel"]
    return m


def _functions() -> dict:
    """The pure parts both sims share: the fill choices, the takeover tank, the allowances."""
    fills = [
        [choice, remaining, cap, refuel.fill_stint(choice, remaining, cap)]
        for choice in refuel.FILL_CHOICES
        for remaining in (0, 1, 7, 15, 29, 30, 31, 44, 60, 77)
        for cap in (12, 30, 33.5, 80)
    ]
    plans = [[], [{"lap": 40}], [{"lap": 52}, {"lap": 38}], [{"lap": 35}]]
    tanks = [[p, refuel.takeover_tank(p, 34, 58)] for p in plans]
    limits = {str(y): refuel.fuel_limit_kg(y) for y in range(1982, 1991)}
    exact = [
        [fill, remaining, refuel.fill_laps(fill, remaining, 30)]
        for fill in ({"laps": 1}, {"laps": 12}, {"laps": 30}, "short", "long")
        for remaining in (0, 5, 12, 22)
    ]
    return {"fills": fills, "tanks": tanks, "limits": limits, "exact": exact}


def build_vectors() -> dict:
    out = []
    for case in _cases():
        m = apply_case(case)
        results = {
            str(s): sim_reference.simulate(m, s, copy.deepcopy(case.get("strategies")))
            for s in SEEDS
        }
        out.append({**case, "results": results})
    return {"cases": out, "functions": _functions()}


def test_parity_vectors_are_current():
    want = build_vectors()
    if os.environ.get("REGEN_REFUEL_VECTORS"):
        VECTORS.write_text(json.dumps(want, indent=1) + "\n")
    assert json.loads(VECTORS.read_text()) == json.loads(json.dumps(want))


def test_refuelling_changes_each_replay():
    for case in _cases():
        base = _model(case["race"])
        strategies = case.get("strategies")
        ruled = apply_case(case)
        assert any(
            sim_reference.simulate(base, s, copy.deepcopy(strategies))
            != sim_reference.simulate(ruled, s, copy.deepcopy(strategies))
            for s in SEEDS
        ), case["name"]


def test_refuelling_false_changes_nothing():
    m = _model("abu-dhabi-2021")
    ruled = copy.deepcopy(m)
    ruled["rules"] = {"refuelling": False}
    ruled["track"]["refuel"] = FILL
    for s in SEEDS:
        assert sim_reference.simulate(ruled, s) == sim_reference.simulate(m, s)


def test_the_case_models_validate():
    for case in _cases():
        export.validate_model(apply_case(case))


# --- The tank -------------------------------------------------------------------------------


class _Car:
    def __init__(self, code: str, strategy: list[dict], tank: float, laps: int = 58):
        self.code, self.strategy, self.tank, self.race_laps = code, strategy, tank, laps


def test_a_single_tank_car_carries_only_the_reserve_over_todays_load():
    m = {"rules": {"refuelling": True}, "race": {"laps": 58, "takeoverLap": 34}}
    car = _Car("HAM", [], 0.0)
    refuel.init_tanks(m, {"HAM": car})
    assert car.tank == 58 - 34 + refuel.RESERVE_LAPS
    for lap in range(35, 59):
        delta = refuel.tank_weight_delta(car, 0.06, lap)
        assert delta == pytest.approx(0.06 * refuel.RESERVE_LAPS)
        refuel.burn_tank(car)


def test_the_weight_resets_at_a_stop():
    m = _model("abu-dhabi-2021")
    m["rules"] = {"refuelling": True}
    m["track"]["refuel"] = FILL
    car = _Car("VER", [{"lap": 54, "to": "SOFT"}], 2.0)  # 1 lap + the reserve to the lap-37 stop
    extra = refuel.refuel_at_stop(m, car, {"lap": 37, "to": "HARD"}, 37)
    assert car.tank == 54 - 37 + refuel.RESERVE_LAPS  # fuel to the lap-53 in-lap
    assert extra == pytest.approx(0.3 * ((54 - 37 + 1 - 2) - 15))
    before = refuel.tank_weight_delta(car, 0.05, 37)
    # A heavier car than the single tank's 22 laps would be... lighter: 18 laps on board.
    assert before == pytest.approx(0.05 * (18 - 22))


def test_a_real_stop_keeps_its_measured_loss_but_prices_a_fill_choice():
    m = _model("abu-dhabi-2021")
    m["rules"] = {"refuelling": True}
    m["track"]["refuel"] = FILL
    real = {"lap": 37, "to": "HARD", "loss": 10.684}
    car = _Car("VER", [{"lap": 54, "to": "SOFT"}], 3.0)
    assert refuel.refuel_at_stop(m, car, real, 37) == 0.0
    car = _Car("VER", [], 3.0)
    long = refuel.refuel_at_stop(m, car, {**real, "fill": "long"}, 37)
    # long: 22 laps to the flag (tank 30) against the real 17 to the lap-53 in-lap.
    assert long == pytest.approx(0.3 * (22 - 17))
    assert car.tank == 22 + refuel.RESERVE_LAPS


@pytest.mark.parametrize(
    ("choice", "remaining", "cap", "want"),
    [
        ("long", 44, 30, 30),
        ("standard", 44, 30, 22),
        ("short", 44, 30, 15),
        ("long", 20, 30, 20),
        ("standard", 20, 30, 20),
        ("short", 20, 30, 10),
        ("standard", 77, 30, 26),
        ("short", 77, 30, 20),
        ("short", 1, 30, 1),
    ],
)
def test_fill_choices(choice, remaining, cap, want):
    assert refuel.fill_stint(choice, remaining, cap) == want


def test_an_exact_fill_fuels_its_laps_never_past_the_flag():
    assert refuel.fill_laps({"laps": 12}, 22, 30) == 12
    assert refuel.fill_laps({"laps": 30}, 22, 30) == 22
    assert refuel.fill_laps({"laps": 5}, 0, 30) == 0
    assert refuel.fill_laps("short", 22, 30) == refuel.fill_stint("short", 22, 30)


def test_an_exact_real_fill_at_a_real_stop_prices_at_nothing():
    m = apply_case(_cases()[1])
    real = _real(m, "VER")[0]  # out on 37, the next real stop out on 54: 17 laps
    car = _Car("VER", [], 1.0)
    assert refuel.refuel_at_stop(m, car, {**real, "fill": {"laps": 17}}, 37) == 0.0
    assert car.tank == 17 + refuel.RESERVE_LAPS


# --- The fill-rate fit ----------------------------------------------------------------------


def _hungary_1998() -> pd.DataFrame:
    stops = pd.read_csv(RAW_DIR / "f1db" / "hungary-1998.stops.csv")
    return refuel.stints_from_stops(stops, HUNGARY_1998_FINISHED)


def test_stints_from_stops():
    st = _hungary_1998()
    msc = st[st["number"] == 3].sort_values("lap")
    assert msc[["lap", "stint"]].values.tolist() == [[25, 18], [43, 19], [62, 15]]
    # Trulli (12) retired on lap 28 after one stop: his stint is unknown.
    assert 12 not in set(st["number"])


def test_hungary_1998_fill_rate():
    fit = refuel.fit_fill_rate(_hungary_1998())
    own = refuel.race_slope(_hungary_1998())
    lo, hi = sorted((own["slope"], refuel.PRIOR_SECONDS_PER_LAP))
    assert lo <= fit["secondsPerLap"] <= hi  # shrunk between the race and the prior
    assert fit["secondsPerLap"] == pytest.approx(refuel.PRIOR_SECONDS_PER_LAP, abs=0.015)
    assert fit["tankLaps"] == 33 and fit["stops"] >= 30
    # mean lane ~30.5 s less 0.24 s x a 23.6-lap mean fill
    assert 23 < fit["laneBase"] < 27


def test_the_prior_is_the_physical_fill_rate():
    # ~3 L a lap of fuel through a ~12 L/s rig.
    assert refuel.PRIOR_SECONDS_PER_LAP == pytest.approx(3.0 / 12.0) == 0.25
    assert refuel.PRIOR_SD == 0.01
    assert "an estimate" in refuel.FILL_RATE_METHOD and "0.25 s" in refuel.FILL_RATE_METHOD


def test_the_stops_pooled_slope_is_current():
    """For the record: what the stops alone say, a quarter of the physical rate."""
    mu, tau = refuel.pooled_prior()
    assert mu == pytest.approx(refuel.POOLED_SLOPE, abs=5e-5)
    assert tau == pytest.approx(refuel.POOLED_TAU, abs=5e-5)
    assert mu < refuel.PRIOR_SECONDS_PER_LAP / 3


def test_no_single_race_pulls_the_rate_back_toward_the_pooled_slope():
    """Every refuelling race in data/raw/f1db keeps its rate within 0.06 s of the prior (the
    most precise, europe-2007, has a negative slope: 0.20), and a precise race at the
    stops' pooled slope (POOLED_SLOPE, se 0.025) stays above 0.22."""
    rates = {}
    for path in sorted(refuel.F1DB_DIR.glob("*.stops.csv")):
        race = path.name.split(".")[0]
        if int(race.rsplit("-", 1)[1]) not in refuel.REFUEL_YEARS:
            continue
        rates[race] = refuel.fit_fill_rate(refuel.stints_from_stops(pd.read_csv(path)))[
            "secondsPerLap"
        ]
    assert len(rates) >= 25
    assert min(rates.values()) > 0.19 and max(rates.values()) < 0.27
    assert sorted(rates.values())[len(rates) // 2] == pytest.approx(0.25, abs=0.005)
    # A synthetic race whose 40 stops sit exactly on the pooled slope, se ~0.025.
    stints = pd.DataFrame({"number": range(40), "lap": 20, "stint": [10, 30] * 20})
    noise = [1.6, -1.6, -1.6, 1.6] * 10
    stints["lane"] = [
        25 + refuel.POOLED_SLOPE * n + e for n, e in zip(stints["stint"], noise, strict=True)
    ]
    assert 0.02 < refuel.race_slope(stints)["se"] < 0.03
    assert refuel.fit_fill_rate(stints)["secondsPerLap"] > 0.22


def test_a_long_fill_costs_4_to_5_s_more_than_a_short_one_at_a_typical_stop():
    """Hungary 1998 (77 laps, a 33-lap tank, its own fit): a first stop out on lap 30 has 48
    laps to go. Long brims the tank (33 laps), short splits the 48 over three stints (16): 17
    laps more fuel at ~0.25 s a lap."""
    fit = refuel.fit_fill_rate(_hungary_1998())
    model = {
        "rules": {"refuelling": True},
        "race": {"laps": 77, "takeoverLap": 1},
        "track": {"refuel": fit},
        "drivers": [],
    }
    cost = {}
    for choice in ("short", "long"):
        # The car comes in with the reserve lap left.
        car = SimpleNamespace(code="AAA", strategy=[], tank=1.0, race_laps=77)
        cost[choice] = refuel.refuel_at_stop(model, car, {"lap": 29, "fill": choice}, 30)
        assert car.tank == refuel.fill_stint(choice, 48, 33) + refuel.RESERVE_LAPS
    assert 4.0 <= cost["long"] - cost["short"] <= 5.0
    # Before (the stops' pooled slope) the same choice cost about 1 s.
    assert refuel.POOLED_SLOPE * 17 < 1.2


def test_a_race_without_a_slope_takes_the_prior():
    flat = pd.DataFrame({"number": [1, 2], "lap": [10, 10], "stint": [20, 20], "lane": [25, 26]})
    assert refuel.fit_fill_rate(flat)["secondsPerLap"] == pytest.approx(
        refuel.PRIOR_SECONDS_PER_LAP, abs=1e-4
    )


def test_effective_lap_is_the_sims_sawtooth():
    laps = pd.DataFrame({"Driver": ["A"] * 6, "LapNumber": [1, 2, 3, 4, 5, 6]})
    eff = refuel.effective_lap(laps, {"A": [3]}, 6)
    # -fuel x eff = -fuel x lap + fuel x (tank - single): the tank at each lap's start.
    tanks = [3 + 1, 2 + 1, 1 + 1, 3 + 1, 2 + 1, 1 + 1]
    for lap, e, t in zip(range(1, 7), eff, tanks, strict=True):
        assert e == pytest.approx(lap - (t - (6 - lap + 1)))


def test_fuel_columns_give_the_build_the_sims_fuel_term():
    laps = pd.DataFrame({"Driver": ["A"] * 6 + ["B"] * 6, "LapNumber": [1, 2, 3, 4, 5, 6] * 2})
    ins = refuel.stop_in_laps({"A": [{"lap": 4, "to": "SOFT"}], "B": []})
    assert ins == {"A": [3], "B": []}
    out = refuel.with_fuel_columns(laps, ins, 6)
    assert "Tank" not in laps.columns  # a copy
    assert out["FuelLap"].tolist() == refuel.effective_lap(laps, ins, 6).tolist()
    assert out["Tank"].tolist()[:6] == [4, 3, 2, 4, 3, 2]
    # B never stops: a single tank plus the reserve, today's fuel term one lap later.
    assert out["FuelLap"].tolist()[6:] == [0.0, 1.0, 2.0, 3.0, 4.0, 5.0]
    assert refuel.fuel_laps(out).tolist() == out["FuelLap"].tolist()
    assert refuel.fuel_laps(laps).tolist() == [float(x) for x in laps["LapNumber"]]
    # A build-side Car on a lap row runs the sim's clean lap: -fuel x FuelLap.
    compounds = {"SOFT": {"offset": 0.0, "degPerLap": 0.0, "cliffLap": 99}}
    for r in out.itertuples():
        car = sim_reference.Car(
            code="A", base_pace=90.0, noise=0.0, compound="SOFT", tyre_age=0, total_time=0.0,
            **refuel.car_fuel(r),
        )  # fmt: skip
        lap = sim_reference._clean_lap(car, compounds, 0.1, int(r.LapNumber))
        assert lap == pytest.approx(90.0 - 0.1 * r.FuelLap)
        assert refuel.fuel_lap_of(r) == r.FuelLap
    assert refuel.car_fuel(next(laps.itertuples())) == {}


def test_the_race_fill_model_reads_the_f1db_stops(tmp_path):
    results = [
        {"number": 3, "laps": 77, "status": "finished"},
        {"number": 8, "laps": 76, "status": "lapped"},
        {"number": 12, "laps": 28, "status": "retired"},
    ]
    assert refuel.finished_laps(results) == {3: 77, 8: 76}
    fit, slope = refuel.race_fill_model("hungary-1998", results)
    assert fit["tankLaps"] >= 18 and slope["stops"] == fit["stops"]
    assert refuel.race_fill_model("hungary-1998", results, tmp_path) == (None, None)


# --- The rules by year and the overlays -------------------------------------------------------


@pytest.mark.parametrize(
    ("year", "want"),
    [
        (1983, {"refuelling": True}),
        (1984, {"refuelling": False, "fuelLimit": 187.0}),
        (1985, {"refuelling": False, "fuelLimit": 187.0}),
        (1986, {"refuelling": False, "fuelLimit": 165.75}),
        (1987, {"refuelling": False, "fuelLimit": 165.75}),
        (1988, {"refuelling": False, "fuelLimit": 127.5}),
        (1989, {"refuelling": False}),
        (1993, {"refuelling": False}),
        (1994, {"refuelling": True}),
        (2005, {"refuelling": True}),
        (2009, {"refuelling": True}),
        (2010, {"refuelling": False}),
        (2024, {"refuelling": False}),
    ],
)
def test_r4_rules_by_year(year, want):
    assert refuel.r4_rules_for_year(year) == want


def test_every_appendix_overlay_has_its_r4_rules():
    base = _model("abu-dhabi-2021")
    for race_id in race_rules.appendix_races():
        rules = json.loads((DATA_DIR / "eras" / f"{race_id}.json").read_text())["rules"]
        year = race_rules.race_year(race_id)
        assert {k: rules[k] for k in ("refuelling", "fuelLimit") if k in rules} == (
            refuel.r4_rules_for_year(year)
        ), race_id
        export.validate_model({**base, "rules": rules})


def test_overlay_writers_keep_each_others_keys(tmp_path):
    (tmp_path / "monaco-1988.json").write_text(json.dumps({"eras": {"eraId": 1}}))
    refuel.write_r4_overlays(["monaco-1988"], tmp_path)
    race_rules.write_rules_overlays(["monaco-1988"], tmp_path)
    got = json.loads((tmp_path / "monaco-1988.json").read_text())
    assert got["eras"] == {"eraId": 1}
    assert got["rules"]["fuelLimit"] == 127.5 and got["rules"]["refuelling"] is False
    assert got["rules"]["twoCompound"] is False
    refuel.write_r4_overlays(["monaco-1988"], tmp_path)
    assert json.loads((tmp_path / "monaco-1988.json").read_text()) == got
