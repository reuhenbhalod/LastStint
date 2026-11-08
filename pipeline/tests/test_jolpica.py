"""Jolpica CSV dump ingest (eras build plan 2.2), offline on a committed fixture.

tests/fixtures/jolpica/csv-2026-10-24 is cut from the 2026-10-24 Jolpica dump (VERSION.txt):
the European GP 1997, Japanese GP 2005 and Abu Dhabi GP 2012 sessions, every round of those
three seasons (for event lookup), and only the columns jolpica.py reads. A test drivers.json
keeps the driver-code checks independent of data/drivers.json as it grows.
"""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pytest
from typer.testing import CliRunner

from pipeline import clean, cli, events, ingest, jolpica

FIXTURE = Path(__file__).parent / "fixtures" / "jolpica" / "csv-2026-10-24"
RACES = [(1997, "european"), (2005, "japan"), (2012, "abu dhabi")]


@pytest.fixture(scope="module")
def drivers_json(tmp_path_factory) -> Path:
    path = tmp_path_factory.mktemp("drivers") / "drivers.json"
    drivers = {
        "RAI": "Kimi Räikkönen",
        "ALO": "Fernando Alonso",
        "VET": "Sebastian Vettel",
        "MSC": "Mick Schumacher",  # Michael's Jolpica code too
        "VER": "Max Verstappen",  # Jean-Éric Vergne's Jolpica code too
        "HUL": "Nico Hülkenberg",
    }
    path.write_text(json.dumps({"drivers": {c: {"name": n} for c, n in drivers.items()}}))
    return path


@pytest.fixture(scope="module")
def loaded(drivers_json) -> dict[int, jolpica.Ingested]:
    return {y: jolpica.load(y, ev, dump_dir=FIXTURE, drivers_path=drivers_json) for y, ev in RACES}


# --- Done-when: summed laps match the official race time, three decades -------------------


@pytest.mark.parametrize(("year", "event"), RACES)
def test_lead_lap_finishers_summed_laps_match_official_time(loaded, year, event):
    check = loaded[year].sidecar["raceTimeCheck"]
    assert len(check) >= 10  # every lead-lap finisher is checked, not just the winner
    for r in check:
        assert r["summed"] is not None, r
        assert abs(r["diff"]) <= 0.1, r


def test_race_time_check_only_counts_lead_lap_finishers(loaded):
    side = loaded[2012].sidecar
    winner_laps = side["results"][0]["laps"]
    lead_lap = [
        r for r in side["results"] if r["status"] == "finished" and r["laps"] == winner_laps
    ]
    assert [r["driver"] for r in side["raceTimeCheck"]] == [r["driver"] for r in lead_lap]


def test_race_time_check_reports_a_mismatch():
    laps = pd.DataFrame({"Driver": ["AAA", "AAA"], "LapTime": [90.0, 91.0]})
    result = [{"driver": "AAA", "position": 1, "status": "finished", "laps": 2, "time": 186.0}]
    (row,) = jolpica.race_time_check(laps, result)
    assert row["diff"] == pytest.approx(-5.0)  # e.g. a post-race time penalty


# --- Raw snapshot shape -------------------------------------------------------------------


@pytest.mark.parametrize(("year", "event"), RACES)
def test_snapshot_has_lap_columns_and_cumulative_time(loaded, year, event):
    assert list(loaded[year].laps.columns) == ingest.LAP_COLUMNS
    df = loaded[year].laps.dropna(subset=["LapTime"])  # opening-lap retirements are untimed
    for _, mine in df.groupby("Driver"):
        mine = mine.sort_values("LapNumber")
        assert mine["LapNumber"].tolist() == list(range(1, len(mine) + 1))
        assert mine["Time"].tolist() == pytest.approx(mine["LapTime"].cumsum().tolist(), abs=1e-6)
    assert df["Position"].notna().all()
    assert loaded[year].facts["totalLaps"] == int(df["LapNumber"].max())


@pytest.mark.parametrize(("year", "event"), RACES)
def test_unsupplied_columns_are_left_empty_and_listed(loaded, year, event):
    df, side = loaded[year].laps, loaded[year].sidecar
    assert df["Compound"].isna().all() and df["TrackStatus"].isna().all()
    assert {"Compound", "TrackStatus"} <= set(side["missing"])


@pytest.mark.parametrize("year", [1997, 2005])
def test_before_2011_stop_columns_are_unknown(loaded, year):
    df, side = loaded[year].laps, loaded[year].sidecar
    for col in ("Stint", "TyreLife", "PitInTime", "PitOutTime"):
        assert df[col].isna().all(), col
    assert df["IsAccurate"].isna().all()  # in- and out-laps can't be told apart
    assert side["stops"] is None
    assert {"Stint", "TyreLife", "PitInTime", "PitOutTime", "IsAccurate"} <= set(side["missing"])


