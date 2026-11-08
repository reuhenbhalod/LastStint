"""Race reconstruction from anchors (eras build plan 4.6, roadmap P3).

The solver is tested on small made-up races (Anchors built in code) and end to end on
tests/fixtures/reconstruct: the 1994 Australian GP cut from the Jolpica dump, with copies of
its F1DB CSVs (see VERSION.txt there). A test drivers.json with no drivers keeps the codes
independent of data/drivers.json (Jolpica's code or reference is used).
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
import pytest
from typer.testing import CliRunner

from pipeline import clean, cli, events, export, ingest, paths
from pipeline import reconstruct as rc
from pipeline.assemble import finishing_order

FIXTURE = Path(__file__).parent / "fixtures" / "reconstruct"
DUMP = FIXTURE / "jolpica-1994"
F1DB = FIXTURE / "f1db"
SRC = "test fixture"


def toy(year: int = 1990, stops: bool = False, sc: list[tuple[int, int]] | None = None):
    """A 50-lap race: 3 on the lead lap, lapped cars, a classified retirement, a pit-lane
    starter, a crash and a car out on lap 1."""
    base = 50 * 90.0 + sum(30.0 * (b - a + 1) for a, b in sc or [])  # SC laps are slow

    def car(code, grid, pos, status, laps, time, f, f_lap, classified=True, stop_laps=()):
        return rc.Car(
            driver=code,
            team=f"T{code}",
            number=None,
            grid=grid,
            position=pos,
            classified=classified,
            status=status,
            laps=laps,
            time=time,
            fastest_time=f,
            fastest_lap=f_lap,
            stops=[rc.Stop(n, 24.0, SRC) for n in stop_laps] if stops else [],
        )

    cars = [
        car("AAA", 2, 1, "finished", 50, base, 88.512, 40, stop_laps=(20,)),
        car("BBB", 1, 2, "finished", 50, base + 12.345, 88.401, 45, stop_laps=(18, 35)),
        car("CCC", 4, 3, "finished", 50, base + 40.1, 89.003, 12, stop_laps=(25,)),
        car("DDD", 3, 4, "lapped", 49, None, 89.9, 30, stop_laps=(22,)),
        car("EEE", 6, 5, "lapped", 49, None, 90.3, 3, stop_laps=(24,)),
        car("GGG", 0, 6, "lapped", 48, None, 91.0, 25, stop_laps=(26,)),
        car("FFF", 5, 7, "retired", 47, None, 89.5, 30, stop_laps=(21,)),
        car("HHH", 7, 8, "accident", 10, None, 90.0, 9, classified=False),
        car("III", 8, 9, "accident", 0, None, None, None, classified=False),
    ]
    return rc.Anchors(
        race_id=f"toy-{year}",
        year=year,
        laps=50,
        cars=cars,
        safety_cars=[rc.SafetyCar(a, b, SRC) for a, b in sc or []],
        stops_complete=stops,
        safety_cars_complete=year < 1993,
    )


@pytest.fixture(scope="module")
def solved() -> rc.Result:
    return rc.reconstruct(toy())


# --- The solver on fixtures -----------------------------------------------------------------


def test_every_anchor_passes(solved):
    assert rc.failures(solved.sidecar["anchors"]) == []
    assert solved.sidecar["solver"]["passed"]


def test_exact_finishing_order(solved):
    order = finishing_order(solved.laps)
    assert order[:7] == ["AAA", "BBB", "CCC", "DDD", "EEE", "GGG", "FFF"]


def test_lead_lap_gaps_within_two_seconds(solved):
    df = solved.laps
    end = df[df["LapNumber"] == 50].set_index("Driver")["Time"]
    assert abs((end["BBB"] - end["AAA"]) - 12.345) <= 2.0
    assert abs((end["CCC"] - end["AAA"]) - 40.1) <= 2.0
    assert abs(end["AAA"] - 4500.0) < 0.1  # the race time itself


def test_fastest_laps_on_their_laps(solved):
    df = solved.laps.dropna(subset=["LapTime"])
    for c in toy().cars:
        if c.fastest_time is None:
            continue
        mine = df[df["Driver"] == c.driver]
        best = mine.loc[mine["LapTime"].idxmin()]
        assert int(best["LapNumber"]) == c.fastest_lap, c.driver
        assert best["LapTime"] == pytest.approx(c.fastest_time, abs=5e-4)
        assert (mine["LapTime"] > c.fastest_time).sum() == len(mine) - 1  # strictly fastest


def test_retirement_laps_and_events(solved):
    df = solved.laps
    timed = df.dropna(subset=["LapTime"]).groupby("Driver").size()
    assert timed["FFF"] == 47 and timed["HHH"] == 10
    assert "III" not in timed  # out on lap 1: lap 1 untimed, at the start
    (row,) = df[df["Driver"] == "III"].itertuples()
    assert row.LapNumber == 1 and row.Time == 0.0
    retired = {e["driver"] for e in events.retirement_events(df, 50)}
    assert retired == {"FFF", "HHH", "III"}


def test_lapped_cars_are_their_laps_down(solved):
    df = solved.laps
    t_win = float(df[(df["Driver"] == "AAA") & (df["LapNumber"] == 50)]["Time"].iloc[0])
    for code, laps in (("DDD", 49), ("EEE", 49), ("GGG", 48)):
        t = df[df["Driver"] == code].sort_values("LapNumber")["Time"].to_numpy()
        assert len(t) == laps
        assert t[-2] < t_win < t[-1], code  # still racing at the flag, then finishes


def test_unclassified_cars_running_at_the_flag_are_lapped_not_retired():
    # As australia-1986's Tambay (70 of 82 laps) and Berg: running at the end, too few laps
    # to be classified. They must cross the line after the winner, not look retired.
    anchors = toy()
    for code, grid, laps in (("JJJ", 9, 40), ("KKK", 10, 31)):
        anchors.cars.append(
            rc.Car(code, f"T{code}", None, grid, None, False, "lapped", laps, None, 93.0, 20)
        )
    res = rc.reconstruct(anchors)
    assert rc.failures(res.sidecar["anchors"]) == []
    df = res.laps
    t_win = float(df[(df["Driver"] == "AAA") & (df["LapNumber"] == 50)]["Time"].iloc[0])
    for code, laps in (("JJJ", 40), ("KKK", 31)):
        t = df[df["Driver"] == code].sort_values("LapNumber")["Time"].to_numpy()
        assert len(t) == laps
        assert t[-2] < t_win < t[-1], code
    down = {r["subject"]: r for r in res.sidecar["anchors"] if r["anchor"] == "laps down"}
    assert down["JJJ"]["achieved"] == 10 and down["KKK"]["achieved"] == 19
    retired = {e["driver"] for e in events.retirement_events(df, 50)}
    assert not retired & {"JJJ", "KKK"}


def test_a_disqualified_car_ahead_on_the_road_fails_the_order_anchor():
    # As san-marino-1985's Prost: the full distance, no time, out of the classification. To
    # look retired with every lap done he'd be first on the road, heading the race file's
    # realResult, so the order anchor (the classified cars head the road order) fails.
    anchors = toy()
    anchors.cars.append(
        rc.Car("DQQ", "TDQQ", None, 9, None, False, "disqualified", 50, None, None, None)
    )
    res = rc.reconstruct(anchors)
    (order,) = [r for r in res.sidecar["anchors"] if r["anchor"] == "order"]
    assert order["pass"] is False and order["achieved"][0] == "DQQ"
    assert finishing_order(res.laps)[0] == "DQQ"


def test_grid_order_on_lap_one(solved):
    lap1 = solved.laps[solved.laps["LapNumber"] == 1].dropna(subset=["LapTime"])
    order = lap1.sort_values("Time")["Driver"].tolist()
    assert order == ["BBB", "AAA", "DDD", "CCC", "FFF", "EEE", "HHH", "GGG"]  # pit lane last


def test_raw_snapshot_shape(solved):
    df = solved.laps
    assert list(df.columns) == ingest.LAP_COLUMNS
    timed = df.dropna(subset=["LapTime"])
    for _, g in timed.groupby("Driver"):
        g = g.sort_values("LapNumber")
        assert np.allclose(g["LapTime"].cumsum(), g["Time"], atol=1e-6)
    assert set(df["TrackStatus"]) == {"1"}
    assert df["Compound"].isna().all()
    kept, _, _ = clean.clean_laps(df)
    assert len(kept) > 0.5 * len(df)


def test_deterministic_and_seeded():
    a = rc.reconstruct(toy()).laps
    b = rc.reconstruct(toy()).laps
    pd.testing.assert_frame_equal(a, b)
    c = rc.reconstruct(toy(), rc.Params(seed=7))
    assert not a["LapTime"].equals(c.laps["LapTime"])
    assert rc.failures(c.sidecar["anchors"]) == []


def test_real_stops_are_run():
    res = rc.reconstruct(toy(year=1994, stops=True))
    assert rc.failures(res.sidecar["anchors"]) == []
    df = res.laps
    bbb = df[df["Driver"] == "BBB"].set_index("LapNumber")
    assert bbb.loc[18.0, "PitInTime"] == bbb.loc[18.0, "Time"]
    assert bbb.loc[19.0, "Stint"] == 2 and bbb.loc[36.0, "Stint"] == 3
    assert bbb.loc[19.0, "TyreLife"] == 1
    assert bbb.loc[18.0, "Time"] < bbb.loc[19.0, "PitOutTime"] < bbb.loc[19.0, "Time"]
    assert clean.tyre_change_out_laps(df).sum() == 8
    stops = [r for r in res.sidecar["anchors"] if r["anchor"] == "stop"]
    assert len(stops) == 8 and all(r["pass"] for r in stops)


def test_safety_car_laps_and_queue():
    res = rc.reconstruct(toy(year=1993, sc=[(20, 23)]))
    assert rc.failures(res.sidecar["anchors"]) == []
    df = res.laps
    leader = df[df["Position"] == 1].set_index("LapNumber")
    assert sorted(leader.index[leader["TrackStatus"] == "4"].astype(int)) == [20, 21, 22, 23]
    assert [s["status"] for s in res.status] == ["1", "4", "1"]
    # The lead-lap cars queue up behind the safety car.
    end = df[df["LapNumber"] == 23].set_index("Driver")["Time"]
    assert end["BBB"] - end["AAA"] <= 1.0 + 1e-6 or end["AAA"] - end["BBB"] <= 1.0 + 1e-6
    sc_laps = df[df["TrackStatus"] == "4"]["LapTime"]
    assert sc_laps.median() > 1.2 * df[df["TrackStatus"] == "1"]["LapTime"].median()


def test_projection_keeps_total_and_floors():
    model = np.array([90.0, 91.0, 89.0, 95.0])
    floor = np.full(4, 89.5)
    x, ok = rc.project(model, floor, 370.0)
    assert ok and x.sum() == pytest.approx(370.0, abs=1e-9) and (x >= floor - 1e-9).all()
    _, ok = rc.project(model, floor, 300.0)
    assert not ok


# --- Provenance -----------------------------------------------------------------------------


def test_provenance_marks_the_race_reconstructed(solved):
    side = solved.sidecar
    assert side["reconstructed"] is True
    assert side["provenance"] == {
        "kind": "reconstructed",
        "estimated": ["compounds", "fuelLoads", "weather"],  # no SC before 1993
    }
    later = rc.reconstruct(toy(year=1993)).sidecar["provenance"]
    assert "safetyCars" in later["estimated"]  # 1993+, not every SC sourced
    base = json.loads((paths.RACES_DIR / "abu-dhabi-2021.json").read_text())
    marked = rc.mark_model(base, side)
    assert marked["reconstructed"] is True and marked["provenance"]["kind"] == "reconstructed"
    export.validate_model(marked)


def test_report_lists_target_achieved_and_pass(solved, tmp_path):
    written = rc.write("toy-1990", solved, tmp_path)
    assert [p.name for p in written] == [
        "toy-1990.parquet",
        "toy-1990.status.json",
        "toy-1990.reconstruction.json",
        "toy-1990.anchors.md",
    ]
    for row in solved.sidecar["anchors"]:
        assert set(row) == {"anchor", "subject", "target", "achieved", "pass"}
    kinds = {r["anchor"] for r in solved.sidecar["anchors"]}
    assert {"grid", "order", "gap", "fastest", "retirement", "laps down"} <= kinds
    md = (tmp_path / "toy-1990.anchors.md").read_text()
    assert "| fastest | AAA | [88.512, 40] | [88.512, 40] | pass |" in md


# --- Facts files ----------------------------------------------------------------------------


def _facts(tmp_path: Path, race_id: str, facts: dict) -> Path:
    tmp_path.mkdir(parents=True, exist_ok=True)
    (tmp_path / f"{race_id}.json").write_text(json.dumps(facts))
    return tmp_path


def test_facts_need_sources(tmp_path):
    d = _facts(tmp_path, "brazil-1993", {"stops": [{"driver": "X", "lap": 3, "source": ""}]})
    with pytest.raises(ValueError, match="no source"):
        rc.load_facts("brazil-1993", d)
    sc = {"safetyCars": [{"startLap": 2, "endLap": 3, "source": "a report"}]}
    with pytest.raises(ValueError, match="before 1993"):
        rc.load_facts("monaco-1988", _facts(tmp_path, "monaco-1988", sc))
    assert rc.load_facts("brazil-1993", _facts(tmp_path, "brazil-1993", sc))["safetyCars"]
    assert rc.load_facts("nowhere-1990", tmp_path) is None


def test_only_1983_to_1995():
    with pytest.raises(ValueError, match="1983-1995"):
        rc.load_anchors("australia-1996", dump_dir=DUMP)


# --- End to end on the 1994 Australian GP fixture -----------------------------------------


@pytest.fixture(scope="module")
def empty_drivers(tmp_path_factory) -> Path:
    path = tmp_path_factory.mktemp("drivers") / "drivers.json"
    path.write_text(json.dumps({"drivers": {}}))
    return path


@pytest.fixture(scope="module")
def aus94(empty_drivers) -> rc.Anchors:
    return rc.load_anchors(
        "australia-1994",
        dump_dir=DUMP,
        f1db_dir=F1DB,
        facts_dir=FIXTURE,
        drivers_path=empty_drivers,
    )


def test_loads_jolpica_and_f1db_anchors(aus94):
    assert aus94.laps == 81 and len(aus94.cars) == 26
    by = {c.driver: c for c in aus94.cars}
    msc = by["MSC"]  # Jolpica's own code (no drivers.json entry)
    assert (msc.grid, msc.laps, msc.status) == (2, 35, "accident")
    assert (msc.fastest_time, msc.fastest_lap) == (77.14, 29)
    assert [s.lap for s in msc.stops] == [18]
    assert sum(len(c.stops) for c in aus94.cars) == 45
    assert by["mansell"].time == pytest.approx(6471.4)
    assert aus94.stops_complete and not aus94.safety_cars_complete


def test_australia_1994_meets_its_anchors(aus94):
    res = rc.reconstruct(aus94)
    assert rc.failures(res.sidecar["anchors"]) == []
    order = [d for d in finishing_order(res.laps)][:12]
    assert order[:4] == ["mansell", "berger", "brundle", "BAR"]


def test_facts_stops_used_when_f1db_has_none(tmp_path, empty_drivers):
    f1db = tmp_path / "f1db"
    f1db.mkdir()
    (f1db / "australia-1994.fastest-laps.csv").write_text(
        (F1DB / "australia-1994.fastest-laps.csv").read_text()
    )
    facts = {
        "stops": [{"number": 5, "lap": 18, "laneTime": 22.5, "source": "a checked report"}],
        "safetyCars": [{"startLap": 70, "endLap": 72, "source": "a checked report"}],
        "complete": {"stops": False, "safetyCars": True},
    }
    d = _facts(tmp_path / "facts", "australia-1994", facts)
    a = rc.load_anchors(
        "australia-1994", dump_dir=DUMP, f1db_dir=f1db, facts_dir=d, drivers_path=empty_drivers
    )
    assert [(c.driver, s.lap, s.source) for c in a.cars for s in c.stops] == [
        ("MSC", 18, "a checked report")
    ]
    assert a.safety_cars == [rc.SafetyCar(70, 72, "a checked report")]
    res = rc.reconstruct(a)
    assert rc.failures(res.sidecar["anchors"]) == []
    assert "safetyCars" not in res.sidecar["provenance"]["estimated"]


def test_cli_reconstruct(tmp_path):
    out = tmp_path / "raw"
    args = ["reconstruct", "australia-1994", "--dump", str(DUMP), "--raw-dir", str(out)]
    result = CliRunner().invoke(cli.app, [*args, "--facts-dir", str(tmp_path)])
    assert result.exit_code == 0, result.output
    assert "fastest" in result.output and "26/26" in result.output
    assert ingest.raw_snapshot_path("australia-1994", out).exists()
    side = json.loads(rc.sidecar_path("australia-1994", out).read_text())
    assert side["solver"]["passed"] and side["reconstructed"]
    again = CliRunner().invoke(cli.app, args)
    assert "skipped" in again.output


# --- Weather: a wet race's sourced timeline (docs/reconstruction-facts.md) --------------------


def test_timeline_states_ramps_and_cover():
    timeline = [
        {"fromLap": 1, "toLap": 2, "state": "dry", "source": SRC},
        {"fromLap": 3, "toLap": 5, "state": "wet", "toState": "damp", "source": SRC},
        {"fromLap": 6, "toLap": 9, "wetness": 0.7, "source": SRC},
    ]
    w = rc.timeline_wetness(timeline, 8)  # entries past the race's laps are cut
    assert w == [0.0, 0.0, 0.45, 0.3, 0.15, 0.7, 0.7, 0.7]
    with pytest.raises(ValueError, match="doesn't cover"):
        rc.timeline_wetness(timeline, 10)


@pytest.mark.parametrize(
    "weather, why",
    [
        ({"timeline": []}, "empty"),
        ({"timeline": [{"fromLap": 1, "toLap": 3, "state": "wet", "source": ""}]}, "no source"),
        ({"timeline": [{"fromLap": 1, "toLap": 3, "state": "soggy", "source": SRC}]}, "state"),
        ({"timeline": [{"fromLap": 2, "toLap": 3, "state": "wet", "source": SRC}]}, "missing"),
        (
            {
                "timeline": [
                    {"fromLap": 1, "toLap": 3, "state": "wet", "source": SRC},
                    {"fromLap": 3, "toLap": 5, "state": "dry", "source": SRC},
                ]
            },
            "overlapping",
        ),
        (
            {
                "timeline": [{"fromLap": 1, "toLap": 3, "state": "wet", "source": SRC}],
                "startTyre": {"tyre": "wet"},
            },
            "startTyre",
        ),
        (
            {
                "timeline": [{"fromLap": 1, "toLap": 3, "state": "wet", "source": SRC}],
                "tyreChanges": [{"number": 5, "tyre": "wet", "source": SRC}],
            },
            "in-lap",
        ),
    ],
)
def test_weather_facts_are_checked(tmp_path, weather, why):
    d = _facts(tmp_path, "brazil-1993", {"weather": weather})
    with pytest.raises(ValueError, match=why):
        rc.load_facts("brazil-1993", d)


def test_stop_tyre_must_be_a_class(tmp_path):
    stop = {"driver": "X", "lap": 3, "source": SRC, "tyre": "full wet"}
    with pytest.raises(ValueError, match="tyre"):
        rc.load_facts("brazil-1993", _facts(tmp_path, "brazil-1993", {"stops": [stop]}))


def wet_toy() -> rc.Anchors:
    """toy() with rain on laps 16-30 (wet, drying to damp), every car starting on slicks and
    AAA, BBB changing to wets at their first stop (BBB back to slicks at its second)."""
    a = toy(stops=True)
    a.weather_timeline = [
        {"fromLap": 1, "toLap": 15, "state": "dry", "source": SRC},
        {"fromLap": 16, "toLap": 25, "state": "wet", "source": SRC},
        {"fromLap": 26, "toLap": 30, "state": "wet", "toState": "damp", "source": SRC},
        {"fromLap": 31, "toLap": 50, "state": "dry", "source": SRC},
    ]
    a.wetness = rc.timeline_wetness(a.weather_timeline, a.laps)
    a.curves = rc.wet.load_curves()
    for c in a.cars:
        c.start_tyre = "slick"
    aaa, bbb = a.car("AAA"), a.car("BBB")
    aaa.stops = [rc.replace(aaa.stops[0], tyre="wet")]
    bbb.stops = [rc.replace(bbb.stops[0], tyre="wet"), rc.replace(bbb.stops[1], tyre="slick")]
    # The lead-lap times grow by what the rain costs the worst-shod of them (toy()'s are dry;
    # the gaps are kept).
    lead = [c for c in a.cars if c.time is not None]
    extra = max(
        float(
            (
                rc.features(c, a.laps, False, 24.0, rc.Params(), None, a.wetness, a.curves).mult - 1
            ).sum()
        )
        for c in lead
    )
    for c in lead:
        c.time += extra * 89.0
    return a


@pytest.fixture(scope="module")
def wet_solved() -> rc.Result:
    return rc.reconstruct(wet_toy())


def test_wet_race_meets_its_anchors(wet_solved):
    assert rc.failures(wet_solved.sidecar["anchors"]) == []
    tyre = [r for r in wet_solved.sidecar["anchors"] if r["anchor"] == "tyre"]
    assert tyre and all(r["pass"] for r in tyre)


def test_wet_laps_take_the_weather_models_pace(wet_solved):
    """A wet lap is the car's dry lap x (1 + its tyre's penalty at the lap's wetness)."""
    a = wet_toy()
    df = wet_solved.laps
    ccc = df[df["Driver"] == "CCC"].set_index("LapNumber")["LapTime"]  # slicks all race
    pace = wet_solved.sidecar["fitted"]["CCC"]["pace"]
    slick_wet = float(rc.wet.penalty(a.curves, "SOFT", 0.45))
    # Mid-rain against mid-dry green laps (the fastest lap, 12, aside): the rain costs the
    # dry lap x the penalty, give or take the noise, fuel and wear (the projection to the
    # total adds the same to every lap, so it cancels).
    rain, dry = ccc.loc[17.0:24.0].mean(), ccc.loc[[5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0]].mean()
    assert rain - dry == pytest.approx(pace * slick_wet, abs=2.0)
    f = rc.features(a.car("CCC"), a.laps, False, 24.0, rc.Params(), None, a.wetness, a.curves)
    assert f.mult[17] == pytest.approx(1 + slick_wet) and f.mult[5] == 1.0
    # Slicks barely wear in the rain (wet.wear_mult): wear before lap 25 is 15 dry laps + 9 x 0.2.
    assert f.wear[24] == pytest.approx(15 + 9 * 0.2)


