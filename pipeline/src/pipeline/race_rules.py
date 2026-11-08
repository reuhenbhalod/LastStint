"""Era rules (eras build plan 4.1, roadmap R5): the race's `rules` block in the reference sim,
and the rules each year raced under (written to the data/eras overlay files).

Mirrors packages/sim/src/rules.ts. The reference sim runs real strategies only, so of the
rules it runs the ones that change a replay: no tyre changes (2005), the pit lane closed under
the SC (2007-08, for added stops) and scUnlap "none". DRS, the battery, the VSC's base rate and
the two-compound disqualification only act in live play (TS). A race without a `rules` block
runs exactly as before.

Sources (checked Nov 7, 2026); rules.ts has the same list:
- VSC from 2015: Wikipedia, "Safety car" ("officially introduced for the 2015 season").
- DRS 2011-2025: Wikipedia, "Drag reduction system".
- KERS 2009, not 2010 (the teams agreed not to run it), 2011-13; hybrid ERS from 2014:
  Wikipedia, "Kinetic energy recovery system".
- Two-compound rule from 2007: Sporting Regulations art. 77c (Autosport's 2007 tyre previews).
- 2005, no tyre changes in the race unless a tyre is damaged or the weather changes: BBC,
  Bridgestone's 2005 technical regulations page, Motorsport.com's 2005 rules summary.
- Pit lane closed under the SC with a ten-second stop-go, 2007-08: RaceFans, "F1 2007 Preview:
  New rules at a glance" (Feb 28 2007); Wikipedia, "2007 Canadian Grand Prix". Dropped for 2009:
  Autosport, "FIA confirms new safety car rules" (Jan 27 2009).
- Lapped cars unlap before the restart: new in 2007 (RaceFans, as above), banned 2010-11,
  allowed again from 2012 (Wikipedia, "Safety car").
- The safety car: routine from 1993 (owner's decision, Nov 7, 2026: no random safety car
  before 1993). Before then nothing the sim makes up neutralizes the race; real events are
  kept. Derived from the race's year (safety_car), not an overlay key.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from .paths import DATA_DIR, REPO_ROOT

ERAS_OVERLAY_DIR = DATA_DIR / "eras"
BUILD_PLAN = REPO_ROOT / "docs" / "eras-build-plan.md"

WET_TYRES = ("INTERMEDIATE", "WET")
PIT_CLOSED_SC_LAPS = 1  # SC laps from the deployment whose end the pit entry is closed on
STOP_GO_SECONDS = 10.0  # the stop-go's stationary time
SAFETY_CAR_FROM = 1993  # the first season the sim may make up a SC (or VSC)
_RACE_YEAR = re.compile(r"^.+?-(\d{4})(?:-.*)?$")


def _rules(model: dict) -> dict:
    return model.get("rules") or {}


def year_of(race_id: str) -> int | None:
    """The season of a race id ('spain-1994-pits' -> 1994), or None when it has none."""
    m = _RACE_YEAR.match(race_id)
    return int(m.group(1)) if m else None


def safety_car_for_year(year: int) -> bool:
    return year >= SAFETY_CAR_FROM


def safety_car(model: dict) -> bool:
    """True if the race runs with a safety car (from 1993). A race id without a year counts as
    modern. No SC, no VSC either."""
    year = year_of(model["race"]["id"])
    return year is None or safety_car_for_year(year)


def stop_changes_tyres(model: dict, from_compound: str, stop: dict) -> bool:
    """False when a stop keeps the set: no tyre changes (2005), unless the set is damaged or
    the change is to or from a wet tyre. The stop then only refuels (eras build plan 4.2)."""
    if _rules(model).get("tyreChanges", True) is not False:
        return True
    return bool(stop.get("damaged")) or from_compound in WET_TYRES or stop["to"] in WET_TYRES


def pit_lane_closed(model: dict, neutral: dict[int, str], out_lap: int, to: str) -> bool:
    """True if a stop with out-lap `out_lap` entered a closed pit lane (2007-08): its in-lap
    ends within PIT_CLOSED_SC_LAPS of a SC's deployment. A stop only for wet tyres is exempt."""
    if _rules(model).get("pitLaneClosedUnderSC") is not True or to in WET_TYRES:
        return False
    sc_laps = 0
    lap = out_lap - 1
    while neutral.get(lap) == "SC":
        sc_laps += 1
        lap -= 1
    return 1 <= sc_laps <= PIT_CLOSED_SC_LAPS


def stop_go_cost(model: dict) -> float:
    """The stop-go's cost (s): the green pit loss plus the ten seconds stationary."""
    return float(model["track"]["pitLoss"]) + STOP_GO_SECONDS


def serve_stop_go(car, flag: str | None, lap: int, laps: int) -> float:
    """Serve an owed stop-go on a green lap (or at the flag); returns the time charged."""
    owed = car.stop_go
    if owed <= 0 or (flag and lap < laps):
        return 0.0
    car.stop_go = 0.0
    return owed


def sc_queue(model: dict) -> tuple[str, str] | str | None:
    """How the SC queue closes up: None (every lapped car unlaps), "none" (they stay a lap
    down) or the duel pair (Abu Dhabi 2021's waved cars)."""
    unlap = model["race"].get("scUnlap")
    if unlap == "duel":
        return (model["userSide"], model["rival"])
    return "none" if unlap == "none" else None


# --- The rules by year (roadmap R5, corrected) ----------------------------------------------


def rules_for_year(year: int) -> dict:
    """The `rules` keys this step owns for a race in `year`. refuelling and fuelLimit (R4) are
    eras build plan 4.2's. KERS was optional per team in 2009 and 2011; the race-level rule
    can't say which cars had it."""
    if year >= 2014:
        ers = "hybrid"
    elif year == 2009 or 2011 <= year <= 2013:
        ers = "kers"
    else:
        ers = "none"
    return {
        "twoCompound": year >= 2007,
        "tyreChanges": year != 2005,
        "pitLaneClosedUnderSC": 2007 <= year <= 2008,
        "vsc": year >= 2015,
        "drs": 2011 <= year <= 2025,
        "ers": ers,
    }


def sc_unlap_for_year(year: int) -> str:
    """race.scUnlap for `year`: lapped cars unlapped in 2007-09 and from 2012. Not an overlay
    key (the overlay holds eras, provenance, rules, storylineEvents), so it's reported, not
    written."""
    return "all" if 2007 <= year <= 2009 or year >= 2012 else "none"


def appendix_races(plan: Path = BUILD_PLAN) -> list[str]:
    """The 100 race ids in the build plan's appendix table."""
    text = plan.read_text().split("## Appendix: the 100 races", 1)[1]
    return re.findall(r"^\| \d+ \| `([a-z0-9-]+)` \|", text, flags=re.M)


def race_year(race_id: str) -> int:
    return int(race_id.rsplit("-", 1)[1])


def write_rules_overlays(race_ids: list[str], out_dir: Path = ERAS_OVERLAY_DIR) -> list[Path]:
    """Set the `rules` key of data/eras/<id>.json from each race's year, keeping every other
    key as it is."""
    out_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for race_id in race_ids:
        path = out_dir / f"{race_id}.json"
        overlay = json.loads(path.read_text()) if path.exists() else {}
        overlay["rules"] = rules_for_year(race_year(race_id))
        path.write_text(json.dumps(overlay, indent=2) + "\n")
        written.append(path)
    return written


if __name__ == "__main__":  # python -m pipeline.race_rules: rewrite the overlays' rules
    for p in write_rules_overlays(appendix_races()):
        print(p)
