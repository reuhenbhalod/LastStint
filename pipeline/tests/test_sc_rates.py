"""Historical SC/VSC rates per circuit (eras build plan 9.2): counting and the committed file."""

from __future__ import annotations

import json
import re

import pytest

from pipeline import sc_rates
from pipeline.paths import RACES_DIR, RAW_DIR
from pipeline.sc_rates import RaceCount, Round

RATES = json.loads(sc_rates.SC_RATES_PATH.read_text())


def _timeline(codes: str) -> list[dict]:
    return [{"time": float(i), "status": c} for i, c in enumerate(codes)]


@pytest.mark.parametrize(
    ("codes", "want"),
    [
        ("", (0, 0)),
        ("1", (0, 0)),
        ("121671241", (1, 1)),  # Abu Dhabi 2021
        ("1641", (1, 1)),  # a VSC handed straight to a SC: one of each
        ("671671", (0, 2)),
        ("14124124", (3, 0)),
        ("1251241", (1, 0)),  # red flags aren't counted
        ("144", (1, 0)),  # a repeated code is the same period
    ],
)
def test_count_status(codes, want):
    assert sc_rates.count_status(_timeline(codes)) == want


def test_round_slugs():
    assert sc_rates.round_slug("British Grand Prix") == "great-britain"
    assert sc_rates.round_slug("São Paulo Grand Prix") == "brazil"
    assert sc_rates.round_slug("United States Grand Prix West") == "united-states-west"
    with pytest.raises(ValueError, match="ROUND_SLUGS"):
        sc_rates.round_slug("Atlantis Grand Prix")


def test_event_circuits_compress_runs():
    rounds = [
        Round("europe", 1983, "", "brands_hatch", ""),
        Round("europe", 1984, "", "nurburgring", ""),
        Round("europe", 1985, "", "brands_hatch", ""),
        Round("monaco", 1983, "", "monaco", ""),
        Round("monaco", 1984, "", "monaco", ""),
    ]
    assert sc_rates.event_circuits(rounds) == {
        "europe": [[1983, "brands_hatch"], [1984, "nurburgring"], [1985, "brands_hatch"]],
        "monaco": [[1983, "monaco"]],
    }


def _count(race_id, year, circuit, sc, vsc, source="fastf1"):
    return RaceCount(race_id, year, circuit, source, sc, vsc, [4] * sc, [2] * vsc)


def test_dedupe_keeps_the_first_source():
    a = _count("x-2018", 2018, "c", 1, 0)
    b = _count("x-2018", 2018, "c", 3, 3, "tum")
    assert sc_rates.dedupe([a], [b]) == [a]


def test_summarize_rates_fallbacks_and_vsc_seasons():
    counts = [
        _count("a-2014", 2014, "a", 2, 0, "tum"),  # before the VSC: SC only
        _count("a-2015", 2015, "a", 1, 1, "tum"),
        _count("a-2016", 2016, "a", 0, 2, "tum"),
        _count("a-2017", 2017, "a", 1, 0, "tum"),
        _count("b-2018", 2018, "b", 3, 1),
    ]
    rounds = [Round("a", 2014, "", "a", "Circuit A"), Round("b", 2018, "", "b", "Circuit B")]
    doc = sc_rates.summarize(counts, rounds, min_races=3)
    t = doc["allTracks"]
    assert (t["races"], t["vscRaces"], t["scPeriods"], t["vscPeriods"]) == (5, 4, 7, 4)
    assert t["scPerRace"] == 1.4 and t["vscPerRace"] == 1.0
    a, b = doc["circuits"]["a"], doc["circuits"]["b"]
    assert (a["races"], a["vscRaces"], a["scPerRace"], a["vscPerRace"]) == (4, 3, 1.0, 1.0)
    assert not a["scFallback"] and not a["vscFallback"]
    assert b["scFallback"] and b["vscFallback"]
    assert (b["scPerRace"], b["vscPerRace"]) == (1.4, 1.0)  # the all-track rate
    assert doc["lengths"]["scLaps"] == 4 and doc["lengths"]["vscLaps"] == 2


