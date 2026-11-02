"""Circuit outlines for the game's track map (frontend: apps/web TrackMap).

The outline is one lap of a car's X/Y position from FastF1, rotated by the circuit's official
map rotation and scaled into a fixed-width box, with the corner numbers. The first point is
the start/finish line, so a car's progress round the lap is a distance along the outline.
The pit lane is the stretch of a pit stop's in-lap and out-lap that leaves the racing line,
drawn on the same transform.
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
    pit: list[tuple[float, float]] | None = None,
) -> dict:
    """Rotate positions by the circuit rotation and scale them into a `width`-wide box
    (y down, as in SVG). Corners and the pit lane go through the same transform."""
    a = math.radians(rotation_deg)

    def rot(x: float, y: float) -> tuple[float, float]:
        return x * math.cos(a) - y * math.sin(a), x * math.sin(a) + y * math.cos(a)

    pts = [rot(x, y) for x, y in xy]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    min_x, max_x, min_y, max_y = min(xs), max(xs), min(ys), max(ys)
    scale = (width - 2 * margin) / max(max_x - min_x, max_y - min_y)

    def place(x: float, y: float) -> list[float]:
        return [round(margin + (x - min_x) * scale, 1), round(margin + (max_y - y) * scale, 1)]

    shape = {
        "width": width,
        "height": round(2 * margin + (max_y - min_y) * scale),
        "points": [place(x, y) for x, y in pts],
        "corners": [[n, *place(*rot(x, y))] for n, x, y in corners],
    }
    if pit:
        shape["pit"] = [place(*rot(x, y)) for x, y in pit]
    return shape


PIT_OFF_LINE = 20  # position units (0.1 m): further than this from the racing line = pit lane


def pit_lane(
    lap: list[tuple[float, float]],
    in_lap: list[tuple[float, float]],
    out_lap: list[tuple[float, float]],
) -> list[tuple[float, float]]:
    """The pit-lane path: from where the in-lap leaves the racing line (`lap`) to where the
    out-lap last rejoins it. A pit exit that crosses the track (a tunnel) touches the line
    for a moment, so the span runs to the last off-line point, not the first on-line one."""
    dense = []
    for (ax, ay), (bx, by) in zip(lap, lap[1:] + lap[:1], strict=True):
        dense += [(ax + (bx - ax) * t / 20, ay + (by - ay) * t / 20) for t in range(20)]

    def off(p: tuple[float, float]) -> bool:
        return min(math.hypot(p[0] - x, p[1] - y) for x, y in dense) > PIT_OFF_LINE

    in_off = [off(p) for p in in_lap]
    start = next((i for i, o in enumerate(in_off) if o and all(in_off[i:])), None)
    out_off = [off(p) for p in out_lap]
    end = max((i for i, o in enumerate(out_off) if o), default=None)
    if start is None or end is None:
        return []
    return in_lap[start:] + out_lap[: end + 1]


def fetch_outline(year: int, event: str, driver: str | None = None, step: int = 3) -> dict:
    """One fast lap's positions from FastF1 (network on first use; cached after)."""
    import fastf1

    ingest.enable_cache()
    session = fastf1.get_session(year, event, "R")
    session.load(laps=True, telemetry=True, weather=False, messages=False)
    laps = session.laps.pick_drivers(driver) if driver else session.laps
    fastest = laps.pick_fastest()

    def xy_of(lap) -> list[tuple[float, float]]:
        return [(float(x), float(y)) for x, y in lap.get_pos_data()[["X", "Y"]].to_numpy()]

    full = xy_of(fastest)
    # The same driver's first stop: its in-lap ends in the pit lane, its out-lap starts there.
    mine = session.laps.pick_drivers(fastest["Driver"])
    stops = mine[mine["PitInTime"].notna()]
    pit = []
    if len(stops):
        n = int(stops.iloc[0]["LapNumber"])
        in_lap, out_lap = mine[mine["LapNumber"] == n], mine[mine["LapNumber"] == n + 1]
        if len(in_lap) and len(out_lap):
            pit = pit_lane(full, xy_of(in_lap), xy_of(out_lap))[::step]
    info = session.get_circuit_info()
    corners = [(int(c.Number), float(c.X), float(c.Y)) for c in info.corners.itertuples()]
    return normalize(full[::step], float(info.rotation), corners, pit=pit)


def write_outline(race_id: str, outline: dict, tracks_dir: Path = TRACKS_DIR) -> Path:
    tracks_dir.mkdir(parents=True, exist_ok=True)
    path = tracks_dir / f"{race_id}.json"
    path.write_text(json.dumps({"raceId": race_id, **outline}) + "\n")
    return path
