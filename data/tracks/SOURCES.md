# Track outline sources

Each `<race-id>.json` here is a circuit outline for the race screen's map. Where they come from:

- **FastF1 position data** (`pipeline outline`, and `pipeline/scripts/eras_fastf1_outlines.py`):
  a real lap of that race, with corner numbers and map rotation from FastF1's circuit info.
- **MultiViewer circuit API** (`pipeline/src/pipeline/mv_outline.py`), the service FastF1 reads
  its circuit info from: the outline of a practice lap, official corner numbers and rotation.
- **F1DB** circuit layout SVGs (`pipeline/scripts/f1db_layouts/`, `pipeline/src/pipeline/f1db_outline.py`)
  for layouts no 2018+ race uses. Attribution required:
  circuit layouts from [F1DB](https://github.com/f1db/f1db) and its contributors
  (circuit SVG assets by Jules Roy), licensed under
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The outlines here are adapted
  (resampled, scaled, start line, corners and pit lane added).

- **OpenStreetMap** for the five Sepang outlines (`malaysia-1999`, `-2001`, `-2006`, `-2013`,
  `-2015`), redrawn on Nov 11, 2026 by `pipeline/scripts/sepang_outlines.py` from the raceway lap
  in `data/scenery/sepang.json`. F1DB's `sepang-1` drawing, used before, pinched the straights and
  the last hairpin up to 32 m inside the real track. Each file kept its frame, start line,
  direction, corner numbers (moved onto the real line) and stand-in pit lane. These five files
  are derived from OpenStreetMap data, © OpenStreetMap contributors, and are available under
  the [Open Database License](https://opendatacommons.org/licenses/odbl/1-0/).

The race map's ground images (`apps/web/public/basemap`) are also drawn from OpenStreetMap
data; the game credits it beside each map, in the footer and on the credits page. Which source each eras race
used, with evidence, is in `docs/eras-checks/2.5-track-maps.md`. The F1DB credit above belongs on
the game's credits page when there is one.
