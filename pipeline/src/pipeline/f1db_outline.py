"""Track outlines from f1db circuit-layout SVGs (Eras build step 2.5).

Races before 2018 have no FastF1 position data, so a layout that no 2018+ race shares is
drawn from f1db's SVG of that layout (github.com/f1db/f1db, src/assets/circuits, CC BY 4.0).
Each SVG is one closed path with no start line, direction, pit lane or corners, so those are
set by hand per layout (scripts/eras_tracks.py) and applied here:

- the path is sampled evenly by length and turned to the race's direction of travel,
- the lap starts at the start/finish line (a fraction of the way round the SVG path),
- corners are placed at the sharpest bends (the layout's turn count), unless set by hand,
- the pit lane is a stand-in that follows the track from pit entry to pit exit (as
  outline.frozen_pit_lane does for 2019): the map draws it beside the track.

The result goes through outline.normalize, so it has the same shape as every other
data/tracks file.
"""

from __future__ import annotations

import math
import re

from . import outline

Point = tuple[float, float]

OUTPUT_STEP = 2

_TOKEN = re.compile(r"[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?")
_ARGS = {"M": 2, "L": 2, "H": 1, "V": 1, "C": 6, "S": 4, "Q": 4, "T": 2, "A": 7, "Z": 0}


def _cubic(p0: Point, p1: Point, p2: Point, p3: Point, n: int = 12) -> list[Point]:
    out = []
    for i in range(1, n + 1):
        t = i / n
        u = 1 - t
        out.append(
            (
                u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
                u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1],
            )
        )
    return out


