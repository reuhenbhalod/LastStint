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
PIT_REJOIN = 10  # out-lap samples back on the line in a row (about 2 s): rejoined


def pit_lane(
    lap: list[tuple[float, float]],
    in_lap: list[tuple[float, float]],
    out_lap: list[tuple[float, float]],
) -> list[tuple[float, float]]:
    """The pit-lane path: from where the in-lap leaves the racing line (`lap`) to where the
    out-lap rejoins it for good. A pit exit that crosses the track (a tunnel) touches the line
    for a moment, so the lane runs on through a short touch; it ends once the out-lap has been
    back on the line for PIT_REJOIN samples (a car racing a little off the fastest lap's line
    later on is not the pit lane)."""
    dense = []
    for (ax, ay), (bx, by) in zip(lap, lap[1:] + lap[:1], strict=True):
        dense += [(ax + (bx - ax) * t / 20, ay + (by - ay) * t / 20) for t in range(20)]

    def off(p: tuple[float, float]) -> bool:
        return min(math.hypot(p[0] - x, p[1] - y) for x, y in dense) > PIT_OFF_LINE

    in_off = [off(p) for p in in_lap]
    start = next((i for i, o in enumerate(in_off) if o and all(in_off[i:])), None)
    end = None
    on = 0
    for i, p in enumerate(out_lap):
        if off(p):
            end, on = i, 0
        else:
            on += 1
            if on >= PIT_REJOIN:
                break
    if start is None or end is None:
        return []
    return in_lap[start:] + out_lap[: end + 1]


PIT_MAX_STEP = 400  # position units (40 m): a longer jump between samples is a data gap
PIT_MIN_SPAN = 1000  # the lane covers at least 100 m
PIT_END_NEAR = 400  # its ends are within 40 m of the racing line
PIT_MAX_SHARE = 0.35  # and it is a short stretch: at most this share of the lap's length


def valid_pit(path: list[tuple[float, float]], lap: list[tuple[float, float]]) -> bool:
    """A usable pit-lane trace: enough points, no jumps (dropped position data), a real length
    but not much of a lap, and both ends near the track (where the lane leaves and rejoins it)."""
    if len(path) < 15:
        return False
    length = sum(math.dist(a, b) for a, b in zip(path, path[1:], strict=False))
    lap_length = sum(math.dist(a, b) for a, b in zip(lap, lap[1:] + lap[:1], strict=True))
    if length > PIT_MAX_SHARE * lap_length:
        return False
    if any(math.dist(a, b) > PIT_MAX_STEP for a, b in zip(path, path[1:], strict=False)):
        return False
    xs = [p[0] for p in path]
    ys = [p[1] for p in path]
    if max(max(xs) - min(xs), max(ys) - min(ys)) < PIT_MIN_SPAN:
        return False
    return all(min(math.dist(p, q) for q in lap) < PIT_END_NEAR for p in (path[0], path[-1]))


def frozen_pit_lane(
    lap: list[tuple[float, float]],
    in_lap: list[tuple[float, float]],
    out_lap: list[tuple[float, float]],
) -> list[tuple[float, float]]:
    """A stand-in pit lane for seasons whose position data freezes in the pit lane (2019: a
    car's position sticks at one point from pit entry to pit exit). Where the in-lap's
    position froze is the pit entry, where the out-lap's comes back is the exit; the lane
    follows the racing line between them (the map draws it beside the track)."""
    if len(in_lap) < 3 or len(out_lap) < 3:
        return []
    frozen = in_lap[-1]
    i = len(in_lap) - 1
    while i > 0 and in_lap[i] == frozen:
        i -= 1
    j = 0
    while j < len(out_lap) - 1 and out_lap[j] == frozen:
        j += 1
    if i == len(in_lap) - 1 or j == 0:
        return []  # nothing froze: not this case

    def nearest(p: tuple[float, float]) -> int:
        return min(range(len(lap)), key=lambda k: math.dist(p, lap[k]))

    a, b = nearest(in_lap[i]), nearest(out_lap[j])
    n = len(lap)
    span = (b - a) % n
    if span == 0 or span > n // 3:  # a pit lane is a short stretch, not a third of a lap
        return []
    return [lap[(a + k) % n] for k in range(span + 1)]


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
    # The pit lane from a stop's in-lap and out-lap: the fastest driver's stops first, then
    # everyone else's, until one traces cleanly (position data can drop out in the pits).
    pit: list[tuple[float, float]] = []
    order = [fastest["Driver"]] + [
        d for d in session.laps["Driver"].unique() if d != fastest["Driver"]
    ]
    for code in order:
        mine = session.laps.pick_drivers(code)
        for n in mine[mine["PitInTime"].notna()]["LapNumber"]:
            in_lap = mine[mine["LapNumber"] == int(n)]
            out_lap = mine[mine["LapNumber"] == int(n) + 1]
            if not len(in_lap) or not len(out_lap):
                continue
            try:
                path = pit_lane(full, xy_of(in_lap), xy_of(out_lap))
            except Exception:  # noqa: BLE001 - a lap without position data
                continue
            if valid_pit(path, full):
                pit = path[::step]
                break
        if pit:
            break
    if not pit:
        # No clean trace (2019: positions freeze in the pit lane): stand one in from where
        # the fastest driver's first stop froze and came back.
        mine = session.laps.pick_drivers(fastest["Driver"])
        for n in mine[mine["PitInTime"].notna()]["LapNumber"][:1]:
            in_lap = mine[mine["LapNumber"] == int(n)]
            out_lap = mine[mine["LapNumber"] == int(n) + 1]
            if len(in_lap) and len(out_lap):
                pit = frozen_pit_lane(full, xy_of(in_lap), xy_of(out_lap))[::step]
    info = session.get_circuit_info()
    corners = [(int(c.Number), float(c.X), float(c.Y)) for c in info.corners.itertuples()]
    return normalize(full[::step], float(info.rotation), corners, pit=pit)


def write_outline(race_id: str, outline: dict, tracks_dir: Path = TRACKS_DIR) -> Path:
    tracks_dir.mkdir(parents=True, exist_ok=True)
    path = tracks_dir / f"{race_id}.json"
    path.write_text(
        json.dumps({"raceId": race_id, **outline}) + "\n", encoding="utf-8", newline="\n"
    )
    return path
