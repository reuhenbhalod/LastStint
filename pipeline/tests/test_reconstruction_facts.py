"""The hand-entered facts files for the 1983-1995 Eras races (data/reconstruction/,
docs/reconstruction-facts.md, checked in docs/eras-checks/r2-reconstruction-facts.md).

Every file must pass reconstruct.py's loader. Where the Jolpica dump is cached
(pipeline/cache/eras-sources/jolpica/), each file is also loaded against the race's entry
list, so every car number in a stop names a car that started.
"""

from __future__ import annotations

import json

import pytest

from pipeline import f1db, jolpica
from pipeline import reconstruct as rc

RACES = [
    "south-africa-1983",
    "monaco-1984",
    "portugal-1984",
    "san-marino-1985",
    "portugal-1985",
    "mexico-1986",
    "hungary-1986",
    "australia-1986",
    "great-britain-1987",
    "monaco-1988",
    "japan-1989",
    "united-states-1990",
    "mexico-1990",
    "brazil-1991",
    "monaco-1992",
    "belgium-1992",
    "hungary-1992",
    "brazil-1993",
    "europe-1993",
    "australia-1993",
    "spain-1994",
    "australia-1994",
    "belgium-1995",
]

# Race ids whose Jolpica round the id alone doesn't find.
LOOKUP = {
    "great-britain-1987": {"event": "british grand prix"},
    "spain-1994": {"round_number": 5},
}


def test_every_race_has_a_file():
    files = {p.stem for p in rc.FACTS_DIR.glob("*.json")}
    assert set(RACES) <= files


@pytest.mark.parametrize("race_id", RACES)
def test_loads(race_id):
    facts = rc.load_facts(race_id)
    assert facts is not None
    assert facts.get("raceId") == race_id
    assert str(facts.get("notes") or "").strip(), "say what was searched and what is missing"
    for s in facts["stops"]:
        assert int(s["lap"]) >= 1
        assert s["laneTime"] is None or float(s["laneTime"]) > 0
    for _sc in facts["safetyCars"]:
        assert rc.race_year(race_id) >= rc.FIRST_SC_YEAR


@pytest.mark.parametrize("race_id", [r for r in RACES if rc.race_year(r) >= 1994])
def test_f1db_races_add_no_stops(race_id):
    """F1DB has 1994-95 stops and the loader ignores a facts file's; keep them out."""
    assert rc.load_facts(race_id)["stops"] == []


def _dump():
    try:
        return jolpica.latest_dump(f1db.eras_cache_dir() / "jolpica")
    except (FileNotFoundError, LookupError, ValueError):
        return None


@pytest.mark.parametrize("race_id", RACES)
def test_stops_name_cars_in_the_race(race_id):
    dump = _dump()
    if dump is None:
        pytest.skip("no Jolpica dump cached")
    anchors = rc.load_anchors(race_id, dump_dir=dump, **LOOKUP.get(race_id, {}))
    facts = json.loads(rc.facts_path(race_id).read_text())
    if rc.race_year(race_id) < 1994:
        entered = sum(len(c.stops) for c in anchors.cars)
        dropped = [n for n in anchors.notes if "retired on; not run" in n]
        assert entered + len(dropped) == len(facts["stops"])
        assert not dropped, f"stops after the car's last lap: {dropped}"
    assert [(sc.start, sc.end) for sc in anchors.safety_cars] == [
        (sc["startLap"], sc["endLap"]) for sc in facts["safetyCars"]
    ]


# The wet races (docs/eras-checks/r2-reconstruction-facts.md, weather): each has a sourced
# weather timeline; the rest are dry.
WET = ["monaco-1984", "portugal-1985", "belgium-1992", "brazil-1993", "europe-1993", "belgium-1995"]


@pytest.mark.parametrize("race_id", RACES)
def test_weather_only_on_the_wet_races(race_id):
    weather = rc.load_facts(race_id).get("weather")
    assert (weather is not None) == (race_id in WET)
    if weather:
        assert all(str(e["source"]).strip() for e in weather["timeline"])
        assert any(e.get("state", "dry") != "dry" for e in weather["timeline"])


@pytest.mark.parametrize("race_id", WET)
def test_weather_covers_the_race_and_its_tyres_find_their_stops(race_id):
    dump = _dump()
    if dump is None:
        pytest.skip("no Jolpica dump cached")
    anchors = rc.load_anchors(race_id, dump_dir=dump, **LOOKUP.get(race_id, {}))
    assert anchors.wetness is not None and len(anchors.wetness) == anchors.laps
    assert max(anchors.wetness) >= rc.STATE_WETNESS["wet"]
    assert not [n for n in anchors.notes if n.startswith("weather ")]
