"""The 3D scenery's line-up of the game's outline with the real lap (scenery.align and
fraction_table): a known rotation, scale, shift and mirror come back, and fractions of the
game's lap land on the same places of the real one."""

import math

import numpy as np

from pipeline import scenery


def _lap() -> np.ndarray:
    # an irregular closed lap (no symmetry, so only one fit is right)
    t = np.linspace(0, 2 * math.pi, 400, endpoint=False)
    r = 600 + 160 * np.sin(2 * t) + 70 * np.cos(3 * t + 0.4) + 40 * np.sin(5 * t)
    return np.stack([r * np.cos(t), r * np.sin(t)], 1)


def test_align_recovers_a_mirrored_turned_scaled_lap():
    real = _lap()
    a = math.radians(127)
    R = np.array([[math.cos(a), -math.sin(a)], [math.sin(a), math.cos(a)]])
    M_true = 0.37 * R @ np.diag([1, -1])
    game = (real - [40, -25]) @ np.linalg.inv(M_true).T
    M, t, err = scenery.align(game, scenery.resample(list(map(tuple, real)), 3, closed=True))
    assert err < 2
    assert np.allclose(game @ M.T + t, real, atol=3)


def test_fraction_table_follows_the_lap_from_wherever_it_starts():
    real = scenery.resample(list(map(tuple, _lap())), 3, closed=True)
    game = np.roll(_lap(), 100, axis=0)  # the game's lap starts at the real one's point 300
    M, t, _ = scenery.align(game, real)
    frac = scenery.fraction_table(game, real, M, t, n=40)
    steps = np.diff(frac)
    assert (steps > 0).all()  # always forward
    assert abs((frac[-1] - frac[0]) - 39 / 40) < 0.03  # one lap, near enough evenly
    p = real[int(round((frac[0] % 1) * len(real))) % len(real)]
    assert np.linalg.norm(p - _lap()[300]) < 15
