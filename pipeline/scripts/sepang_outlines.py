"""Redraw the Sepang outlines (malaysia-1999 to 2015) from the real lap.

The five outlines were adapted from F1DB's schematic `sepang-1` drawing, whose straights and
final hairpin pinch inward: placed on the ground they run up to 32 m inside the real track
(docs/realistic-ui-spec.md, track accuracy). Sepang's layout was the same from 1999 to 2017,
so each file is redrawn from OpenStreetMap's lap (data/scenery/sepang.json `lap.pts`, the
raceway cycle `pipeline scenery sepang` picked), brought into the outline's own frame with the
inverse of its fit. Kept from each file: the frame (width, height), the start line (the real
point nearest the old start), the direction of travel, the number of points, the corner
numbers (each moved to the nearest point of the real line) and the stand-in pit lane (each
point kept at its share of the lap and its distance beside the track).

Run from pipeline/: uv run python scripts/sepang_outlines.py
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
RACES = ["malaysia-1999", "malaysia-2001", "malaysia-2006", "malaysia-2013", "malaysia-2015"]


def resample(p: np.ndarray, n: int) -> np.ndarray:
    q = np.vstack([p, p[:1]])
    cum = np.concatenate([[0], np.cumsum(np.linalg.norm(np.diff(q, axis=0), axis=1))])
    t = np.linspace(0, cum[-1], n, endpoint=False)
    return np.stack([np.interp(t, cum, q[:, 0]), np.interp(t, cum, q[:, 1])], 1)


def signed_area(p: np.ndarray) -> float:
    x, y = p[:, 0], p[:, 1]
    return 0.5 * float(np.sum(x * np.roll(y, -1) - np.roll(x, -1) * y))


def along(line: np.ndarray, q: np.ndarray) -> tuple[float, float]:
    """Where `q` is beside the closed `line`: its share of the lap and its signed distance."""
    a, b = line, np.roll(line, -1, axis=0)
    ab = b - a
    t = np.clip(np.einsum("ij,ij->i", q - a, ab) / np.einsum("ij,ij->i", ab, ab), 0, 1)
    foot = a + ab * t[:, None]
    d = np.linalg.norm(q - foot, axis=1)
    k = int(np.argmin(d))
    seg = np.linalg.norm(ab, axis=1)
    cum = np.concatenate([[0], np.cumsum(seg)])
    s = (cum[k] + t[k] * seg[k]) / cum[-1]
    side = np.sign(ab[k, 0] * (q[1] - a[k, 1]) - ab[k, 1] * (q[0] - a[k, 0])) or 1.0
    return float(s), float(side * d[k])


def at(line: np.ndarray, s: float, offset: float) -> list[float]:
    """The point at share `s` of the closed `line`, `offset` to the side (as `along` measures)."""
    q = np.vstack([line, line[:1]])
    seg = np.linalg.norm(np.diff(q, axis=0), axis=1)
    cum = np.concatenate([[0], np.cumsum(seg)])
    d = (s % 1) * cum[-1]
    k = min(int(np.searchsorted(cum, d, side="right")) - 1, len(seg) - 1)
    u = (d - cum[k]) / seg[k] if seg[k] else 0
    p = q[k] + (q[k + 1] - q[k]) * u
    tx, ty = (q[k + 1] - q[k]) / (seg[k] or 1)
    n = np.array([-ty, tx])
    return [round(float(v), 1) for v in p + n * offset]


def main() -> None:
    scen = json.loads((ROOT / "data/scenery/sepang.json").read_text())
    real = np.asarray(scen["lap"]["pts"], float)
    for race in RACES:
        path = ROOT / f"data/tracks/{race}.json"
        o = json.loads(path.read_text())
        old = np.asarray(o["points"], float)
        fit = scen["races"][race]
        M = np.asarray(fit["m"], float).reshape(2, 2)
        t = np.asarray(fit["t"], float)
        line = (real - t) @ np.linalg.inv(M).T  # metres -> the outline's map units
        if np.sign(signed_area(line)) != np.sign(signed_area(old)):
            line = line[::-1]
        line = resample(line, len(old))
        start = int(np.argmin(np.linalg.norm(line - old[0], axis=1)))
        line = np.roll(line, -start, axis=0)
        new = o | {"points": [[round(float(x), 1), round(float(y), 1)] for x, y in line]}
        new["corners"] = [
            [
                c[0],
                *line[int(np.argmin(np.linalg.norm(line - np.asarray(c[1:]), axis=1)))]
                .round(1)
                .tolist(),
            ]
            for c in o["corners"]
        ]
        if o.get("pit"):
            new["pit"] = [at(line, *along(old, np.asarray(q, float))) for q in o["pit"]]
        path.write_text(json.dumps(new) + "\n", encoding="utf-8", newline="\n")
        lo, hi = line.min(0), line.max(0)
        print(
            f"{race}: {len(line)} points, x {lo[0]:.0f}..{hi[0]:.0f} of {o['width']},"
            f" y {lo[1]:.0f}..{hi[1]:.0f} of {o['height']}"
        )


if __name__ == "__main__":
    main()
