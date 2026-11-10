"""Eras build step 2.5: a data/tracks outline for every race in the eras build plan's appendix
(docs/eras-build-plan.md) that has none yet.

Each race gets its outline one of four ways, chosen by the circuit layout f1db records for
that race (f1db race.yml `circuitLayoutId`, github.com/f1db/f1db, CC BY 4.0):

- FASTF1: traced from the race's own FastF1 position data by the same code as `pipeline
  outline` (scripts/eras_fastf1_outlines.py stages them). Only three got through before the
  live-timing archive started answering 401 (it needs an F1TV login since October 2026).
- MULTIVIEWER: 2018+ layouts, from the MultiViewer circuit API that FastF1 reads its circuit
  info from (pipeline.mv_outline): a real lap's outline, the official corner numbers and map
  rotation, with a stand-in pit lane.
- REUSE: a race on a layout f1db says is unchanged from a 2018+ race that has an outline, so
  that outline is copied under the new race id (corners, pit lane and start line included).
- F1DB: a layout no 2018+ outline covers, drawn from f1db's SVG of that layout
  (pipeline/scripts/f1db_layouts/, pipeline.f1db_outline), with the start line, direction, pit
  lane and corner count set per layout below.

Never overwrites an existing data/tracks file (other branches own those).

    uv run python scripts/eras_tracks.py            # write the missing files
    uv run python scripts/eras_tracks.py --check    # list what would be written
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

from pipeline import f1db_outline, mv_outline, paths

TRACKS = paths.DATA_DIR / "tracks"
STAGING = paths.REPO_ROOT / "pipeline" / "cache" / "eras-outlines"
LAYOUTS = Path(__file__).parent / "f1db_layouts"
PLAN = paths.REPO_ROOT / "docs" / "eras-build-plan.md"
F1DB_COMMIT = "be8174f1e1433baadfb818dfb13af9bbf447fb16"

# Races traced from their own FastF1 session (staged by eras_fastf1_outlines.py).
FASTF1 = ["monaco-2022", "great-britain-2022", "hungary-2022"]

# Race -> (MultiViewer circuit key, season asked for, season served, pit (entry, exit) as lap
# fractions from the line). The served season differs where the API has no data for the
# race's own: then f1db's layout id shows the layout is the same.
MULTIVIEWER: dict[str, tuple[int, int, int, tuple[float, float]]] = {
    "singapore-2023": (61, 2023, 2023, (-0.05, 0.06)),
    "brazil-2019": (14, 2019, 2019, (-0.10, 0.08)),
    "brazil-2021": (14, 2021, 2021, (-0.10, 0.08)),
    "australia-2025": (10, 2025, 2022, (-0.05, 0.07)),
    "australia-2010": (10, 2019, 2019, (-0.05, 0.07)),
    "spain-2021": (15, 2021, 2021, (-0.05, 0.07)),
    "azerbaijan-2021": (144, 2021, 2021, (-0.05, 0.06)),
    "turkey-2020": (59, 2020, 2020, (-0.05, 0.06)),
    "turkey-2021": (59, 2021, 2021, (-0.05, 0.06)),
    "germany-2018": (34, 2018, 2019, (-0.05, 0.06)),
    "germany-2019": (34, 2019, 2019, (-0.05, 0.06)),
    "europe-2007": (72, 2020, 2020, (-0.06, 0.08)),
    "emilia-romagna-2024": (6, 2024, 2022, (-0.06, 0.06)),
}

# Race -> (outline it reuses, the f1db layout id both races ran on). The source is a
# data/tracks file, a staged FastF1 trace or a MULTIVIEWER race.
REUSE: dict[str, tuple[str, str]] = {
    "monaco-2025": ("monaco-2022", "monaco-6"),
    "monaco-2017": ("monaco-2022", "monaco-6"),
    "monaco-2016": ("monaco-2022", "monaco-6"),
    "monaco-2015": ("monaco-2022", "monaco-6"),
    "monaco-2011": ("monaco-2022", "monaco-6"),
    "monaco-2008": ("monaco-2022", "monaco-6"),
    "monaco-2004": ("monaco-2022", "monaco-6"),
    "hungary-2024": ("hungary-2019", "hungaroring-3"),
    "hungary-2021": ("hungary-2019", "hungaroring-3"),
    "hungary-2015": ("hungary-2019", "hungaroring-3"),
    "hungary-2014": ("hungary-2019", "hungaroring-3"),
    "hungary-2006": ("hungary-2019", "hungaroring-3"),
    "hungary-2003": ("hungary-2019", "hungaroring-3"),
    "netherlands-2023": ("netherlands-2022", "zandvoort-5"),
    "belgium-2023": ("belgium-2024", "spa-francorchamps-4"),
    "great-britain-2016": ("great-britain-2022", "silverstone-8"),
    "great-britain-2021": ("great-britain-2022", "silverstone-8"),
    "bahrain-2023": ("bahrain-2021", "bahrain-1"),
    "great-britain-2023": ("great-britain-2022", "silverstone-8"),
    "japan-2023": ("japan-2024", "suzuka-2"),
    "abu-dhabi-2022": ("abu-dhabi-2021", "yas-marina-2"),
    "netherlands-2021": ("netherlands-2022", "zandvoort-5"),
    "bahrain-2006": ("bahrain-2021", "bahrain-1"),
    "turkey-2008": ("turkey-2021", "istanbul-1"),
    "italy-2010": ("italy-2019", "monza-7"),
    "australia-2013": ("australia-2010", "melbourne-1"),
    "bahrain-2012": ("bahrain-2021", "bahrain-1"),
    "abu-dhabi-2011": ("abu-dhabi-2020", "yas-marina-1"),
    "china-2013": ("china-2024", "shanghai-1"),
    "germany-2012": ("germany-2019", "hockenheimring-4"),
    "germany-2013": ("europe-2007", "nurburgring-4"),
    "bahrain-2015": ("bahrain-2021", "bahrain-1"),
    "abu-dhabi-2015": ("abu-dhabi-2020", "yas-marina-1"),
    "brazil-2014": ("brazil-2019", "interlagos-2"),
    "canada-2016": ("canada-2019", "montreal-6"),
    "united-states-2014": ("united-states-2019", "austin-1"),
    "germany-2016": ("germany-2019", "hockenheimring-4"),
    "australia-2017": ("australia-2010", "melbourne-1"),
    "australia-2018": ("australia-2010", "melbourne-1"),
    "spain-2017": ("spain-2020", "catalunya-4"),
    "china-2017": ("china-2024", "shanghai-1"),
    "china-2018": ("china-2024", "shanghai-1"),
    "saudi-arabia-2023": ("saudi-arabia-2025", "jeddah-1"),
    "miami-2024": ("miami-2023", "miami-1"),
    "saudi-arabia-2021": ("saudi-arabia-2025", "jeddah-1"),
    "russia-2018": ("russia-2020", "sirius-1"),
    "italy-2020": ("italy-2019", "monza-7"),
    "azerbaijan-2017": ("azerbaijan-2021", "baku-1"),
    "bahrain-2014": ("bahrain-2021", "bahrain-1"),
    "canada-2014": ("canada-2019", "montreal-6"),
    "canada-2011": ("canada-2019", "montreal-6"),
    "united-states-2015": ("united-states-2019", "austin-1"),
    "spain-2016": ("spain-2020", "catalunya-4"),
    "spain-2013": ("spain-2020", "catalunya-4"),
    "brazil-2012": ("brazil-2019", "interlagos-2"),
    "brazil-2009": ("brazil-2019", "interlagos-2"),
    "brazil-2008": ("brazil-2019", "interlagos-2"),
    "brazil-2007": ("brazil-2019", "interlagos-2"),
    "brazil-2006": ("brazil-2019", "interlagos-2"),
    "brazil-2003": ("brazil-2019", "interlagos-2"),
    "brazil-1993": ("brazil-2019", "interlagos-2"),
    "brazil-1991": ("brazil-2019", "interlagos-2"),
    "abu-dhabi-2016": ("abu-dhabi-2020", "yas-marina-1"),
    "abu-dhabi-2012": ("abu-dhabi-2020", "yas-marina-1"),
    "abu-dhabi-2010": ("abu-dhabi-2020", "yas-marina-1"),
    "china-2011": ("china-2024", "shanghai-1"),
    "china-2007": ("china-2024", "shanghai-1"),
    "japan-2005": ("japan-2024", "suzuka-2"),
    "japan-2003": ("japan-2024", "suzuka-2"),
    "austria-2002": ("austria-2019", "spielberg-3"),
    "austria-2001": ("austria-2019", "spielberg-3"),
    "canada-2003": ("canada-2019", "montreal-6"),
    "italy-2001": ("italy-2019", "monza-7"),
}

# f1db layouts no 2018+ race shares. `start`: the start/finish line as a fraction of the way
# round the SVG path in drawn order; `pit`: (entry, exit) as lap fractions from the line;
# `turns`: the race's f1db turn count; `clockwise`: f1db's direction unless noted.
# `mirror`: the SVG is drawn mirror-image (checked against a north-up map); `reverse`:
# direction of travel along the drawn path, where the area test can't tell (figure of eight).
LAYOUT_SPECS: dict[str, dict] = {
    "bahrain-3": {"clockwise": True, "start": 0.44, "pit": (-0.06, 0.08), "turns": 11},
    "hungaroring-1": {"clockwise": True, "start": 0.93, "pit": (-0.06, 0.05), "turns": 16},
    "hungaroring-2": {"clockwise": True, "start": 0.93, "pit": (-0.06, 0.05), "turns": 13},
    "catalunya-1": {"clockwise": True, "start": 0.03, "pit": (-0.04, 0.10), "turns": 16},
    "catalunya-2": {"clockwise": True, "start": 0.03, "pit": (-0.04, 0.10), "turns": 13},
    "adelaide-1": {"clockwise": True, "start": 0.72, "pit": (-0.07, 0.08), "turns": 16},
    "spa-francorchamps-2": {
        "clockwise": True,
        "start": 0.95,
        "pit": (-0.04, 0.045),
        "turns": 19,
    },
    "sepang-1": {"clockwise": True, "start": 0.50, "pit": (-0.045, 0.08), "turns": 15},
    "valencia-1": {"clockwise": True, "start": 0.355, "pit": (-0.035, 0.085), "turns": 25},
    "imola-2": {"clockwise": False, "start": 0.985, "pit": (-0.06, 0.06), "turns": 22},
    "hockenheimring-3": {"clockwise": True, "start": 0.99, "pit": (-0.03, 0.06), "turns": 16},
    # The long pre-2002 layout: f1db draws -2 (1986) like -3 (the chicanes moved), so it takes
    # -3's start line and pits, in the stadium.
    "hockenheimring-2": {"clockwise": True, "start": 0.99, "pit": (-0.03, 0.06), "turns": 16},
    # The short 1986-90 layout (the Mistral straight cut in half): line on the pit straight
    # between Pont and the Verrerie esses, placed by judgement.
    "paul-ricard-2": {"clockwise": True, "start": 0.88, "pit": (-0.06, 0.06), "turns": 9},
    "suzuka-1": {
        "clockwise": True,
        "reverse": False,
        "start": 0.62,
        "pit": (-0.04, 0.07),
        "turns": 18,
    },
    "indianapolis-2": {"clockwise": True, "start": 0.87, "pit": (-0.09, 0.10), "turns": 13},
    "magny-cours-3": {"clockwise": True, "start": 0.31, "pit": (-0.07, 0.07), "turns": 17},
    # The pre-2003 layout (the old final chicane): f1db draws it from a different point, so
    # its start is -3's line moved onto this path (nearest point after aligning the
    # drawings' centres); pits as -3's.
    "magny-cours-2": {"clockwise": True, "start": 0.325, "pit": (-0.07, 0.07), "turns": 15},
    "jerez-2": {"clockwise": True, "start": 0.925, "pit": (-0.075, 0.065), "turns": 15},
    "nurburgring-3": {"clockwise": True, "start": 0.08, "pit": (-0.04, 0.10), "turns": 12},
    "phoenix-1": {"clockwise": False, "start": 0.88, "pit": (-0.06, 0.06), "turns": 15},
    "mexico-city-2": {"clockwise": True, "start": 0.06, "pit": (-0.04, 0.14), "turns": 14},
    "monaco-5": {"clockwise": True, "start": 0.29, "pit": (-0.05, 0.06), "turns": 20},
    "monaco-4": {"clockwise": True, "start": 0.29, "pit": (-0.05, 0.06), "turns": 20},
    "donington-1": {
        "clockwise": True,
        "mirror": True,
        "start": 0.80,
        "pit": (-0.06, 0.06),
        "turns": 12,
    },
    # f1db says ANTI_CLOCKWISE; the old Kyalami ran clockwise (Crowthorne, the first corner,
    # was a right-hander): Wikipedia's 1961-1988 layout map and Motor Sport's circuit history.
    "kyalami-1": {"clockwise": True, "start": 0.72, "pit": (-0.04, 0.06), "turns": 9},
    "estoril-1": {"clockwise": True, "start": 0.84, "pit": (-0.06, 0.08), "turns": 11},
    "silverstone-3": {"clockwise": True, "start": 0.22, "pit": (-0.05, 0.06), "turns": 9},
    # The 1997-2009 layout (Bridge and Priory, before the 2010 Arena): drawn clockwise from
    # Abbey; line on the old pit straight between Woodcote and Copse, placed by judgement.
    "silverstone-7": {"clockwise": True, "start": 0.31, "pit": (-0.06, 0.05), "turns": 17},
    # singapore-2014's layout: line on the pit straight between the last corner and Turn 1,
    # placed by judgement against the 2023 MultiViewer outline's line; f1db's direction.
    "marina-bay-2": {"clockwise": False, "start": 0.045, "pit": (-0.05, 0.06), "turns": 23},
}

# Older race -> f1db layout drawn from its SVG.
F1DB: dict[str, str] = {
    "sakhir-2020": "bahrain-3",  # the outer circuit: MultiViewer serves only the GP layout
    "hungary-1986": "hungaroring-1",
    "hungary-1992": "hungaroring-2",
    "hungary-1997": "hungaroring-2",
    "hungary-1998": "hungaroring-2",
    "hungary-2001": "hungaroring-2",
    "spain-1994": "catalunya-1",
    "spain-1996": "catalunya-2",
    "australia-1986": "adelaide-1",
    "australia-1993": "adelaide-1",
    "australia-1994": "adelaide-1",
    "belgium-1992": "spa-francorchamps-2",
    "belgium-1995": "spa-francorchamps-2",
    "belgium-1998": "spa-francorchamps-2",
    "malaysia-1999": "sepang-1",
    "malaysia-2001": "sepang-1",
    "malaysia-2013": "sepang-1",
    "malaysia-2015": "sepang-1",
    "singapore-2014": "marina-bay-2",
    "europe-2012": "valencia-1",
    "san-marino-2005": "imola-2",
    "san-marino-2000": "imola-2",
    "san-marino-2003": "imola-2",
    "san-marino-2006": "imola-2",
    "malaysia-2006": "sepang-1",
    "europe-2009": "valencia-1",
    "france-2007": "magny-cours-3",
    "great-britain-2007": "silverstone-7",
    "germany-2000": "hockenheimring-3",
    "germany-1996": "hockenheimring-3",
    "germany-1997": "hockenheimring-3",
    "san-marino-1999": "imola-2",
    "germany-1986": "hockenheimring-2",
    "france-1990": "paul-ricard-2",
    "japan-2000": "suzuka-1",
    "united-states-2003": "indianapolis-2",
    "france-2004": "magny-cours-3",
    "france-2001": "magny-cours-2",
    "europe-1997": "jerez-2",
    "europe-1999": "nurburgring-3",
    "united-states-1990": "phoenix-1",
    "mexico-1986": "mexico-city-2",
    "mexico-1990": "mexico-city-2",
    "monaco-1988": "monaco-5",
    "monaco-1992": "monaco-5",
    "monaco-1984": "monaco-4",
    "europe-1993": "donington-1",
    "south-africa-1983": "kyalami-1",
    "portugal-1984": "estoril-1",
    "portugal-1985": "estoril-1",
    "great-britain-1987": "silverstone-3",
}


def appendix_ids(plan: Path = PLAN) -> list[str]:
    """The race ids in the build plan's appendix table, in its order."""
    text = plan.read_text().split("## Appendix", 1)[1]
    return re.findall(r"^\| \d+ \| `([a-z0-9-]+)` \|", text, re.M)


