"""Red flags (eras build plan 4.3): restart rules, the red-flag file, events from timing, red-flag
stop losses and the reference sim's replay. Offline: synthetic laps and the Zandvoort 2023
fixture (packages/sim/tests/fixtures, made by tests/make_redflag_fixture.py)."""

from __future__ import annotations

import json

import pandas as pd
import pytest

from pipeline import events, ingest, redflag, sim_reference
from tests.make_redflag_fixture import GOLDEN, MODEL, golden, variants

GREEN = 90.0


def _laps(statuses: dict[int, str], times: dict[int, float], n_laps: int = 10) -> pd.DataFrame:
    """Three cars a second apart; lap n's leader lap takes times.get(n, GREEN) seconds."""
    rows = []
    for i, code in enumerate(("AAA", "BBB", "CCC")):
        t = 0.0
        for n in range(1, n_laps + 1):
            lap = times.get(n, GREEN)
            t += lap
            rows.append(
                {
                    "Driver": code,
                    "Team": f"T{i}",
                    "LapNumber": float(n),
                    "LapTime": lap,
                    "Time": t + i,
                    "Compound": "MEDIUM",
                    "TyreLife": float(n),
                    "Stint": 1.0,
                    "PitInTime": None,
                    "PitOutTime": None,
                    "TrackStatus": statuses.get(n, "1"),
                    "Position": float(i + 1),
                    "IsAccurate": True,
                }
            )
    return pd.DataFrame(rows)


# --- restart rules -----------------------------------------------------------------------


def test_restart_rules_by_year_with_sources():
    assert redflag.default_restart(2023) == "standing"
    assert redflag.default_restart(2020) == "standing"
    assert redflag.default_restart(2017) == "rolling"
    assert redflag.default_restart(2005) == "rolling"
    for year in (2018, 2004, 1998, 1984):  # mid-season rule change / the old procedure
        with pytest.raises(redflag.RedFlagError):
            redflag.default_restart(year)
    for *_, source in redflag.RESTART_RULES:
        assert "Sporting Regulations" in source and "http" in source


def test_restart_constants_match_the_sim():
    assert redflag.BUNCH_GAP == sim_reference.BUNCH_GAP


# --- the red-flag file --------------------------------------------------------------------

ZANDVOORT_RC = [
    {"date": "2023-08-27T14:31:16", "lap_number": 64, "flag": "RED", "message": "RED FLAG"},
    {"date": "2023-08-27T14:38:09", "lap_number": 65, "flag": None, "message": "ORDER FOR..."},
    {
        "date": "2023-08-27T15:07:08",
        "lap_number": 65,
        "flag": None,
        "message": "RACE WILL RESUME AT 17:14 - ROLLING START PROCEDURE",
    },
    {"date": "2023-08-27T15:27:08", "lap_number": 72, "flag": "CHEQUERED", "message": "FLAG"},
]


def test_restart_read_from_race_control():
    [entry] = redflag.restarts_from_messages(ZANDVOORT_RC, "OpenF1")
    assert entry["lap"] == 64 and entry["restart"] == "rolling"
    assert entry["source"].startswith("OpenF1 race control") and "ROLLING START" in entry["source"]
    standing = [
        {**ZANDVOORT_RC[0]},
        {"date": "2023-08-27T15:00:00", "flag": None, "message": "STANDING START PROCEDURE"},
    ]
    assert redflag.restarts_from_messages(standing)[0]["restart"] == "standing"


def test_never_resumed_and_unsaid_restarts():
    over = [ZANDVOORT_RC[0], ZANDVOORT_RC[-1]]
    assert redflag.restarts_from_messages(over)[0]["restart"] == "none"
    # Resumed with no word on how: left to the year's rule.
    unsaid = [ZANDVOORT_RC[0], {**ZANDVOORT_RC[2], "message": "RACE WILL RESUME AT 17:14"}]
    assert redflag.restarts_from_messages([*unsaid, ZANDVOORT_RC[-1]]) == []


