"""Eras build step 2.5: track outlines for the appendix races run in 2018 or later, traced
from FastF1 position data of that race by the same code as `pipeline outline`
(outline.fetch_outline), so they match the existing data/tracks files.

Since October 2026 the live-timing archive answers 401 without an F1TV login (openf1.py):
on Nov 7 2026 monaco-2022, great-britain-2022 and hungary-2022 traced, then every session
failed. eras_tracks.py uses the staged traces it finds and builds the rest from the
MultiViewer circuit API instead. With F1_USERNAME / F1_PASSWORD set (pipeline/.env), this
traces the rest, and deleting a race's data/tracks file and re-running eras_tracks.py would
pick the trace up only for races listed in eras_tracks.FASTF1.

Writes to a staging directory (pipeline/cache/eras-outlines/, git-ignored); eras_tracks.py
then writes the data/tracks files. Never touches an existing data/tracks file.

    uv run python scripts/eras_fastf1_outlines.py [race-id ...]
"""

from __future__ import annotations

import json
import sys
import time

from pipeline import outline, paths

STAGING = paths.REPO_ROOT / "pipeline" / "cache" / "eras-outlines"

# Staged id -> (season, FastF1 event name).
SESSIONS: dict[str, tuple[int, str]] = {
    "monaco-2022": (2022, "Monaco"),
    "great-britain-2022": (2022, "British"),
    "hungary-2022": (2022, "Hungary"),
    "singapore-2023": (2023, "Singapore"),
    "netherlands-2023": (2023, "Netherlands"),
    "miami-2024": (2024, "Miami"),
    "hungary-2024": (2024, "Hungary"),
    "belgium-2023": (2023, "Belgium"),
    "australia-2025": (2025, "Australia"),
    "monaco-2025": (2025, "Monaco"),
    "spain-2021": (2021, "Spain"),
    "azerbaijan-2021": (2021, "Azerbaijan"),
    "hungary-2021": (2021, "Hungary"),
    "turkey-2021": (2021, "Turkey"),
    "brazil-2021": (2021, "São Paulo"),
    "saudi-arabia-2021": (2021, "Saudi Arabia"),
    "germany-2018": (2018, "Germany"),
    "russia-2018": (2018, "Russia"),
    "germany-2019": (2019, "Germany"),
    "brazil-2019": (2019, "Brazil"),
    "italy-2020": (2020, "Italy"),
    "turkey-2020": (2020, "Turkey"),
    "sakhir-2020": (2020, "Sakhir"),
    # References for older races on an unchanged layout.
    "australia-2019": (2019, "Australia"),
    "eifel-2020": (2020, "Eifel"),
}


def main(ids: list[str]) -> int:
    STAGING.mkdir(parents=True, exist_ok=True)
    failed = []
    for race_id in ids or list(SESSIONS):
        target = STAGING / f"{race_id}.json"
        if target.exists():
            print(f"{race_id}: staged already")
            continue
        year, event = SESSIONS[race_id]
        for attempt in range(3):
            try:
                shape = outline.fetch_outline(year, event)
                break
            except Exception as e:  # noqa: BLE001 - network / rate limit: retry, then report
                print(f"{race_id}: attempt {attempt + 1} failed: {e}")
                time.sleep(30 * (attempt + 1))
        else:
            failed.append(race_id)
            continue
        target.write_text(json.dumps({"raceId": race_id, **shape}) + "\n")
        print(
            f"{race_id}: {len(shape['points'])} points, {len(shape['corners'])} corners,"
            f" {len(shape.get('pit', []))} pit points"
        )
    if failed:
        print("FAILED:", " ".join(failed))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
