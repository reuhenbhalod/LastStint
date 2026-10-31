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