@pytest.mark.parametrize(
    "entry",
    [
        {"lap": 22, "restart": "rolling"},  # no source
        {"lap": 22, "restart": "rolling", "source": " "},
        {"lap": 22, "restart": "flying", "source": "x"},
        {"lap": 0, "restart": "rolling", "source": "x"},
        {"lap": 22, "resumeLap": 21, "restart": "rolling", "source": "x"},
        {"lap": 22, "restart": "rolling", "restartScLaps": -1, "source": "x"},
    ],
)
def test_bad_entries_are_refused(entry):
    with pytest.raises(redflag.RedFlagError):
        redflag.validate_entries([entry])


def test_hand_entered_file_wins_over_the_ingest_one(tmp_path):
    raw, hand = tmp_path / "raw", tmp_path / "hand"
    raw.mkdir()
    hand.mkdir()
    ingest.save_red_flags("x-2023", ZANDVOORT_RC, "OpenF1", raw)
    assert redflag.load_entries("x-2023", raw, hand)[0]["restart"] == "rolling"
    entry = {"lap": 64, "restart": "standing", "source": "a person, checked"}
    (hand / "x-2023.json").write_text(json.dumps({"race": "x-2023", "redFlags": [entry]}))
    assert redflag.load_entries("x-2023", raw, hand) == [entry]
    assert redflag.load_entries("none-2023", raw, hand) == []
    assert ingest.save_red_flags("y-2023", [], "OpenF1", raw) is None


# --- events from timing --------------------------------------------------------------------


def test_red_flag_runs_to_its_stoppage_and_the_restart_sc_follows():
    # OpenF1-style: red shown on lap 5, lap 6 holds the 40-minute stoppage, lap 7 behind the
    # SC, green from lap 8 (Zandvoort 2023 laps 64-67).
    laps = _laps({5: "265", 6: "51"}, {5: 140.0, 6: 2400.0, 7: 140.0})
    evs = [e for e in events.extract_events(laps) if e["type"] != "RETIREMENT"]
    assert evs == [{"lap": 5, "type": "RED", "laps": 2}, {"lap": 7, "type": "SC", "laps": 1}]


def test_stoppage_found_by_time_when_the_status_has_cleared():
    # FastF1-style (Hungary 2021): only the red lap carries the code; the stoppage lap is '1'.
    laps = _laps({2: "45"}, {2: 170.0, 3: 1600.0})
    evs = events.neutralization_events(laps)
    assert redflag.refine_events(laps, evs) == [{"lap": 2, "type": "RED", "laps": 2}]


def test_race_not_resumed_red_runs_to_the_flag():
    laps = _laps({9: "15", 10: "5"}, {9: 140.0, 10: 140.0})
    assert redflag.refine_events(laps, events.neutralization_events(laps)) == [
        {"lap": 9, "type": "RED", "laps": 2}
    ]


def test_no_red_flag_unchanged():
    laps = _laps({4: "4", 5: "4"}, {4: 130.0, 5: 130.0})
    evs = events.neutralization_events(laps)
    assert redflag.refine_events(laps, evs) is evs


def test_hand_entries_mark_untimed_laps_and_set_the_span():
    # TUM / Jolpica: no red-flag timing at all.
    laps = _laps({}, {})
    entry = {"lap": 4, "resumeLap": 5, "restart": "rolling", "restartScLaps": 2, "source": "x"}
    marked = redflag.mark_hand_entries(laps, [entry])
    assert set(marked[marked["LapNumber"].isin([4, 5])]["TrackStatus"]) == {"5"}
    assert set(marked[~marked["LapNumber"].isin([4, 5])]["TrackStatus"]) == {"1"}
    evs = redflag.apply_hand_spans(events.neutralization_events(marked), [entry])
    assert evs == [{"lap": 4, "type": "RED", "laps": 2}, {"lap": 6, "type": "SC", "laps": 2}]
    timed = {"lap": 4, "restart": "rolling", "source": "x"}
    assert redflag.mark_hand_entries(laps, [timed]) is laps