def layout_outline(layout: str) -> dict:
    svg = (LAYOUTS / f"{layout}.svg").read_text()
    return f1db_outline.build(svg, **LAYOUT_SPECS[layout])


def source_outline(race_id: str) -> dict:
    """An outline to reuse: a data/tracks file, a staged FastF1 trace or a MULTIVIEWER race."""
    for d in (TRACKS, STAGING):
        p = d / f"{race_id}.json"
        if p.exists():
            return json.loads(p.read_text())
    if race_id in MULTIVIEWER:
        return multiviewer_outline(race_id)
    raise FileNotFoundError(f"{race_id}: no data/tracks file or staged trace")


def multiviewer_outline(race_id: str) -> dict:
    key, asked, served, pit = MULTIVIEWER[race_id]
    info = mv_outline.fetch(key, asked)
    if int(info["year"]) != served:
        raise ValueError(f"{race_id}: MultiViewer served {info['year']}, expected {served}")
    return mv_outline.build(info, pit)


def outline_for(race_id: str) -> dict:
    if race_id in FASTF1:
        shape = source_outline(race_id)
    elif race_id in MULTIVIEWER:
        shape = multiviewer_outline(race_id)
    elif race_id in REUSE:
        shape = source_outline(REUSE[race_id][0])
    elif race_id in F1DB:
        shape = layout_outline(F1DB[race_id])
    else:
        raise KeyError(race_id)
    shape = {k: v for k, v in shape.items() if k != "raceId"}
    return {"raceId": race_id, **shape}


def main(argv: list[str]) -> int:
    check = "--check" in argv
    missing = [r for r in appendix_ids() if not (TRACKS / f"{r}.json").exists()]
    planned = {*FASTF1, *MULTIVIEWER, *REUSE, *F1DB}
    unplanned = [r for r in missing if r not in planned]
    if unplanned:
        print("no plan for:", " ".join(unplanned))
        return 1
    failed = []
    for race_id in missing:
        if check:
            print("would write", race_id)
            continue
        try:
            data = outline_for(race_id)
        except FileNotFoundError as e:
            failed.append(str(e))
            continue
        (TRACKS / f"{race_id}.json").write_text(json.dumps(data) + "\n")
        print(f"wrote {race_id}: {len(data['points'])} points, {len(data['corners'])} corners")
    for f in failed:
        print("FAILED", f)
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