def test_summarize_needs_data():
    with pytest.raises(ValueError, match="no races"):
        sc_rates.summarize([], [])


def test_raw_counts_skip_races_without_a_timeline(tmp_path):
    (tmp_path / "abu-dhabi-2021.status.json").write_text(json.dumps(_timeline("121671241")))
    (tmp_path / "monaco-1984.status.json").write_text("[]")  # Jolpica: no track status
    got = sc_rates.raw_counts({("abu-dhabi", 2021): "yas_marina"}, tmp_path)
    assert [(c.race_id, c.circuit, c.sc, c.vsc, c.source) for c in got] == [
        ("abu-dhabi-2021", "yas_marina", 1, 1, "fastf1")
    ]
    (tmp_path / "atlantis-2021.status.json").write_text(json.dumps(_timeline("1")))
    with pytest.raises(ValueError, match="no Jolpica round"):
        sc_rates.raw_counts({("abu-dhabi", 2021): "yas_marina"}, tmp_path)


# --- the committed data/sc_rates.json -------------------------------------------------------


def test_committed_rates_add_up():
    t = RATES["allTracks"]
    assert t["scPerRace"] == round(t["scPeriods"] / t["races"], 4)
    assert t["vscPerRace"] == round(t["vscPeriods"] / t["vscRaces"], 4)
    assert sum(c["races"] for c in RATES["circuits"].values()) == t["races"]
    for name, c in RATES["circuits"].items():
        assert c["scFallback"] == (c["races"] < RATES["minRaces"]), name
        assert c["vscFallback"] == (c["vscRaces"] < RATES["minRaces"]), name
        sc = t["scPerRace"] if c["scFallback"] else round(c["scPeriods"] / c["races"], 4)
        vsc = t["vscPerRace"] if c["vscFallback"] else round(c["vscPeriods"] / c["vscRaces"], 4)
        assert (c["scPerRace"], c["vscPerRace"]) == (sc, vsc), name
        assert len(c["counted"]) == c["races"], name


def test_committed_rates_match_the_raw_timelines():
    """Every real data/raw status timeline is counted, with the counts the file records.
    Reconstructed races (synthetic laps) are left out of the rates."""
    counted = {
        line.split(" ")[0]: line for c in RATES["circuits"].values() for line in c["counted"]
    }
    for path in sorted(RAW_DIR.glob("*.status.json")):
        race_id = path.name.removesuffix(".status.json")
        if (RAW_DIR / f"{race_id}.reconstruction.json").exists():
            assert race_id not in counted, race_id
            continue
        timeline = json.loads(path.read_text())
        if not timeline:
            continue
        sc, vsc = sc_rates.count_status(timeline)
        assert counted[race_id].endswith(f": {sc} SC, {vsc} VSC"), race_id


def test_every_race_file_finds_its_circuit():
    from pipeline.legend import circuit_for

    for path in sorted(RACES_DIR.glob("*.json")):
        if json.loads(path.read_text()).get("reconstructed"):
            continue  # its circuit may have no real timing; Legend uses the all-track rate
        assert circuit_for(path.stem, RATES) in RATES["circuits"], path.stem


def test_rebuild_matches_the_committed_file():
    """Rebuild from the shared cache when it's there (it isn't in CI)."""
    cache = sc_rates.DEFAULT_CACHE
    if not (cache / "tum").exists() or not (cache / "jolpica").exists():
        pytest.skip(f"no eras-sources cache at {cache}")
    assert sc_rates.build(cache) == RATES


def test_counted_lines_are_well_formed():
    line = re.compile(r"^[a-z0-9-]+-\d{4} \((fastf1|tum|jolpica-estimate)\): \d+ SC, \d+ VSC$")
    for c in RATES["circuits"].values():
        assert all(line.match(x) for x in c["counted"]), c["counted"]