def test_wet_stints_carry_their_compounds(wet_solved):
    df = wet_solved.laps
    bbb = df[df["Driver"] == "BBB"].set_index("LapNumber")["Compound"]
    assert bbb.loc[10.0] is None and bbb.loc[25.0] == "WET" and bbb.loc[40.0] is None
    aaa = df[df["Driver"] == "AAA"].set_index("LapNumber")["Compound"]
    assert set(aaa.loc[21.0:]) == {"WET"}
    tyres = wet_solved.sidecar["weather"]["tyres"]
    assert {"driver": "BBB", "stint": 2, "tyre": "wet", "by": "source"} in tyres


def test_unsourced_stint_takes_the_tyre_that_suits_it():
    a = wet_toy()
    car = a.car("DDD")  # one stop at lap 22, no tyre named: stint 2 is laps 23-49
    car.stops = [rc.replace(car.stops[0], lap=17)]
    a2 = rc.Anchors(**{**a.__dict__})
    tyres = rc.stint_tyres(car, a2.wetness, a2.curves)
    assert tyres[0] == ("slick", True)
    assert tyres[1] == ("slick", False)  # laps 18-49: mostly dry
    wet_only = [0.45] * 50
    car.stops = [rc.replace(car.stops[0], lap=17)]
    car.start_tyre = None
    assert rc.stint_tyres(car, wet_only, a2.curves) == [("wet", False), ("wet", False)]