def test_restarts_annotated_from_file_or_year():
    evs = [{"lap": 5, "type": "RED", "laps": 2}, {"lap": 7, "type": "SC", "laps": 1}]
    assert redflag.annotate_restarts(evs, [], 2021)[0]["restart"] == "standing"
    assert redflag.annotate_restarts(evs, [], 2011)[0]["restart"] == "rolling"
    entry = {"lap": 5, "restart": "rolling", "source": "race control"}
    assert redflag.annotate_restarts(evs, [entry], 2021)[0]["restart"] == "rolling"
    none = {"lap": 5, "restart": "none", "source": "results from lap 3"}
    assert "restart" not in redflag.annotate_restarts(evs, [none], 2021)[0]
    with pytest.raises(redflag.RedFlagError):
        redflag.annotate_restarts(evs, [{**entry, "lap": 6}], 2021)  # matches no red flag
    with pytest.raises(redflag.RedFlagError):
        redflag.annotate_restarts(evs, [], 1998)  # no rule: needs a file entry


def test_red_flag_stop_losses():
    # Red shown during lap 5 (session time ~455s), stoppage on lap 6. AAA boxed at the end of
    # lap 4 under a SC (paid, SC figure); BBB entered after the red flag (free); CCC changed
    # tyres in the stoppage (out-lap 6: free).
    laps = _laps({4: "4", 5: "45", 6: "51"}, {5: 140.0, 6: 2400.0})
    stint = {("AAA", 5): 2.0, ("BBB", 5): 2.0, ("CCC", 6): 2.0}
    pit_in = {("AAA", 4): 355.0, ("BBB", 4): 470.0, ("CCC", 5): 600.0}

    def fix(r):
        key = (r["Driver"], int(r["LapNumber"]))
        out = (r["Driver"], int(r["LapNumber"]) - 1)
        r["PitInTime"] = pit_in.get(key)
        r["PitOutTime"] = r["Time"] if out in pit_in else None
        later = [v for (d, n), v in stint.items() if d == r["Driver"] and n <= r["LapNumber"]]
        if later:
            r["Stint"], r["Compound"] = 2.0, "HARD"
            r["TyreLife"] = r["LapNumber"] - min(n for (d, n) in stint if d == r["Driver"]) + 1.0
        return r

    laps = laps.apply(fix, axis=1)
    status = [
        {"time": 0.0, "status": "1"},
        {"time": 300.0, "status": "4"},
        {"time": 455.0, "status": "5"},
        {"time": 3000.0, "status": "1"},
    ]
    evs = redflag.refine_events(laps, events.neutralization_events(laps))
    got = redflag.stop_losses(laps, evs, status, 20.0, 11.0, 14.0)
    assert got == {("AAA", 5): 11.0, ("BBB", 5): 0.0, ("CCC", 6): 0.0}


def _pit_lane_pass(drivers: set[str]) -> pd.DataFrame:
    """No timing (a Jolpica race): red flag on laps 6-7; `drivers` enter the pits on lap 5
    (out-lap 6, the first red lap) and change tyres in the stoppage (out-lap 7)."""
    laps = _laps({}, {6: 1500.0, 7: 900.0})

    def fix(r):
        lap = int(r["LapNumber"])
        if r["Driver"] in drivers:
            r["PitInTime"] = r["Time"] if lap in (5, 6) else None
            r["PitOutTime"] = r["Time"] if lap in (6, 7) else None
            if lap >= 6:
                r["Stint"] = 2.0 if lap == 6 else 3.0
                r["Compound"] = "HARD" if lap == 6 else "SOFT"
                r["TyreLife"] = 1.0
        return r

    return laps.apply(fix, axis=1)


