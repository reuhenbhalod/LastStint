from pipeline import outline


def test_normalize_fits_the_box_and_keeps_corners_on_the_same_transform():
    # A 200 x 100 rectangle, no rotation: scaled to the width, y flipped (SVG is y-down).
    xy = [(0, 0), (200, 0), (200, 100), (0, 100)]
    shape = outline.normalize(xy, 0, [(1, 200, 0)], width=1000, margin=40)
    xs = [p[0] for p in shape["points"]]
    assert (min(xs), max(xs)) == (40, 960)
    assert shape["height"] == 80 + 460
    assert shape["points"][0] == [40, 500]  # (0, 0) is bottom-left
    assert shape["corners"] == [[1, 960, 500]]


def test_normalize_rotates():
    shape = outline.normalize([(0, 0), (100, 0)], 90, [], width=200, margin=0)
    # A horizontal segment rotated 90 degrees becomes vertical.
    assert shape["points"][0][0] == shape["points"][1][0]


def test_pit_lane_spans_the_off_line_stretch_and_survives_a_crossing():
    # Racing line: a 1000-unit straight. The in-lap runs on it, then peels off by 100; the
    # out-lap runs in the lane, crosses the line once (a tunnel), then rejoins for good.
    line = [(float(x), 0.0) for x in range(0, 1001, 50)]
    in_lap = [(100.0, 0.0), (200.0, 0.0), (300.0, 100.0), (400.0, 100.0)]
    out_lap = [(500.0, 100.0), (600.0, 0.0), (700.0, -100.0), (800.0, 0.0), (900.0, 0.0)]
    lane = outline.pit_lane(line, in_lap, out_lap)
    assert lane == [(300.0, 100.0), (400.0, 100.0), (500.0, 100.0), (600.0, 0.0), (700.0, -100.0)]


def test_normalize_puts_the_pit_lane_on_the_same_transform():
    xy = [(0, 0), (200, 0), (200, 100), (0, 100)]
    shape = outline.normalize(xy, 0, [], width=1000, margin=40, pit=[(200, 0)])
    assert shape["pit"] == [[960, 500]]


def _square(n: int = 400) -> list[tuple[float, float]]:
    """A 4,000 x 4,000 square lap, n points."""
    side = n // 4
    pts = []
    for k in range(side):
        pts.append((k * 4000 / side, 0.0))
    for k in range(side):
        pts.append((4000.0, k * 4000 / side))
    for k in range(side):
        pts.append((4000 - k * 4000 / side, 4000.0))
    for k in range(side):
        pts.append((0.0, 4000 - k * 4000 / side))
    return pts


def test_valid_pit_rejects_frozen_and_gappy_traces():
    from pipeline.outline import valid_pit

    lap = _square()
    good = [(x, 80.0) for x in range(0, 2000, 40)]
    assert valid_pit(good, lap)
    assert not valid_pit([(-4626.0, -12975.0)] * 40, lap)  # frozen (2019)
    gappy = good[:20] + [(x + 900, y) for x, y in good[20:]]
    assert not valid_pit(gappy, lap)


def test_frozen_pit_lane_follows_the_line_between_freeze_and_thaw():
    from pipeline.outline import frozen_pit_lane

    lap = _square()
    frozen = (-4626.0, -12975.0)
    in_lap = [lap[k] for k in range(300, 395)] + [frozen] * 10
    out_lap = [frozen] * 10 + [lap[k] for k in range(20, 120)]
    path = frozen_pit_lane(lap, in_lap, out_lap)
    assert path[0] == lap[394]
    assert path[-1] == lap[20]
    assert len(path) == (20 - 394) % 400 + 1
    assert frozen_pit_lane(lap, lap[:50], lap[50:100]) == []  # nothing froze
