"""F1DB stops and fastest laps (f1db.py, build plan 2.3), on a committed subset of the pinned
release: japan-2005 and hungary-1998, only the columns the loader reads. No network."""

from __future__ import annotations

import csv
import zipfile
from pathlib import Path

import pandas as pd
import pytest
from typer.testing import CliRunner

from pipeline import cli, f1db, paths

FIXTURES = Path(__file__).parent / "fixtures" / "f1db"


@pytest.fixture
def zip_file(tmp_path) -> Path:
    path = tmp_path / f1db.ASSET
    with zipfile.ZipFile(path, "w") as z:
        for f in FIXTURES.glob("*.csv"):
            z.write(f, f.name)
    return path


@pytest.fixture
def db(zip_file) -> f1db.F1DB:
    return f1db.F1DB.load(zip_file)


def laps_by_driver(stops: pd.DataFrame) -> dict[str, list[int]]:
    return {d: list(s.sort_values("stop").lap) for d, s in stops.groupby("driver")}


def test_japan_2005_stops(db):
    stops = db.race_stops("japan-2005")
    assert len(stops) == 36
    laps = laps_by_driver(stops)
    assert laps["MSC"] == [26, 42]
    assert laps["RAI"] == [26, 45]
    assert laps["RSC"] == [13, 28, 44]
    assert "MON" in laps and "MOY" not in laps  # Monteiro stopped; Montoya was out on lap 1
    assert list(stops.columns) == f1db.STOP_COLUMNS
    assert stops.lap.is_monotonic_increasing
    assert stops.loc[stops.driver == "ALO", "lane_time"].round(3).tolist() == [21.982, 22.380]
    assert db.check_stops("japan-2005", stops) == []


def test_hungary_1998_stops(db):
    stops = db.race_stops("hungary-1998")
    assert len(stops) == 36
    laps = laps_by_driver(stops)
    assert laps["MSC"] == [25, 43, 62]  # the three-stop win
    assert laps["HAK"] == [28, 46]
    assert laps["TRU"] == [23]
    assert db.check_stops("hungary-1998", stops) == []


def test_fastest_laps(db):
    fl = db.race_fastest_laps("japan-2005")
    top = fl.iloc[0]
    assert (top.driver, top["rank"], top.lap, top.time) == ("RAI", 1, 44, 91.540)
    assert list(fl.columns) == f1db.FASTEST_COLUMNS
    assert fl.time.is_monotonic_increasing
    assert fl.driver.is_unique


def test_check_stops_flags_bad_stops(db):
    stops = db.race_stops("hungary-1998")
    msc = stops.driver == "MSC"
    bad = stops.copy()
    bad.loc[msc & (bad["stop"] == 3), "lap"] = 99  # past the race's 77 laps
    assert any("MSC: stop lap outside" in p for p in db.check_stops("hungary-1998", bad))
    fewer = stops[~(msc & (stops["stop"] == 3))]
    assert db.check_stops("hungary-1998", fewer) == ["MSC: 2 stops, results say 3"]
    assert db.check_stops("hungary-1998", stops.iloc[:0]) == ["no stops"]


def test_unknown_race(db):
    with pytest.raises(KeyError):
        db.race("atlantis-1998")


def test_resolve_codes_keeps_established_codes_and_is_stable():
    drivers = pd.DataFrame(
        {
            "id": ["gerhard-berger", "eric-bernard", "olivier-beretta", "max-verstappen"],
            "abbreviation": ["BER", "BER", "BER", "VER"],
            "lastName": ["Berger", "Bernard", "Beretta", "Verstappen"],
            "totalRaceStarts": [210, 45, 9, 200],
        }
    )
    results = pd.DataFrame(
        {
            "raceId": [1, 1, 1, 2, 2],
            "driverId": [
                "gerhard-berger",
                "eric-bernard",
                "olivier-beretta",
                "eric-bernard",
                "max-verstappen",
            ],
        }
    )
    codes = f1db.resolve_codes(drivers, results)
    assert codes["gerhard-berger"] == "BER"  # most starts keeps F1DB's code
    assert codes["max-verstappen"] == "VER"
    assert len({codes["gerhard-berger"], codes["eric-bernard"], codes["olivier-beretta"]}) == 3
    assert all(len(c) == 3 and c[0] == "B" for c in codes.values() if c != "VER")


def test_write_race_files(db, tmp_path):
    stops, fastest, problems = f1db.write_race(db, "japan-2005", tmp_path)
    assert problems == []
    with (tmp_path / "japan-2005.stops.csv").open() as f:
        rows = list(csv.DictReader(f))
    assert list(rows[0]) == f1db.STOP_COLUMNS
    assert len(rows) == len(stops) == 36
    assert {r["race_id"] for r in rows} == {"japan-2005"}
    with (tmp_path / "japan-2005.fastest-laps.csv").open() as f:
        first = next(csv.DictReader(f))
    assert (first["driver"], first["lap"], first["time"]) == ("RAI", "44", "91.540")
    meta = f1db.write_source(tmp_path)
    assert f1db.VERSION in meta.read_text() and "CC BY 4.0" in meta.read_text()


def test_committed_files_match_the_fixture(db, tmp_path):
    """data/raw/f1db/ was written from the same pinned release the fixture was cut from."""
    for race_id in ("japan-2005", "hungary-1998"):
        f1db.write_race(db, race_id, tmp_path)
        for kind in ("stops", "fastest-laps"):
            name = f"{race_id}.{kind}.csv"
            assert (tmp_path / name).read_text() == (f1db.OUT_DIR / name).read_text(), name


def test_download_uses_cache_and_checks_the_pin(tmp_path, monkeypatch):
    def no_network(*a, **k):
        raise AssertionError("network")

    monkeypatch.setattr(f1db.urllib.request, "urlopen", no_network)
    path = f1db.zip_path(tmp_path)
    path.parent.mkdir(parents=True)
    path.write_bytes(b"not the release")
    with pytest.raises(ValueError, match="SHA-256"):
        f1db.download(tmp_path)


def test_eras_cache_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("ERAS_SOURCES_CACHE", str(tmp_path))
    assert f1db.eras_cache_dir() == tmp_path
    monkeypatch.delenv("ERAS_SOURCES_CACHE")
    main, wt = tmp_path / "main", tmp_path / "wt"
    wt.mkdir()
    (wt / ".git").write_text(f"gitdir: {main}/.git/worktrees/wt\n")
    monkeypatch.setattr(f1db, "REPO_ROOT", wt)
    assert f1db.eras_cache_dir() == main / "pipeline" / "cache" / "eras-sources"


def test_cli_writes_races(zip_file, tmp_path, monkeypatch):
    monkeypatch.setattr(f1db, "download", lambda: zip_file)
    monkeypatch.setattr(f1db, "OUT_DIR", tmp_path / "data" / "raw" / "f1db")
    monkeypatch.setattr(paths, "REPO_ROOT", tmp_path)
    result = CliRunner().invoke(cli.app, ["f1db", "japan-2005", "hungary-1998"])
    assert result.exit_code == 0, result.output
    assert "japan-2005: 36 stops, 19 fastest laps" in result.output
    assert (tmp_path / "data/raw/f1db/hungary-1998.stops.csv").exists()
    assert (tmp_path / "data/raw/f1db/source.json").exists()