def _arc(p0: Point, rx: float, ry: float, phi_deg: float, large: bool, sweep: bool, p1: Point):
    """SVG elliptical arc to points (endpoint to centre parameterisation, SVG spec F.6.5)."""
    if rx == 0 or ry == 0 or p0 == p1:
        return [p1]
    phi = math.radians(phi_deg)
    cp, sp = math.cos(phi), math.sin(phi)
    dx, dy = (p0[0] - p1[0]) / 2, (p0[1] - p1[1]) / 2
    x1 = cp * dx + sp * dy
    y1 = -sp * dx + cp * dy
    rx, ry = abs(rx), abs(ry)
    lam = x1 * x1 / (rx * rx) + y1 * y1 / (ry * ry)
    if lam > 1:
        rx, ry = rx * math.sqrt(lam), ry * math.sqrt(lam)
    num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1
    den = rx * rx * y1 * y1 + ry * ry * x1 * x1
    co = math.sqrt(max(0.0, num / den)) if den else 0.0
    if large == sweep:
        co = -co
    cx1, cy1 = co * rx * y1 / ry, -co * ry * x1 / rx
    cx = cp * cx1 - sp * cy1 + (p0[0] + p1[0]) / 2
    cy = sp * cx1 + cp * cy1 + (p0[1] + p1[1]) / 2

    def ang(ux: float, uy: float, vx: float, vy: float) -> float:
        a = math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
        return a

    t1 = ang(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry)
    dt = ang((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry)
    if not sweep and dt > 0:
        dt -= 2 * math.pi
    elif sweep and dt < 0:
        dt += 2 * math.pi
    n = max(4, int(abs(dt) / (math.pi / 24)))
    out = []
    for i in range(1, n + 1):
        t = t1 + dt * i / n
        x, y = rx * math.cos(t), ry * math.sin(t)
        out.append((cp * x - sp * y + cx, sp * x + cp * y + cy))
    return out


def parse_path(d: str) -> list[Point]:
    """The points of an SVG path's first subpath (curves flattened), in SVG coordinates."""
    tokens = _TOKEN.findall(d)
    pts: list[Point] = []
    cur: Point = (0.0, 0.0)
    start: Point = (0.0, 0.0)
    last_ctrl: Point | None = None
    cmd = ""
    i = 0
    while i < len(tokens):
        if tokens[i].isalpha():
            cmd = tokens[i]
            i += 1
            if cmd in "Zz":
                break  # the lap closes: one subpath only
        up = cmd.upper()
        rel = cmd.islower()
        k = _ARGS[up]
        args = [float(t) for t in tokens[i : i + k]]
        i += k
        ox, oy = cur if rel else (0.0, 0.0)
        ctrl = None
        if up == "M":
            cur = (ox + args[0], oy + args[1])
            start = cur
            pts.append(cur)
            cmd = "l" if rel else "L"  # further pairs are line-tos
        elif up == "L":
            cur = (ox + args[0], oy + args[1])
            pts.append(cur)
        elif up == "H":
            cur = ((cur[0] if rel else 0.0) + args[0], cur[1])
            pts.append(cur)
        elif up == "V":
            cur = (cur[0], (cur[1] if rel else 0.0) + args[0])
            pts.append(cur)
        elif up in "CS":
            if up == "C":
                c1 = (ox + args[0], oy + args[1])
                c2, end = (ox + args[2], oy + args[3]), (ox + args[4], oy + args[5])
            else:
                c1 = (2 * cur[0] - last_ctrl[0], 2 * cur[1] - last_ctrl[1]) if last_ctrl else cur
                c2, end = (ox + args[0], oy + args[1]), (ox + args[2], oy + args[3])
            pts += _cubic(cur, c1, c2, end)
            cur, ctrl = end, c2
        elif up in "QT":
            if up == "Q":
                q, end = (ox + args[0], oy + args[1]), (ox + args[2], oy + args[3])
            else:
                q = (2 * cur[0] - last_ctrl[0], 2 * cur[1] - last_ctrl[1]) if last_ctrl else cur
                end = (ox + args[0], oy + args[1])
            c1 = (cur[0] + 2 / 3 * (q[0] - cur[0]), cur[1] + 2 / 3 * (q[1] - cur[1]))
            c2 = (end[0] + 2 / 3 * (q[0] - end[0]), end[1] + 2 / 3 * (q[1] - end[1]))
            pts += _cubic(cur, c1, c2, end)
            cur, ctrl = end, q
        elif up == "A":
            end = (ox + args[5], oy + args[6])
            pts += _arc(cur, args[0], args[1], args[2], bool(args[3]), bool(args[4]), end)
            cur = end
        last_ctrl = ctrl if up in "CSQT" else None
    if pts and math.dist(pts[-1], start) < 1e-6:
        pts.pop()
    return pts


def svg_path(svg_text: str) -> str:
    m = re.search(r'<path[^>]*\sd="([^"]+)"', svg_text)
    if not m:
        raise ValueError("no <path d=...> in the SVG")
    return m.group(1)


def resample(pts: list[Point], n: int) -> list[Point]:
    """n points evenly spaced by length round a closed polyline, from its first point."""
    segs = list(zip(pts, pts[1:] + pts[:1], strict=True))
    lengths = [math.dist(a, b) for a, b in segs]
    total = sum(lengths)
    out = []
    j, acc = 0, 0.0
    for i in range(n):
        target = total * i / n
        while acc + lengths[j] < target:
            acc += lengths[j]
            j += 1
        a, b = segs[j]
        u = (target - acc) / lengths[j] if lengths[j] else 0.0
        out.append((a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u))
    return out


def signed_area(pts: list[Point]) -> float:
    """Shoelace area in y-up coordinates: positive = anticlockwise."""
    return 0.5 * sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(pts, pts[1:] + pts[:1], strict=True))