def test_wet_race_weather_records_and_sidecar(wet_solved, tmp_path):
    rec = wet_solved.weather
    assert [r["lap"] for r in rec] == list(range(1, 51))
    assert {r["lap"] for r in rec if r["rain"]} == set(range(16, 31))
    assert all(r["source"] == rc.WEATHER_SOURCE and r["time"] for r in rec)
    side = wet_solved.sidecar
    assert "weather" in side["provenance"]["estimated"]
    assert side["weather"]["wetness"][17] == 0.45
    assert any("Wet laps" in e for e in side["estimates"])
    paths = rc.write("toy-1990", wet_solved, tmp_path)
    assert ingest.weather_path("toy-1990", tmp_path) in paths
    # The build reads the records as a wet race's rain laps.
    loaded = ingest.load_weather("toy-1990", tmp_path)
    from pipeline import wet

    assert wet.rain_laps(wet_solved.laps, loaded) == set(range(16, 31))
    assert wet.is_wet_race(wet_solved.laps, loaded)
    # A dry rerun removes the reconstruction's own records.
    rc.write("toy-1990", rc.reconstruct(toy()), tmp_path)
    assert not ingest.weather_path("toy-1990", tmp_path).exists()


def test_dry_race_is_unchanged_by_the_weather_terms(solved):
    assert solved.weather is None and "weather" not in solved.sidecar
    assert solved.laps["Compound"].isna().all()
    assert not any(r["anchor"] == "tyre" for r in solved.sidecar["anchors"])


