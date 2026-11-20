"""Races batch 3 (docs/races-batch-3-spec.md): a data/tracks outline for the batch's races whose
FastF1 cache has no position data, so `pipeline outline` can't trace them offline.

Same two ways as scripts/eras_tracks.py:

- REUSE: the circuit ran the same layout in another season that has an outline, so that
  outline is copied under the new race id (corners, pit lane and start line included). The
  reason column says why the layout is the same. The owner checks these (layout changes:
  Yas Marina 2021, Barcelona 2023, Marina Bay 2023).
- MULTIVIEWER: Las Vegas, which has no other outline. The MultiViewer circuit API only serves
  2023 for it (the layout is unchanged since), with a stand-in pit lane, as in eras_tracks.py.

Never overwrites an existing data/tracks file.

    uv run python scripts/batch3_tracks.py            # write the missing files
    uv run python scripts/batch3_tracks.py --check    # list what would be written
"""

from __future__ import annotations

import json
import sys

import eras_tracks
from eras_tracks import TRACKS, source_outline

from pipeline import mv_outline

# Race -> (outline it reuses, why the layout is the same).
REUSE: dict[str, tuple[str, str]] = {
    "abu-dhabi-2025": ("abu-dhabi-2021", "Yas Marina since the 2021 changes"),
    "70th-anniversary-2020": ("great-britain-2022", "Silverstone Grand Prix layout"),
    "bahrain-2018": ("bahrain-2021", "Bahrain Grand Prix layout"),
    "azerbaijan-2025": ("azerbaijan-2023", "Baku street circuit"),
    "brazil-2023": ("brazil-2021", "Interlagos"),
    "brazil-2025": ("brazil-2021", "Interlagos"),
    "emilia-romagna-2025": ("emilia-romagna-2024", "Imola"),
    "italy-2025": ("italy-2024", "Monza"),
    "mexico-2025": ("mexico-2024", "Autodromo Hermanos Rodriguez"),
    "netherlands-2025": ("netherlands-2022", "Zandvoort since 2021"),
    "singapore-2025": ("singapore-2023", "Marina Bay since the 2023 changes"),
    "qatar-2025": ("qatar-2024", "Lusail"),
    "spain-2019": ("spain-2020", "Barcelona with the final chicane (to 2022)"),
    "united-states-2025": ("united-states-2022", "Circuit of the Americas"),
    "united-states-2018": ("united-states-2022", "Circuit of the Americas"),
    "australia-2022": ("australia-2025", "Albert Park since the 2022 changes"),
    "brazil-2018": ("brazil-2019", "Interlagos"),
    # 2014-2017 (TUM races, no position data): the same season's layout or the nearest one.
    "abu-dhabi-2014": ("abu-dhabi-2015", "Yas Marina before the 2021 changes"),
    "australia-2015": ("australia-2017", "Albert Park before the 2021-22 changes"),
    "australia-2016": ("australia-2017", "Albert Park before the 2021-22 changes"),
    "austria-2014": ("austria-2019", "Red Bull Ring"),
    "bahrain-2016": ("bahrain-2015", "Bahrain Grand Prix layout"),
    "belgium-2014": ("belgium-2018", "Spa-Francorchamps"),
    "belgium-2016": ("belgium-2018", "Spa-Francorchamps"),
    "canada-2017": ("canada-2016", "Circuit Gilles Villeneuve"),
    "china-2016": ("china-2017", "Shanghai"),
    "china-2014": ("china-2017", "Shanghai"),
    "germany-2014": ("germany-2016", "Hockenheim"),
    "hungary-2016": ("hungary-2015", "Hungaroring"),
    "italy-2017": ("italy-2019", "Monza"),
    "japan-2015": ("japan-2018", "Suzuka"),
    "malaysia-2014": ("malaysia-2015", "Sepang"),
    "mexico-2015": ("mexico-2019", "Autodromo Hermanos Rodriguez since 2015"),
    "mexico-2017": ("mexico-2019", "Autodromo Hermanos Rodriguez since 2015"),
    "russia-2017": ("russia-2018", "Sochi"),
    "spain-2015": ("spain-2016", "Barcelona with the final chicane (to 2022)"),
    "united-states-2017": ("united-states-2015", "Circuit of the Americas"),
}

# Race -> (MultiViewer circuit key, season asked for, season served, pit (entry, exit) as lap
# fractions from the line; a stand-in, as in eras_tracks.MULTIVIEWER).
MULTIVIEWER: dict[str, tuple[int, int, int, tuple[float, float]]] = {
    "las-vegas-2023": (152, 2023, 2023, (-0.05, 0.06)),
    "las-vegas-2024": (152, 2024, 2023, (-0.05, 0.06)),
}


def outline_for(race_id: str) -> dict:
    if race_id in REUSE:
        shape = source_outline(REUSE[race_id][0])
    else:
        key, asked, served, pit = MULTIVIEWER[race_id]
        info = mv_outline.fetch(key, asked)
        if int(info["year"]) != served:
            raise ValueError(f"{race_id}: MultiViewer served {info['year']}, expected {served}")
        shape = mv_outline.build(info, pit)
    shape = {k: v for k, v in shape.items() if k != "raceId"}
    return {"raceId": race_id, **shape}


def main(argv: list[str]) -> int:
    missing = [r for r in [*REUSE, *MULTIVIEWER] if not (TRACKS / f"{r}.json").exists()]
    for race_id in missing:
        if "--check" in argv:
            print("would write", race_id)
            continue
        path = TRACKS / f"{race_id}.json"
        path.write_text(json.dumps(outline_for(race_id)) + "\n", encoding="utf-8", newline="\n")
        print("wrote", path.relative_to(eras_tracks.paths.REPO_ROOT))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
