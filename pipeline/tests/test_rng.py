"""RNG parity (Implementation Plan 2.2): the Python port must match rng.ts bit for bit.

data/golden/rng-vectors.json is the shared contract; packages/sim/tests/rng.test.ts checks
the same file from the TypeScript side.
"""

from __future__ import annotations

import json

import pytest

from pipeline.paths import GOLDEN_DIR
from pipeline.rng import Mulberry32, derive_seed

VECTORS = json.loads((GOLDEN_DIR / "rng-vectors.json").read_text())


@pytest.mark.parametrize("seed", list(VECTORS["mulberry32"]))
def test_mulberry32_matches_vectors(seed):
    r = Mulberry32(int(seed))
    assert [r.next() for _ in range(8)] == VECTORS["mulberry32"][seed]


def test_derive_seed_matches_vectors():
    for v in VECTORS["deriveSeed"]:
        assert derive_seed(v["daily"], v["stream"]) == v["seed"]


@pytest.mark.parametrize("seed", list(VECTORS["normal"]))
def test_normal_matches_vectors(seed):
    r = Mulberry32(int(seed))
    assert [r.normal(0.5) for _ in range(6)] == pytest.approx(VECTORS["normal"][seed], abs=1e-12)


def test_normal_is_roughly_standard():
    r = Mulberry32(1)
    xs = [r.normal() for _ in range(20000)]
    mean = sum(xs) / len(xs)
    var = sum((x - mean) ** 2 for x in xs) / len(xs)
    assert abs(mean) < 0.03 and abs(var - 1) < 0.05