def test_2011_on_stops_set_stints_pit_times_and_accuracy(loaded):
    df = loaded[2012].laps
    assert df["IsAccurate"].dtype == bool
    rai = df[df["Driver"] == "RAI"].set_index("LapNumber")
    (in_lap,) = rai.index[rai["PitInTime"].notna()]
    assert rai.at[in_lap, "PitInTime"] == rai.at[in_lap, "Time"]
    assert rai.at[in_lap, "Stint"] == 1 and rai.at[in_lap + 1, "Stint"] == 2
    assert rai.at[in_lap + 1, "TyreLife"] == 1
    assert rai.at[in_lap + 1, "PitOutTime"] > rai.at[in_lap, "Time"]
    assert not rai.at[1, "IsAccurate"]
    assert not rai.at[in_lap, "IsAccurate"] and not rai.at[in_lap + 1, "IsAccurate"]
    assert rai.at[in_lap + 2, "IsAccurate"]
    assert loaded[2012].sidecar["stops"] == "jolpica"


def test_stops_from_another_source_fill_a_pre_2011_race(drivers_json):
    stops = pd.DataFrame({"Driver": ["RAI", "RAI"], "Lap": [20, 38], "Duration": [25.0, None]})
    got = jolpica.load(2005, "japan", dump_dir=FIXTURE, stops=stops, drivers_path=drivers_json)
    rai = got.laps[got.laps["Driver"] == "RAI"].set_index("LapNumber")
    assert rai.at[21, "Stint"] == 2 and rai.at[39, "Stint"] == 3
    assert rai.at[21, "PitOutTime"] == pytest.approx(rai.at[20, "Time"] + 25.0)
    assert pd.isna(rai.at[39, "PitOutTime"])  # no lane time given: left unknown
    assert got.sidecar["stops"] == "given"
    alo = got.laps[got.laps["Driver"] == "ALO"]
    assert (alo["Stint"] == 1).all()  # stops known, none given for him


def test_downstream_steps_read_the_snapshot(loaded):
    df = loaded[2012].laps
    pit = clean.is_pit_lap(df)
    for r in df[df["PitInTime"].notna()].itertuples():
        out_lap = (df["Driver"] == r.Driver) & (df["LapNumber"] == r.LapNumber + 1)
        assert pit[r.Index] and pit[out_lap].all()
    retired = {e["driver"] for e in events.retirement_events(df)}
    assert retired == {r["driver"] for r in loaded[2012].sidecar["retirements"]}


def test_an_opening_lap_retirement_gets_an_untimed_first_lap(loaded):
    df, side = loaded[2012].laps, loaded[2012].sidecar
    (hul,) = [r for r in side["retirements"] if r["laps"] == 0]  # Hulkenberg, lap 1
    mine = df[df["Driver"] == hul["driver"]]
    assert len(mine) == 1 and mine["LapNumber"].item() == 1 and mine["Time"].item() == 0.0
    assert pd.isna(mine["LapTime"].item()) and not mine["IsAccurate"].item()
    (event,) = [e for e in events.retirement_events(df) if e["driver"] == hul["driver"]]
    assert event["lap"] == 1
    assert not any(hul["driver"] in g for g in side["timingGaps"])


# --- Results, retirements, standings ------------------------------------------------------


def test_results_retirements_and_standings(loaded):
    side = loaded[2012].sidecar
    winner = side["results"][0]
    assert (winner["driver"], winner["position"], winner["status"]) == ("RAI", 1, "finished")
    assert all(r["grid"] is not None for r in side["results"])
    assert side["retirements"] and all(r["status"] != "finished" for r in side["retirements"])
    laps_done = [r["laps"] for r in side["retirements"]]
    assert laps_done == sorted(laps_done, reverse=True)
    drivers = side["standings"]["drivers"]
    assert drivers[0]["position"] == 1 and drivers[0]["points"] > 0
    assert side["standings"]["teams"][0]["position"] == 1
    assert side["licence"].startswith("CC BY-NC-SA")
    assert side["dump"] == "2026-10-24T01:04:07.015299Z"


# --- Driver codes -------------------------------------------------------------------------


def test_repo_codes_win_by_full_name_ignoring_accents(loaded):
    codes = set(loaded[2012].laps["Driver"])
    assert {"RAI", "ALO", "VET"} <= codes  # Räikkönen matched without the umlaut


def test_clashing_or_missing_codes_are_reported_not_invented(loaded):
    side = loaded[2012].sidecar
    no_code = {d["name"]: d for d in side["driversWithoutCode"]}
    # Michael Schumacher's MSC and Vergne's VER are other drivers' in the repo.
    assert no_code["Michael Schumacher"]["reference"] == "michael_schumacher"
    assert "already another driver's" in no_code["Michael Schumacher"]["why"]
    assert "Jean-Éric Vergne" in no_code
    assert "michael_schumacher" in set(loaded[2012].laps["Driver"])
    assert "MSC" not in set(loaded[2012].laps["Driver"])
    from_jolpica = {d["code"] for d in side["driversFromJolpica"]}
    assert "BUT" in from_jolpica  # Button: not in the test drivers.json, Jolpica's code used
    side_1997 = loaded[1997].sidecar
    assert any(d["why"] == "no code" for d in side_1997["driversWithoutCode"])