def test_tyre_changes_label_f1db_stops(tmp_path, empty_drivers):
    first = pd.read_csv(F1DB / "australia-1994.stops.csv").iloc[1]  # Blundell, lap 14
    facts = {
        "weather": {
            "timeline": [{"fromLap": 1, "toLap": 81, "state": "dry", "source": SRC}],
            "startTyre": {"tyre": "slick", "source": SRC},
            "tyreChanges": [
                {
                    "number": int(first["number"]),
                    "lap": int(first["lap"]),
                    "tyre": "wet",
                    "source": SRC,
                },
                {"number": int(first["number"]), "lap": 3, "tyre": "wet", "source": SRC},
            ],
        }
    }
    d = _facts(tmp_path, "australia-1994", facts)
    a = rc.load_anchors(
        "australia-1994", dump_dir=DUMP, f1db_dir=F1DB, facts_dir=d, drivers_path=empty_drivers
    )
    car = next(c for c in a.cars if c.number == int(first["number"]))
    assert [s.tyre for s in car.stops if s.lap == int(first["lap"])] == ["wet"]
    assert any("no stop on lap 3" in n for n in a.notes)
    assert a.wetness == [0.0] * a.laps


# --- A disqualified car placed on the road (facts roadPositions) ---------------------------


def _dsq_toy(position: int, gap: float | None) -> rc.Anchors:
    """toy() plus a car that ran the full distance and was disqualified (no time, out of the
    classification, as monaco-1984's Bellof), placed on the road by a source."""
    anchors = toy()
    anchors.cars.append(
        rc.Car("DQQ", "TDQQ", None, 9, None, False, "disqualified", 50, None, 88.6, 30)
    )
    winner = anchors.car("AAA")
    item = {"driver": "DQQ", "position": position, "gap": gap, "source": SRC}
    anchors.notes += rc.apply_road_positions(anchors.cars, [item], winner)
    return anchors


