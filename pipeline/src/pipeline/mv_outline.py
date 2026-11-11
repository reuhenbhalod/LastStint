"""Track outlines from the MultiViewer circuit API (Eras build step 2.5).

Since October 2026 FastF1's live-timing archive needs an F1TV subscription (openf1.py), so
`pipeline outline` can't trace new races without one. The circuit info FastF1 itself reads
(fastf1.mvapi: api.multiviewer.app/api/v1/circuits/<key>/<year>) still answers without one,
and besides the corners and the map rotation it carries the outline of a practice lap, x/y in
the same frame as FastF1 positions, starting at the timing line. Built with the same rotation
and corners through outline.normalize, it matches a FastF1-traced outline (Hungary 2019: the
same shape and corners to within a map unit, the start within 2% of the width).

It has no pit lane, so the lane is a stand-in along the track from pit entry to pit exit (as
outline.frozen_pit_lane does for 2019), set per circuit as fractions of the lap.

The API serves the nearest season it has for a circuit, so the season it returns is checked
against the race's (scripts/eras_tracks.py records which it got).
"""

from __future__ import annotations

import json
import urllib.request
from pathlib import Path

from . import outline
from .paths import CACHE_DIR

API = "https://api.multiviewer.app/api/v1/circuits"
TARGET_POINTS = 120  # about as many as a FastF1-traced outline


def fetch(circuit_key: int, year: int, cache_dir: Path = CACHE_DIR) -> dict:
    """The circuit info for a season, from the cache or the API."""
    path = cache_dir / "multiviewer" / f"{circuit_key}-{year}.json"
    if not path.exists():
        req = urllib.request.Request(
            f"{API}/{circuit_key}/{year}", headers={"User-Agent": "LastStint pipeline"}
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(body)
    return json.loads(path.read_text())


def build(info: dict, pit: tuple[float, float]) -> dict:
    """A data/tracks outline from MultiViewer circuit info; `pit` is (entry, exit) as lap
    fractions from the start line (entry negative: before the line)."""
    xy = [(float(x), float(y)) for x, y in zip(info["x"], info["y"], strict=True)]
    step = max(1, len(xy) // TARGET_POINTS)
    pts = xy[::step]
    n = len(pts)
    entry, exit_ = pit
    a = round(entry * n) % n
    lane = [pts[(a + j) % n] for j in range(round((exit_ - entry) * n) + 1)]
    corners = [
        (int(c["number"]), float(c["trackPosition"]["x"]), float(c["trackPosition"]["y"]))
        for c in info["corners"]
    ]
    return outline.normalize(pts, float(info["rotation"]), corners, pit=lane)
