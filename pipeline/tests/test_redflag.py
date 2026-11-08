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


# --- the reference sim ------------------------------------------------------------------------


def test_plan():
    evs = [{"lap": 5, "type": "RED", "laps": 2, "restart": "rolling"}]
    assert redflag.plan(evs) == {"free": {6}, "wipes": {6: (0.5, 5)}}
    standing = [{**evs[0], "restart": "standing"}, {"lap": 7, "type": "SC", "laps": 2}]
    assert redflag.plan(standing) == {"free": {6}, "wipes": {6: (0.5, 5), 8: (0.74, 5)}}
    assert redflag.plan([{"lap": 5, "type": "RED", "laps": 2}]) == {"free": set(), "wipes": {}}
    assert redflag.plan([{"lap": 5, "type": "SC", "laps": 2}]) == {"free": set(), "wipes": {}}


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