def test_a_disqualified_car_with_a_sourced_gap_runs_at_its_road_place():
    anchors = _dsq_toy(2, 5.0)
    dqq = anchors.car("DQQ")
    assert dqq.finished and not dqq.classified and dqq.time == pytest.approx(4505.0)
    assert rc.road_order(anchors)[:4] == ["AAA", "DQQ", "BBB", "CCC"]
    res = rc.reconstruct(anchors)
    assert rc.failures(res.sidecar["anchors"]) == []
    assert finishing_order(res.laps)[:4] == ["AAA", "DQQ", "BBB", "CCC"]
    rows = {(r["anchor"], r["subject"]): r for r in res.sidecar["anchors"]}
    assert rows[("gap", "DQQ")]["target"] == 5.0 and rows[("gap", "DQQ")]["pass"]
    assert not [
        r for r in res.sidecar["anchors"] if r["subject"] == "DQQ" and "retire" in r["anchor"]
    ]
    assert "DQQ" not in {e["driver"] for e in events.retirement_events(res.laps, 50)}
    # The official result keeps it out: the sidecar says so for the build.
    assert "DQQ" not in res.sidecar["classified"]
    (placed,) = res.sidecar["roadPositions"]
    assert placed == {
        "driver": "DQQ",
        "position": 2,
        "gap": 5.0,
        "gapSourced": True,
        "source": SRC,
    }
    assert any("DQQ: disqualified, run to the flag P2" in e for e in res.sidecar["estimates"])