def test_a_pit_lane_pass_costs_nothing_in_an_eras_build():
    evs = [{"lap": 6, "type": "RED", "laps": 2, "restart": "standing"}]
    # Every car through the pit lane into the red flag (Baku 2021): free in an Eras build.
    laps = _pit_lane_pass({"AAA", "BBB", "CCC"})
    assert redflag.stop_losses(laps, evs, None, 20.0, 11.0, 14.0) == {
        **{(d, 6): 20.0 for d in ("AAA", "BBB", "CCC")},
        **{(d, 7): 0.0 for d in ("AAA", "BBB", "CCC")},
    }
    eras = redflag.stop_losses(laps, evs, None, 20.0, 11.0, 14.0, eras=True)
    assert eras == {(d, n): 0.0 for d in ("AAA", "BBB", "CCC") for n in (6, 7)}
    # Two cars of three (under FIELD_PIT_SHARE): real stops, priced as before.
    laps = _pit_lane_pass({"AAA", "BBB"})
    assert redflag.FIELD_PIT_SHARE > 2 / 3
    got = redflag.stop_losses(laps, evs, None, 20.0, 11.0, 14.0, eras=True)
    assert got[("AAA", 6)] == got[("BBB", 6)] == 20.0


# --- the reference sim ------------------------------------------------------------------------


def test_plan():
    evs = [{"lap": 5, "type": "RED", "laps": 2, "restart": "rolling"}]
    assert redflag.plan(evs) == {"free": {6: 5}, "wipes": {6: (0.5, 5)}}
    standing = [{**evs[0], "restart": "standing"}, {"lap": 7, "type": "SC", "laps": 2}]
    assert redflag.plan(standing) == {"free": {6: 5}, "wipes": {6: (0.5, 5), 8: (0.74, 5)}}
    # An Eras race: a standing restart is spaced at the end of its first racing lap.
    assert redflag.plan(standing, eras=True)["wipes"] == {6: (0.5, 5), 9: (0.74, 5)}
    assert redflag.plan(evs, eras=True) == redflag.plan(evs)  # rolling: unchanged
    assert redflag.plan([{"lap": 5, "type": "RED", "laps": 2}]) == {"free": {}, "wipes": {}}
    assert redflag.plan([{"lap": 5, "type": "SC", "laps": 2}]) == {"free": {}, "wipes": {}}
    # Stopped on the grid on the flag lap (one red lap): the stoppage's change is free on the
    # lap after it (every 2007-11 red flag).
    grid = [{"lap": 72, "type": "RED", "laps": 1, "restart": "rolling"}]
    assert redflag.plan(grid)["free"] == {73: 72}
    assert redflag.is_free(redflag.plan(grid), {72: "RED"}, 73)
    assert not redflag.is_free(redflag.plan(grid), {}, 73)  # a run that doesn't know the flag


def test_line_up_no_unlapping_keeps_road_order():
    from types import SimpleNamespace as Car

    # Lap 100 s. B is on the lead lap 30 s back; L is a lap down, 10 s behind A on the road.
    cars = {"A": Car(total_time=0.0), "B": Car(total_time=30.0), "L": Car(total_time=110.0)}
    redflag.line_up(["A", "B", "L"], cars, 0.5, 100.0)
    assert cars["L"].total_time == pytest.approx(100.5)
    assert cars["B"].total_time == pytest.approx(1.0)
    cars = {"A": Car(total_time=0.0), "B": Car(total_time=30.0), "L": Car(total_time=110.0)}
    redflag.line_up(["A", "B", "L"], cars, 0.5)
    assert cars["L"].total_time == pytest.approx(1.0)


def test_fixture_golden_is_current():
    """The TS parity fixture matches today's reference sim (else run make_redflag_fixture)."""
    fresh = json.loads(json.dumps(golden(json.loads(MODEL.read_text()))))
    assert json.loads(GOLDEN.read_text()) == fresh


