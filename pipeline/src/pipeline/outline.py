"""Circuit outlines for the game's track map (frontend: apps/web TrackMap).

The outline is one lap of a car's X/Y position from FastF1, rotated by the circuit's official
map rotation and scaled into a fixed-width box, with the corner numbers. The first point is
the start/finish line, so a car's progress round the lap is a distance along the outline.
"""

from __future__ import annotations

import json
import math
from pathlib import Path

from . import ingest, paths

TRACKS_DIR = paths.DATA_DIR / "tracks"
WIDTH = 1000  # outline box width; height follows the circuit's shape
MARGIN = 40


def normalize(
    xy: list[tuple[float, float]],
    rotation_deg: float,
    corners: list[tuple[int, float, float]],
    width: int = WIDTH,
    margin: int = MARGIN,
) -> dict:
    """Rotate positions by the circuit rotation and scale them into a `width`-wide box
    (y down, as in SVG). Corners go through the same transform."""
    a = math.radians(rotation_deg)

    def rot(x: float, y: float) -> tuple[float, float]:
        return x * math.cos(a) - y * math.sin(a), x * math.sin(a) + y * math.cos(a)

    pts = [rot(x, y) for x, y in xy]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    min_x, max_x, min_y, max_y = min(xs), max(xs), min(ys), max(ys)
    scale = (width - 2 * margin) / max(max_x - min_x, max_y - min_y)

    def place(x: float, y: float) -> list[float]:
        return [round(margin + (x - min_x) * scale, 1), round(margin + (max_y - y) * scale, 1)]

    return {
        "width": width,
        "height": round(2 * margin + (max_y - min_y) * scale),
        "points": [place(x, y) for x, y in pts],
        "corners": [[n, *place(*rot(x, y))] for n, x, y in corners],
    }


def fetch_outline(year: int, event: str, driver: str | None = None, step: int = 3) -> dict:
    """One fast lap's positions from FastF1 (network on first use; cached after)."""
    import fastf1

    ingest.enable_cache()
    session = fastf1.get_session(year, event, "R")
    session.load(laps=True, telemetry=True, weather=False, messages=False)
    laps = session.laps.pick_drivers(driver) if driver else session.laps
    pos = laps.pick_fastest().get_pos_data()
    xy = [(float(x), float(y)) for x, y in pos[["X", "Y"]].to_numpy()[::step]]
    info = session.get_circuit_info()
    corners = [(int(c.Number), float(c.X), float(c.Y)) for c in info.corners.itertuples()]
    return normalize(xy, float(info.rotation), corners)


def write_outline(race_id: str, outline: dict, tracks_dir: Path = TRACKS_DIR) -> Path:
    tracks_dir.mkdir(parents=True, exist_ok=True)
    path = tracks_dir / f"{race_id}.json"
    path.write_text(json.dumps({"raceId": race_id, **outline}) + "\n")
    return path