def test_a_disqualified_car_with_no_gap_sits_between_its_road_neighbours():
    anchors = _dsq_toy(3, None)  # between BBB (+12.345) and CCC (+40.1)
    res = rc.reconstruct(anchors)
    assert rc.failures(res.sidecar["anchors"]) == []
    end = res.laps[res.laps["LapNumber"] == 50].set_index("Driver")["Time"]
    assert end["BBB"] < end["DQQ"] < end["CCC"]
    assert end["DQQ"] - end["AAA"] == pytest.approx((12.345 + 40.1) / 2, abs=0.5)
    assert finishing_order(res.laps)[:4] == ["AAA", "BBB", "DQQ", "CCC"]
    (placed,) = res.sidecar["roadPositions"]
    assert placed["gap"] is None and placed["gapSourced"] is False
    assert any("no gap sourced: an estimate" in n for n in res.sidecar["notes"])


def test_a_road_place_is_only_for_a_disqualified_car():
    anchors = toy()
    winner = anchors.car("AAA")
    src = {"source": SRC, "position": 2}
    with pytest.raises(ValueError, match="not disqualified"):
        rc.apply_road_positions(anchors.cars, [{**src, "driver": "BBB"}], winner)
    with pytest.raises(ValueError, match="no car"):
        rc.apply_road_positions(anchors.cars, [{**src, "driver": "ZZZ"}], winner)
    anchors.cars.append(rc.Car("DQQ", "T", None, 9, None, False, "disqualified", 48, None))
    with pytest.raises(ValueError, match="lead lap"):
        rc.apply_road_positions(anchors.cars, [{**src, "driver": "DQQ", "gap": 3.0}], winner)


@pytest.mark.parametrize(
    ("item", "why"),
    [
        ({"driver": "X", "position": 3, "gap": 1.0, "source": ""}, "no source"),
        ({"position": 3, "source": SRC}, "driver or number"),
        ({"driver": "X", "position": 0, "source": SRC}, "road place"),
        ({"driver": "X", "position": "3", "source": SRC}, "road place"),
        ({"driver": "X", "position": 3, "gap": -1.0, "source": SRC}, "seconds behind"),
    ],
)
def test_road_positions_are_checked(tmp_path, item, why):
    d = _facts(tmp_path, "monaco-1984", {"roadPositions": [item]})
    with pytest.raises(ValueError, match=why):
        rc.load_facts("monaco-1984", d)


def test_a_wet_race_car_out_on_lap_one_keeps_its_start_tyre():
    # Its untimed lap would otherwise be filled with the dry compound (a one-lap dry stint).
    a = wet_toy()
    a.car("III").start_tyre = "wet"
    df = rc.reconstruct(a).laps
    (row,) = df[df["Driver"] == "III"].itertuples()
    assert row.Compound == "WET" and pd.isna(row.LapTime)