def test_gaps_wiped_at_the_restart():
    model = json.loads(MODEL.read_text())
    red = next(e for e in model["events"] if e["type"] == "RED")
    assert red == {"lap": 64, "type": "RED", "laps": 2, "restart": "rolling"}
    # Truncated at the stoppage lap: everyone running sits BUNCH_GAP apart.
    short = {**model, "race": {**model["race"], "laps": 65}}
    res = sim_reference.simulate(short, 1)
    gaps = [res["gaps"][c] for c in res["finishers"]]
    assert gaps == pytest.approx([0.5 * i for i in range(len(gaps))])
    # Standing: spread at the end of the SC lap after it.
    standing = variants(model)["standing"]
    res = sim_reference.simulate({**standing, "race": {**standing["race"], "laps": 66}}, 1)
    gaps = [res["gaps"][c] for c in res["finishers"]]
    assert gaps == pytest.approx([0.74 * i for i in range(len(gaps))])
    # An Eras race: still the queue after the SC lap; spread at the end of the racing lap.
    eras = variants(model)["standing-eras"]
    res = sim_reference.simulate({**eras, "race": {**eras["race"], "laps": 66}}, 1)
    gaps = [res["gaps"][c] for c in res["finishers"]]
    assert gaps == pytest.approx([0.5 * i for i in range(len(gaps))])
    res = sim_reference.simulate({**eras, "race": {**eras["race"], "laps": 67}}, 1)
    gaps = [res["gaps"][c] for c in res["finishers"]]
    assert gaps == pytest.approx([0.74 * i for i in range(len(gaps))])


def test_an_sc_pickup_lets_the_cars_ahead_run_on():
    model = variants(json.loads(MODEL.read_text()))["sc-pickup"]
    without = json.loads(json.dumps(model))
    for e in without["events"]:
        e.pop("pickup", None)

    def lead(m: dict, laps: int) -> float:
        t = sim_reference.simulate({**m, "race": {**m["race"], "laps": laps}}, 1)["times"]
        return t["ALO"] - t["PER"]

    assert lead(model, 68) > lead(without, 68) + 15  # PER ran a racing lap, ALO the SC's
    assert lead(model, 69) == pytest.approx(lead(model, 68))  # kept on the next lap
    assert sim_reference.sc_front(["A", "B", "C"], {}, None) == set()
    assert sim_reference.queue_behind(["A", "B", "C"], "B") == ["B", "C"]
    assert sim_reference.queue_behind(["A", "B", "C"], "X") == ["A", "B", "C"]


def test_a_stop_in_the_stoppage_is_free():
    v = variants(json.loads(MODEL.read_text()))
    cut = {"laps": 65}
    base = sim_reference.simulate({**v["standing"], "race": {**v["standing"]["race"], **cut}}, 3)
    extra = v["standing-free-stop"]
    res = sim_reference.simulate({**extra, "race": {**extra["race"], **cut}}, 3)
    assert res["order"] == base["order"] and res["gaps"] == base["gaps"]


# --- with Legend and car faults ---------------------------------------------------------------


def test_legend_keeps_the_red_flag_and_its_restart_sc():
    from pipeline.legend import legend_events

    model = json.loads(MODEL.read_text())
    for seed in range(1, 21):
        evs = legend_events(model, seed)
        assert {"lap": 64, "type": "RED", "laps": 2, "restart": "rolling"} in evs
        assert {"lap": 66, "type": "SC", "laps": 1} in evs
        # Nothing drawn inside or straight after the red flag.
        drawn = [e for e in evs if e["type"] in ("SC", "VSC") and e["lap"] != 66]
        assert all(not (63 <= e["lap"] <= 67) for e in drawn)


