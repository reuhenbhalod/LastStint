"""Eras build step 2.5: the track-outline tooling (f1db SVG layouts, MultiViewer circuit info)
and the per-race plan in scripts/eras_tracks.py."""

import importlib.util
import json
import math
from pathlib import Path

import pytest

from pipeline import f1db_outline, mv_outline, paths

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "eras_tracks.py"


def _eras_tracks():
    spec = importlib.util.spec_from_file_location("eras_tracks", SCRIPT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_parse_path_handles_relative_curves_lines_and_arcs():
    # A 100 x 100 square: absolute move, relative line, horizontal, vertical, close.
    sq = f1db_outline.parse_path("M0 0l100 0V100h-100z")
    assert sq == [(0, 0), (100, 0), (100, 100), (0, 100)]
    # A relative cubic ends where it says; an arc ends on its endpoint.
    cu = f1db_outline.parse_path("M10 10c10 0 20 10 20 20")
    assert cu[-1] == pytest.approx((30, 30))
    arc = f1db_outline.parse_path("M0 0a50 50 0 0 1 100 0")
    assert arc[-1] == pytest.approx((100, 0))
    # The half circle bulges out to radius 50 from (50, 0).
    assert max(abs(y) for _, y in arc) == pytest.approx(50, abs=0.5)


def test_resample_spaces_points_evenly():
    pts = f1db_outline.resample([(0, 0), (100, 0), (100, 100), (0, 100)], 8)
    gaps = [math.dist(a, b) for a, b in zip(pts, pts[1:] + pts[:1], strict=True)]
    assert gaps == pytest.approx([50] * 8)


SQUARE = '<svg><path d="M0 0H400V400H0z"/></svg>'


@pytest.mark.parametrize("clockwise", [True, False])
def test_build_runs_the_lap_the_right_way_round_from_the_start_line(clockwise):
    o = f1db_outline.build(
        SQUARE, clockwise=clockwise, start=0.125, pit=(-0.05, 0.05), turns=4, n=80
    )
    pts = o["points"]
    # The start line is the point an eighth of the way round the drawn path: (200, 0) in the
    # SVG, the middle of the top edge (y is down in the SVG and in the outline).
    assert pts[0][1] == pytest.approx(min(p[1] for p in pts))
    assert pts[0][0] == pytest.approx(500, abs=15)
    # Clockwise on screen: along the top edge the next point is to the right.
    assert (pts[1][0] > pts[0][0]) == clockwise
    # The four corners of the square, numbered in lap order.
    assert [c[0] for c in o["corners"]] == [1, 2, 3, 4]
    # The pit lane runs through the start line.
    assert len(o["pit"]) >= 2
    assert min(math.dist(p, pts[0]) for p in o["pit"]) < 1


def test_bends_split_a_chicane_and_skip_straights():
    # A straight with a left-right chicane in it, then round a big loop.
    pts = [(float(x), 0.0) for x in range(0, 100, 2)]
    pts += [(100 + i * 2.0, i * 2.0) for i in range(1, 6)]  # left
    pts += [(110 + i * 2.0, 10.0) for i in range(1, 6)]  # right, back to straight
    found = f1db_outline.bends(pts + [(120.0, 300.0), (-20.0, 300.0)])
    assert len(found) >= 2


def test_multiviewer_build_keeps_the_lap_corners_and_a_stand_in_pit_lane():
    # A square lap from the timing line, one corner, and a pit lane from a quarter-lap before
    # the line to a quarter-lap after it (along the track).
    info = {
        "x": [0, 1000, 1000, 0],
        "y": [0, 0, 1000, 1000],
        "rotation": 0,
        "corners": [{"number": 1, "trackPosition": {"x": 1000, "y": 0}}],
    }
    o = mv_outline.build(info, (-0.25, 0.25))
    assert o["width"] == 1000
    assert o["points"][0] == [40, 960]  # the timing line, bottom-left (y flipped)
    assert o["corners"] == [[1, 960, 960]]
    assert o["pit"] == [[40, 40], [40, 960], [960, 960]]


def test_every_appendix_race_has_a_plan_and_a_track_file():
    et = _eras_tracks()
    ids = et.appendix_ids()
    assert len(ids) == 100
    planned = {*et.FASTF1, *et.MULTIVIEWER, *et.REUSE, *et.F1DB}
    tracks = paths.DATA_DIR / "tracks"
    for race_id in ids:
        assert (tracks / f"{race_id}.json").exists(), race_id
        assert race_id in planned or race_id in {
            "bahrain-2021",
            "france-2021",
            "russia-2021",
            "abu-dhabi-2021",
            "hungary-2019",
            "styria-2021",  # swapped in Nov 9; outlined by `pipeline outline` before 2.5
        }, race_id
    for layout in set(et.F1DB.values()):
        assert layout in et.LAYOUT_SPECS
        assert (et.LAYOUTS / f"{layout}.svg").exists()


def test_f1db_layouts_rebuild_to_the_committed_files():
    et = _eras_tracks()
    tracks = paths.DATA_DIR / "tracks"
    for race_id, layout in et.F1DB.items():
        built = {"raceId": race_id, **et.layout_outline(layout)}
        assert json.loads((tracks / f"{race_id}.json").read_text()) == built, race_id
