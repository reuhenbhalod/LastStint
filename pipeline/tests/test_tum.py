"""TUM f1-timing-database adapter (Eras build plan 2.1), offline.

Runs on tests/fixtures/tum_sample.sqlite, a small cut of the TUM database (CC BY-NC-SA 3.0;
credit: Institute of Automotive Technology, TU Munich; regenerate with
tests/fixtures/make_tum_fixture.py), never the full download. Abu Dhabi 2018 is checked
against the committed FastF1 snapshot of the same race.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import pandas as pd
import pytest
from typer.testing import CliRunner

from pipeline import assemble, build, clean, cli, events, ingest, tum

FIXTURE = Path(__file__).parent / "fixtures" / "tum_sample.sqlite"
RID = "abu-dhabi-2018"
NAN = math.nan


@pytest.fixture
def con():
    c = tum.connect(FIXTURE, verify=False)
    yield c
    c.close()


def _race(con, season, location):
    return tum.find_race(con, season, location)


@pytest.fixture
def abu(con):
    return tum.laps_frame(con, _race(con, 2018, "YasMarina"))


@pytest.fixture
def fastf1_abu():
    return pd.read_parquet(ingest.raw_snapshot_path(RID))


# --- compounds -------------------------------------------------------------------------


def test_three_nominated_compounds_map_softest_first():
    assert tum.compound_map("A5,A6,A7,I,W") == {
        "A7": "SOFT",
        "A6": "MEDIUM",
        "A5": "HARD",
        "I": "INTERMEDIATE",
        "W": "WET",
    }
    # 2018 with a gap in the nomination (Singapore: soft, ultrasoft, hypersoft)
    assert tum.compound_map("A4,A6,A7,I,W")["A4"] == "HARD"


def test_two_nominated_compounds_are_soft_and_medium():
    assert tum.compound_map("A3,A4,I,W") == {
        "A4": "SOFT",
        "A3": "MEDIUM",
        "I": "INTERMEDIATE",
        "W": "WET",
    }


@pytest.mark.parametrize("bad", ["A5,I,W", "A1,A2,A3,A4", "A5,A5,A6", "A5,A6,X", "", None])
def test_bad_nominations_are_rejected(bad):
    with pytest.raises(ingest.IncompleteDataError):
        tum.compound_map(bad)


def test_compound_outside_the_nomination_is_an_error(con):
    race = {**_race(con, 2018, "YasMarina"), "availablecompounds": "A4,A5,A6,I,W"}
    with pytest.raises(ingest.IncompleteDataError, match="A7"):
        tum.laps_frame(con, race)


# --- per-lap track status --------------------------------------------------------------


@pytest.mark.parametrize(
    ("progress", "status"),
    [
        ((NAN, NAN, NAN, NAN), "1"),
        ((NAN, NAN, 0.475, 1.0), "14"),  # SC deployed mid-lap
        ((NAN, NAN, 0.0, 1.0), "4"),
        ((NAN, NAN, 0.0, 0.944), "41"),  # SC in this lap
        ((0.297, 1.0, NAN, NAN), "16"),
        ((0.0, 0.812, NAN, NAN), "61"),
        ((0.3, 0.6, 0.6, 1.0), "164"),  # VSC straight into SC
        ((0.1, 0.2, 0.5, 0.7), "16141"),
    ],
)
def test_lap_status(progress, status):
    assert tum.lap_status(*progress) == status


# --- the lap frame vs FastF1, Abu Dhabi 2018 -------------------------------------------


def test_lap_frame_has_the_fastf1_columns_and_dtypes(abu, fastf1_abu):
    assert list(abu.columns) == ingest.LAP_COLUMNS
    assert abu.dtypes.to_dict() == fastf1_abu.dtypes.to_dict()
    ingest.check_complete(abu)
    assert len(abu) == len(fastf1_abu)


def _strategies(laps):
    out_laps = clean.tyre_change_out_laps(laps)
    fitted = clean.fitted_compound(laps)
    res = {}
    for driver, grp in laps.sort_values("LapNumber").groupby("Driver"):
        stops = [(int(grp.at[i, "LapNumber"]) - 1, fitted[i]) for i in grp.index if out_laps[i]]
        res[driver] = (grp["Compound"].iloc[0], stops)
    return res


def test_same_stops_and_compounds_as_fastf1(abu, fastf1_abu):
    tum_s, ff_s = _strategies(abu), _strategies(fastf1_abu)
    assert tum_s == ff_s
    assert tum_s["BOT"] == ("MEDIUM", [(16, "HARD"), (40, "MEDIUM")])


def test_pit_times(abu):
    ham = abu[abu["Driver"] == "HAM"].set_index("LapNumber")
    assert ham.at[7.0, "PitInTime"] == ham.at[7.0, "Time"]
    assert ham.at[8.0, "PitOutTime"] == pytest.approx(ham.at[7.0, "Time"] + 21.283)
    assert ham["Stint"].loc[:7].eq(1).all() and ham["Stint"].loc[8:].eq(2).all()
    assert ham.at[8.0, "TyreLife"] == 1
    assert not ham.at[7.0, "IsAccurate"] and not ham.at[1.0, "IsAccurate"]
    assert ham.at[9.0, "IsAccurate"]


def test_track_status_per_lap(abu):
    ham = abu[abu["Driver"] == "HAM"].set_index("LapNumber")["TrackStatus"]
    assert list(ham.loc[1:9]) == ["14", "4", "4", "41", "1", "1", "16", "61", "1"]


def test_retirements_and_result_match_fastf1(abu, fastf1_abu):
    assert assemble.finishing_order(abu) == assemble.finishing_order(fastf1_abu)
    tum_ret = {e["driver"]: e["lap"] for e in events.retirement_events(abu)}
    ff_ret = {e["driver"]: e["lap"] for e in events.retirement_events(fastf1_abu)}
    # RAI stopped early in lap 7 (the VSC at 870 s was for him); FastF1's synthetic Time for
    # his unfinished lap says race lap 9, TUM's estimate 8. Every other retirement agrees.
    assert (tum_ret.pop("RAI"), ff_ret.pop("RAI")) == (8, 9)
    assert tum_ret == ff_ret and set(tum_ret) == {"ERI", "OCO", "GAS", "HUL"}
    hul = abu[abu["Driver"] == "HUL"]  # out on lap 1: only the unfinished lap
    assert len(hul) == 1 and hul["LapTime"].isna().all() and hul["Team"].iloc[0] == "Renault"
    # A car whose last completed lap ended in the pits retired there (no extra row).
    assert tum.retirement_rows(
        abu.assign(PitInTime=abu["Time"]), pd.DataFrame(columns=["tum_status"]), {}, "2018"
    ).empty


def test_teams_use_fastf1_names(abu, fastf1_abu):
    teams = lambda df: df.groupby("Driver")["Team"].first().to_dict()  # noqa: E731
    assert teams(abu) == teams(fastf1_abu)


# --- status timeline and notes ---------------------------------------------------------


def test_status_timeline_abu_dhabi(con):
    assert tum.track_status(con, _race(con, 2018, "YasMarina")) == [
        {"time": 0.0, "status": "1"},
        {"time": 64.0, "status": "4"},
        {"time": 614.0, "status": "1"},
        {"time": 870.0, "status": "6"},
        {"time": 1080.0, "status": "1"},
    ]


def test_status_timeline_vsc_into_sc_stays_neutral(con):
    status = tum.track_status(con, _race(con, 2015, "MonteCarlo"))
    assert [s["status"] for s in status] == ["1", "6", "4", "1"]
    assert events.deployment_times(status) == [5128.0]


def test_status_events_match_fastf1(abu, fastf1_abu):
    assert events.neutralization_events(abu) == events.neutralization_events(fastf1_abu)


def test_two_compound_race(con):
    df = tum.laps_frame(con, _race(con, 2015, "MonteCarlo"))
    assert set(df["Compound"]) <= {"SOFT", "MEDIUM"}


def test_red_flag_is_noted_not_invented(con):
    race = _race(con, 2014, "Silverstone")
    assert tum.race_notes(race) and "red flag" in tum.race_notes(race)[0]
    assert all("5" not in s["status"] for s in tum.track_status(con, race))
    assert tum.race_notes(_race(con, 2018, "YasMarina")) == []


# --- ids, versions, files --------------------------------------------------------------


def test_parse_race_id():
    assert tum.parse_race_id("abu-dhabi-2018") == (2018, "YasMarina")
    assert tum.parse_race_id("usa-2016") == tum.parse_race_id("united-states-2016")
    for bad in ("abu-dhabi-2021", "atlantis-2016", "abu dhabi"):
        with pytest.raises(ValueError):
            tum.parse_race_id(bad)


def test_unknown_race_raises(con):
    with pytest.raises(ingest.IncompleteDataError):
        tum.find_race(con, 2018, "Monza")  # not in the fixture


def test_version_is_pinned(tmp_path):
    with pytest.raises(tum.TumVersionError):
        tum.connect(FIXTURE)  # the fixture isn't the pinned full database
    with pytest.raises(FileNotFoundError):
        tum.connect(tmp_path / "missing.sqlite")


def test_ingest_writes_snapshot_status_and_provenance(tmp_path):
    laps, facts = tum.ingest_tum(RID, FIXTURE, tmp_path, verify=False)
    assert facts["totalLaps"] == 55 and facts["notes"] == []
    pd.testing.assert_frame_equal(pd.read_parquet(tmp_path / f"{RID}.parquet"), laps)
    assert ingest.load_track_status(RID, tmp_path)[1] == {"time": 64.0, "status": "4"}
    prov = json.loads(tum.provenance_path(RID, tmp_path).read_text())
    assert (
        prov["licence"] == "CC BY-NC-SA 3.0" and "Technical University of Munich" in prov["credit"]
    )
    assert prov["commit"] == tum.TUM_COMMIT and prov["compoundMap"]["A7"] == "SOFT"


def test_cli_tum_ingest(tmp_path):
    runner = CliRunner()
    args = ["tum-ingest", RID, "--db", str(FIXTURE), "--out", str(tmp_path), "--no-verify"]
    result = runner.invoke(cli.app, args)
    assert result.exit_code == 0, result.output
    assert "943 laps" in result.output and "Technical University of Munich" in result.output
    assert (tmp_path / f"{RID}.status.json").exists()
    again = runner.invoke(cli.app, args)
    assert "skipped" in again.output
    bad = runner.invoke(cli.app, ["tum-ingest", "abu-dhabi-2021", "--out", str(tmp_path)])
    assert bad.exit_code != 0


def test_cli_flags_red_flag_race(tmp_path):
    args = ["tum-ingest", "great-britain-2014", "--db", str(FIXTURE), "--out", str(tmp_path)]
    result = CliRunner().invoke(cli.app, [*args, "--no-verify"])
    assert result.exit_code == 0, result.output
    assert "NOT SUITABLE: red flag" in result.output


# --- done-when: the race model built from TUM matches the FastF1 build -----------------


def test_race_model_matches_fastf1_build(tmp_path, monkeypatch, fastf1_abu):
    tum.ingest_tum(RID, FIXTURE, tmp_path, verify=False)
    ff_model = build.build_race(RID, fastf1_abu).model

    real_status = ingest.load_track_status
    monkeypatch.setattr(ingest, "load_track_status", lambda rid: real_status(rid, tmp_path))
    monkeypatch.setattr(ingest, "load_weather", lambda rid: None)  # none committed for this race
    tum_model = build.build_race(RID, pd.read_parquet(tmp_path / f"{RID}.parquet")).model

    ff = {d["code"]: d for d in ff_model["drivers"]}
    tm = {d["code"]: d for d in tum_model["drivers"]}
    assert set(ff) == set(tm)
    for code, d in ff.items():
        assert tm[code]["basePace"] == pytest.approx(d["basePace"], abs=0.1), code
        assert [(s["lap"], s["to"]) for s in tm[code]["realStrategy"]] == [
            (s["lap"], s["to"]) for s in d["realStrategy"]
        ], code
    for key in ("realResult", "events"):
        assert tum_model[key] == ff_model[key]
    assert tum_model["race"]["takeoverLap"] == ff_model["race"]["takeoverLap"]