def test_faults_cost_nothing_on_red_laps():
    v = variants(json.loads(MODEL.read_text()))

    def ver_time(model: dict, laps: int) -> float:
        return sim_reference.simulate({**model, "race": {**model["race"], "laps": laps}}, 1)[
            "times"
        ]["VER"]

    # VER leads by far: his 1.5s/lap power loss shows on green laps 62-63 only, not on the
    # red lap 64.
    assert ver_time(v["faults"], 63) - ver_time(v["rolling"], 63) == pytest.approx(3.0)
    assert ver_time(v["faults"], 64) - ver_time(v["rolling"], 64) == pytest.approx(3.0)


# --- red flags that leave no red lap (Brazil 2003, Monaco 1984, Belgium 1998) -------------------

BRAZIL_2003 = {"lap": 56, "restart": "none", "resultsLap": 54, "source": "the FIA ruling"}
BELGIUM_1998 = {"lap": 1, "restart": "standing", "source": "a full restart over the distance"}


def _assembled(laps: pd.DataFrame, entries: list[dict], year: int) -> tuple[list, list]:
    """The race file's events and classification for a red-flag file, as build_race and
    assemble_race_model make them."""
    from pipeline.assemble import finishing_order

    laps = redflag.cut_at_results(laps, entries)
    laps, kept, _ = redflag.race_entries(laps, entries, year)
    evs = events.neutralization_events(laps)
    if any(e["type"] == "RED" for e in evs) or kept:
        evs = redflag.annotate_restarts(redflag.apply_hand_spans(evs, kept), kept, year)
    return evs, finishing_order(laps)


def test_a_race_ended_under_red_ends_at_its_results_lap():
    # Jolpica-style: no red-flag timing. The data runs to lap 55 (one car's lap past the
    # results); BBB passed AAA on lap 55, which doesn't count.
    laps = _laps({}, {}, n_laps=55)
    late = (laps["Driver"] == "BBB") & (laps["LapNumber"] == 55)
    laps.loc[late, "Time"] -= 2.0
    evs, order = _assembled(laps, [BRAZIL_2003], 2003)
    assert evs == []  # no RED event: the red flag came after the results lap
    assert order == ["AAA", "BBB", "CCC"]  # the order at the end of lap 54
    cut = redflag.cut_at_results(laps, [BRAZIL_2003])
    assert int(cut["LapNumber"].max()) == 54 and len(cut) == 3 * 54
    # Data that holds exactly the classified distance (Jolpica's 54 laps) is left alone.
    exact = _laps({}, {}, n_laps=54)
    assert redflag.cut_at_results(exact, [BRAZIL_2003]) is exact
    # Data that stops before the results lap doesn't match the facts.
    with pytest.raises(redflag.RedFlagError, match="lap 54"):
        redflag.cut_at_results(_laps({}, {}, n_laps=50), [BRAZIL_2003])


def test_a_timed_race_ended_under_red_loses_its_red_laps():
    # A source with red-flag timing: laps 55-56 carry the red status; they're after the cut.
    laps = _laps({55: "15", 56: "5"}, {55: 140.0, 56: 140.0}, n_laps=56)
    evs, _ = _assembled(laps, [BRAZIL_2003], 2003)
    assert evs == []


def test_a_voided_start_is_a_fresh_race():
    # Jolpica holds only the rerun (no red lap); laps 1-2 of it ran behind the SC.
    laps = _laps({}, {1: 130.0, 2: 130.0}, n_laps=44)
    evs, order = _assembled(laps, [BELGIUM_1998], 1998)
    assert evs == []  # no RED event, no restart
    assert order == ["AAA", "BBB", "CCC"]
    with_sc = {**BELGIUM_1998, "restartScLaps": 2}
    evs, _ = _assembled(laps, [with_sc], 1998)
    assert evs == [{"lap": 1, "type": "SC", "laps": 2}]
    _, kept, notes = redflag.race_entries(laps, [with_sc], 1998)
    assert kept == [] and "start voided" in notes[0] and "laps 1-2" in notes[0]
    # An SC already estimated on those laps isn't doubled.
    est = _laps({1: "4", 2: "4"}, {}, n_laps=44)
    marked, _, _ = redflag.race_entries(est, [with_sc], 1998)
    assert set(marked[marked["LapNumber"] <= 2]["TrackStatus"]) == {"4"}