def test_driver_codes_never_reuse_a_code():
    ents = pd.DataFrame(
        {
            "entry_id": [1, 2, 3],
            "forename": ["Max", "Jos", "Jean-Éric"],
            "surname": ["Verstappen", "Verstappen", "Vergne"],
            "abbreviation": ["VER", "VER", "VER"],
            "reference": ["max_verstappen", "verstappen", "vergne"],
        }
    )
    codes = jolpica.driver_codes(ents, {"max verstappen": "VER"})
    assert codes.by_entry == {1: "VER", 2: "verstappen", 3: "vergne"}
    assert len(codes.no_code) == 2


# --- Event lookup and errors --------------------------------------------------------------


def test_find_race_by_name_country_town_or_round():
    dump = jolpica.Dump(FIXTURE)
    assert jolpica.find_race(dump, 2005, "Japan").name == "Japanese Grand Prix"
    assert jolpica.find_race(dump, 1997, "european").locality == "Jerez de la Frontera"
    assert jolpica.find_race(dump, 1997, "Jerez de la Frontera").name == "European Grand Prix"
    by_round = jolpica.find_race(dump, 2012, round_number=18)
    assert by_round.name == "Abu Dhabi Grand Prix"


def test_find_race_refuses_an_ambiguous_or_unknown_event():
    dump = jolpica.Dump(FIXTURE)
    with pytest.raises(LookupError, match="2 1997 rounds"):  # Spanish and European GPs
        jolpica.find_race(dump, 1997, "Spain")
    with pytest.raises(LookupError, match="0 2005 rounds"):
        jolpica.find_race(dump, 2005, "Atlantis")
    with pytest.raises(LookupError, match="no 1950 season"):
        jolpica.find_race(dump, 1950, "British")


def test_a_round_without_laps_in_the_dump_is_an_error(drivers_json):
    # 2012's other rounds are in the fixture's round table but have no sessions.
    with pytest.raises(LookupError, match="0 race sessions"):
        jolpica.load(2012, "Brazil", dump_dir=FIXTURE, drivers_path=drivers_json)


def test_missing_dump_is_a_clear_error(tmp_path):
    with pytest.raises(FileNotFoundError, match="no Jolpica CSV dump"):
        jolpica.latest_dump(tmp_path)
    with pytest.raises(FileNotFoundError):
        jolpica.Dump(tmp_path / "nope")
    (tmp_path / "csv-2026-01-01").mkdir()
    (tmp_path / "csv-2026-10-24").mkdir()
    assert jolpica.latest_dump(tmp_path).name == "csv-2026-10-24"


# --- Writing and the CLI ------------------------------------------------------------------


def test_ingest_writes_snapshot_status_and_sidecar(tmp_path, drivers_json):
    got = jolpica.ingest_jolpica(
        "japan-2005", 2005, "japan", dump_dir=FIXTURE, raw_dir=tmp_path, drivers_path=drivers_json
    )
    back = pd.read_parquet(ingest.raw_snapshot_path("japan-2005", tmp_path))
    assert list(back.columns) == ingest.LAP_COLUMNS
    assert len(back) == len(got.laps)
    assert ingest.load_track_status("japan-2005", tmp_path) == []
    side = json.loads(jolpica.sidecar_path("japan-2005", tmp_path).read_text())
    assert side["source"] == "jolpica" and side["year"] == 2005


def test_cli_jolpica_writes_and_prints_the_time_check(tmp_path):
    args = ["jolpica", "abu-dhabi-2012", "--dump", str(FIXTURE), "--raw-dir", str(tmp_path)]
    result = CliRunner().invoke(cli.app, args)
    assert result.exit_code == 0, result.output
    assert ingest.raw_snapshot_path("abu-dhabi-2012", tmp_path).exists()
    assert "Abu Dhabi Grand Prix 2012" in result.output
    assert "summed laps vs official time" in result.output and "+0.000s" in result.output
    again = CliRunner().invoke(cli.app, args)
    assert "skipped" in again.output


def test_cli_jolpica_needs_a_year():
    result = CliRunner().invoke(cli.app, ["jolpica", "jerez", "--dump", str(FIXTURE)])
    assert result.exit_code != 0


def test_cli_jolpica_reports_an_ambiguous_event_without_a_traceback(tmp_path):
    args = ["jolpica", "spain-1997", "--dump", str(FIXTURE), "--raw-dir", str(tmp_path)]
    result = CliRunner().invoke(cli.app, args)
    assert result.exit_code == 1
    assert "2 1997 rounds match" in result.output
    assert not ingest.raw_snapshot_path("spain-1997", tmp_path).exists()