def bends(pts: list[Point], threshold: float = 0.015, smooth: int = 2) -> list[tuple[int, float]]:
    """The lap's bends as (apex index, total heading change in radians), in lap order.

    A bend is a run of points turning the same way faster than `threshold` radians per point
    (after a moving average over +-`smooth` points); a chicane is two bends (the sign flips).
    Runs of the same sign split by a gap of up to two points are one bend. The apex is the
    point of sharpest turn in the run."""
    n = len(pts)
    head = [
        math.atan2(pts[(i + 1) % n][1] - pts[i][1], pts[(i + 1) % n][0] - pts[i][0])
        for i in range(n)
    ]
    step = [((head[i] - head[i - 1] + math.pi) % (2 * math.pi)) - math.pi for i in range(n)]
    sm = [
        sum(step[(i + k) % n] for k in range(-smooth, smooth + 1)) / (2 * smooth + 1)
        for i in range(n)
    ]
    sign = [0 if abs(v) < threshold else (1 if v > 0 else -1) for v in sm]
    # Start the scan on a straight point so no run wraps round the start of the list.
    first = next((i for i in range(n) if sign[i] == 0), 0)
    runs: list[list[int]] = []
    last_pos = -10
    for pos in range(n):
        i = (first + pos) % n
        if sign[i] == 0:
            continue
        if runs and sign[runs[-1][-1]] == sign[i] and pos - last_pos <= 3:
            runs[-1].append(i)
        else:
            runs.append([i])
        last_pos = pos
    out = []
    for run in runs:
        apex = max(run, key=lambda k: abs(sm[k]))
        out.append((apex, sum(abs(step[k]) for k in run)))
    return sorted(out)


START_CLEAR = 0.02  # share of the lap either side of the start line that is never a corner


def auto_corners(pts: list[Point], count: int) -> list[int]:
    """Apex indices of the `count` biggest bends (by total heading change), in lap order.
    The lap starts at the start/finish line, which is on a straight: a drawn wobble within
    START_CLEAR of it is not a corner."""
    n = len(pts)
    clear = START_CLEAR * n
    found = [b for b in bends(pts) if clear < b[0] < n - clear]
    biggest = sorted(found, key=lambda b: -b[1])[:count]
    return sorted(i for i, _ in biggest)


def build(
    svg_text: str,
    *,
    clockwise: bool,
    start: float,
    pit: tuple[float, float],
    turns: int | None = None,
    corners: list[float] | None = None,
    n: int = 360,
    reverse: bool | None = None,
    mirror: bool = False,
) -> dict:
    """A data/tracks outline from an f1db SVG.

    `start` is the start/finish line as a fraction of the way round the SVG path in its
    drawn order; `pit` is (entry, exit) as fractions of the lap from the start line (entry
    negative: before the line). `corners` are corner positions as lap fractions from the
    start line (numbered 1.. in order), else the `turns` sharpest bends. `reverse` overrides
    the direction test (a figure-of-eight has no meaningful area sign). `mirror` flips the
    drawing left to right, for an SVG drawn mirror-image.
    """
    raw = parse_path(svg_path(svg_text))
    if mirror:
        raw = [(-x, y) for x, y in raw]
    # SVG is y-down; work y-up so that normalize (which flips y back) keeps the drawing.
    pts = [(x, -y) for x, y in resample(raw, n)]
    k = round(start * n) % n
    pts = pts[k:] + pts[:k]
    if reverse is None:
        reverse = (signed_area(pts) > 0) == clockwise
    if reverse:
        pts = [pts[0]] + pts[1:][::-1]

    if corners is None:
        if turns is None:
            raise ValueError("give turns or corners")
        idx = auto_corners(pts, turns)
    else:
        idx = [round(f * n) % n for f in corners]
    corner_pts = [(i + 1, *pts[j]) for i, j in enumerate(idx)]

    entry, exit_ = pit
    a = round(entry * n) % n
    span = round((exit_ - entry) * n)
    lane = [pts[(a + j) % n] for j in range(span + 1)]
    # Bends are found at full resolution; the file keeps every OUTPUT_STEP-th point (the map
    # is drawn with round joins, and every outline is bundled into the web app).
    return outline.normalize(
        pts[::OUTPUT_STEP], 0.0, corner_pts, pit=lane[::OUTPUT_STEP] + lane[-1:]
    )