def test_a_voided_start_needs_the_old_rules():
    laps = _laps({}, {}, n_laps=44)
    # From 2005 a lap-1 red flag is a suspension: an untimed one needs its resumeLap.
    with pytest.raises(redflag.RedFlagError, match="match no red flag"):
        _assembled(laps, [BELGIUM_1998], 2005)
    # A red flag after the first two laps, or one never resumed, isn't a voided start.
    assert not redflag.is_voided_start({**BELGIUM_1998, "lap": 3}, 1998)
    assert not redflag.is_voided_start({**BELGIUM_1998, "restart": "none"}, 1998)
    assert not redflag.is_voided_start({**BELGIUM_1998, "resumeLap": 2}, 1998)
    assert not redflag.is_voided_start(BELGIUM_1998, None)
    assert redflag.is_voided_start(BELGIUM_1998, 1998)


def test_other_red_flags_still_go_through():
    laps = _laps({}, {}, n_laps=10)
    entry = {"lap": 4, "resumeLap": 5, "restart": "rolling", "source": "x"}
    marked, kept, notes = redflag.race_entries(laps, [entry], 2011)
    assert kept == [entry] and notes == []
    assert set(marked[marked["LapNumber"].isin([4, 5])]["TrackStatus"]) == {"5"}
    assert redflag.cut_at_results(laps, [entry]) is laps


@pytest.mark.parametrize(
    "entries",
    [
        [{**BRAZIL_2003, "restart": "rolling"}],  # results lap on a resumed race
        [{**BRAZIL_2003, "resultsLap": 56}],  # results lap not before the flag
        [{**BRAZIL_2003, "resultsLap": 0}],
        [{**BRAZIL_2003, "resumeLap": 57}],
        [BRAZIL_2003, {"lap": 60, "restart": "rolling", "source": "x"}],  # not the last
    ],
)
def test_bad_results_laps_are_refused(entries):
    with pytest.raises(redflag.RedFlagError):
        redflag.validate_entries(entries)


@pytest.mark.parametrize("race_id", ["brazil-2003", "monaco-1984", "belgium-1998"])
def test_the_three_untimed_files_need_no_red_lap(race_id):
    """The R1 files that couldn't load: their entries leave the race file without a RED event."""
    entries = redflag.load_entries(race_id, raw_dir=redflag.REDFLAGS_DIR / "_none")
    body = json.loads((redflag.REDFLAGS_DIR / f"{race_id}.json").read_text())
    laps = _laps({}, {}, n_laps=body["completedLaps"])
    evs, _ = _assembled(laps, entries, int(race_id.rsplit("-", 1)[1]))
    assert not [e for e in evs if e["type"] == "RED"]


def test_build_ends_a_race_at_its_results_lap(monkeypatch, tmp_path):
    """build_race with a red-flag file ending Abu Dhabi 2021 under red (a made-up entry): the
    race file is 48 laps long, with the order at the end of lap 48 and no RED event."""
    from pipeline import build
    from pipeline.assemble import finishing_order

    entry = {"lap": 50, "restart": "none", "resultsLap": 48, "source": "test"}
    monkeypatch.setattr(redflag, "load_entries", lambda *a, **k: [entry])
    result = build.build_race("abu-dhabi-2021", eras_dir=tmp_path)
    assert result.model["race"]["laps"] == 48
    assert int(result.laps["LapNumber"].max()) == 48
    assert result.model["realResult"] == finishing_order(result.laps)
    assert not [e for e in result.model["events"] if e["type"] == "RED"]
    assert any("results lap 48" in line for line in result.estimates)
