"""The hand-entered red-flag facts (data/redflags/, roadmap R1): every file loads through
redflag.load_entries and carries the fields the build and the owner's check need."""

from __future__ import annotations

import json
import re

import pytest

from pipeline import redflag

# The Eras races with a red flag whose facts were researched by hand (R1).
RACES = {
    "monaco-2022": 1,
    "great-britain-2022": 1,
    "azerbaijan-2021": 1,
    "hungary-2021": 1,
    "saudi-arabia-2021": 2,
    "italy-2020": 1,
    "azerbaijan-2017": 1,
    "brazil-2016": 2,
    "monaco-2011": 1,
    "canada-2011": 1,
    "europe-2007": 1,
    "brazil-2003": 1,
    "belgium-1998": 1,
    "monaco-1984": 1,
}
# Sources with no red-flag timing: the stoppage lap must be hand-entered (resumeLap), unless
# the race never resumed or the data holds only the restarted race (belgium-1998).
UNTIMED_NO_STOPPAGE = {"brazil-2003", "monaco-1984", "belgium-1998"}
UNTIMED = {"azerbaijan-2017", "brazil-2016", "monaco-2011", "canada-2011", "europe-2007"}

FILES = sorted(redflag.REDFLAGS_DIR.glob("*.json"))


def _file(race_id: str) -> dict:
    return json.loads((redflag.REDFLAGS_DIR / f"{race_id}.json").read_text())


def test_every_race_has_a_file():
    names = {p.stem for p in FILES}
    assert set(RACES) <= names


@pytest.mark.parametrize("path", FILES, ids=lambda p: p.stem)
def test_file_loads_and_validates(path):
    body = json.loads(path.read_text())
    assert body["race"] == path.stem
    entries = redflag.load_entries(path.stem, raw_dir=path.parent / "_none", hand_dir=path.parent)
    assert entries, "a red-flag file lists at least one red flag"
    laps = [e["lap"] for e in entries]
    assert laps == sorted(set(laps)), "red flags in lap order, one per lap"
    for e in entries:
        assert re.search(r"https?://", e["source"]), f"lap {e['lap']}: source has no URL"
        if "resumeLap" in e:
            assert e["restart"] != "none", "a race that never resumed has no stoppage lap"
        if e["restart"] == "none":
            assert e is entries[-1], "only the last red flag can end the race"


@pytest.mark.parametrize("race_id", sorted(RACES))
def test_race_facts(race_id):
    body = _file(race_id)
    entries = body["redFlags"]
    assert len(entries) == RACES[race_id]
    assert isinstance(body["scheduledLaps"], int) and isinstance(body["completedLaps"], int)
    assert body["completedLaps"] <= body["scheduledLaps"]
    for e in entries:
        assert e["lap"] <= body["completedLaps"] + 2  # flag lap at most two past the result
        if race_id in UNTIMED:
            assert "resumeLap" in e, "untimed source: the stoppage lap must be entered"
        if race_id in UNTIMED_NO_STOPPAGE:
            assert "resumeLap" not in e
        if e["restart"] == "none":
            assert e["resultsLap"] == body["completedLaps"]
    # Consecutive red flags don't overlap: the next is shown after the last one's restart SC.
    for a, b in zip(entries, entries[1:], strict=False):
        assert b["lap"] > a.get("resumeLap", a["lap"]) + a.get("restartScLaps", 0) - 1


def test_restart_types_follow_the_rules_where_they_apply():
    """Hand entries agree with the regulation default for the years that have one."""
    for race_id in RACES:
        year = int(race_id.rsplit("-", 1)[1])
        try:
            rule = redflag.default_restart(year)
        except redflag.RedFlagError:
            continue
        for e in _file(race_id)["redFlags"]:
            if e["restart"] != "none" and race_id != "monaco-2022":
                assert e["restart"] == rule, (race_id, e["lap"])
    # Monaco 2022 resumed with a rolling start (Autosport live text; see its file).
    assert _file("monaco-2022")["redFlags"][0]["restart"] == "rolling"
